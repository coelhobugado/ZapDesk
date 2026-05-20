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
  X,
  Plus,
  MessageSquare
} from 'lucide-react';
import type { AppSettings, ConnectionState, Account, Snippet, ScheduledMessage } from '../shared/settings';
import { defaultSettings, type AppUpdateStatus } from '../shared/settings';
import { whatsappHomeUrl } from '../shared/allowedOrigins';
import { SettingsPanel } from './components/SettingsPanel';
import { UtilityPanel } from './components/UtilityPanel';

const defaultUpdateStatus: AppUpdateStatus = {
  state: 'idle',
  currentVersion: '0.0.0'
};

const ignoredLoadErrorCodes = new Set([-3]);

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
  const [loading, setLoading] = useState(false);
  const [slowLoad, setSlowLoad] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState('Recarregando a sessao local.');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [connection, setConnection] = useState<ConnectionState>(navigator.onLine ? 'online' : 'offline');
  const [unread, setUnread] = useState(0);
  const [updateStatus, setUpdateStatus] = useState<AppUpdateStatus>(defaultUpdateStatus);
  const [actionError, setActionError] = useState<string | null>(null);

  // Estados das novas Features
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activeAccountId, setActiveAccountId] = useState<string>('default');
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [schedules, setSchedules] = useState<ScheduledMessage[]>([]);
  const [sendingQueue, setSendingQueue] = useState<ScheduledMessage[]>([]);
  const [utilityPanelOpen, setUtilityPanelOpen] = useState(false);
  const [addAccountModalOpen, setAddAccountModalOpen] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');

  const themeClass = settings.darkTheme ? 'theme-dark' : 'theme-light';

  const finishLoading = useCallback(() => {
    hasShownWhatsAppRef.current = true;
    explicitReloadRef.current = false;
    setSlowLoad(false);
    setLoadingDetails('Recarregando a sessao local.');
    setLoading(false);
    setLoadError(null);

    if (loadingWatchdogRef.current) {
      window.clearTimeout(loadingWatchdogRef.current);
      loadingWatchdogRef.current = null;
    }
  }, []);

  const startLoading = useCallback((showOverlay = false) => {
    if (!showOverlay && hasShownWhatsAppRef.current) return;

    setLoadError(null);
    setSlowLoad(false);
    setLoadingDetails('Recarregando a sessao local.');
    setLoading(showOverlay);

    if (loadingWatchdogRef.current) {
      window.clearTimeout(loadingWatchdogRef.current);
      loadingWatchdogRef.current = null;
    }

    if (!showOverlay) return;

    loadingWatchdogRef.current = window.setTimeout(() => {
      setSlowLoad(true);
      loadingWatchdogRef.current = window.setTimeout(() => {
        setLoading(false);
        loadingWatchdogRef.current = null;
      }, 20000);
    }, 10000);
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

  // Injetar texto de Snippet
  const useSnippet = useCallback((text: string) => {
    if (!webviewElement) return;

    const escapedText = JSON.stringify(text);
    const injectScript = `
      (() => {
        const el = document.querySelector('div[contenteditable="true"]') || document.querySelector('[data-testid="conversation-text-input"]');
        if (el) {
          el.focus();
          document.execCommand('insertText', false, ${escapedText});
        }
      })()
    `;

    webviewElement.executeJavaScript(injectScript)
      .then(() => setActionError(null))
      .catch(() => setActionError('Nao foi possivel inserir o snippet no chat.'));
  }, [webviewElement]);

  // Criar nova conta
  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccountName.trim()) return;

    const accountId = `account_${Date.now()}`;
    const newAccount: Account = {
      id: accountId,
      name: newAccountName.trim(),
      partition: `persist:zapdesk-whatsapp-${accountId}`
    };

    const nextAccounts = [...accounts, newAccount];
    try {
      await window.zapdesk.saveAccounts(nextAccounts);
      setAccounts(nextAccounts);
      await window.zapdesk.setActiveAccountId(accountId);
      setActiveAccountId(accountId);

      setNewAccountName('');
      setAddAccountModalOpen(false);

      // Forçar overlay de loading para a nova conta
      hasShownWhatsAppRef.current = false;
      startLoading(true);
    } catch {
      setActionError('Falha ao criar nova conta.');
    }
  };

  // Remover conta
  const handleRemoveAccount = async (id: string) => {
    if (id === 'default') {
      alert('A conta principal nao pode ser excluida.');
      return;
    }
    if (!confirm('Deseja realmente remover esta conta? Todos os dados da sessao dela serao perdidos.')) {
      return;
    }

    const nextAccounts = accounts.filter((a) => a.id !== id);
    try {
      await window.zapdesk.saveAccounts(nextAccounts);
      setAccounts(nextAccounts);

      if (activeAccountId === id) {
        await window.zapdesk.setActiveAccountId('default');
        setActiveAccountId('default');

        hasShownWhatsAppRef.current = false;
        startLoading(true);
      }
    } catch {
      setActionError('Falha ao remover conta.');
    }
  };

  // Mudar conta ativa
  const selectAccount = async (id: string) => {
    if (id === activeAccountId) return;
    try {
      await window.zapdesk.setActiveAccountId(id);
      setActiveAccountId(id);

      // Resetar estados de carregamento para carregar a nova partição do zero
      hasShownWhatsAppRef.current = false;
      startLoading(true);
    } catch {
      setActionError('Falha ao trocar de conta.');
    }
  };

  // Monitorar envio de mensagens agendadas locais na WebView de background
  const setupBackgroundSenderWebview = useCallback((webview: WebviewTag, msg: ScheduledMessage) => {
    if (webview.dataset.scheduleId === msg.id) return;
    webview.dataset.scheduleId = msg.id;

    let finished = false;

    // Timeout de 45 segundos para falhar caso nao consiga enviar
    const failsafeTimeout = window.setTimeout(async () => {
      if (finished) return;
      finished = true;

      try {
        const current = await window.zapdesk.getSchedules();
        const updated = current.map((s) => {
          if (s.id === msg.id) {
            return { ...s, status: 'failed' as const, errorMessage: 'Erro: limite de tempo excedido (45s).' };
          }
          return s;
        });
        await window.zapdesk.saveSchedules(updated);
      } catch (err) {
        console.warn('[ZapDesk] Falha ao marcar agendamento como erro:', err);
      }

      setSendingQueue((prev) => prev.filter((item) => item.id !== msg.id));
    }, 45000);

    const handleDomReady = () => {
      // Injetar script para procurar e clicar no botao "Enviar" do WhatsApp Web.
      const clickScript = `
        new Promise((resolve) => {
          let attempts = 0;
          const interval = setInterval(() => {
            attempts += 1;
            const button =
              document.querySelector('[data-testid="send"]') ||
              document.querySelector('[data-icon="send"]')?.closest('button') ||
              document.querySelector('button[aria-label="Enviar"]') ||
              document.querySelector('button[aria-label="Send"]');

            if (button) {
              button.click();
              clearInterval(interval);
              resolve(true);
              return;
            }

            if (attempts >= 30) {
              clearInterval(interval);
              resolve(false);
            }
          }, 1000);
        })
      `;
      void webview.executeJavaScript(clickScript).then(async (clicked) => {
        if (finished) return;
        finished = true;
        window.clearTimeout(failsafeTimeout);

        try {
          const current = await window.zapdesk.getSchedules();
          const updated = current.map((s) => {
            if (s.id === msg.id) {
              if (clicked) return { ...s, status: 'sent' as const, errorMessage: undefined };
              return { ...s, status: 'failed' as const, errorMessage: 'Nao foi possivel localizar o botao de envio.' };
            }
            return s;
          });
          await window.zapdesk.saveSchedules(updated);
        } catch (err) {
          console.warn('[ZapDesk] Falha ao marcar agendamento como enviado:', err);
        }

        setSendingQueue((prev) => prev.filter((item) => item.id !== msg.id));
      }).catch(async () => {
        if (finished) return;
        finished = true;
        window.clearTimeout(failsafeTimeout);

        try {
          const current = await window.zapdesk.getSchedules();
          const updated = current.map((s) => {
            if (s.id === msg.id) {
              return { ...s, status: 'failed' as const, errorMessage: 'Falha ao executar o envio no WhatsApp Web.' };
            }
            return s;
          });
          await window.zapdesk.saveSchedules(updated);
        } catch (err) {
          console.warn('[ZapDesk] Falha ao marcar agendamento como erro:', err);
        }

        setSendingQueue((prev) => prev.filter((item) => item.id !== msg.id));
      });
    };

    webview.addEventListener('dom-ready', handleDomReady);
  }, []);

  useEffect(() => {
    void window.zapdesk.getSettings().then(setSettings).catch(() => setActionError('Nao foi possivel carregar configuracoes.'));
    void window.zapdesk
      .getUpdateStatus()
      .then(setUpdateStatus)
      .catch(() => setActionError('Nao foi possivel carregar o status de atualizacao.'));

    // Obter dados das novas features do Store
    void window.zapdesk.getAccounts().then(setAccounts).catch(() => undefined);
    void window.zapdesk.getActiveAccountId().then(setActiveAccountId).catch(() => undefined);
    void window.zapdesk.getSnippets().then(setSnippets).catch(() => undefined);
    void window.zapdesk.getSchedules().then(setSchedules).catch(() => undefined);

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
      setConnection('online');
      finishLoading();
    });
    const unsubCommand = window.zapdesk.onWhatsAppCommand((command) => {
      if (command === 'reload') {
        reload();
      }
    });
    const unsubReady = window.zapdesk.onWhatsAppReady(() => {
      finishLoading();
    });

    // Escutar eventos reativos das novas features
    const unsubAccounts = window.zapdesk.onActiveAccountChanged(setActiveAccountId);
    const unsubSnippets = window.zapdesk.onSnippetsChanged(setSnippets);
    const unsubSchedules = window.zapdesk.onSchedulesChanged(setSchedules);
    const unsubSendRequest = window.zapdesk.onScheduleSendRequest((msg) => {
      setSendingQueue((prev) => {
        if (prev.some((p) => p.id === msg.id)) return prev;
        return [...prev, msg];
      });
    });

    const online = () => setConnection('online');
    const offline = () => setConnection('offline');
    const closeQuickMenu = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (!target?.closest('.quick-actions')) setQuickMenuOpen(false);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setQuickMenuOpen(false);
        setUtilityPanelOpen(false);
      }
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
      unsubReady();
      unsubAccounts();
      unsubSnippets();
      unsubSchedules();
      unsubSendRequest();
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
    };
    const handleStop = () => {
      setConnection(navigator.onLine ? 'online' : 'offline');
    };
    const handleFinish = () => {
      setConnection('online');
      finishLoading();
    };
    const handleFail = (event: Electron.DidFailLoadEvent) => {
      if (!event.isMainFrame) return;
      if (ignoredLoadErrorCodes.has(event.errorCode)) return;

      setLoadError(`${event.errorDescription} (${event.errorCode})`);
      setLoading(false);
    };
    if (pendingWebviewReloadRef.current) {
      pendingWebviewReloadRef.current = false;
      reload();
    }

    webviewElement.addEventListener('did-start-loading', handleStart);
    webviewElement.addEventListener('dom-ready', handleReady);
    webviewElement.addEventListener('did-stop-loading', handleStop);
    webviewElement.addEventListener('did-finish-load', handleFinish);
    webviewElement.addEventListener('did-fail-load', handleFail);

    return () => {
      webviewElement.removeEventListener('did-start-loading', handleStart);
      webviewElement.removeEventListener('dom-ready', handleReady);
      webviewElement.removeEventListener('did-stop-loading', handleStop);
      webviewElement.removeEventListener('did-finish-load', handleFinish);
      webviewElement.removeEventListener('did-fail-load', handleFail);
    };
  }, [finishLoading, reload, startLoading, webviewElement]);

  useEffect(() => {
    startLoading(false);

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
      {/* 1. Barra Lateral de Contas (Multi-Sessão) */}
      <nav className="accounts-sidebar" aria-label="Contas do WhatsApp">
        {accounts.map((acc) => {
          const initials = acc.name.slice(0, 2).toUpperCase();
          const isActive = acc.id === activeAccountId;

          return (
            <div key={acc.id} className={`account-item-wrapper ${isActive ? 'active' : ''}`}>
              <span className="account-active-indicator" />
              <button
                type="button"
                className="account-btn"
                onClick={() => selectAccount(acc.id)}
                title={`Trocar para ${acc.name}`}
              >
                {initials}
              </button>
              <div className="account-tooltip">
                {acc.name} {acc.id !== 'default' && '• Clique com botão direito para remover'}
              </div>
              {acc.id !== 'default' && (
                <button
                  type="button"
                  onClick={() => handleRemoveAccount(acc.id)}
                  style={{
                    position: 'absolute',
                    right: '-4px',
                    top: '-4px',
                    background: 'var(--danger)',
                    borderRadius: '50%',
                    width: '16px',
                    height: '16px',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '10px',
                    cursor: 'pointer',
                    border: '1px solid #101615'
                  }}
                  title="Remover Conta"
                >
                  <X size={10} />
                </button>
              )}
            </div>
          );
        })}
        <div className="sidebar-divider" />
        <button
          type="button"
          className="account-btn-add"
          onClick={() => setAddAccountModalOpen(true)}
          title="Adicionar Nova Conta"
        >
          <Plus size={20} />
        </button>
      </nav>

      {/* 2. Container Principal (WebView + Sidebar de Produtividade) */}
      <div className="main-container">
        {connection === 'offline' && (
          <div className="connection-warning">
            <WifiOff size={16} />
            <span>Conexao perdida. O WhatsApp Web pode demorar para sincronizar.</span>
          </div>
        )}

        <div className="main-layout">
          {/* WebView do WhatsApp */}
          <main className="content">
            <webview
              key={activeAccountId} // Desmonta e recria a webview para trocar de partição de sessão
              ref={setWebviewRef}
              className="whatsapp-view"
              src={whatsappHomeUrl}
              partition={accounts.find((a) => a.id === activeAccountId)?.partition ?? 'persist:zapdesk-whatsapp'}
              preload={window.whatsappPreloadPath}
              webpreferences={`contextIsolation=yes,nodeIntegration=no,sandbox=yes,spellcheck=${
                settings.spellChecker ? 'yes' : 'no'
              },transparent=no`}
              allowpopups
            />

            {/* Menu Rápido de Ações Flutuante */}
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
                      setUtilityPanelOpen(true);
                    }}
                  >
                    <MessageSquare size={17} />
                    <span>Ferramentas</span>
                  </button>
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

            {/* Overlay de Carregamento */}
            {loading && !loadError && (
              <div className="overlay loading-screen">
                <div className="loader-card">
                  <div className="loader-logo">Z</div>
                  <div className="loader-progress">
                    <Loader2 className="spin" size={24} />
                    <span>Sincronizando sessao</span>
                  </div>
                  <h1>ZapDesk</h1>
                  <p>{loadingDetails}</p>
                  {slowLoad && (
                    <button
                      type="button"
                      className="continue-button"
                      onClick={reload}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                      <RefreshCw size={18} />
                      Recarregar WhatsApp
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Overlay de Erro */}
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

          {/* 3. Barra Lateral de Ferramentas Retrátil (Snippets/Schedules) */}
          {utilityPanelOpen && (
            <UtilityPanel
              snippets={snippets}
              onSaveSnippets={(data) => void window.zapdesk.saveSnippets(data)}
              schedules={schedules}
              onSaveSchedules={(data) => void window.zapdesk.saveSchedules(data)}
              activeAccountId={activeAccountId}
              onUseSnippet={useSnippet}
              onClose={() => setUtilityPanelOpen(false)}
            />
          )}
        </div>
      </div>

      {/* 4. Modal: Adicionar Conta */}
      {addAccountModalOpen && (
        <div className="custom-modal-overlay">
          <form className="custom-modal" onSubmit={handleAddAccount}>
            <div className="custom-modal-header">
              <h3>Adicionar Conta do WhatsApp</h3>
              <button
                type="button"
                className="close-utility-btn"
                onClick={() => setAddAccountModalOpen(false)}
              >
                <X size={16} />
              </button>
            </div>
            <div className="custom-modal-body">
              <div className="form-group">
                <label htmlFor="newAccName">Nome da Conta (ex: Comercial, Suporte)</label>
                <input
                  id="newAccName"
                  type="text"
                  placeholder="Nome identificador da conta"
                  className="form-input"
                  value={newAccountName}
                  onChange={(e) => setNewAccountName(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <p style={{ fontSize: '11px', color: 'var(--muted)', margin: 0 }}>
                Uma nova sessao isolada sera criada. Voce precisara escanear o QR Code correspondente.
              </p>
            </div>
            <div className="custom-modal-footer">
              <button
                type="button"
                className="modal-btn secondary"
                onClick={() => setAddAccountModalOpen(false)}
              >
                Cancelar
              </button>
              <button type="submit" className="modal-btn primary">
                Adicionar Conta
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Toast de Erro */}
      {actionError && (
        <div className="status-toast" role="status">
          {actionError}
        </div>
      )}

      {/* Painel de Configurações */}
      {settingsOpen && (
        <SettingsPanel
          settings={settings}
          onClose={() => setSettingsOpen(false)}
          onChange={(next) => void updateSettings(next)}
          onClearSession={() =>
            void window.zapdesk
              .clearSession()
              .catch(() => setActionError('Nao foi possivel limpar a sessao.'))
          }
          updateStatus={updateStatus}
          onCheckUpdates={() => void checkForUpdates()}
          onInstallUpdate={() => void window.zapdesk.installUpdate()}
        />
      )}

      {/* 5. WebViews Invisíveis em Background para Envio de Agendamentos */}
      {sendingQueue.map((msg) => (
        <div key={msg.id}>
          <webview
            style={{ display: 'none' }}
            partition={
              accounts.find((a) => a.id === msg.accountId)?.partition ??
              'persist:zapdesk-whatsapp'
            }
            src={`https://web.whatsapp.com/send?phone=${msg.contactName}&text=${encodeURIComponent(
              msg.text
            )}`}
            preload={window.whatsappPreloadPath}
            webpreferences="contextIsolation=yes,nodeIntegration=no,sandbox=yes,transparent=no"
            ref={(el) => {
              if (el) {
                setupBackgroundSenderWebview(el as unknown as WebviewTag, msg);
              }
            }}
          />
          <div className="background-send-indicator">
            <Loader2 className="spin" size={14} />
            <span>ZapDesk: Enviando agendamento para {msg.contactName}...</span>
          </div>
        </div>
      ))}
    </div>
  );
}
