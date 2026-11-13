import { useState, useEffect, useMemo, useCallback } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import frLocale from '@fullcalendar/core/locales/fr';
import monday from './services/monday';
import type { Machine, PlanningItem, PlanningEventDetail } from './types';
import { InspectionForm } from './components/InspectionForm';
import { MaintenanceMatrix } from './components/MaintenanceMatrix';
import { IndicatorsActionPlan } from './components/IndicatorsActionPlan';
import { isRealCleaningMachine, AlertContextSelect } from './components/MachineSelect';
import { ResponsableSelect } from './components/ResponsableSelect';
import {
  fetchReferentielPoints,
  fetchRealisedControles,
  fetchRepairTickets,
  fetchMaintenanceAlerts,
  sendMaintenanceAlert,
  markMaintenanceAlertSeen,
  archiveMaintenanceAlert,
  fetchMachineBoardColumnsMeta,
  setCachedMachineBoardColumnsMeta,
  extractMachineAffectations,
  reschedulePlanningEvent,
  updateMachineStatus,
  syncAllHubColumns,
  ReferentielPoint,
  RealisedControle,
  RepairTicket,
  MaintenanceAlertMessage,
} from './services/maintenanceApi';
import {
  ClipboardCheck,
  Calendar as CalendarIcon,
  LayoutGrid,
  BarChart3,
  X,
  Search,
  CheckCircle2,
  AlertTriangle,
  Monitor,
  Wrench,
  Clock,
  RotateCcw,
  Bell,
  Send,
  Users,
  Car,
  MapPin,
  Trash2,
} from 'lucide-react';

type KpiFilter = 'all' | 'service' | 'reparation' | 'verifier_sortie';

// Retourne la date d'aujourd'hui au format local YYYY-MM-DD
const getTodayStr = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper pour extraire la valeur texte (y compris Mirror / BoardRelation) d'une colonne Monday
const getColText = (
  item: { column_values?: Array<{ id: string; text?: string | null; display_value?: string | null; value?: string | null }> },
  colId: string
): string => {
  const col = item.column_values?.find((c) => c.id === colId);
  return (col?.text || col?.display_value || '').trim() || '—';
};

// Helper pour parser la timeline JSON {"from":"YYYY-MM-DD","to":"YYYY-MM-DD"}
const parseTimerange = (colValue?: string | null): { from: string; to: string } | null => {
  if (!colValue) return null;
  try {
    const parsed = JSON.parse(colValue);
    if (parsed && typeof parsed === 'object' && parsed.from && parsed.to) {
      return { from: parsed.from, to: parsed.to };
    }
  } catch {}
  return null;
};

