import {
  app,
  BrowserWindow,
  Menu,
  Tray,
  globalShortcut,
  ipcMain,
  dialog,
  shell,
  nativeImage,
  session,
  WebContents,
  webContents,
  type ContextMenuParams,
  type MenuItemConstructorOptions,
  type NativeImage,
  type Session
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
  type UnreadPayload,
  type Account,
  type Snippet,
  type ScheduledMessage
} from '../shared/settings.js';
import {
  isAllowedWhatsAppMainFrameUrl,
  normalizeExternalUrl,
  isSafeExternalUrl,
  whatsappHomeUrl,
  whatsappPartition
} from '../shared/allowedOrigins.js';
import { cleanWhatsAppTitle, parseUnreadFromTitle } from '../shared/unread.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);
const appUserModelId = 'com.zapdesk.app';
const { autoUpdater } = electronUpdater;
const debugLinks = process.env.ZAPDESK_DEBUG_LINKS === '1';
const configuredSessionPartitions = new Set<string>();
const telemetryPatterns = [
  '*://graph.facebook.com/*',
  '*://*.facebook.com/tr/*',
  '*://web.whatsapp.com/logging/*',
  '*://*.whatsapp.net/logging/*'
];

if (isDev) {
  const devProfile = process.env.ZAPDESK_DEV_PROFILE ?? 'default';
  app.setPath('userData', path.join(app.getPath('appData'), `zapdesk-dev-${devProfile}`));
}

if (process.platform === 'win32') {
  app.setAppUserModelId(appUserModelId);
}

app.commandLine.appendSwitch('high-dpi-support', '1');
app.commandLine.appendSwitch('enable-features', 'OverlayScrollbar');

if (isDev) {
  app.commandLine.appendSwitch('remote-debugging-port', '9222');
}

const singleInstanceLock = app.requestSingleInstanceLock();

type StoreSchema = {
  settings: AppSettings;
  accounts: Account[];
  activeAccountId: string;
  snippets: Snippet[];
  scheduledMessages: ScheduledMessage[];
};

const store = new Store<StoreSchema>({
  defaults: {
    settings: defaultSettings,
    accounts: [
      { id: 'default', name: 'Principal', partition: 'persist:zapdesk-whatsapp' }
    ],
    activeAccountId: 'default',
    snippets: [
      { id: '1', shortcut: '/oi', text: 'Ola! Como posso te ajudar hoje?' },
      { id: '2', shortcut: '/suporte', text: 'Um momento, por favor. Estou transferindo o seu atendimento para o nosso suporte tecnico.' }
    ],
    scheduledMessages: []
  }
});

const defaultAccount: Account = { id: 'default', name: 'Principal', partition: whatsappPartition };

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let unreadCount = 0;
let lastUnreadTitle = '';
let lastAlertedUnreadCount = 0;
let lastConnectionState: ConnectionState = 'unknown';
let defaultTrayIcon: NativeImage | null = null;
let updateStatus: AppUpdateStatus = {
  state: isDev ? 'disabled' : 'idle',
  currentVersion: app.getVersion(),
  message: isDev ? 'Atualizacoes automaticas ficam ativas apenas no app instalado.' : undefined
};
let checkingForUpdate = false;
let updateReadyToInstall = false;
const trayIconSize = process.platform === 'win32' ? 32 : 22;
let pendingReload = false;
const ignoredLoadErrorCodes = new Set([-3]);

