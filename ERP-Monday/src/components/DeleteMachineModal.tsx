import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, DoorOpen, Loader2, Trash2, X } from 'lucide-react';
import type { Machine } from '../types';
import { MachineSelect } from './MachineSelect';
import {
  archiveMachineFromParc,
  findMachineForTicket,
  isTicketRepaired,
  markMachineAsExited,
  type RealisedControle,
  type RepairTicket,
} from '../services/maintenanceApi';

interface DeleteMachineModalProps {
  machines: Machine[];
  repairTickets: RepairTicket[];
  realisedControles: RealisedControle[];
  getCol: (m: Machine, colId: string) => string;
  onClose: () => void;
  onSuccess: (
    machineId: string,
    machineName: string,
    archivedTicketIds: string[],
    archivedControlIds: string[],
    mode: 'exit' | 'archive',
    exitMeta?: { date: string; reason: string; author: string; comment: string }
  ) => Promise<void> | void;
}

const EXIT_REASONS = [
  'Hors service / Panne irréparable',
  'Mise au rebut / Détruite',
  'Vendue',
  'Volée / Perdue',
  'Restituée / Fin de location',
  'Remplacée par une machine neuve',
  'Autre',
] as const;

export const DeleteMachineModal: React.FC<DeleteMachineModalProps> = ({
  machines,
  repairTickets,
  realisedControles,
  getCol,
  onClose,
  onSuccess,
}) => {
  const [selectedMachineId, setSelectedMachineId] = useState<string>('');
  const [mode, setMode] = useState<'exit' | 'archive'>('exit');
  const [exitReason, setExitReason] = useState<string>(EXIT_REASONS[0]);
  const [exitDate, setExitDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [exitAuthor, setExitAuthor] = useState<string>('Christophe');
  const [exitComment, setExitComment] = useState<string>('');
  const [archiveOpenRepairs, setArchiveOpenRepairs] = useState<boolean>(true);
  const [archiveControls, setArchiveControls] = useState<boolean>(false);
  const [confirmChecked, setConfirmChecked] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const selectedMachine = useMemo(
    () => machines.find((m) => String(m.id) === String(selectedMachineId)) || null,
    [machines, selectedMachineId]
  );

  const linkedOpenRepairs = useMemo(() => {
    if (!selectedMachine) return [];
    return repairTickets.filter((t) => {
      if (isTicketRepaired(t.status, t.groupTitle)) return false;
      const matched = findMachineForTicket(t, machines);
      return matched && String(matched.id) === String(selectedMachine.id);
    });
  }, [selectedMachine, repairTickets, machines]);

  const linkedControls = useMemo(() => {
    if (!selectedMachine) return [];
    const mNameLow = selectedMachine.name.trim().toLowerCase();
    return realisedControles.filter((c) => {
      if (c.machineId && String(c.machineId) === String(selectedMachine.id)) return true;
      const cName = (c.machineName || '').trim().toLowerCase();
      return Boolean(cName && (cName === mNameLow || cName.includes(mNameLow) || mNameLow.includes(cName)));
    });
  }, [selectedMachine, realisedControles]);

  const handleConfirm = async () => {
    if (!selectedMachine || !confirmChecked || submitting) return;
    setSubmitting(true);
    setErrorMsg(null);

    const ticketIds = archiveOpenRepairs ? linkedOpenRepairs.map((t) => String(t.id)) : [];
    const controlIds = mode === 'archive' && archiveControls ? linkedControls.map((c) => String(c.id)) : [];

    if (mode === 'exit') {
      // Récupérer l'éventuelle remarque existante sur la machine
      const existingNote =
        selectedMachine.column_values?.find((c) => c.text && c.text.includes('[SORTIE|'))?.text || '';

      const res = await markMachineAsExited({
        machineId: String(selectedMachine.id),
        machineName: selectedMachine.name,
        reason: exitReason,
        exitDate,
        author: exitAuthor,
        comment: exitComment,
        existingNote,
        extraItemIdsToArchive: ticketIds,
      });

      if (!res.success) {
        setErrorMsg(res.error || 'Impossible de déclarer la sortie de cette machine sur Monday.');
        setSubmitting(false);
        return;
      }

      await onSuccess(String(selectedMachine.id), selectedMachine.name, ticketIds, [], 'exit', {
        date: exitDate,
        reason: exitReason,
        author: exitAuthor,
        comment: exitComment.trim(),
      });
      setSubmitting(false);
      onClose();
      return;
    }

    const res = await archiveMachineFromParc(String(selectedMachine.id), [...ticketIds, ...controlIds]);
    if (!res.success) {
      setErrorMsg(res.error || 'Impossible d’archiver cette machine sur Monday.');
      setSubmitting(false);
      return;
    }

    await onSuccess(String(selectedMachine.id), selectedMachine.name, ticketIds, controlIds, 'archive');
    setSubmitting(false);
    onClose();
  };

  return (
    <div
      onClick={onClose}
      className="erp-modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.58)',
        backdropFilter: 'blur(5px)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="erp-modal-sheet"
        style={{
          width: '100%',
          maxWidth: '660px',
          maxHeight: '90vh',
          overflowY: 'auto',
          backgroundColor: '#FFFFFF',
          borderRadius: '18px',
          border: mode === 'exit' ? '1.5px solid #FDE68A' : '1.5px solid #FECACA',
          boxShadow: '0 24px 60px rgba(15, 23, 42, 0.28)',
          fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            background:
              mode === 'exit'
                ? 'linear-gradient(135deg, #B45309 0%, #D97706 100%)'
                : 'linear-gradient(135deg, #B91C1C 0%, #DC2626 100%)',
            color: '#FFFFFF',
            borderTopLeftRadius: '16px',
            borderTopRightRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                backgroundColor: 'rgba(255,255,255,0.18)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {mode === 'exit' ? <DoorOpen size={18} color="#FFFFFF" /> : <Trash2 size={18} color="#FFFFFF" />}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, fontFamily: "'Ruda', sans-serif" }}>
                Sortir ou supprimer une machine du parc
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '11.5px', color: 'rgba(255,255,255,0.88)' }}>
                Conserve la traçabilité complète (date, motif, auteur) dans l’Agenda et « Machines sorties ».
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: 'rgba(255,255,255,0.18)',
              color: '#FFFFFF',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Choix du mode */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px' }}>
            <button
              type="button"
              onClick={() => {
                setMode('exit');
                setConfirmChecked(false);
              }}
              style={{
                padding: '10px 12px',
                borderRadius: '11px',
                border: mode === 'exit' ? '2px solid #D97706' : '1px solid #E2E8F0',
                backgroundColor: mode === 'exit' ? '#FFFBEB' : '#F8FAFC',
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <div style={{ fontSize: '12.5px', fontWeight: 800, color: '#92400E' }}>
                🚪 Sortir du parc (Traçabilité)
              </div>
              <div style={{ fontSize: '11px', color: '#78350F', marginTop: '2px' }}>
                Passe en « Sortie » + trace date/motif dans l’Agenda &amp; Machines sorties.
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setMode('archive');
                setConfirmChecked(false);
              }}
              style={{
                padding: '10px 12px',
                borderRadius: '11px',
                border: mode === 'archive' ? '2px solid #DC2626' : '1px solid #E2E8F0',
                backgroundColor: mode === 'archive' ? '#FEF2F2' : '#F8FAFC',
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <div style={{ fontSize: '12.5px', fontWeight: 800, color: '#991B1B' }}>
                🗑️ Archiver (doublon / test)
              </div>
              <div style={{ fontSize: '11px', color: '#7F1D1D', marginTop: '2px' }}>
                Archive la ligne sur Monday (elle disparaît complètement du Hub).
              </div>
            </button>
          </div>

          <MachineSelect
            machines={machines}
            selectedMachineId={selectedMachineId}
            onSelectMachine={(val) => {
              setSelectedMachineId(val);
              setConfirmChecked(false);
              setArchiveControls(false);
              setErrorMsg(null);
            }}
            getCol={getCol}
          />

          {selectedMachine && mode === 'exit' && (
            <div
              style={{
                borderRadius: '12px',
                border: '1px solid #D2E9F6',
                backgroundColor: '#F8FCFE',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div style={{ fontSize: '12.5px', fontWeight: 800, color: '#1B4565' }}>
                📋 Traçabilité de sortie du parc :
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#3989B7', marginBottom: '4px' }}>
                    Date de sortie
                  </label>
                  <input
                    type="date"
                    value={exitDate}
                    onChange={(e) => setExitDate(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: '1px solid #C8DCE8',
                      fontSize: '12.5px',
                      fontWeight: 700,
                      color: '#1B4565',
                      backgroundColor: '#FFFFFF',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#3989B7', marginBottom: '4px' }}>
                    Déclarée par
                  </label>
                  <input
                    type="text"
                    value={exitAuthor}
                    onChange={(e) => setExitAuthor(e.target.value)}
                    placeholder="Christophe"
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: '1px solid #C8DCE8',
                      fontSize: '12.5px',
                      fontWeight: 700,
                      color: '#1B4565',
                      backgroundColor: '#FFFFFF',
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#3989B7', marginBottom: '4px' }}>
                  Motif de sortie
                </label>
                <select
                  value={exitReason}
                  onChange={(e) => setExitReason(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: '1px solid #C8DCE8',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    color: '#1B4565',
                    backgroundColor: '#FFFFFF',
                  }}
                >
                  {EXIT_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#3989B7', marginBottom: '4px' }}>
                  Commentaire / Précisions (optionnel)
                </label>
                <textarea
                  rows={2}
                  value={exitComment}
                  onChange={(e) => setExitComment(e.target.value)}
                  placeholder="Ex : Moteur HS, devis de réparation supérieur au prix neuf..."
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: '1px solid #C8DCE8',
                    fontSize: '12.5px',
                    color: '#1B4565',
                    backgroundColor: '#FFFFFF',
                    fontFamily: 'inherit',
                  }}
                />
              </div>
            </div>
          )}

          {selectedMachine && (
            <div
              style={{
                borderRadius: '12px',
                border: '1px solid #FDE68A',
                backgroundColor: '#FFFBEB',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#92400E', fontSize: '12.5px', fontWeight: 800 }}>
                <AlertTriangle size={16} color="#D97706" />
                <span>Conséquences :</span>
              </div>
              <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: '#78350F', lineHeight: 1.5 }}>
                {mode === 'exit' ? (
                  <>
                    <li>
                      <strong>{selectedMachine.name}</strong> sortira du parc actif (Fiche de Contrôle &amp; Maintenance Préventive) et apparaîtra dans <strong>« 04 Machines sorties »</strong> + sur l’<strong>Agenda</strong> au {exitDate}.
                    </li>
                    <li>
                      Son numéro Facility pourra être réattribué à une remplaçante et l’historique de ses {linkedControls.length} contrôle(s) reste conservé.
                    </li>
                  </>
                ) : (
                  <li>
                    <strong>{selectedMachine.name}</strong> sera archivée sur Monday (récupérable dans la corbeille/archives Monday).
                  </li>
                )}
              </ul>

              {linkedOpenRepairs.length > 0 && (
                <label
                  style={{
                    marginTop: '2px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#1B4565',
                    cursor: 'pointer',
                    backgroundColor: '#FFFFFF',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: '1px solid #FCD34D',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={archiveOpenRepairs}
                    onChange={(e) => setArchiveOpenRepairs(e.target.checked)}
                    style={{ width: '15px', height: '15px', accentColor: '#D97706' }}
                  />
                  <span>Archiver ses {linkedOpenRepairs.length} ticket(s) de réparation ouverts</span>
                </label>
              )}

              {mode === 'archive' && linkedControls.length > 0 && (
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#1B4565',
                    cursor: 'pointer',
                    backgroundColor: '#FFFFFF',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: '1px solid #E2E8F0',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={archiveControls}
                    onChange={(e) => setArchiveControls(e.target.checked)}
                    style={{ width: '15px', height: '15px', accentColor: '#DC2626' }}
                  />
                  <span>Archiver aussi ses {linkedControls.length} fiche(s) de contrôle (utile pour un test)</span>
                </label>
              )}
            </div>
          )}

          {selectedMachine && (
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '12px',
                fontWeight: 700,
                color: mode === 'exit' ? '#92400E' : '#991B1B',
                cursor: 'pointer',
                padding: '9px 12px',
                borderRadius: '10px',
                backgroundColor: mode === 'exit' ? '#FFFBEB' : '#FEF2F2',
                border: mode === 'exit' ? '1px solid #FCD34D' : '1px solid #FECACA',
              }}
            >
              <input
                type="checkbox"
                checked={confirmChecked}
                onChange={(e) => setConfirmChecked(e.target.checked)}
                style={{ width: '15px', height: '15px', accentColor: mode === 'exit' ? '#D97706' : '#DC2626' }}
              />
              <span>
                {mode === 'exit'
                  ? `Je confirme déclarer « ${selectedMachine.name} » comme sortie du parc (${exitReason})`
                  : `Je confirme archiver définitivement « ${selectedMachine.name} »`}
              </span>
            </label>
          )}

          {errorMsg && (
            <div
              style={{
                padding: '10px 12px',
                borderRadius: '8px',
                backgroundColor: '#FEF2F2',
                border: '1px solid #FCA5A5',
                color: '#B91C1C',
                fontSize: '12px',
                fontWeight: 700,
              }}
            >
              {errorMsg}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 20px',
            backgroundColor: '#F8FAFC',
            borderTop: '1px solid #E2E8F0',
            borderBottomLeftRadius: '16px',
            borderBottomRightRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '10px',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            style={{
              padding: '8px 14px',
              borderRadius: '9px',
              border: '1px solid #CBD5E1',
              backgroundColor: '#FFFFFF',
              color: '#475569',
              fontSize: '12.5px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Annuler
          </button>

          <button
            type="button"
            disabled={!selectedMachine || !confirmChecked || submitting}
            onClick={handleConfirm}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              padding: '8px 16px',
              borderRadius: '9px',
              border: 'none',
              backgroundColor:
                !selectedMachine || !confirmChecked || submitting
                  ? '#CBD5E1'
                  : mode === 'exit'
                  ? '#D97706'
                  : '#DC2626',
              color: '#FFFFFF',
              fontSize: '12.5px',
              fontWeight: 800,
              cursor: !selectedMachine || !confirmChecked || submitting ? 'not-allowed' : 'pointer',
            }}
          >
            {submitting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Enregistrement...</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={14} />
                <span>{mode === 'exit' ? 'Valider la sortie du parc' : 'Archiver la machine'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
