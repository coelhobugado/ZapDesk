import { contextBridge, ipcRenderer } from 'electron';
import type { AppSettings, AppUpdateStatus, ConnectionState, UnreadPayload } from '../shared/settings.js';

function subscribe<T>(channel: string, callback: (payload: T) => void): () => void {
  const listener = (_event: Electron.IpcRendererEvent, payload: T) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('zapdesk', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (settings: Partial<AppSettings>) => ipcRenderer.invoke('settings:update', settings),
  reloadWhatsApp: () => ipcRenderer.invoke('whatsapp:reload'),
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
  onWhatsAppCommand: (callback: (command: 'reload') => void) => subscribe<'reload'>('whatsapp:command', callback)
});
