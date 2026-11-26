import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  MapPin,
  Upload,
  ExternalLink,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Route,
  Search,
  ChevronDown,
  ChevronUp,
  Loader2,
  Download,
  Car,
  ShieldAlert,
  EyeOff,
  Sun,
  FileSpreadsheet,
  RefreshCw,
  ArrowRight,
  Database,
  Sparkles,
  X,
  History,
  Trash2,
  Archive,
  Cloud,
  CloudUpload,
  Home,
  UserCheck,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from 'recharts';
import { toast } from 'sonner';
import {
  parseGeolocWorkbook,
  normalizePlateKey,
  formatMinutesToHHMM,
  type GeoAlertStatus,
  type GeoVehicleSummary,
  type GeoWorkbookResult,
} from '@lib/geolocParser';
import {
  saveGeolocWorkbookToHistory,
  listGeolocWorkbooksHistory,
  deleteGeolocWorkbookFromHistory,
  type StoredGeolocWorkbook,
} from '@lib/geolocStorage';
import {
  GEOLOC_BOARD_URL,
  getGeolocHistory,
  ensureGeolocWeekGroup,
  upsertGeolocVehicleBatch,
  type MondayGeolocHistory,
  type MondayGeolocRecord,
} from '@generated/server/geoloc';
import {
  GEOLOC_DETAILS_BOARD_URL,
  getRhEmployeeNames,
  getMondayDetailWeeksList,
  loadMondayWeekDetails,
  ensureDetailsWeekGroup,
  upsertDailyDetailRow,
  upsertDailyDetailBatch,
  archiveDetailsOlderThan6Months,
  getCommuteKmRecords,
  computeUsefulDayMetrics,
  computePointageStatus,
  serializeTripsCompact,
  type CommuteDayRecord,
  type DayAnnotationState,
  type MondayDetailWeekSummary,
} from '@generated/server/geolocDetails';
import GeolocDayDetailCard from './GeolocDayDetailCard';
import GeolocCommuteKmPanel from './GeolocCommuteKmPanel';
import SearchableSelect from '@components/SearchableSelect';
import { createSpreadsheet, createTheme, useXlsxExport } from '@/skills/xlsx-export';
import { cn } from '@lib/utils';

type MainTab = 'history' | 'explorer' | 'commute';
type ExplorerSubTab = 'summary' | 'vehicle' | 'trips';
type AlertFilter = 'all' | 'alerts' | 'offHours' | 'weekend' | 'private' | 'inactive';
type TripQuickFilter = 'all' | 'weekend' | 'private' | 'early' | 'late' | 'long';

const ALERT_BADGE_STYLE: Record<GeoAlertStatus, string> = {
  Conforme: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/25',
  'Hors horaires': 'bg-amber-500/15 text-amber-800 border-amber-500/30',
  'Hors horaires + WE': 'bg-red-500/15 text-red-700 border-red-500/30',
  'Week-end': 'bg-purple-500/12 text-purple-700 border-purple-500/25',
  'Vie privée': 'bg-sky-500/12 text-sky-700 border-sky-500/25',
  Inactif: 'bg-muted text-muted-foreground border-border',
};

const FACILITY_XLSX_THEME = createTheme({
  primary: 'FF39A9DC',
  secondary: 'FF3989B7',
  neutral: 'FFE8F5FC',
  font: 'Calibri',
});

function kmFmt(n: number): string {
  return `${n.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km`;
}

function hoursFmt(h: number): string {
  if (!Number.isFinite(h) || h <= 0) return '0h00';
  const totalMin = Math.round(h * 60);
  const hh = Math.floor(totalMin / 60);
  const mm = totalMin % 60;
  return `${hh}h${String(mm).padStart(2, '0')}`;
}

function AlertBadge({ status }: { status: GeoAlertStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold whitespace-nowrap',
        ALERT_BADGE_STYLE[status] || ALERT_BADGE_STYLE.Conforme,
      )}
    >
      {status === 'Conforme' && <CheckCircle2 className="h-3 w-3" />}
      {(status === 'Hors horaires' || status === 'Hors horaires + WE') && <AlertTriangle className="h-3 w-3" />}
      {status === 'Week-end' && <Sun className="h-3 w-3" />}
      {status === 'Vie privée' && <EyeOff className="h-3 w-3" />}
      <span>{status}</span>
    </span>
  );
}

