export type AppSettings = {
  startWithWindows: boolean;
  minimizeToTray: boolean;
  alwaysOnTop: boolean;
  notifications: boolean;
  darkTheme: boolean;
};

export const defaultSettings: AppSettings = {
  startWithWindows: false,
  minimizeToTray: true,
  alwaysOnTop: false,
  notifications: true,
  darkTheme: true
};

export type UnreadPayload = {
  unreadCount: number;
  title: string;
};

export type ConnectionState = 'online' | 'offline' | 'unknown';
