import {
  app,
  BrowserWindow,
  Menu,
  Notification,
  Tray,
  globalShortcut,
  ipcMain,
  shell,
  nativeImage,
  session,
  WebContents,
  type ContextMenuParams,
  type MenuItemConstructorOptions,
  type NativeImage
} from 'electron';
import Store from 'electron-store';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaultSettings, type AppSettings, type ConnectionState, type UnreadPayload } from '../shared/settings.js';
import { isAllowedWhatsAppUrl } from '../shared/allowedOrigins.js';
import { desktopChromeUserAgent } from '../shared/browserProfile.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);
const whatsappUrl = 'https://web.whatsapp.com/';

app.commandLine.appendSwitch('high-dpi-support', '1');
app.commandLine.appendSwitch('enable-features', 'OverlayScrollbar');

const singleInstanceLock = app.requestSingleInstanceLock();

type StoreSchema = {
  settings: AppSettings;
};

const store = new Store<StoreSchema>({
  defaults: {
    settings: defaultSettings
  }
});

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let unreadCount = 0;
let lastNotifiedCount = 0;
let lastConnectionState: ConnectionState = 'unknown';
let defaultTrayIcon: NativeImage | null = null;
const unreadIconCache = new Map<string, NativeImage>();

function assetPath(...segments: string[]): string {
  if (isDev) {
    return path.join(app.getAppPath(), ...segments);
  }

  return path.join(process.resourcesPath, ...segments);
}

function iconPath(): string {
  return assetPath('assets', 'zapdesk.png');
}

