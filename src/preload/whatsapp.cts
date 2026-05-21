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
  
  if (!window.__zapdeskActiveNotifications) {
    window.__zapdeskActiveNotifications = new Set();
  }
  const activeNotifications = window.__zapdeskActiveNotifications;

  const define = (target, key, descriptor) => {
    try {
      Object.defineProperty(target, key, descriptor);
    } catch {
      // Propriedades do navegador nao configuraveis
    }
  };

  const WrappedNotification = function ZapDeskNotification(title, options) {
    const notification = new NativeNotification(title, options);
    
    activeNotifications.add(notification);

    // Armazenar ouvintes registrados pelo WhatsApp Web
    const clickListeners = new Set();
    let customOnclick = null;

    // Timeout de seguranca para liberar a referencia apos 5 minutos
    const gcTimeout = setTimeout(() => {
      activeNotifications.delete(notification);
    }, 300000);

    const cleanup = () => {
      clearTimeout(gcTimeout);
      activeNotifications.delete(notification);
    };

    notification.addEventListener('click', (event) => {
      // 1. Focar a janela principal do Electron
      try {
        bridge.focusApp();
      } catch (e) {}

      try {
        window.focus();
      } catch (e) {}

      cleanup();

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

    notification.addEventListener('close', () => {
      cleanup();
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

const SNIPPETS_AUTOCOMPLETE_SCRIPT = `
(() => {
  const bridge = window.__zapdeskNotificationBridge;
  const installFlag = '__zapdeskSnippetsAutocompleteInstalled';
  if (!bridge || window[installFlag]) return;

  let activeIndex = 0;
  let filteredSnippets = [];
  let popupElement = null;
  let currentTargetInput = null;

  const createPopup = () => {
    if (popupElement) return;
    popupElement = document.createElement('div');
    popupElement.id = 'zapdesk-snippets-popup';
    popupElement.style.position = 'fixed';
    popupElement.style.bottom = '80px';
    popupElement.style.left = '320px';
    popupElement.style.zIndex = '99999';
    popupElement.style.background = '#182220';
    popupElement.style.border = '1px solid rgba(226, 241, 237, 0.1)';
    popupElement.style.borderRadius = '12px';
    popupElement.style.boxShadow = '0 8px 24px rgba(0,0,0,0.5)';
    popupElement.style.padding = '8px';
    popupElement.style.minWidth = '280px';
    popupElement.style.maxWidth = '400px';
    popupElement.style.maxHeight = '240px';
    popupElement.style.overflowY = 'auto';
    popupElement.style.display = 'none';
    document.body.appendChild(popupElement);
  };

  const renderSnippets = () => {
    if (!popupElement) return;
    if (filteredSnippets.length === 0) {
      popupElement.style.display = 'none';
      return;
    }

    popupElement.innerHTML = '';
    filteredSnippets.forEach((snippet, index) => {
      const item = document.createElement('div');
      item.className = 'zapdesk-snippet-item' + (index === activeIndex ? ' active' : '');
      item.style.padding = '8px 12px';
      item.style.borderRadius = '6px';
      item.style.cursor = 'pointer';
      item.style.display = 'flex';
      item.style.flexDirection = 'column';
      item.style.gap = '2px';
      item.style.marginBottom = '2px';
      item.style.transition = 'background-color 0.15s ease';

      if (index === activeIndex) {
        item.style.background = '#0df07e';
        item.style.color = '#0c1110';
      } else {
        item.style.background = 'transparent';
        item.style.color = '#e2f1ed';
      }

      const header = document.createElement('div');
      header.style.display = 'flex';
      header.style.justifyContent = 'space-between';
      header.style.alignItems = 'center';
      header.style.fontWeight = 'bold';
      header.style.fontSize = '12px';

      const shortcut = document.createElement('span');
      shortcut.textContent = '/' + snippet.shortcut;
      
      const badge = document.createElement('span');
      badge.textContent = 'Enter';
      badge.style.fontSize = '9px';
      badge.style.opacity = '0.7';
      badge.style.padding = '1px 4px';
      badge.style.background = index === activeIndex ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.08)';
      badge.style.borderRadius = '3px';

      header.appendChild(shortcut);
      if (index === activeIndex) header.appendChild(badge);

      const body = document.createElement('div');
      body.style.fontSize = '12px';
      body.style.opacity = '0.85';
      body.style.whiteSpace = 'nowrap';
      body.style.overflow = 'hidden';
      body.style.textOverflow = 'ellipsis';
      body.textContent = snippet.text;

      item.appendChild(header);
      item.appendChild(body);

      item.addEventListener('click', () => {
        insertSnippet(snippet);
      });

      popupElement.appendChild(item);
    });

    popupElement.style.display = 'block';
  };

  const insertSnippet = (snippet) => {
    if (!currentTargetInput) return;
    
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    
    const range = selection.getRangeAt(0);
    const node = range.startContainer;
    
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent;
      const caretPos = range.startOffset;
      const textBeforeCaret = text.substring(0, caretPos);
      const lastSlashIdx = textBeforeCaret.lastIndexOf('/');
      
      if (lastSlashIdx !== -1) {
        const textAfterCaret = text.substring(caretPos);
        const prefix = textBeforeCaret.substring(0, lastSlashIdx);
        
        node.textContent = prefix + snippet.text + textAfterCaret;
        
        const newRange = document.createRange();
        newRange.setStart(node, prefix.length + snippet.text.length);
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);
      }
    } else {
      node.textContent = snippet.text;
    }

    const inputEvent = new Event('input', { bubbles: true, cancelable: true });
    currentTargetInput.dispatchEvent(inputEvent);

    hidePopup();
  };

  const hidePopup = () => {
    if (popupElement) {
      popupElement.style.display = 'none';
    }
    filteredSnippets = [];
    activeIndex = 0;
  };

  const handleKeyDown = async (e) => {
    if (popupElement && popupElement.style.display === 'block') {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeIndex = (activeIndex + 1) % filteredSnippets.length;
        renderSnippets();
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIndex = (activeIndex - 1 + filteredSnippets.length) % filteredSnippets.length;
        renderSnippets();
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredSnippets[activeIndex]) {
          insertSnippet(filteredSnippets[activeIndex]);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        hidePopup();
        return;
      }
    }
  };

  const handleInput = async (e) => {
    const input = e.target;
    if (!input || input.getAttribute('contenteditable') !== 'true') return;

    currentTargetInput = input;
    
    const selection = window.getSelection();
    if (!selection.rangeCount) return hidePopup();
    
    const range = selection.getRangeAt(0);
    const node = range.startContainer;
    
    if (node.nodeType !== Node.TEXT_NODE) return hidePopup();
    
    const caretPos = range.startOffset;
    const textBeforeCaret = node.textContent.substring(0, caretPos);
    const lastSlashIdx = textBeforeCaret.lastIndexOf('/');
    
    if (lastSlashIdx === -1) return hidePopup();
    
    if (lastSlashIdx > 0 && textBeforeCaret[lastSlashIdx - 1] !== ' ' && textBeforeCaret[lastSlashIdx - 1] !== '\n') {
      return hidePopup();
    }

    const query = textBeforeCaret.substring(lastSlashIdx + 1).toLowerCase();
    
    try {
      const allSnippets = await bridge.getSnippets();
      if (!allSnippets || allSnippets.length === 0) return hidePopup();

      filteredSnippets = allSnippets.filter(s => 
        s.shortcut.toLowerCase().startsWith(query) || 
        s.text.toLowerCase().includes(query)
      );

      createPopup();
      activeIndex = 0;
      renderSnippets();
    } catch (err) {
      console.error('Erro ao buscar snippets:', err);
    }
  };

  document.addEventListener('keydown', handleKeyDown, true);
  document.addEventListener('input', handleInput, true);

  document.addEventListener('click', (e) => {
    if (popupElement && !popupElement.contains(e.target) && currentTargetInput !== e.target) {
      hidePopup();
    }
  });

  window[installFlag] = true;
})();
`;

type NotificationBridge = {
  focusApp: () => void;
  getSnippets: () => Promise<any[]>;
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

function installSnippetsAutocomplete(): void {
  void webFrame.executeJavaScript(SNIPPETS_AUTOCOMPLETE_SCRIPT, true).catch(() => undefined);
}

function watchWhatsAppStatus(): void {
  let lastStatus: 'ready' | 'qrcode' | 'loading' | 'offline' | null = null;

  const getStatus = (): 'ready' | 'qrcode' | 'loading' | 'offline' => {
    if (!navigator.onLine) return 'offline';

    const qrcode = document.querySelector('[data-testid="qrcode"]') || document.querySelector('canvas');
    if (qrcode && !document.querySelector('[data-testid="chat-list"]') && !document.querySelector('#side')) {
      return 'qrcode';
    }

    const readyElement =
      document.querySelector('[data-testid="chat-list"]') ||
      document.querySelector('[aria-label="Chat list"]') ||
      document.querySelector('[aria-label="Lista de conversas"]') ||
      document.querySelector('#side') ||
      document.querySelector('#pane-side') ||
      document.querySelector('[data-icon="chat"]') ||
      document.querySelector('[data-testid="qrcode"]') ||
      document.querySelector('[data-testid="intro-title"]') ||
      document.querySelector('.two');

    if (document.querySelector('#app') && readyElement) {
      return 'ready';
    }

    return 'loading';
  };

  const checkAndSend = () => {
    const currentStatus = getStatus();
    if (currentStatus !== lastStatus) {
      lastStatus = currentStatus;
      ipcRenderer.send('whatsapp:status-changed', currentStatus);
    }
  };

  checkAndSend();

  const observer = new MutationObserver(() => {
    checkAndSend();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  window.addEventListener('online', checkAndSend);
  window.addEventListener('offline', checkAndSend);
}

function applyTheme(isDark: boolean): void {
  const apply = () => {
    const el = document.body || document.documentElement;
    if (el) {
      if (isDark) {
        el.classList.add('theme-dark');
        el.classList.remove('theme-light');
      } else {
        el.classList.add('theme-light');
        el.classList.remove('theme-dark');
      }
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply);
  } else {
    apply();
  }
}

const bridgeGlobal = globalThis as BridgeGlobal;
if (!bridgeGlobal[INSTALL_FLAG]) {
  bridgeGlobal[INSTALL_FLAG] = true;
  contextBridge.exposeInMainWorld(NOTIFICATION_BRIDGE, {
    focusApp: () => ipcRenderer.send(NOTIFICATION_CLICK_CHANNEL),
    getSnippets: () => ipcRenderer.invoke('snippets:get')
  } satisfies NotificationBridge);
  installNotificationBridge();
  installSnippetsAutocomplete();
  document.addEventListener('click', handleClick, true);

  // Escuta alteracao de tema do Main Process
  ipcRenderer.on('theme:changed', (_event, isDark: boolean) => {
    applyTheme(isDark);
  });

  // Busca o tema atual na inicializacao
  ipcRenderer.invoke('theme:get-current')
    .then((isDark: boolean) => {
      applyTheme(isDark);
    })
    .catch(() => undefined);

  // Iniciar a observação do estado de carregamento do WhatsApp
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', watchWhatsAppStatus);
  } else {
    watchWhatsAppStatus();
  }
}
