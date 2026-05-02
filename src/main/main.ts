import {
  app,
  BrowserWindow,
  Menu,
  Notification,
  Tray,
  globalShortcut,
  ipcMain,
  dialog,
  shell,
  nativeImage,
  session,
  WebContents,
  type ContextMenuParams,
  type MenuItemConstructorOptions,
  type NativeImage
} from 'electron';
import electronUpdater, { type ProgressInfo, type UpdateInfo } from 'electron-updater';
import Store from 'electron-store';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  defaultSettings,
  type AppSettings,
  type AppUpdateStatus,
  type ConnectionState,
  type UnreadPayload
} from '../shared/settings.js';
import {
  isAllowedWhatsAppMainFrameUrl,
  isSafeExternalUrl,
  whatsappPartition
} from '../shared/allowedOrigins.js';
import { desktopChromeUserAgent } from '../shared/browserProfile.js';
import { cleanWhatsAppTitle, parseUnreadFromTitle } from '../shared/unread.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);
const appUserModelId = 'com.zapdesk.app';
const { autoUpdater } = electronUpdater;

if (process.platform === 'win32') {
  app.setAppUserModelId(appUserModelId);
}

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
let updateStatus: AppUpdateStatus = {
  state: isDev ? 'disabled' : 'idle',
  currentVersion: app.getVersion(),
  message: isDev ? 'Atualizacoes automaticas ficam ativas apenas no app instalado.' : undefined
};
let checkingForUpdate = false;
let updateReadyToInstall = false;
const unreadIconCache = new Map<string, NativeImage>();
const trayIconSize = process.platform === 'win32' ? 32 : 22;
let pendingReload = false;

function assetPath(...segments: string[]): string {
  if (isDev) {
    return path.join(app.getAppPath(), ...segments);
  }

  return path.join(process.resourcesPath, ...segments);
}

function iconPath(): string {
  return assetPath('assets', 'zapdesk.png');
}

function appIcon(size = 256): NativeImage {
  const image = nativeImage.createFromPath(iconPath());
  if (image.isEmpty()) return nativeImage.createEmpty();
  return image.resize({ width: size, height: size, quality: 'best' });
}

function setPixel(bitmap: Buffer, width: number, x: number, y: number, red: number, green: number, blue: number, alpha = 255): void {
  if (x < 0 || y < 0 || x >= width) return;

  const offset = (y * width + x) * 4;
  if (offset < 0 || offset + 3 >= bitmap.length) return;

  bitmap[offset] = blue;
  bitmap[offset + 1] = green;
  bitmap[offset + 2] = red;
  bitmap[offset + 3] = alpha;
}

function fillCircle(
  bitmap: Buffer,
  width: number,
  height: number,
  centerX: number,
  centerY: number,
  radius: number,
  color: [number, number, number, number]
): void {
  const radiusSquared = radius * radius;
  const startX = Math.max(0, Math.floor(centerX - radius));
  const endX = Math.min(width - 1, Math.ceil(centerX + radius));
  const startY = Math.max(0, Math.floor(centerY - radius));
  const endY = Math.min(height - 1, Math.ceil(centerY + radius));

  for (let y = startY; y <= endY; y += 1) {
    for (let x = startX; x <= endX; x += 1) {
      const dx = x - centerX;
      const dy = y - centerY;
      if (dx * dx + dy * dy <= radiusSquared) {
        setPixel(bitmap, width, x, y, color[0], color[1], color[2], color[3]);
      }
    }
  }
}

const digitMasks: Record<string, string[]> = {
  '0': ['111', '101', '101', '101', '111'],
  '1': ['010', '110', '010', '010', '111'],
  '2': ['111', '001', '111', '100', '111'],
  '3': ['111', '001', '111', '001', '111'],
  '4': ['101', '101', '111', '001', '001'],
  '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'],
  '7': ['111', '001', '001', '001', '001'],
  '8': ['111', '101', '111', '101', '111'],
  '9': ['111', '101', '111', '001', '111'],
  '+': ['000', '010', '111', '010', '000']
};

function drawBadgeText(bitmap: Buffer, width: number, text: string, centerX: number, centerY: number, scale: number): void {
  const glyphWidth = 3 * scale;
  const glyphHeight = 5 * scale;
  const spacing = Math.max(1, Math.floor(scale / 2));
  const totalWidth = text.length * glyphWidth + Math.max(0, text.length - 1) * spacing;
  const startX = Math.round(centerX - totalWidth / 2);
  const startY = Math.round(centerY - glyphHeight / 2);

  [...text].forEach((char, charIndex) => {
    const mask = digitMasks[char] ?? digitMasks['0'];
    const glyphX = startX + charIndex * (glyphWidth + spacing);

    mask.forEach((row, rowIndex) => {
      [...row].forEach((pixel, colIndex) => {
        if (pixel !== '1') return;

        const blockX = glyphX + colIndex * scale;
        const blockY = startY + rowIndex * scale;
        for (let y = 0; y < scale; y += 1) {
          for (let x = 0; x < scale; x += 1) {
            setPixel(bitmap, width, blockX + x, blockY + y, 255, 255, 255, 255);
          }
        }
      });
    });
  });
}