export default function GeolocCard() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { exportToXlsx } = useXlsxExport();

  // Mode principal : Historique Monday ou Explorateur Excel
  const [mainTab, setMainTab] = useState<MainTab>('history');

  // Données Monday (board 5108497111)
  const [history, setHistory] = useState<MondayGeolocHistory | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [selectedHistoryWeek, setSelectedHistoryWeek] = useState<string>('latest');
  const [historySearch, setHistorySearch] = useState('');
  const [historyFleetFilter, setHistoryFleetFilter] = useState('all');
  const [historyAlertFilter, setHistoryAlertFilter] = useState<AlertFilter>('all');
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [historyChartMetric, setHistoryChartMetric] = useState<'km' | 'amplitude'>('km');

  // Données Excel Explorateur (32 onglets en mémoire + historique local IndexedDB)
  const [workbook, setWorkbook] = useState<GeoWorkbookResult | null>(null);
  const [savedWorkbooks, setSavedWorkbooks] = useState<StoredGeolocWorkbook[]>([]);
  const [parsing, setParsing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [explorerSubTab, setExplorerSubTab] = useState<ExplorerSubTab>('summary');
  const [expSearch, setExpSearch] = useState('');
  const [expFleetFilter, setExpFleetFilter] = useState('all');
  const [expAlertFilter, setExpAlertFilter] = useState<AlertFilter>('all');
  const [expSortBy, setExpSortBy] = useState<'km' | 'offHours' | 'trips' | 'amplitude' | 'plate'>('km');
  const [selectedVehiclePlate, setSelectedVehiclePlate] = useState<string>('');
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});

  // Filtres vue Tous les Trajets
  const [tripSearch, setTripSearch] = useState('');
  const [tripQuickFilter, setTripQuickFilter] = useState<TripQuickFilter>('all');
  const [tripDayFilter, setTripDayFilter] = useState<string>('all');
  const [tripVehicleFilter, setTripVehicleFilter] = useState<string>('all');
  const [tripVisibleCount, setTripVisibleCount] = useState(60);

  // État synchronisation vers Monday (Synthèse 5108497111)
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number; label: string } | null>(null);

  // Pointage multi-salariés + exclusions Domicile ↔ Travail + archivage détails Monday (5108589918)
  const [rhEmployees, setRhEmployees] = useState<string[]>([]);
  const [mondayDetailWeeks, setMondayDetailWeeks] = useState<MondayDetailWeekSummary[]>([]);
  const [mondayDetailTotalItems, setMondayDetailTotalItems] = useState<number>(0);
  const [loadingMondayWeekId, setLoadingMondayWeekId] = useState<string | null>(null);
  const [dayAnnotations, setDayAnnotations] = useState<Record<string, DayAnnotationState>>({});
  const [savingDayKey, setSavingDayKey] = useState<string | null>(null);
  const [syncingDetails, setSyncingDetails] = useState(false);
  const [detailsSyncProgress, setDetailsSyncProgress] = useState<{ current: number; total: number; label: string } | null>(null);
  const [archivingOldDetails, setArchivingOldDetails] = useState(false);

  // Suivi Km Domicile ↔ Travail (Monday 5108589918 + coches live de l'Explorateur)
  const [mondayCommuteRecords, setMondayCommuteRecords] = useState<CommuteDayRecord[]>([]);
  const [commuteLoading, setCommuteLoading] = useState<boolean>(false);

  const refreshCommuteRecords = useCallback(async () => {
    setCommuteLoading(true);
    try {
      const rows = await getCommuteKmRecords({ data: {} });
      setMondayCommuteRecords(rows);
    } catch (err) {
      console.error('Erreur chargement km Domicile-Travail:', err);
    } finally {
      setCommuteLoading(false);
    }
  }, []);

  const refreshMondayDetailsList = useCallback(async () => {
    try {
      const res = await getMondayDetailWeeksList({ data: {} });
      setMondayDetailWeeks(res.weeks);
      setMondayDetailTotalItems(res.totalActiveItems);
    } catch (err) {
      console.error('Erreur liste détails journaliers Monday:', err);
    }
  }, []);

  useEffect(() => {
    getRhEmployeeNames({ data: {} })
      .then((names) => setRhEmployees(names))
      .catch(() => {});
    refreshMondayDetailsList();
    refreshCommuteRecords();
  }, [refreshMondayDetailsList, refreshCommuteRecords]);

  // Calcul en temps réel des km Domicile ↔ Travail sur l'Excel actuellement ouvert
  const liveCommuteRecords = useMemo<CommuteDayRecord[]>(() => {
    if (!workbook) return [];
    const out: CommuteDayRecord[] = [];
    for (const v of workbook.vehicles) {
      const plateKey = normalizePlateKey(v.plate);
      for (const day of v.days) {
        const key = `${plateKey}::${day.date}`;
        const ann = dayAnnotations[key];
        if (!ann) continue;
        const excludedSet = new Set(ann.excludedTripIds || []);
        const excludedTrips = day.trips
          .filter((t) => excludedSet.has(t.id))
          .map((t) => ({
            startTime: t.startTime,
            endTime: t.endTime,
            startAddress: t.startAddress,
            endAddress: t.endAddress,
            km: Math.round(t.distanceKm * 100) / 100,
          }));
        const commuteKm = Math.round(excludedTrips.reduce((s, t) => s + t.km, 0) * 100) / 100;
        const totalDayKm = Math.round(day.distanceKm * 100) / 100;
        out.push({
          key,
          date: day.date,
          plate: v.plate,
          plateKey,
          vehicleLabel: v.vehicleLabel || v.plate,
          driverName: v.driverName || '',
          commuteKm,
          totalDayKm,
          excludedTripsCount: excludedTrips.length,
          excludedTrips,
          source: 'live',
        });
      }
    }
    return out;
  }, [workbook, dayAnnotations]);

  const totalCommuteKmBadge = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of mondayCommuteRecords) map.set(r.key, r.commuteKm);
    for (const r of liveCommuteRecords) {
      if (r.excludedTripsCount > 0 || r.commuteKm > 0) map.set(r.key, r.commuteKm);
      else map.delete(r.key);
    }
    let sum = 0;
    for (const km of map.values()) sum += km;
    return Math.round(sum * 10) / 10;
  }, [mondayCommuteRecords, liveCommuteRecords]);

  // Charger automatiquement les exclusions & pointages déjà sauvegardés sur Monday pour la semaine ouverte
  useEffect(() => {
    if (!workbook?.weekId) return;
    let cancelled = false;
    loadMondayWeekDetails({ data: { weekId: workbook.weekId } })
      .then((payload) => {
        if (cancelled) return;
        setDayAnnotations((prev) => ({ ...prev, ...payload.annotationsByKey }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [workbook?.weekId]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await getGeolocHistory({ data: {} });
      setHistory(res);
      if (res.weeks.length > 0) {
        setSelectedHistoryWeek((cur) =>
          cur === 'latest' || !res.weeks.some((w) => w.weekId === cur) ? res.weeks[0].weekId : cur,
        );
      }
    } catch (err) {
      console.error('Erreur chargement historique géoloc:', err);
      toast.error('Impossible de charger le tableau Synthèse Géolocalisation.');
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Charger l'historique local des exports Excel importés dans ce navigateur (IndexedDB)
  const refreshSavedWorkbooks = useCallback(async (autoSelectLatest = false) => {
    const list = await listGeolocWorkbooksHistory();
    setSavedWorkbooks(list);
    if (autoSelectLatest && list.length > 0) {
      const latest = list[0].workbook;
      setWorkbook((cur) => cur ?? latest);
      const firstActive = latest.vehicles.find((v) => v.trips.length > 0) || latest.vehicles[0];
      setSelectedVehiclePlate((cur) => cur || firstActive?.plate || '');
    }
  }, []);

  useEffect(() => {
    refreshSavedWorkbooks(true);
  }, [refreshSavedWorkbooks]);

  const handleSelectSavedWorkbook = (weekId: string) => {
    const found = savedWorkbooks.find((w) => w.weekId === weekId);
    if (!found) return;
    setWorkbook(found.workbook);
    setExplorerSubTab('summary');
    const firstActive = found.workbook.vehicles.find((v) => v.trips.length > 0) || found.workbook.vehicles[0];
    setSelectedVehiclePlate(firstActive?.plate || '');
    setExpandedDays({});
    setTripDayFilter('all');
    setTripVehicleFilter('all');
    setTripVisibleCount(60);
  };

  const handleDeleteSavedWorkbook = async (weekId: string) => {
    await deleteGeolocWorkbookFromHistory(weekId);
    const updated = savedWorkbooks.filter((w) => w.weekId !== weekId);
    setSavedWorkbooks(updated);
    if (workbook?.weekId === weekId) {
      if (updated.length > 0) {
        const next = updated[0].workbook;
        setWorkbook(next);
        const firstActive = next.vehicles.find((v) => v.trips.length > 0) || next.vehicles[0];
        setSelectedVehiclePlate(firstActive?.plate || '');
      } else {
        setWorkbook(null);
        setSelectedVehiclePlate('');
      }
    }
    toast.info('Import Excel retiré de l’historique local.');
  };

  // Lecture fichier Excel (.xlsx)
  const handleFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      toast.error('Format non supporté', {
        description: 'Veuillez importer un fichier Excel (.xlsx) issu de votre portail GPS.',
      });
      return;
    }

    setParsing(true);
    try {
      const buf = await file.arrayBuffer();
      const parsed = await parseGeolocWorkbook(buf, file.name);
      await saveGeolocWorkbookToHistory(parsed);
      await refreshSavedWorkbooks(false);
      setWorkbook(parsed);
      setMainTab('explorer');
      setExplorerSubTab('summary');
      const firstActive = parsed.vehicles.find((v) => v.trips.length > 0) || parsed.vehicles[0];
      setSelectedVehiclePlate(firstActive?.plate || '');
      setExpandedDays({});
      setTripDayFilter('all');
      setTripVehicleFilter('all');
      setTripVisibleCount(60);
      toast.success(`Export GPS chargé et mémorisé !`, {
        description: `${parsed.weekLabel} · ${parsed.totalVehicles} véhicules · ${parsed.totalTrips.toLocaleString('fr-FR')} trajets (${parsed.matchedDetailSheets} onglets).`,
      });
    } catch (err: any) {
      console.error(err);
      toast.error('Erreur de lecture du fichier Excel', {
        description: err?.message || 'Vérifiez que le fichier contient bien l’onglet Résumé et les onglets trajets.',
      });
    } finally {
      setParsing(false);
    }
  };

  // Analyse anti-doublon pour le workbook chargé vs Monday
  const syncPreview = useMemo(() => {
    if (!workbook) return null;
    const existing = history?.existingByWeekPlate ?? {};
    let newCount = 0;
    let existingCount = 0;
    let linkedCount = 0;
    const fleetMap = history?.fleetPlateToId ?? {};

    for (const v of workbook.vehicles) {
      const key = `${workbook.weekId}::${normalizePlateKey(v.plate)}`;
      if (existing[key]) existingCount++;
      else newCount++;
      if (fleetMap[normalizePlateKey(v.plate)]) linkedCount++;
    }
    return { newCount, existingCount, linkedCount, total: workbook.vehicles.length };
  }, [workbook, history]);

  // Enregistrement de la synthèse hebdomadaire sur Monday (5108497111)
  const handleSyncToMonday = async (overwriteExisting: boolean) => {
    if (!workbook || syncing) return;
    setSyncing(true);

    try {
      const latestHistory = history ?? (await getGeolocHistory({ data: {} }));
      const existing = latestHistory.existingByWeekPlate;
      const fleetMap = latestHistory.fleetPlateToId;

      setSyncProgress({ current: 0, total: workbook.vehicles.length, label: `Préparation du groupe ${workbook.weekLabel}…` });
      const { groupId } = await ensureGeolocWeekGroup({
        data: { weekId: workbook.weekId, weekLabel: workbook.weekLabel },
      });

      const targets = workbook.vehicles.filter((v) => {
        const key = `${workbook.weekId}::${normalizePlateKey(v.plate)}`;
        const exists = Boolean(existing[key]);
        return overwriteExisting || !exists;
      });

      if (targets.length === 0) {
        toast.info('Semaine déjà entièrement synchronisée sur Monday !');
        setSyncing(false);
        setSyncProgress(null);
        return;
      }

      let created = 0;
      let updated = 0;
      const BATCH_SIZE = 10;

      for (let i = 0; i < targets.length; i += BATCH_SIZE) {
        const chunk = targets.slice(i, i + BATCH_SIZE);
        setSyncProgress({
          current: Math.min(i + chunk.length, targets.length),
          total: targets.length,
          label: `Lot ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(targets.length / BATCH_SIZE)} (${chunk[0].plate}…)`,
        });

        const results = await upsertGeolocVehicleBatch({
          data: {
            rows: chunk.map((v) => {
              const key = `${workbook.weekId}::${normalizePlateKey(v.plate)}`;
              const existingItemId = existing[key];
              const linkedVehicleId = fleetMap[normalizePlateKey(v.plate)];
              return {
                groupId,
                existingItemId: overwriteExisting ? existingItemId : undefined,
                weekId: workbook.weekId,
                startDate: workbook.startDate,
                endDate: workbook.endDate,
                plate: v.plate,
                linkedVehicleId,
                conducteur: v.vehicleLabel,
                flotte: v.fleetMondayLabel,
                alerte: v.alertStatus,
                nbTrajets: v.tripCount,
                kmTotal: v.distanceKm,
                kmPro: v.distanceProKm,
                kmHors: v.distanceOffHoursKm,
                conduiteH: v.driveDurationHours,
                attenteH: v.waitDurationHours,
                vitesseMoy: v.avgSpeedKmh,
                joursRoules: v.daysActive,
                premierDepart: v.avgFirstDeparture,
                derniereArrivee: v.avgLastArrival,
                amplitudeH: v.avgAmplitudeHours,
                syntheseJour: v.dailySummaryText,
              };
            }),
          },
        });

        for (const r of results) {
          if (r.action === 'created') created++;
          else updated++;
        }

        if (i + BATCH_SIZE < targets.length) {
          await new Promise((r) => setTimeout(r, 120));
        }
      }

      toast.success('Synthèse enregistrée sur Monday !', {
        description: `${created > 0 ? `${created} ligne(s) créée(s)` : ''}${created > 0 && updated > 0 ? ' · ' : ''}${updated > 0 ? `${updated} ligne(s) mise(s) à jour` : ''} dans « ${workbook.weekLabel} ».`,
      });

      await loadHistory();
      setSelectedHistoryWeek(workbook.weekId);
    } catch (err: any) {
      console.error('Erreur synchro géoloc:', err);
      toast.error('Erreur pendant la synchronisation Monday', {
        description: err?.message || 'Relancez l’enregistrement : l’anti-doublon reprendra exactement où il s’est arrêté.',
      });
      await loadHistory();
    } finally {
      setSyncing(false);
      setSyncProgress(null);
    }
  };

  // ==================== POINTAGE & ARCHIVAGE DÉTAILS JOURNALIERS (5108589918) ====================
  const autoLoadedMondayRef = useRef(false);

  const handleLoadMondayDetailWeek = useCallback(
    async (weekId: string, opts?: { targetPlate?: string; silent?: boolean }) => {
      if (loadingMondayWeekId) return;
      setLoadingMondayWeekId(weekId);
      try {
        const payload = await loadMondayWeekDetails({ data: { weekId } });
        setDayAnnotations((prev) => ({ ...prev, ...payload.annotationsByKey }));
        if (payload.reconstructedWorkbook) {
          setWorkbook(payload.reconstructedWorkbook);
          setMainTab('explorer');
          setExplorerSubTab('vehicle');
          const targetKey = opts?.targetPlate ? normalizePlateKey(opts.targetPlate) : '';
          const matched = targetKey
            ? payload.reconstructedWorkbook.vehicles.find((v) => normalizePlateKey(v.plate) === targetKey)
            : null;
          const firstActive =
            matched ||
            payload.reconstructedWorkbook.vehicles.find((v) => v.trips.length > 0) ||
            payload.reconstructedWorkbook.vehicles[0];
          setSelectedVehiclePlate(firstActive?.plate || '');
          setExpandedDays({});
          if (!opts?.silent) {
            toast.success(`Semaine ${payload.weekLabel} rechargée depuis Monday !`, {
              description: `${payload.reconstructedWorkbook.totalVehicles} véhicules · ${payload.reconstructedWorkbook.totalTrips} trajets · exclusions & pointages restaurés.`,
            });
          }
        } else if (!opts?.silent) {
          toast.info('Aucun détail de trajet trouvé pour cette semaine sur Monday.');
        }
      } catch (err: any) {
        if (!opts?.silent) {
          toast.error('Impossible de charger cette semaine depuis Monday', { description: err?.message });
        }
      } finally {
        setLoadingMondayWeekId(null);
      }
    },
    [loadingMondayWeekId],
  );

  // Synchronise automatiquement la semaine sélectionnée dans Synthèse Monday vers Détails & Pointages
  useEffect(() => {
    if (mainTab !== 'explorer' || loadingMondayWeekId || mondayDetailWeeks.length === 0) return;

    // Si un Excel local fraîchement importé (non-archive) est déjà ouvert, on ne l'écrase pas
    const isLocalImportOpen = Boolean(workbook && !workbook.fileName?.startsWith('Archive Monday'));
    if (isLocalImportOpen) return;

    const desiredWeekId =
      selectedHistoryWeek && selectedHistoryWeek !== 'latest' && selectedHistoryWeek !== 'all'
        ? selectedHistoryWeek
        : mondayDetailWeeks[0].weekId;

    const hasDesired = mondayDetailWeeks.some((w) => w.weekId === desiredWeekId);
    const targetWeekId = hasDesired ? desiredWeekId : mondayDetailWeeks[0].weekId;

    if (!workbook && !autoLoadedMondayRef.current) {
      autoLoadedMondayRef.current = true;
      handleLoadMondayDetailWeek(targetWeekId, { silent: true });
    } else if (workbook && workbook.weekId !== targetWeekId && hasDesired) {
      handleLoadMondayDetailWeek(targetWeekId, { silent: true });
    }
  }, [mainTab, workbook, selectedHistoryWeek, loadingMondayWeekId, mondayDetailWeeks, handleLoadMondayDetailWeek]);

  // Options unifiées du sélecteur de semaine dans Détails & Pointages (Archives Monday + Imports locaux non archivés)
  const unifiedDetailWeekOptions = useMemo(() => {
    const mondayIds = new Set(mondayDetailWeeks.map((w) => w.weekId));
    const opts: Array<{
      value: string;
      label: string;
      sublabel: string;
      badgeColor: string;
      searchTokens: string[];
    }> = [];

    for (const wk of mondayDetailWeeks) {
      opts.push({
        value: `monday::${wk.weekId}`,
        label: wk.groupTitle || wk.weekId,
        sublabel: `${wk.vehicleCount} véh. · ${wk.dayCount} j.${wk.pointedCount > 0 ? ` · ${wk.pointedCount} pt.` : ''}${wk.nonCompliantCount > 0 ? ` · ${wk.nonCompliantCount} écart(s)` : ''}`,
        badgeColor: wk.nonCompliantCount > 0 ? '#dc2626' : wk.isOlderThan6Months ? '#d97706' : '#00c875',
        searchTokens: [wk.weekId, wk.groupTitle],
      });
    }

    for (const item of savedWorkbooks) {
      if (mondayIds.has(item.weekId)) continue;
      opts.push({
        value: `local::${item.weekId}`,
        label: `${item.weekLabel} (Excel local)`,
        sublabel: `${item.totalTrips} trajets · à archiver sur Monday`,
        badgeColor: '#D66927',
        searchTokens: [item.weekId, item.weekLabel, item.fileName],
      });
    }

    return opts;
  }, [mondayDetailWeeks, savedWorkbooks]);

  const currentUnifiedWeekValue = useMemo(() => {
    if (!workbook) return '';
    const isArchive = Boolean(workbook.fileName?.startsWith('Archive Monday'));
    if (isArchive || mondayDetailWeeks.some((w) => w.weekId === workbook.weekId)) {
      return `monday::${workbook.weekId}`;
    }
    return `local::${workbook.weekId}`;
  }, [workbook, mondayDetailWeeks]);

  const handleUnifiedWeekChange = (val: string) => {
    if (!val) return;
    if (val.startsWith('monday::')) {
      const weekId = val.slice('monday::'.length);
      if (history?.weeks.some((w) => w.weekId === weekId)) {
        setSelectedHistoryWeek(weekId);
      }
      handleLoadMondayDetailWeek(weekId, { silent: false });
    } else if (val.startsWith('local::')) {
      const weekId = val.slice('local::'.length);
      handleSelectSavedWorkbook(weekId);
    }
  };

  const handleOpenVehicleDetailsFromHistory = (weekId: string, plate: string) => {
    if (workbook && workbook.weekId === weekId) {
      const targetKey = normalizePlateKey(plate);
      const matched = workbook.vehicles.find((v) => normalizePlateKey(v.plate) === targetKey);
      if (matched) setSelectedVehiclePlate(matched.plate);
      setExpandedDays({});
      setMainTab('explorer');
      setExplorerSubTab('vehicle');
      return;
    }
    const hasDetails = mondayDetailWeeks.some((w) => w.weekId === weekId);
    if (hasDetails) {
      handleLoadMondayDetailWeek(weekId, { targetPlate: plate });
    } else {
      setMainTab('explorer');
      toast.info(`Les trajets détaillés de la semaine ${weekId} ne sont pas encore archivés sur Monday.`, {
        description: 'Importez l’Excel GPS de cette semaine puis cliquez sur « Archiver détails ».',
      });
    }
  };

  const handleSaveSingleDayToMonday = async (
    vehicle: GeoVehicleSummary,
    day: GeoVehicleSummary['days'][number],
  ) => {
    if (!workbook) return;
    const key = `${normalizePlateKey(vehicle.plate)}::${day.date}`;
    const ann: DayAnnotationState = dayAnnotations[key] ?? { excludedTripIds: [], pointages: [] };
    setSavingDayKey(key);
    try {
      const { groupId } = await ensureDetailsWeekGroup({
        data: { weekId: workbook.weekId, weekLabel: workbook.weekLabel },
      });
      const excludedSet = new Set(ann.excludedTripIds);
      const metrics = computeUsefulDayMetrics(day, excludedSet);
      const ptSummary = computePointageStatus(ann.pointages);
      const trajetsJson = serializeTripsCompact(day.trips, excludedSet);

      const res = await upsertDailyDetailRow({
        data: {
          groupId,
          existingItemId: ann.mondayItemId,
          weekId: workbook.weekId,
          date: day.date,
          plate: vehicle.plate,
          vehicleLabel: vehicle.vehicleLabel,
          driverName: vehicle.driverName,
          statutPointage: ptSummary.status,
          ecartTotalMin: ptSummary.totalDeltaMin,
          amplitudeUtileH: metrics.usefulAmplitudeHours,
          plageUtile: `${metrics.usefulStartLabel} → ${metrics.usefulEndLabel}`,
          kmUtiles: metrics.usefulKm,
          trajetsExclus: metrics.excludedCount,
          pointageJson: JSON.stringify(ann.pointages),
          trajetsJson,
        },
      });

      setDayAnnotations((prev) => ({
        ...prev,
        [key]: { ...ann, mondayItemId: res.id },
      }));
      toast.success(`Pointage & exclusions enregistrés (${vehicle.plate} · ${day.dayLabel})`, {
        description:
          ptSummary.status === 'Écart horaire'
            ? `Statut : Écart horaire (${ptSummary.totalDeltaMin} min) · Plage utile ${metrics.usefulStartLabel} → ${metrics.usefulEndLabel}`
            : `Statut : ${ptSummary.status} · Plage utile ${metrics.usefulStartLabel} → ${metrics.usefulEndLabel}`,
      });
      refreshMondayDetailsList();
    } catch (err: any) {
      toast.error('Erreur lors de la sauvegarde du pointage', { description: err?.message });
    } finally {
      setSavingDayKey(null);
    }
  };

  const totalWorkbookActiveDays = useMemo(() => {
    if (!workbook) return 0;
    return workbook.vehicles.reduce((sum, v) => sum + v.days.length, 0);
  }, [workbook]);

  const handleSyncAllDetailsToMonday = async () => {
    if (!workbook || syncingDetails) return;
    const tasks: Array<{ vehicle: GeoVehicleSummary; day: GeoVehicleSummary['days'][number] }> = [];
    for (const v of workbook.vehicles) {
      for (const d of v.days) {
        if (d.trips.length > 0) tasks.push({ vehicle: v, day: d });
      }
    }
    if (tasks.length === 0) {
      toast.info('Aucun détail journalier à archiver pour cette semaine.');
      return;
    }

    setSyncingDetails(true);
    try {
      setDetailsSyncProgress({ current: 0, total: tasks.length, label: `Préparation du groupe ${workbook.weekLabel}…` });
      const { groupId } = await ensureDetailsWeekGroup({
        data: { weekId: workbook.weekId, weekLabel: workbook.weekLabel },
      });
      const existingPayload = await loadMondayWeekDetails({ data: { weekId: workbook.weekId, forceRefresh: true } });
      const existingIds = existingPayload.itemIdByKey;

      let created = 0;
      let updated = 0;
      const newIds: Record<string, string> = {};
      const BATCH_SIZE = 10;

      for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
        const chunk = tasks.slice(i, i + BATCH_SIZE);
        setDetailsSyncProgress({
          current: Math.min(i + chunk.length, tasks.length),
          total: tasks.length,
          label: `Lot ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(tasks.length / BATCH_SIZE)} (${chunk[0].vehicle.plate} · ${chunk[0].day.dayLabel}…)`,
        });

        const batchRows = chunk.map(({ vehicle, day }) => {
          const key = `${normalizePlateKey(vehicle.plate)}::${day.date}`;
          const localAnn: DayAnnotationState =
            dayAnnotations[key] ?? existingPayload.annotationsByKey[key] ?? { excludedTripIds: [], pointages: [] };
          const existingItemId = localAnn.mondayItemId || existingIds[key];
          const excludedSet = new Set<string>(localAnn.excludedTripIds);
          const metrics = computeUsefulDayMetrics(day, excludedSet);
          const ptSummary = computePointageStatus(localAnn.pointages);
          const trajetsJson = serializeTripsCompact(day.trips, excludedSet);

          return {
            groupId,
            existingItemId,
            weekId: workbook.weekId,
            date: day.date,
            plate: vehicle.plate,
            vehicleLabel: vehicle.vehicleLabel,
            driverName: vehicle.driverName,
            statutPointage: ptSummary.status,
            ecartTotalMin: ptSummary.totalDeltaMin,
            amplitudeUtileH: metrics.usefulAmplitudeHours,
            plageUtile: `${metrics.usefulStartLabel} → ${metrics.usefulEndLabel}`,
            kmUtiles: metrics.usefulKm,
            trajetsExclus: metrics.excludedCount,
            pointageJson: JSON.stringify(localAnn.pointages),
            trajetsJson,
          };
        });

        const results = await upsertDailyDetailBatch({ data: { rows: batchRows } });
        for (const r of results) {
          if (r.id) newIds[r.key] = r.id;
          if (r.action === 'created') created++;
          else updated++;
        }

        if (i + BATCH_SIZE < tasks.length) {
          await new Promise((r) => setTimeout(r, 120));
        }
      }

      setDayAnnotations((prev) => {
        const next = { ...prev };
        for (const [k, id] of Object.entries(newIds)) {
          next[k] = { ...(next[k] ?? { excludedTripIds: [], pointages: [] }), mondayItemId: id };
        }
        return next;
      });

      toast.success('Tous les détails journaliers archivés sur Monday !', {
        description: `${created} créé(s) · ${updated} mis à jour dans « ${workbook.weekLabel} » (rechargeables sans Excel depuis n’importe quel PC).`,
      });
      await refreshMondayDetailsList();
      await refreshCommuteRecords();
    } catch (err: any) {
      toast.error('Erreur pendant l’archivage des détails journaliers', {
        description: err?.message || 'Relancez l’opération : l’anti-doublon reprendra automatiquement.',
      });
      await refreshMondayDetailsList();
      await refreshCommuteRecords();
    } finally {
      setSyncingDetails(false);
      setDetailsSyncProgress(null);
    }
  };

  const olderThan6MonthsWeeks = useMemo(
    () => mondayDetailWeeks.filter((w) => w.isOlderThan6Months && w.groupId),
    [mondayDetailWeeks],
  );

  const handleArchiveOldDetails = async () => {
    if (olderThan6MonthsWeeks.length === 0 || archivingOldDetails) return;
    const totalDays = olderThan6MonthsWeeks.reduce((s, w) => s + w.dayCount, 0);
    if (
      !window.confirm(
        `Archiver ${olderThan6MonthsWeeks.length} semaine(s) de plus de 13 mois (${totalDays} lignes journalières) dans l’archive Monday ?\n\nVous conservez ainsi une année complète active pour les indicateurs Mensuel / Trimestriel / Annuel, et les anciennes données restent récupérables dans les Archives Monday sans limite.`
      )
    ) {
      return;
    }
    setArchivingOldDetails(true);
    try {
      const res = await archiveDetailsOlderThan6Months({
        data: { groupIds: olderThan6MonthsWeeks.map((w) => w.groupId) },
      });
      toast.success(`${res.archivedGroups} groupe(s) archivé(s) sur Monday !`, {
        description: 'Quota d’éléments actifs libéré · historique toujours consultable dans les Archives Monday.',
      });
      await refreshMondayDetailsList();
      await refreshCommuteRecords();
    } catch (err: any) {
      toast.error('Erreur lors de l’archivage des anciennes semaines', { description: err?.message });
    } finally {
      setArchivingOldDetails(false);
    }
  };

  const mergedEmployeeOptions = useMemo(() => {
    const set = new Set<string>(rhEmployees);
    workbook?.vehicles.forEach((v) => {
      if (v.driverName && v.driverName !== '—') set.add(v.driverName);
    });
    Object.values(dayAnnotations).forEach((ann) => {
      ann.pointages.forEach((p) => {
        if (p.employeeName.trim()) set.add(p.employeeName.trim());
      });
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [rhEmployees, workbook, dayAnnotations]);

  // ==================== DONNÉES FILTRÉES : HISTORIQUE MONDAY ====================
  const activeHistoryWeekRecords = useMemo(() => {
    if (!history) return [];
    if (selectedHistoryWeek === 'all') return history.records;
    return history.records.filter((r) => r.semaine === selectedHistoryWeek);
  }, [history, selectedHistoryWeek]);

  const historyFleets = useMemo(() => {
    return Array.from(new Set(activeHistoryWeekRecords.map((r) => r.flotte).filter(Boolean))).sort();
  }, [activeHistoryWeekRecords]);

  const filteredHistoryRecords = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    return activeHistoryWeekRecords.filter((r) => {
      if (historyFleetFilter !== 'all' && r.flotte !== historyFleetFilter) return false;
      if (historyAlertFilter === 'alerts' && (r.alerte === 'Conforme' || r.alerte === 'Inactif')) return false;
      if (historyAlertFilter === 'offHours' && r.kmHors <= 0.05) return false;
      if (historyAlertFilter === 'weekend' && !r.alerte.includes('Week-end') && !r.alerte.includes('WE')) return false;
      if (historyAlertFilter === 'private' && r.alerte !== 'Vie privée') return false;
      if (historyAlertFilter === 'inactive' && r.alerte !== 'Inactif') return false;
      if (q) {
        const hay = `${r.plate} ${r.conducteur} ${r.flotte} ${r.semaine} ${r.syntheseJour}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [activeHistoryWeekRecords, historySearch, historyFleetFilter, historyAlertFilter]);

  const historyKpis = useMemo(() => {
    const list = activeHistoryWeekRecords;
    return {
      total: list.length,
      active: list.filter((r) => r.nbTrajets > 0 || r.kmTotal > 0).length,
      kmTotal: Math.round(list.reduce((s, r) => s + r.kmTotal, 0) * 10) / 10,
      kmPro: Math.round(list.reduce((s, r) => s + r.kmPro, 0) * 10) / 10,
      kmHors: Math.round(list.reduce((s, r) => s + r.kmHors, 0) * 10) / 10,
      trips: list.reduce((s, r) => s + r.nbTrajets, 0),
      alerts: list.filter((r) => r.alerte !== 'Conforme' && r.alerte !== 'Inactif').length,
      offHoursCount: list.filter((r) => r.kmHors > 0.05).length,
    };
  }, [activeHistoryWeekRecords]);

  const historyChartData = useMemo(() => {
    const sorted = [...filteredHistoryRecords]
      .filter((r) => r.kmTotal > 0 || r.amplitudeH > 0)
      .sort((a, b) => (historyChartMetric === 'km' ? b.kmTotal - a.kmTotal : b.amplitudeH - a.amplitudeH))
      .slice(0, 12);
    return sorted.map((r) => ({
      name: r.plate,
      conducteur: r.conducteur,
      kmPro: Math.round(r.kmPro * 10) / 10,
      kmHors: Math.round(r.kmHors * 10) / 10,
      amplitude: Math.round(r.amplitudeH * 100) / 100,
    }));
  }, [filteredHistoryRecords, historyChartMetric]);

  // ==================== DONNÉES FILTRÉES : EXPLORATEUR EXCEL ====================
  const filteredExplorerVehicles = useMemo(() => {
    if (!workbook) return [];
    const q = expSearch.trim().toLowerCase();
    const list = workbook.vehicles.filter((v) => {
      if (expFleetFilter !== 'all' && v.fleet !== expFleetFilter) return false;
      if (expAlertFilter === 'alerts' && (v.alertStatus === 'Conforme' || v.alertStatus === 'Inactif')) return false;
      if (expAlertFilter === 'offHours' && !v.hasOffHours) return false;
      if (expAlertFilter === 'weekend' && !v.hasWeekend) return false;
      if (expAlertFilter === 'private' && !v.hasPrivate) return false;
      if (expAlertFilter === 'inactive' && v.alertStatus !== 'Inactif') return false;
      if (q) {
        const hay = `${v.plate} ${v.vehicleLabel} ${v.driverName} ${v.fleet}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    return [...list].sort((a, b) => {
      if (expSortBy === 'offHours') return b.distanceOffHoursKm - a.distanceOffHoursKm || b.distanceKm - a.distanceKm;
      if (expSortBy === 'trips') return b.tripCount - a.tripCount;
      if (expSortBy === 'amplitude') return b.avgAmplitudeHours - a.avgAmplitudeHours;
      if (expSortBy === 'plate') return a.plate.localeCompare(b.plate);
      return b.distanceKm - a.distanceKm;
    });
  }, [workbook, expSearch, expFleetFilter, expAlertFilter, expSortBy]);

  const selectedVehicle = useMemo(() => {
    if (!workbook) return null;
    return (
      workbook.vehicles.find((v) => v.plate === selectedVehiclePlate) ||
      workbook.vehicles.find((v) => v.trips.length > 0) ||
      workbook.vehicles[0] ||
      null
    );
  }, [workbook, selectedVehiclePlate]);

  // Recalcul agrégé du véhicule sélectionné quand des trajets Domicile ↔ Travail sont exclus
  const selectedVehicleUsefulTotals = useMemo(() => {
    if (!selectedVehicle || selectedVehicle.days.length === 0) return null;
    let totalUsefulKm = 0;
    let totalExcludedCount = 0;
    let totalUsefulAmpMin = 0;
    let totalUsefulDriveMin = 0;
    let activeDaysCount = 0;
    let sumStartMin = 0;
    let sumEndMin = 0;
    let pointedDays = 0;
    let nonCompliantDays = 0;

    for (const d of selectedVehicle.days) {
      const key = `${normalizePlateKey(selectedVehicle.plate)}::${d.date}`;
      const ann = dayAnnotations[key];
      const exSet = new Set(ann?.excludedTripIds ?? []);
      const m = computeUsefulDayMetrics(d, exSet);
      totalUsefulKm += m.usefulKm;
      totalExcludedCount += m.excludedCount;
      totalUsefulAmpMin += m.usefulAmplitudeMin;
      totalUsefulDriveMin += m.usefulDriveMin;
      if (m.usefulTripsCount > 0) {
        activeDaysCount++;
        sumStartMin += m.usefulStartMin;
        sumEndMin += m.usefulEndMin;
      }
      if (ann && ann.pointages.length > 0) {
        const st = computePointageStatus(ann.pointages);
        if (st.status !== 'Non pointé') pointedDays++;
        if (st.status === 'Écart horaire') nonCompliantDays++;
      }
    }

    return {
      hasExclusions: totalExcludedCount > 0,
      totalExcludedCount,
      usefulKm: Math.round(totalUsefulKm * 10) / 10,
      avgUsefulAmpHours: activeDaysCount > 0 ? Math.round((totalUsefulAmpMin / activeDaysCount / 60) * 100) / 100 : 0,
      totalUsefulDriveHours: Math.round((totalUsefulDriveMin / 60) * 100) / 100,
      avgUsefulStart: activeDaysCount > 0 ? formatMinutesToHHMM(sumStartMin / activeDaysCount) : '—',
      avgUsefulEnd: activeDaysCount > 0 ? formatMinutesToHHMM(sumEndMin / activeDaysCount) : '—',
      pointedDays,
      nonCompliantDays,
    };
  }, [selectedVehicle, dayAnnotations]);

  const availableTripDays = useMemo(() => {
    if (!workbook) return [];
    const map = new Map<string, string>();
    for (const t of workbook.allTrips) {
      if (!map.has(t.date)) map.set(t.date, t.dayLabel);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [workbook]);

  const filteredTrips = useMemo(() => {
    if (!workbook) return [];
    const q = tripSearch.trim().toLowerCase();
    return workbook.allTrips.filter((t) => {
      if (tripDayFilter !== 'all' && t.date !== tripDayFilter) return false;
      if (tripVehicleFilter !== 'all' && t.plate !== tripVehicleFilter) return false;
      if (tripQuickFilter === 'weekend' && !t.isWeekend) return false;
      if (tripQuickFilter === 'private' && !t.isPrivate) return false;
      if (tripQuickFilter === 'early' && t.startMinutes >= 4 * 60 + 30) return false;
      if (tripQuickFilter === 'late' && t.endMinutes <= 19 * 60) return false;
      if (tripQuickFilter === 'long' && t.distanceKm < 20) return false;
      if (q) {
        const hay = `${t.plate} ${t.driverName} ${t.vehicleLabel} ${t.startAddress} ${t.endAddress} ${t.dayLabel}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [workbook, tripSearch, tripQuickFilter, tripDayFilter, tripVehicleFilter]);

  // Exports Excel enrichis
  const handleExportHistory = async () => {
    if (filteredHistoryRecords.length === 0) return;
    const label = selectedHistoryWeek === 'all' ? 'Toutes_Semaines' : selectedHistoryWeek;
    const ok = await exportToXlsx(
      createSpreadsheet({
        sheetName: `Geoloc_${label}`.slice(0, 31),
        columns: [
          'Semaine',
          'Immatriculation',
          'Conducteur / GPS',
          'Flotte',
          'Alerte',
          'Nb trajets',
          'Distance totale (km)',
          'Km horaires pro',
          'Km hors horaires',
          'Conduite (h)',
          'Attente (h)',
          'Vitesse moy. (km/h)',
          'Jours roulés',
          '1er départ moy.',
          'Dernière arrivée moy.',
          'Amplitude moy. (h)',
          'Synthèse journalière',
        ],
        rows: filteredHistoryRecords.map((r: MondayGeolocRecord) => [
          r.semaine,
          r.plate,
          r.conducteur,
          r.flotte,
          r.alerte,
          r.nbTrajets,
          r.kmTotal,
          r.kmPro,
          r.kmHors,
          r.conduiteH,
          r.attenteH,
          r.vitesseMoy,
          r.joursRoules,
          r.premierDepart,
          r.derniereArrivee,
          r.amplitudeH,
          r.syntheseJour,
        ]),
        columnWidths: { 0: 12, 1: 14, 2: 34, 3: 24, 4: 18, 16: 55 },
        theme: FACILITY_XLSX_THEME,
      }),
      `Synthese_Geoloc_${label}.xlsx`,
    );
    if (ok) toast.success('Synthèse exportée en Excel (.xlsx) !');
  };

  const handleExportFilteredTrips = async () => {
    if (!workbook || filteredTrips.length === 0) return;
    const ok = await exportToXlsx(
      createSpreadsheet({
        sheetName: `Trajets_${workbook.weekId}`.slice(0, 31),
        columns: [
          'Jour',
          'Date',
          'Immatriculation',
          'Conducteur',
          'Départ',
          'Lieu de départ',
          'Arrivée',
          'Lieu d’arrivée',
          'Distance (km)',
          'Durée',
          'Week-end',
          'Vie privée',
        ],
        rows: filteredTrips.map((t) => [
          t.dayLabel,
          t.date,
          t.plate,
          t.driverName,
          t.startTime,
          t.startAddress,
          t.endTime,
          t.endAddress,
          t.distanceKm,
          t.durationLabel,
          t.isWeekend ? 'Oui' : 'Non',
          t.isPrivate ? 'Oui' : 'Non',
        ]),
        columnWidths: { 0: 12, 1: 12, 2: 14, 3: 26, 4: 9, 5: 38, 6: 9, 7: 38, 8: 13, 9: 10 },
        theme: FACILITY_XLSX_THEME,
      }),
      `Trajets_GPS_${workbook.weekId}_${filteredTrips.length}lignes.xlsx`,
    );
    if (ok) toast.success(`${filteredTrips.length} trajets exportés en Excel (.xlsx) !`);
  };

  return (
    <div
      id="section-geoloc"
      className="relative w-full max-w-full rounded-[var(--radius-lg)] border border-border bg-card p-3.5 pt-8 sm:p-8"
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) handleFile(f);
      }}
    >
      {/* Badge Numéro 02 */}
      <div className="absolute -top-4 left-6 flex items-center gap-3 bg-background pr-3">
        <span className="inline-flex h-8 min-w-10 items-center justify-center rounded-[var(--radius-sm)] rounded-br-none bg-primary px-2 text-sm font-bold text-primary-foreground">
          02
        </span>
        <h2 className="text-xl font-bold">Géolocalisation &amp; Horaires</h2>
      </div>

      {/* Overlay glisser-déposer */}
      {dragOver && (
        <div className="pointer-events-none absolute inset-2 z-30 flex flex-col items-center justify-center gap-2 rounded-[var(--radius-lg)] border-2 border-dashed border-primary bg-primary/10 backdrop-blur-xs">
          <Upload className="h-10 w-10 text-primary animate-bounce" />
          <p className="text-sm font-extrabold text-foreground">Déposez votre export GPS (.xlsx) ici</p>
          <p className="text-xs text-muted-foreground">Lecture instantanée des 32 onglets &amp; trajets</p>
        </div>
      )}

      {/* Input fichier caché */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = '';
        }}
      />

      {/* En-tête de la carte */}
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
            <MapPin className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="text-sm">
              Explorez vos fichiers GPS multi-onglets (trajets, horaires, amplitudes, km hors horaires) et archivez la synthèse hebdomadaire propre sur Monday.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Liaison automatique par immatriculation officielle (<code className="font-mono font-semibold">AA-123-AA</code>) avec le parc véhicules.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 sm:shrink-0">
          <button
            type="button"
            disabled={parsing}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-primary px-4 text-xs font-bold text-primary-foreground shadow-xs transition hover:brightness-95 cursor-pointer disabled:opacity-60"
          >
            {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            <span>{workbook ? 'Importer un autre Excel GPS' : 'Importer un Excel GPS (.xlsx)'}</span>
          </button>

          <a
            href={GEOLOC_BOARD_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-[var(--radius-md)] border border-border bg-background px-3.5 text-xs font-bold text-foreground transition hover:bg-muted"
            title="Ouvrir le tableau Monday Synthèse Géolocalisation"
          >
            <Database className="h-3.5 w-3.5 text-primary" />
            <span>Tableau Monday</span>
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
          </a>
        </div>
      </div>

      {/* Sélecteur de mode : Synthèse Monday vs Détails & Pointages vs Km Domicile-Travail */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex w-full flex-wrap gap-1 rounded-[var(--radius-md)] border border-border bg-muted/50 p-1 sm:inline-flex sm:w-auto">
          <button
            type="button"
            onClick={() => setMainTab('history')}
            className={cn(
              'inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition cursor-pointer sm:flex-none sm:px-3.5',
              mainTab === 'history'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Database className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span>Synthèse Monday</span>
            {history && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-extrabold text-primary">
                {history.weeks.length} sem.
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setMainTab('explorer')}
            className={cn(
              'inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition cursor-pointer sm:flex-none sm:px-3.5',
              mainTab === 'explorer'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <FileSpreadsheet className="h-3.5 w-3.5 shrink-0 text-[#D66927]" />
            <span>Détails &amp; Pointages</span>
            {workbook ? (
              <span className="rounded-full bg-[#D66927]/15 px-2 py-0.5 text-[10px] font-extrabold text-[#D66927]">
                {workbook.totalTrips.toLocaleString('fr-FR')} trajets
              </span>
            ) : mondayDetailWeeks.length > 0 ? (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-extrabold text-primary">
                {mondayDetailWeeks.length} sem.
              </span>
            ) : null}
          </button>

          <button
            type="button"
            onClick={() => setMainTab('commute')}
            className={cn(
              'inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition cursor-pointer sm:flex-none sm:px-3.5',
              mainTab === 'commute'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Home className="h-3.5 w-3.5 text-[#1B4565]" />
            <span>Km Domicile-Travail</span>
            {totalCommuteKmBadge > 0 && (
              <span className="rounded-full bg-[#D66927]/15 px-2 py-0.5 text-[10px] font-extrabold text-[#D66927]">
                {totalCommuteKmBadge.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km
              </span>
            )}
          </button>
        </div>

        {mainTab === 'history' && (
          <div className="flex flex-wrap items-center gap-2">
            {history && history.weeks.length > 0 && (
              <SearchableSelect
                size="sm"
                clearable={false}
                searchable={history.weeks.length > 5}
                showDot={false}
                icon={<Calendar className="h-3.5 w-3.5 text-primary" />}
                className="w-[270px]"
                value={selectedHistoryWeek}
                onChange={(val) => setSelectedHistoryWeek(val)}
                options={[
                  ...history.weeks.map((w) => ({
                    value: w.weekId,
                    label: w.groupTitle || w.weekId,
                    sublabel: `${w.activeCount}/${w.vehicleCount} actifs`,
                  })),
                  ...(history.weeks.length > 1
                    ? [{ value: 'all', label: 'Toutes les semaines', sublabel: `${history.records.length} lignes` }]
                    : []),
                ]}
              />
            )}
            <button
              type="button"
              onClick={loadHistory}
              disabled={historyLoading}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-xs font-bold text-muted-foreground transition hover:bg-muted hover:text-foreground cursor-pointer"
              title="Recharger depuis Monday"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', historyLoading && 'animate-spin')} />
              <span className="hidden sm:inline">Actualiser</span>
            </button>
            {filteredHistoryRecords.length > 0 && (
              <button
                type="button"
                onClick={handleExportHistory}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-xs font-bold text-foreground transition hover:bg-muted cursor-pointer"
              >
                <Download className="h-3.5 w-3.5 text-primary" />
                <span>Export .xlsx</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* =========================================================================
          ONGLET 1 : SYNTHÈSE ARCHIVÉE SUR MONDAY (BOARD 5108497111)
         ========================================================================= */}
      {mainTab === 'history' && (
        <div className="mt-5 space-y-5">
          {historyLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-14">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-xs font-medium text-muted-foreground">Chargement du tableau Synthèse Géolocalisation…</p>
            </div>
          ) : !history || history.records.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-[var(--radius-xl)] border-2 border-dashed border-border bg-background/60 px-6 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-primary">
                <MapPin className="h-6 w-6" />
              </div>
              <p className="text-sm font-bold text-foreground">Aucune semaine encore enregistrée sur Monday</p>
              <p className="max-w-md text-xs text-muted-foreground">
                Glissez votre premier fichier Excel <code className="font-mono">Trajets YYYY-MM-DD.xlsx</code> pour explorer les 32 onglets et synchroniser la synthèse hebdomadaire en 1 clic.
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-2 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-xs hover:brightness-95 cursor-pointer"
              >
                <Upload className="h-4 w-4" />
                Importer mon premier export GPS
              </button>
            </div>
          ) : (
            <>
              {/* KPI Strip */}
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <div className="rounded-[var(--radius-xl)] border border-border bg-background p-3.5">
                  <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    <Car className="h-3.5 w-3.5 text-primary" /> Véhicules actifs
                  </p>
                  <p className="mt-1.5 font-[family-name:var(--font-heading)] text-3xl font-extrabold text-foreground">
                    {historyKpis.active}
                    <span className="ml-1 text-sm font-semibold text-muted-foreground">/ {historyKpis.total}</span>
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {historyKpis.trips.toLocaleString('fr-FR')} trajets enregistrés
                  </p>
                </div>

                <div className="rounded-[var(--radius-xl)] border border-border bg-background p-3.5">
                  <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    <Route className="h-3.5 w-3.5 text-primary" /> Distance totale
                  </p>
                  <p className="mt-1.5 font-[family-name:var(--font-heading)] text-3xl font-extrabold text-primary">
                    {Math.round(historyKpis.kmTotal).toLocaleString('fr-FR')}
                    <span className="ml-1 text-sm font-bold">km</span>
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    dont {Math.round(historyKpis.kmPro).toLocaleString('fr-FR')} km horaires pro
                  </p>
                </div>

                <div
                  className={cn(
                    'rounded-[var(--radius-xl)] border p-3.5',
                    historyKpis.kmHors > 0
                      ? 'border-amber-500/35 bg-amber-500/5'
                      : 'border-border bg-background',
                  )}
                >
                  <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    <AlertTriangle className={cn('h-3.5 w-3.5', historyKpis.kmHors > 0 ? 'text-amber-600' : 'text-emerald-600')} />
                    Km hors horaires
                  </p>
                  <p
                    className={cn(
                      'mt-1.5 font-[family-name:var(--font-heading)] text-3xl font-extrabold',
                      historyKpis.kmHors > 0 ? 'text-[#D66927]' : 'text-emerald-600',
                    )}
                  >
                    {historyKpis.kmHors.toLocaleString('fr-FR', { maximumFractionDigits: 1 })}
                    <span className="ml-1 text-sm font-bold">km</span>
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {historyKpis.offHoursCount} véhicule{historyKpis.offHoursCount > 1 ? 's' : ''} concerné{historyKpis.offHoursCount > 1 ? 's' : ''}
                  </p>
                </div>

                <div className="rounded-[var(--radius-xl)] border border-border bg-background p-3.5">
                  <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    <ShieldAlert className="h-3.5 w-3.5 text-purple-600" /> Points de vigilance
                  </p>
                  <p className="mt-1.5 font-[family-name:var(--font-heading)] text-3xl font-extrabold text-foreground">
                    {historyKpis.alerts}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Hors horaires, week-end ou vie privée
                  </p>
                </div>
              </div>

              {/* Graphique comparatif Top 12 */}
              {historyChartData.length > 0 && (
                <div className="rounded-[var(--radius-xl)] border border-border bg-background p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        {historyChartMetric === 'km'
                          ? 'Top 12 véhicules · Kilomètres pro vs hors horaires'
                          : 'Top 12 véhicules · Amplitude journalière moyenne (h)'}
                      </p>
                    </div>
                    <div className="inline-flex rounded-lg border border-border bg-card p-0.5 text-[11px] font-bold">
                      <button
                        type="button"
                        onClick={() => setHistoryChartMetric('km')}
                        className={cn(
                          'rounded-md px-2.5 py-1 transition cursor-pointer',
                          historyChartMetric === 'km' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                        )}
                      >
                        Kilomètres
                      </button>
                      <button
                        type="button"
                        onClick={() => setHistoryChartMetric('amplitude')}
                        className={cn(
                          'rounded-md px-2.5 py-1 transition cursor-pointer',
                          historyChartMetric === 'amplitude' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                        )}
                      >
                        Amplitude (h)
                      </button>
                    </div>
                  </div>
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={historyChartData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} interval={0} angle={-20} textAnchor="end" height={44} />
                        <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} width={40} />
                        <Tooltip
                          contentStyle={{
                            borderRadius: '10px',
                            border: '1px solid hsl(var(--border))',
                            backgroundColor: 'hsl(var(--card))',
                            fontSize: '12px',
                          }}
                          labelFormatter={(val, payload) => {
                            const p = payload?.[0]?.payload;
                            return p ? `${val} — ${p.conducteur}` : String(val);
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                        {historyChartMetric === 'km' && (
                          <Bar key="kmPro" dataKey="kmPro" name="Km horaires pro" stackId="a" fill="#39A9DC" radius={[0, 0, 0, 0]} />
                        )}
                        {historyChartMetric === 'km' && (
                          <Bar key="kmHors" dataKey="kmHors" name="Km hors horaires" stackId="a" fill="#D66927" radius={[4, 4, 0, 0]} />
                        )}
                        {historyChartMetric === 'amplitude' && (
                          <Bar key="amplitude" dataKey="amplitude" name="Amplitude moy. (h/jour)" fill="#3989B7" radius={[4, 4, 0, 0]} />
                        )}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Barre de filtres Historique */}
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    placeholder="Rechercher une plaque, un conducteur, une flotte…"
                    className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-xs font-medium outline-none focus:border-primary"
                  />
                </div>

                <SearchableSelect
                  size="sm"
                  clearable={false}
                  searchable={false}
                  showDot={false}
                  className="w-[180px]"
                  value={historyFleetFilter}
                  onChange={(val) => setHistoryFleetFilter(val)}
                  options={[
                    { value: 'all', label: 'Toutes les flottes' },
                    ...historyFleets.map((f) => ({ value: f, label: f })),
                  ]}
                />

                <div className="flex flex-wrap items-center gap-1">
                  {(
                    [
                      ['all', 'Tous'],
                      ['alerts', 'Alertes'],
                      ['offHours', 'Hors horaires'],
                      ['weekend', 'Week-end'],
                      ['private', 'Vie privée'],
                      ['inactive', 'Inactifs'],
                    ] as [AlertFilter, string][]
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setHistoryAlertFilter(id)}
                      className={cn(
                        'rounded-full border px-2.5 py-1 text-[11px] font-bold transition cursor-pointer',
                        historyAlertFilter === id
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-background text-muted-foreground hover:bg-muted',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tableau Historique Monday */}
              <div className="overflow-x-auto rounded-[var(--radius-xl)] border border-border bg-background">
                <table className="w-full min-w-[820px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      <th className="px-3 py-2.5">Véhicule / Conducteur</th>
                      <th className="px-3 py-2.5">Flotte</th>
                      <th className="px-3 py-2.5 text-right">Trajets</th>
                      <th className="px-3 py-2.5 text-right">Km total</th>
                      <th className="px-3 py-2.5 text-right">Hors hor.</th>
                      <th className="px-3 py-2.5 text-center">Horaires moy.</th>
                      <th className="px-3 py-2.5 text-right">Ampl. moy.</th>
                      <th className="px-3 py-2.5 text-center">Jours</th>
                      <th className="px-3 py-2.5">Statut</th>
                      <th className="px-2 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/70">
                    {filteredHistoryRecords.map((r) => {
                      const isExp = expandedHistoryId === r.id;
                      return (
                        <tr key={r.id} className="group transition hover:bg-muted/25">
                          <td className="px-3 py-2.5 align-top" colSpan={isExp ? 10 : undefined}>
                            {!isExp ? (
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono font-extrabold text-foreground">{r.plate}</span>
                                  {r.linkedVehicleId && (
                                    <span
                                      className="rounded bg-emerald-500/10 px-1 py-0.5 text-[9px] font-bold text-emerald-700"
                                      title="Lié automatiquement au tableau Suivi du parc véhicules"
                                    >
                                      Parc ✓
                                    </span>
                                  )}
                                </div>
                                <p className="max-w-[230px] truncate text-[11px] text-muted-foreground" title={r.conducteur}>
                                  {r.conducteur}
                                </p>
                              </div>
                            ) : (
                              /* Ligne dépliée avec la synthèse journalière stockée sur Monday */
                              <div className="space-y-2.5 py-1">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-mono text-sm font-extrabold text-foreground">{r.plate}</span>
                                    <span className="text-xs font-semibold text-muted-foreground">{r.conducteur}</span>
                                    <AlertBadge status={r.alerte} />
                                  </div>
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenVehicleDetailsFromHistory(r.semaine, r.plate)}
                                      className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-[11px] font-bold text-primary-foreground shadow-xs transition hover:brightness-95 cursor-pointer"
                                    >
                                      <Route className="h-3.5 w-3.5" /> Voir tous les trajets
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setExpandedHistoryId(null)}
                                      className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[11px] font-bold text-muted-foreground hover:text-foreground cursor-pointer"
                                    >
                                      <ChevronUp className="h-3.5 w-3.5" /> Replier
                                    </button>
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-5">
                                  <div className="rounded-lg border border-border bg-card px-2.5 py-1.5">
                                    <span className="text-muted-foreground">Distance :</span>{' '}
                                    <strong className="font-mono">{kmFmt(r.kmTotal)}</strong>
                                  </div>
                                  <div className="rounded-lg border border-border bg-card px-2.5 py-1.5">
                                    <span className="text-muted-foreground">Hors horaires :</span>{' '}
                                    <strong className={cn('font-mono', r.kmHors > 0 && 'text-[#D66927]')}>{kmFmt(r.kmHors)}</strong>
                                  </div>
                                  <div className="rounded-lg border border-border bg-card px-2.5 py-1.5">
                                    <span className="text-muted-foreground">Conduite :</span>{' '}
                                    <strong className="font-mono">{hoursFmt(r.conduiteH)}</strong>
                                  </div>
                                  <div className="rounded-lg border border-border bg-card px-2.5 py-1.5">
                                    <span className="text-muted-foreground">Attente :</span>{' '}
                                    <strong className="font-mono">{hoursFmt(r.attenteH)}</strong>
                                  </div>
                                  <div className="rounded-lg border border-border bg-card px-2.5 py-1.5">
                                    <span className="text-muted-foreground">Vitesse moy. :</span>{' '}
                                    <strong className="font-mono">{r.vitesseMoy} km/h</strong>
                                  </div>
                                </div>
                                <div className="rounded-lg border border-border/80 bg-card p-3">
                                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                    Synthèse journalière enregistrée ({r.semaine})
                                  </p>
                                  <div className="space-y-1 font-mono text-[11px] text-foreground">
                                    {(r.syntheseJour || 'Aucun détail journalier.').split('\n').map((line, idx) => (
                                      <div key={idx} className="rounded bg-muted/40 px-2 py-1">
                                        {line}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            )}
                          </td>
                          {!isExp && (
                            <>
                              <td className="px-3 py-2.5 text-[11px] text-muted-foreground">{r.flotte}</td>
                              <td className="px-3 py-2.5 text-right font-mono font-bold">{r.nbTrajets}</td>
                              <td className="px-3 py-2.5 text-right font-mono font-extrabold text-foreground">
                                {r.kmTotal.toLocaleString('fr-FR', { maximumFractionDigits: 1 })}
                              </td>
                              <td
                                className={cn(
                                  'px-3 py-2.5 text-right font-mono font-bold',
                                  r.kmHors > 0 ? 'text-[#D66927]' : 'text-muted-foreground/60',
                                )}
                              >
                                {r.kmHors > 0 ? r.kmHors.toLocaleString('fr-FR', { maximumFractionDigits: 1 }) : '—'}
                              </td>
                              <td className="px-3 py-2.5 text-center font-mono text-[11px] font-semibold">
                                {r.premierDepart !== '—' ? `${r.premierDepart} → ${r.derniereArrivee}` : '—'}
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono font-semibold">
                                {r.amplitudeH > 0 ? hoursFmt(r.amplitudeH) : '—'}
                              </td>
                              <td className="px-3 py-2.5 text-center font-mono font-bold">{r.joursRoules || '—'}</td>
                              <td className="px-3 py-2.5">
                                <AlertBadge status={r.alerte} />
                              </td>
                              <td className="px-2 py-2.5 text-right">
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenVehicleDetailsFromHistory(r.semaine, r.plate)}
                                    className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-2 py-1 text-[10px] font-bold text-primary hover:bg-primary hover:text-primary-foreground transition cursor-pointer"
                                    title="Ouvrir directement les trajets et pointages détaillés de ce véhicule"
                                  >
                                    <span>Trajets</span>
                                    <ArrowRight className="h-3 w-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setExpandedHistoryId(r.id)}
                                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:border-primary hover:text-primary cursor-pointer"
                                    title="Voir le récapitulatif jour par jour"
                                  >
                                    <ChevronDown className="h-4 w-4" />
                                  </button>
                                </div>
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                    {filteredHistoryRecords.length === 0 && (
                      <tr>
                        <td colSpan={10} className="px-4 py-8 text-center text-xs text-muted-foreground">
                          Aucun véhicule ne correspond à vos filtres.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* =========================================================================
          ONGLET 2 : DÉTAILS & POINTAGES (ARCHIVES MONDAY + IMPORT EXCEL GPS)
         ========================================================================= */}
      {mainTab === 'explorer' && (
        <div className="mt-5 space-y-5">
          {/* Barre de pilotage unifiée : Sélecteur de semaine synchronisé + actions discrètes */}
          <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto">
              {unifiedDetailWeekOptions.length > 0 ? (
                <SearchableSelect
                  size="sm"
                  clearable={false}
                  searchable={unifiedDetailWeekOptions.length > 6}
                  searchPlaceholder="Rechercher une semaine..."
                  icon={<Calendar className="h-3.5 w-3.5 text-primary" />}
                  className="w-full min-w-0 sm:w-72"
                  dropdownClassName="w-full max-w-[calc(100vw-2.5rem)] sm:min-w-[300px]"
                  value={currentUnifiedWeekValue}
                  onChange={handleUnifiedWeekChange}
                  options={unifiedDetailWeekOptions}
                />
              ) : (
                <span className="text-xs font-medium text-muted-foreground">
                  Aucune semaine archivée — importez un Excel GPS pour commencer.
                </span>
              )}

              {loadingMondayWeekId && (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Chargement…
                </span>
              )}

              {workbook && workbook.fileName?.startsWith('Archive Monday') && !loadingMondayWeekId && (
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <span>
                    <strong>{workbook.activeVehicles}</strong> véh. ·{' '}
                    <strong>{workbook.totalTrips.toLocaleString('fr-FR')}</strong> trajets ·{' '}
                    <strong>{kmFmt(workbook.totalKm)}</strong>
                  </span>
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {mondayDetailTotalItems > 0 && (
                <span
                  className="rounded-full border border-border bg-background px-2.5 py-1 font-mono text-[10px] font-bold text-muted-foreground"
                  title="Quota Monday Enterprise : 100 000 éléments actifs par tableau (archives illimitées)"
                >
                  {mondayDetailTotalItems.toLocaleString('fr-FR')} / 100 000 actifs
                </span>
              )}

              {olderThan6MonthsWeeks.length > 0 && (
                <button
                  type="button"
                  disabled={archivingOldDetails}
                  onClick={handleArchiveOldDetails}
                  className="inline-flex items-center gap-1 rounded-lg border border-amber-500/40 bg-amber-500/15 px-2.5 py-1 text-[11px] font-bold text-amber-800 hover:bg-amber-500/25 cursor-pointer disabled:opacity-50"
                  title="Archive sur Monday les semaines de plus de 13 mois (conserve 1 an complet actif pour les indicateurs annuels)"
                >
                  {archivingOldDetails ? <Loader2 className="h-3 w-3 animate-spin" /> : <Archive className="h-3 w-3" />}
                  <span>Archiver &gt; 13 mois ({olderThan6MonthsWeeks.length})</span>
                </button>
              )}

              <a
                href={GEOLOC_DETAILS_BOARD_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-border bg-background px-2.5 text-[11px] font-bold text-foreground hover:border-primary hover:text-primary"
                title="Ouvrir le tableau Monday Pointage & Détails Journaliers GPS"
              >
                <span>Tableau Pointages</span>
                <ExternalLink className="h-3 w-3 text-muted-foreground" />
              </a>
            </div>
          </div>

          {!workbook ? (
            loadingMondayWeekId ? (
              <div className="flex flex-col items-center justify-center gap-3 py-14">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-xs font-medium text-muted-foreground">Chargement des trajets et pointages depuis Monday…</p>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-[var(--radius-xl)] border-2 border-dashed border-primary/40 bg-primary/5 px-6 py-14 text-center transition hover:border-primary hover:bg-primary/10"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-card text-primary shadow-sm">
                  {parsing ? <Loader2 className="h-7 w-7 animate-spin" /> : <FileSpreadsheet className="h-7 w-7" />}
                </div>
                <div>
                  <p className="text-base font-extrabold text-foreground">
                    Glissez votre export GPS hebdomadaire (.xlsx) ici
                  </p>
                  <p className="mt-1 max-w-lg text-xs text-muted-foreground">
                    Ex : <code className="font-mono font-semibold">Trajets 2026-11-02 - 2026-11-08.xlsx</code>.
                    Tous les onglets véhicules sont analysés instantanément et archivés sur Monday pour toute l’équipe.
                  </p>
                </div>
                <span className="mt-1 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-xs">
                  <Upload className="h-4 w-4" /> Choisir un fichier Excel
                </span>
              </div>
            )
          ) : (
            <>
              {/* Bannière d'archivage affichée uniquement lors d'un import Excel local (ou pendant une synchro) */}
              {(!workbook.fileName?.startsWith('Archive Monday') || syncing || syncingDetails) && (
                <div className="rounded-[var(--radius-xl)] border border-[#D66927]/35 bg-[#D66927]/[0.06] p-4">
                  <div className="flex flex-col gap-3.5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#D66927] px-2.5 py-0.5 text-[11px] font-extrabold text-white">
                          <FileSpreadsheet className="h-3 w-3" /> Import Excel · {workbook.weekLabel}
                        </span>
                        <span className="truncate text-xs font-semibold text-muted-foreground">{workbook.fileName}</span>
                      </div>
                      <p className="mt-1.5 text-xs font-medium text-foreground">
                        <strong>{workbook.totalVehicles}</strong> véhicules ({workbook.activeVehicles} actifs) ·{' '}
                        <strong>{workbook.matchedDetailSheets}</strong> onglets détaillés ·{' '}
                        <strong>{workbook.totalTrips.toLocaleString('fr-FR')}</strong> trajets ·{' '}
                        <strong>{kmFmt(workbook.totalKm)}</strong> au total
                        {syncPreview && (
                          <span className="ml-2 text-emerald-700 font-semibold">
                            ({syncPreview.linkedCount}/{syncPreview.total} reliés au Parc)
                          </span>
                        )}
                      </p>
                    </div>

                    {/* Contrôles Synchro Monday */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {syncPreview && syncPreview.newCount > 0 ? (
                        <button
                          type="button"
                          disabled={syncing || syncingDetails}
                          onClick={() => handleSyncToMonday(false)}
                          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-emerald-700 cursor-pointer disabled:opacity-60"
                        >
                          {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                          <span>1. Archiver synthèse (+{syncPreview.newCount})</span>
                        </button>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Synthèse archivée ({syncPreview?.existingCount}/{syncPreview?.total})
                          </span>
                          <button
                            type="button"
                            disabled={syncing || syncingDetails}
                            onClick={() => handleSyncToMonday(true)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-bold text-foreground hover:bg-muted cursor-pointer disabled:opacity-60"
                            title="Met à jour la synthèse hebdomadaire sans créer de doublons"
                          >
                            <RefreshCw className={cn('h-3.5 w-3.5 text-primary', syncing && 'animate-spin')} />
                            <span>MAJ synthèse</span>
                          </button>
                        </div>
                      )}

                      {totalWorkbookActiveDays > 0 && (
                        <button
                          type="button"
                          disabled={syncing || syncingDetails}
                          onClick={handleSyncAllDetailsToMonday}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground shadow-xs transition hover:brightness-95 cursor-pointer disabled:opacity-60"
                          title="Enregistre tous les trajets détaillés, exclusions et pointages sur Monday (partagés avec toute l'équipe)"
                        >
                          {syncingDetails ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CloudUpload className="h-3.5 w-3.5" />}
                          <span>2. Archiver détails ({totalWorkbookActiveDays} j.)</span>
                        </button>
                      )}

                      <button
                        type="button"
                        disabled={syncing || syncingDetails}
                        onClick={() => {
                          if (mondayDetailWeeks.length > 0) {
                            handleLoadMondayDetailWeek(mondayDetailWeeks[0].weekId, { silent: true });
                          } else {
                            setWorkbook(null);
                          }
                        }}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
                        title="Fermer cet import et revenir aux archives Monday"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Barre de progression pendant la synchro synthèse */}
                  {syncing && syncProgress && (
                    <div className="mt-3 space-y-1.5 rounded-lg border border-primary/20 bg-card p-3">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="flex items-center gap-2 text-foreground">
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                          Synchronisation Synthèse Monday : {syncProgress.label}
                        </span>
                        <span className="font-mono text-primary">
                          {syncProgress.current} / {syncProgress.total}
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full bg-emerald-500 transition-all duration-150"
                          style={{
                            width: `${syncProgress.total > 0 ? (syncProgress.current / syncProgress.total) * 100 : 10}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Barre de progression pendant l'archivage des détails journaliers */}
                  {syncingDetails && detailsSyncProgress && (
                    <div className="mt-3 space-y-1.5 rounded-lg border border-primary/30 bg-card p-3">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="flex items-center gap-2 text-foreground">
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                          Archivage Détails &amp; Pointages Monday : {detailsSyncProgress.label}
                        </span>
                        <span className="font-mono text-primary">
                          {detailsSyncProgress.current} / {detailsSyncProgress.total}
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full bg-primary transition-all duration-150"
                          style={{
                            width: `${detailsSyncProgress.total > 0 ? (detailsSyncProgress.current / detailsSyncProgress.total) * 100 : 5}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 3 Sous-Vues de l'Explorateur */}
              <div className="flex flex-wrap items-center gap-2">
                {(
                  [
                    ['summary', `Synthèse Flotte (${workbook.totalVehicles})`, Car],
                    ['vehicle', `Fiche Véhicule & Horaires (${workbook.matchedDetailSheets} onglets)`, Clock],
                    ['trips', `Tous les Trajets (${workbook.allTrips.length.toLocaleString('fr-FR')})`, Route],
                  ] as const
                ).map(([id, label, Icon]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setExplorerSubTab(id)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-bold transition cursor-pointer',
                      explorerSubTab === id
                        ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                        : 'border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>

              {/* ---------- SOUS-VUE 1 : SYNTHÈSE FLOTTE (39 VÉHICULES) ---------- */}
              {explorerSubTab === 'summary' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <div className="rounded-[var(--radius-xl)] border border-border bg-background p-3.5">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Distance semaine</p>
                      <p className="mt-1 font-[family-name:var(--font-heading)] text-2xl font-extrabold text-primary">
                        {kmFmt(workbook.totalKm)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">{workbook.totalDriveHours} h de conduite</p>
                    </div>
                    <div className="rounded-[var(--radius-xl)] border border-amber-500/30 bg-amber-500/5 p-3.5">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Km hors horaires</p>
                      <p className="mt-1 font-[family-name:var(--font-heading)] text-2xl font-extrabold text-[#D66927]">
                        {kmFmt(workbook.totalKmOffHours)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">{workbook.offHoursVehiclesCount} véhicule(s)</p>
                    </div>
                    <div className="rounded-[var(--radius-xl)] border border-border bg-background p-3.5">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Activité Week-end</p>
                      <p className="mt-1 font-[family-name:var(--font-heading)] text-2xl font-extrabold text-purple-600">
                        {workbook.weekendVehiclesCount} véh.
                      </p>
                      <p className="text-[11px] text-muted-foreground">Samedi / Dimanche</p>
                    </div>
                    <div className="rounded-[var(--radius-xl)] border border-border bg-background p-3.5">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Mode Vie privée</p>
                      <p className="mt-1 font-[family-name:var(--font-heading)] text-2xl font-extrabold text-sky-600">
                        {workbook.privateVehiclesCount} véh.
                      </p>
                      <p className="text-[11px] text-muted-foreground">Trajets masqués détectés</p>
                    </div>
                  </div>

                  {/* Filtres + Tri */}
                  <div className="flex flex-wrap items-center gap-2.5">
                    <div className="relative flex-1 min-w-[200px]">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="text"
                        value={expSearch}
                        onChange={(e) => setExpSearch(e.target.value)}
                        placeholder="Filtrer par plaque, conducteur, flotte…"
                        className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-xs font-medium outline-none focus:border-primary"
                      />
                    </div>
                    <SearchableSelect
                      size="sm"
                      clearable={false}
                      searchable={false}
                      showDot={false}
                      className="w-[175px]"
                      value={expFleetFilter}
                      onChange={(val) => setExpFleetFilter(val)}
                      options={[
                        { value: 'all', label: 'Toutes les flottes' },
                        ...workbook.fleets.map((f) => ({ value: f, label: f })),
                      ]}
                    />
                    <SearchableSelect
                      size="sm"
                      clearable={false}
                      searchable={false}
                      showDot={false}
                      className="w-[195px]"
                      value={expSortBy}
                      onChange={(val) => setExpSortBy(val as typeof expSortBy)}
                      options={[
                        { value: 'km', label: 'Trier : Km total' },
                        { value: 'offHours', label: 'Trier : Km hors horaires' },
                        { value: 'amplitude', label: 'Trier : Amplitude moy.' },
                        { value: 'trips', label: 'Trier : Nb trajets' },
                        { value: 'plate', label: 'Trier : Immatriculation' },
                      ]}
                    />
                    <div className="flex flex-wrap items-center gap-1">
                      {(
                        [
                          ['all', 'Tous'],
                          ['alerts', 'Alertes'],
                          ['offHours', 'Hors hor.'],
                          ['weekend', 'WE'],
                          ['private', 'Vie privée'],
                          ['inactive', 'Inactifs'],
                        ] as [AlertFilter, string][]
                      ).map(([id, label]) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setExpAlertFilter(id)}
                          className={cn(
                            'rounded-full border px-2.5 py-1 text-[11px] font-bold transition cursor-pointer',
                            expAlertFilter === id
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border bg-background text-muted-foreground hover:bg-muted',
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tableau 39 véhicules */}
                  <div className="overflow-x-auto rounded-[var(--radius-xl)] border border-border bg-background">
                    <table className="w-full min-w-[860px] text-left text-xs">
                      <thead>
                        <tr className="border-b border-border bg-muted/40 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          <th className="px-3 py-2.5">Véhicule / Conducteur</th>
                          <th className="px-3 py-2.5">Flotte</th>
                          <th className="px-3 py-2.5 text-right">Trajets</th>
                          <th className="px-3 py-2.5 text-right">Km total</th>
                          <th className="px-3 py-2.5 text-right">Hors hor.</th>
                          <th className="px-3 py-2.5 text-center">Horaires moy.</th>
                          <th className="px-3 py-2.5 text-right">Ampl. moy.</th>
                          <th className="px-3 py-2.5 text-center">Jours</th>
                          <th className="px-3 py-2.5">Alertes</th>
                          <th className="px-2 py-2.5 text-right">Onglet</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/70">
                        {filteredExplorerVehicles.map((v) => (
                          <tr
                            key={v.id}
                            onClick={() => {
                              setSelectedVehiclePlate(v.plate);
                              setExplorerSubTab('vehicle');
                            }}
                            className="cursor-pointer transition hover:bg-primary/5"
                          >
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-1.5">
                                {v.fleetNumber && (
                                  <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-extrabold text-primary">
                                    #{v.fleetNumber}
                                  </span>
                                )}
                                <span className="font-mono font-extrabold text-foreground">{v.plate}</span>
                              </div>
                              <p className="max-w-[230px] truncate text-[11px] text-muted-foreground" title={v.vehicleLabel}>
                                {v.driverName}
                              </p>
                            </td>
                            <td className="px-3 py-2.5 text-[11px] text-muted-foreground">{v.fleet}</td>
                            <td className="px-3 py-2.5 text-right font-mono font-bold">{v.tripCount}</td>
                            <td className="px-3 py-2.5 text-right font-mono font-extrabold">
                              {v.distanceKm.toLocaleString('fr-FR', { maximumFractionDigits: 1 })}
                            </td>
                            <td
                              className={cn(
                                'px-3 py-2.5 text-right font-mono font-bold',
                                v.hasOffHours ? 'text-[#D66927]' : 'text-muted-foreground/50',
                              )}
                            >
                              {v.hasOffHours ? v.distanceOffHoursKm.toLocaleString('fr-FR', { maximumFractionDigits: 1 }) : '—'}
                            </td>
                            <td className="px-3 py-2.5 text-center font-mono text-[11px] font-semibold">
                              {v.avgFirstDeparture !== '—' ? `${v.avgFirstDeparture} → ${v.avgLastArrival}` : '—'}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono font-semibold">
                              {v.avgAmplitudeHours > 0 ? hoursFmt(v.avgAmplitudeHours) : '—'}
                            </td>
                            <td className="px-3 py-2.5 text-center font-mono font-bold">
                              {v.daysActive || '—'}
                              {v.weekendDays > 0 && (
                                <span className="ml-1 rounded bg-purple-500/15 px-1 text-[9px] text-purple-700">
                                  +{v.weekendDays}WE
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex flex-wrap items-center gap-1">
                                <AlertBadge status={v.alertStatus} />
                                {v.hasPrivate && v.alertStatus !== 'Vie privée' && (
                                  <span className="rounded-full border border-sky-500/25 bg-sky-500/10 px-1.5 py-0.5 text-[9px] font-bold text-sky-700">
                                    Vie privée
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-2 py-2.5 text-right">
                              <span className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[10px] font-bold text-primary">
                                Voir <ArrowRight className="h-3 w-3" />
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ---------- SOUS-VUE 2 : FICHE VÉHICULE & HORAIRES (ONGLET PAR ONGLET) ---------- */}
              {explorerSubTab === 'vehicle' && selectedVehicle && (
                <div className="space-y-4">
                  {/* Sélecteur rapide de véhicule */}
                  <div className="flex flex-col gap-3 rounded-[var(--radius-xl)] border border-border bg-background p-3.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                    <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2.5">
                      <label className="text-xs font-bold text-muted-foreground shrink-0">Véhicule :</label>
                      <SearchableSelect
                        size="sm"
                        clearable={false}
                        searchable={true}
                        searchPlaceholder="Rechercher plaque, conducteur, alerte..."
                        className="w-full min-w-0 sm:max-w-[460px]"
                        dropdownClassName="w-full max-w-[calc(100vw-2.5rem)] sm:min-w-[340px]"
                        value={selectedVehicle.plate}
                        onChange={(val) => {
                          setSelectedVehiclePlate(val);
                          setExpandedDays({});
                        }}
                        options={workbook.vehicles.map((v) => ({
                          value: v.plate,
                          label: `${v.plate} — ${v.driverName}`,
                          sublabel: `${v.tripCount} trajets · ${Math.round(v.distanceKm)} km${v.alertStatus !== 'Conforme' && v.alertStatus !== 'Inactif' ? ` · ${v.alertStatus}` : ''}`,
                          badgeColor:
                            v.alertStatus === 'Hors horaires + WE'
                              ? '#dc2626'
                              : v.alertStatus === 'Hors horaires'
                                ? '#D66927'
                                : v.alertStatus === 'Week-end'
                                  ? '#9333ea'
                                  : v.alertStatus === 'Vie privée'
                                    ? '#0284c7'
                                    : v.alertStatus === 'Inactif'
                                      ? '#94a3b8'
                                      : '#00c875',
                          searchTokens: [v.plate, v.driverName, v.fleet, v.alertStatus],
                        }))}
                      />
                      <AlertBadge status={selectedVehicle.alertStatus} />
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-xs bg-[#39A9DC]" /> Pro</span>
                      <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-xs bg-[#D66927]" /> &lt;04h30 / &gt;19h30</span>
                      <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-xs bg-purple-500" /> Week-end</span>
                      <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-xs bg-sky-500" /> Vie privée</span>
                      <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-xs border border-dashed border-slate-500 bg-slate-400/50" /> Exclu Domicile</span>
                    </div>
                  </div>

                  {/* Bandeau KPIs du véhicule (avec recalcul temps utile si trajets exclus) */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                    <div className="rounded-xl border border-border bg-background p-3">
                      <p className="text-[10px] font-bold uppercase text-muted-foreground">
                        {selectedVehicleUsefulTotals?.hasExclusions ? 'Distance utile' : 'Distance'}
                      </p>
                      <p className="mt-1 font-mono text-lg font-extrabold text-primary">
                        {kmFmt(
                          selectedVehicleUsefulTotals?.hasExclusions
                            ? selectedVehicleUsefulTotals.usefulKm
                            : selectedVehicle.distanceKm
                        )}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {selectedVehicleUsefulTotals?.hasExclusions
                          ? `Brut ${kmFmt(selectedVehicle.distanceKm)} (${selectedVehicleUsefulTotals.totalExcludedCount} exclu(s))`
                          : `${selectedVehicle.tripCount} trajets`}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border bg-background p-3">
                      <p className="text-[10px] font-bold uppercase text-muted-foreground">Hors horaires</p>
                      <p className={cn('mt-1 font-mono text-lg font-extrabold', selectedVehicle.hasOffHours ? 'text-[#D66927]' : 'text-emerald-600')}>
                        {kmFmt(selectedVehicle.distanceOffHoursKm)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Pro : {kmFmt(selectedVehicle.distanceProKm)}</p>
                    </div>
                    <div className="rounded-xl border border-border bg-background p-3">
                      <p className="text-[10px] font-bold uppercase text-muted-foreground">
                        {selectedVehicleUsefulTotals?.hasExclusions ? 'Début utile moy.' : '1er départ moy.'}
                      </p>
                      <p className="mt-1 font-mono text-lg font-extrabold text-foreground">
                        {selectedVehicleUsefulTotals?.hasExclusions
                          ? selectedVehicleUsefulTotals.avgUsefulStart
                          : selectedVehicle.avgFirstDeparture}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {selectedVehicleUsefulTotals?.hasExclusions
                          ? `Brut : ${selectedVehicle.avgFirstDeparture}`
                          : `Plus tôt : ${selectedVehicle.earliestDeparture}`}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border bg-background p-3">
                      <p className="text-[10px] font-bold uppercase text-muted-foreground">
                        {selectedVehicleUsefulTotals?.hasExclusions ? 'Fin utile moy.' : 'Dernière arrivée'}
                      </p>
                      <p className="mt-1 font-mono text-lg font-extrabold text-foreground">
                        {selectedVehicleUsefulTotals?.hasExclusions
                          ? selectedVehicleUsefulTotals.avgUsefulEnd
                          : selectedVehicle.avgLastArrival}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {selectedVehicleUsefulTotals?.hasExclusions
                          ? `Brut : ${selectedVehicle.avgLastArrival}`
                          : `Plus tard : ${selectedVehicle.latestArrival}`}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border bg-background p-3">
                      <p className="text-[10px] font-bold uppercase text-muted-foreground">
                        {selectedVehicleUsefulTotals?.hasExclusions ? 'Amplitude utile moy.' : 'Amplitude moy.'}
                      </p>
                      <p
                        className={cn(
                          'mt-1 font-mono text-lg font-extrabold',
                          selectedVehicleUsefulTotals?.hasExclusions ? 'text-emerald-600' : 'text-[#3989B7]',
                        )}
                      >
                        {hoursFmt(
                          selectedVehicleUsefulTotals?.hasExclusions
                            ? selectedVehicleUsefulTotals.avgUsefulAmpHours
                            : selectedVehicle.avgAmplitudeHours
                        )}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {selectedVehicleUsefulTotals?.hasExclusions
                          ? `Brut ${hoursFmt(selectedVehicle.avgAmplitudeHours)} · ${selectedVehicle.daysActive} j.`
                          : `${selectedVehicle.daysActive} jour(s) roulé(s)`}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border bg-background p-3">
                      <p className="text-[10px] font-bold uppercase text-muted-foreground">
                        {selectedVehicleUsefulTotals && selectedVehicleUsefulTotals.pointedDays > 0
                          ? 'Pointage semaine'
                          : 'Conduite / Attente'}
                      </p>
                      {selectedVehicleUsefulTotals && selectedVehicleUsefulTotals.pointedDays > 0 ? (
                        <>
                          <p
                            className={cn(
                              'mt-1 font-mono text-lg font-extrabold',
                              selectedVehicleUsefulTotals.nonCompliantDays > 0 ? 'text-red-600' : 'text-emerald-600',
                            )}
                          >
                            {selectedVehicleUsefulTotals.pointedDays}/{selectedVehicle.daysActive} j.
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {selectedVehicleUsefulTotals.nonCompliantDays > 0
                              ? `${selectedVehicleUsefulTotals.nonCompliantDays} jour(s) en écart`
                              : 'Tous conformes ✓'}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="mt-1 font-mono text-lg font-extrabold text-foreground">
                            {hoursFmt(
                              selectedVehicleUsefulTotals?.hasExclusions
                                ? selectedVehicleUsefulTotals.totalUsefulDriveHours
                                : selectedVehicle.driveDurationHours
                            )}
                          </p>
                          <p className="text-[10px] text-muted-foreground">Attente : {hoursFmt(selectedVehicle.waitDurationHours)}</p>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Détail jour par jour : Exclusions Domicile ↔ Travail + Pointage Multi-Salariés + Timeline */}
                  {selectedVehicle.days.length === 0 ? (
                    <div className="rounded-xl border border-border bg-background p-8 text-center text-xs text-muted-foreground">
                      Aucun trajet enregistré pour ce véhicule sur cette semaine.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selectedVehicle.days.map((day) => {
                        const dayKey = `${normalizePlateKey(selectedVehicle.plate)}::${day.date}`;
                        const annotation: DayAnnotationState = dayAnnotations[dayKey] ?? {
                          excludedTripIds: [],
                          pointages: [],
                        };
                        const isOpen = expandedDays[day.date] ?? false;
                        return (
                          <GeolocDayDetailCard
                            key={day.date}
                            day={day}
                            defaultDriverName={selectedVehicle.driverName}
                            employeeOptions={mergedEmployeeOptions}
                            annotation={annotation}
                            isOpen={isOpen}
                            saving={savingDayKey === dayKey}
                            onToggleOpen={() =>
                              setExpandedDays((prev) => ({ ...prev, [day.date]: !isOpen }))
                            }
                            onChangeAnnotation={(next) =>
                              setDayAnnotations((prev) => ({ ...prev, [dayKey]: next }))
                            }
                            onSaveDayToMonday={() => handleSaveSingleDayToMonday(selectedVehicle, day)}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ---------- SOUS-VUE 3 : RECHERCHE GLOBALE SUR TOUS LES TRAJETS (1 110+) ---------- */}
              {explorerSubTab === 'trips' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <div className="relative flex-1 min-w-[220px]">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="text"
                        value={tripSearch}
                        onChange={(e) => {
                          setTripSearch(e.target.value);
                          setTripVisibleCount(60);
                        }}
                        placeholder="Rechercher un chantier, une adresse, un conducteur (ex: EUROPIMED, MENCO, Pornic)…"
                        className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-xs font-medium outline-none focus:border-primary"
                      />
                    </div>

                    <SearchableSelect
                      size="sm"
                      clearable={false}
                      searchable={false}
                      showDot={false}
                      className="w-[180px]"
                      value={tripDayFilter}
                      onChange={(val) => setTripDayFilter(val)}
                      options={[
                        { value: 'all', label: 'Tous les jours' },
                        ...availableTripDays.map(([d, label]) => ({ value: d, label })),
                      ]}
                    />

                    <SearchableSelect
                      size="sm"
                      clearable={false}
                      searchable={true}
                      searchPlaceholder="Filtrer un véhicule..."
                      className="w-[240px]"
                      dropdownClassName="min-w-[280px]"
                      value={tripVehicleFilter}
                      onChange={(val) => setTripVehicleFilter(val)}
                      options={[
                        { value: 'all', label: 'Tous les véhicules', badgeColor: '#39A9DC' },
                        ...workbook.vehicles
                          .filter((v) => v.trips.length > 0)
                          .map((v) => ({
                            value: v.plate,
                            label: `${v.plate} · ${v.driverName}`,
                            sublabel: `${v.tripCount} traj.`,
                            searchTokens: [v.plate, v.driverName, v.fleet],
                          })),
                      ]}
                    />

                    <button
                      type="button"
                      disabled={filteredTrips.length === 0}
                      onClick={handleExportFilteredTrips}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-xs font-bold text-foreground hover:bg-muted cursor-pointer disabled:opacity-50"
                    >
                      <Download className="h-3.5 w-3.5 text-primary" />
                      <span>Exporter ({filteredTrips.length})</span>
                    </button>
                  </div>

                  {/* Puces de filtres rapides */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {(
                        [
                          ['all', 'Tous les trajets'],
                          ['weekend', 'Week-end (Sam/Dim)'],
                          ['private', 'Vie privée'],
                          ['early', 'Très tôt (< 04h30)'],
                          ['late', 'Tardif (> 19h00)'],
                          ['long', 'Longs (> 20 km)'],
                        ] as [TripQuickFilter, string][]
                      ).map(([id, label]) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => {
                            setTripQuickFilter(id);
                            setTripVisibleCount(60);
                          }}
                          className={cn(
                            'rounded-full border px-2.5 py-1 text-[11px] font-bold transition cursor-pointer',
                            tripQuickFilter === id
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border bg-background text-muted-foreground hover:bg-muted',
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    <p className="text-xs font-semibold text-muted-foreground">
                      <strong className="text-foreground">{filteredTrips.length.toLocaleString('fr-FR')}</strong> trajets ·{' '}
                      <strong className="text-primary">
                        {kmFmt(Math.round(filteredTrips.reduce((s, t) => s + t.distanceKm, 0) * 10) / 10)}
                      </strong>
                    </p>
                  </div>

                  <div className="overflow-x-auto rounded-[var(--radius-xl)] border border-border bg-background">
                    <table className="w-full min-w-[840px] text-left text-[11px]">
                      <thead>
                        <tr className="border-b border-border bg-muted/40 text-[10px] font-bold uppercase text-muted-foreground">
                          <th className="px-3 py-2.5">Jour</th>
                          <th className="px-3 py-2.5">Véhicule</th>
                          <th className="px-3 py-2.5">Horaire</th>
                          <th className="px-3 py-2.5">Départ</th>
                          <th className="px-3 py-2.5">Arrivée</th>
                          <th className="px-3 py-2.5 text-right">Km</th>
                          <th className="px-3 py-2.5 text-right">Durée</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {filteredTrips.slice(0, tripVisibleCount).map((t) => (
                          <tr key={t.id} className={cn('hover:bg-muted/25', t.isPrivate && 'bg-sky-500/5', t.isWeekend && 'bg-purple-500/[0.03]')}>
                            <td className="px-3 py-2 font-mono font-bold whitespace-nowrap">
                              {t.dayLabel}
                              {t.isWeekend && <span className="ml-1 rounded bg-purple-500/15 px-1 text-[9px] text-purple-700">WE</span>}
                            </td>
                            <td className="px-3 py-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedVehiclePlate(t.plate);
                                  setExplorerSubTab('vehicle');
                                }}
                                className="text-left hover:underline cursor-pointer"
                              >
                                <span className="font-mono font-extrabold text-primary">{t.plate}</span>
                                <span className="block max-w-[160px] truncate text-[10px] text-muted-foreground">{t.driverName}</span>
                              </button>
                            </td>
                            <td className="px-3 py-2 font-mono font-bold whitespace-nowrap">
                              {t.startTime} → {t.endTime}
                            </td>
                            <td className="px-3 py-2 max-w-[220px] truncate" title={t.startAddress}>{t.startAddress}</td>
                            <td className="px-3 py-2 max-w-[220px] truncate font-medium" title={t.endAddress}>{t.endAddress}</td>
                            <td className="px-3 py-2 text-right font-mono font-bold">{t.distanceKm}</td>
                            <td className="px-3 py-2 text-right font-mono text-muted-foreground">{t.durationLabel}</td>
                          </tr>
                        ))}
                        {filteredTrips.length === 0 && (
                          <tr>
                            <td colSpan={7} className="px-4 py-8 text-center text-xs text-muted-foreground">
                              Aucun trajet trouvé avec ces critères.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {filteredTrips.length > tripVisibleCount && (
                    <div className="flex justify-center">
                      <button
                        type="button"
                        onClick={() => setTripVisibleCount((c) => c + 100)}
                        className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-xs font-bold text-foreground hover:bg-muted cursor-pointer"
                      >
                        Afficher plus ({filteredTrips.length - tripVisibleCount} restants)
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ================================================================== */}
      {/* ONGLET 3 : KM DOMICILE ↔ TRAVAIL (MENSUEL / TRIMESTRIEL / ANNUEL)  */}
      {/* ================================================================== */}
      {mainTab === 'commute' && (
        <GeolocCommuteKmPanel
          mondayRecords={mondayCommuteRecords}
          liveRecords={liveCommuteRecords}
          loading={commuteLoading}
          onRefresh={refreshCommuteRecords}
          onGoToExplorer={() => setMainTab('explorer')}
        />
      )}
    </div>
  );
}
