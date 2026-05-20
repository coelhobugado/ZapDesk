import { useState } from 'react';
import {
  X,
  MessageSquare,
  Calendar,
  Plus,
  Trash2,
  Clock,
  Send
} from 'lucide-react';
import type { Snippet, ScheduledMessage } from '../../shared/settings';

type UtilityPanelProps = {
  snippets: Snippet[];
  onSaveSnippets: (snippets: Snippet[]) => void;
  schedules: ScheduledMessage[];
  onSaveSchedules: (schedules: ScheduledMessage[]) => void;
  activeAccountId: string;
  onUseSnippet: (text: string) => void;
  onClose: () => void;
};

export function UtilityPanel({
  snippets,
  onSaveSnippets,
  schedules,
  onSaveSchedules,
  activeAccountId,
  onUseSnippet,
  onClose
}: UtilityPanelProps) {
  const [activeTab, setActiveTab] = useState<'snippets' | 'schedules'>('snippets');

  // Estados dos formulários
  const [newShortcut, setNewShortcut] = useState('');
  const [newSnippetText, setNewSnippetText] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newScheduleText, setNewScheduleText] = useState('');
  const [newScheduleDateTime, setNewScheduleDateTime] = useState('');

  // Adicionar snippet
  const handleAddSnippet = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShortcut || !newSnippetText) return;

    const formattedShortcut = newShortcut.startsWith('/') ? newShortcut : `/${newShortcut}`;
    const nextSnippet: Snippet = {
      id: Date.now().toString(),
      shortcut: formattedShortcut,
      text: newSnippetText
    };

    onSaveSnippets([...snippets, nextSnippet]);
    setNewShortcut('');
    setNewSnippetText('');
  };

  // Remover snippet
  const handleRemoveSnippet = (id: string) => {
    onSaveSnippets(snippets.filter((s) => s.id !== id));
  };

  // Adicionar agendamento
  const handleAddSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContactPhone || !newScheduleText || !newScheduleDateTime) return;

    // Limpar o número do telefone (manter apenas números)
    const cleanedPhone = newContactPhone.replace(/\D/g, '');
    if (cleanedPhone.length < 10) {
      alert('Por favor, insira um número válido com DDD (ex: 5511999999999)');
      return;
    }

    const sendAt = new Date(newScheduleDateTime).getTime();
    if (isNaN(sendAt) || sendAt <= Date.now()) {
      alert('Por favor, selecione uma data e hora no futuro.');
      return;
    }

    const nextSchedule: ScheduledMessage = {
      id: Date.now().toString(),
      accountId: activeAccountId,
      contactName: cleanedPhone,
      text: newScheduleText,
      sendAt,
      status: 'pending'
    };

    onSaveSchedules([...schedules, nextSchedule]);
    setNewContactPhone('');
    setNewScheduleText('');
    setNewScheduleDateTime('');
  };

  // Remover agendamento
  const handleRemoveSchedule = (id: string) => {
    onSaveSchedules(schedules.filter((s) => s.id !== id));
  };

  // Formatar data para exibição
  const formatDateTime = (timestamp: number) => {
    const d = new Date(timestamp);
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <aside className="utility-sidebar">
      <div className="utility-header">
        <h3>ZapDesk Ferramentas</h3>
        <button type="button" className="close-utility-btn" onClick={onClose} title="Fechar painel">
          <X size={18} />
        </button>
      </div>

      <div className="utility-tabs">
        <button
          type="button"
          className={`utility-tab-btn ${activeTab === 'snippets' ? 'active' : ''}`}
          onClick={() => setActiveTab('snippets')}
        >
          <MessageSquare size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
          Respostas Rápidas
        </button>
        <button
          type="button"
          className={`utility-tab-btn ${activeTab === 'schedules' ? 'active' : ''}`}
          onClick={() => setActiveTab('schedules')}
        >
          <Calendar size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
          Agendamentos
        </button>
      </div>

      <div className="utility-tab-content">
        {activeTab === 'snippets' && (
          <>
            {/* Formulário Novo Snippet */}
            <form onSubmit={handleAddSnippet} className="form-section">
              <h4 className="form-title">
                <Plus size={14} /> Novo Snippet
              </h4>
              <div className="form-group">
                <label htmlFor="shortcut">Atalho (ex: /oi)</label>
                <input
                  id="shortcut"
                  type="text"
                  placeholder="/atalho"
                  className="form-input"
                  value={newShortcut}
                  onChange={(e) => setNewShortcut(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="snippetText">Mensagem</label>
                <textarea
                  id="snippetText"
                  placeholder="Escreva a resposta rápida..."
                  className="form-input"
                  style={{ minHeight: '60px', resize: 'vertical' }}
                  value={newSnippetText}
                  onChange={(e) => setNewSnippetText(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="form-submit-btn">
                Salvar Snippet
              </button>
            </form>

            {/* Lista de Snippets */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {snippets.length === 0 ? (
                <p style={{ color: 'var(--muted)', fontSize: '13px', textAlign: 'center', margin: '20px 0' }}>
                  Nenhuma resposta rápida cadastrada.
                </p>
              ) : (
                snippets.map((snip) => (
                  <div key={snip.id} className="snippet-item">
                    <div className="snippet-header">
                      <span className="snippet-shortcut">{snip.shortcut}</span>
                      <div className="snippet-actions">
                        <button
                          type="button"
                          className="snippet-action-btn use-btn"
                          onClick={() => onUseSnippet(snip.text)}
                          title="Inserir texto no chat"
                        >
                          <Send size={13} />
                        </button>
                        <button
                          type="button"
                          className="snippet-action-btn"
                          onClick={() => handleRemoveSnippet(snip.id)}
                          title="Excluir"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                    <div className="snippet-text">{snip.text}</div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {activeTab === 'schedules' && (
          <>
            {/* Formulário Novo Agendamento */}
            <form onSubmit={handleAddSchedule} className="form-section">
              <h4 className="form-title">
                <Plus size={14} /> Agendar Mensagem
              </h4>
              <div className="form-group">
                <label htmlFor="phone">Telefone do Contato (com DDI + DDD)</label>
                <input
                  id="phone"
                  type="text"
                  placeholder="ex: 5511999999999"
                  className="form-input"
                  value={newContactPhone}
                  onChange={(e) => setNewContactPhone(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="scheduleText">Mensagem</label>
                <textarea
                  id="scheduleText"
                  placeholder="Mensagem a ser enviada..."
                  className="form-input"
                  style={{ minHeight: '60px', resize: 'vertical' }}
                  value={newScheduleText}
                  onChange={(e) => setNewScheduleText(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="dateTime">Data e Hora de Envio</label>
                <input
                  id="dateTime"
                  type="datetime-local"
                  className="form-input"
                  value={newScheduleDateTime}
                  onChange={(e) => setNewScheduleDateTime(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="form-submit-btn">
                Agendar Mensagem
              </button>
            </form>

            {/* Lista de Agendados */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {schedules.filter(s => s.accountId === activeAccountId).length === 0 ? (
                <p style={{ color: 'var(--muted)', fontSize: '13px', textAlign: 'center', margin: '20px 0' }}>
                  Nenhum agendamento para esta conta.
                </p>
              ) : (
                schedules
                  .filter(s => s.accountId === activeAccountId)
                  .map((sched) => (
                    <div key={sched.id} className="schedule-item">
                      <div className="schedule-header">
                        <span className="schedule-contact">Para: {sched.contactName}</span>
                        <span className={`schedule-status ${sched.status}`}>{sched.status}</span>
                      </div>
                      <div className="snippet-text" style={{ fontSize: '12px', color: 'var(--text)' }}>
                        {sched.text}
                      </div>
                      <div className="schedule-time">
                        <Clock size={11} />
                        {formatDateTime(sched.sendAt)}
                      </div>
                      {sched.errorMessage && (
                        <div className="schedule-error">{sched.errorMessage}</div>
                      )}
                      {sched.status === 'pending' && (
                        <div className="schedule-actions">
                          <button
                            type="button"
                            className="snippet-action-btn"
                            onClick={() => handleRemoveSchedule(sched.id)}
                            title="Cancelar agendamento"
                          >
                            <Trash2 size={13} /> Cancelar
                          </button>
                        </div>
                      )}
                    </div>
                  ))
              )}
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
