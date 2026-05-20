import type React from 'react';
import type { AppSettings, AppUpdateStatus, ConnectionState, UnreadPayload, Account, Snippet, ScheduledMessage } from '../shared/settings';

declare global {
  interface Window {
    whatsappPreloadPath: string;
    zapdesk: {
      getSettings: () => Promise<AppSettings>;
      updateSettings: (settings: Partial<AppSettings>) => Promise<AppSettings>;
      reloadWhatsApp: () => Promise<void>;
      markReloadHandled: () => Promise<void>;
      clearSession: () => Promise<void>;
      getUpdateStatus: () => Promise<AppUpdateStatus>;
      checkForUpdates: () => Promise<AppUpdateStatus>;
      installUpdate: () => Promise<void>;
      toggleWindow: () => Promise<void>;
      quitApp: () => Promise<void>;
      openExternal: (url: string) => Promise<void>;
      onSettingsChanged: (callback: (settings: AppSettings) => void) => () => void;
      onUpdateChanged: (callback: (status: AppUpdateStatus) => void) => () => void;
      onUnreadChanged: (callback: (payload: UnreadPayload) => void) => () => void;
      onConnectionChanged: (callback: (state: ConnectionState) => void) => () => void;
      onLoadFailed: (callback: (message: string) => void) => () => void;
      onLoadStarted: (callback: () => void) => () => void;
      onLoadFinished: (callback: () => void) => () => void;
      onWhatsAppCommand: (callback: (command: 'reload') => void) => () => void;
      onWhatsAppReady: (callback: () => void) => () => void;

      getAccounts: () => Promise<Account[]>;
      saveAccounts: (accounts: Account[]) => Promise<Account[]>;
      getActiveAccountId: () => Promise<string>;
      setActiveAccountId: (id: string) => Promise<string>;
      onActiveAccountChanged: (callback: (id: string) => void) => () => void;

      getSnippets: () => Promise<Snippet[]>;
      saveSnippets: (snippets: Snippet[]) => Promise<Snippet[]>;
      onSnippetsChanged: (callback: (snippets: Snippet[]) => void) => () => void;

      getSchedules: () => Promise<ScheduledMessage[]>;
      saveSchedules: (schedules: ScheduledMessage[]) => Promise<ScheduledMessage[]>;
      onSchedulesChanged: (callback: (schedules: ScheduledMessage[]) => void) => () => void;
      onScheduleSendRequest: (callback: (message: ScheduledMessage) => void) => () => void;
    };
  }

  namespace JSX {
    interface IntrinsicElements {
      webview: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string;
        partition?: string;
        preload?: string;
        webpreferences?: string;
        useragent?: string;
      };
    }
  }
}

export {};
