import React, { useState, useMemo, useRef } from 'react';
import {
  X,
  Upload,
  FileText,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Wrench,
  Sparkles,
  Plus,
  Trash2,
  Paperclip,
  ExternalLink,
  Loader2,
  Link2,
} from 'lucide-react';
import monday from '../services/monday';
import type { Machine } from '../types';
import { MachineSelect } from './MachineSelect';
import { RepairTicketSelect } from './RepairTicketSelect';
import {
  MAINTENANCE_BOARD_IDS,
  RepairTicket,
  submitSupplierIntervention,
} from '../services/maintenanceApi';
import {
  ParsedSupplierOrder,
  MatchedMachineCandidate,
  SupplierReplacedPart,
  parseSupplierOrderPdf,
  findBestMatchingMachines,
} from '../services/supplierPdfParser';

interface SupplierImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  machines: Machine[];
  repairTickets: RepairTicket[];
  getCol: (m: Machine, colId: string) => string;
  onSuccess: () => Promise<void>;
}

const EMPTY_ORDER: ParsedSupplierOrder = {
  supplierName: '',
  orderNumber: '',
  date: new Date().toISOString().split('T')[0],
  dateDisplay: new Date().toLocaleDateString('fr-FR'),
  clientAccount: '',
  siteAddress: '',
  equipmentName: '',
  serialNumber: '',
  articleNumber: '',
  technicianName: '',
  damageSummary: '',
  laborItems: [],
  laborSummary: '',
  underWarranty: false,
  warrantyLabel: 'Hors garantie / À vérifier',
  replacedParts: [],
  technicianNotes: '',
  customerSignature: '',
  technicianSignature: '',
  suggestedStatus: 'Réparée',
  rawTextPreview: '',
};