function createUnreadIcon(count: number, size = 32): NativeImage {
  const label = count > 99 ? '99+' : String(count);
  const cacheKey = `${label}:${size}`;
  const cachedIcon = unreadIconCache.get(cacheKey);

  if (cachedIcon) {
    return cachedIcon;
  }

  const base = appIcon(size);
  if (base.isEmpty()) return base;

  const bitmap = Buffer.from(base.toBitmap());
  const badgeRadius = Math.max(6, Math.round(size * 0.31));
  const badgeCenterX = size - badgeRadius;
  const badgeCenterY = badgeRadius;

  fillCircle(bitmap, size, size, badgeCenterX, badgeCenterY, badgeRadius + 2, [16, 24, 23, 255]);
  fillCircle(bitmap, size, size, badgeCenterX, badgeCenterY, badgeRadius, [225, 61, 61, 255]);
  drawBadgeText(bitmap, size, label, badgeCenterX, badgeCenterY, label.length > 2 ? 1 : Math.max(1, Math.round(size / 14)));

  const icon = nativeImage.createFromBitmap(bitmap, { width: size, height: size });
  unreadIconCache.set(cacheKey, icon);
  return icon;
}

function createOverlayIcon(count: number, size = 32): NativeImage {
  const label = count > 99 ? '99+' : String(count);
  const cacheKey = `overlay:${label}:${size}`;
  const cachedIcon = unreadIconCache.get(cacheKey);

  if (cachedIcon) {
    return cachedIcon;
  }

  const bitmap = Buffer.alloc(size * size * 4, 0);

  const badgeRadius = Math.max(8, Math.round(size * 0.45));
  const badgeCenterX = Math.round(size / 2);
  const badgeCenterY = Math.round(size / 2);

  fillCircle(bitmap, size, size, badgeCenterX, badgeCenterY, badgeRadius + 1, [16, 24, 23, 255]);
  fillCircle(bitmap, size, size, badgeCenterX, badgeCenterY, badgeRadius, [225, 61, 61, 255]);
  drawBadgeText(bitmap, size, label, badgeCenterX, badgeCenterY, label.length > 2 ? 1 : 2);

  const icon = nativeImage.createFromBitmap(bitmap, { width: size, height: size });
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

  if (settings.autoUpdate === true && !isDev) {
    void checkForUpdates();
  }

  if (settings.autoUpdate === false) {
    setUpdateStatus({
      state: 'disabled',
      message: 'Verificacao automatica desativada.'
    });
  }

  return next;
}

function applySettings(settings = getSettings()): void {
  mainWindow?.setAlwaysOnTop(settings.alwaysOnTop);
  if (app.isPackaged) {
    app.setLoginItemSettings({
      openAtLogin: settings.startWithWindows,
      path: process.execPath
    });
  }
  updateTrayMenu();
}

function configurePersistentSession(): void {
  const whatsappSession = session.fromPartition(whatsappPartition);
  whatsappSession.setUserAgent(desktopChromeUserAgent);

  whatsappSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const requestUrl = webContents.getURL();
    if (!isAllowedWhatsAppMainFrameUrl(requestUrl)) {
      callback(false);
      return;
    }

    if (permission === 'notifications') {
      callback(true);
      return;
    }

    if (permission === 'media' || permission === 'display-capture') {
      if (!mainWindow) {
        callback(false);
        return;
      }

      void dialog
        .showMessageBox(mainWindow, {
          type: 'question',
          buttons: ['Permitir', 'Bloquear'],
          defaultId: 1,
          cancelId: 1,
          title: 'Permissao do WhatsApp Web',
          message:
            permission === 'media'
              ? 'Permitir que o WhatsApp Web use camera ou microfone?'
              : 'Permitir que o WhatsApp Web capture sua tela?',
          detail: 'A permissao sera concedida apenas para web.whatsapp.com nesta solicitacao.'
        })
        .then((result) => callback(result.response === 0))
        .catch(() => callback(false));
      return;
    }

    callback(false);
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
      sandbox: true,
      webviewTag: true,
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
      updateUnreadVisuals(unreadCount);
    }
  });

  mainWindow.on('hide', () => updateUnreadVisuals(unreadCount));
  mainWindow.on('minimize', () => updateUnreadVisuals(unreadCount));
  mainWindow.on('restore', () => updateUnreadVisuals(unreadCount));
  mainWindow.on('show', () => updateUnreadVisuals(unreadCount));

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
  const image = appIcon(trayIconSize);
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
    { label: 'Verificar atualizacoes', click: () => void checkForUpdates() },
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
  pendingReload = true;
  mainWindow?.webContents.send('whatsapp:command', 'reload');
}

