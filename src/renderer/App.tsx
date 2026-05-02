import { useCallback, useEffect, useRef, useState } from 'react';
import type { WebviewTag } from 'electron';
import {
  Bell,
  BellOff,
  ExternalLink,
  Loader2,
  MoreVertical,
  Pin,
  Power,
  RefreshCw,
  Settings,
  WifiOff,
  X
} from 'lucide-react';
import type { AppSettings, ConnectionState } from '../shared/settings';
import { defaultSettings, type AppUpdateStatus } from '../shared/settings';
import { desktopChromeUserAgent } from '../shared/browserProfile';
import { whatsappHomeUrl, whatsappPartition } from '../shared/allowedOrigins';
import { SettingsPanel } from './components/SettingsPanel';

const defaultUpdateStatus: AppUpdateStatus = {
  state: 'idle',
  currentVersion: '0.0.0'
};

const externalLinkInterceptorScript = `
  (() => {
    if ((window).__zapdeskExternalLinkInterceptorInstalled) return;
    (window).__zapdeskExternalLinkInterceptorInstalled = true;

    const isWhatsAppUrl = (rawUrl) => {
      try {
        const url = new URL(rawUrl, window.location.href);
        return url.protocol === 'https:' && url.hostname.toLowerCase() === 'web.whatsapp.com';
      } catch {
        return false;
      }
    };

    const getCandidateUrl = (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return null;

      const anchor = target.closest('a[href]');
      if (anchor instanceof HTMLAnchorElement) {
        return anchor.getAttribute('href') ?? anchor.href ?? null;
      }

      const elementWithUrl = target.closest('[data-url],[data-href],[href]');
      if (!elementWithUrl) return null;

      return (
        elementWithUrl.getAttribute('data-url') ||
        elementWithUrl.getAttribute('data-href') ||
        elementWithUrl.getAttribute('href')
      );
    };

    const originalWindowOpen = window.open.bind(window);
    const sendExternalUrl = (url) => {
      if (document.documentElement.getAttribute('data-zapdesk-link-bridge') === 'ready') {
        window.postMessage({ type: 'zapdesk:open-external', url }, '*');
        return null;
      }

      return originalWindowOpen(url, '_blank', 'noopener,noreferrer');
    };

    window.open = (url, target, features) => {
      const candidateUrl = typeof url === 'string' ? url : url?.toString?.();
      if (candidateUrl && candidateUrl !== 'about:blank' && !isWhatsAppUrl(candidateUrl)) {
        sendExternalUrl(candidateUrl);
        return null;
      }

      return originalWindowOpen(url, target, features);
    };

    const openExternal = (event) => {
      const candidateUrl = getCandidateUrl(event);
      if (!candidateUrl || isWhatsAppUrl(candidateUrl)) return;

      event.preventDefault();
      event.stopPropagation();
      sendExternalUrl(candidateUrl);
    };

    document.addEventListener('click', openExternal, true);
    document.addEventListener('auxclick', openExternal, true);
  })();
`;

