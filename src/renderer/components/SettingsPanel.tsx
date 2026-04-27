import { Bell, Moon, Pin, RotateCcw, Save, X } from 'lucide-react';
import type { AppSettings } from '../../shared/settings';

type Props = {
  settings: AppSettings;
  onChange: (settings: Partial<AppSettings>) => void;
  onClose: () => void;
  onClearSession: () => void;
};

export function SettingsPanel({ settings, onChange, onClose, onClearSession }: Props) {
  return (
    <div className="settings-backdrop" role="dialog" aria-modal="true" aria-label="Configuracoes do ZapDesk">
      <section className="settings-panel">
        <header>
          <div>
            <h2>Configuracoes</h2>
            <p>Preferencias locais do aplicativo.</p>
          </div>
          <button type="button" title="Fechar" onClick={onClose}>
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