function cleanBrowserUserAgent(userAgent: string): string {
  let cleaned = userAgent
    .replace(/zapdesk\/[^\s]+/gi, '')
    .replace(/electron\/[^\s]+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  if (!cleaned.includes('Chrome')) {
    cleaned += ' Chrome/120.0.0.0 Safari/537.36';
  }
  
  return cleaned;
}

function assetPath(...segments: string[]): string {
  if (isDev) {
    return path.join(app.getAppPath(), ...segments);
  }

  return path.join(process.resourcesPath, ...segments);
}

function whatsappWebviewPreloadPath(): string {
  return path.join(__dirname, '../preload/whatsapp.cjs');
}

function isBlankNavigationUrl(rawUrl: string): boolean {
  return rawUrl === '' || rawUrl === 'about:blank';
}

function debugLinkEvent(eventName: string, details: Record<string, unknown>): void {
  if (!debugLinks) return;
  console.info(`[zapdesk:links] ${eventName}`, details);
}

function isWhatsAppOwnedNavigationUrl(rawUrl: string): boolean {
  if (isAllowedWhatsAppMainFrameUrl(rawUrl)) return true;

  try {
    const url = new URL(rawUrl);
    if (url.protocol === 'blob:') {
      return url.origin === whatsappHomeUrl.slice(0, -1);
    }
  } catch {
    return false;
  }

  return false;
}

function isAllowedWhatsAppPermissionTarget(
  webContents: WebContents | null,
  requestingUrl?: string,
  isMainFrame = true
): boolean {
  if (!isMainFrame) return false;
  if (requestingUrl && isAllowedWhatsAppMainFrameUrl(requestingUrl)) return true;
  if (webContents && isAllowedWhatsAppMainFrameUrl(webContents.getURL())) return true;
  return false;
}

function iconPath(): string {
  return assetPath('assets', 'zapdesk.png');
}

function appIcon(size = 256): NativeImage {
  const image = nativeImage.createFromPath(iconPath());
  if (image.isEmpty()) return nativeImage.createEmpty();
  return image.resize({ width: size, height: size, quality: 'best' });
}

// Funções de badge manual removidas para melhorar performance. Utilizamos app.setBadgeCount nativo.


function getSettings(): AppSettings {
  return { ...defaultSettings, ...store.get('settings') };
}

function getAccounts(): Account[] {
  const accounts = store.get('accounts') ?? [];
  const hasDefault = accounts.some((account) => account.id === defaultAccount.id);
  return hasDefault ? accounts : [defaultAccount, ...accounts];
}

function getActiveAccount(): Account {
  const activeAccountId = store.get('activeAccountId') ?? defaultAccount.id;
  return getAccounts().find((account) => account.id === activeAccountId) ?? defaultAccount;
}

function isKnownAccountPartition(partition?: string): boolean {
  if (!partition) return false;
  return getAccounts().some((account) => account.partition === partition);
}

function saveSettings(settings: Partial<AppSettings>): AppSettings {
  const next = { ...getSettings(), ...settings };
  store.set('settings', next);
  applySettings(next);
  mainWindow?.webContents.send('settings:changed', next);

  if (settings.darkTheme !== undefined) {
    for (const wc of webContents.getAllWebContents()) {
      try {
        wc.send('theme:changed', settings.darkTheme);
      } catch (e) {
        // Ignora se o webContents estiver destruido
      }
    }
  }

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

function applySpellCheckerSettingsToSession(whatsappSession: Session, settings = getSettings()): void {
  whatsappSession.setSpellCheckerEnabled(settings.spellChecker);

  if (!settings.spellChecker) return;

  const preferredLanguages = ['pt-BR', 'en-US'].filter((language) =>
    whatsappSession.availableSpellCheckerLanguages.includes(language)
  );
  if (preferredLanguages.length > 0) {
    whatsappSession.setSpellCheckerLanguages(preferredLanguages);
  }
}

function configureWhatsAppSessionHandlers(whatsappSession: Session, partition: string): void {
  if (configuredSessionPartitions.has(partition)) return;
  configuredSessionPartitions.add(partition);

  whatsappSession.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
    const requestingUrl = details.requestingUrl ?? details.securityOrigin ?? requestingOrigin;
    if (!isAllowedWhatsAppPermissionTarget(webContents, requestingUrl, details.isMainFrame)) return false;
    if (permission === 'notifications') return getSettings().notifications;

    return false;
  });

  whatsappSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    if (!isAllowedWhatsAppPermissionTarget(webContents, details.requestingUrl, details.isMainFrame)) {
      callback(false);
      return;
    }

    if (permission === 'notifications') {
      callback(getSettings().notifications);
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

  whatsappSession.on('will-download', (_event, item, webContents) => {
    debugLinkEvent('will-download', {
      url: item.getURL(),
      filename: item.getFilename(),
      webContentsUrl: webContents.getURL()
    });
    item.setSaveDialogOptions({
      title: 'Salvar Arquivo',
      defaultPath: path.join(app.getPath('downloads'), item.getFilename())
    });

    item.on('updated', (_downloadEvent, state) => {
      debugLinkEvent('download-updated', {
        filename: item.getFilename(),
        state,
        receivedBytes: item.getReceivedBytes(),
        totalBytes: item.getTotalBytes()
      });
    });

    item.once('done', (_downloadEvent, state) => {
      debugLinkEvent('download-done', {
        filename: item.getFilename(),
        state,
        savePath: item.getSavePath()
      });
    });
  });

  whatsappSession.webRequest.onBeforeRequest({ urls: telemetryPatterns }, (_details, callback) => {
    callback({ cancel: true });
  });
}

function applySpellCheckerSettings(settings = getSettings()): void {
  for (const account of getAccounts()) {
    applySpellCheckerSettingsToSession(session.fromPartition(account.partition), settings);
  }
}

function configureWhatsAppSession(partition: string, cleanUserAgent: string): void {
  const whatsappSession = session.fromPartition(partition);
  applySpellCheckerSettingsToSession(whatsappSession);
  whatsappSession.setUserAgent(cleanUserAgent);
  configureWhatsAppSessionHandlers(whatsappSession, partition);
}

function applySettings(settings = getSettings()): void {
  mainWindow?.setAlwaysOnTop(settings.alwaysOnTop);
  applySpellCheckerSettings(settings);
  if (app.isPackaged) {
    app.setLoginItemSettings({
      openAtLogin: settings.startWithWindows,
      path: process.execPath
    });
  }
  updateTrayMenu();
}

function configurePersistentSession(): void {
  // Obter um User Agent padrão do Electron e limpar referências ao próprio app/Electron
  const cleanUserAgent = cleanBrowserUserAgent(session.defaultSession.getUserAgent());
  session.defaultSession.setUserAgent(cleanUserAgent);

  for (const account of getAccounts()) {
    configureWhatsAppSession(account.partition, cleanUserAgent);

    // Limpar cache de rede obsoleto no startup para manter a performance de carregamento.
    void session.fromPartition(account.partition).clearCache().catch((err) => {
      console.error(`Falha ao limpar cache do WhatsApp (${account.id}):`, err);
    });
  }

}

function createWindow(): void {
  const settings = getSettings();

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 600,
    minHeight: 650,
    title: 'ZapDesk',
    icon: iconPath(),
    show: false,
    backgroundColor: settings.darkTheme ? '#101615' : '#f4f7f6',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // The preload is emitted as ESM. Electron sandboxed preload expects a
      // CommonJS-compatible script, so keep the shell unsandboxed until the
      // preload is bundled separately.
      sandbox: false,
      webviewTag: true,
      spellcheck: false,
      backgroundThrottling: false
    }
  });

  // Remove o menu padrao do Electron no Windows: File, Edit, View, Window, Help.
  mainWindow.setMenu(null);

  mainWindow.once('ready-to-show', () => {
    mainWindow?.maximize();
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
  if (mainWindow?.isMinimized()) mainWindow.restore();
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

  const whatsappSession = session.fromPartition(getActiveAccount().partition);
  await whatsappSession.clearStorageData();
  await whatsappSession.clearCache();
  unreadCount = 0;
  lastAlertedUnreadCount = 0;
  updateUnreadCount(0);
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

function updateUnreadCount(count: number, title = 'WhatsApp'): void {
  const cleanTitle = cleanWhatsAppTitle(title);
  const appTitle = count > 0 ? `(${count}) ZapDesk - ${cleanTitle}` : `ZapDesk - ${cleanTitle}`;
  if (count === unreadCount && appTitle === lastUnreadTitle) return;

  unreadCount = count;
  lastUnreadTitle = appTitle;
  mainWindow?.setTitle(appTitle);
  tray?.setToolTip(count > 0 ? `ZapDesk - ${count} mensagens nao lidas` : 'ZapDesk');
  updateUnreadVisuals(count);

  // Windows aceita badge em alguns ambientes; quando nao aceita, o titulo ainda exibe o contador.
  app.setBadgeCount(count);
  mainWindow?.webContents.send('unread:changed', { unreadCount: count, title: appTitle } satisfies UnreadPayload);
}

function maybeAlertUnreadIncrease(count: number): void {
  if (count < lastAlertedUnreadCount) {
    lastAlertedUnreadCount = count;
  }

  if (count <= lastAlertedUnreadCount || count <= 0) return;
  lastAlertedUnreadCount = count;
  if (!getSettings().notifications) return;

  mainWindow?.flashFrame(true);
}

function updateUnreadVisuals(count: number): void {
  if (count <= 0) {
    mainWindow?.setOverlayIcon(null, '');
    mainWindow?.flashFrame(false);
  }
}

function openSafeExternalUrl(rawUrl: string): void {
  const normalizedUrl = normalizeExternalUrl(rawUrl);
  if (!normalizedUrl) {
    debugLinkEvent('blocked-unsafe-external-url', { rawUrl });
    return;
  }

  debugLinkEvent('open-external', { rawUrl, normalizedUrl });
  void shell.openExternal(normalizedUrl).catch((error) => {
    console.warn(`Nao foi possivel abrir URL externa: ${normalizedUrl}`, error);
  });
}

function closeAuxiliaryWindow(webContents: WebContents): void {
  const win = BrowserWindow.fromWebContents(webContents);
  if (win && win !== mainWindow) {
    win.close();
  }
}

function showEditingContextMenu(webContents: WebContents, params: ContextMenuParams): void {
  const template: MenuItemConstructorOptions[] = [];
  const hasSelection = params.selectionText.trim().length > 0;
  const isEditable = params.isEditable;
  const hasMisspelledWord = params.spellcheckEnabled && params.misspelledWord.trim().length > 0;

  if (hasMisspelledWord) {
    const suggestions = params.dictionarySuggestions.slice(0, 6);

    if (suggestions.length > 0) {
      template.push(
        ...suggestions.map((suggestion) => ({
          label: suggestion,
          click: () => {
            webContents.focus();
            webContents.replaceMisspelling(suggestion);
          }
        }))
      );
    } else {
      template.push({
        label: 'Sem sugestoes',
        enabled: false
      });
    }

    template.push(
      {
        label: `Adicionar "${params.misspelledWord}" ao dicionario`,
        click: () => {
          webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord);
        }
      },
      { type: 'separator' }
    );
  }

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

  if (params.linkURL && isSafeExternalUrl(params.linkURL)) {
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
  webContents.on('will-attach-webview', (event, webPreferences, params) => {
    debugLinkEvent('will-attach-webview', { src: params.src, preload: whatsappWebviewPreloadPath() });

    if (!isAllowedWhatsAppMainFrameUrl(params.src ?? '')) {
      event.preventDefault();
      return;
    }

    const requestedPartition = params.partition;
    params.partition = isKnownAccountPartition(requestedPartition) ? requestedPartition : whatsappPartition;
    params.allowpopups = 'true';
    (params as { useragent?: string }).useragent = cleanBrowserUserAgent(session.defaultSession.getUserAgent());
    webPreferences.preload = whatsappWebviewPreloadPath();
    webPreferences.contextIsolation = true;
    webPreferences.nodeIntegration = false;
    webPreferences.sandbox = true;
    webPreferences.spellcheck = getSettings().spellChecker;
    webPreferences.transparent = false;
    webPreferences.backgroundThrottling = false;
  });

  webContents.on('context-menu', (_event, params) => {
    showEditingContextMenu(webContents, params);
  });

  webContents.setWindowOpenHandler(({ url }) => {
    debugLinkEvent('window-open', { openerUrl: webContents.getURL(), url });

    if (isAllowedWhatsAppMainFrameUrl(url)) {
      return { action: 'allow' };
    }

    if (isBlankNavigationUrl(url) && isAllowedWhatsAppMainFrameUrl(webContents.getURL())) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          show: false,
          focusable: false,
          skipTaskbar: true,
          webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true
          }
        }
      };
    }

    openSafeExternalUrl(url);
    return { action: 'deny' };
  });

  webContents.on('did-create-window', (childWindow, details) => {
    debugLinkEvent('did-create-window', {
      openerUrl: webContents.getURL(),
      url: details.url,
      disposition: details.disposition
    });

    if (!isBlankNavigationUrl(details.url) || !isAllowedWhatsAppMainFrameUrl(webContents.getURL())) return;

    const timeout = setTimeout(() => {
      if (childWindow.isDestroyed()) return;

      const currentUrl = childWindow.webContents.getURL();
      if (isBlankNavigationUrl(currentUrl) || !isAllowedWhatsAppMainFrameUrl(currentUrl)) {
        childWindow.close();
      }
    }, 5000);

    childWindow.once('closed', () => clearTimeout(timeout));
  });

  webContents.on('will-navigate', (event, url) => {
    debugLinkEvent('will-navigate', { currentUrl: webContents.getURL(), url });

    if (isWhatsAppOwnedNavigationUrl(url)) return;

    event.preventDefault();
    openSafeExternalUrl(url);
    closeAuxiliaryWindow(webContents);
  });

  webContents.on('will-redirect', (event, url) => {
    debugLinkEvent('will-redirect', { currentUrl: webContents.getURL(), url });

    if (isWhatsAppOwnedNavigationUrl(url)) return;

    event.preventDefault();
    openSafeExternalUrl(url);
    closeAuxiliaryWindow(webContents);
  });

  webContents.on('page-title-updated', (_event, title) => {
    if (!isAllowedWhatsAppMainFrameUrl(webContents.getURL())) return;

    const nextUnread = parseUnreadFromTitle(title);
    updateUnreadCount(nextUnread, title);
    maybeAlertUnreadIncrease(nextUnread);
    if (nextUnread === 0) {
      lastAlertedUnreadCount = 0;
    }
  });

  webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    debugLinkEvent('did-fail-load', { errorCode, errorDescription, validatedURL, isMainFrame });

    if (!isMainFrame) return;
    if (ignoredLoadErrorCodes.has(errorCode)) return;

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
  ipcMain.handle('theme:get-current', () => getSettings().darkTheme);
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

  // Handlers para Multi-Contas
  ipcMain.handle('accounts:get', () => getAccounts());
  ipcMain.handle('accounts:save', (_event, accounts: Account[]) => {
    store.set('accounts', accounts);
    const cleanUserAgent = cleanBrowserUserAgent(session.defaultSession.getUserAgent());
    for (const account of accounts) {
      configureWhatsAppSession(account.partition, cleanUserAgent);
    }
    return accounts;
  });
  ipcMain.handle('accounts:getActiveId', () => store.get('activeAccountId') || 'default');
  ipcMain.handle('accounts:setActiveId', (_event, id: string) => {
    if (!getAccounts().some((account) => account.id === id)) {
      return store.get('activeAccountId') || 'default';
    }
    store.set('activeAccountId', id);
    mainWindow?.webContents.send('accounts:activeChanged', id);
    return id;
  });

  // Handlers para Respostas Rapidas (Snippets)
  ipcMain.handle('snippets:get', () => store.get('snippets') || []);
  ipcMain.handle('snippets:save', (_event, snippets: Snippet[]) => {
    store.set('snippets', snippets);
    mainWindow?.webContents.send('snippets:changed', snippets);
    return snippets;
  });

  // Handlers para Agendamento de Mensagens
  ipcMain.handle('schedules:get', () => store.get('scheduledMessages') || []);
  ipcMain.handle('schedules:save', (_event, schedules: ScheduledMessage[]) => {
    store.set('scheduledMessages', schedules);
    mainWindow?.webContents.send('schedules:changed', schedules);
    return schedules;
  });
  ipcMain.on('whatsapp:notification-clicked', (event) => {
    if (!isAllowedWhatsAppMainFrameUrl(event.sender.getURL())) return;

    showWindow();
    event.sender.focus();
  });
  ipcMain.on('whatsapp:ready', (event) => {
    if (!isAllowedWhatsAppMainFrameUrl(event.sender.getURL())) return;

    mainWindow?.webContents.send('whatsapp:ready-state', true);
  });
  ipcMain.on('whatsapp:status-changed', (event, status: string) => {
    if (!isAllowedWhatsAppMainFrameUrl(event.sender.getURL())) return;

    const accounts = getAccounts();
    const senderSession = event.sender.session;
    const matchedAccount = accounts.find((acc) => {
      try {
        return session.fromPartition(acc.partition) === senderSession;
      } catch {
        return false;
      }
    });

    if (matchedAccount) {
      mainWindow?.webContents.send('accounts:status-changed', {
        partition: matchedAccount.partition,
        status
      });
    }
  });
  ipcMain.on('shell:open-external-from-webview', (event, url: unknown) => {
    if (typeof url !== 'string') return;
    if (!isAllowedWhatsAppMainFrameUrl(event.sender.getURL())) return;

    openSafeExternalUrl(url);
  });

  app.on('web-contents-created', (_event, contents) => {
    configureWebContentsSecurity(contents);
    contents.on('did-navigate-in-page', (_navEvent, url) => {
      if (isAllowedWhatsAppMainFrameUrl(url)) setConnectionState('online');
    });
  });
}

function startScheduledMessageWorker(): void {
  // Executar a cada 10 segundos para verificar agendamentos pendentes
  setInterval(() => {
    const schedules = store.get('scheduledMessages') || [];
    const now = Date.now();
    const pending = schedules.filter(
      (s) => s.status === 'pending' && s.sendAt <= now
    );

    if (pending.length === 0) return;

    for (const msg of pending) {
      // Alterar status local para evitar envios duplos enquanto o renderer processa
      const updatedSchedules = (store.get('scheduledMessages') || []).map((s) => {
        if (s.id === msg.id) {
          return { ...s, status: 'sending' as const };
        }
        return s;
      });
      store.set('scheduledMessages', updatedSchedules);
      mainWindow?.webContents.send('schedules:changed', updatedSchedules);

      // Enviar comando para o renderer principal processar o envio
      mainWindow?.webContents.send('schedules:send-request', msg);
    }
  }, 10000);
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
    startScheduledMessageWorker();

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