export function App() {
  const webviewRef = useRef<WebviewTag | null>(null);
  const hasShownWhatsAppRef = useRef(false);
  const explicitReloadRef = useRef(false);
  const pendingWebviewReloadRef = useRef(false);
  const loadingWatchdogRef = useRef<number | null>(null);
  const [webviewElement, setWebviewElement] = useState<WebviewTag | null>(null);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [quickMenuOpen, setQuickMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [slowLoad, setSlowLoad] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [connection, setConnection] = useState<ConnectionState>(navigator.onLine ? 'online' : 'offline');
  const [unread, setUnread] = useState(0);
  const [updateStatus, setUpdateStatus] = useState<AppUpdateStatus>(defaultUpdateStatus);
  const [actionError, setActionError] = useState<string | null>(null);

  const themeClass = settings.darkTheme ? 'theme-dark' : 'theme-light';

  const finishLoading = useCallback(() => {
    hasShownWhatsAppRef.current = true;
    explicitReloadRef.current = false;
    setSlowLoad(false);
    setLoading(false);
    setLoadError(null);

    if (loadingWatchdogRef.current) {
      window.clearTimeout(loadingWatchdogRef.current);
      loadingWatchdogRef.current = null;
    }
  }, []);

  const startLoading = useCallback((force = false) => {
    if (!force && hasShownWhatsAppRef.current) return;

    setLoadError(null);
    setSlowLoad(false);
    setLoading(true);

    if (loadingWatchdogRef.current) {
      window.clearTimeout(loadingWatchdogRef.current);
    }

    loadingWatchdogRef.current = window.setTimeout(() => {
      setSlowLoad(true);
    }, 7000);
  }, []);

  const reload = useCallback(() => {
    explicitReloadRef.current = true;
    startLoading(true);
    if (webviewRef.current) {
      webviewRef.current.reloadIgnoringCache();
      void window.zapdesk.markReloadHandled();
      return;
    }

    pendingWebviewReloadRef.current = true;
  }, [startLoading]);

  const updateSettings = useCallback(async (next: Partial<AppSettings>) => {
    try {
      const updated = await window.zapdesk.updateSettings(next);
      setSettings(updated);
      setActionError(null);
    } catch {
      setActionError('Nao foi possivel salvar as configuracoes.');
    }
  }, []);

  const checkForUpdates = useCallback(async () => {
    try {
      const status = await window.zapdesk.checkForUpdates();
      setUpdateStatus(status);
      setActionError(null);
    } catch {
      setActionError('Nao foi possivel verificar atualizacoes.');
    }
  }, []);

  const setWebviewRef = useCallback((node: HTMLElement | null) => {
    const element = node as WebviewTag | null;
    webviewRef.current = element;
    setWebviewElement(element);
  }, []);

  useEffect(() => {
    void window.zapdesk.getSettings().then(setSettings).catch(() => setActionError('Nao foi possivel carregar configuracoes.'));
    void window.zapdesk
      .getUpdateStatus()
      .then(setUpdateStatus)
      .catch(() => setActionError('Nao foi possivel carregar o status de atualizacao.'));
    const unsubSettings = window.zapdesk.onSettingsChanged(setSettings);
    const unsubUpdates = window.zapdesk.onUpdateChanged(setUpdateStatus);
    const unsubUnread = window.zapdesk.onUnreadChanged((payload) => setUnread(payload.unreadCount));
    const unsubConnection = window.zapdesk.onConnectionChanged(setConnection);
    const unsubFailed = window.zapdesk.onLoadFailed((message) => {
      if (hasShownWhatsAppRef.current) return;
      setLoadError(message);
      setLoading(false);
    });
    const unsubStarted = window.zapdesk.onLoadStarted(() => {
      startLoading(false);
    });
    const unsubFinished = window.zapdesk.onLoadFinished(() => {
      finishLoading();
      setConnection('online');
    });
    const unsubCommand = window.zapdesk.onWhatsAppCommand((command) => {
      if (command === 'reload') {
        reload();
      }
    });

    const online = () => setConnection('online');
    const offline = () => setConnection('offline');
    const closeQuickMenu = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (!target?.closest('.quick-actions')) setQuickMenuOpen(false);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setQuickMenuOpen(false);
    };

    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    document.addEventListener('mousedown', closeQuickMenu);
    document.addEventListener('keydown', handleEscape);

    return () => {
      unsubSettings();
      unsubUpdates();
      unsubUnread();
      unsubConnection();
      unsubFailed();
      unsubStarted();
      unsubFinished();
      unsubCommand();
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
      document.removeEventListener('mousedown', closeQuickMenu);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [finishLoading, reload, startLoading]);

  useEffect(() => {
    if (!webviewElement) return;

    const handleStart = () => {
      startLoading(explicitReloadRef.current);
    };
    const handleReady = () => {
      void webviewElement.setZoomFactor(1);
      void webviewElement.executeJavaScript(externalLinkInterceptorScript, false).catch(() => undefined);
    };
    const handleStop = () => {
      setConnection(navigator.onLine ? 'online' : 'offline');
    };
    const handleFinish = () => {
      setConnection('online');
    };
    const handleFail = (event: Electron.DidFailLoadEvent) => {
      if (event.isMainFrame) {
        setLoadError(`${event.errorDescription} (${event.errorCode})`);
        setLoading(false);
      }
    };
    if (pendingWebviewReloadRef.current) {
      pendingWebviewReloadRef.current = false;
      reload();
    }

    let probeAttempts = 0;
    const interactiveProbe = window.setInterval(() => {
      probeAttempts += 1;
      
      if (hasShownWhatsAppRef.current || probeAttempts > 20) {
        window.clearInterval(interactiveProbe);
        return;
      }

      void webviewElement
        .executeJavaScript(
          `Boolean(
            location.origin === 'https://web.whatsapp.com' &&
            document.querySelector('#app') &&
            (
              document.querySelector('[data-testid="chat-list"]') ||
              document.querySelector('[aria-label="Chat list"]') ||
              document.querySelector('[aria-label="Lista de conversas"]') ||
              document.querySelector('canvas') ||
              document.body?.innerText?.includes('WhatsApp')
            )
          )`,
          false
        )
        .then((ready) => {
          if (ready) finishLoading();
        })
        .catch(() => undefined);
    }, 1200);

    webviewElement.addEventListener('did-start-loading', handleStart);
    webviewElement.addEventListener('dom-ready', handleReady);
    webviewElement.addEventListener('did-stop-loading', handleStop);
    webviewElement.addEventListener('did-finish-load', handleFinish);
    webviewElement.addEventListener('did-fail-load', handleFail);

    return () => {
      window.clearInterval(interactiveProbe);
      webviewElement.removeEventListener('did-start-loading', handleStart);
      webviewElement.removeEventListener('dom-ready', handleReady);
      webviewElement.removeEventListener('did-stop-loading', handleStop);
      webviewElement.removeEventListener('did-finish-load', handleFinish);
      webviewElement.removeEventListener('did-fail-load', handleFail);
    };
  }, [finishLoading, reload, startLoading, webviewElement]);

  useEffect(() => {
    startLoading(true);

    return () => {
      if (loadingWatchdogRef.current) {
        window.clearTimeout(loadingWatchdogRef.current);
      }
    };
  }, [startLoading]);

  useEffect(() => {
    document.documentElement.dataset.theme = settings.darkTheme ? 'dark' : 'light';
  }, [settings.darkTheme]);

  useEffect(() => {
    if (actionError) {
      const timer = window.setTimeout(() => setActionError(null), 5000);
      return () => window.clearTimeout(timer);
    }
  }, [actionError]);

  return (
    <div className={`app-shell ${themeClass}`}>
      <main className="content">
        {connection === 'offline' && (
          <div className="connection-warning">
            <WifiOff size={16} />
            <span>Conexao perdida. O WhatsApp Web pode demorar para sincronizar.</span>
          </div>
        )}

        <webview
          ref={setWebviewRef}
          className="whatsapp-view"
          src={whatsappHomeUrl}
          partition={whatsappPartition}
          webpreferences="contextIsolation=yes,nodeIntegration=no,sandbox=yes,spellcheck=no"
          useragent={desktopChromeUserAgent}
          allowpopups
        />

        <div className="quick-actions">
          {unread > 0 && <span className="quick-unread">{unread > 99 ? '99+' : unread}</span>}
          <button
            type="button"
            className="quick-trigger"
            title="Acoes do ZapDesk"
            aria-expanded={quickMenuOpen}
            onClick={() => setQuickMenuOpen((open) => !open)}
          >
            <MoreVertical size={20} />
          </button>

          {quickMenuOpen && (
            <div className="quick-menu">
              <button
                type="button"
                onClick={() => {
                  setQuickMenuOpen(false);
                  reload();
                }}
              >
                <RefreshCw size={17} />
                <span>Recarregar</span>
              </button>
              <button
                type="button"
                className={settings.alwaysOnTop ? 'is-active' : ''}
                onClick={() => void updateSettings({ alwaysOnTop: !settings.alwaysOnTop })}
              >
                <Pin size={17} />
                <span>Sempre no topo</span>
              </button>
              <button
                type="button"
                className={settings.notifications ? 'is-active' : ''}
                onClick={() => void updateSettings({ notifications: !settings.notifications })}
              >
                {settings.notifications ? <Bell size={17} /> : <BellOff size={17} />}
                <span>Notificacoes</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setQuickMenuOpen(false);
                  setSettingsOpen(true);
                }}
              >
                <Settings size={17} />
                <span>Configuracoes</span>
              </button>
              <button type="button" onClick={() => void window.zapdesk.quitApp()}>
                <Power size={17} />
                <span>Sair</span>
              </button>
            </div>
          )}
        </div>

        {loading && !loadError && (
          <div className="overlay loading-screen">
            <div className="loader-card">
              <div className="loader-logo">Z</div>
              <div className="loader-progress">
                <Loader2 className="spin" size={24} />
                <span>Sincronizando sessao</span>
              </div>
              <h1>ZapDesk</h1>
              <p>Conectando ao WhatsApp Web com sua sessao local.</p>
              {slowLoad && (
                <button type="button" className="continue-button" onClick={reload} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <RefreshCw size={18} />
                  Recarregar WhatsApp
                </button>
              )}
            </div>
          </div>
        )}

        {loadError && (
          <div className="overlay error-screen">
            <div className="error-panel">
              <X size={28} />
              <h1>WhatsApp Web nao carregou</h1>
              <p>{loadError}</p>
              <div className="error-actions">
                <button type="button" onClick={reload}>
                  <RefreshCw size={18} />
                  Recarregar
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => void window.zapdesk.openExternal(whatsappHomeUrl)}
                >
                  <ExternalLink size={18} />
                  Abrir no navegador
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {actionError && (
        <div className="status-toast" role="status">
          {actionError}
        </div>
      )}

      {settingsOpen && (
        <SettingsPanel
          settings={settings}
          onClose={() => setSettingsOpen(false)}
          onChange={(next) => void updateSettings(next)}
          onClearSession={() =>
            void window.zapdesk.clearSession().catch(() => setActionError('Nao foi possivel limpar a sessao.'))
          }
          updateStatus={updateStatus}
          onCheckUpdates={() => void checkForUpdates()}
          onInstallUpdate={() => void window.zapdesk.installUpdate()}
        />
      )}
    </div>
  );
}
