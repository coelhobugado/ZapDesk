import { contextBridge, ipcRenderer, webFrame } from 'electron';

const OPEN_EXTERNAL_CHANNEL = 'shell:open-external-from-webview';
const NOTIFICATION_CLICK_CHANNEL = 'whatsapp:notification-clicked';
const NOTIFICATION_BRIDGE = '__zapdeskNotificationBridge';
const INSTALL_FLAG = '__zapdeskWhatsAppLinkBridgeInstalled';
const NOTIFICATION_PATCH_SCRIPT = `
(() => {
  const bridge = window.__zapdeskNotificationBridge;
  const installFlag = '__zapdeskNotificationPatchInstalled';
  if (!bridge || window[installFlag] || typeof Notification !== 'function') return;

  const NativeNotification = Notification;
  const define = (target, key, descriptor) => {
    try {
      Object.defineProperty(target, key, descriptor);
    } catch {
      // Some browser-provided Notification properties are not configurable.
    }
  };

  const WrappedNotification = function ZapDeskNotification(title, options) {
    const notification = new NativeNotification(title, options);
    notification.addEventListener('click', () => {
      try {
        bridge.focusApp();
      } catch {
        // Keep WhatsApp's own notification click handler running.
      }

      try {
        window.focus();
      } catch {
        // Ignore focus failures from the page context.
      }
    });
    return notification;
  };

  WrappedNotification.prototype = NativeNotification.prototype;
  Object.setPrototypeOf(WrappedNotification, NativeNotification);
  define(WrappedNotification, 'permission', { get: () => NativeNotification.permission });
  define(WrappedNotification, 'maxActions', { get: () => NativeNotification.maxActions });
  if (typeof NativeNotification.requestPermission === 'function') {
    define(WrappedNotification, 'requestPermission', {
      value: NativeNotification.requestPermission.bind(NativeNotification)
    });
  }

  window.Notification = WrappedNotification;
  define(window, installFlag, { value: true });
})();
`;

type NotificationBridge = {
  focusApp: () => void;
};

type BridgeGlobal = typeof globalThis & {
  [INSTALL_FLAG]?: boolean;
  [NOTIFICATION_BRIDGE]?: NotificationBridge;
};

function isWhatsAppClickToChatUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl, window.location.href);
    const host = url.hostname.toLowerCase();
    return host === 'wa.me' || host === 'api.whatsapp.com';
  } catch {
    return false;
  }
}

function handleClick(event: MouseEvent): void {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const anchor = target.closest('a[href]');
  if (!(anchor instanceof HTMLAnchorElement)) return;
  if (anchor.getAttribute('target') !== '_blank') return;
  if (isWhatsAppClickToChatUrl(anchor.href)) return;

  event.preventDefault();
  ipcRenderer.send(OPEN_EXTERNAL_CHANNEL, anchor.href);
}

function installNotificationBridge(): void {
  void webFrame.executeJavaScript(NOTIFICATION_PATCH_SCRIPT, true).catch(() => undefined);
}

const bridgeGlobal = globalThis as BridgeGlobal;
if (!bridgeGlobal[INSTALL_FLAG]) {
  bridgeGlobal[INSTALL_FLAG] = true;
  contextBridge.exposeInMainWorld(NOTIFICATION_BRIDGE, {
    focusApp: () => ipcRenderer.send(NOTIFICATION_CLICK_CHANNEL)
  } satisfies NotificationBridge);
  installNotificationBridge();
  document.addEventListener('click', handleClick, true);
}
