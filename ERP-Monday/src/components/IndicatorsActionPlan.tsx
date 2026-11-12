import React, { useState, useMemo } from 'react';
import {
  Wrench,
  CheckCircle2,
  Clock,
  Search,
  ExternalLink,
  ClipboardCheck,
  RefreshCw,
  Check,
  FileUp,
  ShieldCheck,
  X,
  MessageSquare,
} from 'lucide-react';
import type { Machine } from '../types';
import {
  RealisedControle,
  RepairTicket,
  TicketUpdateItem,
  MONTH_COLUMN_IDS,
  updateRepairStatus,
  fetchRepairBoardMeta,
  moveRepairItemToGroup,
  fetchTicketUpdates,
} from '../services/maintenanceApi';
import { SupplierImportModal } from './SupplierImportModal';

interface ParsedTicketDescription {
  isStructuredSupplier: boolean;
  supplier?: string;
  underWarranty: boolean;
  orderLabel?: string;
  site?: string;
  serial?: string;
  tech?: string;
  labor?: string;
  parts: string[];
  diagnostic?: string;
  note?: string;
  essentialText: string;
}

function parseTicketDescription(rawDesc: string): ParsedTicketDescription {
  const raw = (rawDesc || '').trim();
  if (!raw) {
    return { isStructuredSupplier: false, underWarranty: false, parts: [], essentialText: '' };
  }

  // Format legacy multi-champs séparés par " | "
  if (raw.includes(' | ') && (/\[Fournisseur\s*:/i.test(raw) || /Bon d['’]intervention/i.test(raw) || /Site client\s*:/i.test(raw))) {
    const segments = raw.split(/\s*\|\s*/).map((s) => s.trim()).filter(Boolean);
    const out: ParsedTicketDescription = {
      isStructuredSupplier: true,
      underWarranty: /\[SOUS GARANTIE\]/i.test(raw),
      parts: [],
      essentialText: '',
    };

    for (const seg of segments) {
      const suppMatch = seg.match(/\[Fournisseur\s*:\s*([^\]]+)\]/i);
      if (suppMatch) {
        out.supplier = suppMatch[1].trim();
        continue;
      }
      if (/^Bon d['’]intervention/i.test(seg) || /^Intervention du/i.test(seg)) {
        out.orderLabel = seg;
      } else if (/^Site client\s*:/i.test(seg)) {
        out.site = seg.replace(/^Site client\s*:/i, '').trim();
      } else if (/^S\/N\s*:/i.test(seg)) {
        out.serial = seg.replace(/^S\/N\s*:/i, '').trim();
      } else if (/^Tech\s*:/i.test(seg)) {
        out.tech = seg.replace(/^Tech\s*:/i, '').trim();
      } else if (/^Temps\s*\/\s*D[ée]pl\.\s*:/i.test(seg)) {
        out.labor = seg.replace(/^Temps\s*\/\s*D[ée]pl\.\s*:/i, '').trim();
      } else if (/^Pi[èe]ces\s*:/i.test(seg)) {
        const pStr = seg.replace(/^Pi[èe]ces\s*:/i, '').trim();
        if (pStr && !/aucune pi[èe]ce/i.test(pStr)) {
          out.parts = pStr.split(/\s*;\s*/).map((x) => x.trim()).filter(Boolean);
        }
      } else if (/^Diagnostic\s*:/i.test(seg)) {
        out.diagnostic = seg.replace(/^Diagnostic\s*:/i, '').trim();
      } else if (/^Note\s*:/i.test(seg)) {
        out.note = seg.replace(/^Note\s*:/i, '').trim();
      }
    }

    const summary = out.note || out.diagnostic || (out.parts.length > 0 ? out.parts.join(', ') : out.orderLabel || '');
    out.essentialText = summary.length > 210 ? `${summary.slice(0, 207)}...` : summary;
    return out;
  }

  // Nouveau format concis (ligne 1 = méta · , lignes suivantes = résumé)
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length >= 2 && lines[0].includes(' · ')) {
    const metaParts = lines[0].split(' · ').map((s) => s.trim());
    const sitePart = metaParts.find((p) => /^Site\s*:/i.test(p));
    const partsPart = metaParts.find((p) => /pi[èe]ce\(s\)/i.test(p));
    const noteBody = lines.slice(1).join(' ');
    return {
      isStructuredSupplier: true,
      supplier: metaParts[0],
      underWarranty: metaParts.some((p) => /sous garantie/i.test(p)),
      site: sitePart ? sitePart.replace(/^Site\s*:/i, '').trim() : undefined,
      parts: partsPart ? [partsPart] : [],
      note: noteBody,
      essentialText: noteBody.length > 210 ? `${noteBody.slice(0, 207)}...` : noteBody,
    };
  }

  return {
    isStructuredSupplier: false,
    underWarranty: /sous garantie/i.test(raw),
    parts: [],
    essentialText: raw.length > 260 ? `${raw.slice(0, 257)}...` : raw,
    note: raw,
  };
}

interface IndicatorsActionPlanProps {
  machines: Machine[];
  realisedControles: RealisedControle[];
  repairTickets: RepairTicket[];
  onRefreshData: () => Promise<void>;
  onOpenInspection: (machineId: string) => void;
}

export const IndicatorsActionPlan: React.FC<IndicatorsActionPlanProps> = ({
  machines,
  realisedControles,
  repairTickets,
  onRefreshData,
  onOpenInspection,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'a_traiter' | 'en_cours' | 'reparee'>('a_traiter');
  const [updatingTicketId, setUpdatingTicketId] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [detailTicket, setDetailTicket] = useState<RepairTicket | null>(null);
  const [detailUpdates, setDetailUpdates] = useState<TicketUpdateItem[]>([]);
  const [loadingDetailUpdates, setLoadingDetailUpdates] = useState(false);

  const openTicketDetail = async (ticket: RepairTicket) => {
    setDetailTicket(ticket);
    setDetailUpdates([]);
    setLoadingDetailUpdates(true);
    const updates = await fetchTicketUpdates(ticket.id);
    setDetailUpdates(updates);
    setLoadingDetailUpdates(false);
  };

  // Helper pour récupérer le texte d'une colonne
  const getCol = (m: Machine, colId: string): string => {
    return m.column_values?.find((c) => c.id === colId)?.text?.trim() || '';
  };

  // 1. STATS GÉNERALES & TAUX DE CONFORMITÉ
  const stats = useMemo(() => {
    const totalControles = realisedControles.length;
    let vertCount = 0;
    let orangeCount = 0;
    let rougeCount = 0;
    let totalMinutes = 0;

    realisedControles.forEach((c) => {
      const lower = (c.etatGeneral || '').toLowerCase();
      if (lower.includes('nc') || lower.includes('non conforme') || lower.includes('rouge')) {
        rougeCount++;
      } else if (lower.includes('moyen') || lower.includes('orange')) {
        orangeCount++;
      } else {
        vertCount++;
      }

      if (c.tempsPasse) {
        const m = parseInt(c.tempsPasse, 10);
        if (!isNaN(m) && m > 0) totalMinutes += m;
      }
    });

    const conformitePercent = totalControles > 0 ? Math.round((vertCount / totalControles) * 100) : 100;

    // Tickets curatifs
    const activeRepairs = repairTickets.filter(
      (t) => !t.status.toLowerCase().includes('réparée') && !t.status.toLowerCase().includes('reparee')
    );

    return {
      totalControles,
      vertCount,
      orangeCount,
      rougeCount,
      conformitePercent,
      totalMinutes,
      activeRepairsCount: activeRepairs.length,
      totalRepairsCount: repairTickets.length,
    };
  }, [realisedControles, repairTickets]);

  // 2. SUIVI MENSUEL DES MAINTENANCES PRÉVENTIVES (12 MOIS)
  const monthlyStats = useMemo(() => {
    const currentYear = new Date().getFullYear();

    return Object.entries(MONTH_COLUMN_IDS).map(([mNumStr, meta]) => {
      const mNum = parseInt(mNumStr, 10);

      // Machines programmées (cochées dans la colonne du mois)
      const plannedCount = machines.filter((m) => {
        const col = m.column_values?.find((c) => c.id === meta.id);
        const txt = col?.text?.toLowerCase() || '';
        return txt.includes('v') || txt.includes('true') || txt === '1' || txt.includes('coch');
      }).length;

      // Contrôles effectivement réalisés ce mois-ci
      const doneCount = realisedControles.filter((c) => {
        if (!c.date) return false;
        const [y, m] = c.date.split('-').map(Number);
        return y === currentYear && m === mNum;
      }).length;

      return {
        monthNumber: mNum,
        label: meta.label,
        short: meta.short,
        plannedCount,
        doneCount,
      };
    });
  }, [machines, realisedControles]);

  // 3. FILTRAGE DES TICKETS DE RÉPARATION
  const filteredTickets = useMemo(() => {
    return repairTickets.filter((t) => {
      const searchMatch =
        !searchTerm ||
        t.machineName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.description.toLowerCase().includes(searchTerm.toLowerCase());

      if (!searchMatch) return false;

      const stLower = t.status.toLowerCase();
      const isReparee = stLower.includes('réparée') || stLower.includes('reparee');
      const isEnCours = stLower.includes('en cours') || stLower.includes('devis') || stLower.includes('attente');

      if (statusFilter === 'reparee') return isReparee;
      if (statusFilter === 'en_cours') return isEnCours;
      if (statusFilter === 'a_traiter') return !isReparee;
      return true;
    }).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [repairTickets, searchTerm, statusFilter]);

  // Action : Marquer un ticket comme Réparée (et déplacement auto dans "Machine Réparé")
  const handleMarkAsRepaired = async (ticket: RepairTicket) => {
    setUpdatingTicketId(ticket.id);
    try {
      const res = await updateRepairStatus(ticket.id, 'Réparée');
      if (res.success) {
        setSuccessToast(`Ticket "${ticket.machineName}" marqué comme Réparée et déplacé dans « Machine Réparé » !`);
        await onRefreshData();
      } else {
        alert(`Erreur Monday : ${res.error}`);
      }
    } catch (err: any) {
      alert(`Erreur : ${err?.message}`);
    } finally {
      setUpdatingTicketId(null);
    }
  };

  // Action : Ranger un ticket déjà "Réparée" dans le groupe Monday "Machine Réparé"
  const handleMoveToRepairedGroup = async (ticket: RepairTicket) => {
    setUpdatingTicketId(ticket.id);
    try {
      const meta = await fetchRepairBoardMeta();
      if (!meta.repairedGroupId) {
        alert('Le groupe « Machine Réparé » est introuvable sur le tableau Monday.');
        return;
      }
      const res = await moveRepairItemToGroup(ticket.id, meta.repairedGroupId);
      if (res.success) {
        setSuccessToast(`"${ticket.machineName}" déplacée dans le groupe « Machine Réparé » !`);
        await onRefreshData();
      } else {
        alert(`Erreur déplacement : ${res.error}`);
      }
    } catch (err: any) {
      alert(`Erreur : ${err?.message}`);
    } finally {
      setUpdatingTicketId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '26px' }}>
      {/* Toast de succès */}
      {successToast && (
        <div
          style={{
            backgroundColor: '#E6F8F0',
            color: '#0E7042',
            border: '1.5px solid #00C875',
            borderRadius: '12px',
            padding: '12px 18px',
            fontSize: '13.5px',
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 4px 12px rgba(0, 200, 117, 0.15)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={18} color="#00C875" />
            <span>{successToast}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessToast(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0E7042', fontWeight: 800 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ================= SECTION 01 : 4 KPI CARDS INDICATEURS ================= */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                backgroundColor: '#39A9DC',
                color: '#FFFFFF',
                fontFamily: "'Ruda', sans-serif",
                fontSize: '12px',
                fontWeight: 800,
                padding: '3px 9px',
                borderRadius: '6px',
              }}
            >
              01
            </span>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, fontFamily: "'Ruda', sans-serif", color: '#1B4565' }}>
              Indicateurs de Performance Parc &amp; Maintenance
            </h2>
          </div>
          <button
            type="button"
            onClick={onRefreshData}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '8px',
              border: '1px solid #D2E9F6',
              backgroundColor: '#FAFCFD',
              color: '#3989B7',
              fontSize: '12.5px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} />
            Actualiser les indicateurs
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '16px' }}>
          {/* Card 1 : Total contrôles réalisés */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '14px',
              padding: '18px 20px',
              border: '1.5px solid #E2EEF5',
              boxShadow: '0 2px 10px rgba(27, 69, 101, 0.04)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '12px', fontWeight: 800, fontFamily: "'Ruda', sans-serif", color: '#3989B7', textTransform: 'uppercase' }}>
                Contrôles Réalisés
              </span>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#EBF6FC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ClipboardCheck size={20} color="#39A9DC" />
              </div>
            </div>
            <div style={{ fontSize: '28px', fontWeight: 900, fontFamily: "'Ruda', sans-serif", color: '#1B4565', lineHeight: 1 }}>
              {stats.totalControles}
            </div>
            <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#57778E' }}>
              Sur un parc de <b>{machines.length}</b> machines actives
            </p>
          </div>

          {/* Card 2 : Taux de conformité */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '14px',
              padding: '18px 20px',
              border: '1.5px solid #E2EEF5',
              boxShadow: '0 2px 10px rgba(27, 69, 101, 0.04)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '12px', fontWeight: 800, fontFamily: "'Ruda', sans-serif", color: '#0E7042', textTransform: 'uppercase' }}>
                Taux de Conformité
              </span>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#E6F8F0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckCircle2 size={20} color="#00C875" />
              </div>
            </div>
            <div style={{ fontSize: '28px', fontWeight: 900, fontFamily: "'Ruda', sans-serif", color: '#00C875', lineHeight: 1 }}>
              {stats.conformitePercent}%
            </div>
            <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#57778E' }}>
              🟢 {stats.vertCount} OK · 🟠 {stats.orangeCount} Moyen · 🔴 {stats.rougeCount} NC
            </p>
          </div>

          {/* Card 3 : Tickets de réparation curatifs actifs */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '14px',
              padding: '18px 20px',
              border: stats.activeRepairsCount > 0 ? '1.5px solid #F5C6CB' : '1.5px solid #E2EEF5',
              boxShadow: '0 2px 10px rgba(27, 69, 101, 0.04)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '12px', fontWeight: 800, fontFamily: "'Ruda', sans-serif", color: stats.activeRepairsCount > 0 ? '#E2445C' : '#3989B7', textTransform: 'uppercase' }}>
                Réparations à Traiter
              </span>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#FDECEE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Wrench size={20} color="#E2445C" />
              </div>
            </div>
            <div style={{ fontSize: '28px', fontWeight: 900, fontFamily: "'Ruda', sans-serif", color: stats.activeRepairsCount > 0 ? '#E2445C' : '#1B4565', lineHeight: 1 }}>
              {stats.activeRepairsCount}
            </div>
            <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#57778E' }}>
              Sur <b>{stats.totalRepairsCount}</b> tickets générés au total
            </p>
          </div>

          {/* Card 4 : Temps total cumulé */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '14px',
              padding: '18px 20px',
              border: '1.5px solid #E2EEF5',
              boxShadow: '0 2px 10px rgba(27, 69, 101, 0.04)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '12px', fontWeight: 800, fontFamily: "'Ruda', sans-serif", color: '#D66927', textTransform: 'uppercase' }}>
                Temps Passé Cumulé
              </span>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#FFF8EC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Clock size={20} color="#F7AC37" />
              </div>
            </div>
            <div style={{ fontSize: '28px', fontWeight: 900, fontFamily: "'Ruda', sans-serif", color: '#F7AC37', lineHeight: 1 }}>
              {Math.floor(stats.totalMinutes / 60)}h{stats.totalMinutes % 60 > 0 ? String(stats.totalMinutes % 60).padStart(2, '0') : '00'}
            </div>
            <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#57778E' }}>
              Soit <b>{stats.totalMinutes} minutes</b> passées en contrôle
            </p>
          </div>
        </div>
      </div>

      {/* ================= SECTION 02 : SUIVI ANNUEL DES 12 MOIS DE MP ================= */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          padding: '22px 24px',
          border: '1.5px solid #E2EEF5',
          boxShadow: '0 4px 16px rgba(27, 69, 101, 0.04)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                backgroundColor: '#1B4565',
                color: '#FFFFFF',
                fontFamily: "'Ruda', sans-serif",
                fontSize: '12px',
                fontWeight: 800,
                padding: '3px 9px',
                borderRadius: '6px',
              }}
            >
              02
            </span>
            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, fontFamily: "'Ruda', sans-serif", color: '#1B4565' }}>
              Avancement Annuel de la Maintenance Préventive (12 Mois)
            </h3>
          </div>
          <span style={{ fontSize: '12.5px', color: '#57778E', fontStyle: 'italic' }}>
            Contrôles saisis (en haut) vs machines cochées au planning dans « Planning &amp; Fréquences » (en bas)
          </span>
        </div>

        {/* Grille des 12 mois */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))', gap: '10px' }}>
          {monthlyStats.map((m) => {
            const hasActivity = m.plannedCount > 0 || m.doneCount > 0;
            const isCompleted = m.plannedCount > 0 && m.doneCount >= m.plannedCount;
            const extraCount = m.doneCount > m.plannedCount ? m.doneCount - m.plannedCount : 0;

            return (
              <div
                key={m.monthNumber}
                title={`${m.label} : ${m.doneCount} contrôle(s) saisi(s) sur ${m.plannedCount} machine(s) cochée(s) au planning préventif`}
                style={{
                  backgroundColor: isCompleted ? '#EDFBF4' : hasActivity ? '#F8FCFE' : '#FAFCFD',
                  borderRadius: '12px',
                  padding: '12px 8px',
                  textAlign: 'center',
                  border: isCompleted ? '1.5px solid #00C875' : hasActivity ? '1.5px solid #D2E9F6' : '1px solid #E2EEF5',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <span
                  style={{
                    display: 'block',
                    fontSize: '11.5px',
                    fontWeight: 800,
                    fontFamily: "'Ruda', sans-serif",
                    color: '#3989B7',
                    textTransform: 'uppercase',
                    marginBottom: '4px',
                  }}
                >
                  {m.short}
                </span>

                <div>
                  <div style={{ fontSize: '18px', fontWeight: 900, fontFamily: "'Ruda', sans-serif", color: '#1B4565', lineHeight: 1.1 }}>
                    {m.doneCount}
                    <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#57778E', marginLeft: '3px' }}>
                      {m.doneCount > 1 ? 'faits' : 'fait'}
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#6C8CA3', fontWeight: 700, marginTop: '2px' }}>
                    {m.plannedCount > 0 ? `${m.plannedCount} ${m.plannedCount > 1 ? 'prévues' : 'prévue'}` : '0 prévue'}
                  </div>
                  {extraCount > 0 && (
                    <div
                      style={{
                        marginTop: '4px',
                        display: 'inline-block',
                        fontSize: '10px',
                        fontWeight: 800,
                        color: '#0E7042',
                        backgroundColor: '#D1FAE5',
                        borderRadius: '6px',
                        padding: '1px 6px',
                      }}
                    >
                      +{extraCount} hors plan.
                    </div>
                  )}
                </div>

                <div
                  style={{
                    marginTop: '7px',
                    height: '5px',
                    borderRadius: '3px',
                    backgroundColor: '#E2EEF5',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${m.plannedCount > 0 ? Math.min(100, Math.round((m.doneCount / m.plannedCount) * 100)) : m.doneCount > 0 ? 100 : 0}%`,
                      backgroundColor: isCompleted ? '#00C875' : '#39A9DC',
                      borderRadius: '3px',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ================= SECTION 03 : PLAN D'ACTION CURATIF (TICKETS DE RÉPARATION) ================= */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          padding: '22px 24px',
          border: '1.5px solid #E2EEF5',
          boxShadow: '0 4px 16px rgba(27, 69, 101, 0.04)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                backgroundColor: '#E2445C',
                color: '#FFFFFF',
                fontFamily: "'Ruda', sans-serif",
                fontSize: '12px',
                fontWeight: 800,
                padding: '3px 9px',
                borderRadius: '6px',
              }}
            >
              03
            </span>
            <div>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, fontFamily: "'Ruda', sans-serif", color: '#1B4565' }}>
                Plan d'Action Curatif &amp; Réparations Machines
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#57778E' }}>
                Tableau Monday « Réparation machines » (5106693291) synchronisé en temps réel
              </p>
            </div>
          </div>

          {/* Actions & Filtres par statut */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setIsSupplierModalOpen(true)}
              style={{
                padding: '7px 14px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#0073EA',
                color: '#FFFFFF',
                fontSize: '12px',
                fontWeight: 800,
                fontFamily: "'Ruda', sans-serif",
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 6px rgba(0, 115, 234, 0.25)',
              }}
            >
              <FileUp size={14} />
              Intégrer Bon Fournisseur (PDF)
            </button>
            {[
              { key: 'all' as const, label: `Tous (${repairTickets.length})` },
              { key: 'a_traiter' as const, label: `À traiter (${stats.activeRepairsCount})`, color: '#E2445C' },
              { key: 'reparee' as const, label: 'Réparées', color: '#00C875' },
            ].map((f) => {
              const isSel = statusFilter === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setStatusFilter(f.key)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: isSel ? `1.5px solid ${f.color || '#39A9DC'}` : '1px solid #D2E9F6',
                    backgroundColor: isSel ? (f.color || '#39A9DC') : '#FAFCFD',
                    color: isSel ? '#FFFFFF' : '#1B4565',
                    fontSize: '12px',
                    fontWeight: 800,
                    fontFamily: "'Ruda', sans-serif",
                    cursor: 'pointer',
                    transition: 'all 0.12s ease',
                  }}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Barre de recherche */}
        <div style={{ position: 'relative', marginBottom: '16px' }}>
          <Search size={16} color="#6C8CA3" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Rechercher une machine, une panne, un numéro..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '9px 12px 9px 38px',
              borderRadius: '10px',
              border: '1.5px solid #D2E9F6',
              fontSize: '13px',
              color: '#1B4565',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Liste des tickets de réparation */}
        {filteredTickets.length === 0 ? (
          <div
            style={{
              padding: '36px 20px',
              textAlign: 'center',
              backgroundColor: '#F8FAFC',
              borderRadius: '12px',
              border: '1px dashed #D2E9F6',
              color: '#57778E',
            }}
          >
            <CheckCircle2 size={32} color="#00C875" style={{ marginBottom: '8px' }} />
            <p style={{ margin: 0, fontWeight: 700, fontSize: '14px', color: '#1B4565' }}>
              Aucun ticket curatif à afficher pour ces critères.
            </p>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px' }}>
              Les réparations se créent automatiquement dès qu'un contrôle technique relève un point Non Conforme (NC).
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filteredTickets.map((t) => {
              const stLower = t.status.toLowerCase();
              const isReparee = stLower.includes('réparée') || stLower.includes('reparee');
              const isEnCours = stLower.includes('en cours') || stLower.includes('devis');

              let badgeBg = '#FDECEE';
              let badgeColor = '#E2445C';
              let badgeBorder = '#F5C6CB';

              if (isReparee) {
                badgeBg = '#E6F8F0';
                badgeColor = '#00C875';
                badgeBorder = '#00C875';
              } else if (isEnCours) {
                badgeBg = '#EBF6FC';
                badgeColor = '#39A9DC';
                badgeBorder = '#D2E9F6';
              }

              // Trouver machine correspondante
              const matchedMachine = machines.find(
                (m) =>
                  (t.machineId && m.id === t.machineId) ||
                  m.name.toLowerCase().trim() === t.machineName.toLowerCase().trim() ||
                  t.machineName.toLowerCase().includes(m.name.toLowerCase().slice(0, 10))
              );

              const parsedDesc = parseTicketDescription(t.description || '');
              const isSupplierTicket =
                parsedDesc.isStructuredSupplier ||
                /fournisseur|diversey|k[aä]rcher|nilfisk/i.test(t.name || '') ||
                /fournisseur/i.test(t.type || '');
              const isWarrantyTicket = parsedDesc.underWarranty;
              const isMisplacedInInRepairGroup =
                isReparee &&
                Boolean(t.groupTitle) &&
                t.groupTitle!.toLowerCase().includes('en r');

              return (
                <div
                  key={t.id}
                  style={{
                    backgroundColor: '#FAFCFD',
                    borderRadius: '12px',
                    padding: '16px 18px',
                    border: isReparee ? '1px solid #E2EEF5' : '1.5px solid #F5C6CB',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ flex: '1 1 320px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span
                          style={{
                            fontSize: '15px',
                            fontWeight: 800,
                            fontFamily: "'Ruda', sans-serif",
                            color: '#1B4565',
                          }}
                        >
                          {t.machineName}
                        </span>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 800,
                            padding: '3px 9px',
                            borderRadius: '10px',
                            backgroundColor: badgeBg,
                            color: badgeColor,
                            border: `1px solid ${badgeBorder}`,
                            fontFamily: "'Ruda', sans-serif",
                          }}
                        >
                          {t.status}
                        </span>
                        {isSupplierTicket && (
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 800,
                              padding: '3px 8px',
                              borderRadius: '10px',
                              backgroundColor: '#EFF6FF',
                              color: '#1D4ED8',
                              border: '1px solid #BFDBFE',
                              fontFamily: "'Ruda', sans-serif",
                            }}
                          >
                            🏭 {parsedDesc.supplier || 'Fournisseur'}
                          </span>
                        )}
                        {isWarrantyTicket && (
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 800,
                              padding: '3px 8px',
                              borderRadius: '10px',
                              backgroundColor: '#DCFCE7',
                              color: '#166534',
                              border: '1px solid #86EFAC',
                              fontFamily: "'Ruda', sans-serif",
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <ShieldCheck size={12} />
                            Sous garantie
                          </span>
                        )}
                        {parsedDesc.site && (
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '3px 8px',
                              borderRadius: '10px',
                              backgroundColor: '#F1F5F9',
                              color: '#334155',
                              border: '1px solid #CBD5E1',
                            }}
                          >
                            📍 {parsedDesc.site}
                          </span>
                        )}
                        {parsedDesc.parts.length > 0 && (
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '3px 8px',
                              borderRadius: '10px',
                              backgroundColor: '#FEF3C7',
                              color: '#92400E',
                              border: '1px solid #FDE68A',
                            }}
                          >
                            📦 {parsedDesc.parts.length === 1 && /pi[èe]ce\(s\)/i.test(parsedDesc.parts[0]) ? parsedDesc.parts[0] : `${parsedDesc.parts.length} pièce(s)`}
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '11.5px', color: '#6C8CA3', marginTop: '4px', display: 'block' }}>
                        📅 Signalé le {t.date || 'Non daté'} · Type : {t.type}
                        {t.groupTitle ? ` · Groupe : ${t.groupTitle}` : ''}
                      </span>
                    </div>

                    {/* Actions sur le ticket */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      {!isReparee && (
                        <button
                          type="button"
                          disabled={updatingTicketId === t.id}
                          onClick={() => handleMarkAsRepaired(t)}
                          style={{
                            padding: '7px 14px',
                            borderRadius: '8px',
                            backgroundColor: '#00C875',
                            color: '#FFFFFF',
                            border: 'none',
                            fontSize: '12px',
                            fontWeight: 800,
                            fontFamily: "'Ruda', sans-serif",
                            cursor: updatingTicketId === t.id ? 'not-allowed' : 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            boxShadow: '0 2px 6px rgba(0, 200, 117, 0.25)',
                          }}
                        >
                          <Check size={14} />
                          {updatingTicketId === t.id ? 'Mise à jour...' : 'Marquer comme Réparée'}
                        </button>
                      )}

                      {isMisplacedInInRepairGroup && (
                        <button
                          type="button"
                          disabled={updatingTicketId === t.id}
                          onClick={() => handleMoveToRepairedGroup(t)}
                          title="Déplacer cet élément dans le groupe Monday « Machine Réparé »"
                          style={{
                            padding: '7px 12px',
                            borderRadius: '8px',
                            backgroundColor: '#ECFDF5',
                            color: '#047857',
                            border: '1px solid #6EE7B7',
                            fontSize: '11.5px',
                            fontWeight: 800,
                            fontFamily: "'Ruda', sans-serif",
                            cursor: updatingTicketId === t.id ? 'not-allowed' : 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Check size={13} />
                          Ranger dans « Machine Réparé »
                        </button>
                      )}

                      {matchedMachine && (
                        <button
                          type="button"
                          onClick={() => onOpenInspection(matchedMachine.id)}
                          style={{
                            padding: '7px 12px',
                            borderRadius: '8px',
                            backgroundColor: '#FAFCFD',
                            color: '#39A9DC',
                            border: '1px solid #D2E9F6',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                          }}
                        >
                          <ClipboardCheck size={14} />
                          Contrôler
                        </button>
                      )}

                      {(isSupplierTicket || parsedDesc.parts.length > 0 || (t.description && t.description.length > 160)) && (
                        <button
                          type="button"
                          onClick={() => openTicketDetail(t)}
                          style={{
                            padding: '7px 10px',
                            borderRadius: '8px',
                            backgroundColor: '#EFF6FF',
                            color: '#0369A1',
                            border: '1px solid #BFDBFE',
                            fontSize: '11.5px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          📋 Détails
                        </button>
                      )}

                      <a
                        href={`https://groupefacility.monday.com/boards/5106693291/pulses/${t.id}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          padding: '7px 10px',
                          borderRadius: '8px',
                          backgroundColor: '#F0F5F8',
                          color: '#57778E',
                          textDecoration: 'none',
                          fontSize: '11.5px',
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <ExternalLink size={13} />
                        Monday
                      </a>
                    </div>
                  </div>

                  {/* Résumé essentiel uniquement (sans bouillie de champs techniques) */}
                  {parsedDesc.essentialText && (
                    <div
                      style={{
                        backgroundColor: '#FFFFFF',
                        borderRadius: '8px',
                        padding: '9px 13px',
                        border: '1px solid #E2EEF5',
                        fontSize: '12.5px',
                        color: '#1B4565',
                        lineHeight: 1.45,
                      }}
                    >
                      {parsedDesc.essentialText}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <SupplierImportModal
        isOpen={isSupplierModalOpen}
        onClose={() => setIsSupplierModalOpen(false)}
        machines={machines}
        repairTickets={repairTickets}
        getCol={getCol}
        onSuccess={onRefreshData}
      />

      {/* Modale Fiche Détaillée d'un Ticket & Historique Monday */}
      {detailTicket && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 39, 58, 0.58)',
            backdropFilter: 'blur(3px)',
            zIndex: 9998,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setDetailTicket(null);
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '720px',
              maxHeight: '88vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 24px 60px rgba(15, 39, 58, 0.25)',
              border: '1px solid #DDE7F0',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid #E2E8F0',
                backgroundColor: '#F8FBFD',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, fontFamily: "'Ruda', sans-serif", color: '#1B4565' }}>
                  {detailTicket.name}
                </h3>
                <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: '#57778E' }}>
                  📅 {detailTicket.date || 'Non daté'} · Type : <b>{detailTicket.type}</b> · Statut : <b>{detailTicket.status}</b>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailTicket(null)}
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
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '18px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {(() => {
                const detailParsed = parseTicketDescription(detailTicket.description || '');
                if (detailParsed.isStructuredSupplier) {
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '10px' }}>
                        {detailParsed.supplier && (
                          <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '9px 12px' }}>
                            <div style={{ fontSize: '10.5px', fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>Fournisseur</div>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: '#1B4565', marginTop: '2px' }}>
                              {detailParsed.supplier} {detailParsed.underWarranty ? '· 🛡️ Sous garantie' : ''}
                            </div>
                          </div>
                        )}
                        {detailParsed.site && (
                          <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '9px 12px' }}>
                            <div style={{ fontSize: '10.5px', fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>Site client</div>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: '#1B4565', marginTop: '2px' }}>{detailParsed.site}</div>
                          </div>
                        )}
                        {detailParsed.tech && (
                          <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '9px 12px' }}>
                            <div style={{ fontSize: '10.5px', fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>Technicien</div>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: '#1B4565', marginTop: '2px' }}>{detailParsed.tech}</div>
                          </div>
                        )}
                        {detailParsed.labor && (
                          <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '9px 12px' }}>
                            <div style={{ fontSize: '10.5px', fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>Main d&apos;œuvre / Dépl.</div>
                            <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#1B4565', marginTop: '2px' }}>{detailParsed.labor}</div>
                          </div>
                        )}
                      </div>

                      {detailParsed.parts.length > 0 && (
                        <div style={{ backgroundColor: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '10px', padding: '11px 14px' }}>
                          <div style={{ fontSize: '11.5px', fontWeight: 800, color: '#92400E', marginBottom: '6px' }}>
                            📦 Pièces / Matériaux remplacés
                          </div>
                          <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12.5px', color: '#1B4565', lineHeight: 1.55 }}>
                            {detailParsed.parts.map((part, idx) => (
                              <li key={idx}>{part}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {detailParsed.diagnostic && (
                        <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #DDE7F0', borderRadius: '10px', padding: '10px 14px', fontSize: '12.5px', color: '#334E68' }}>
                          <b>Diagnostic :</b> {detailParsed.diagnostic}
                        </div>
                      )}

                      {detailParsed.note && (
                        <div style={{ backgroundColor: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: '10px', padding: '11px 14px', fontSize: '13px', color: '#0C4A6E', lineHeight: 1.5 }}>
                          <b>📝 Compte-rendu :</b><br />
                          {detailParsed.note}
                        </div>
                      )}
                    </div>
                  );
                }

                if (!detailTicket.description) return null;
                return (
                  <div
                    style={{
                      backgroundColor: '#F8FAFC',
                      border: '1px solid #DDE7F0',
                      borderRadius: '10px',
                      padding: '12px 14px',
                      fontSize: '13px',
                      color: '#1B4565',
                      lineHeight: 1.5,
                      whiteSpace: 'pre-line',
                    }}
                  >
                    {detailTicket.description}
                  </div>
                );
              })()}

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 800, color: '#1B4565', marginBottom: '8px' }}>
                  <MessageSquare size={15} color="#0073EA" />
                  Fil d&apos;activité &amp; Comptes-rendus Monday
                </div>

                {loadingDetailUpdates ? (
                  <div style={{ fontSize: '12.5px', color: '#57778E', padding: '12px', backgroundColor: '#F8FAFC', borderRadius: '8px' }}>
                    Chargement de l&apos;historique Monday...
                  </div>
                ) : detailUpdates.length === 0 ? (
                  <div style={{ fontSize: '12.5px', color: '#64748B', padding: '12px', backgroundColor: '#F8FAFC', borderRadius: '8px', fontStyle: 'italic' }}>
                    Aucun commentaire enregistré dans le fil d&apos;activité de ce ticket.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {detailUpdates.map((u) => (
                      <div
                        key={u.id}
                        style={{
                          backgroundColor: '#FFFFFF',
                          border: '1px solid #DDE7F0',
                          borderLeft: '4px solid #0073EA',
                          borderRadius: '10px',
                          padding: '12px 14px',
                        }}
                      >
                        <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#57778E', marginBottom: '6px' }}>
                          👤 {u.creatorName} · {u.createdAt ? new Date(u.createdAt).toLocaleString('fr-FR') : ''}
                        </div>
                        <div style={{ fontSize: '12.5px', color: '#1B4565', lineHeight: 1.5, whiteSpace: 'pre-line' }}>
                          {u.textBody}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div
              style={{
                padding: '12px 20px',
                borderTop: '1px solid #E2E8F0',
                backgroundColor: '#F8FBFD',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <a
                href={`https://groupefacility.monday.com/boards/5106693291/pulses/${detailTicket.id}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: '#0073EA',
                  color: '#FFFFFF',
                  textDecoration: 'none',
                  borderRadius: '8px',
                  padding: '8px 14px',
                  fontSize: '12.5px',
                  fontWeight: 700,
                }}
              >
                <ExternalLink size={14} />
                Ouvrir la fiche complète sur Monday
              </a>
              <button
                type="button"
                onClick={() => setDetailTicket(null)}
                style={{
                  backgroundColor: '#FFFFFF',
                  color: '#475569',
                  border: '1px solid #CBD5E1',
                  borderRadius: '8px',
                  padding: '8px 14px',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

