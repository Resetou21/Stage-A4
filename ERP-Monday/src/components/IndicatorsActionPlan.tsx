import React, { useState, useMemo } from 'react';
import {
  Wrench,
  CheckCircle2,
  Clock,
  Search,
  ClipboardCheck,
  RefreshCw,
  Check,
  FileUp,
  ShieldCheck,
  X,
  MessageSquare,
  Euro,
  Timer,
  History,
  Archive,
} from 'lucide-react';
import type { Machine } from '../types';
import {
  RealisedControle,
  RepairTicket,
  RepairChecklistItem,
  TicketUpdateItem,
  MONTH_COLUMN_IDS,
  fetchRepairBoardMeta,
  moveRepairItemToGroup,
  fetchTicketUpdates,
  parseRepairChecklist,
  saveRepairChecklistAndProgress,
  updateRepairCost,
} from '../services/maintenanceApi';
import { SupplierImportModal } from './SupplierImportModal';

function computeDaysBetween(startIso?: string, endIso?: string): number | null {
  if (!startIso) return null;
  const sMatch = String(startIso).match(/^(\d{4}-\d{2}-\d{2})/);
  if (!sMatch) return null;
  const start = new Date(`${sMatch[1]}T00:00:00`);
  const end = endIso && /^\d{4}-\d{2}-\d{2}/.test(endIso)
    ? new Date(`${endIso.slice(0, 10)}T00:00:00`)
    : new Date();
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
}

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
  const [localChecklists, setLocalChecklists] = useState<Record<string, RepairChecklistItem[]>>({});
  const [savingChecklistId, setSavingChecklistId] = useState<string | null>(null);
  const [costInput, setCostInput] = useState<string>('');
  const [savingCost, setSavingCost] = useState(false);
  const currentCalendarYear = new Date().getFullYear();
  const [selectedKpiYear, setSelectedKpiYear] = useState<number | 'all'>(() => currentCalendarYear);
  const [selectedPreventiveYear, setSelectedPreventiveYear] = useState<number>(() => currentCalendarYear);

  const getTicketChecklist = (ticket: RepairTicket): RepairChecklistItem[] => {
    if (localChecklists[ticket.id]) return localChecklists[ticket.id];
    if (ticket.checklist && ticket.checklist.length > 0) return ticket.checklist;
    return parseRepairChecklist(ticket.description || '');
  };

  const openTicketDetail = async (ticket: RepairTicket) => {
    setDetailTicket(ticket);
    setCostInput(ticket.cost !== undefined ? String(ticket.cost) : '');
    setDetailUpdates([]);
    setLoadingDetailUpdates(true);
    const updates = await fetchTicketUpdates(ticket.id);
    setDetailUpdates(updates);
    setLoadingDetailUpdates(false);
  };

  const handleToggleChecklistItem = async (ticket: RepairTicket, itemId: string) => {
    const currentList = getTicketChecklist(ticket);
    const updatedList = currentList.map((it) =>
      it.id === itemId ? { ...it, checked: !it.checked } : it
    );
    setLocalChecklists((prev) => ({ ...prev, [ticket.id]: updatedList }));
    setSavingChecklistId(ticket.id);

    const parsedCostVal =
      detailTicket?.id === ticket.id && costInput.trim() !== '' && !Number.isNaN(Number(costInput))
        ? Number(costInput)
        : ticket.cost;

    const res = await saveRepairChecklistAndProgress(ticket, updatedList, { cost: parsedCostVal });
    setSavingChecklistId(null);

    if (res.success) {
      if (detailTicket?.id === ticket.id) {
        setDetailTicket((prev) =>
          prev
            ? {
                ...prev,
                checklist: updatedList,
                status: res.newStatus || prev.status,
                description: res.newDescription || prev.description,
              }
            : null
        );
      }
      if (res.autoCompleted) {
        setSuccessToast(
          `Tous les points de "${ticket.machineName}" sont cochés ➔ Ticket passé automatiquement en Réparée / Conforme !`
        );
      }
      await onRefreshData();
    } else {
      alert(`Erreur sauvegarde checklist : ${res.error}`);
    }
  };

  const handleSaveDetailCost = async () => {
    if (!detailTicket) return;
    const numeric = costInput.trim() === '' ? undefined : Number(costInput.replace(',', '.'));
    if (numeric !== undefined && Number.isNaN(numeric)) return;
    setSavingCost(true);
    const res = await updateRepairCost(detailTicket, numeric);
    setSavingCost(false);
    if (res.success) {
      setDetailTicket((prev) =>
        prev
          ? { ...prev, cost: numeric, description: res.newDescription || prev.description }
          : null
      );
      setSuccessToast(`Coût mis à jour (${numeric !== undefined ? `${numeric.toFixed(2)} € HT` : 'effacé'}).`);
      await onRefreshData();
    } else {
      alert(`Erreur mise à jour coût : ${res.error}`);
    }
  };

  // Helper pour récupérer le texte d'une colonne
  const getCol = (m: Machine, colId: string): string => {
    return m.column_values?.find((c) => c.id === colId)?.text?.trim() || '';
  };

  // 1. STATS GÉNÉRALES & TAUX DE CONFORMITÉ (filtrées par Exercice annuel, reset auto le 1er janvier)
  const kpiYearOptions = useMemo(() => {
    const yrs = new Set<number>([currentCalendarYear, currentCalendarYear - 1]);
    realisedControles.forEach((c) => {
      const y = Number((c.date || '').slice(0, 4));
      if (!Number.isNaN(y) && y > 2020) yrs.add(y);
    });
    repairTickets.forEach((t) => {
      [t.date, t.repairedDate].forEach((d) => {
        const y = Number((d || '').slice(0, 4));
        if (!Number.isNaN(y) && y > 2020) yrs.add(y);
      });
    });
    return Array.from(yrs).sort((a, b) => b - a);
  }, [currentCalendarYear, realisedControles, repairTickets]);

  const stats = useMemo(() => {
    const matchesKpiYear = (dateStr?: string) => {
      if (selectedKpiYear === 'all') return true;
      const y = Number((dateStr || '').slice(0, 4));
      return y === selectedKpiYear;
    };

    const scopedControles = selectedKpiYear === 'all'
      ? realisedControles
      : realisedControles.filter((c) => matchesKpiYear(c.date));
    const scopedRepairs = selectedKpiYear === 'all'
      ? repairTickets
      : repairTickets.filter((t) => matchesKpiYear(t.date) || matchesKpiYear(t.repairedDate));

    const totalControles = scopedControles.length;
    let vertCount = 0;
    let orangeCount = 0;
    let rougeCount = 0;
    let totalMinutes = 0;

    scopedControles.forEach((c) => {
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

    // Tickets curatifs & délais & coûts
    const isRepairedTicket = (t: RepairTicket) =>
      t.status.toLowerCase().includes('réparée') || t.status.toLowerCase().includes('reparee');

    const allActiveRepairsCount = repairTickets.filter((t) => !isRepairedTicket(t)).length;
    const activeRepairs = scopedRepairs.filter((t) => !isRepairedTicket(t));
    const repairedTickets = scopedRepairs.filter((t) => isRepairedTicket(t));

    const resolvedDurations = repairedTickets
      .map((t) => computeDaysBetween(t.date, t.repairedDate || t.updatedAt))
      .filter((d): d is number => d !== null);
    const avgResolutionDays =
      resolvedDurations.length > 0
        ? Math.round((resolvedDurations.reduce((a, b) => a + b, 0) / resolvedDurations.length) * 10) / 10
        : null;

    const activeImmobDays = activeRepairs
      .map((t) => computeDaysBetween(t.date))
      .filter((d): d is number => d !== null);
    const avgActiveImmobDays =
      activeImmobDays.length > 0
        ? Math.round((activeImmobDays.reduce((a, b) => a + b, 0) / activeImmobDays.length) * 10) / 10
        : 0;
    const maxActiveImmobDays = activeImmobDays.length > 0 ? Math.max(...activeImmobDays) : 0;

    // Estimation réaliste délai restant (bornée pour éviter la dérive liée à d'anciens tickets archivés)
    const baseAvgDays = avgResolutionDays !== null ? Math.min(avgResolutionDays, 15) : 3;
    const remainingTasksCount = activeRepairs.reduce((sum, t) => {
      const chk = getTicketChecklist(t);
      const pending = chk.filter((c) => !c.checked).length;
      return sum + (chk.length > 0 ? pending : 1);
    }, 0);
    const estimatedCompletionDays =
      activeRepairs.length === 0 ? 0 : Math.max(1, Math.round(baseAvgDays * Math.min(activeRepairs.length, 3)));

    let totalCostHT = 0;
    let supplierCostHT = 0;
    let internalCostHT = 0;
    let pricedTicketsCount = 0;
    scopedRepairs.forEach((t) => {
      if (t.cost !== undefined && !Number.isNaN(t.cost)) {
        totalCostHT += t.cost;
        pricedTicketsCount++;
        const txtForSup = `${t.fournisseur || ''} ${t.type || ''} ${t.name || ''} ${t.description || ''}`.toLowerCase();
        const isExplicitInterne =
          /mode\s*r[ée]paration\s*:\s*r[ée]paration\s*en\s*interne/i.test(t.description || '') ||
          /^interne$/i.test((t.fournisseur || '').trim());
        const isSup =
          Boolean(t.fournisseur && !/interne/i.test(t.fournisseur)) ||
          (!isExplicitInterne &&
            /(fournisseur|externe|facture|devis|sogem|nilfisk|karcher|taski|numatic|lavor|hako|dema|prodim)/i.test(txtForSup));
        if (isSup) supplierCostHT += t.cost;
        else internalCostHT += t.cost;
      }
    });

    return {
      totalControles,
      vertCount,
      orangeCount,
      rougeCount,
      conformitePercent,
      totalMinutes,
      activeRepairsCount: activeRepairs.length,
      allActiveRepairsCount,
      totalRepairsCount: scopedRepairs.length,
      avgResolutionDays,
      repairedCount: repairedTickets.length,
      avgActiveImmobDays,
      maxActiveImmobDays,
      remainingTasksCount,
      estimatedCompletionDays,
      totalCostHT,
      supplierCostHT,
      internalCostHT,
      pricedTicketsCount,
    };
  }, [realisedControles, repairTickets, localChecklists, selectedKpiYear]);

  // 2. SUIVI MENSUEL DES MAINTENANCES PRÉVENTIVES (12 MOIS, AVEC ARCHIVE ANNÉE PRÉCÉDENTE)
  const preventiveYearOptions = useMemo(() => {
    const yrs = new Set<number>([currentCalendarYear, currentCalendarYear - 1]);
    realisedControles.forEach((c) => {
      const y = Number((c.date || '').split('-')[0]);
      if (!Number.isNaN(y) && y > 2020) yrs.add(y);
    });
    return Array.from(yrs).sort((a, b) => b - a);
  }, [currentCalendarYear, realisedControles]);

  const monthlyStats = useMemo(() => {
    let archivedMap: Record<string, { isPreventive?: boolean; months?: Record<number, boolean> }> | null = null;
    if (selectedPreventiveYear !== currentCalendarYear) {
      try {
        const raw = localStorage.getItem(`facility_preventive_archive_${selectedPreventiveYear}`);
        if (raw) archivedMap = JSON.parse(raw)?.machines || null;
      } catch {}
    }

    return Object.entries(MONTH_COLUMN_IDS).map(([mNumStr, meta]) => {
      const mNum = parseInt(mNumStr, 10);

      // Machines programmées (soit archive pour année passée, soit live sur l'année active)
      const plannedCount = archivedMap
        ? Object.values(archivedMap).filter((entry) => entry.isPreventive && entry.months?.[mNum]).length
        : machines.filter((m) => {
            const col = m.column_values?.find((c) => c.id === meta.id);
            const txt = col?.text?.toLowerCase() || '';
            return txt.includes('v') || txt.includes('true') || txt === '1' || txt.includes('coch');
          }).length;

      // Contrôles effectivement réalisés pour ce mois de l'année sélectionnée
      const doneCount = realisedControles.filter((c) => {
        if (!c.date) return false;
        const [y, m] = c.date.split('-').map(Number);
        return y === selectedPreventiveYear && m === mNum;
      }).length;

      return {
        monthNumber: mNum,
        label: meta.label,
        short: meta.short,
        plannedCount,
        doneCount,
      };
    });
  }, [machines, realisedControles, selectedPreventiveYear, currentCalendarYear]);

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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Archive size={14} color="#3989B7" />
              <select
                value={selectedKpiYear === 'all' ? 'all' : String(selectedKpiYear)}
                onChange={(e) => setSelectedKpiYear(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                title="Reset annuel au 31 décembre : chaque nouvel exercice démarre à 0 tout en conservant les archives."
                style={{
                  padding: '6px 10px',
                  borderRadius: '8px',
                  border: '1.5px solid #D2E9F6',
                  backgroundColor: '#FAFCFD',
                  color: '#1B4565',
                  fontSize: '12px',
                  fontWeight: 800,
                  fontFamily: "'Ruda', sans-serif",
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                {kpiYearOptions.map((y) => (
                  <option key={y} value={String(y)}>
                    {y === currentCalendarYear ? `Exercice ${y} (En cours)` : `Archive ${y}`}
                  </option>
                ))}
                <option value="all">Toutes années (Cumulé)</option>
              </select>
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
        </div>
        <p style={{ margin: '-10px 0 14px 0', fontSize: '11.5px', color: '#57778E' }}>
          Périmètre affiché : <b>{selectedKpiYear === 'all' ? 'Historique complet (toutes années)' : `Exercice ${selectedKpiYear}`}</b> · Remise à zéro automatique le <b>31 décembre</b> (archives conservées ci-contre).
        </p>

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
              Soit <b>{stats.totalMinutes} min</b> issues des <i>Fiches de Contrôle</i>
            </p>
          </div>

          {/* Card 5 : Délais Panne -> Réparation & Immobilisation en cours */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '14px',
              padding: '18px 20px',
              border: stats.maxActiveImmobDays > 14 ? '1.5px solid #F7AC37' : '1.5px solid #FDE2B8',
              boxShadow: '0 2px 10px rgba(27, 69, 101, 0.04)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '12px', fontWeight: 800, fontFamily: "'Ruda', sans-serif", color: '#D66927', textTransform: 'uppercase' }}>
                Délai Panne ➔ Réparation
              </span>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#FFF8EC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Timer size={20} color="#D66927" />
              </div>
            </div>
            <div style={{ fontSize: '26px', fontWeight: 900, fontFamily: "'Ruda', sans-serif", color: '#1B4565', lineHeight: 1 }}>
              {stats.avgResolutionDays !== null ? `${stats.avgResolutionDays} j` : `${stats.avgActiveImmobDays} j`}
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#3989B7', marginLeft: '6px', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                {stats.avgResolutionDays !== null ? `moy. (${stats.repairedCount} résolue(s))` : 'immob. moy.'}
              </span>
            </div>
            <p style={{ margin: '8px 0 0 0', fontSize: '11.5px', color: '#57778E', lineHeight: 1.4 }}>
              Immob. active ({selectedKpiYear === 'all' ? 'cumul' : selectedKpiYear}) : <b>{stats.avgActiveImmobDays} j moy.</b> (max {stats.maxActiveImmobDays} j)
              <br />
              Charge restante : <b>{stats.remainingTasksCount} point(s)</b> (~{stats.estimatedCompletionDays} j)
              {stats.activeRepairsCount === 0 && stats.allActiveRepairsCount > 0 ? (
                <> · <i>{stats.allActiveRepairsCount} reliquat(s) antérieur(s) en Archive</i></>
              ) : null}
            </p>
          </div>

          {/* Card 6 : Coût Entretien & Réparations */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '14px',
              padding: '18px 20px',
              border: '1.5px solid #D2E9F6',
              boxShadow: '0 2px 10px rgba(27, 69, 101, 0.04)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '12px', fontWeight: 800, fontFamily: "'Ruda', sans-serif", color: '#3989B7', textTransform: 'uppercase' }}>
                Coût Entretien &amp; Réparations
              </span>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#EBF6FC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Euro size={20} color="#39A9DC" />
              </div>
            </div>
            <div style={{ fontSize: '26px', fontWeight: 900, fontFamily: "'Ruda', sans-serif", color: '#3989B7', lineHeight: 1 }}>
              {stats.totalCostHT.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €{' '}
              <span style={{ fontSize: '12px', fontWeight: 700 }}>HT</span>
            </div>
            <p style={{ margin: '8px 0 0 0', fontSize: '11.5px', color: '#57778E', lineHeight: 1.4 }}>
              Fournisseurs : <b>{stats.supplierCostHT.toFixed(0)} €</b> · Interne : <b>{stats.internalCostHT.toFixed(0)} €</b>
              <br />
              Sur <b>{stats.pricedTicketsCount}</b> ticket(s) &amp; factures PDF chiffrés
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: '14px',
                border: '1px solid #D2E9F6',
                backgroundColor: selectedPreventiveYear !== currentCalendarYear ? '#FFF8EC' : '#F8FCFE',
                fontSize: '12px',
                fontWeight: 700,
                color: '#1B4565',
              }}
            >
              <Archive size={13} color={selectedPreventiveYear !== currentCalendarYear ? '#D66927' : '#39A9DC'} />
              <span>Année :</span>
              <select
                value={selectedPreventiveYear}
                onChange={(e) => setSelectedPreventiveYear(Number(e.target.value))}
                style={{
                  border: 'none',
                  background: 'transparent',
                  fontWeight: 800,
                  color: '#1B4565',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                {preventiveYearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y} {y === currentCalendarYear ? '(En cours · RAZ 1er janv.)' : '(Archive)'}
                  </option>
                ))}
              </select>
            </div>
            <span style={{ fontSize: '12px', color: '#57778E', fontStyle: 'italic' }}>
              Contrôles saisis vs planning {selectedPreventiveYear}
            </span>
          </div>
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

              const checklist = getTicketChecklist(t);
              const doneChecklistCount = checklist.filter((c) => c.checked).length;
              const totalChecklistCount = checklist.length;
              const progressPct =
                totalChecklistCount > 0 ? Math.round((doneChecklistCount / totalChecklistCount) * 100) : isReparee ? 100 : 0;

              const immobDays = isReparee
                ? computeDaysBetween(t.date, t.repairedDate || t.updatedAt)
                : computeDaysBetween(t.date);

              return (
                <div
                  key={t.id}
                  onClick={() => openTicketDetail(t)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openTicketDetail(t);
                    }
                  }}
                  style={{
                    backgroundColor: '#FAFCFD',
                    borderRadius: '12px',
                    padding: '16px 18px',
                    border: isReparee ? '1px solid #C8E6D6' : '1.5px solid #F5C6CB',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    transition: 'all 0.15s ease',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = '0 4px 14px rgba(27, 69, 101, 0.08)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.transform = 'translateY(0)';
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
                        {immobDays !== null && (
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 800,
                              padding: '3px 8px',
                              borderRadius: '10px',
                              backgroundColor: isReparee ? '#E6F9F0' : immobDays >= 14 ? '#FDECEE' : '#FFF8EC',
                              color: isReparee ? '#0E7042' : immobDays >= 14 ? '#961C2E' : '#D66927',
                              border: `1px solid ${isReparee ? '#9FE6C6' : immobDays >= 14 ? '#F5C6CB' : '#F7AC37'}`,
                              fontFamily: "'Ruda', sans-serif",
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <Timer size={11} />
                            {isReparee ? `Réparée en ${immobDays} j` : `Immobilisée depuis ${immobDays} j`}
                          </span>
                        )}
                        {t.cost !== undefined && (
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 800,
                              padding: '3px 8px',
                              borderRadius: '10px',
                              backgroundColor: '#EBF6FC',
                              color: '#3989B7',
                              border: '1px solid #D2E9F6',
                              fontFamily: "'Ruda', sans-serif",
                            }}
                          >
                            💶 {t.cost.toFixed(2)} € HT
                          </span>
                        )}
                        {isSupplierTicket && (
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 800,
                              padding: '3px 8px',
                              borderRadius: '10px',
                              backgroundColor: '#EBF6FC',
                              color: '#1B4565',
                              border: '1px solid #D2E9F6',
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
                      </div>
                      <span style={{ fontSize: '11.5px', color: '#6C8CA3', marginTop: '4px', display: 'block' }}>
                        📅 Signalé le {t.date || 'Non daté'} · Type : {t.type} · Cliquez sur la fiche pour cocher les points NC &amp; voir l&apos;historique
                      </span>
                    </div>

                    {/* Actions rapides sur le ticket (sans bouton Marquer Réparée ni lien externe Monday) */}
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {isMisplacedInInRepairGroup && (
                        <button
                          type="button"
                          disabled={updatingTicketId === t.id}
                          onClick={() => handleMoveToRepairedGroup(t)}
                          title="Déplacer cet élément dans le groupe « Machine Réparé »"
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
                          Archiver « Réparé »
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

                      <button
                        type="button"
                        onClick={() => openTicketDetail(t)}
                        style={{
                          padding: '7px 12px',
                          borderRadius: '8px',
                          backgroundColor: '#EFF6FF',
                          color: '#0369A1',
                          border: '1px solid #BFDBFE',
                          fontSize: '12px',
                          fontWeight: 800,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        Ouvrir fiche &amp; points NC
                      </button>
                    </div>
                  </div>

                  {/* Barre de progression des sous-points NC sur la carte */}
                  {totalChecklistCount > 0 && (
                    <div
                      style={{
                        backgroundColor: '#FFFFFF',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        border: '1px solid #E2EEF5',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '5px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11.5px', fontWeight: 700, color: '#1B4565' }}>
                        <span>Avancement points non conformes à traiter</span>
                        <span style={{ color: progressPct === 100 ? '#059669' : '#D97706', fontWeight: 800 }}>
                          {doneChecklistCount} / {totalChecklistCount} ({progressPct}%)
                        </span>
                      </div>
                      <div style={{ width: '100%', height: '7px', borderRadius: '999px', backgroundColor: '#E2E8F0', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${progressPct}%`,
                            height: '100%',
                            backgroundColor: progressPct === 100 ? '#00C875' : '#39A9DC',
                            borderRadius: '999px',
                            transition: 'width 0.25s ease',
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Résumé essentiel */}
                  {totalChecklistCount === 0 && parsedDesc.essentialText && (
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

      {/* Modale Fiche Détaillée d'un Ticket + Checklist NC + Historique Contrôles Machine */}
      {detailTicket && (() => {
        const detailChecklist = getTicketChecklist(detailTicket);
        const detailDone = detailChecklist.filter((c) => c.checked).length;
        const detailTotal = detailChecklist.length;
        const detailPct = detailTotal > 0 ? Math.round((detailDone / detailTotal) * 100) : 0;
        const detailIsRepaired =
          detailTicket.status.toLowerCase().includes('réparée') || detailTicket.status.toLowerCase().includes('reparee');
        const detailImmob = detailIsRepaired
          ? computeDaysBetween(detailTicket.date, detailTicket.repairedDate || detailTicket.updatedAt)
          : computeDaysBetween(detailTicket.date);
        const detailRawName = (detailTicket.machineName || detailTicket.name || '').trim();
        const detailCleanHint = detailRawName
          .replace(/^(r[ée]paration|panne|intervention|curative?)\s*[-–:]\s*/i, '')
          .replace(/\s*[-–]\s*\d{2}[\/\-]\d{2}[\/\-]\d{2,4}.*$/, '')
          .trim()
          .toLowerCase();
        const detailModelMatch = detailCleanHint.match(/[a-z]{1,4}\s?\d{2,4}/i)?.[0]?.replace(/\s+/g, '') || '';

        const matchedMachine = machines.find((m) => {
          if (detailTicket.machineId && String(m.id) === String(detailTicket.machineId)) return true;
          const mNorm = m.name.trim().toLowerCase();
          const mNoCode = mNorm.replace(/^\d+\s*[-–]\s*/, '').trim();
          if (detailCleanHint.length >= 4 && (mNorm.includes(detailCleanHint) || detailCleanHint.includes(mNoCode))) {
            return true;
          }
          if (detailModelMatch.length >= 4) {
            return mNorm.replace(/\s+/g, '').includes(detailModelMatch);
          }
          return false;
        });

        const machineControlsHistory = realisedControles
          .filter((c) => {
            const targetId = detailTicket.machineId || matchedMachine?.id;
            if (targetId && c.machineId && String(c.machineId) === String(targetId)) return true;
            const cName = (c.machineName || c.name || '').trim().toLowerCase();
            if (detailCleanHint.length >= 4 && (cName === detailCleanHint || cName.includes(detailCleanHint))) return true;
            if (detailModelMatch.length >= 4 && cName.replace(/\s+/g, '').includes(detailModelMatch)) return true;
            return false;
          })
          .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

        return (
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
                maxWidth: '780px',
                maxHeight: '90vh',
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
                    {detailTicket.machineName} — {detailTicket.name}
                  </h3>
                  <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#57778E', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <span>📅 Panne déclarée : <b>{detailTicket.date || 'Non datée'}</b></span>
                    <span>🔧 Statut : <b style={{ color: detailIsRepaired ? '#059669' : '#DC2626' }}>{detailIsRepaired ? 'Conforme / Réparée' : detailTicket.status}</b></span>
                    {detailImmob !== null && (
                      <span>⏱️ {detailIsRepaired ? `Réparée en ${detailImmob} j` : `Immobilisée depuis ${detailImmob} j`}</span>
                    )}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  {matchedMachine && (
                    <button
                      type="button"
                      onClick={() => onOpenInspection(matchedMachine.id)}
                      title="Ouvrir la fiche de contrôle technique complète pour cette machine"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '7px 13px',
                        borderRadius: '9px',
                        backgroundColor: '#39A9DC',
                        color: '#FFFFFF',
                        border: 'none',
                        fontSize: '12.5px',
                        fontWeight: 800,
                        fontFamily: "'Ruda', sans-serif",
                        cursor: 'pointer',
                        boxShadow: '0 2px 8px rgba(57, 169, 220, 0.25)',
                      }}
                    >
                      <ClipboardCheck size={15} />
                      <span>Fiche de contrôle</span>
                    </button>
                  )}
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
              </div>

              <div style={{ padding: '18px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* 1. Checklist interactive des points Non Conformes & Barre de progression */}
                {detailChecklist.length > 0 && (
                  <div
                    style={{
                      backgroundColor: '#F8FCFE',
                      border: `1.5px solid ${detailPct === 100 ? '#6EE7B7' : '#BFDBFE'}`,
                      borderRadius: '12px',
                      padding: '14px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#1B4565', fontFamily: "'Ruda', sans-serif" }}>
                        ✅ Sous-points Non Conformes à réparer ({detailDone} / {detailTotal} · {detailPct}%)
                      </div>
                      <span style={{ fontSize: '11.5px', fontWeight: 700, color: detailPct === 100 ? '#059669' : '#0369A1' }}>
                        {savingChecklistId === detailTicket.id
                          ? 'Synchronisation...'
                          : detailPct === 100
                          ? 'Tous les points cochés ➔ Machine passée en Conforme !'
                          : 'Cochez chaque point réparé pour passer en Conforme'}
                      </span>
                    </div>

                    <div style={{ width: '100%', height: '9px', borderRadius: '999px', backgroundColor: '#E2E8F0', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${detailPct}%`,
                          height: '100%',
                          backgroundColor: detailPct === 100 ? '#00C875' : '#39A9DC',
                          borderRadius: '999px',
                          transition: 'width 0.25s ease',
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {detailChecklist.map((chk) => (
                        <label
                          key={chk.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '9px 12px',
                            borderRadius: '8px',
                            backgroundColor: chk.checked ? '#ECFDF5' : '#FFFFFF',
                            border: `1px solid ${chk.checked ? '#A7F3D0' : '#DDE7F0'}`,
                            cursor: 'pointer',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={chk.checked}
                            onChange={() => handleToggleChecklistItem(detailTicket, chk.id)}
                            style={{ width: '17px', height: '17px', accentColor: '#00C875', cursor: 'pointer' }}
                          />
                          <div style={{ flex: 1 }}>
                            <div
                              style={{
                                fontSize: '13px',
                                fontWeight: 700,
                                color: chk.checked ? '#065F46' : '#1B4565',
                                textDecoration: chk.checked ? 'line-through' : 'none',
                              }}
                            >
                              {chk.label}
                            </div>
                            {chk.action && (
                              <div style={{ fontSize: '11.5px', color: '#475569', marginTop: '2px' }}>
                                Action prévue : {chk.action}
                              </div>
                            )}
                          </div>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 800,
                              padding: '2px 8px',
                              borderRadius: '8px',
                              backgroundColor: chk.checked ? '#DCFCE7' : '#FEE2E2',
                              color: chk.checked ? '#047857' : '#DC2626',
                            }}
                          >
                            {chk.checked ? 'Conforme' : 'Non conforme'}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. Coût de réparation (€ HT) */}
                <div
                  style={{
                    backgroundColor: '#EBF6FC',
                    border: '1px solid #D2E9F6',
                    borderRadius: '10px',
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', fontWeight: 800, color: '#3989B7', fontFamily: "'Ruda', sans-serif" }}>
                    <Euro size={15} color="#39A9DC" />
                    Coût intervention / réparation (€ HT) :
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={costInput}
                      onChange={(e) => setCostInput(e.target.value)}
                      placeholder="Ex: 185.00"
                      style={{
                        width: '120px',
                        padding: '6px 10px',
                        borderRadius: '8px',
                        border: '1px solid #39A9DC',
                        fontSize: '13px',
                        fontWeight: 700,
                        color: '#1B4565',
                      }}
                    />
                    <button
                      type="button"
                      disabled={savingCost}
                      onClick={handleSaveDetailCost}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        border: 'none',
                        backgroundColor: '#39A9DC',
                        color: '#FFFFFF',
                        fontSize: '12px',
                        fontWeight: 800,
                        fontFamily: "'Ruda', sans-serif",
                        cursor: 'pointer',
                      }}
                    >
                      {savingCost ? 'Enregistrement...' : 'Enregistrer coût'}
                    </button>
                  </div>
                </div>

                {/* 2b. Fiche Technique & Données Machine (Liste des machines) */}
                {matchedMachine && (
                  <div
                    style={{
                      backgroundColor: '#F8FCFE',
                      border: '1px solid #D2E9F6',
                      borderRadius: '10px',
                      padding: '11px 14px',
                    }}
                  >
                    <div style={{ fontSize: '12px', fontWeight: 800, color: '#1B4565', fontFamily: "'Ruda', sans-serif", marginBottom: '8px' }}>
                      Données Machine &amp; Fiche Technique — {matchedMachine.name}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: '8px' }}>
                      <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2EEF5', borderRadius: '7px', padding: '6px 9px' }}>
                        <div style={{ fontSize: '10px', fontWeight: 800, color: '#57778E', textTransform: 'uppercase' }}>Type</div>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#1B4565' }}>{getCol(matchedMachine, 'color_mm8t2mn5') || '—'}</div>
                      </div>
                      <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2EEF5', borderRadius: '7px', padding: '6px 9px' }}>
                        <div style={{ fontSize: '10px', fontWeight: 800, color: '#57778E', textTransform: 'uppercase' }}>Site d&apos;affectation</div>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#1B4565' }}>{getCol(matchedMachine, 'dropdown_mm8d4vj2') || '—'}</div>
                      </div>
                      <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2EEF5', borderRadius: '7px', padding: '6px 9px' }}>
                        <div style={{ fontSize: '10px', fontWeight: 800, color: '#57778E', textTransform: 'uppercase' }}>Statut parc</div>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#1B4565' }}>{getCol(matchedMachine, 'color_mm8dremb') || '—'}</div>
                      </div>
                      <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2EEF5', borderRadius: '7px', padding: '6px 9px' }}>
                        <div style={{ fontSize: '10px', fontWeight: 800, color: '#57778E', textTransform: 'uppercase' }}>Heures compteur</div>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#1B4565' }}>
                          {getCol(matchedMachine, 'numeric_mm8v97ja') ? `${getCol(matchedMachine, 'numeric_mm8v97ja')} h` : '—'}
                        </div>
                      </div>
                      <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2EEF5', borderRadius: '7px', padding: '6px 9px' }}>
                        <div style={{ fontSize: '10px', fontWeight: 800, color: '#57778E', textTransform: 'uppercase' }}>Maintenance prév.</div>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#1B4565' }}>
                          {getCol(matchedMachine, 'color_mm8t3v6z') || getCol(matchedMachine, 'boolean_mm8tv8zy') || '—'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. Données détaillées du ticket / fournisseur */}
                {(() => {
                  const detailParsed = parseTicketDescription(detailTicket.description || '');
                  if (detailParsed.isStructuredSupplier) {
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: '8px' }}>
                          {(detailTicket.fournisseur || detailParsed.supplier) && (
                            <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '8px 11px' }}>
                              <div style={{ fontSize: '10px', fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>Fournisseur</div>
                              <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#1B4565' }}>
                                {detailTicket.fournisseur || detailParsed.supplier} {detailParsed.underWarranty ? '· 🛡️ Garantie' : ''}
                              </div>
                            </div>
                          )}
                          {(detailTicket.site || detailParsed.site) && (
                            <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '8px 11px' }}>
                              <div style={{ fontSize: '10px', fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>Site</div>
                              <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#1B4565' }}>{detailTicket.site || detailParsed.site}</div>
                            </div>
                          )}
                          {detailTicket.numeroBon && (
                            <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '8px 11px' }}>
                              <div style={{ fontSize: '10px', fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>N° Bon / OS</div>
                              <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#1B4565' }}>{detailTicket.numeroBon}</div>
                            </div>
                          )}
                        </div>
                        {detailParsed.note && (
                          <div style={{ backgroundColor: '#EBF6FC', border: '1px solid #D2E9F6', borderRadius: '10px', padding: '10px 13px', fontSize: '12.5px', color: '#1B4565', lineHeight: 1.45 }}>
                            <b>📝 Résumé :</b> {detailParsed.note}
                          </div>
                        )}
                      </div>
                    );
                  }
                  if (!detailTicket.description && detailChecklist.length === 0) {
                    return (
                      <div
                        style={{
                          backgroundColor: '#FFF8EC',
                          border: '1px solid #FDE2B8',
                          borderRadius: '10px',
                          padding: '10px 14px',
                          fontSize: '12px',
                          color: '#9A4A1A',
                          lineHeight: 1.45,
                        }}
                      >
                        <b>Ticket historique importé :</b> aucune checklist de points NC ni description détaillée n&apos;était attachée à cette ancienne ligne sur Monday. Utilisez le bouton <b>« Contrôler »</b> ci-dessus si vous souhaitez réaliser une nouvelle fiche technique complète sur cette machine.
                      </div>
                    );
                  }
                  if (!detailTicket.description || detailChecklist.length > 0) return null;
                  return (
                    <div
                      style={{
                        backgroundColor: '#F8FAFC',
                        border: '1px solid #DDE7F0',
                        borderRadius: '10px',
                        padding: '11px 14px',
                        fontSize: '12.5px',
                        color: '#1B4565',
                        lineHeight: 1.5,
                        whiteSpace: 'pre-line',
                      }}
                    >
                      {detailTicket.description}
                    </div>
                  );
                })()}

                {/* 4. Historique des contrôles de cette machine */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 800, color: '#1B4565', fontFamily: "'Ruda', sans-serif", marginBottom: '8px' }}>
                    <History size={15} color="#39A9DC" />
                    Historique des contrôles sur cette machine ({machineControlsHistory.length})
                  </div>
                  {machineControlsHistory.length === 0 ? (
                    <div style={{ fontSize: '12px', color: '#64748B', padding: '10px 12px', backgroundColor: '#F8FAFC', borderRadius: '8px', fontStyle: 'italic' }}>
                      Aucun contrôle enregistré pour cette machine.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
                      {machineControlsHistory.map((ctrl) => (
                        <div
                          key={ctrl.id}
                          style={{
                            backgroundColor: '#F8FAFC',
                            border: '1px solid #E2EEF5',
                            borderRadius: '8px',
                            padding: '8px 12px',
                            fontSize: '12px',
                            color: '#1B4565',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px', fontWeight: 700 }}>
                            <span>📅 {ctrl.date} {ctrl.technicienName ? `· ${ctrl.technicienName}` : ''}</span>
                            <span>
                              {ctrl.noteSurDix !== undefined ? `${ctrl.noteSurDix}/10 · ` : ''}
                              <b>{ctrl.etatGeneral}</b>
                            </span>
                          </div>
                          {ctrl.anomalies && (
                            <div style={{ fontSize: '11.5px', color: '#475569', marginTop: '3px', whiteSpace: 'pre-line' }}>
                              {ctrl.anomalies}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 5. Fil d'activité */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 800, color: '#1B4565', fontFamily: "'Ruda', sans-serif", marginBottom: '8px' }}>
                    <MessageSquare size={15} color="#39A9DC" />
                    Fil d&apos;activité &amp; Comptes-rendus d&apos;intervention
                  </div>

                  {loadingDetailUpdates ? (
                    <div style={{ fontSize: '12.5px', color: '#57778E', padding: '12px', backgroundColor: '#F8FAFC', borderRadius: '8px' }}>
                      Chargement de l&apos;historique...
                    </div>
                  ) : detailUpdates.length === 0 ? (
                    <div style={{ fontSize: '12.5px', color: '#64748B', padding: '12px', backgroundColor: '#F8FAFC', borderRadius: '8px', fontStyle: 'italic' }}>
                      Aucun commentaire enregistré pour ce ticket.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {detailUpdates.map((u) => (
                        <div
                          key={u.id}
                          style={{
                            backgroundColor: '#FFFFFF',
                            border: '1px solid #DDE7F0',
                            borderLeft: '4px solid #0073EA',
                            borderRadius: '10px',
                            padding: '10px 13px',
                          }}
                        >
                          <div style={{ fontSize: '11px', fontWeight: 700, color: '#57778E', marginBottom: '4px' }}>
                            👤 {u.creatorName} · {u.createdAt ? new Date(u.createdAt).toLocaleString('fr-FR') : ''}
                          </div>
                          <div style={{ fontSize: '12px', color: '#1B4565', lineHeight: 1.45, whiteSpace: 'pre-line' }}>
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
                  flexWrap: 'wrap',
                  gap: '10px',
                }}
              >
                <div>
                  {matchedMachine && (
                    <button
                      type="button"
                      onClick={() => onOpenInspection(matchedMachine.id)}
                      style={{
                        backgroundColor: '#39A9DC',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '8px 16px',
                        fontSize: '12.5px',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 2px 6px rgba(57, 169, 220, 0.25)',
                      }}
                    >
                      <ClipboardCheck size={15} />
                      Ouvrir la fiche de contrôle technique
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setDetailTicket(null)}
                  style={{
                    backgroundColor: '#1B4565',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 18px',
                    fontSize: '12.5px',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

