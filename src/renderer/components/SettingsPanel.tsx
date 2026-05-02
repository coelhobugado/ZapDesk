import { useEffect, useRef } from 'react';
import { Bell, Download, Moon, Pin, RefreshCw, RotateCcw, Save, X } from 'lucide-react';
import type { AppSettings, AppUpdateStatus } from '../../shared/settings';

type Props = {
  settings: AppSettings;
  onChange: (settings: Partial<AppSettings>) => void;
  onClose: () => void;
  onClearSession: () => void;
  updateStatus: AppUpdateStatus;
  onCheckUpdates: () => void;
  onInstallUpdate: () => void;
};

export function SettingsPanel({
  settings,
  onChange,
  onClose,
  onClearSession,
  updateStatus,
  onCheckUpdates,
  onInstallUpdate
}: Props) {
  const checking = updateStatus.state === 'checking' || updateStatus.state === 'downloading';
  const downloaded = updateStatus.state === 'downloaded';
  const panelRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab' || !panelRef.current) return;

      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)')
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="settings-backdrop" role="dialog" aria-modal="true" aria-label="Configuracoes do ZapDesk">
      <section className="settings-panel" ref={panelRef}>
        <header>
          <div>
            <h2>Configuracoes</h2>
            <p>Preferencias locais do aplicativo.</p>
          </div>
          <button type="button" title="Fechar" ref={closeButtonRef} onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <div className="settings-list">
          <ToggleRow
            icon={<Save size={18} />}
            title="Iniciar com Windows"
            description="Abre o ZapDesk ao entrar no sistema."
            checked={settings.startWithWindows}
            onChange={(checked) => onChange({ startWithWindows: checked })}
          />
          <ToggleRow
            icon={<X size={18} />}
            title="Minimizar ao fechar"
            description="O botao X envia o app para a bandeja."
            checked={settings.minimizeToTray}
            onChange={(checked) => onChange({ minimizeToTray: checked })}
          />
          <ToggleRow
            icon={<Pin size={18} />}
            title="Sempre no topo"
            description="Mantem a janela acima das demais."
            checked={settings.alwaysOnTop}
            onChange={(checked) => onChange({ alwaysOnTop: checked })}
          />
          <ToggleRow
            icon={<Bell size={18} />}
            title="Notificacoes"
            description="Usa notificacoes nativas do Windows para novas mensagens."
            checked={settings.notifications}
            onChange={(checked) => onChange({ notifications: checked })}
          />
          <ToggleRow
            icon={<Moon size={18} />}
            title="Tema escuro"
            description="Aplica visual escuro ao shell do aplicativo."
            checked={settings.darkTheme}
            onChange={(checked) => onChange({ darkTheme: checked })}
          />
          <ToggleRow
            icon={<Download size={18} />}
            title="Atualizacoes automaticas"
            description="Verifica novas versoes ao abrir o ZapDesk."
            checked={settings.autoUpdate}
            onChange={(checked) => onChange({ autoUpdate: checked })}
          />

          <section className="update-section" aria-label="Atualizacoes do ZapDesk">
            <div className="update-copy">
              <strong>Versao {updateStatus.currentVersion}</strong>
              <small>{formatUpdateStatus(updateStatus)}</small>
            </div>
            {typeof updateStatus.percent === 'number' && (
              <div className="update-progress" aria-label={`Progresso ${updateStatus.percent}%`}>
                <span style={{ width: `${updateStatus.percent}%` }} />
              </div>
            )}
            <div className="update-actions">
              <button type="button" onClick={onCheckUpdates} disabled={checking || downloaded}>
                <RefreshCw size={17} className={checking ? 'spin' : undefined} />
                Verificar agora
              </button>
              {downloaded && (
                <button type="button" className="primary" onClick={onInstallUpdate}>
                  <Download size={17} />
                  Reiniciar e instalar
                </button>
              )}
            </div>
          </section>
        </div>

        <footer>
          <button type="button" className="danger" onClick={onClearSession}>
            <RotateCcw size={18} />
            Limpar cache e sessao
          </button>
        </footer>
      </section>
    </div>
  );
}

function formatUpdateStatus(status: AppUpdateStatus): string {
  if (status.message) return status.message;

  switch (status.state) {
    case 'checking':
      return 'Verificando atualizacoes...';
    case 'available':
      return status.availableVersion ? `Atualizacao ${status.availableVersion} encontrada.` : 'Atualizacao encontrada.';
    case 'downloading':
      return 'Baixando atualizacao...';
    case 'downloaded':
      return 'Atualizacao baixada. Reinicie para instalar.';
    case 'not-available':
      return 'Voce ja esta usando a versao mais recente.';
    case 'error':
      return 'Nao foi possivel verificar atualizacoes.';
    case 'disabled':
      return 'Verificacao automatica desativada.';
    default:
      return 'Pronto para verificar novas versoes.';
  }
}

function ToggleRow({
  icon,
  title,
  description,
  checked,
  onChange
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="toggle-row">
      <span className="toggle-icon">{icon}</span>
      <span className="toggle-copy">
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.currentTarget.checked)} />
      <span className="switch" aria-hidden="true" />
    </label>
  );
}
