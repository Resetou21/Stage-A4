import React, { useState, useMemo } from 'react';
import {
  Bell,
  Send,
  CheckCircle2,
  Trash2,
  Search,
  MessageSquare,
  Reply,
  Clock,
  Wrench,
  UserCheck,
  Check,
  RefreshCw,
} from 'lucide-react';
import type { Machine } from '../types';
import type { MaintenanceAlertMessage } from '../services/maintenanceApi';
import { AlertContextSelect } from './MachineSelect';
import { ResponsableSelect } from './ResponsableSelect';

interface AtelierAlertsSectionProps {
  alerts: MaintenanceAlertMessage[];
  machines: Machine[];
  onRefresh: () => Promise<void>;
  onMarkSeen: (alertId: string) => Promise<void>;
  onArchive: (alertId: string) => Promise<void>;
  onSendAlert: (params: {
    recipientPerson: string;
    machineName?: string;
    message: string;
    senderName?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  getCol: (item: any, colId: string) => string;
}

export const AtelierAlertsSection: React.FC<AtelierAlertsSectionProps> = ({
  alerts,
  machines,
  onRefresh,
  onMarkSeen,
  onArchive,
  onSendAlert,
  getCol,
}) => {
  const [recipient, setRecipient] = useState<string>('Natacha THOMAS');
  const [machineContext, setMachineContext] = useState<string>('');
  const [messageText, setMessageText] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [filterMode, setFilterMode] = useState<'all' | 'unread' | 'incoming' | 'outgoing'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const showFeedback = (msg: string) => {
    setActionFeedback(msg);
    setTimeout(() => setActionFeedback(null), 3500);
  };

  const handleSend = async () => {
    if (!messageText.trim()) return;
    setIsSending(true);
    const res = await onSendAlert({
      recipientPerson: recipient,
      machineName: machineContext.trim() || undefined,
      message: messageText.trim(),
      senderName: 'Christophe (Atelier)',
    });
    setIsSending(false);

    if (res.success) {
      setMessageText('');
      setMachineContext('');
      showFeedback(`✓ Message transmis directement au Hub de ${recipient} !`);
      await onRefresh();
    } else {
      alert(`Erreur d'envoi de l'alerte : ${res.error || 'Erreur inconnue'}`);
    }
  };

  const handleReplyTo = (alert: MaintenanceAlertMessage) => {
    if (alert.person) {
      setRecipient(alert.person);
    }
    // Si un contexte machine ou chantier est mentionné dans le titre
    const match = alert.title.match(/\[(.*?)\]/);
    if (match && match[1]) {
      setMachineContext(match[1]);
    }
    const inputEl = document.getElementById('atelier-alert-message-input');
    if (inputEl) {
      inputEl.focus();
    }
  };

  const unreadIncomingCount = useMemo(() => {
    return alerts.filter((a) => !a.seen && a.direction === 'to_atelier').length;
  }, [alerts]);

  const filteredAlerts = useMemo(() => {
    return alerts.filter((al) => {
      const isIncoming = al.direction === 'to_atelier';

      if (filterMode === 'unread' && (al.seen || !isIncoming)) return false;
      if (filterMode === 'incoming' && !isIncoming) return false;
      if (filterMode === 'outgoing' && isIncoming) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = al.title.toLowerCase().includes(q);
        const matchPerson = (al.person || '').toLowerCase().includes(q);
        const matchDate = (al.date || '').toLowerCase().includes(q);
        if (!matchTitle && !matchPerson && !matchDate) return false;
      }

      return true;
    });
  }, [alerts, filterMode, searchQuery]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', margin: '20px 0 60px 0' }}>
      {/* Toast d'action rapide */}
      {actionFeedback && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '24px',
            zIndex: 99999,
            backgroundColor: '#0F273A',
            color: '#FFFFFF',
            borderRadius: '12px',
            padding: '12px 20px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
            fontSize: '13px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            border: '1.5px solid #00C875',
          }}
        >
          <CheckCircle2 size={16} color="#00C875" />
          <span>{actionFeedback}</span>
        </div>
      )}

      {/* En-tête de section */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1B4565 0%, #0F273A 100%)',
          borderRadius: '16px',
          padding: '24px 28px',
          color: '#FFFFFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          boxShadow: '0 8px 24px rgba(15, 39, 58, 0.15)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                backgroundColor: '#F7AC37',
                color: '#1B4565',
                padding: '4px 10px',
                borderRadius: '8px',
                fontSize: '11px',
                fontWeight: 900,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Communication Directe
            </span>
            <span style={{ fontSize: '12px', color: '#9FBBD0', fontWeight: 600 }}>
              Tableau Monday 5044808167
            </span>
          </div>
          <h2
            style={{
              margin: '8px 0 4px 0',
              fontSize: '22px',
              fontWeight: 900,
              fontFamily: "'Ruda', sans-serif",
              letterSpacing: '-0.3px',
            }}
          >
            📢 Échanges &amp; Alertes : Atelier ↔ Responsables de Secteur
          </h2>
          <p style={{ margin: 0, fontSize: '13.5px', color: '#C6DDEE', maxWidth: '780px', lineHeight: 1.4 }}>
            Recevez instantanément les signalements des animatrices (Natacha THOMAS, Ketty PAULIN, Émilie TOBIE) et
            envoyez vos consignes techniques directement sur leurs Hubs.
          </p>
        </div>

        {/* Compteurs / badges rapides */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              backgroundColor: unreadIncomingCount > 0 ? '#E2445C' : 'rgba(255,255,255,0.12)',
              borderRadius: '12px',
              padding: '10px 18px',
              textAlign: 'center',
              border: unreadIncomingCount > 0 ? '2px solid #FF8093' : '1px solid rgba(255,255,255,0.2)',
            }}
          >
            <div style={{ fontSize: '20px', fontWeight: 900, color: '#FFFFFF' }}>{unreadIncomingCount}</div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#FFFFFF', textTransform: 'uppercase' }}>
              À Traiter
            </div>
          </div>
          <div
            style={{
              backgroundColor: 'rgba(255,255,255,0.1)',
              borderRadius: '12px',
              padding: '10px 18px',
              textAlign: 'center',
              border: '1px solid rgba(255,255,255,0.15)',
            }}
          >
            <div style={{ fontSize: '20px', fontWeight: 900, color: '#FFFFFF' }}>{alerts.length}</div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#C6DDEE', textTransform: 'uppercase' }}>
              Total Échanges
            </div>
          </div>
        </div>
      </div>

      {/* Formulaire d'envoi direct d'une alerte */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1.5px solid #F7AC37',
          padding: '20px 24px',
          boxShadow: '0 4px 18px rgba(247, 172, 55, 0.12)',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: '#FFF8EC',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid #F7AC37',
              }}
            >
              <Send size={16} color="#D66927" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#1B4565' }}>
                Transmettre une consigne ou une alerte vers une Responsable de Secteur
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748B' }}>
                Le message apparaîtra en temps réel dans le Hub de l'animatrice sélectionnée
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={async () => {
              setIsRefreshing(true);
              await onRefresh();
              setIsRefreshing(false);
              showFeedback('Échanges actualisés depuis Monday');
            }}
            disabled={isRefreshing}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
              backgroundColor: '#F8FAFC',
              fontSize: '12px',
              fontWeight: 700,
              color: '#1B4565',
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
            <span>Actualiser</span>
          </button>
        </div>

        {/* Sélection destinataire et contexte */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#1B4565', marginBottom: '5px', textTransform: 'uppercase' }}>
              Responsable de Secteur Destinataire <span style={{ color: '#E2445C' }}>*</span>
            </label>
            <ResponsableSelect
              value={recipient}
              onChange={setRecipient}
              accentColor="#F7AC37"
              fullWidth={true}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#1B4565', marginBottom: '5px', textTransform: 'uppercase' }}>
              Machine ou Chantier concerné (optionnel)
            </label>
            <AlertContextSelect
              machines={machines}
              value={machineContext}
              onChange={setMachineContext}
              getCol={getCol}
              placeholder="Sélectionner une machine ou un chantier..."
              accentColor="#F7AC37"
            />
          </div>
        </div>

        {/* Saisie message */}
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#1B4565', marginBottom: '5px', textTransform: 'uppercase' }}>
            Message / Consigne technique <span style={{ color: '#E2445C' }}>*</span>
          </label>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input
              id="atelier-alert-message-input"
              type="text"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ex : Autolaveuse révisée disponible à l'atelier, prévoir récupération... / Bavette commandée..."
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1.5px solid #F7AC37',
                fontSize: '13px',
                color: '#1B4565',
                outline: 'none',
              }}
            />

            <button
              type="button"
              disabled={isSending || !messageText.trim()}
              onClick={handleSend}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '0 20px',
                borderRadius: '10px',
                border: 'none',
                backgroundColor: '#D66927',
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: 800,
                cursor: isSending || !messageText.trim() ? 'not-allowed' : 'pointer',
                opacity: isSending || !messageText.trim() ? 0.6 : 1,
                boxShadow: '0 3px 10px rgba(214, 105, 39, 0.3)',
                whiteSpace: 'nowrap',
              }}
            >
              <Send size={15} />
              <span>{isSending ? 'Transmission...' : 'Envoyer'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Liste et historique des alertes */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #E2EEF5',
          padding: '20px 24px',
          boxShadow: '0 4px 14px rgba(27, 69, 101, 0.04)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        {/* Barre de filtres et recherche */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          {/* Onglets de filtres */}
          <div style={{ display: 'flex', gap: '6px', backgroundColor: '#F1F5F9', padding: '4px', borderRadius: '10px' }}>
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: filterMode === 'all' ? '#FFFFFF' : 'transparent',
                color: filterMode === 'all' ? '#1B4565' : '#64748B',
                fontWeight: filterMode === 'all' ? 800 : 600,
                fontSize: '12px',
                cursor: 'pointer',
                boxShadow: filterMode === 'all' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              Toutes ({alerts.length})
            </button>

            <button
              type="button"
              onClick={() => setFilterMode('unread')}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: filterMode === 'unread' ? '#FFFFFF' : 'transparent',
                color: filterMode === 'unread' ? '#D66927' : '#64748B',
                fontWeight: filterMode === 'unread' ? 800 : 600,
                fontSize: '12px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                boxShadow: filterMode === 'unread' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              <span>À traiter</span>
              {unreadIncomingCount > 0 && (
                <span
                  style={{
                    backgroundColor: '#E2445C',
                    color: '#FFFFFF',
                    borderRadius: '10px',
                    padding: '1px 6px',
                    fontSize: '10px',
                    fontWeight: 900,
                  }}
                >
                  {unreadIncomingCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setFilterMode('incoming')}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: filterMode === 'incoming' ? '#FFFFFF' : 'transparent',
                color: filterMode === 'incoming' ? '#1B4565' : '#64748B',
                fontWeight: filterMode === 'incoming' ? 800 : 600,
                fontSize: '12px',
                cursor: 'pointer',
                boxShadow: filterMode === 'incoming' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              Reçues (Secteur ➔ Atelier)
            </button>

            <button
              type="button"
              onClick={() => setFilterMode('outgoing')}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: filterMode === 'outgoing' ? '#FFFFFF' : 'transparent',
                color: filterMode === 'outgoing' ? '#1B4565' : '#64748B',
                fontWeight: filterMode === 'outgoing' ? 800 : 600,
                fontSize: '12px',
                cursor: 'pointer',
                boxShadow: filterMode === 'outgoing' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              Envoyées vers Secteur
            </button>
          </div>

          {/* Recherche */}
          <div style={{ position: 'relative', width: '240px' }}>
            <Search size={14} color="#94A3B8" style={{ position: 'absolute', left: '10px', top: '10px' }} />
            <input
              type="text"
              placeholder="Rechercher un message..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '7px 10px 7px 30px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                fontSize: '12px',
                outline: 'none',
              }}
            />
          </div>
        </div>

        {/* Liste des alertes */}
        {filteredAlerts.length === 0 ? (
          <div
            style={{
              padding: '40px 20px',
              textAlign: 'center',
              backgroundColor: '#F8FAFC',
              borderRadius: '12px',
              border: '1px dashed #CBD5E1',
            }}
          >
            <MessageSquare size={32} color="#94A3B8" style={{ margin: '0 auto 10px auto' }} />
            <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#475569' }}>
              Aucune alerte trouvée
            </h4>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94A3B8' }}>
              {searchQuery ? 'Modifiez votre terme de recherche.' : 'Tous les échanges sont à jour.'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filteredAlerts.map((al) => {
              const isIncoming = al.direction === 'to_atelier';
              const isUnread = !al.seen && isIncoming;

              return (
                <div
                  key={al.id}
                  style={{
                    padding: '14px 18px',
                    borderRadius: '12px',
                    border: isUnread ? '1.5px solid #F7AC37' : '1px solid #E2EEF5',
                    borderLeft: isUnread
                      ? '5px solid #E2445C'
                      : isIncoming
                      ? '5px solid #39A9DC'
                      : '5px solid #00C875',
                    backgroundColor: isUnread ? '#FFFDF8' : '#FFFFFF',
                    boxShadow: isUnread ? '0 4px 12px rgba(247, 172, 55, 0.15)' : '0 2px 6px rgba(0,0,0,0.02)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '14px',
                    flexWrap: 'wrap',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ flex: 1, minWidth: '280px' }}>
                    {/* Badges d'information */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 800,
                          padding: '3px 8px',
                          borderRadius: '6px',
                          backgroundColor: isIncoming ? '#EBF6FC' : '#E6F9F1',
                          color: isIncoming ? '#0284C7' : '#059669',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        {isIncoming ? (
                          <>⬅️ Signalement de {al.person || 'Responsable de Secteur'}</>
                        ) : (
                          <>➡️ Envoyé à {al.person || 'Secteur'}</>
                        )}
                      </span>

                      {al.date && (
                        <span style={{ fontSize: '11px', color: '#64748B', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={11} /> {al.date}
                        </span>
                      )}

                      {isUnread ? (
                        <span
                          style={{
                            fontSize: '10.5px',
                            fontWeight: 900,
                            padding: '2px 7px',
                            borderRadius: '10px',
                            backgroundColor: '#FEE2E2',
                            color: '#DC2626',
                          }}
                        >
                          ● Non lu
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: '10.5px',
                            fontWeight: 700,
                            color: '#059669',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                          }}
                        >
                          <Check size={12} strokeWidth={3} /> Vu
                        </span>
                      )}
                    </div>

                    {/* Titre / Message */}
                    <div
                      style={{
                        fontSize: '13.5px',
                        fontWeight: isUnread ? 800 : 600,
                        color: '#1B4565',
                        lineHeight: 1.45,
                      }}
                    >
                      {al.title}
                    </div>
                  </div>

                  {/* Actions rapides */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    {isIncoming && (
                      <button
                        type="button"
                        onClick={() => handleReplyTo(al)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '6px 12px',
                          borderRadius: '8px',
                          border: '1px solid #CBD5E1',
                          backgroundColor: '#FFFFFF',
                          color: '#1B4565',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                        title="Répondre directement à ce message"
                      >
                        <Reply size={13} />
                        <span>Répondre</span>
                      </button>
                    )}

                    {isUnread && (
                      <button
                        type="button"
                        onClick={async () => {
                          await onMarkSeen(al.id);
                          showFeedback('Alerte marquée comme lue');
                          await onRefresh();
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '6px 12px',
                          borderRadius: '8px',
                          border: '1px solid #10B981',
                          backgroundColor: '#ECFDF5',
                          color: '#047857',
                          fontSize: '12px',
                          fontWeight: 800,
                          cursor: 'pointer',
                        }}
                      >
                        <Check size={13} strokeWidth={3} />
                        <span>Marquer Vu</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={async () => {
                        const res = await onArchive(al.id);
                        showFeedback('Message archivé');
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '6px 10px',
                        borderRadius: '8px',
                        border: '1px solid #FECACA',
                        backgroundColor: '#FEF2F2',
                        color: '#B91C1C',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                      title="Archiver ce message sur Monday"
                    >
                      <Trash2 size={13} />
                      <span>Archiver</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