async function clearSession(): Promise<void> {
  if (mainWindow) {
    const result = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      buttons: ['Limpar cache e sessao', 'Cancelar'],
      defaultId: 1,
      cancelId: 1,
      title: 'Limpar cache e sessao',
      message: 'Isso remove a sessao local do WhatsApp Web neste computador.',
      detail: 'Na proxima abertura, talvez seja necessario escanear o QR Code novamente.'
    });

    if (result.response !== 0) return;
  }

  const whatsappSession = session.fromPartition(whatsappPartition);
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

function setUpdateStatus(status: Partial<AppUpdateStatus>): AppUpdateStatus {
  const state = status.state ?? updateStatus.state;
  updateStatus = {
    state,
    currentVersion: app.getVersion(),
    ...(status.availableVersion ? { availableVersion: status.availableVersion } : {}),
    ...(typeof status.percent === 'number' ? { percent: status.percent } : {}),
    ...(status.message ? { message: status.message } : {})
  };
  mainWindow?.webContents.send('updates:changed', updateStatus);
  return updateStatus;
}

function readableUpdateError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Nao foi possivel verificar atualizacoes.';
}

async function promptInstallUpdate(version?: string): Promise<void> {
  if (!mainWindow) return;

  const result = await dialog.showMessageBox(mainWindow, {
    type: 'info',
    buttons: ['Reiniciar e instalar', 'Depois'],
    defaultId: 0,
    cancelId: 1,
    title: 'Atualizacao pronta',
    message: version ? `ZapDesk ${version} foi baixado.` : 'Uma atualizacao do ZapDesk foi baixada.',
    detail: 'O aplicativo precisa reiniciar para concluir a instalacao.'
  });

  if (result.response === 0) {
    installDownloadedUpdate();
  }
}

function installDownloadedUpdate(): void {
  if (!updateReadyToInstall) return;

  isQuitting = true;
  autoUpdater.quitAndInstall(false, true);
}

async function checkForUpdates(): Promise<AppUpdateStatus> {
  if (isDev) {
    return setUpdateStatus({
      state: 'disabled',
      message: 'Atualizacoes automaticas ficam ativas apenas no app instalado.'
    });
  }

  if (checkingForUpdate) {
    return updateStatus;
  }

  if (updateReadyToInstall) {
    return updateStatus;
  }

  checkingForUpdate = true;
  setUpdateStatus({
    state: 'checking',
    percent: undefined,
    message: 'Verificando atualizacoes...'
  });

  try {
    await autoUpdater.checkForUpdates();
    return updateStatus;
  } catch (error) {
    checkingForUpdate = false;
    return setUpdateStatus({
      state: 'error',
      message: readableUpdateError(error)
    });
  }
}

function configureAutoUpdater(): void {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowPrerelease = false;

  autoUpdater.on('checking-for-update', () => {
    setUpdateStatus({
      state: 'checking',
      percent: undefined,
      message: 'Verificando atualizacoes...'
    });
  });

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    setUpdateStatus({
      state: 'available',
      availableVersion: info.version,
      percent: undefined,
      message: `Atualizacao ${info.version} encontrada. Baixando...`
    });
  });

  autoUpdater.on('update-not-available', (info: UpdateInfo) => {
    checkingForUpdate = false;
    setUpdateStatus({
      state: 'not-available',
      availableVersion: info.version,
      percent: undefined,
      message: 'Voce ja esta usando a versao mais recente.'
    });
  });

  autoUpdater.on('download-progress', (progress: ProgressInfo) => {
    setUpdateStatus({
      state: 'downloading',
      percent: Math.round(progress.percent),
      message: `Baixando atualizacao... ${Math.round(progress.percent)}%`
    });
  });

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    checkingForUpdate = false;
    updateReadyToInstall = true;
    setUpdateStatus({
      state: 'downloaded',
      availableVersion: info.version,
      percent: 100,
      message: 'Atualizacao baixada. Reinicie para instalar.'
    });
    void promptInstallUpdate(info.version);
  });

  autoUpdater.on('error', (error: Error) => {
    checkingForUpdate = false;
    setUpdateStatus({
      state: 'error',
      message: readableUpdateError(error)
    });
  });
}

function registerShortcuts(): void {
  const shortcuts: Array<[string, () => void]> = [
    ['CommandOrControl+Shift+W', toggleWindow],
    ['CommandOrControl+R', reloadWhatsApp],
    ['CommandOrControl+Shift+Q', quitApp]
  ];

  for (const [accelerator, handler] of shortcuts) {
    if (!globalShortcut.register(accelerator, handler)) {
      console.warn(`Nao foi possivel registrar o atalho global: ${accelerator}`);
    }
  }
}

