export type AppSettings = {
  startWithWindows: boolean;
  minimizeToTray: boolean;
  alwaysOnTop: boolean;
  notifications: boolean;
  darkTheme: boolean;
  autoUpdate: boolean;
  spellChecker: boolean;
};

export const defaultSettings: AppSettings = {
  startWithWindows: false,
  minimizeToTray: true,
  alwaysOnTop: false,
  notifications: true,
  darkTheme: true,
  autoUpdate: true,
  spellChecker: true
};

export type UnreadPayload = {
  unreadCount: number;
  title: string;
};

export type ConnectionState = 'online' | 'offline' | 'unknown';

export type UpdateState =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error'
  | 'disabled';

export type AppUpdateStatus = {
  state: UpdateState;
  currentVersion: string;
  availableVersion?: string;
  percent?: number;
  message?: string;
};

export type Account = {
  id: string;
  name: string;
  partition: string;
};

export type Snippet = {
  id: string;
  shortcut: string;
  text: string;
};

export type ScheduledMessage = {
  id: string;
  accountId: string;
  contactName: string;
  text: string;
  sendAt: number;
  status: 'pending' | 'sending' | 'sent' | 'failed';
  errorMessage?: string;
};
