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
import { SettingsPanel } from './components/SettingsPanel';

const whatsappUrl = 'https://web.whatsapp.com/';
const defaultUpdateStatus: AppUpdateStatus = {
  state: 'idle',
  currentVersion: '0.0.0'
};

export function App() {
  const webviewRef = useRef<WebviewTag | null>(null);
  const hasShownWhatsAppRef = useRef(false);
  const explicitReloadRef = useRef(false);
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
    webviewRef.current?.reloadIgnoringCache();
  }, [startLoading]);

  const updateSettings = useCallback(async (next: Partial<AppSettings>) => {
    const updated = await window.zapdesk.updateSettings(next);
    setSettings(updated);
  }, []);

  const checkForUpdates = useCallback(async () => {
    const status = await window.zapdesk.checkForUpdates();
    setUpdateStatus(status);
  }, []);

  const setWebviewRef = useCallback((node: HTMLElement | null) => {
    const element = node as WebviewTag | null;
    webviewRef.current = element;
    setWebviewElement(element);
  }, []);

  useEffect(() => {
    void window.zapdesk.getSettings().then(setSettings);
    void window.zapdesk.getUpdateStatus().then(setUpdateStatus);
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
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);

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
    };
  }, [finishLoading, reload, startLoading]);

  useEffect(() => {
    if (!webviewElement) return;

    const handleStart = () => {
      startLoading(explicitReloadRef.current);
    };
    const handleReady = () => {
      finishLoading();
      setConnection('online');
      void webviewElement.setZoomFactor(1);
    };
    const handleStop = () => {
      finishLoading();
      setConnection(navigator.onLine ? 'online' : 'offline');
    };
    const handleFinish = () => {
      finishLoading();
      setConnection('online');
    };
    const handleFail = (event: Electron.DidFailLoadEvent) => {
      if (event.isMainFrame) {
        setLoadError(`${event.errorDescription} (${event.errorCode})`);
        setLoading(false);
      }
    };
    const fallback = window.setTimeout(() => {
      if (webviewElement.getURL().startsWith(whatsappUrl)) {
        finishLoading();
      }
    }, 8000);

    const interactiveProbe = window.setInterval(() => {
      if (hasShownWhatsAppRef.current) {
        window.clearInterval(interactiveProbe);
        return;
      }

      void webviewElement
        .executeJavaScript(
          'Boolean(document.body && (document.readyState === "interactive" || document.readyState === "complete"))',
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
      window.clearTimeout(fallback);
      window.clearInterval(interactiveProbe);
      webviewElement.removeEventListener('did-start-loading', handleStart);
      webviewElement.removeEventListener('dom-ready', handleReady);
      webviewElement.removeEventListener('did-stop-loading', handleStop);
      webviewElement.removeEventListener('did-finish-load', handleFinish);
      webviewElement.removeEventListener('did-fail-load', handleFail);
    };
  }, [finishLoading, startLoading, webviewElement]);

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
          src={whatsappUrl}
          partition="persist:zapdesk-whatsapp"
          webpreferences="contextIsolation=yes,nodeIntegration=no,nativeWindowOpen=no,backgroundThrottling=no,spellcheck=no"
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
                <button type="button" className="continue-button" onClick={finishLoading}>
                  Continuar para o WhatsApp
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
                <button type="button" className="secondary" onClick={() => void window.zapdesk.openExternal(whatsappUrl)}>
                  <ExternalLink size={18} />
                  Abrir no navegador
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {settingsOpen && (
        <SettingsPanel
          settings={settings}
          onClose={() => setSettingsOpen(false)}
          onChange={(next) => void updateSettings(next)}
          onClearSession={() => void window.zapdesk.clearSession()}
          updateStatus={updateStatus}
          onCheckUpdates={() => void checkForUpdates()}
          onInstallUpdate={() => void window.zapdesk.installUpdate()}
        />
      )}
    </div>
  );
}
