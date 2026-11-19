import React, { useState, useMemo, useRef } from 'react';
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
  Check,
  RefreshCw,
  Sparkles,
  ArrowDownLeft,
  ArrowUpRight,
  Filter,
  CheckCheck,
  Camera,
  Paperclip,
  Image as ImageIcon,
  ExternalLink,
  X,
  Maximize2,
  Download,
} from 'lucide-react';
import type { Machine } from '../types';
import type { MaintenanceAlertMessage, MaintenanceAlertFile } from '../services/maintenanceApi';
import { AlertContextSelect } from './MachineSelect';
import { ResponsableSelect } from './ResponsableSelect';

interface SelectedFile {
  id: string;
  file: File;
  previewUrl: string | null;
  isImage: boolean;
}

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
    files?: File[];
    file?: File;
  }) => Promise<{ success: boolean; error?: string }>;
  getCol: (item: any, colId: string) => string;
}

// Suggestions rapides de messages pour Christophe (gain de temps en 1 clic)
const QUICK_SUGGESTIONS = [
  '🔧 Machine révisée et disponible à l’atelier, prévoir récupération.',
  '⚠️ Câble électrique ou bavette à remplacer sur site.',
  '📦 Pièce détachée commandée, intervention planifiée sous peu.',
  '📋 Machine conforme après contrôle, remise en service validée.',
  '❓ Merci de préciser l’anomalie constatée sur le matériel.',
];

