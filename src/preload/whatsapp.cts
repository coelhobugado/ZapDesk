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
      // Propriedades do navegador nao configuraveis
    }
  };

  const WrappedNotification = function ZapDeskNotification(title, options) {
    const notification = new NativeNotification(title, options);

    // Armazenar ouvintes registrados pelo WhatsApp Web
    const clickListeners = new Set();
    let customOnclick = null;

    notification.addEventListener('click', (event) => {
      // 1. Focar a janela principal do Electron
      try {
        bridge.focusApp();
      } catch (e) {}

      try {
        window.focus();
      } catch (e) {}

      // 2. Postergar a execucao dos handlers de clique do WhatsApp Web
      // para aguardar o foco completo da janela e da WebView.
      setTimeout(() => {
        if (customOnclick) {
          try {
            customOnclick.call(notification, event);
          } catch (err) {
            console.error('Erro no onclick da notificacao:', err);
          }
        }
        for (const listener of clickListeners) {
          try {
            if (typeof listener === 'function') {
              listener.call(notification, event);
            } else if (listener && typeof listener.handleEvent === 'function') {
              listener.handleEvent(event);
            }
          } catch (err) {
            console.error('Erro no click listener da notificacao:', err);
          }
        }
      }, 250);
    });

    // Interceptar a atribuicao direta da propriedade 'onclick'
    Object.defineProperty(notification, 'onclick', {
      get() {
        return customOnclick;
      },
      set(val) {
        customOnclick = val;
      },
      configurable: true,
      enumerable: true
    });

    // Interceptar o metodo addEventListener para capturar escutas de 'click'
    const originalAddEventListener = notification.addEventListener;
    notification.addEventListener = function(type, listener, options) {
      if (type === 'click') {
        clickListeners.add(listener);
      } else {
        originalAddEventListener.call(notification, type, listener, options);
      }
    };

    // Interceptar o metodo removeEventListener
    const originalRemoveEventListener = notification.removeEventListener;
    notification.removeEventListener = function(type, listener, options) {
      if (type === 'click') {
        clickListeners.delete(listener);
      } else {
        originalRemoveEventListener.call(notification, type, listener, options);
      }
    };

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

function watchWhatsAppReady(): void {
  const checkReady = () => {
    const readyElement =
      document.querySelector('[data-testid="chat-list"]') ||
      document.querySelector('[aria-label="Chat list"]') ||
      document.querySelector('[aria-label="Lista de conversas"]') ||
      document.querySelector('canvas') ||
      document.querySelector('#side') ||
      document.querySelector('#pane-side') ||
      document.querySelector('[data-icon="chat"]') ||
      document.querySelector('[data-testid="qrcode"]') ||
      document.querySelector('[data-testid="intro-title"]') ||
      document.querySelector('.two');

    if (document.querySelector('#app') && readyElement) {
      ipcRenderer.send('whatsapp:ready');
      return true;
    }
    return false;
  };

  if (checkReady()) return;

  const observer = new MutationObserver((_mutations, obs) => {
    if (checkReady()) {
      obs.disconnect();
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
}

const bridgeGlobal = globalThis as BridgeGlobal;
if (!bridgeGlobal[INSTALL_FLAG]) {
  bridgeGlobal[INSTALL_FLAG] = true;
  contextBridge.exposeInMainWorld(NOTIFICATION_BRIDGE, {
    focusApp: () => ipcRenderer.send(NOTIFICATION_CLICK_CHANNEL)
  } satisfies NotificationBridge);
  installNotificationBridge();
  document.addEventListener('click', handleClick, true);

  // Iniciar a observação do estado de carregamento do WhatsApp
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', watchWhatsAppReady);
  } else {
    watchWhatsAppReady();
  }
}
