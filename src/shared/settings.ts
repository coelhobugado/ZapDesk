export type AppSettings = {
  startWithWindows: boolean;
  minimizeToTray: boolean;
  alwaysOnTop: boolean;
  notifications: boolean;
  darkTheme: boolean;
  autoUpdate: boolean;
};

export const defaultSettings: AppSettings = {
  startWithWindows: false,
  minimizeToTray: true,
  alwaysOnTop: false,
  notifications: true,
  darkTheme: true,
  autoUpdate: true
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