// Helper pour extraire les initiales et la couleur de l'avatar
const getPersonAvatar = (personName: string) => {
  const p = (personName || '').toLowerCase();
  if (p.includes('natacha')) {
    return { initials: 'NT', bg: '#FCE7F3', text: '#BE185D', border: '#FBCFE8' };
  }
  if (p.includes('ketty')) {
    return { initials: 'KP', bg: '#EDE9FE', text: '#6D28D9', border: '#DDD6FE' };
  }
  if (p.includes('emilie') || p.includes('émilie')) {
    return { initials: 'ET', bg: '#FEF3C7', text: '#B45309', border: '#FDE68A' };
  }
  return { initials: 'CH', bg: '#E0F2FE', text: '#0369A1', border: '#BAE6FD' };
};

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

  // Gestion des pièces jointes / photos (colonne file_mm98hfng)
  const [attachedFiles, setAttachedFiles] = useState<SelectedFile[]>([]);
  const [lightboxImage, setLightboxImage] = useState<{ url: string; name: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const showFeedback = (msg: string) => {
    setActionFeedback(msg);
    setTimeout(() => setActionFeedback(null), 3500);
  };

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const newSelected: SelectedFile[] = Array.from(fileList).map((f) => {
      const isImg = f.type.startsWith('image/');
      return {
        id: `${f.name}-${f.size}-${Date.now()}-${Math.random()}`,
        file: f,
        previewUrl: isImg ? URL.createObjectURL(f) : null,
        isImage: isImg,
      };
    });
    setAttachedFiles((prev) => [...prev, ...newSelected]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveFile = (id: string) => {
    setAttachedFiles((prev) => {
      const toRemove = prev.find((f) => f.id === id);
      if (toRemove?.previewUrl) URL.revokeObjectURL(toRemove.previewUrl);
      return prev.filter((f) => f.id !== id);
    });
  };

  const handleSend = async () => {
    if (!messageText.trim()) return;
    setIsSending(true);
    const res = await onSendAlert({
      recipientPerson: recipient,
      machineName: machineContext.trim() || undefined,
      message: messageText.trim(),
      senderName: 'Christophe (Atelier)',
      files: attachedFiles.map((f) => f.file),
    });
    setIsSending(false);

    if (res.success) {
      setMessageText('');
      setMachineContext('');
      attachedFiles.forEach((f) => {
        if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
      });
      setAttachedFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      showFeedback(`✓ Message transmis en direct au Hub de ${recipient} !`);
      await onRefresh();
    } else {
      alert(`Erreur d'envoi de l'alerte : ${res.error || 'Erreur inconnue'}`);
    }
  };

  const handleReplyTo = (alert: MaintenanceAlertMessage) => {
    const isIncoming = alert.direction === 'to_atelier';
    const targetRecipient = isIncoming ? (alert.sender || alert.person) : (alert.recipient || alert.person);
    if (targetRecipient) {
      setRecipient(targetRecipient);
    }
    if (alert.context) {
      setMachineContext(alert.context);
    } else {
      const match = alert.title.match(/\[(.*?)\]/);
      if (match && match[1]) {
        setMachineContext(match[1]);
      }
    }
    const inputEl = document.getElementById('atelier-alert-message-input');
    if (inputEl) {
      inputEl.focus();
      inputEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
        const matchTitle = (al.message || al.title).toLowerCase().includes(q);
        const matchPerson = (al.sender || al.recipient || al.person || '').toLowerCase().includes(q);
        const matchContext = (al.context || '').toLowerCase().includes(q);
        const matchDate = (al.date || '').toLowerCase().includes(q);
        if (!matchTitle && !matchPerson && !matchContext && !matchDate) return false;
      }

      return true;
    });
  }, [alerts, filterMode, searchQuery]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px', margin: '20px 0 60px 0' }}>
      {/* Toast de confirmation temporaire */}
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
            boxShadow: '0 12px 36px rgba(15, 39, 58, 0.3)',
            fontSize: '13px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            border: '1.5px solid #00C875',
            animation: 'fadeIn 0.2s ease-out',
          }}
        >
          <CheckCircle2 size={18} color="#00C875" />
          <span>{actionFeedback}</span>
        </div>
      )}

      {/* ============================================================== */}
      {/* 1. EN-TÊTE ÉLÉGANT & LUMINEUX (DESIGN CORPORATE FACILITY)       */}
      {/* ============================================================== */}
      <div
        style={{
          background: 'linear-gradient(135deg, #FFFFFF 0%, #F5F9FD 100%)',
          borderRadius: '18px',
          padding: '24px 28px',
          border: '1.5px solid #D8E7F2',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '20px',
          boxShadow: '0 4px 18px rgba(27, 69, 101, 0.05)',
        }}
      >
        <div style={{ maxWidth: '640px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: '#EBF6FC',
                color: '#0284C7',
                padding: '4px 12px',
                borderRadius: '20px',
                fontSize: '11.5px',
                fontWeight: 800,
                border: '1px solid #BAE6FD',
              }}
            >
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#0284C7' }} />
              Communication Directe Monday
            </span>
            <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>
              Tableau 5044808167
            </span>
          </div>

          <h2
            style={{
              margin: '0 0 6px 0',
              fontSize: '22px',
              fontWeight: 900,
              fontFamily: "'Ruda', sans-serif",
              color: '#1B4565',
              letterSpacing: '-0.3px',
            }}
          >
            📢 Échanges &amp; Alertes : Atelier ↔ Responsables de Secteur
          </h2>

          <p style={{ margin: 0, fontSize: '13px', color: '#57778E', lineHeight: 1.45 }}>
            Recevez les alertes et besoins matériel transmis par <strong>Natacha THOMAS</strong>, <strong>Ketty PAULIN</strong> et <strong>Émilie TOBIE</strong>, et répondez-leur en un clic.
          </p>
        </div>

        {/* Cartes KPI visuelles */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Carte À Traiter */}
          <div
            style={{
              backgroundColor: unreadIncomingCount > 0 ? '#FFF1F2' : '#FFFFFF',
              borderRadius: '14px',
              padding: '12px 22px',
              textAlign: 'center',
              border: unreadIncomingCount > 0 ? '2px solid #FECDD3' : '1px solid #E2EEF5',
              boxShadow: unreadIncomingCount > 0 ? '0 4px 14px rgba(225, 29, 72, 0.12)' : '0 2px 8px rgba(0,0,0,0.03)',
              minWidth: '105px',
            }}
          >
            <div
              style={{
                fontSize: '24px',
                fontWeight: 900,
                color: unreadIncomingCount > 0 ? '#E11D48' : '#1B4565',
                lineHeight: 1,
              }}
            >
              {unreadIncomingCount}
            </div>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 800,
                color: unreadIncomingCount > 0 ? '#BE123C' : '#64748B',
                textTransform: 'uppercase',
                letterSpacing: '0.4px',
                marginTop: '4px',
              }}
            >
              À Traiter
            </div>
          </div>

          {/* Carte Total Échanges */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '14px',
              padding: '12px 22px',
              textAlign: 'center',
              border: '1px solid #E2EEF5',
              boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
              minWidth: '105px',
            }}
          >
            <div style={{ fontSize: '24px', fontWeight: 900, color: '#39A9DC', lineHeight: 1 }}>
              {alerts.length}
            </div>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 800,
                color: '#64748B',
                textTransform: 'uppercase',
                letterSpacing: '0.4px',
                marginTop: '4px',
              }}
            >
              Total Échanges
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2. FORMULAIRE D'ENVOI D'UNE ALERTE (DESIGN ÉPURÉ & MODERNE)     */}
      {/* ============================================================== */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '18px',
          border: '1.5px solid #E2EEF5',
          padding: '22px 26px',
          boxShadow: '0 6px 20px rgba(27, 69, 101, 0.04)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Accent gradient supérieur */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: 'linear-gradient(90deg, #39A9DC 0%, #F7AC37 100%)',
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                backgroundColor: '#EFF6FF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#0073EA',
                border: '1px solid #BFDBFE',
              }}
            >
              <Send size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#1B4565' }}>
                Transmettre une consigne ou alerte vers une Responsable de Secteur
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748B' }}>
                Le message est enregistré sur Monday et s'affiche instantanément dans le Hub de l'animatrice
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={async () => {
              setIsRefreshing(true);
              await onRefresh();
              setIsRefreshing(false);
              showFeedback('Échanges actualisés');
            }}
            disabled={isRefreshing}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '9px',
              border: '1px solid #CBD5E1',
              backgroundColor: '#F8FAFC',
              fontSize: '12px',
              fontWeight: 700,
              color: '#334155',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
            <span>Actualiser</span>
          </button>
        </div>

        {/* Grille : Destinataire & Contexte */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px', marginBottom: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#334155', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              Responsable de Secteur Destinataire <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <ResponsableSelect
              value={recipient}
              onChange={setRecipient}
              accentColor="#0073EA"
              fullWidth={true}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#334155', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              Machine ou Chantier concerné (optionnel)
            </label>
            <AlertContextSelect
              machines={machines}
              value={machineContext}
              onChange={setMachineContext}
              getCol={getCol}
              placeholder="Sélectionner une machine ou un chantier..."
              accentColor="#0073EA"
            />
          </div>
        </div>

        {/* Suggestions rapides en 1 clic */}
        <div style={{ marginBottom: '12px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', display: 'inline-flex', alignItems: 'center', gap: '4px', marginBottom: '6px' }}>
            <Sparkles size={12} color="#F59E0B" /> Exemples rapides (cliquer pour insérer) :
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {QUICK_SUGGESTIONS.map((sug, idx) => (
              <button
                type="button"
                key={idx}
                onClick={() => setMessageText(sug)}
                style={{
                  fontSize: '11.5px',
                  padding: '4px 10px',
                  borderRadius: '8px',
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  color: '#475569',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#EFF6FF';
                  e.currentTarget.style.borderColor = '#BFDBFE';
                  e.currentTarget.style.color = '#1D4ED8';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#F8FAFC';
                  e.currentTarget.style.borderColor = '#E2E8F0';
                  e.currentTarget.style.color = '#475569';
                }}
              >
                {sug}
              </button>
            ))}
          </div>
        </div>

        {/* Champ de saisie et bouton d'envoi */}
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#334155', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            Message / Consigne <span style={{ color: '#EF4444' }}>*</span>
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
              placeholder="Rédigez votre message ou consigne technique..."
              style={{
                flex: 1,
                padding: '11px 16px',
                borderRadius: '10px',
                border: '1.5px solid #CBD5E1',
                fontSize: '13px',
                color: '#1E293B',
                outline: 'none',
                backgroundColor: '#FFFFFF',
                transition: 'border-color 0.15s',
              }}
              onFocus={(e) => (e.target.style.borderColor = '#0073EA')}
              onBlur={(e) => (e.target.style.borderColor = '#CBD5E1')}
            />

            <button
              type="button"
              disabled={isSending || !messageText.trim()}
              onClick={handleSend}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '0 24px',
                borderRadius: '10px',
                border: 'none',
                backgroundColor: '#0073EA',
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: 700,
                cursor: isSending || !messageText.trim() ? 'not-allowed' : 'pointer',
                opacity: isSending || !messageText.trim() ? 0.6 : 1,
                boxShadow: '0 4px 12px rgba(0, 115, 234, 0.25)',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              <Send size={15} />
              <span>{isSending ? 'Transmission...' : 'Envoyer l’alerte'}</span>
            </button>
          </div>

          {/* Bouton Pièce jointe / Photos (multiples) & Aperçu */}
          <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                style={{ display: 'none' }}
                onChange={handleFilesSelected}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: '1px dashed #CBD5E1',
                  backgroundColor: '#F8FAFC',
                  color: '#475569',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#EFF6FF';
                  e.currentTarget.style.borderColor = '#93C5FD';
                  e.currentTarget.style.color = '#1D4ED8';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#F8FAFC';
                  e.currentTarget.style.borderColor = '#CBD5E1';
                  e.currentTarget.style.color = '#475569';
                }}
              >
                <Camera size={14} />
                <span>
                  {attachedFiles.length > 0
                    ? `📷 Ajouter d'autres photos/fichiers (${attachedFiles.length} sélectionné${attachedFiles.length > 1 ? 's' : ''})`
                    : '📷 Ajouter des photos ou des fichiers (1 ou plusieurs)'}
                </span>
              </button>
            </div>

            {attachedFiles.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {attachedFiles.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '4px 10px',
                      borderRadius: '8px',
                      backgroundColor: '#EFF6FF',
                      border: '1px solid #BFDBFE',
                      fontSize: '12px',
                      color: '#1E40AF',
                    }}
                  >
                    {item.isImage && item.previewUrl ? (
                      <img
                        src={item.previewUrl}
                        alt="Aperçu"
                        style={{ width: '24px', height: '24px', borderRadius: '4px', objectFit: 'cover' }}
                      />
                    ) : (
                      <Paperclip size={14} />
                    )}
                    <span style={{ fontWeight: 600, maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.file.name}
                    </span>
                    <span style={{ fontSize: '10px', color: '#6B7280' }}>
                      ({Math.round(item.file.size / 1024)} ko)
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveFile(item.id)}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        padding: '2px',
                        color: '#EF4444',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                      title="Retirer ce fichier"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 3. LISTE ET HISTORIQUE DES MESSAGES (DESIGN CARTE ÉLÉGANT)     */}
      {/* ============================================================== */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '18px',
          border: '1.5px solid #E2EEF5',
          padding: '22px 26px',
          boxShadow: '0 4px 18px rgba(27, 69, 101, 0.03)',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
        }}
      >
        {/* Barre d'onglets de filtre et recherche */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
          {/* Segmented Control moderne */}
          <div
            style={{
              display: 'flex',
              gap: '4px',
              backgroundColor: '#F1F5F9',
              padding: '4px',
              borderRadius: '12px',
            }}
          >
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              style={{
                padding: '7px 16px',
                borderRadius: '9px',
                border: 'none',
                backgroundColor: filterMode === 'all' ? '#FFFFFF' : 'transparent',
                color: filterMode === 'all' ? '#0F172A' : '#64748B',
                fontWeight: filterMode === 'all' ? 800 : 600,
                fontSize: '12.5px',
                cursor: 'pointer',
                boxShadow: filterMode === 'all' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              Toutes ({alerts.length})
            </button>

            <button
              type="button"
              onClick={() => setFilterMode('unread')}
              style={{
                padding: '7px 16px',
                borderRadius: '9px',
                border: 'none',
                backgroundColor: filterMode === 'unread' ? '#FFFFFF' : 'transparent',
                color: filterMode === 'unread' ? '#E11D48' : '#64748B',
                fontWeight: filterMode === 'unread' ? 800 : 600,
                fontSize: '12.5px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: filterMode === 'unread' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              <span>À traiter</span>
              {unreadIncomingCount > 0 && (
                <span
                  style={{
                    backgroundColor: '#E11D48',
                    color: '#FFFFFF',
                    borderRadius: '10px',
                    padding: '1px 7px',
                    fontSize: '10.5px',
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
                padding: '7px 16px',
                borderRadius: '9px',
                border: 'none',
                backgroundColor: filterMode === 'incoming' ? '#FFFFFF' : 'transparent',
                color: filterMode === 'incoming' ? '#0F172A' : '#64748B',
                fontWeight: filterMode === 'incoming' ? 800 : 600,
                fontSize: '12.5px',
                cursor: 'pointer',
                boxShadow: filterMode === 'incoming' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              Reçues du Secteur
            </button>

            <button
              type="button"
              onClick={() => setFilterMode('outgoing')}
              style={{
                padding: '7px 16px',
                borderRadius: '9px',
                border: 'none',
                backgroundColor: filterMode === 'outgoing' ? '#FFFFFF' : 'transparent',
                color: filterMode === 'outgoing' ? '#0F172A' : '#64748B',
                fontWeight: filterMode === 'outgoing' ? 800 : 600,
                fontSize: '12.5px',
                cursor: 'pointer',
                boxShadow: filterMode === 'outgoing' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              Envoyées par l’Atelier
            </button>
          </div>

          {/* Recherche */}
          <div style={{ position: 'relative', width: '260px' }}>
            <Search size={15} color="#94A3B8" style={{ position: 'absolute', left: '12px', top: '10px' }} />
            <input
              type="text"
              placeholder="Rechercher par animatrice, mot..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 34px',
                borderRadius: '10px',
                border: '1.5px solid #CBD5E1',
                fontSize: '12.5px',
                outline: 'none',
                backgroundColor: '#F8FAFC',
              }}
            />
          </div>
        </div>

        {/* Liste des cartes d'échanges */}
        {filteredAlerts.length === 0 ? (
          <div
            style={{
              padding: '48px 24px',
              textAlign: 'center',
              backgroundColor: '#F8FAFC',
              borderRadius: '14px',
              border: '1.5px dashed #CBD5E1',
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: '#EFF6FF',
                color: '#0073EA',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px auto',
              }}
            >
              <CheckCheck size={24} />
            </div>
            <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#1E293B' }}>
              {searchQuery ? 'Aucun message correspondant' : 'Tous les échanges sont à jour !'}
            </h4>
            <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', color: '#64748B' }}>
              {searchQuery
                ? 'Essayez avec un autre mot-clé ou réinitialisez la recherche.'
                : 'Aucune alerte non lue ni signalement en attente de traitement.'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filteredAlerts.map((al) => {
              const isIncoming = al.direction === 'to_atelier';
              const isUnread = !al.seen && isIncoming;
              const senderDisplayName = al.sender || (isIncoming ? al.person : 'Christophe (Atelier)');
              const recipientDisplayName = al.recipient || (isIncoming ? 'Christophe (Atelier)' : al.person);
              const avatarPerson = isIncoming ? senderDisplayName : recipientDisplayName;
              const avatar = getPersonAvatar(avatarPerson);
              const messageText = al.message || al.title;

              return (
                <div
                  key={al.id}
                  style={{
                    padding: '14px 18px',
                    borderRadius: '14px',
                    border: isUnread ? '1.5px solid #FECDD3' : '1px solid #E2E8F0',
                    borderLeft: isUnread
                      ? '5px solid #E11D48'
                      : isIncoming
                      ? '5px solid #0073EA'
                      : '5px solid #00C875',
                    backgroundColor: isUnread ? '#FFFDF8' : '#FFFFFF',
                    boxShadow: isUnread
                      ? '0 4px 14px rgba(225, 29, 72, 0.08)'
                      : '0 2px 6px rgba(0, 0, 0, 0.02)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '16px',
                    flexWrap: 'wrap',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {/* Partie gauche : Avatar + Contenu */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: '300px' }}>
                    {/* Avatar Initiale Dynamique */}
                    <div
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '50%',
                        backgroundColor: avatar.bg,
                        color: avatar.text,
                        border: `1.5px solid ${avatar.border}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 900,
                        fontSize: '13.5px',
                        flexShrink: 0,
                        boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                      }}
                      title={isIncoming ? `Expéditeur: ${senderDisplayName}` : `Destinataire: ${recipientDisplayName}`}
                    >
                      {avatar.initials}
                    </div>

                    <div style={{ minWidth: 0, flex: 1 }}>
                      {/* Meta badges ultra propres */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 800,
                            padding: '2.5px 9px',
                            borderRadius: '6px',
                            backgroundColor: isIncoming ? '#EFF6FF' : '#ECFDF5',
                            color: isIncoming ? '#1D4ED8' : '#047857',
                            border: isIncoming ? '1px solid #BFDBFE' : '1px solid #A7F3D0',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          {isIncoming ? (
                            <>
                              <ArrowDownLeft size={12} /> Reçue de <strong>{senderDisplayName}</strong>
                            </>
                          ) : (
                            <>
                              <ArrowUpRight size={12} /> Envoyée à <strong>{recipientDisplayName}</strong>
                            </>
                          )}
                        </span>

                        {/* Badge Contexte / Chantier */}
                        {al.context && (
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: '6px',
                              backgroundColor: '#F1F5F9',
                              color: '#334155',
                              border: '1px solid #CBD5E1',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              maxWidth: '320px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title={`Chantier / Machine: ${al.context}`}
                          >
                            <Wrench size={11} color="#0073EA" /> {al.context}
                          </span>
                        )}

                        {al.date && (
                          <span style={{ fontSize: '11px', color: '#64748B', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <Clock size={11} /> {al.date}
                          </span>
                        )}

                        {isUnread ? (
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 900,
                              padding: '2px 7px',
                              borderRadius: '12px',
                              backgroundColor: '#FFE4E6',
                              color: '#E11D48',
                              letterSpacing: '0.3px',
                              textTransform: 'uppercase',
                            }}
                          >
                            ● Nouveau
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              color: '#10B981',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                            }}
                          >
                            <Check size={12} strokeWidth={3} /> Vu
                          </span>
                        )}
                      </div>

                      {/* Corps du message propre et lisible */}
                      <div
                        style={{
                          fontSize: '13.5px',
                          fontWeight: isUnread ? 800 : 600,
                          color: '#0F172A',
                          lineHeight: 1.5,
                          wordBreak: 'break-word',
                        }}
                      >
                        {messageText}
                      </div>

                      {/* Photos et pièces jointes (multiples) */}
                      {(() => {
                        const allFiles: MaintenanceAlertFile[] =
                          al.files && al.files.length > 0
                            ? al.files
                            : al.fileUrl
                            ? [
                                {
                                  url: al.fileUrl,
                                  name: al.fileName || 'Photo jointe',
                                  isImage: Boolean(al.isImage),
                                },
                              ]
                            : [];

                        if (allFiles.length === 0) return null;

                        return (
                          <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {allFiles.map((file, fIdx) =>
                              file.isImage ? (
                                <button
                                  key={fIdx}
                                  type="button"
                                  onClick={() => setLightboxImage({ url: file.url, name: file.name })}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '5px 10px',
                                    borderRadius: '8px',
                                    backgroundColor: '#F8FAFC',
                                    border: '1px solid #E2E8F0',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    transition: 'all 0.15s ease',
                                  }}
                                  title="Cliquer pour afficher la photo en grand sans télécharger"
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = '#EFF6FF';
                                    e.currentTarget.style.borderColor = '#BFDBFE';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = '#F8FAFC';
                                    e.currentTarget.style.borderColor = '#E2E8F0';
                                  }}
                                >
                                  <img
                                    src={file.url}
                                    alt={file.name}
                                    style={{
                                      width: '38px',
                                      height: '38px',
                                      borderRadius: '6px',
                                      objectFit: 'cover',
                                      border: '1px solid #CBD5E1',
                                      flexShrink: 0,
                                    }}
                                  />
                                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#1E293B', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                      <ImageIcon size={12} color="#0073EA" /> {file.name}
                                    </span>
                                    <span style={{ fontSize: '10.5px', color: '#0073EA', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                      <Maximize2 size={10} /> Agrandir
                                    </span>
                                  </div>
                                </button>
                              ) : (
                                <a
                                  key={fIdx}
                                  href={file.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '5px 10px',
                                    borderRadius: '8px',
                                    backgroundColor: '#F1F5F9',
                                    border: '1px solid #CBD5E1',
                                    color: '#1E293B',
                                    fontSize: '11.5px',
                                    fontWeight: 700,
                                    textDecoration: 'none',
                                  }}
                                >
                                  <Paperclip size={13} color="#0073EA" />
                                  <span>{file.name}</span>
                                  <ExternalLink size={11} color="#64748B" />
                                </a>
                              )
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Partie droite : Boutons d'action rapides */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    {isIncoming && (
                      <button
                        type="button"
                        onClick={() => handleReplyTo(al)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '7px 12px',
                          borderRadius: '8px',
                          border: '1px solid #CBD5E1',
                          backgroundColor: '#FFFFFF',
                          color: '#1E293B',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                        }}
                        title="Répondre directement à ce message"
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F1F5F9')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#FFFFFF')}
                      >
                        <Reply size={13} color="#0073EA" />
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
                          padding: '7px 14px',
                          borderRadius: '8px',
                          border: '1px solid #10B981',
                          backgroundColor: '#ECFDF5',
                          color: '#047857',
                          fontSize: '12px',
                          fontWeight: 800,
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                        }}
                      >
                        <Check size={13} strokeWidth={3} />
                        <span>Marquer Vu</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={async () => {
                        await onArchive(al.id);
                        showFeedback('Message archivé');
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '7px 10px',
                        borderRadius: '8px',
                        border: '1px solid #FECACA',
                        backgroundColor: '#FEF2F2',
                        color: '#B91C1C',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.15s',
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

      {/* Modal Visionneuse Photo Plein Écran (Lightbox in-app sans téléchargement) */}
      {lightboxImage && (
        <div
          onClick={() => setLightboxImage(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999999,
            backgroundColor: 'rgba(0, 0, 0, 0.90)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            animation: 'fadeIn 0.2s ease-out',
          }}
        >
          {/* Barre d'action supérieure */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '900px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingBottom: '12px',
              color: '#FFFFFF',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <ImageIcon size={18} color="#38BDF8" />
              <span style={{ fontSize: '14px', fontWeight: 700 }}>{lightboxImage.name}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <a
                href={lightboxImage.url}
                target="_blank"
                rel="noopener noreferrer"
                download={lightboxImage.name}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(255, 255, 255, 0.15)',
                  color: '#FFFFFF',
                  fontSize: '12px',
                  fontWeight: 600,
                  textDecoration: 'none',
                  cursor: 'pointer',
                }}
              >
                <Download size={14} />
                <span>Télécharger</span>
              </a>

              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  border: 'none',
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  color: '#FFFFFF',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Fermer (ou cliquer n'importe où)"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Image grand format */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxHeight: '85vh',
              maxWidth: '95vw',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '16px',
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            }}
          >
            <img
              src={lightboxImage.url}
              alt={lightboxImage.name}
              style={{
                maxHeight: '82vh',
                maxWidth: '92vw',
                objectFit: 'contain',
                borderRadius: '12px',
              }}
            />
          </div>

          <p style={{ marginTop: '12px', fontSize: '11px', color: 'rgba(255, 255, 255, 0.6)' }}>
            Cliquez n'importe où pour fermer
          </p>
        </div>
      )}
    </div>
  );
};