function createUnreadIcon(count: number, size = 256): NativeImage {
  const label = count > 99 ? '99+' : String(count);
  const cacheKey = `${label}:${size}`;
  const cachedIcon = unreadIconCache.get(cacheKey);

  if (cachedIcon) {
    return cachedIcon;
  }

  const fontSize = label.length > 2 ? 58 : label.length > 1 ? 72 : 88;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 256 256">
      <rect width="256" height="256" rx="44" fill="#25D366"/>
      <text x="128" y="151" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="116" font-weight="800" fill="#06130D">Z</text>
      <circle cx="190" cy="66" r="52" fill="#E13D3D" stroke="#101817" stroke-width="10"/>
      <text x="190" y="${label.length > 2 ? 82 : 90}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="${fontSize}" font-weight="800" fill="#FFFFFF">${label}</text>
    </svg>`;

  const icon = nativeImage.createFromDataURL(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
  unreadIconCache.set(cacheKey, icon);
  return icon;
}

function getSettings(): AppSettings {
  return { ...defaultSettings, ...store.get('settings') };
}

function saveSettings(settings: Partial<AppSettings>): AppSettings {
  const next = { ...getSettings(), ...settings };
  store.set('settings', next);
  applySettings(next);
  mainWindow?.webContents.send('settings:changed', next);
  return next;
}

function applySettings(settings = getSettings()): void {
  mainWindow?.setAlwaysOnTop(settings.alwaysOnTop);
  app.setLoginItemSettings({
    openAtLogin: settings.startWithWindows,
    path: process.execPath
  });
  updateTrayMenu();
}

function configurePersistentSession(): void {
  const whatsappSession = session.fromPartition('persist:zapdesk-whatsapp');
  whatsappSession.setUserAgent(desktopChromeUserAgent);

  whatsappSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(['notifications', 'media', 'display-capture'].includes(permission));
  });

  whatsappSession.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders['DNT'] = '1';
    details.requestHeaders['User-Agent'] = desktopChromeUserAgent;
    callback({ requestHeaders: details.requestHeaders });
  });
}

function createWindow(): void {
  const settings = getSettings();

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 650,
    title: 'ZapDesk',
    icon: iconPath(),
    show: false,
    backgroundColor: settings.darkTheme ? '#101615' : '#f4f7f6',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webviewTag: true,
      backgroundThrottling: false,
      spellcheck: false
    }
  });

  // Remove o menu padrao do Electron no Windows: File, Edit, View, Window, Help.
  mainWindow.setMenu(null);

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('close', (event) => {
    if (!isQuitting && getSettings().minimizeToTray) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  applySettings(settings);
}

function createTray(): void {
  const image = nativeImage.createFromPath(iconPath());
  defaultTrayIcon = image.isEmpty() ? nativeImage.createEmpty() : image;
  tray = new Tray(defaultTrayIcon);
  tray.setToolTip('ZapDesk');
  tray.on('click', showWindow);
  updateTrayMenu();
}

function updateTrayMenu(): void {
  if (!tray) return;

  const settings = getSettings();
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Abrir/mostrar app', click: showWindow },
    { label: 'Ocultar app', click: () => mainWindow?.hide() },
    { type: 'separator' },
    { label: 'Recarregar WhatsApp', click: reloadWhatsApp },
    { label: 'Limpar cache/sessao', click: clearSession },
    {
      label: 'Sempre no topo',
      type: 'checkbox',
      checked: settings.alwaysOnTop,
      click: (item) => saveSettings({ alwaysOnTop: item.checked })
    },
    { type: 'separator' },
    { label: 'Sair', click: quitApp }
  ]);

  tray.setContextMenu(contextMenu);
}

function showWindow(): void {
  if (!mainWindow) createWindow();
  mainWindow?.show();
  mainWindow?.focus();
}

function toggleWindow(): void {
  if (!mainWindow) {
    createWindow();
    return;
  }

  if (mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    showWindow();
  }
}

function reloadWhatsApp(): void {
  mainWindow?.webContents.send('whatsapp:command', 'reload');
}

async function clearSession(): Promise<void> {
  const whatsappSession = session.fromPartition('persist:zapdesk-whatsapp');
  await whatsappSession.clearStorageData();
  await whatsappSession.clearCache();
  unreadCount = 0;
  lastNotifiedCount = 0;
  updateUnreadCount(0, 'ZapDesk');
  reloadWhatsApp();
}

function quitApp(): void {
  isQuitting = true;
  app.quit();
}

function registerShortcuts(): void {
  globalShortcut.register('CommandOrControl+Shift+W', toggleWindow);
  globalShortcut.register('CommandOrControl+R', reloadWhatsApp);
  globalShortcut.register('CommandOrControl+Shift+Q', quitApp);
}

function parseUnreadFromTitle(title: string): number {
  const match = title.match(/^\((\d+)\)/);
  return match ? Number(match[1]) : 0;
}

function updateUnreadCount(count: number, title = 'ZapDesk'): void {
  unreadCount = count;
  const cleanTitle = title.replace(/^\(\d+\)\s*/, '').trim() || 'WhatsApp';
  const appTitle = count > 0 ? `(${count}) ZapDesk - ${cleanTitle}` : `ZapDesk - ${cleanTitle}`;
  mainWindow?.setTitle(appTitle);
  tray?.setToolTip(count > 0 ? `ZapDesk - ${count} mensagens nao lidas` : 'ZapDesk');
  updateUnreadVisuals(count);

  // Windows aceita badge em alguns ambientes; quando nao aceita, o titulo ainda exibe o contador.
  app.setBadgeCount(count);
  mainWindow?.webContents.send('unread:changed', { unreadCount: count, title: appTitle } satisfies UnreadPayload);
}

function maybeNotify(count: number): void {
  if (count < lastNotifiedCount) {
    lastNotifiedCount = count;
  }

  if (!getSettings().notifications || count <= lastNotifiedCount || count <= 0) return;
  lastNotifiedCount = count;

  if (Notification.isSupported()) {
    new Notification({
      title: 'ZapDesk',
      body: count === 1 ? 'Voce tem uma nova mensagem no WhatsApp.' : `Voce tem ${count} mensagens nao lidas no WhatsApp.`,
      icon: iconPath(),
      silent: false
    }).show();
  }

  mainWindow?.flashFrame(true);
}

function updateUnreadVisuals(count: number): void {
  if (count > 0) {
    const unreadIcon = createUnreadIcon(count);
    tray?.setImage(unreadIcon);
    mainWindow?.setOverlayIcon(unreadIcon.resize({ width: 32, height: 32 }), `${count} mensagens nao lidas`);
    return;
  }

  if (defaultTrayIcon) {
    tray?.setImage(defaultTrayIcon);
  }

  mainWindow?.setOverlayIcon(null, '');
  mainWindow?.flashFrame(false);
}

function showEditingContextMenu(webContents: WebContents, params: ContextMenuParams): void {
  const template: MenuItemConstructorOptions[] = [];
  const hasSelection = params.selectionText.trim().length > 0;
  const isEditable = params.isEditable;

  if (isEditable) {
    template.push(
      { label: 'Desfazer', role: 'undo', enabled: params.editFlags.canUndo },
      { label: 'Refazer', role: 'redo', enabled: params.editFlags.canRedo },
      { type: 'separator' },
      { label: 'Recortar', role: 'cut', enabled: params.editFlags.canCut },
      { label: 'Copiar', role: 'copy', enabled: params.editFlags.canCopy || hasSelection },
      // Mantemos habilitado para permitir colar texto ou imagem no campo do WhatsApp.
      { label: 'Colar', role: 'paste', enabled: true },
      { type: 'separator' },
      { label: 'Selecionar tudo', role: 'selectAll', enabled: params.editFlags.canSelectAll }
    );
  } else {
    if (hasSelection) {
      template.push({ label: 'Copiar', role: 'copy', enabled: true });
    }

    if (params.hasImageContents) {
      if (template.length > 0) template.push({ type: 'separator' });
      template.push({
        label: 'Copiar imagem',
        click: () => webContents.copyImageAt(params.x, params.y)
      });
    }
  }

  if (params.linkURL && /^https?:\/\//i.test(params.linkURL)) {
    if (template.length > 0) template.push({ type: 'separator' });
    template.push({
      label: 'Abrir link no navegador',
      click: () => void shell.openExternal(params.linkURL)
    });
  }

  if (template.length === 0) return;

  Menu.buildFromTemplate(template).popup({
    window: mainWindow ?? undefined
  });
}

function setConnectionState(state: ConnectionState): void {
  if (state === lastConnectionState) return;
  lastConnectionState = state;
  mainWindow?.webContents.send('connection:changed', state);
}

function configureWebContentsSecurity(webContents: WebContents): void {
  webContents.on('context-menu', (_event, params) => {
    showEditingContextMenu(webContents, params);
  });

  webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedWhatsAppUrl(url)) {
      return { action: 'allow' };
    }

    void shell.openExternal(url);
    return { action: 'deny' };
  });

  webContents.on('will-navigate', (event, url) => {
    if (isAllowedWhatsAppUrl(url)) return;

    event.preventDefault();
    void shell.openExternal(url);
  });

  webContents.on('page-title-updated', (_event, title) => {
    const nextUnread = parseUnreadFromTitle(title);
    updateUnreadCount(nextUnread, title);
    maybeNotify(nextUnread);
    if (nextUnread === 0) {
      lastNotifiedCount = 0;
    }
  });

  webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame) return;

    if (validatedURL === whatsappUrl || validatedURL.includes('web.whatsapp.com')) {
      mainWindow?.webContents.send('load:failed', `${errorDescription} (${errorCode})`);
    }
  });
}

function setupIpc(): void {
  ipcMain.handle('settings:get', () => getSettings());
  ipcMain.handle('settings:update', (_event, settings: Partial<AppSettings>) => saveSettings(settings));
  ipcMain.handle('whatsapp:reload', () => reloadWhatsApp());
  ipcMain.handle('whatsapp:clear-session', () => clearSession());
  ipcMain.handle('window:toggle', () => toggleWindow());
  ipcMain.handle('app:quit', () => quitApp());
  ipcMain.handle('shell:open-external', (_event, url: string) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      return shell.openExternal(url);
    }
    return undefined;
  });

  app.on('web-contents-created', (_event, contents) => {
    configureWebContentsSecurity(contents);
    contents.on('did-navigate-in-page', (_navEvent, url) => {
      if (url.includes('web.whatsapp.com')) setConnectionState('online');
    });
  });
}

if (!singleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    showWindow();
  });

  app.whenReady().then(() => {
    app.setAppUserModelId('com.zapdesk.app');
    Menu.setApplicationMenu(null);
    configurePersistentSession();
    setupIpc();
    createWindow();
    createTray();
    registerShortcuts();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
      else showWindow();
    });
  });
}

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