export const SupplierImportModal: React.FC<SupplierImportModalProps> = ({
  isOpen,
  onClose,
  machines,
  repairTickets,
  getCol,
  onSuccess,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const [order, setOrder] = useState<ParsedSupplierOrder | null>(null);
  const [matches, setMatches] = useState<MatchedMachineCandidate[]>([]);
  const [selectedMachineId, setSelectedMachineId] = useState<string>('');
  const [selectedExistingTicketId, setSelectedExistingTicketId] = useState<string>('');
  const [finalStatus, setFinalStatus] = useState<
    'Réparée' | 'En cours de réparation' | 'En attente de devis' | 'À traiter'
  >('Réparée');

  const selectedMachine = useMemo(
    () => machines.find((m) => m.id === selectedMachineId) || null,
    [machines, selectedMachineId]
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedResult, setSubmittedResult] = useState<{
    id: string;
    fileColumnId?: string;
    machineName: string;
    orderNumber: string;
    updatedExisting: boolean;
  } | null>(null);

  // Trouver automatiquement un ticket ouvert existant pour une machine donnée
  const findBestOpenTicketIdForMachine = (machineId: string): string => {
    if (!machineId) return '';
    const machineObj = machines.find((m) => m.id === machineId);
    const machineLabel = (machineObj?.name || '').toLowerCase().trim();
    const active = repairTickets.filter((t) => {
      const lower = (t.status || '').toLowerCase();
      const grpLower = (t.groupTitle || '').toLowerCase();
      return (
        !lower.includes('réparée') &&
        !lower.includes('reparee') &&
        !grpLower.includes('réparé') &&
        !grpLower.includes('repare')
      );
    });
    const exactIdMatch = active.find((t) => String(t.machineId || '') === String(machineId));
    if (exactIdMatch) return exactIdMatch.id;
    if (machineLabel && machineLabel.length >= 4) {
      const nameMatch = active.find((t) => t.machineName.toLowerCase().includes(machineLabel));
      if (nameMatch) return nameMatch.id;
    }
    return '';
  };

  const handleSelectMachine = (machineId: string) => {
    setSelectedMachineId(machineId);
    setSelectedExistingTicketId(findBestOpenTicketIdForMachine(machineId));
  };

  if (!isOpen) return null;

  const resetAll = () => {
    setOrder(null);
    setMatches([]);
    setSelectedMachineId('');
    setSelectedExistingTicketId('');
    setFinalStatus('Réparée');
    setParseError(null);
    setSubmitError(null);
    setSubmittedResult(null);
  };

  const handleClose = () => {
    resetAll();
    onClose();
  };

  const handlePdfFile = async (file: File) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      setParseError('Veuillez sélectionner un fichier au format PDF (.pdf).');
      return;
    }

    setIsParsing(true);
    setParseError(null);
    setSubmitError(null);
    setSubmittedResult(null);

    try {
      const parsed = await parseSupplierOrderPdf(file);
      setOrder(parsed);
      setFinalStatus(parsed.suggestedStatus || 'Réparée');

      const candidates = findBestMatchingMachines(parsed, machines);
      setMatches(candidates);

      if (candidates.length > 0 && candidates[0].score >= 40) {
        const bestMachineId = candidates[0].machine.id;
        setSelectedMachineId(bestMachineId);
        setSelectedExistingTicketId(findBestOpenTicketIdForMachine(bestMachineId));
      } else {
        setSelectedMachineId('');
        setSelectedExistingTicketId('');
      }
    } catch (err: any) {
      console.error('Erreur lecture PDF fournisseur:', err);
      setParseError(
        err?.message ||
          "Impossible de lire ce fichier PDF automatiquement. Vous pouvez passer en saisie manuelle ci-dessous."
      );
    } finally {
      setIsParsing(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      handlePdfFile(droppedFile);
    }
  };

  const updateOrderField = <K extends keyof ParsedSupplierOrder>(
    field: K,
    value: ParsedSupplierOrder[K]
  ) => {
    setOrder((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const updatePart = (idx: number, patch: Partial<SupplierReplacedPart>) => {
    setOrder((prev) => {
      if (!prev) return prev;
      const next = [...prev.replacedParts];
      next[idx] = { ...next[idx], ...patch };
      return { ...prev, replacedParts: next };
    });
  };

  const addEmptyPart = () => {
    setOrder((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        replacedParts: [
          ...prev.replacedParts,
          { articleNumber: '', description: '', quantity: '1', unit: 'EA', warrantyFlag: '' },
        ],
      };
    });
  };

  const removePart = (idx: number) => {
    setOrder((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        replacedParts: prev.replacedParts.filter((_, i) => i !== idx),
      };
    });
  };

  const handleSubmit = async () => {
    if (!order) return;
    setIsSubmitting(true);
    setSubmitError(null);

    const matchedMachine = machines.find((m) => m.id === selectedMachineId);
    const resolvedMachineName =
      matchedMachine?.name ||
      order.equipmentName ||
      order.clientAccount ||
      'Machine non rattachée';

    const dateDisplay = /^\d{4}-\d{2}-\d{2}$/.test(order.date)
      ? order.date.split('-').reverse().join('/')
      : order.dateDisplay;

    const cleanOrder: ParsedSupplierOrder = {
      ...order,
      dateDisplay,
      replacedParts: order.replacedParts.filter((p) => p.description.trim() || p.articleNumber.trim()),
    };

    const res = await submitSupplierIntervention({
      order: cleanOrder,
      machineId: selectedMachineId || undefined,
      machineName: resolvedMachineName,
      existingTicketId: selectedExistingTicketId || undefined,
      finalStatus,
    });

    setIsSubmitting(false);

    if (res.success && res.id) {
      setSubmittedResult({
        id: res.id,
        fileColumnId: res.fileColumnId,
        machineName: resolvedMachineName,
        orderNumber: cleanOrder.orderNumber,
        updatedExisting: Boolean(selectedExistingTicketId),
      });
      await onSuccess();
    } else {
      setSubmitError(res.error || "Erreur lors de l'enregistrement dans Monday.");
    }
  };

  const openDirectMondayUrl = () => {
    if (!submittedResult?.id) return;
    window.open(
      `https://groupefacility.monday.com/boards/${MAINTENANCE_BOARD_IDS.REPARATION_MACHINES}/pulses/${submittedResult.id}`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  const triggerMondayPdfAttach = () => {
    if (!submittedResult?.id) return;
    try {
      const action = submittedResult.fileColumnId
        ? (monday as any).execute('triggerFilesUpload', {
            boardId: Number(MAINTENANCE_BOARD_IDS.REPARATION_MACHINES),
            itemId: Number(submittedResult.id),
            columnId: submittedResult.fileColumnId,
          })
        : (monday as any).execute('openItemCard', {
            itemId: Number(submittedResult.id),
            kind: 'updates',
          });
      if (action && typeof action.catch === 'function') {
        action.catch(() => openDirectMondayUrl());
      }
    } catch {
      openDirectMondayUrl();
    }
  };

  const openMondayItemCard = () => {
    if (!submittedResult?.id) return;
    openDirectMondayUrl();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 39, 58, 0.6)',
        backdropFilter: 'blur(3px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '860px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 24px 60px rgba(15, 39, 58, 0.28)',
          border: '1px solid #DDE7F0',
          overflow: 'hidden',
        }}
      >
        {/* En-tête Modale */}
        <div
          style={{
            padding: '16px 22px',
            borderBottom: '1px solid #E2E8F0',
            backgroundColor: '#F8FBFD',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: '#E0F2FE',
                color: '#0073EA',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <FileText size={20} />
            </div>
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: '17px',
                  fontWeight: 800,
                  fontFamily: "'Ruda', sans-serif",
                  color: '#1B4565',
                }}
              >
                Intégrer un Acte d&apos;Intervention Fournisseur (PDF)
              </h2>
              <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#57778E' }}>
                Lecture multi-fournisseurs automatique (Diversey, Kärcher, Nilfisk, SAV externes, factures PDF) ➔ ticket + coût + historique
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
              backgroundColor: '#FFFFFF',
              color: '#57778E',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
            title="Fermer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Contenu scrollable */}
        <div style={{ padding: '20px 22px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* État Succès Post-Enregistrement */}
          {submittedResult ? (
            <div
              style={{
                backgroundColor: '#ECFDF5',
                border: '1.5px solid #A7F3D0',
                borderRadius: '14px',
                padding: '22px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#065F46' }}>
                <CheckCircle2 size={26} color="#00C875" />
                <div>
                  <div style={{ fontSize: '16px', fontWeight: 800, fontFamily: "'Ruda', sans-serif" }}>
                    {submittedResult.updatedExisting
                      ? 'Ticket Monday mis à jour avec le bon fournisseur !'
                      : 'Acte d’intervention intégré avec succès dans Monday !'}
                  </div>
                  <div style={{ fontSize: '13px', color: '#047857', marginTop: '2px' }}>
                    Machine : <b>{submittedResult.machineName}</b>
                    {submittedResult.orderNumber ? ` · Bon N° ${submittedResult.orderNumber}` : ''}
                  </div>
                </div>
              </div>

              <div
                style={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #D1FAE5',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  fontSize: '12.5px',
                  color: '#1B4565',
                  lineHeight: 1.5,
                }}
              >
                <div>• Le ticket <b>Réparation machines (5106693291)</b> a été enregistré avec la synthèse des pièces, la garantie et les heures.</div>
                <div>• Le compte-rendu complet a été publié dans le fil d&apos;activité du ticket <b>et</b> de la fiche machine (si rattachée).</div>
                <div>• Vous pouvez maintenant joindre le fichier PDF original directement dans Monday en 1 clic ci-dessous :</div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                <button
                  type="button"
                  onClick={triggerMondayPdfAttach}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '7px',
                    backgroundColor: '#0073EA',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '9px 14px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <Paperclip size={15} />
                  Joindre le PDF sur la fiche Monday
                </button>

                <button
                  type="button"
                  onClick={openMondayItemCard}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '7px',
                    backgroundColor: '#FFFFFF',
                    color: '#1B4565',
                    border: '1px solid #CBD5E1',
                    borderRadius: '8px',
                    padding: '9px 14px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <ExternalLink size={15} />
                  Ouvrir le ticket dans Monday
                </button>

                <button
                  type="button"
                  onClick={resetAll}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '7px',
                    backgroundColor: '#F1F5F9',
                    color: '#334155',
                    border: '1px solid #CBD5E1',
                    borderRadius: '8px',
                    padding: '9px 14px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Importer un autre PDF
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Zone Drag & Drop PDF */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handlePdfFile(file);
                  e.target.value = '';
                }}
              />

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${isDragging ? '#0073EA' : order ? '#A7F3D0' : '#94C5E8'}`,
                  backgroundColor: isDragging ? '#EFF6FF' : order ? '#F0FDF4' : '#F7FBFE',
                  borderRadius: '12px',
                  padding: order ? '12px 16px' : '26px 20px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: order ? 'space-between' : 'center',
                  flexDirection: order ? 'row' : 'column',
                  gap: '10px',
                }}
              >
                {isParsing ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#0073EA', fontWeight: 700, fontSize: '13.5px' }}>
                    <Loader2 size={18} className="animate-spin" />
                    Lecture intelligente du bon d&apos;intervention PDF en cours...
                  </div>
                ) : order ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', textAlign: 'left' }}>
                      <CheckCircle2 size={20} color="#00C875" />
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 800, color: '#065F46' }}>
                          {order.fileName ? `PDF analysé : ${order.fileName}` : 'Mode saisie manuelle activé'}
                        </div>
                        <div style={{ fontSize: '11.5px', color: '#047857' }}>
                          Vérifiez les données extraites ci-dessous puis validez pour envoyer dans Monday
                        </div>
                      </div>
                    </div>
                    <span
                      style={{
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #CBD5E1',
                        color: '#1B4565',
                        borderRadius: '8px',
                        padding: '6px 11px',
                        fontSize: '12px',
                        fontWeight: 700,
                      }}
                    >
                      Changer de PDF
                    </span>
                  </>
                ) : (
                  <>
                    <div
                      style={{
                        width: '46px',
                        height: '46px',
                        borderRadius: '12px',
                        backgroundColor: '#E0F2FE',
                        color: '#0073EA',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Upload size={22} />
                    </div>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 800, color: '#1B4565', fontFamily: "'Ruda', sans-serif" }}>
                        Glissez-déposez le bon d&apos;intervention PDF ici, ou cliquez pour choisir
                      </div>
                      <div style={{ fontSize: '12px', color: '#57778E', marginTop: '4px' }}>
                        Extraction 100% locale : N° ordre, site client, machine &amp; S/N, pièces remplacées, main d&apos;œuvre et garantie
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOrder({ ...EMPTY_ORDER });
                      }}
                      style={{
                        marginTop: '4px',
                        backgroundColor: 'transparent',
                        border: 'none',
                        color: '#0073EA',
                        fontSize: '12px',
                        fontWeight: 700,
                        textDecoration: 'underline',
                        cursor: 'pointer',
                      }}
                    >
                      Ou saisir une intervention fournisseur manuellement sans PDF
                    </button>
                  </>
                )}
              </div>

              {parseError && (
                <div
                  style={{
                    backgroundColor: '#FFF1F2',
                    border: '1px solid #FECDD3',
                    color: '#9F1239',
                    borderRadius: '10px',
                    padding: '10px 14px',
                    fontSize: '12.5px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertTriangle size={16} />
                    <span>{parseError}</span>
                  </div>
                  {!order && (
                    <button
                      type="button"
                      onClick={() => setOrder({ ...EMPTY_ORDER })}
                      style={{
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #FDA4AF',
                        color: '#9F1239',
                        borderRadius: '6px',
                        padding: '4px 10px',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Saisie manuelle
                    </button>
                  )}
                </div>
              )}

              {/* Formulaire d'édition & vérification post-parsing */}
              {order && (
                <>
                  {/* Bloc 1 : Rattachement Machine Monday & Ticket Existant */}
                  <div
                    style={{
                      backgroundColor: '#F8FBFD',
                      border: '1px solid #DDE7F0',
                      borderRadius: '12px',
                      padding: '14px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 800, color: '#1B4565', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Wrench size={15} color="#0073EA" />
                        1. Rattacher à une machine du parc Monday
                      </span>
                      {order.serialNumber && (
                        <span style={{ fontSize: '11.5px', color: '#57778E', fontWeight: 600 }}>
                          Matériel PDF : <b>{order.equipmentName || '—'}</b> · S/N : <b>{order.serialNumber}</b>
                        </span>
                      )}
                    </div>

                    {/* Suggestions automatiques */}
                    {matches.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                        <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#0369A1', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Sparkles size={13} /> Suggestions auto :
                        </span>
                        {matches.slice(0, 3).map((cand) => {
                          const active = selectedMachineId === cand.machine.id;
                          return (
                            <button
                              key={cand.machine.id}
                              type="button"
                              onClick={() => handleSelectMachine(cand.machine.id)}
                              style={{
                                backgroundColor: active ? '#0073EA' : '#FFFFFF',
                                color: active ? '#FFFFFF' : '#1B4565',
                                border: `1px solid ${active ? '#0073EA' : '#BFDBFE'}`,
                                borderRadius: '8px',
                                padding: '5px 10px',
                                fontSize: '11.5px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                              }}
                              title={cand.matchReasons.join(' · ')}
                            >
                              <span>{cand.machine.name}</span>
                              <span
                                style={{
                                  backgroundColor: active ? 'rgba(255,255,255,0.2)' : '#EFF6FF',
                                  color: active ? '#FFFFFF' : '#0369A1',
                                  padding: '1px 5px',
                                  borderRadius: '4px',
                                  fontSize: '10.5px',
                                }}
                              >
                                {cand.matchReasons[0] || `Score ${cand.score}`}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    <MachineSelect
                      machines={machines}
                      selectedMachineId={selectedMachineId}
                      onSelectMachine={handleSelectMachine}
                      getCol={getCol}
                    />

                    {!selectedMachineId && (
                      <div style={{ fontSize: '11.5px', color: '#B45309', backgroundColor: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '8px', padding: '7px 10px' }}>
                        ⚠️ Aucune machine du parc sélectionnée : le ticket sera quand même créé dans « Réparation machines », mais sans lien vers une fiche machine existante.
                      </div>
                    )}

                    {/* Rattacher à un ticket existant (optionnel) */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '4px' }}>
                      <label style={{ fontSize: '11.5px', fontWeight: 800, color: '#1B4565', display: 'flex', alignItems: 'center', gap: '5px', fontFamily: "'Ruda', sans-serif" }}>
                        <Link2 size={13} color="#0073EA" />
                        Action dans « Réparation machines » (5106693291) :
                      </label>
                      <RepairTicketSelect
                        tickets={repairTickets}
                        selectedTicketId={selectedExistingTicketId}
                        onSelectTicket={setSelectedExistingTicketId}
                        selectedMachineId={selectedMachineId}
                        selectedMachineName={selectedMachine?.name}
                      />
                    </div>
                  </div>

                  {/* Bloc 2 : Informations extraites & Garantie */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                      gap: '10px',
                    }}
                  >
                    <div>
                      <label style={labelStyle}>Fournisseur / Prestataire</label>
                      <input
                        type="text"
                        value={order.supplierName}
                        onChange={(e) => updateOrderField('supplierName', e.target.value)}
                        style={inputStyle}
                        placeholder="Ex: Diversey (Solenis)"
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>N° Bon / Ordre de service</label>
                      <input
                        type="text"
                        value={order.orderNumber}
                        onChange={(e) => updateOrderField('orderNumber', e.target.value)}
                        style={inputStyle}
                        placeholder="Ex: 910001227927"
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Date de l&apos;intervention</label>
                      <input
                        type="date"
                        value={order.date}
                        onChange={(e) => updateOrderField('date', e.target.value)}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Technicien fournisseur</label>
                      <input
                        type="text"
                        value={order.technicianName}
                        onChange={(e) => updateOrderField('technicianName', e.target.value)}
                        style={inputStyle}
                        placeholder="Ex: Serge Larvor"
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Client / Site d&apos;intervention</label>
                      <input
                        type="text"
                        value={order.clientAccount}
                        onChange={(e) => updateOrderField('clientAccount', e.target.value)}
                        style={inputStyle}
                        placeholder="Ex: RIVAGE THALASSO & SPA"
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Statut cible du ticket Monday</label>
                      <select
                        value={finalStatus}
                        onChange={(e) => setFinalStatus(e.target.value as any)}
                        style={inputStyle}
                      >
                        <option value="Réparée">✅ Réparée</option>
                        <option value="En cours de réparation">🔧 En cours de réparation</option>
                        <option value="En attente de devis">📄 En attente de devis</option>
                        <option value="À traiter">🚨 À traiter</option>
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Coût intervention (€ HT)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={order.totalHT ?? ''}
                        onChange={(e) => {
                          const raw = e.target.value;
                          updateOrderField('totalHT', raw === '' ? undefined : Number(raw));
                        }}
                        style={inputStyle}
                        placeholder={order.underWarranty ? '0 (sous garantie)' : 'Ex: 345.00'}
                      />
                    </div>
                  </div>

                  {/* Bandeau Garantie + Temps passé */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => updateOrderField('underWarranty', !order.underWarranty)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '7px',
                        padding: '8px 14px',
                        borderRadius: '10px',
                        border: `1.5px solid ${order.underWarranty ? '#16A34A' : '#CBD5E1'}`,
                        backgroundColor: order.underWarranty ? '#DCFCE7' : '#F8FAFC',
                        color: order.underWarranty ? '#166534' : '#475569',
                        fontSize: '12.5px',
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                    >
                      <ShieldCheck size={16} />
                      {order.underWarranty ? 'Intervention SOUS GARANTIE (0 €)' : 'Intervention hors garantie / standard'}
                    </button>

                    <div style={{ flex: 1, minWidth: '240px' }}>
                      <input
                        type="text"
                        value={order.laborSummary}
                        onChange={(e) => updateOrderField('laborSummary', e.target.value)}
                        style={inputStyle}
                        placeholder="Main d'œuvre & déplacement (ex: 4h MO · Déplacement Zone 2)"
                      />
                    </div>
                  </div>

                  {/* Diagnostic SAP / Panne */}
                  {order.damageSummary !== undefined && (
                    <div>
                      <label style={labelStyle}>Diagnostic / Cause / Solution</label>
                      <input
                        type="text"
                        value={order.damageSummary}
                        onChange={(e) => updateOrderField('damageSummary', e.target.value)}
                        style={inputStyle}
                        placeholder="Ex: Système d'aspiration · REPARE"
                      />
                    </div>
                  )}

                  {/* Liste éditable des pièces remplacées */}
                  <div
                    style={{
                      border: '1px solid #DDE7F0',
                      borderRadius: '12px',
                      padding: '12px 14px',
                      backgroundColor: '#FFFFFF',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '12.5px', fontWeight: 800, color: '#1B4565' }}>
                        📦 Pièces / Matériaux remplacés ({order.replacedParts.length})
                      </span>
                      <button
                        type="button"
                        onClick={addEmptyPart}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          backgroundColor: '#EFF6FF',
                          color: '#0369A1',
                          border: '1px solid #BFDBFE',
                          borderRadius: '6px',
                          padding: '4px 9px',
                          fontSize: '11.5px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        <Plus size={13} /> Ajouter une pièce
                      </button>
                    </div>

                    {order.replacedParts.length === 0 ? (
                      <div style={{ fontSize: '12px', color: '#64748B', fontStyle: 'italic' }}>
                        Aucune pièce remplacée détectée sur le bon.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {order.replacedParts.map((part, idx) => (
                          <div
                            key={idx}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '120px 1fr 70px 60px 30px',
                              gap: '6px',
                              alignItems: 'center',
                            }}
                          >
                            <input
                              type="text"
                              value={part.articleNumber}
                              onChange={(e) => updatePart(idx, { articleNumber: e.target.value })}
                              style={compactInputStyle}
                              placeholder="Réf."
                            />
                            <input
                              type="text"
                              value={part.description}
                              onChange={(e) => updatePart(idx, { description: e.target.value })}
                              style={compactInputStyle}
                              placeholder="Désignation pièce"
                            />
                            <input
                              type="text"
                              value={part.quantity}
                              onChange={(e) => updatePart(idx, { quantity: e.target.value })}
                              style={compactInputStyle}
                              placeholder="Qté"
                            />
                            <input
                              type="text"
                              value={part.unit}
                              onChange={(e) => updatePart(idx, { unit: e.target.value })}
                              style={compactInputStyle}
                              placeholder="Unité"
                            />
                            <button
                              type="button"
                              onClick={() => removePart(idx)}
                              style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '6px',
                                border: '1px solid #FECDD3',
                                backgroundColor: '#FFF1F2',
                                color: '#E11D48',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                              }}
                              title="Supprimer cette ligne"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Note de service technicien */}
                  <div>
                    <label style={labelStyle}>Compte-rendu / Note de service du technicien</label>
                    <textarea
                      rows={3}
                      value={order.technicianNotes}
                      onChange={(e) => updateOrderField('technicianNotes', e.target.value)}
                      style={{
                        ...inputStyle,
                        resize: 'none',
                        height: '92px',
                        overflowY: 'auto',
                        fontFamily: 'inherit',
                        lineHeight: 1.45,
                      }}
                      placeholder="Détails de l'intervention fournisseur..."
                    />
                  </div>

                  {(order.customerSignature || order.technicianSignature) && (
                    <div style={{ fontSize: '11.5px', color: '#57778E', display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                      {order.customerSignature && <span>✍️ Client : <b>{order.customerSignature}</b></span>}
                      {order.technicianSignature && <span>✍️ Technicien : <b>{order.technicianSignature}</b></span>}
                    </div>
                  )}

                  {submitError && (
                    <div
                      style={{
                        backgroundColor: '#FFF1F2',
                        border: '1px solid #FECDD3',
                        color: '#9F1239',
                        borderRadius: '10px',
                        padding: '10px 14px',
                        fontSize: '12.5px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      <AlertTriangle size={16} />
                      <span>{submitError}</span>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>

        {/* Pied de modale */}
        {!submittedResult && (
          <div
            style={{
              padding: '14px 22px',
              borderTop: '1px solid #E2E8F0',
              backgroundColor: '#F8FBFD',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '10px',
            }}
          >
            <button
              type="button"
              onClick={handleClose}
              style={{
                backgroundColor: '#FFFFFF',
                color: '#475569',
                border: '1px solid #CBD5E1',
                borderRadius: '8px',
                padding: '9px 16px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Annuler
            </button>
            {order && (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleSubmit}
                style={{
                  backgroundColor: isSubmitting ? '#94A3B8' : '#0073EA',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '9px 18px',
                  fontSize: '13px',
                  fontWeight: 800,
                  cursor: isSubmitting ? 'wait' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    Enregistrement dans Monday...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    {selectedExistingTicketId
                      ? 'Mettre à jour le ticket Monday'
                      : 'Enregistrer dans Monday'}
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '11.5px',
  fontWeight: 700,
  color: '#475569',
  marginBottom: '4px',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '8px 10px',
  borderRadius: '8px',
  border: '1px solid #CBD5E1',
  backgroundColor: '#FFFFFF',
  fontSize: '12.5px',
  color: '#1B4565',
  fontWeight: 600,
};

const compactInputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '6px 8px',
  borderRadius: '6px',
  border: '1px solid #CBD5E1',
  backgroundColor: '#F8FAFC',
  fontSize: '12px',
  color: '#1B4565',
  fontWeight: 600,
};

