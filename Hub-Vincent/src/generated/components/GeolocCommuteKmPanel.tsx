import { useMemo, useState } from 'react';
import {
  ArrowRight,
  Calendar,
  Car,
  ChevronDown,
  ChevronUp,
  Download,
  Home,
  Loader2,
  RefreshCw,
  Route,
  Search,
  TrendingUp,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { toast } from 'sonner';
import type { CommuteDayRecord } from '@generated/server/geolocDetails';
import SearchableSelect from '@components/SearchableSelect';
import { createSpreadsheet, createTheme, useXlsxExport } from '@/skills/xlsx-export';
import { cn } from '@lib/utils';

type PeriodMode = 'month' | 'quarter' | 'year';

interface GeolocCommuteKmPanelProps {
  mondayRecords: CommuteDayRecord[];
  liveRecords: CommuteDayRecord[];
  loading: boolean;
  onRefresh: () => void;
  onGoToExplorer?: () => void;
}

const MONTH_NAMES_FR = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
];

const FACILITY_XLSX_THEME = createTheme({
  primary: 'FF39A9DC',
  secondary: 'FF3989B7',
  neutral: 'FFE8F5FC',
  font: 'Calibri',
});

function kmFmt(n: number): string {
  return `${n.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;
}

function getQuarter(month1Based: number): number {
  return Math.floor((month1Based - 1) / 3) + 1;
}

export default function GeolocCommuteKmPanel({
  mondayRecords,
  liveRecords,
  loading,
  onRefresh,
  onGoToExplorer,
}: GeolocCommuteKmPanelProps) {
  const { exportToXlsx } = useXlsxExport();

  // Fusion Monday + live (les coches en cours dans l'Explorateur Excel prennent le dessus en temps réel)
  const mergedRecords = useMemo<CommuteDayRecord[]>(() => {
    const map = new Map<string, CommuteDayRecord>();
    for (const r of mondayRecords) {
      map.set(r.key, r);
    }
    for (const r of liveRecords) {
      if (r.excludedTripsCount > 0 || r.commuteKm > 0) {
        map.set(r.key, r);
      } else {
        // Si toutes les cases ont été décochées en live sur ce jour, retirer l'ancienne entrée
        map.delete(r.key);
      }
    }
    return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [mondayRecords, liveRecords]);

  // Années disponibles
  const availableYears = useMemo(() => {
    const set = new Set<string>();
    for (const r of mergedRecords) {
      const y = r.date.slice(0, 4);
      if (/^\d{4}$/.test(y)) set.add(y);
    }
    if (set.size === 0) set.add(String(new Date().getFullYear()));
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [mergedRecords]);

  const [periodMode, setPeriodMode] = useState<PeriodMode>('month');
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>(''); // "YYYY-MM"
  const [selectedQuarter, setSelectedQuarter] = useState<string>(''); // "YYYY-Q1"
  const [search, setSearch] = useState<string>('');
  const [chartView, setChartView] = useState<'vehicles' | 'evolution'>('vehicles');
  const [expandedPlateKey, setExpandedPlateKey] = useState<string | null>(null);

  const effectiveYear =
    selectedYear && availableYears.includes(selectedYear) ? selectedYear : availableYears[0];

  // Mois & Trimestres disponibles pour l'année sélectionnée
  const monthOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of mergedRecords) {
      if (!r.date.startsWith(effectiveYear)) continue;
      const ym = r.date.slice(0, 7);
      counts.set(ym, (counts.get(ym) || 0) + r.commuteKm);
    }
    const list: Array<{ value: string; label: string }> = [];
    for (let m = 12; m >= 1; m--) {
      const ym = `${effectiveYear}-${String(m).padStart(2, '0')}`;
      const km = counts.get(ym);
      if (km !== undefined) {
        list.push({
          value: ym,
          label: `${MONTH_NAMES_FR[m - 1]} ${effectiveYear} (${km.toFixed(0)} km)`,
        });
      }
    }
    if (list.length === 0) {
      const curM = new Date().getMonth() + 1;
      list.push({
        value: `${effectiveYear}-${String(curM).padStart(2, '0')}`,
        label: `${MONTH_NAMES_FR[curM - 1]} ${effectiveYear}`,
      });
    }
    return list;
  }, [mergedRecords, effectiveYear]);

  const effectiveMonth =
    selectedMonth && monthOptions.some((o) => o.value === selectedMonth)
      ? selectedMonth
      : monthOptions[0]?.value || `${effectiveYear}-01`;

  const quarterOptions = useMemo(() => {
    const qLabels = [
      { q: 1, label: `T1 ${effectiveYear} (Jan – Mar)` },
      { q: 2, label: `T2 ${effectiveYear} (Avr – Jun)` },
      { q: 3, label: `T3 ${effectiveYear} (Jul – Sep)` },
      { q: 4, label: `T4 ${effectiveYear} (Oct – Déc)` },
    ];
    const totals = new Map<number, number>();
    for (const r of mergedRecords) {
      if (!r.date.startsWith(effectiveYear)) continue;
      const m = Number(r.date.slice(5, 7));
      if (m >= 1 && m <= 12) {
        const q = getQuarter(m);
        totals.set(q, (totals.get(q) || 0) + r.commuteKm);
      }
    }
    return qLabels.map((item) => {
      const km = totals.get(item.q) || 0;
      return {
        value: `${effectiveYear}-Q${item.q}`,
        label: km > 0 ? `${item.label} • ${km.toFixed(0)} km` : item.label,
        hasData: km > 0,
      };
    });
  }, [mergedRecords, effectiveYear]);

  const defaultQuarter = useMemo(() => {
    const withData = [...quarterOptions].reverse().find((q) => q.hasData);
    if (withData) return withData.value;
    return `${effectiveYear}-Q${getQuarter(new Date().getMonth() + 1)}`;
  }, [quarterOptions, effectiveYear]);

  const effectiveQuarter =
    selectedQuarter && quarterOptions.some((q) => q.value === selectedQuarter)
      ? selectedQuarter
      : defaultQuarter;

  // Filtrage sur la période choisie
  const periodRecords = useMemo(() => {
    return mergedRecords.filter((r) => {
      if (periodMode === 'year') return r.date.startsWith(effectiveYear);
      if (periodMode === 'month') return r.date.startsWith(effectiveMonth);
      // quarter
      if (!r.date.startsWith(effectiveYear)) return false;
      const qTarget = Number(effectiveQuarter.split('-Q')[1] || 1);
      const m = Number(r.date.slice(5, 7));
      return getQuarter(m) === qTarget;
    });
  }, [mergedRecords, periodMode, effectiveYear, effectiveMonth, effectiveQuarter]);

  // Agrégation par véhicule
  const vehicleRows = useMemo(() => {
    const byPlate = new Map<
      string,
      {
        plateKey: string;
        plate: string;
        vehicleLabel: string;
        driverName: string;
        commuteKm: number;
        totalDayKm: number;
        tripsCount: number;
        daysCount: number;
        hasLive: boolean;
        days: CommuteDayRecord[];
      }
    >();

    for (const r of periodRecords) {
      const cur = byPlate.get(r.plateKey) ?? {
        plateKey: r.plateKey,
        plate: r.plate,
        vehicleLabel: r.vehicleLabel,
        driverName: r.driverName,
        commuteKm: 0,
        totalDayKm: 0,
        tripsCount: 0,
        daysCount: 0,
        hasLive: false,
        days: [],
      };
      cur.commuteKm = Math.round((cur.commuteKm + r.commuteKm) * 100) / 100;
      cur.totalDayKm = Math.round((cur.totalDayKm + r.totalDayKm) * 100) / 100;
      cur.tripsCount += r.excludedTripsCount;
      cur.daysCount += 1;
      if (r.source === 'live') cur.hasLive = true;
      if (!cur.driverName && r.driverName) cur.driverName = r.driverName;
      cur.days.push(r);
      byPlate.set(r.plateKey, cur);
    }

    const q = search.trim().toLowerCase();
    return Array.from(byPlate.values())
      .filter((v) => {
        if (!q) return true;
        return (
          v.plate.toLowerCase().includes(q) ||
          v.vehicleLabel.toLowerCase().includes(q) ||
          v.driverName.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.commuteKm - a.commuteKm);
  }, [periodRecords, search]);

  // KPIs globaux sur la période
  const kpis = useMemo(() => {
    const totalCommuteKm = Math.round(periodRecords.reduce((s, r) => s + r.commuteKm, 0) * 10) / 10;
    const totalAllKm = Math.round(periodRecords.reduce((s, r) => s + r.totalDayKm, 0) * 10) / 10;
    const totalTrips = periodRecords.reduce((s, r) => s + r.excludedTripsCount, 0);
    const totalDays = periodRecords.length;
    const vehicleCount = new Set(periodRecords.map((r) => r.plateKey)).size;
    const pctOfTotal = totalAllKm > 0 ? Math.round((totalCommuteKm / totalAllKm) * 1000) / 10 : 0;
    const avgPerVehicle = vehicleCount > 0 ? Math.round((totalCommuteKm / vehicleCount) * 10) / 10 : 0;
    return {
      totalCommuteKm,
      totalAllKm,
      totalTrips,
      totalDays,
      vehicleCount,
      pctOfTotal,
      avgPerVehicle,
    };
  }, [periodRecords]);

  // Données graphique : Top véhicules
  const vehicleChartData = useMemo(
    () =>
      vehicleRows.slice(0, 12).map((v) => ({
        name: v.plate,
        label: v.vehicleLabel,
        km: Math.round(v.commuteKm * 10) / 10,
        trajets: v.tripsCount,
      })),
    [vehicleRows],
  );

  // Données graphique : Évolution mensuelle (ou trimestrielle) sur l'année sélectionnée
  const evolutionChartData = useMemo(() => {
    if (periodMode === 'quarter') {
      return [1, 2, 3, 4].map((q) => {
        const km = mergedRecords
          .filter((r) => r.date.startsWith(effectiveYear) && getQuarter(Number(r.date.slice(5, 7))) === q)
          .reduce((s, r) => s + r.commuteKm, 0);
        return { name: `T${q} ${effectiveYear}`, km: Math.round(km * 10) / 10 };
      });
    }
    return MONTH_NAMES_FR.map((mLabel, idx) => {
      const ym = `${effectiveYear}-${String(idx + 1).padStart(2, '0')}`;
      const km = mergedRecords
        .filter((r) => r.date.startsWith(ym))
        .reduce((s, r) => s + r.commuteKm, 0);
      return { name: mLabel.slice(0, 4), km: Math.round(km * 10) / 10 };
    });
  }, [mergedRecords, effectiveYear, periodMode]);

  const periodTitle = useMemo(() => {
    if (periodMode === 'year') return `Année ${effectiveYear}`;
    if (periodMode === 'quarter') {
      const q = effectiveQuarter.split('-Q')[1] || '1';
      return `Trimestre T${q} — ${effectiveYear}`;
    }
    const mIdx = Number(effectiveMonth.slice(5, 7)) - 1;
    return `${MONTH_NAMES_FR[mIdx] || effectiveMonth} ${effectiveYear}`;
  }, [periodMode, effectiveYear, effectiveMonth, effectiveQuarter]);

  const handleExportExcel = async () => {
    if (vehicleRows.length === 0) {
      toast.info('Aucune donnée Domicile ↔ Travail à exporter sur cette période.');
      return;
    }
    const sheetSummary = createSpreadsheet({
      sheetName: `Km Domicile-Travail`,
      columns: [
        'Période',
        'Immatriculation',
        'Véhicule',
        'Conducteur',
        'Km Domicile ↔ Travail',
        'Km Totaux (jours pointés)',
        '% Domicile-Travail',
        'Nb trajets',
        'Nb jours',
      ],
      rows: vehicleRows.map((v) => [
        periodTitle,
        v.plate,
        v.vehicleLabel,
        v.driverName || '—',
        v.commuteKm,
        v.totalDayKm,
        v.totalDayKm > 0 ? `${Math.round((v.commuteKm / v.totalDayKm) * 1000) / 10} %` : '—',
        v.tripsCount,
        v.daysCount,
      ]),
      columnWidths: { 0: 20, 1: 15, 2: 28, 3: 22, 4: 22, 5: 22, 6: 18, 7: 12, 8: 12 },
      theme: FACILITY_XLSX_THEME,
    });

    const ok = await exportToXlsx(
      sheetSummary,
      `Km_Domicile_Travail_${periodMode}_${effectiveYear}.xlsx`,
    );
    if (ok) toast.success(`Export Excel « Km Domicile ↔ Travail » généré (${vehicleRows.length} véhicules) !`);
  };

  return (
    <div className="mt-5 space-y-5">
      {/* Bandeau explicatif + Sélecteurs de période */}
      <div className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-[#39A9DC]/30 bg-[#EBF6FC]/60 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1B4565] text-white">
            <Home className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-extrabold text-[#1B4565]">
                Km Domicile ↔ Travail payés par l’entreprise
              </h3>
              <span className="rounded-full bg-[#39A9DC]/15 px-2.5 py-0.5 text-[10px] font-extrabold text-[#1B4565]">
                {periodTitle}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Comptabilise automatiquement chaque trajet coché « Domicile ↔ Travail » par véhicule (en direct + historique archivé sur Monday).
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Boutons Mensuel / Trimestriel / Annuel */}
          <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
            {(
              [
                { id: 'month', label: 'Mensuel' },
                { id: 'quarter', label: 'Trimestriel' },
                { id: 'year', label: 'Annuel' },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setPeriodMode(m.id)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-bold transition cursor-pointer',
                  periodMode === m.id
                    ? 'bg-[#1B4565] text-white shadow-xs'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Sélecteur Année */}
          <SearchableSelect
            size="sm"
            clearable={false}
            searchable={false}
            showDot={false}
            icon={<Calendar className="h-3.5 w-3.5 text-primary" />}
            className="w-[105px]"
            value={effectiveYear}
            onChange={(val) => setSelectedYear(val)}
            options={availableYears.map((y) => ({ value: y, label: y }))}
          />

          {/* Sélecteur Mois ou Trimestre */}
          {periodMode === 'month' && (
            <SearchableSelect
              size="sm"
              clearable={false}
              searchable={false}
              showDot={false}
              className="w-[220px]"
              value={effectiveMonth}
              onChange={(val) => setSelectedMonth(val)}
              options={monthOptions}
            />
          )}

          {periodMode === 'quarter' && (
            <SearchableSelect
              size="sm"
              clearable={false}
              searchable={false}
              showDot={false}
              className="w-[240px]"
              value={effectiveQuarter}
              onChange={(val) => setSelectedQuarter(val)}
              options={quarterOptions.map((q) => ({ value: q.value, label: q.label }))}
            />
          )}

          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-bold text-foreground transition hover:bg-muted cursor-pointer disabled:opacity-60"
            title="Actualiser depuis Monday"
          >
            <RefreshCw className={cn('h-3.5 w-3.5 text-primary', loading && 'animate-spin')} />
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0E7042] px-3 text-xs font-bold text-white transition hover:brightness-95 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Excel</span>
          </button>
        </div>
      </div>

      {/* 4 KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            <span>Total Km Domicile ↔ Travail</span>
            <Home className="h-4 w-4 text-[#D66927]" />
          </div>
          <div className="mt-1.5 text-2xl font-black text-[#1B4565]">{kmFmt(kpis.totalCommuteKm)}</div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            Sur {kpis.totalAllKm > 0 ? kmFmt(kpis.totalAllKm) : '0 km'} totaux pointés
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            <span>Trajets cochés</span>
            <Route className="h-4 w-4 text-[#39A9DC]" />
          </div>
          <div className="mt-1.5 text-2xl font-black text-[#1B4565]">
            {kpis.totalTrips.toLocaleString('fr-FR')}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            Répartis sur {kpis.totalDays} journée{kpis.totalDays > 1 ? 's' : ''}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            <span>Véhicules concernés</span>
            <Car className="h-4 w-4 text-[#3989B7]" />
          </div>
          <div className="mt-1.5 text-2xl font-black text-[#1B4565]">{kpis.vehicleCount}</div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            Moyenne : {kmFmt(kpis.avgPerVehicle)} / véhicule
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            <span>Part Domicile ↔ Travail</span>
            <TrendingUp className="h-4 w-4 text-[#F7AC37]" />
          </div>
          <div className="mt-1.5 text-2xl font-black text-[#D66927]">{kpis.pctOfTotal} %</div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            Des km parcourus sur les journées analysées
          </div>
        </div>
      </div>

      {/* État chargement ou vide */}
      {loading && mergedRecords.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-border bg-card py-14 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-xs font-semibold">Chargement des trajets Domicile ↔ Travail depuis Monday…</span>
        </div>
      ) : periodRecords.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-muted/20 px-6 py-12 text-center">
          <Home className="h-9 w-9 text-muted-foreground/50" />
          <div className="max-w-md space-y-1">
            <p className="text-sm font-bold text-foreground">
              Aucun trajet Domicile ↔ Travail comptabilisé sur {periodTitle}
            </p>
            <p className="text-xs text-muted-foreground">
              Dans l’onglet <strong>Explorateur Excel</strong>, cochez la case <strong>« Exclure (Domicile ↔ Travail) »</strong> (ou « Exclure 1er &amp; dernier trajet ») sur les trajets concernés : les kilomètres s’additionneront immédiatement ici par véhicule !
            </p>
          </div>
          {onGoToExplorer && (
            <button
              type="button"
              onClick={onGoToExplorer}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground transition hover:brightness-95 cursor-pointer"
            >
              <span>Ouvrir l’Explorateur Excel</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Graphique */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-extrabold text-[#1B4565]">
                {chartView === 'vehicles'
                  ? `Top véhicules — Km Domicile ↔ Travail (${periodTitle})`
                  : `Évolution ${periodMode === 'quarter' ? 'trimestrielle' : 'mensuelle'} — ${effectiveYear}`}
              </div>
              <div className="inline-flex rounded-lg border border-border bg-muted/50 p-0.5">
                <button
                  type="button"
                  onClick={() => setChartView('vehicles')}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-[11px] font-bold transition cursor-pointer',
                    chartView === 'vehicles' ? 'bg-card text-foreground shadow-2xs' : 'text-muted-foreground',
                  )}
                >
                  Par véhicule
                </button>
                <button
                  type="button"
                  onClick={() => setChartView('evolution')}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-[11px] font-bold transition cursor-pointer',
                    chartView === 'evolution' ? 'bg-card text-foreground shadow-2xs' : 'text-muted-foreground',
                  )}
                >
                  Évolution {effectiveYear}
                </button>
              </div>
            </div>

            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartView === 'vehicles' ? vehicleChartData : evolutionChartData}
                  margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#475569' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} unit=" km" width={58} />
                  <Tooltip
                    formatter={(value: number) => [kmFmt(Number(value || 0)), 'Km Domicile ↔ Travail']}
                    contentStyle={{
                      borderRadius: '10px',
                      border: '1px solid #CBD5E1',
                      fontSize: '12px',
                    }}
                  />
                  <Bar
                    dataKey="km"
                    fill={chartView === 'vehicles' ? '#D66927' : '#39A9DC'}
                    radius={[6, 6, 0, 0]}
                    maxBarSize={44}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Tableau détaillé par véhicule */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/30 px-4 py-3">
              <div>
                <h4 className="text-xs font-extrabold uppercase tracking-wide text-[#1B4565]">
                  Détail par véhicule ({vehicleRows.length})
                </h4>
                <p className="text-[11px] text-muted-foreground">
                  Cliquez sur un véhicule pour afficher ses journées et trajets Domicile ↔ Travail
                </p>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Plaque, véhicule, conducteur…"
                  className="h-8 w-full rounded-lg border border-border bg-background pl-8 pr-3 text-xs outline-none focus:border-primary"
                />
              </div>
            </div>

            <div className="divide-y divide-border">
              {vehicleRows.map((v) => {
                const isExpanded = expandedPlateKey === v.plateKey;
                const pct = v.totalDayKm > 0 ? Math.round((v.commuteKm / v.totalDayKm) * 100) : 0;
                return (
                  <div key={v.plateKey}>
                    <button
                      type="button"
                      onClick={() => setExpandedPlateKey(isExpanded ? null : v.plateKey)}
                      className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-muted/35 cursor-pointer"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="rounded-md bg-[#1B4565] px-2 py-1 font-mono text-[11px] font-extrabold text-white">
                          {v.plate}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-xs font-bold text-foreground">{v.vehicleLabel}</span>
                            {v.hasLive && (
                              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                                En direct
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {v.driverName || 'Conducteur non renseigné'} • {v.daysCount} jour{v.daysCount > 1 ? 's' : ''} •{' '}
                            {v.tripsCount} trajet{v.tripsCount > 1 ? 's' : ''}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-sm font-black text-[#D66927]">{kmFmt(v.commuteKm)}</div>
                          <div className="text-[10.5px] text-muted-foreground">
                            {pct} % des {kmFmt(v.totalDayKm)}
                          </div>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-border/60 bg-muted/20 px-4 py-3 space-y-2.5">
                        {v.days
                          .slice()
                          .sort((a, b) => b.date.localeCompare(a.date))
                          .map((d) => (
                            <div
                              key={d.key}
                              className="rounded-lg border border-border bg-card p-3 space-y-2"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-3.5 w-3.5 text-primary" />
                                  <span className="text-xs font-extrabold text-[#1B4565]">{d.date}</span>
                                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                                    {d.excludedTripsCount} trajet{d.excludedTripsCount > 1 ? 's' : ''}
                                  </span>
                                </div>
                                <span className="text-xs font-black text-[#D66927]">{kmFmt(d.commuteKm)}</span>
                              </div>

                              {d.excludedTrips.length > 0 && (
                                <div className="space-y-1.5 border-t border-border/50 pt-2">
                                  {d.excludedTrips.map((t, idx) => (
                                    <div
                                      key={idx}
                                      className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground"
                                    >
                                      <div className="flex min-w-0 flex-1 items-center gap-2">
                                        <span className="font-mono font-bold text-foreground whitespace-nowrap">
                                          {t.startTime} → {t.endTime}
                                        </span>
                                        <span className="truncate">
                                          {t.startAddress} → {t.endAddress}
                                        </span>
                                      </div>
                                      <span className="font-bold text-foreground whitespace-nowrap">
                                        {kmFmt(t.km)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
