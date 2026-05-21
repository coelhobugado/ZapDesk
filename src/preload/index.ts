import { contextBridge, ipcRenderer } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AppSettings, AppUpdateStatus, ConnectionState, UnreadPayload, Account, Snippet, ScheduledMessage } from '../shared/settings.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function subscribe<T>(channel: string, callback: (payload: T) => void): () => void {
  const listener = (_event: Electron.IpcRendererEvent, payload: T) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('zapdesk', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (settings: Partial<AppSettings>) => ipcRenderer.invoke('settings:update', settings),
  reloadWhatsApp: () => ipcRenderer.invoke('whatsapp:reload'),
  markReloadHandled: () => ipcRenderer.invoke('whatsapp:reload-handled'),
  clearSession: () => ipcRenderer.invoke('whatsapp:clear-session'),
  getUpdateStatus: () => ipcRenderer.invoke('updates:get'),
  checkForUpdates: () => ipcRenderer.invoke('updates:check'),
  installUpdate: () => ipcRenderer.invoke('updates:install'),
  toggleWindow: () => ipcRenderer.invoke('window:toggle'),
  quitApp: () => ipcRenderer.invoke('app:quit'),
  openExternal: (url: string) => ipcRenderer.invoke('shell:open-external', url),
  onSettingsChanged: (callback: (settings: AppSettings) => void) => subscribe<AppSettings>('settings:changed', callback),
  onUpdateChanged: (callback: (status: AppUpdateStatus) => void) =>
    subscribe<AppUpdateStatus>('updates:changed', callback),
  onUnreadChanged: (callback: (payload: UnreadPayload) => void) => subscribe<UnreadPayload>('unread:changed', callback),
  onConnectionChanged: (callback: (state: ConnectionState) => void) =>
    subscribe<ConnectionState>('connection:changed', callback),
  onLoadFailed: (callback: (message: string) => void) => subscribe<string>('load:failed', callback),
  onLoadStarted: (callback: () => void) => subscribe<void>('load:started', callback),
  onLoadFinished: (callback: () => void) => subscribe<void>('load:finished', callback),
  onWhatsAppCommand: (callback: (command: 'reload') => void) => subscribe<'reload'>('whatsapp:command', callback),
  onWhatsAppReady: (callback: () => void) => subscribe<void>('whatsapp:ready-state', callback),

  getAccounts: () => ipcRenderer.invoke('accounts:get'),
  saveAccounts: (accounts: Account[]) => ipcRenderer.invoke('accounts:save', accounts),
  getActiveAccountId: () => ipcRenderer.invoke('accounts:getActiveId'),
  setActiveAccountId: (id: string) => ipcRenderer.invoke('accounts:setActiveId', id),
  onActiveAccountChanged: (callback: (id: string) => void) => subscribe<string>('accounts:activeChanged', callback),
  onAccountStatusChanged: (callback: (payload: { partition: string; status: 'ready' | 'qrcode' | 'loading' | 'offline' }) => void) =>
    subscribe<{ partition: string; status: 'ready' | 'qrcode' | 'loading' | 'offline' }>('accounts:status-changed', callback),

  getSnippets: () => ipcRenderer.invoke('snippets:get'),
  saveSnippets: (snippets: Snippet[]) => ipcRenderer.invoke('snippets:save', snippets),
  onSnippetsChanged: (callback: (snippets: Snippet[]) => void) => subscribe<Snippet[]>('snippets:changed', callback),

  getSchedules: () => ipcRenderer.invoke('schedules:get'),
  saveSchedules: (schedules: ScheduledMessage[]) => ipcRenderer.invoke('schedules:save', schedules),
  onSchedulesChanged: (callback: (schedules: ScheduledMessage[]) => void) => subscribe<ScheduledMessage[]>('schedules:changed', callback),
  onScheduleSendRequest: (callback: (message: ScheduledMessage) => void) => subscribe<ScheduledMessage>('schedules:send-request', callback)
});

contextBridge.exposeInMainWorld('whatsappPreloadPath', path.join(__dirname, 'whatsapp.cjs'));
