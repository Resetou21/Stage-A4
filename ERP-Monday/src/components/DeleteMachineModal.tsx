import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Trash2, X } from 'lucide-react';
import type { Machine } from '../types';
import { FacilitySelect } from './FacilitySelect';
import {
  archiveMachineFromParc,
  findMachineForTicket,
  isTicketRepaired,
  type RepairTicket,
} from '../services/maintenanceApi';

interface DeleteMachineModalProps {
  machines: Machine[];
  repairTickets: RepairTicket[];
  onClose: () => void;
  onSuccess: (deletedMachineId: string, deletedMachineName: string, archivedTicketIds: string[]) => Promise<void> | void;
}

export const DeleteMachineModal: React.FC<DeleteMachineModalProps> = ({
  machines,
  repairTickets,
  onClose,
  onSuccess,
}) => {
  const [selectedMachineId, setSelectedMachineId] = useState<string>('');
  const [archiveOpenRepairs, setArchiveOpenRepairs] = useState<boolean>(true);
  const [confirmChecked, setConfirmChecked] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const getColText = (m: Machine, keywords: string[]) => {
    const col = m.column_values?.find((c) => {
      const t = `${c.title || ''} ${c.id || ''}`.toLowerCase();
      return keywords.some((k) => t.includes(k));
    });
    return col?.display_value || col?.text || '';
  };

  const machineOptions = useMemo(() => {
    return [...machines]
      .sort((a, b) => a.name.localeCompare(b.name, 'fr', { numeric: true, sensitivity: 'base' }))
      .map((m) => {
        const type = getColText(m, ['type', 'catégorie', 'categorie', 'famille', 'dropdown_mm8f']);
        const site = getColText(m, ['chantier', 'site', 'affectation', 'board_relation_mm8gxh6a']);
        const sub = [type, site].filter(Boolean).join(' • ');
        return {
          value: String(m.id),
          label: m.name,
          subLabel: sub || undefined,
        };
      });
  }, [machines]);

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

  const handleConfirmDelete = async () => {
    if (!selectedMachine || !confirmChecked || submitting) return;
    setSubmitting(true);
    setErrorMsg(null);

    const openIds = archiveOpenRepairs ? linkedOpenRepairs.map((t) => String(t.id)) : [];
    const res = await archiveMachineFromParc(String(selectedMachine.id), openIds);

    if (!res.success) {
      setErrorMsg(res.error || 'Impossible de supprimer cette machine sur Monday.');
      setSubmitting(false);
      return;
    }

    await onSuccess(String(selectedMachine.id), selectedMachine.name, openIds);
    setSubmitting(false);
    onClose();
  };

  return (
    <div
      onClick={onClose}
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
        style={{
          width: '100%',
          maxWidth: '540px',
          backgroundColor: '#FFFFFF',
          borderRadius: '18px',
          border: '1px solid #FECACA',
          boxShadow: '0 24px 60px rgba(15, 23, 42, 0.28)',
          overflow: 'hidden',
          fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            background: 'linear-gradient(135deg, #B91C1C 0%, #DC2626 100%)',
            color: '#FFFFFF',
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
              <Trash2 size={18} color="#FFFFFF" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, fontFamily: "'Ruda', sans-serif" }}>
                Supprimer une machine du parc
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '11.5px', color: 'rgba(255,255,255,0.85)' }}>
                Retire la machine du Hub et l’archive proprement sur Monday (récupérable en archive).
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
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 800,
                color: '#1B4565',
                marginBottom: '6px',
              }}
            >
              Machine à supprimer ({machines.length} disponibles)
            </label>
            <FacilitySelect
              value={selectedMachineId}
              onChange={(val) => {
                setSelectedMachineId(val);
                setConfirmChecked(false);
                setErrorMsg(null);
              }}
              options={machineOptions}
              placeholder="Rechercher par numéro, nom ou chantier..."
              searchable
              clearable
            />
          </div>

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
                <span>Conséquences de la suppression :</span>
              </div>
              <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: '#78350F', lineHeight: 1.5 }}>
                <li>
                  <strong>{selectedMachine.name}</strong> disparaîtra de la Fiche de Contrôle, de la Maintenance Préventive et des Indicateurs.
                </li>
                <li>
                  Les anciens contrôles déjà réalisés restent conservés dans l’historique pour la traçabilité.
                </li>
                <li>
                  {linkedOpenRepairs.length > 0 ? (
                    <span>
                      <strong>{linkedOpenRepairs.length} ticket(s) de réparation ouvert(s)</strong> sont actuellement liés à cette machine.
                    </span>
                  ) : (
                    <span>Aucun ticket de réparation ouvert lié à cette machine.</span>
                  )}
                </li>
              </ul>

              {linkedOpenRepairs.length > 0 && (
                <label
                  style={{
                    marginTop: '4px',
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
                    style={{ width: '15px', height: '15px', accentColor: '#DC2626' }}
                  />
                  <span>Archiver aussi ses {linkedOpenRepairs.length} ticket(s) de réparation ouverts</span>
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
                color: '#991B1B',
                cursor: 'pointer',
                padding: '8px 12px',
                borderRadius: '10px',
                backgroundColor: '#FEF2F2',
                border: '1px solid #FECACA',
              }}
            >
              <input
                type="checkbox"
                checked={confirmChecked}
                onChange={(e) => setConfirmChecked(e.target.checked)}
                style={{ width: '15px', height: '15px', accentColor: '#DC2626' }}
              />
              <span>Je confirme vouloir supprimer « {selectedMachine.name} » du parc actif</span>
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
            onClick={handleConfirmDelete}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              padding: '8px 16px',
              borderRadius: '9px',
              border: 'none',
              backgroundColor: !selectedMachine || !confirmChecked || submitting ? '#FCA5A5' : '#DC2626',
              color: '#FFFFFF',
              fontSize: '12.5px',
              fontWeight: 800,
              cursor: !selectedMachine || !confirmChecked || submitting ? 'not-allowed' : 'pointer',
            }}
          >
            {submitting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Suppression...</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={14} />
                <span>Supprimer la machine</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