function updateUnreadCount(count: number, title = 'ZapDesk'): void {
  unreadCount = count;
  const cleanTitle = cleanWhatsAppTitle(title);
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
    const notification = new Notification({
      title: 'ZapDesk',
      body: count === 1 ? 'Voce tem uma nova mensagem no WhatsApp.' : `Voce tem ${count} mensagens nao lidas no WhatsApp.`,
      icon: iconPath(),
      silent: false
    });
    notification.on('click', showWindow);
    notification.show();
  }

  mainWindow?.flashFrame(true);
}

function updateUnreadVisuals(count: number): void {
  if (count > 0) {
    const unreadIcon = createUnreadIcon(count, trayIconSize);
    const overlayIcon = createOverlayIcon(count, 32);
    tray?.setImage(unreadIcon);
    mainWindow?.setOverlayIcon(overlayIcon, `${count} mensagens nao lidas`);
    mainWindow?.flashFrame(true);
    return;
  }

  if (defaultTrayIcon) {
    tray?.setImage(defaultTrayIcon);
  }

  mainWindow?.setOverlayIcon(null, '');
  mainWindow?.flashFrame(false);
}

function openSafeExternalUrl(rawUrl: string): void {
  if (!isSafeExternalUrl(rawUrl)) return;
  void shell.openExternal(rawUrl);
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
      click: () => openSafeExternalUrl(params.linkURL)
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
    if (isAllowedWhatsAppMainFrameUrl(url)) {
      return { action: 'allow' };
    }

    openSafeExternalUrl(url);
    return { action: 'deny' };
  });

  webContents.on('will-navigate', (event, url) => {
    if (isAllowedWhatsAppMainFrameUrl(url)) return;

    event.preventDefault();
    openSafeExternalUrl(url);

    const win = BrowserWindow.fromWebContents(webContents);
    if (win && win !== mainWindow) {
      win.close();
    }
  });

  webContents.on('page-title-updated', (_event, title) => {
    if (!isAllowedWhatsAppMainFrameUrl(webContents.getURL())) return;

    const nextUnread = parseUnreadFromTitle(title);
    updateUnreadCount(nextUnread, title);
    maybeNotify(nextUnread);
    if (nextUnread === 0) {
      lastNotifiedCount = 0;
    }
  });

  webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame) return;

    if (isAllowedWhatsAppMainFrameUrl(validatedURL)) {
      mainWindow?.webContents.send('load:failed', `${errorDescription} (${errorCode})`);
    }
  });

  webContents.on('did-start-loading', () => {
    if (webContents === mainWindow?.webContents) return;
    mainWindow?.webContents.send('load:started');
  });

  webContents.on('did-finish-load', () => {
    if (webContents === mainWindow?.webContents) return;
    if (!isAllowedWhatsAppMainFrameUrl(webContents.getURL())) return;

    mainWindow?.webContents.send('load:finished');
    setConnectionState('online');

    if (pendingReload) {
      pendingReload = false;
      webContents.reloadIgnoringCache();
    }
  });
}

function setupIpc(): void {
  ipcMain.handle('settings:get', () => getSettings());
  ipcMain.handle('settings:update', (_event, settings: Partial<AppSettings>) => saveSettings(settings));
  ipcMain.handle('updates:get', () => updateStatus);
  ipcMain.handle('updates:check', () => checkForUpdates());
  ipcMain.handle('updates:install', () => installDownloadedUpdate());
  ipcMain.handle('whatsapp:reload', () => reloadWhatsApp());
  ipcMain.handle('whatsapp:reload-handled', () => {
    pendingReload = false;
  });
  ipcMain.handle('whatsapp:clear-session', () => clearSession());
  ipcMain.handle('window:toggle', () => toggleWindow());
  ipcMain.handle('app:quit', () => quitApp());
  ipcMain.handle('shell:open-external', (_event, url: string) => {
    openSafeExternalUrl(url);
    return undefined;
  });

  app.on('web-contents-created', (_event, contents) => {
    configureWebContentsSecurity(contents);
    contents.on('did-navigate-in-page', (_navEvent, url) => {
      if (isAllowedWhatsAppMainFrameUrl(url)) setConnectionState('online');
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
    app.setAppUserModelId(appUserModelId);
    Menu.setApplicationMenu(null);
    configurePersistentSession();
    configureAutoUpdater();
    setupIpc();
    createWindow();
    createTray();
    registerShortcuts();

    if (getSettings().autoUpdate) {
      setTimeout(() => {
        void checkForUpdates();
      }, 8000);
    }

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
