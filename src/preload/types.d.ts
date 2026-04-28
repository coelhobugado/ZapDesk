import type React from 'react';
import type { AppSettings, AppUpdateStatus, ConnectionState, UnreadPayload } from '../shared/settings';

declare global {
  interface Window {
    zapdesk: {
      getSettings: () => Promise<AppSettings>;
      updateSettings: (settings: Partial<AppSettings>) => Promise<AppSettings>;
      reloadWhatsApp: () => Promise<void>;
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
    };
  }

  namespace JSX {
    interface IntrinsicElements {
      webview: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string;
        partition?: string;
        webpreferences?: string;
        allowpopups?: boolean;
        useragent?: string;
      };
    }
  }
}

export {};