// FullCalendar allDay end date est exclusive : on ajoute 1 jour à "to" (UTC)
const toFullCalendarEndDate = (toDateStr: string): string => {
  if (!toDateStr) return toDateStr;
  const parts = toDateStr.split('-').map(Number);
  if (parts.length !== 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
    return toDateStr;
  }
  const [year, month, day] = parts;
  const d = new Date(Date.UTC(year, month - 1, day + 1));
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dayStr = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dayStr}`;
};

// Formater une date YYYY-MM-DD en format français DD/MM/YYYY
const formatDateFR = (dStr?: string): string => {
  if (!dStr || dStr === '—') return '—';
  const parts = dStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dStr;
};

// Calcul du statut temporel dynamique d'une réservation
const getCalculatedStatus = (
  timerange: { from: string; to: string },
  rawStatus: string
): 'Prévue' | 'En cours' | "Se termine aujourd'hui" | 'Terminée' | null => {
  if (rawStatus.trim().toLowerCase() === 'annulée' || rawStatus.trim().toLowerCase() === 'annulee') {
    return null;
  }
  const today = getTodayStr();
  if (today < timerange.from) return 'Prévue';
  if (today === timerange.to) return "Se termine aujourd'hui";
  if (today >= timerange.from && today <= timerange.to) return 'En cours';
  return 'Terminée';
};

export const App = () => {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [planningItems, setPlanningItems] = useState<PlanningItem[]>([]);

  // Navigation par onglets du Hub : Fiche de Contrôle par défaut
  const [activeTab, setActiveTab] = useState<'inspection' | 'matrix' | 'agenda' | 'indicators'>('inspection');
  const [machineColsMeta, setMachineColsMeta] = useState<Record<string, string>>({});
  const [affectationSearch, setAffectationSearch] = useState<string>('');
  const [maintenanceAlerts, setMaintenanceAlerts] = useState<MaintenanceAlertMessage[]>([]);
  const [isAlertsModalOpen, setIsAlertsModalOpen] = useState<boolean>(false);
  const [alertRecipient, setAlertRecipient] = useState<string>('Natacha THOMAS');
  const [alertMachineInput, setAlertMachineInput] = useState<string>('');
  const [alertTextInput, setAlertTextInput] = useState<string>('');
  const [sendingAlert, setSendingAlert] = useState<boolean>(false);

  // Filtre tuile KPI
  const [activeTile, setActiveTile] = useState<KpiFilter | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Notifications
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Auto-dismiss du toaster de notification après 4.5 secondes
  useEffect(() => {
    if (!successMessage) return;
    const timer = setTimeout(() => {
      setSuccessMessage(null);
    }, 4500);
    return () => clearTimeout(timer);
  }, [successMessage]);

  // Référentiel points de contrôle & Contrôles réalisés
  const [referentielPoints, setReferentielPoints] = useState<ReferentielPoint[]>([]);
  const [realisedControles, setRealisedControles] = useState<RealisedControle[]>([]);
  const [repairTickets, setRepairTickets] = useState<RepairTicket[]>([]);

  // Machine pré-sélectionnée (ex: lancée depuis l'agenda ou les indicateurs)
  const [preSelectedMachineId, setPreSelectedMachineId] = useState<string>('');
  const [inspectionModalMachineId, setInspectionModalMachineId] = useState<string | null>(null);
  const [isRescheduling, setIsRescheduling] = useState<boolean>(false);
  const [updatingMachineId, setUpdatingMachineId] = useState<string | null>(null);

  // Modal d'événement sélectionné dans l'Agenda (Interactif)
  const [selectedEvent, setSelectedEvent] = useState<PlanningEventDetail | null>(null);

  // 1. Chargement des machines depuis Monday (+ colonnes meta en 1 seule requête combinée)
  const fetchMachines = useCallback(async () => {
    const boardId = '5106585240';

    try {
      const query = `
        query GetMachines($boardId: [ID!]) {
          boards(ids: $boardId) {
            columns {
              id
              title
            }
            items_page(limit: 500) {
              items {
                id
                name
                column_values {
                  id
                  text
                  value
                  ... on FormulaValue {
                    display_value
                  }
                  ... on MirrorValue {
                    display_value
                  }
                  ... on BoardRelationValue {
                    display_value
                  }
                }
              }
            }
          }
        }
      `;
      const response = await (monday as any).api(query, { variables: { boardId: [boardId] } });

      const board = response?.data?.boards?.[0];
      if (board?.items_page?.items) {
        setMachines(board.items_page.items);
      }
      if (board?.columns && board.columns.length > 0) {
        const map: Record<string, string> = {};
        for (const c of board.columns) map[c.id] = c.title;
        setMachineColsMeta(map);
        setCachedMachineBoardColumnsMeta(map);
      }
      if (response?.errors) {
        console.error('Erreur GraphQL machines:', response.errors[0]?.message);
      }
    } catch (err: any) {
      console.error('Erreur chargement machines:', err);
    }
  }, []);

  // 3. Chargement de l'agenda et planning existant
  const fetchPlanning = useCallback(async () => {
    try {
      const query = `
        query GetPlanning($boardId: [ID!]) {
          boards(ids: $boardId) {
            items_page(limit: 500) {
              items {
                id
                name
                column_values {
                  id
                  text
                  value
                  ... on MirrorValue {
                    display_value
                  }
                  ... on BoardRelationValue {
                    display_value
                  }
                }
              }
            }
          }
        }
      `;
      const response = await (monday as any).api(query, { variables: { boardId: ['5106585296'] } });
      if (response?.data?.boards?.[0]?.items_page?.items) {
        setPlanningItems(response.data.boards[0].items_page.items);
      }
    } catch (err) {
      console.error('Erreur chargement planning:', err);
    }
  }, []);

  // 4. Chargement des contrôles réalisés, du référentiel et des réparations
  const loadMaintenanceData = useCallback(async () => {
    try {
      const [pts, ctrls, repairs, alerts, colsMeta] = await Promise.all([
        fetchReferentielPoints(),
        fetchRealisedControles(),
        fetchRepairTickets(),
        fetchMaintenanceAlerts(),
        fetchMachineBoardColumnsMeta(),
      ]);
      setReferentielPoints(pts);
      setRealisedControles(ctrls);
      setRepairTickets(repairs);
      setMaintenanceAlerts(alerts);
      if (colsMeta && Object.keys(colsMeta).length > 0) {
        setMachineColsMeta((prev) => (Object.keys(prev).length > 0 ? prev : colsMeta));
      }
    } catch (err) {
      console.error('Erreur chargement données maintenance:', err);
    }
  }, []);

  useEffect(() => {
    // Parallélisation immédiate de l'ensemble des requêtes Monday sans waterfall
    Promise.allSettled([
      fetchMachines(),
      fetchPlanning(),
      loadMaintenanceData(),
      syncAllHubColumns(),
    ]);
  }, [fetchMachines, fetchPlanning, loadMaintenanceData]);

  // Matériel réel de nettoyage uniquement (exclusion automatique des chargeurs, batteries, accessoires et "bis")
  const realMachines = useMemo(() => {
    return machines.filter((m) => isRealCleaningMachine(m, getColText));
  }, [machines]);

  // Machines actives pour les contrôles et maintenances (hors machines marquées "Sortie")
  const activeParcMachines = useMemo(() => {
    return realMachines.filter((m) => !getColText(m, 'color_mm8dremb').toLowerCase().includes('sortie'));
  }, [realMachines]);

  // Machines ayant actuellement un ticket ouvert dans Réparation machines (5106693291)
  const openRepairMachineMatch = useMemo(() => {
    const ids = new Set<string>();
    const names = new Set<string>();
    repairTickets.forEach((t) => {
      const statusNorm = (t.status || '').toLowerCase();
      const groupNorm = (t.groupTitle || '').toLowerCase();
      const isClosed =
        statusNorm.includes('réparée') ||
        statusNorm.includes('reparee') ||
        statusNorm.includes('réparé') ||
        statusNorm.includes('repare') ||
        groupNorm.includes('réparé') ||
        groupNorm.includes('repare');
      if (!isClosed) {
        if (t.machineId) {
          ids.add(String(t.machineId));
        } else if (t.machineName) {
          names.add(t.machineName.toLowerCase().replace(/\s+/g, ' ').trim());
        }
      }
    });
    return { ids, names };
  }, [repairTickets]);

  const hasOpenRepairTicket = useCallback(
    (m: Machine): boolean => {
      if (openRepairMachineMatch.ids.has(String(m.id))) return true;
      const mName = (m.name || '').toLowerCase().replace(/\s+/g, ' ').trim();
      if (!mName) return false;
      return openRepairMachineMatch.names.has(mName);
    },
    [openRepairMachineMatch]
  );

  // Classifieur unique basé sur le statut réel de la machine sur Monday
  const getMachineKpiCategory = useCallback(
    (m: Machine): Exclude<KpiFilter, 'all'> => {
      const statusText = getColText(m, 'color_mm8dremb').toLowerCase();
      if (statusText.includes('sortie') || statusText.includes('hors')) {
        return 'verifier_sortie';
      }
      if (statusText.includes('réparation') || statusText.includes('reparation') || statusText.includes('panne')) {
        return 'reparation';
      }
      if (statusText.includes('vérifier') || statusText.includes('verifier') || statusText.includes('remettre')) {
        return 'verifier_sortie';
      }
      if (statusText.includes('service')) {
        return 'service';
      }
      return hasOpenRepairTicket(m) ? 'reparation' : 'verifier_sortie';
    },
    [hasOpenRepairTicket]
  );

  // Mise à jour en direct du statut d'une machine sur Monday (ex: Sortie -> En service)
  const handleChangeMachineStatus = async (machine: Machine, newStatus: string) => {
    setUpdatingMachineId(machine.id);
    const res = await updateMachineStatus(machine.id, newStatus);
    if (res.success) {
      setMachines((prev) =>
        prev.map((m) =>
          m.id === machine.id
            ? {
                ...m,
                column_values: m.column_values.map((c) =>
                  c.id === 'color_mm8dremb' ? { ...c, text: newStatus } : c
                ),
              }
            : m
        )
      );
      setSuccessMessage(`Statut de "${machine.name}" passé à « ${newStatus} » sur Monday !`);
      fetchMachines();
    } else {
      alert(`Erreur mise à jour statut Monday : ${res.error || 'inconnue'}`);
    }
    setUpdatingMachineId(null);
  };

  // Statistiques KPI du parc de vraies machines
  const stats = useMemo(() => {
    let service = 0;
    let reparation = 0;
    let verifier = 0;

    realMachines.forEach((m) => {
      const cat = getMachineKpiCategory(m);
      if (cat === 'service') service += 1;
      else if (cat === 'reparation') reparation += 1;
      else verifier += 1;
    });

    return {
      total: realMachines.length,
      service,
      reparation,
      verifier,
    };
  }, [realMachines, getMachineKpiCategory]);

  // Filtrage des machines si une tuile KPI est cliquée
  const filteredMachines = useMemo(() => {
    if (!activeTile) return [];
    return realMachines.filter((m) => {
      const name = m.name.toLowerCase();
      const type = getColText(m, 'color_mm8t2mn5').toLowerCase();
      const matchSearch = !searchTerm || name.includes(searchTerm.toLowerCase()) || type.includes(searchTerm.toLowerCase());

      if (!matchSearch) return false;
      if (activeTile === 'all') return true;
      return getMachineKpiCategory(m) === activeTile;
    });
  }, [realMachines, activeTile, searchTerm, getMachineKpiCategory]);

  // Événements du calendrier FullCalendar (Pastilles des passages + Planning existant)
  const calendarEvents = useMemo(() => {
    const events: any[] = [];

    // 1. Pastilles des contrôles réalisés (Fiche de contrôle)
    realisedControles.forEach((c) => {
      if (!c.date) return;
      const lower = (c.etatGeneral || '').toLowerCase();
      const isNC = lower.includes('nc') || lower.includes('non conforme') || lower.includes('rouge');
      const isMoyen = lower.includes('moyen') || lower.includes('orange');

      let dotBg = '#00C875';
      let dotBorder = '#0E7042';
      let symbol = '🟢';

      if (isNC) {
        dotBg = '#E2445C';
        dotBorder = '#961C2E';
        symbol = '🔴';
      } else if (isMoyen) {
        dotBg = '#F7AC37';
        dotBorder = '#D66927';
        symbol = '🟠';
      }

      // Nettoyage complet du titre pour supprimer "Contrôle : Contrôle -", "Contrôle -", etc.
      const rawName = c.machineName || c.name || '';
      const cleanMachineName = rawName
        .replace(/^contr[oô]le\s*[-:]*\s*/gi, '')
        .replace(/^contr[oô]le\s*[-:]*\s*/gi, '')
        .trim();

      const matchedMachineForEvent = realMachines.find(
        (m) =>
          (c.machineId && String(m.id) === String(c.machineId)) ||
          m.name.toLowerCase().trim() === cleanMachineName.toLowerCase().trim()
      );
      const eventSite = matchedMachineForEvent ? getColText(matchedMachineForEvent, 'dropdown_mm8d4vj2') : '—';

      events.push({
        id: `controle-${c.id}`,
        title: `${symbol} ${cleanMachineName}`,
        start: c.date,
        allDay: true,
        backgroundColor: dotBg,
        borderColor: dotBorder,
        textColor: '#FFFFFF',
        extendedProps: {
          isControleRealise: true,
          controleData: c,
          machine: cleanMachineName,
          site: eventSite,
          reservedBy: c.technicienName || 'Christophe',
          type: 'Contrôle Technique',
          status: `Résultat : ${c.etatGeneral}`,
          fromDate: c.date,
          toDate: c.date,
          isRecurring: false,
          isMachineInRepair: isNC,
        },
      });
    });

    // 2. Passages et réservations historiques
    planningItems.forEach((item) => {
      const timerangeCol = item.column_values?.find((c) => c.id === 'timerange_mm8gy9t0');
      const timerange = parseTimerange(timerangeCol?.value);
      if (!timerange) return;

      const site = getColText(item, 'dropdown_mm8dr9jz');
      const animateur = getColText(item, 'lookup_mm8d375q');
      const reservedByVal = getColText(item, 'text_mm8jd1am');
      const type = getColText(item, 'color_mm8jw038');
      const rawStatus = getColText(item, 'color_mm8j2n3q');

      const calculatedStatus = getCalculatedStatus(timerange, rawStatus);
      if (!calculatedStatus) return;

      let bgColor = '#39A9DC';
      let borderColor = '#2692C3';
      if (calculatedStatus === 'Terminée') {
        bgColor = '#94A3B8';
        borderColor = '#64748B';
      } else if (type.toLowerCase().includes('réparation')) {
        bgColor = '#E2445C';
        borderColor = '#961C2E';
      } else if (type.toLowerCase().includes('maintenance')) {
        bgColor = '#F7AC37';
        borderColor = '#D66927';
      }

      const cleanPlanningName = (item.name || '')
        .replace(/^contr[oô]le\s*[-:]*\s*/gi, '')
        .replace(/^contr[oô]le\s*[-:]*\s*/gi, '')
        .trim();

      events.push({
        id: item.id,
        title: `📅 ${cleanPlanningName}${site && site !== '—' ? ` • ${site}` : ''}`,
        start: timerange.from,
        end: toFullCalendarEndDate(timerange.to),
        allDay: true,
        backgroundColor: bgColor,
        borderColor: borderColor,
        textColor: '#FFFFFF',
        extendedProps: {
          machine: cleanPlanningName,
          site,
          animateur,
          reservedBy: reservedByVal,
          type,
          status: calculatedStatus,
          fromDate: timerange.from,
          toDate: timerange.to,
          isRecurring: false,
          isMachineInRepair: false,
        },
      });
    });

    return events;
  }, [realisedControles, planningItems]);

  // Clic sur un événement du calendrier (Ouverture modal interactif)
  const handleEventClick = (info: any) => {
    const props = info.event.extendedProps;
    const cleanMachineName = (props.machine || info.event.title || '')
      .replace(/^contr[oô]le\s*[-:]*\s*/gi, '')
      .replace(/^contr[oô]le\s*[-:]*\s*/gi, '')
      .trim();

    // Trouver la machine correspondante dans realMachines
    const matched = realMachines.find((m) =>
      m.id === props.controleData?.machineId ||
      m.name.toLowerCase().trim() === cleanMachineName.toLowerCase().trim() ||
      cleanMachineName.toLowerCase().startsWith(m.name.toLowerCase().slice(0, 10)) ||
      m.name.toLowerCase().startsWith(cleanMachineName.toLowerCase().slice(0, 10))
    );

    setSelectedEvent({
      id: info.event.id,
      machine: cleanMachineName,
      site: props.site || '—',
      fromDate: props.fromDate || info.event.startStr,
      toDate: props.toDate || info.event.endStr || props.fromDate,
      reservedBy: props.reservedBy || '—',
      type: props.type || 'Contrôle',
      status: props.status || 'Effectué',
      isRecurring: Boolean(props.isRecurring),
      isMachineInRepair: Boolean(props.isMachineInRepair),
      isControleRealise: Boolean(props.isControleRealise),
      controleData: props.controleData,
      matchedMachineId: matched?.id,
    });
  };

  // Définition des 4 tuiles KPI avec badges officiels
  const kpiTiles = [
    {
      key: 'all' as const,
      number: '01',
      label: 'Total',
      count: stats.total,
      icon: <Monitor size={22} color="#39A9DC" />,
      color: '#39A9DC',
      borderActive: '#39A9DC',
      bgActive: '#EBF6FC',
    },
    {
      key: 'service' as const,
      number: '02',
      label: 'En service',
      count: stats.service,
      icon: <CheckCircle2 size={22} color="#00C875" />,
      color: '#00C875',
      borderActive: '#00C875',
      bgActive: '#EDFBF4',
    },
    {
      key: 'reparation' as const,
      number: '03',
      label: 'En réparation',
      count: stats.reparation,
      icon: <Wrench size={22} color="#E2445C" />,
      color: '#E2445C',
      borderActive: '#E2445C',
      bgActive: '#FDECEE',
    },
    {
      key: 'verifier_sortie' as const,
      number: '04',
      label: 'À vérifier / Sortie',
      count: stats.verifier,
      icon: <AlertTriangle size={22} color="#F7AC37" />,
      color: '#F7AC37',
      borderActive: '#F7AC37',
      bgActive: '#FFF8EC',
    },
  ];

  return (
    <div
      style={{
        fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
        backgroundColor: '#F8FAFC',
        minHeight: '100vh',
        padding: '24px 28px',
        color: '#1B4565',
        boxSizing: 'border-box',
      }}
    >
      {/* ================= EN-TÊTE OFFICIEL GROUPE FACILITY ================= */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '18px',
          marginBottom: '26px',
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          padding: '18px 24px',
          border: '1px solid #E2EEF5',
          boxShadow: '0 4px 16px rgba(27, 69, 101, 0.04)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          {/* Logo officiel Groupe Facility (Non déformé) */}
          <div style={{ display: 'flex', alignItems: 'center', minWidth: '120px' }}>
            <img
              src="https://files-public.monday.com/euc1/4853404b-84ea-4006-aab2-0e6de2c4dfdb/Facility-logo_couleur01.svg"
              alt="Logo Groupe Facility"
              style={{
                height: '42px',
                width: 'auto',
                maxWidth: '150px',
                objectFit: 'contain',
              }}
            />
          </div>

          <div style={{ width: '1.5px', height: '40px', backgroundColor: '#E2EEF5' }} />

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1
                style={{
                  margin: 0,
                  fontSize: '24px',
                  fontWeight: 900,
                  fontFamily: "'Ruda', sans-serif",
                  color: '#1B4565',
                  letterSpacing: '-0.4px',
                }}
              >
                ERP Parc Matériel
              </h1>
              <span
                style={{
                  backgroundColor: '#EBF6FC',
                  color: '#39A9DC',
                  fontFamily: "'Ruda', sans-serif",
                  fontSize: '11px',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '6px',
                  letterSpacing: '0.5px',
                }}
              >
                FACILITY 2026
              </span>
            </div>
            <p
              style={{
                margin: '4px 0 0 0',
                fontSize: '13.5px',
                color: '#3989B7',
                fontWeight: 500,
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}
            >
              Fiche de contrôle terrain, maintenance préventive (12 mois) &amp; agenda des interventions
            </p>
          </div>
        </div>

        {/* Indicateur de date, cloche alertes bidirectionnelles et statut rapide */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {(() => {
            const unreadIncoming = maintenanceAlerts.filter((a) => !a.seen && a.direction === 'to_atelier').length;
            return (
              <button
                type="button"
                onClick={() => setIsAlertsModalOpen(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '7px',
                  padding: '8px 14px',
                  borderRadius: '10px',
                  border: unreadIncoming > 0 ? '1.5px solid #F7AC37' : '1px solid #E2EEF5',
                  backgroundColor: unreadIncoming > 0 ? '#FFF8EC' : '#F5F9FC',
                  color: unreadIncoming > 0 ? '#B86114' : '#1B4565',
                  fontSize: '12.5px',
                  fontWeight: 800,
                  fontFamily: "'Ruda', sans-serif",
                  cursor: 'pointer',
                }}
              >
                <Bell size={15} color={unreadIncoming > 0 ? '#D66927' : '#39A9DC'} />
                <span>Alertes Atelier ↔ Secteur</span>
                {unreadIncoming > 0 && (
                  <span
                    style={{
                      backgroundColor: '#E2445C',
                      color: '#FFFFFF',
                      borderRadius: '10px',
                      padding: '1px 7px',
                      fontSize: '11px',
                      fontWeight: 900,
                    }}
                  >
                    {unreadIncoming}
                  </span>
                )}
              </button>
            );
          })()}

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 14px',
              borderRadius: '10px',
              backgroundColor: '#F5F9FC',
              border: '1px solid #E2EEF5',
              fontSize: '13px',
              color: '#1B4565',
              fontWeight: 600,
            }}
          >
            <Clock size={16} color="#39A9DC" />
            <span>
              {new Date().toLocaleDateString('fr-FR', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </span>
          </div>
        </div>
      </div>

      {/* ================= BARRE DE NAVIGATION PAR ONGLETS DU HUB ================= */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          marginBottom: '26px',
          borderBottom: '1.5px solid #E2EEF5',
          paddingBottom: '14px',
          flexWrap: 'wrap',
        }}
      >
        {/* Onglet 1 : Fiche de Contrôle (Terrain) - Prioritaire */}
        <button
          type="button"
          onClick={() => setActiveTab('inspection')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '9px',
            padding: '11px 22px',
            borderRadius: '12px',
            border: activeTab === 'inspection' ? '1.5px solid #39A9DC' : '1px solid #E2EEF5',
            backgroundColor: activeTab === 'inspection' ? '#39A9DC' : '#FFFFFF',
            color: activeTab === 'inspection' ? '#FFFFFF' : '#1B4565',
            fontFamily: "'Ruda', sans-serif",
            fontWeight: 800,
            fontSize: '14px',
            cursor: 'pointer',
            boxShadow: activeTab === 'inspection' ? '0 4px 14px rgba(57, 169, 220, 0.3)' : 'none',
            transition: 'all 0.15s ease',
          }}
        >
          <ClipboardCheck size={19} />
          Fiche de Contrôle (Terrain)
        </button>

        {/* Onglet 2 : Maintenance Préventive (12 Mois) */}
        <button
          type="button"
          onClick={() => setActiveTab('matrix')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '9px',
            padding: '11px 22px',
            borderRadius: '12px',
            border: activeTab === 'matrix' ? '1.5px solid #1B4565' : '1px solid #E2EEF5',
            backgroundColor: activeTab === 'matrix' ? '#1B4565' : '#FFFFFF',
            color: activeTab === 'matrix' ? '#FFFFFF' : '#1B4565',
            fontFamily: "'Ruda', sans-serif",
            fontWeight: 800,
            fontSize: '14px',
            cursor: 'pointer',
            boxShadow: activeTab === 'matrix' ? '0 4px 14px rgba(27, 69, 101, 0.25)' : 'none',
            transition: 'all 0.15s ease',
          }}
        >
          <LayoutGrid size={19} />
          Maintenance Préventive (12 Mois)
        </button>

        {/* Onglet 3 : Historique des Passages (Agenda) */}
        <button
          type="button"
          onClick={() => setActiveTab('agenda')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '9px',
            padding: '11px 22px',
            borderRadius: '12px',
            border: activeTab === 'agenda' ? '1.5px solid #F7AC37' : '1px solid #E2EEF5',
            backgroundColor: activeTab === 'agenda' ? '#F7AC37' : '#FFFFFF',
            color: activeTab === 'agenda' ? '#FFFFFF' : '#1B4565',
            fontFamily: "'Ruda', sans-serif",
            fontWeight: 800,
            fontSize: '14px',
            cursor: 'pointer',
            boxShadow: activeTab === 'agenda' ? '0 4px 14px rgba(247, 172, 55, 0.3)' : 'none',
            transition: 'all 0.15s ease',
          }}
        >
          <CalendarIcon size={19} />
          Historique &amp; Agenda (Passages)
        </button>

        {/* Onglet 4 : Indicateurs & Plan d'action */}
        <button
          type="button"
          onClick={() => setActiveTab('indicators')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '9px',
            padding: '11px 22px',
            borderRadius: '12px',
            border: activeTab === 'indicators' ? '1.5px solid #00A389' : '1px solid #E2EEF5',
            backgroundColor: activeTab === 'indicators' ? '#00A389' : '#FFFFFF',
            color: activeTab === 'indicators' ? '#FFFFFF' : '#1B4565',
            fontFamily: "'Ruda', sans-serif",
            fontWeight: 800,
            fontSize: '14px',
            cursor: 'pointer',
            boxShadow: activeTab === 'indicators' ? '0 4px 14px rgba(0, 163, 137, 0.3)' : 'none',
            transition: 'all 0.15s ease',
          }}
        >
          <BarChart3 size={19} />
          Indicateurs &amp; Plan d'action
          {repairTickets.filter((t) => !t.status.toLowerCase().includes('réparée') && !t.status.toLowerCase().includes('reparee')).length > 0 && (
            <span
              style={{
                backgroundColor: activeTab === 'indicators' ? '#FFFFFF' : '#E2445C',
                color: activeTab === 'indicators' ? '#E2445C' : '#FFFFFF',
                borderRadius: '10px',
                padding: '2px 7px',
                fontSize: '11px',
                fontWeight: 800,
                marginLeft: '4px',
              }}
            >
              {repairTickets.filter((t) => !t.status.toLowerCase().includes('réparée') && !t.status.toLowerCase().includes('reparee')).length}
            </span>
          )}
        </button>
      </div>

      {/* Toast Notification Flottant (Pop-up moderne en bas à droite) */}
      {successMessage && (
        <div
          className="facility-toast-popup"
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 99999,
            backgroundColor: '#FFFFFF',
            border: '1.5px solid #00C875',
            borderRadius: '14px',
            padding: '14px 18px',
            minWidth: '320px',
            maxWidth: '480px',
            boxShadow: '0 12px 36px rgba(0, 200, 117, 0.22), 0 4px 14px rgba(27, 69, 101, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: '#E6F8F0',
                border: '1px solid #A7F3D0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <CheckCircle2 size={20} color="#00C875" />
            </div>
            <div>
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: 800,
                  color: '#0E7042',
                  fontFamily: "'Ruda', sans-serif",
                  letterSpacing: '0.2px',
                }}
              >
                Action enregistrée
              </div>
              <div
                style={{
                  fontSize: '12.5px',
                  fontWeight: 600,
                  color: '#1B4565',
                  marginTop: '2px',
                  lineHeight: 1.35,
                }}
              >
                {successMessage}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            title="Fermer la notification"
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#F1F5F9',
              color: '#64748B',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              fontWeight: 800,
              flexShrink: 0,
              transition: 'background 0.15s ease',
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ================= ONGLET 1 (PRIORITAIRE) : FICHE DE CONTRÔLE TERRAIN ================= */}
      {activeTab === 'inspection' && (
        <InspectionForm
          machines={activeParcMachines}
          referentielPoints={referentielPoints}
          realisedControles={realisedControles}
          initialMachineId={preSelectedMachineId}
          onInspectionSuccess={(name, date, resolvedCount) => {
            loadMaintenanceData();
            fetchMachines();
            if (resolvedCount && resolvedCount > 0) {
              setSuccessMessage(`Contrôle validé et machine remise En service ! (${name} - ticket de réparation clôturé)`);
            } else {
              setSuccessMessage(`Contrôle validé avec succès pour ${name} (${date}) !`);
            }
          }}
        />
      )}

      {/* ================= ONGLET 2 : MAINTENANCE PRÉVENTIVE (12 MOIS) ================= */}
      {activeTab === 'matrix' && (
        <MaintenanceMatrix
          machines={activeParcMachines}
          onDataChanged={fetchMachines}
        />
      )}

      {/* ================= ONGLET 3 : AGENDA (HISTORIQUE ET PARC) ================= */}
      {activeTab === 'agenda' && (
        <>
          {/* Section 01 : Parc de machines & Tuiles KPI */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
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
                  letterSpacing: '0.5px',
                }}
              >
                01
              </span>
              <h2
                style={{
                  margin: 0,
                  fontSize: '18px',
                  fontWeight: 800,
                  fontFamily: "'Ruda', sans-serif",
                  color: '#1B4565',
                }}
              >
                Parc de machines
              </h2>
            </div>

            <span style={{ fontSize: '13px', color: '#3989B7', fontWeight: 600 }}>
              Cliquez sur une tuile pour filtrer les machines
            </span>
          </div>

          {/* Grille des 4 Tuiles KPI */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
              gap: '16px',
              marginBottom: '24px',
            }}
          >
            {kpiTiles.map((tile) => {
              const isActive = activeTile === tile.key;
              return (
                <div
                  key={tile.key}
                  onClick={() => setActiveTile(isActive ? null : tile.key)}
                  style={{
                    cursor: 'pointer',
                    backgroundColor: isActive ? tile.bgActive : '#FFFFFF',
                    border: isActive ? `2px solid ${tile.borderActive}` : '1px solid #E2EEF5',
                    borderRadius: '16px',
                    padding: '20px 22px',
                    boxShadow: isActive
                      ? `0 6px 18px rgba(27, 69, 101, 0.12)`
                      : '0 4px 14px rgba(27, 69, 101, 0.04)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: '130px',
                    transition: 'all 0.18s ease',
                    userSelect: 'none',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '12px',
                        backgroundColor: isActive ? '#FFFFFF' : '#F5F9FC',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid #E2EEF5',
                      }}
                    >
                      {tile.icon}
                    </div>
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 800,
                        fontFamily: "'Ruda', sans-serif",
                        color: isActive ? tile.color : '#6C8CA3',
                      }}
                    >
                      {tile.number}
                    </span>
                  </div>

                  <div style={{ marginTop: '12px' }}>
                    <div
                      style={{
                        fontSize: '34px',
                        fontWeight: 900,
                        fontFamily: "'Ruda', sans-serif",
                        color: tile.color,
                        lineHeight: 1,
                      }}
                    >
                      {tile.count}
                    </div>
                    <div
                      style={{
                        fontSize: '13.5px',
                        fontWeight: 700,
                        fontFamily: "'Plus Jakarta Sans', sans-serif",
                        color: isActive ? '#1B4565' : '#3989B7',
                        marginTop: '8px',
                      }}
                    >
                      {tile.label}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Liste déroulante des machines si une tuile KPI est cliquée */}
          {activeTile && (
            <div
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '16px',
                padding: '20px',
                border: '1.5px solid #39A9DC',
                marginBottom: '24px',
                boxShadow: '0 6px 20px rgba(57, 169, 220, 0.1)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px', gap: '12px' }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '15px', fontFamily: "'Ruda', sans-serif", color: '#1B4565' }}>
                    Machines filtrées : {filteredMachines.length} résultat(s)
                  </div>
                  {activeTile === 'reparation' && (
                    <div style={{ fontSize: '12px', color: '#57778E', marginTop: '3px' }}>
                      Filtré sur le statut Monday <b>« En réparation »</b> (Liste des machines). Les machines <b>En service</b> avec un ancien ticket non clôturé portent un badge orange cliquable.
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTile(null)}
                  style={{ background: 'none', border: 'none', color: '#3989B7', cursor: 'pointer', fontWeight: 800 }}
                >
                  Fermer ✕
                </button>
              </div>

              <div style={{ position: 'relative', marginBottom: '14px' }}>
                <Search size={16} color="#6C8CA3" style={{ position: 'absolute', left: '12px', top: '10px' }} />
                <input
                  type="text"
                  placeholder="Rechercher par nom ou type..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px 8px 36px',
                    borderRadius: '8px',
                    border: '1px solid #C8DCE8',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {filteredMachines.map((m) => {
                  const currentStatus = getColText(m, 'color_mm8dremb') || 'Non défini';
                  const isInService =
                    currentStatus.toLowerCase().includes('service') &&
                    !currentStatus.toLowerCase().includes('hors') &&
                    !currentStatus.toLowerCase().includes('remettre');
                  const isUpdating = updatingMachineId === m.id;
                  const openTicket = hasOpenRepairTicket(m);

                  return (
                    <div
                      key={m.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '10px',
                        padding: '10px 12px',
                        borderBottom: '1px solid #F0F5F8',
                        fontSize: '13px',
                      }}
                    >
                      <div style={{ minWidth: '220px', flex: 1 }}>
                        <span style={{ fontWeight: 700, color: '#1B4565' }}>{m.name}</span>
                        <span style={{ color: '#3989B7', marginLeft: '8px' }}>
                          {getColText(m, 'color_mm8t2mn5')}
                        </span>
                        {openTicket && (
                          <button
                            type="button"
                            onClick={() => setActiveTab('indicators')}
                            title="Voir / clôturer le ticket dans l'onglet Plan d'action"
                            style={{
                              marginLeft: '8px',
                              fontSize: '11px',
                              fontWeight: 700,
                              color: isInService ? '#D66927' : '#961C2E',
                              backgroundColor: isInService ? '#FFF8EC' : '#FDECEE',
                              border: isInService ? '1px solid #FDE2B8' : '1px solid #F5C6CB',
                              borderRadius: '6px',
                              padding: '2px 8px',
                              cursor: 'pointer',
                            }}
                          >
                            {isInService ? '⚠️ Ticket curatif ouvert (clôturer) ➔' : '🔧 Ticket réparation actif ➔'}
                          </button>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        {!isInService && (
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => handleChangeMachineStatus(m, 'En service')}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              padding: '5px 10px',
                              borderRadius: '8px',
                              border: '1px solid #6EE7B7',
                              backgroundColor: '#ECFDF5',
                              color: '#047857',
                              fontSize: '11.5px',
                              fontWeight: 800,
                              cursor: isUpdating ? 'wait' : 'pointer',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            <RotateCcw size={12} />
                            {isUpdating ? 'Mise à jour...' : 'Remettre en service'}
                          </button>
                        )}

                        <select
                          aria-label={`Statut de ${m.name}`}
                          disabled={isUpdating}
                          value={['En service', 'À vérifier', 'En réparation', 'Sortie'].includes(currentStatus) ? currentStatus : ''}
                          onChange={(e) => {
                            if (e.target.value) handleChangeMachineStatus(m, e.target.value);
                          }}
                          style={{
                            padding: '5px 9px',
                            borderRadius: '8px',
                            fontSize: '11.5px',
                            fontWeight: 700,
                            border: '1px solid #CBD5E1',
                            backgroundColor: '#F8FAFC',
                            color: '#1B4565',
                            cursor: isUpdating ? 'wait' : 'pointer',
                          }}
                        >
                          {!['En service', 'À vérifier', 'En réparation', 'Sortie'].includes(currentStatus) && (
                            <option value="">{currentStatus}</option>
                          )}
                          <option value="En service">En service</option>
                          <option value="À vérifier">À vérifier</option>
                          <option value="En réparation">En réparation</option>
                          <option value="Sortie">Sortie</option>
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 02 : Calendrier Mensuel (Lecture Seule) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '16px',
            }}
          >
            <span
              style={{
                backgroundColor: '#39A9DC',
                color: '#FFFFFF',
                fontFamily: "'Ruda', sans-serif",
                fontSize: '12px',
                fontWeight: 800,
                padding: '3px 9px',
                borderRadius: '6px',
                letterSpacing: '0.5px',
              }}
            >
              02
            </span>
            <h2
              style={{
                margin: 0,
                fontSize: '18px',
                fontWeight: 800,
                fontFamily: "'Ruda', sans-serif",
                color: '#1B4565',
              }}
            >
              Agenda des passages &amp; interventions
            </h2>
          </div>

          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              border: '1px solid #E2EEF5',
              padding: '24px',
              boxShadow: '0 4px 16px rgba(27, 69, 101, 0.04)',
            }}
          >
            {/* Légende épurée aux couleurs de la charte */}
            <div
              style={{
                display: 'flex',
                gap: '16px',
                flexWrap: 'wrap',
                marginBottom: '18px',
                fontSize: '12.5px',
                fontWeight: 700,
                color: '#3989B7',
                borderBottom: '1px solid #F0F5F8',
                paddingBottom: '14px',
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                🟢 Contrôle Conforme
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                🟠 Contrôle Moyen
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                🔴 Contrôle Non Conforme
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: '#39A9DC' }} />
                Réservation / Chantier
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: '#94A3B8' }} />
                Intervention Terminée
              </span>
            </div>

            <FullCalendar
              plugins={[dayGridPlugin]}
              initialView="dayGridMonth"
              locale={frLocale}
              headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: '',
              }}
              events={calendarEvents}
              eventClick={handleEventClick}
              height="auto"
              dayMaxEvents={3}
            />
          </div>

          {/* Section 03 : Affectations du Parc (Personne / Voiture / Site) */}
          {(() => {
            const affectations = extractMachineAffectations(realMachines, planningItems, machineColsMeta);
            const q = affectationSearch.trim().toLowerCase();
            const filteredAffectations = affectations.filter((a) => {
              if (!q) return true;
              return (
                a.machineName.toLowerCase().includes(q) ||
                a.site.toLowerCase().includes(q) ||
                a.personne.toLowerCase().includes(q) ||
                a.voiture.toLowerCase().includes(q) ||
                a.machineType.toLowerCase().includes(q)
              );
            });

            return (
              <div style={{ marginTop: '26px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px',
                    marginBottom: '14px',
                  }}
                >
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
                      03
                    </span>
                    <h2
                      style={{
                        margin: 0,
                        fontSize: '18px',
                        fontWeight: 800,
                        fontFamily: "'Ruda', sans-serif",
                        color: '#1B4565',
                      }}
                    >
                      Affectations Machines (Personne / Voiture / Site)
                    </h2>
                  </div>

                  <div style={{ position: 'relative', width: '320px', maxWidth: '100%' }}>
                    <Search size={15} color="#6C8CA3" style={{ position: 'absolute', left: '11px', top: '9px' }} />
                    <input
                      type="text"
                      value={affectationSearch}
                      onChange={(e) => setAffectationSearch(e.target.value)}
                      placeholder="Rechercher site, personne, voiture, machine..."
                      style={{
                        width: '100%',
                        padding: '7px 12px 7px 34px',
                        borderRadius: '10px',
                        border: '1px solid #C8DCE8',
                        fontSize: '12.5px',
                        boxSizing: 'border-box',
                        outline: 'none',
                      }}
                    />
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: '16px',
                    border: '1px solid #E2EEF5',
                    boxShadow: '0 4px 16px rgba(27, 69, 101, 0.04)',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', textAlign: 'left' }}>
                      <thead style={{ position: 'sticky', top: 0, backgroundColor: '#F5F9FC', zIndex: 1 }}>
                        <tr style={{ borderBottom: '1.5px solid #D2E9F6', color: '#1B4565' }}>
                          <th style={{ padding: '10px 14px', fontWeight: 800 }}>Machine</th>
                          <th style={{ padding: '10px 12px', fontWeight: 800 }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                              <MapPin size={13} color="#39A9DC" /> Site d&apos;affectation
                            </span>
                          </th>
                          <th style={{ padding: '10px 12px', fontWeight: 800 }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                              <Users size={13} color="#39A9DC" /> Personne / Resp.
                            </span>
                          </th>
                          <th style={{ padding: '10px 12px', fontWeight: 800 }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                              <Car size={13} color="#39A9DC" /> Voiture / Véhicule
                            </span>
                          </th>
                          <th style={{ padding: '10px 12px', fontWeight: 800 }}>Statut</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAffectations.map((a) => (
                          <tr key={a.machineId} style={{ borderBottom: '1px solid #F0F5F8' }}>
                            <td style={{ padding: '9px 14px', fontWeight: 700, color: '#1B4565' }}>
                              <div>{a.machineName}</div>
                              <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 500 }}>{a.machineType}</div>
                            </td>
                            <td style={{ padding: '9px 12px', color: '#1B4565', fontWeight: 600 }}>{a.site}</td>
                            <td style={{ padding: '9px 12px', color: a.personne === 'Non attribué' ? '#94A3B8' : '#3989B7', fontWeight: 700 }}>
                              {a.personne}
                            </td>
                            <td style={{ padding: '9px 12px', color: a.voiture === '—' ? '#94A3B8' : '#1B4565', fontWeight: 600 }}>
                              {a.voiture}
                            </td>
                            <td style={{ padding: '9px 12px' }}>
                              <span
                                style={{
                                  fontSize: '11px',
                                  fontWeight: 800,
                                  padding: '2px 8px',
                                  borderRadius: '8px',
                                  backgroundColor: a.status.toLowerCase().includes('répar') ? '#FEE2E2' : '#ECFDF5',
                                  color: a.status.toLowerCase().includes('répar') ? '#DC2626' : '#059669',
                                }}
                              >
                                {a.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })()}
        </>
      )}

      {/* ================= ONGLET 4 : INDICATEURS & PLAN D'ACTION ================= */}
      {activeTab === 'indicators' && (
        <IndicatorsActionPlan
          machines={realMachines}
          realisedControles={realisedControles}
          repairTickets={repairTickets}
          onRefreshData={async () => {
            await Promise.all([loadMaintenanceData(), fetchMachines()]);
          }}
          onOpenInspection={(mId) => {
            setPreSelectedMachineId(mId);
            setInspectionModalMachineId(mId);
          }}
        />
      )}

      {/* Modal Détail du passage / événement (Interactif) */}
      {selectedEvent && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(27, 69, 101, 0.45)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px',
          }}
          onClick={() => setSelectedEvent(null)}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '520px',
              width: '100%',
              boxShadow: '0 10px 30px rgba(27, 69, 101, 0.2)',
              border: '1px solid #E2EEF5',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <h3
                  style={{
                    margin: 0,
                    fontSize: '18px',
                    fontWeight: 800,
                    fontFamily: "'Ruda', sans-serif",
                    color: '#1B4565',
                  }}
                >
                  {selectedEvent.machine}
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#3989B7', fontWeight: 600 }}>
                  {selectedEvent.type} {selectedEvent.site && selectedEvent.site !== '—' ? `· Chantier : ${selectedEvent.site}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6C8CA3' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px', marginBottom: '16px' }}>
              <div style={{ padding: '12px', backgroundColor: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2EEF5' }}>
                <span style={{ color: '#3989B7', display: 'block', fontSize: '11px', fontWeight: 800, fontFamily: "'Ruda', sans-serif" }}>
                  DATE D'INTERVENTION
                </span>
                <span style={{ fontWeight: 700, color: '#1B4565', marginTop: '4px', display: 'block' }}>
                  {formatDateFR(selectedEvent.fromDate)}
                </span>
              </div>

              <div style={{ padding: '12px', backgroundColor: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2EEF5' }}>
                <span style={{ color: '#3989B7', display: 'block', fontSize: '11px', fontWeight: 800, fontFamily: "'Ruda', sans-serif" }}>
                  STATUT / RÉSULTAT
                </span>
                <span style={{ fontWeight: 700, color: '#1B4565', marginTop: '4px', display: 'block' }}>
                  {selectedEvent.status}
                </span>
              </div>
            </div>

            {/* Détails complémentaires si contrôle réalisé */}
            {selectedEvent.isControleRealise && selectedEvent.controleData && (
              <div
                style={{
                  backgroundColor: '#F8FCFE',
                  borderRadius: '12px',
                  padding: '14px',
                  border: '1px solid #D2E9F6',
                  fontSize: '12.5px',
                  marginBottom: '18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div><b>Catégorie :</b> {selectedEvent.controleData.categorieIntervention || 'Contrôle simple'}</div>
                <div><b>Propreté :</b> {selectedEvent.controleData.proprete || 'Propre'} · <b>Entretien :</b> {selectedEvent.controleData.entretienRegulier || 'Entretenue'}</div>
                {selectedEvent.controleData.tempsPasse && (
                  <div><b>Temps passé :</b> {selectedEvent.controleData.tempsPasse} min</div>
                )}
                {selectedEvent.controleData.anomalies && (() => {
                  const statusLower = (selectedEvent.status || '').toLowerCase();
                  const isAlertBox = selectedEvent.isMachineInRepair || statusLower.includes('orange') || statusLower.includes('rouge') || statusLower.includes('non conforme') || statusLower.includes('nc');
                  return (
                    <div
                      style={{
                        marginTop: '4px',
                        padding: '10px 12px',
                        backgroundColor: isAlertBox ? '#FFF7F7' : '#EBF6FC',
                        borderRadius: '8px',
                        border: isAlertBox ? '1px solid #F5C6CB' : '1px solid #D2E9F6',
                        color: isAlertBox ? '#961C2E' : '#1B4565',
                        fontSize: '12px',
                        whiteSpace: 'pre-line',
                      }}
                    >
                      <b>{isAlertBox ? 'Remarques / Anomalies :' : 'Synthèse du contrôle :'}</b>
                      <br />
                      {selectedEvent.controleData.anomalies}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Actions interactives sur l'événement */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {/* 1. Lancer un contrôle pour cette machine */}
                <button
                  type="button"
                  onClick={() => {
                    if (selectedEvent.matchedMachineId) {
                      setInspectionModalMachineId(selectedEvent.matchedMachineId);
                      setSelectedEvent(null);
                    } else {
                      setActiveTab('inspection');
                      setSelectedEvent(null);
                    }
                  }}
                  style={{
                    backgroundColor: '#39A9DC',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '9px 16px',
                    fontSize: '13px',
                    fontWeight: 800,
                    fontFamily: "'Ruda', sans-serif",
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 8px rgba(57, 169, 220, 0.25)',
                  }}
                >
                  <ClipboardCheck size={16} />
                  Lancer le contrôle
                </button>

                {/* 2. Reporter au mois prochain (+1 mois) si passage prévisionnel au planning */}
                {!selectedEvent.isControleRealise && (
                  <button
                    type="button"
                    disabled={isRescheduling}
                    onClick={async () => {
                      setIsRescheduling(true);
                      try {
                        const partsFrom = selectedEvent.fromDate.split('-').map(Number);
                        const fromD = new Date(partsFrom[0], partsFrom[1] - 1, partsFrom[2]);
                        fromD.setMonth(fromD.getMonth() + 1);
                        const nextFromStr = fromD.toISOString().split('T')[0];

                        const partsTo = selectedEvent.toDate.split('-').map(Number);
                        const toD = new Date(partsTo[0], partsTo[1] - 1, partsTo[2]);
                        toD.setMonth(toD.getMonth() + 1);
                        const nextToStr = toD.toISOString().split('T')[0];

                        const res = await reschedulePlanningEvent(selectedEvent.id, nextFromStr, nextToStr);
                        if (res.success) {
                          setSuccessMessage(`Passage pour "${selectedEvent.machine}" reporté avec succès au mois prochain (${formatDateFR(nextFromStr)}) !`);
                          fetchPlanning();
                          setSelectedEvent(null);
                        } else {
                          alert(`Erreur report Monday : ${res.error}`);
                        }
                      } catch (err: any) {
                        alert(`Erreur : ${err?.message}`);
                      } finally {
                        setIsRescheduling(false);
                      }
                    }}
                    style={{
                      backgroundColor: '#FAFCFD',
                      color: '#1B4565',
                      border: '1.5px solid #D2E9F6',
                      borderRadius: '10px',
                      padding: '9px 14px',
                      fontSize: '12.5px',
                      fontWeight: 800,
                      fontFamily: "'Ruda', sans-serif",
                      cursor: isRescheduling ? 'not-allowed' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                  >
                    <CalendarIcon size={14} color="#F7AC37" />
                    {isRescheduling ? 'Report en cours...' : 'Reporter au mois prochain (+1 mois)'}
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                style={{
                  backgroundColor: '#F0F5F8',
                  color: '#57778E',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '9px 18px',
                  fontSize: '13px',
                  fontWeight: 800,
                  fontFamily: "'Ruda', sans-serif",
                  cursor: 'pointer',
                }}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale Alertes Bidirectionnelles Atelier (Christophe) <-> Responsables de Secteur */}
      {isAlertsModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 39, 58, 0.58)',
            backdropFilter: 'blur(3px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsAlertsModalOpen(false);
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
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, fontFamily: "'Ruda', sans-serif", color: '#1B4565' }}>
                  🔔 Alertes Bidirectionnelles Atelier ↔ Responsables de Secteur
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#57778E' }}>
                  Recevez les signalements des animatrices et envoyez des alertes vers leurs Hubs
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAlertsModalOpen(false)}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  border: '1px solid #E2E8F0',
                  backgroundColor: '#FFFFFF',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '18px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Formulaire d'envoi vers Responsable de Secteur */}
              <div
                style={{
                  backgroundColor: '#FFF8EC',
                  border: '1px solid #F7AC37',
                  borderRadius: '12px',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: 800, color: '#D66927', fontFamily: "'Ruda', sans-serif" }}>
                  📢 Envoyer une alerte vers un Hub Responsable de Secteur
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <ResponsableSelect
                    value={alertRecipient}
                    onChange={setAlertRecipient}
                    accentColor="#F7AC37"
                    fullWidth={true}
                  />
                  <AlertContextSelect
                    machines={machines}
                    value={alertMachineInput}
                    onChange={setAlertMachineInput}
                    getCol={getColText}
                    placeholder="Machine / Site concerné (optionnel)"
                    accentColor="#F7AC37"
                  />
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={alertTextInput}
                    onChange={(e) => setAlertTextInput(e.target.value)}
                    placeholder="Message / Alerte (ex: Machine non rincée, câble abîmé, demander devis...)"
                    style={{
                      flex: 1,
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: '1px solid #F7AC37',
                      fontSize: '12.5px',
                      color: '#1B4565',
                    }}
                  />
                  <button
                    type="button"
                    disabled={sendingAlert || !alertTextInput.trim()}
                    onClick={async () => {
                      if (!alertTextInput.trim()) return;
                      setSendingAlert(true);
                      const res = await sendMaintenanceAlert({
                        recipientPerson: alertRecipient,
                        machineName: alertMachineInput.trim() || undefined,
                        message: alertTextInput.trim(),
                        senderName: 'Christophe',
                      });
                      setSendingAlert(false);
                      if (res.success) {
                        setAlertTextInput('');
                        setAlertMachineInput('');
                        setSuccessMessage(`Alerte transmise vers le Hub de ${alertRecipient} !`);
                        await loadMaintenanceData();
                      } else {
                        alert(`Erreur envoi alerte : ${res.error}`);
                      }
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 14px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: '#D66927',
                      color: '#FFFFFF',
                      fontSize: '12.5px',
                      fontWeight: 800,
                      fontFamily: "'Ruda', sans-serif",
                      cursor: sendingAlert ? 'wait' : 'pointer',
                    }}
                  >
                    <Send size={13} />
                    {sendingAlert ? 'Envoi...' : 'Envoyer'}
                  </button>
                </div>
              </div>

              {/* Flux des alertes reçues & envoyées */}
              <div>
                <div style={{ fontSize: '13px', fontWeight: 800, color: '#1B4565', fontFamily: "'Ruda', sans-serif", marginBottom: '8px' }}>
                  Historique des échanges ({maintenanceAlerts.length})
                </div>
                {maintenanceAlerts.length === 0 ? (
                  <div style={{ fontSize: '12.5px', color: '#64748B', fontStyle: 'italic', padding: '12px', backgroundColor: '#F8FAFC', borderRadius: '8px' }}>
                    Aucune alerte échangée pour le moment entre l&apos;Atelier et les Responsables de Secteur.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {maintenanceAlerts.map((al) => {
                      const isIncoming = al.direction === 'to_atelier';
                      return (
                        <div
                          key={al.id}
                          style={{
                            padding: '10px 14px',
                            borderRadius: '10px',
                            border: `1px solid ${al.seen ? '#E2EEF5' : isIncoming ? '#F5C6CB' : '#D2E9F6'}`,
                            backgroundColor: al.seen ? '#F8FCFE' : isIncoming ? '#FDECEE' : '#EBF6FC',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '10px',
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '3px' }}>
                              <span
                                style={{
                                  fontSize: '10.5px',
                                  fontWeight: 800,
                                  padding: '2px 7px',
                                  borderRadius: '6px',
                                  fontFamily: "'Ruda', sans-serif",
                                  backgroundColor: isIncoming ? '#FDECEE' : '#D2E9F6',
                                  color: isIncoming ? '#961C2E' : '#1B4565',
                                }}
                              >
                                {isIncoming ? '⬅️ Reçue (Secteur ➔ Atelier)' : `➡️ Envoyée vers ${al.person || 'Secteur'}`}
                              </span>
                              {al.date && <span style={{ fontSize: '11px', color: '#64748B' }}>📅 {al.date}</span>}
                              {al.seen && (
                                <span style={{ fontSize: '11px', color: '#059669', fontWeight: 700 }}>✓ Vu</span>
                              )}
                            </div>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: '#1B4565' }}>{al.title}</div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                            {!al.seen && isIncoming && (
                              <button
                                type="button"
                                onClick={async () => {
                                  await markMaintenanceAlertSeen(al.id);
                                  await loadMaintenanceData();
                                }}
                                style={{
                                  padding: '6px 11px',
                                  borderRadius: '8px',
                                  border: '1px solid #10B981',
                                  backgroundColor: '#ECFDF5',
                                  color: '#047857',
                                  fontSize: '11.5px',
                                  fontWeight: 800,
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                Marquer Vu ✓
                              </button>
                            )}
                            <button
                              type="button"
                              title="Supprimer / archiver cette alerte sur Monday"
                              onClick={async () => {
                                const res = await archiveMaintenanceAlert(al.id);
                                if (res.success) {
                                  setMaintenanceAlerts((prev) => prev.filter((item) => item.id !== al.id));
                                } else {
                                  alert(`Erreur suppression alerte : ${res.error}`);
                                }
                              }}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '6px 9px',
                                borderRadius: '8px',
                                border: '1px solid #FECACA',
                                backgroundColor: '#FEF2F2',
                                color: '#B91C1C',
                                fontSize: '11.5px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              <Trash2 size={13} />
                              Supprimer
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODALE OVERLAY : FICHE DE CONTRÔLE TECHNIQUE COMPLETE ================= */}
      {inspectionModalMachineId !== null && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '24px 16px',
            overflowY: 'auto',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setInspectionModalMachineId(null);
            }
          }}
        >
          <div
            style={{
              backgroundColor: '#F8FAFC',
              borderRadius: '20px',
              maxWidth: '940px',
              width: '100%',
              margin: 'auto',
              boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.4)',
              border: '1.5px solid #CBD5E1',
              padding: '24px 20px',
              position: 'relative',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <InspectionForm
              machines={activeParcMachines}
              referentielPoints={referentielPoints}
              realisedControles={realisedControles}
              initialMachineId={inspectionModalMachineId}
              isModal={true}
              onCloseModal={() => setInspectionModalMachineId(null)}
              onInspectionSuccess={async (name, date, resolvedCount) => {
                await Promise.all([loadMaintenanceData(), fetchMachines()]);
                if (resolvedCount && resolvedCount > 0) {
                  setSuccessMessage(`Contrôle validé et machine remise En service ! (${name} - ticket de réparation clôturé)`);
                } else {
                  setSuccessMessage(`Contrôle validé avec succès pour ${name} (${date}) !`);
                }
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
