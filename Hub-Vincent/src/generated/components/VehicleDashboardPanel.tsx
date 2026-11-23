import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  BarChart3,
  Calendar,
  Car,
  Clock,
  Eye,
  FileText,
  Fuel,
  Gauge,
  Loader2,
  Maximize2,
  Minimize2,
  PlugZap,
  ShoppingCart,
  Wrench,
  Zap,
} from 'lucide-react';
import {
  getFleetFinancialAnalytics,
  getFleetOverviewData,
  getStoredFinancial,
  getStoredOverview,
  type FleetFinancialData,
  type FleetOverviewData,
  type VehicleCategory,
} from '@generated/server/vehicleDashboard';
import { cn } from '@lib/utils';

export type DashboardChartId =
  | 'brands'
  | 'years'
  | 'energy'
  | 'cost2026'
  | 'costSince2025'
  | 'interventions'
  | 'lldKm'
  | 'utilisation'
  | 'controls'
  | 'conso';

const eur = (n: number) =>
  Math.round(n).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const kmFmt = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} km`;

const BRAND_COLORS: Record<string, string> = {
  TOYOTA: '#0073A8',
  OPEL: '#F7AC37',
  'CITROËN': '#C2A83E',
  FIAT: '#DC3545',
  MG: '#A8294A',
  HYUNDAI: '#EC1C8C',
  AIXAM: '#9C5CE0',
  FUSO: '#0E7042',
  ALFA: '#39A9DC',
  'JOHN DEERE': '#334155',
};

const CATEGORY_COLORS: Record<VehicleCategory, string> = {
  camion: '#EC4899',
  thermique: '#F7AC37',
  electrique: '#00C875',
};

const CATEGORY_LABELS: Record<VehicleCategory, string> = {
  camion: 'Camions poubelles',
  thermique: 'Thermiques',
  electrique: 'Électriques',
};

const TABS: { id: DashboardChartId; label: string; shortLabel: string; icon: typeof Car; needsFin?: boolean }[] = [
  { id: 'brands', label: 'Véhicules par marque', shortLabel: 'Marques', icon: Car },
  { id: 'years', label: 'Date d’acquisition', shortLabel: 'Acquisitions', icon: Calendar },
  { id: 'energy', label: 'Coût énergie', shortLabel: 'Coût énergie', icon: Zap, needsFin: true },
  { id: 'cost2026', label: 'Coût par véhicule (2026)', shortLabel: 'Coût 2026', icon: BarChart3, needsFin: true },
  { id: 'costSince2025', label: 'Coût depuis 01/2025', shortLabel: 'Depuis 2025', icon: BarChart3, needsFin: true },
  { id: 'interventions', label: 'Interventions', shortLabel: 'Interventions', icon: Wrench, needsFin: true },
  { id: 'lldKm', label: 'Suivi km prévus LLD', shortLabel: 'Km LLD', icon: Gauge, needsFin: true },
  { id: 'utilisation', label: 'Utilisation du véhicule', shortLabel: 'Utilisation', icon: Clock },
  { id: 'controls', label: 'Contrôles visuels', shortLabel: 'Contrôles', icon: Eye },
  { id: 'conso', label: 'Conso Élec / Total (6m)', shortLabel: 'Élec / Total', icon: PlugZap, needsFin: true },
];

type Props = {
  activeTab: DashboardChartId;
  onTabChange: (tab: DashboardChartId) => void;
  expanded: boolean;
  onToggleExpand: () => void;
  overview: FleetOverviewData | null;
  overviewLoading: boolean;
};

export default function VehicleDashboardPanel({
  activeTab,
  onTabChange,
  expanded,
  onToggleExpand,
  overview: externalOverview,
  overviewLoading,
}: Props) {
  const [localOverview, setLocalOverview] = useState<FleetOverviewData | null>(() => externalOverview ?? getStoredOverview());
  const [fin, setFin] = useState<FleetFinancialData | null>(() => getStoredFinancial());
  const [finLoading, setFinLoading] = useState<boolean>(() => !getStoredFinancial());
  const [finError, setFinError] = useState(false);

  // Sous-filtres contextuels par graphique
  const [scopeMode, setScopeMode] = useState<'top' | 'all'>('top');
  const [intervYear, setIntervYear] = useState<'2025' | '2026'>('2025');
  const [includeWellborne, setIncludeWellborne] = useState(true);
  const [consoEnergy, setConsoEnergy] = useState<'elec' | 'total'>('elec');
  const [consoScope, setConsoScope] = useState<'all' | 'top5' | 'top10'>('all');

  useEffect(() => {
    if (externalOverview) {
      setLocalOverview(externalOverview);
    } else if (!localOverview) {
      getFleetOverviewData({ data: {} })
        .then((r) => setLocalOverview(r))
        .catch(console.error);
    }
  }, [externalOverview, localOverview]);

  // Charge les données financières 1 seule fois en tâche de fond (cachées 30 min)
  useEffect(() => {
    let active = true;
    const cached = getStoredFinancial();
    if (cached) {
      setFin(cached);
      setFinLoading(false);
    } else {
      setFinLoading(true);
    }
    getFleetFinancialAnalytics({ data: {} })
      .then((res) => {
        if (!active) return;
        setFin(res);
        setFinLoading(false);
        setFinError(false);
      })
      .catch((err) => {
        console.error(err);
        if (!active) return;
        if (!cached) setFinError(true);
        setFinLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const overview = externalOverview ?? localOverview;
  const activeTabMeta = TABS.find((t) => t.id === activeTab) ?? TABS[0];

  const chartBoxHeight = expanded ? 380 : 275;

  // Données préparées pour les graphiques à bascule Top 8 / Tous
  const cost2026Data = useMemo(() => {
    if (!fin) return [];
    if (scopeMode === 'top') {
      // Top 8 trié croissant gauche -> droite comme sur Monday
      return fin.cost2026.slice(0, 8).reverse();
    }
    return fin.cost2026;
  }, [fin, scopeMode]);

  const costSince2025Data = useMemo(() => {
    if (!fin) return [];
    if (scopeMode === 'top') {
      return fin.costSince2025.slice(0, 8).reverse();
    }
    return fin.costSince2025;
  }, [fin, scopeMode]);

  const interventionsData = useMemo(() => {
    if (!fin) return [];
    const list = intervYear === '2025' ? fin.interventions2025 : fin.interventions2026;
    if (scopeMode === 'top') {
      return list.slice(0, 8).reverse();
    }
    return list;
  }, [fin, intervYear, scopeMode]);

  const consoData = useMemo(() => {
    if (!fin) return [];
    const list = consoEnergy === 'elec' ? fin.conso6mElec : fin.conso6mTotal;
    if (consoScope === 'top5') return list.slice(0, 5).reverse();
    if (consoScope === 'top10') return list.slice(0, 10).reverse();
    return list;
  }, [fin, consoEnergy, consoScope]);

  const lldOverCount = useMemo(() => (fin ? fin.lldKm.filter((r) => r.ecart > 0).length : 0), [fin]);

  const renderChartContent = () => {
    if (activeTabMeta.needsFin) {
      if (finLoading && !fin) {
        return (
          <div className="flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground" style={{ height: chartBoxHeight }}>
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span>Chargement des données analytiques véhicules…</span>
          </div>
        );
      }
      if (finError && !fin) {
        return (
          <div className="flex items-center justify-center text-sm text-destructive" style={{ height: chartBoxHeight }}>
            Impossible de charger les données financières de la flotte.
          </div>
        );
      }
    } else if (overviewLoading && !overview) {
      return <div className="animate-pulse rounded-[var(--radius-md)] bg-muted" style={{ height: chartBoxHeight }} />;
    }

    switch (activeTab) {
      case 'brands': {
        if (!overview) return null;
        return (
          <div style={{ height: chartBoxHeight }} className="w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={overview.brands} margin={{ top: 14, right: 8, left: -12, bottom: 4 }}>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                <XAxis
                  dataKey="brand"
                  tickLine={false}
                  axisLine={false}
                  fontSize={10}
                  interval={0}
                  angle={overview.brands.length > 7 && !expanded ? -25 : 0}
                  textAnchor={overview.brands.length > 7 && !expanded ? 'end' : 'middle'}
                  height={overview.brands.length > 7 && !expanded ? 42 : 24}
                  stroke="hsl(var(--muted-foreground))"
                />
                <YAxis tickLine={false} axisLine={false} fontSize={11} allowDecimals={false} stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  cursor={{ fill: 'hsl(var(--muted))' }}
                  formatter={(v: any) => [`${v} véhicule${Number(v) > 1 ? 's' : ''}`, 'Effectif']}
                  contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 10, fontSize: 12 }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={42}>
                  {overview.brands.map((b) => (
                    <Cell key={b.brand} fill={BRAND_COLORS[b.brand.toUpperCase()] || '#39A9DC'} />
                  ))}
                  <LabelList dataKey="count" position="top" fontSize={10} fontWeight={700} fill="hsl(var(--foreground))" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        );
      }

      case 'years': {
        if (!overview) return null;
        return (
          <div style={{ height: chartBoxHeight }} className="w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={overview.years} margin={{ top: 14, right: 8, left: -12, bottom: 4 }}>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                <XAxis dataKey="year" tickLine={false} axisLine={false} fontSize={11} stroke="hsl(var(--muted-foreground))" />
                <YAxis tickLine={false} axisLine={false} fontSize={11} allowDecimals={false} stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  cursor={{ fill: 'hsl(var(--muted))' }}
                  formatter={(v: any) => [`${v} véhicule${Number(v) > 1 ? 's' : ''}`, 'Acquisitions']}
                  contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 10, fontSize: 12 }}
                />
                <Bar dataKey="count" fill="#39A9DC" radius={[6, 6, 0, 0]} maxBarSize={44}>
                  <LabelList dataKey="count" position="top" fontSize={10} fontWeight={700} fill="hsl(var(--foreground))" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        );
      }

      case 'energy': {
        if (!fin) return null;
        const totCarb = fin.energyMonthly.reduce((s, m) => s + m.carburant, 0);
        const totElec = fin.energyMonthly.reduce((s, m) => s + m.chargemap + (includeWellborne ? m.wellborne : 0), 0);
        const rows = fin.energyMonthly.map((m) => ({
          label: m.label,
          chargemap: m.chargemap,
          wellborne: includeWellborne ? m.wellborne : 0,
          carburant: m.carburant,
        }));
        return (
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="inline-flex items-center gap-1 rounded-full bg-[#FFF4EB] px-2.5 py-0.5 font-bold text-[#D66927]">
                <Fuel className="h-3 w-3" /> Carburant : {eur(totCarb)}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#EBF6FC] px-2.5 py-0.5 font-bold text-[#3989B7]">
                <Zap className="h-3 w-3" /> Électrique : {eur(totElec)}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 font-bold text-foreground">
                Total {fin.year} : {eur(totCarb + totElec)}
              </span>
            </div>
            <div style={{ height: chartBoxHeight - 30 }} className="w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} stroke="hsl(var(--muted-foreground))" />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    fontSize={11}
                    width={52}
                    stroke="hsl(var(--muted-foreground))"
                    tickFormatter={(v: number) => `${Math.round(v).toLocaleString('fr-FR')} €`}
                  />
                  <Tooltip
                    cursor={{ fill: 'hsl(var(--muted))' }}
                    formatter={(v: any, name: any) => [
                      eur(Number(v)),
                      name === 'carburant' ? 'Carburant' : name === 'wellborne' ? 'Wellborne' : 'Chargemap',
                    ]}
                    contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 10, fontSize: 12 }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 11 }}
                    formatter={(v) => (v === 'carburant' ? 'Carburant' : v === 'wellborne' ? 'Wellborne' : 'Chargemap')}
                  />
                  <Bar dataKey="chargemap" stackId="e" fill="#C2A83E" />
                  {includeWellborne && <Bar dataKey="wellborne" stackId="e" fill="#39A9DC" />}
                  <Bar dataKey="carburant" stackId="e" fill="#B52B53" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      }

      case 'cost2026': {
        if (!fin) return null;
        if (scopeMode === 'all') {
          const h = Math.max(280, cost2026Data.length * 30 + 30);
          return (
            <div className="max-h-[380px] overflow-y-auto pr-1">
              <div style={{ height: h }} className="w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cost2026Data} layout="vertical" margin={{ top: 4, right: 20, left: 6, bottom: 4 }}>
                    <CartesianGrid horizontal={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                    <XAxis
                      type="number"
                      tickLine={false}
                      axisLine={false}
                      fontSize={10}
                      stroke="hsl(var(--muted-foreground))"
                      tickFormatter={(v: number) => `${Math.round(v).toLocaleString('fr-FR')} €`}
                    />
                    <YAxis type="category" dataKey="plate" width={88} tickLine={false} axisLine={false} fontSize={10} stroke="hsl(var(--foreground))" />
                    <Tooltip
                      cursor={{ fill: 'hsl(var(--muted))' }}
                      formatter={(v: any, name: any) => [
                        eur(Number(v)),
                        name === 'fixe' ? 'Fixe' : name === 'interventions' ? 'Interventions' : name === 'chargemap' ? 'Chargemap' : 'Carburant',
                      ]}
                      contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 10, fontSize: 12 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="fixe" name="Fixe" stackId="c26" fill="#EC4899" maxBarSize={18} />
                    <Bar dataKey="interventions" name="Interventions" stackId="c26" fill="#39A9DC" maxBarSize={18} />
                    <Bar dataKey="chargemap" name="Chargemap" stackId="c26" fill="#C2A83E" maxBarSize={18} />
                    <Bar dataKey="carburant" name="Carburant" stackId="c26" fill="#B52B53" radius={[0, 4, 4, 0]} maxBarSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          );
        }
        return (
          <div style={{ height: chartBoxHeight }} className="w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cost2026Data} margin={{ top: 10, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                <XAxis
                  dataKey="plate"
                  tickLine={false}
                  axisLine={false}
                  fontSize={10}
                  interval={0}
                  angle={!expanded ? -22 : 0}
                  textAnchor={!expanded ? 'end' : 'middle'}
                  height={!expanded ? 40 : 24}
                  stroke="hsl(var(--muted-foreground))"
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  width={54}
                  stroke="hsl(var(--muted-foreground))"
                  tickFormatter={(v: number) => `${Math.round(v).toLocaleString('fr-FR')} €`}
                />
                <Tooltip
                  cursor={{ fill: 'hsl(var(--muted))' }}
                  formatter={(v: any, name: any) => [eur(Number(v)), String(name)]}
                  labelFormatter={(lbl: any) => {
                    const row = cost2026Data.find((r) => r.plate === String(lbl));
                    return row ? `${row.plate}${row.model ? ` — ${row.model}` : ''} (Total : ${eur(row.total)})` : String(lbl);
                  }}
                  contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 10, fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="fixe" name="Fixe" stackId="c26" fill="#EC4899" maxBarSize={38} />
                <Bar dataKey="interventions" name="Interventions" stackId="c26" fill="#39A9DC" maxBarSize={38} />
                <Bar dataKey="chargemap" name="Chargemap" stackId="c26" fill="#C2A83E" maxBarSize={38} />
                <Bar dataKey="carburant" name="Carburant" stackId="c26" fill="#B52B53" radius={[4, 4, 0, 0]} maxBarSize={38} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        );
      }

      case 'costSince2025': {
        if (!fin) return null;
        const legendBar = (
          <div className="mb-2 flex flex-wrap items-center gap-3 text-[11px] font-semibold">
            {(['camion', 'thermique', 'electrique'] as const).map((cat) => (
              <span key={cat} className="inline-flex items-center gap-1.5 text-muted-foreground">
                <span className="h-2.5 w-2.5 rounded-xs" style={{ backgroundColor: CATEGORY_COLORS[cat] }} />
                {CATEGORY_LABELS[cat]}
              </span>
            ))}
          </div>
        );
        if (scopeMode === 'all') {
          const h = Math.max(280, costSince2025Data.length * 28 + 24);
          return (
            <div>
              {legendBar}
              <div className="max-h-[350px] overflow-y-auto pr-1">
                <div style={{ height: h }} className="w-full min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={costSince2025Data} layout="vertical" margin={{ top: 4, right: 20, left: 6, bottom: 4 }}>
                      <CartesianGrid horizontal={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                      <XAxis
                        type="number"
                        tickLine={false}
                        axisLine={false}
                        fontSize={10}
                        stroke="hsl(var(--muted-foreground))"
                        tickFormatter={(v: number) => `${Math.round(v).toLocaleString('fr-FR')} €`}
                      />
                      <YAxis type="category" dataKey="plate" width={88} tickLine={false} axisLine={false} fontSize={10} stroke="hsl(var(--foreground))" />
                      <Tooltip
                        cursor={{ fill: 'hsl(var(--muted))' }}
                        formatter={(v: any) => [eur(Number(v)), 'Coût cumulé depuis 01/2025']}
                        labelFormatter={(lbl: any) => {
                          const row = costSince2025Data.find((r) => r.plate === String(lbl));
                          return row ? `${row.plate}${row.model ? ` — ${row.model}` : ''} (${CATEGORY_LABELS[row.category]})` : String(lbl);
                        }}
                        contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 10, fontSize: 12 }}
                      />
                      <Bar dataKey="total" radius={[0, 5, 5, 0]} maxBarSize={18}>
                        {costSince2025Data.map((r) => (
                          <Cell key={r.plate} fill={CATEGORY_COLORS[r.category]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          );
        }
        return (
          <div>
            {legendBar}
            <div style={{ height: chartBoxHeight - 26 }} className="w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={costSince2025Data} margin={{ top: 10, right: 8, left: 0, bottom: 4 }}>
                  <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="plate"
                    tickLine={false}
                    axisLine={false}
                    fontSize={10}
                    interval={0}
                    angle={!expanded ? -22 : 0}
                    textAnchor={!expanded ? 'end' : 'middle'}
                    height={!expanded ? 40 : 24}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    fontSize={11}
                    width={56}
                    stroke="hsl(var(--muted-foreground))"
                    tickFormatter={(v: number) => `${Math.round(v).toLocaleString('fr-FR')} €`}
                  />
                  <Tooltip
                    cursor={{ fill: 'hsl(var(--muted))' }}
                    formatter={(v: any) => [eur(Number(v)), 'Coût total HT']}
                    labelFormatter={(lbl: any) => {
                      const row = costSince2025Data.find((r) => r.plate === String(lbl));
                      return row ? `${row.plate}${row.model ? ` — ${row.model}` : ''} (${CATEGORY_LABELS[row.category]})` : String(lbl);
                    }}
                    contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 10, fontSize: 12 }}
                  />
                  <Bar dataKey="total" radius={[6, 6, 0, 0]} maxBarSize={40}>
                    {costSince2025Data.map((r) => (
                      <Cell key={r.plate} fill={CATEGORY_COLORS[r.category]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      }

      case 'interventions': {
        if (!fin) return null;
        if (interventionsData.length === 0) {
          return (
            <div className="flex items-center justify-center text-sm text-muted-foreground" style={{ height: chartBoxHeight }}>
              Aucune intervention enregistrée sur {intervYear}.
            </div>
          );
        }
        if (scopeMode === 'all') {
          const h = Math.max(260, interventionsData.length * 28 + 24);
          return (
            <div className="max-h-[380px] overflow-y-auto pr-1">
              <div style={{ height: h }} className="w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={interventionsData} layout="vertical" margin={{ top: 4, right: 20, left: 6, bottom: 4 }}>
                    <CartesianGrid horizontal={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                    <XAxis
                      type="number"
                      tickLine={false}
                      axisLine={false}
                      fontSize={10}
                      stroke="hsl(var(--muted-foreground))"
                      tickFormatter={(v: number) => `${Math.round(v).toLocaleString('fr-FR')} €`}
                    />
                    <YAxis type="category" dataKey="plate" width={88} tickLine={false} axisLine={false} fontSize={10} stroke="hsl(var(--foreground))" />
                    <Tooltip
                      cursor={{ fill: 'hsl(var(--muted))' }}
                      formatter={(v: any) => [eur(Number(v)), `Interventions ${intervYear}`]}
                      labelFormatter={(lbl: any) => {
                        const row = interventionsData.find((r) => r.plate === String(lbl));
                        return row ? `${row.plate}${row.model ? ` — ${row.model}` : ''}` : String(lbl);
                      }}
                      contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 10, fontSize: 12 }}
                    />
                    <Bar dataKey="total" fill="#39A9DC" radius={[0, 5, 5, 0]} maxBarSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          );
        }
        return (
          <div style={{ height: chartBoxHeight }} className="w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={interventionsData} margin={{ top: 10, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                <XAxis
                  dataKey="plate"
                  tickLine={false}
                  axisLine={false}
                  fontSize={10}
                  interval={0}
                  angle={!expanded ? -22 : 0}
                  textAnchor={!expanded ? 'end' : 'middle'}
                  height={!expanded ? 40 : 24}
                  stroke="hsl(var(--muted-foreground))"
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  width={54}
                  stroke="hsl(var(--muted-foreground))"
                  tickFormatter={(v: number) => `${Math.round(v).toLocaleString('fr-FR')} €`}
                />
                <Tooltip
                  cursor={{ fill: 'hsl(var(--muted))' }}
                  formatter={(v: any) => [eur(Number(v)), `Interventions ${intervYear}`]}
                  labelFormatter={(lbl: any) => {
                    const row = interventionsData.find((r) => r.plate === String(lbl));
                    return row ? `${row.plate}${row.model ? ` — ${row.model}` : ''}` : String(lbl);
                  }}
                  contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 10, fontSize: 12 }}
                />
                <Bar dataKey="total" name={`Interventions ${intervYear}`} fill="#39A9DC" radius={[6, 6, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        );
      }

      case 'lldKm': {
        if (!fin) return null;
        if (fin.lldKm.length === 0) {
          return (
            <div className="flex items-center justify-center text-sm text-muted-foreground" style={{ height: chartBoxHeight }}>
              Aucune donnée kilométrique LLD disponible.
            </div>
          );
        }
        return (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="inline-flex items-center gap-1 rounded-full bg-[#EBF6FC] px-2.5 py-0.5 font-bold text-[#3989B7]">
                {fin.lldKm.length} contrats LLD suivis
              </span>
              {lldOverCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 font-bold text-amber-700">
                  <AlertTriangle className="h-3 w-3" /> {lldOverCount} au-dessus du forfait prévu
                </span>
              )}
            </div>
            <div style={{ height: chartBoxHeight - 28 }} className="w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={fin.lldKm} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                  <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="plate"
                    tickLine={false}
                    axisLine={false}
                    fontSize={10}
                    interval={0}
                    angle={!expanded ? -25 : 0}
                    textAnchor={!expanded ? 'end' : 'middle'}
                    height={!expanded ? 42 : 24}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    fontSize={10}
                    width={50}
                    stroke="hsl(var(--muted-foreground))"
                    tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
                  />
                  <Tooltip
                    cursor={{ fill: 'hsl(var(--muted))' }}
                    formatter={(v: any, name: any) => [kmFmt(Number(v)), name === 'kmPrevu' ? 'Km prévu' : 'Km relevé']}
                    labelFormatter={(lbl: any) => {
                      const r = fin.lldKm.find((x) => x.plate === String(lbl));
                      if (!r) return String(lbl);
                      const diffLabel = `${r.ecart > 0 ? '+' : ''}${r.ecart.toLocaleString('fr-FR')} km`;
                      return `${r.plate}${r.model ? ` — ${r.model}` : ''} (${diffLabel})`;
                    }}
                    contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 10, fontSize: 12 }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 11 }}
                    formatter={(v) => (v === 'kmPrevu' ? 'Km prévu' : 'Km relevé')}
                  />
                  <Bar dataKey="kmPrevu" name="kmPrevu" fill="#39A9DC" radius={[4, 4, 0, 0]} maxBarSize={24} />
                  <Bar dataKey="kmReleve" name="kmReleve" fill="#F7AC37" radius={[4, 4, 0, 0]} maxBarSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      }

      case 'utilisation': {
        if (!overview) return null;
        const list = overview.utilisation;
        const h = Math.max(260, list.length * 24 + 24);
        return (
          <div className="space-y-1.5">
            <p className="text-[11px] text-muted-foreground">
              Plage horaire quotidienne de prestation (heure de début → heure de fin · {list.length} véhicules renseignés)
            </p>
            <div className={cn('overflow-y-auto pr-1', expanded ? 'max-h-[420px]' : 'max-h-[250px]')}>
              <div style={{ height: h }} className="w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={list} layout="vertical" margin={{ top: 4, right: 16, left: 6, bottom: 4 }}>
                    <CartesianGrid horizontal={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                    <XAxis
                      type="number"
                      domain={[0, 24]}
                      ticks={[0, 4, 8, 12, 16, 20, 24]}
                      tickFormatter={(v: number) => `${v}h`}
                      tickLine={false}
                      axisLine={false}
                      fontSize={10}
                      stroke="hsl(var(--muted-foreground))"
                    />
                    <YAxis
                      type="category"
                      dataKey="label"
                      width={106}
                      tickLine={false}
                      axisLine={false}
                      fontSize={10}
                      stroke="hsl(var(--foreground))"
                    />
                    <Tooltip
                      cursor={{ fill: 'hsl(var(--muted))' }}
                      formatter={(v: any, name: any, item: any) => {
                        if (name === 'start') return [`${v}h`, 'Début de prestation'];
                        const p = item?.payload;
                        return p ? [`${p.start}h → ${p.end}h (${p.duration}h/j)`, 'Amplitude'] : [`${v}h`, 'Durée'];
                      }}
                      labelFormatter={(lbl: any) => {
                        const row = list.find((u) => u.label === String(lbl));
                        return row ? `${row.label}${row.model ? ` — ${row.model}` : ''}` : String(lbl);
                      }}
                      contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 10, fontSize: 12 }}
                    />
                    <Bar dataKey="start" stackId="u" fill="transparent" isAnimationActive={false} />
                    <Bar dataKey="duration" stackId="u" fill="#F7AC37" radius={[4, 4, 4, 4]} maxBarSize={14} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        );
      }

      case 'controls': {
        if (!overview) return null;
        const c = overview.controls;
        const pctBon = c.bon + c.anomalies > 0 ? Math.round((c.bon / (c.bon + c.anomalies)) * 100) : 0;
        return (
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 font-bold text-emerald-700">
                Conformes : {c.bon} ({pctBon}%)
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 font-bold text-amber-700">
                Anomalies : {c.anomalies}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 font-bold text-foreground">
                Total historique : {c.totalAll}
              </span>
              {c.avgNote !== null && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 font-bold text-primary">
                  Note moy. : {c.avgNote}
                </span>
              )}
            </div>
            <div style={{ height: chartBoxHeight - 30 }} className="w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={c.months12m} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tickLine={false} axisLine={false} fontSize={11} allowDecimals={false} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    cursor={{ fill: 'hsl(var(--muted))' }}
                    formatter={(v: any, name: any) => [
                      `${v} contrôle${Number(v) > 1 ? 's' : ''}`,
                      name === 'bon' ? 'Bon (conforme)' : 'Anomalies détectées',
                    ]}
                    contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 10, fontSize: 12 }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 11 }}
                    formatter={(v) => (v === 'bon' ? 'Bon (conforme)' : 'Anomalies')}
                  />
                  <Bar dataKey="bon" stackId="cv" fill="#00C875" maxBarSize={36} />
                  <Bar dataKey="anomalies" stackId="cv" fill="#D66927" radius={[4, 4, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      }

      case 'conso': {
        if (!fin) return null;
        const fillCol = consoEnergy === 'elec' ? '#39A9DC' : '#D66927';
        if (consoData.length === 0) {
          return (
            <div className="flex items-center justify-center text-sm text-muted-foreground" style={{ height: chartBoxHeight }}>
              Aucune dépense sur les 6 derniers mois.
            </div>
          );
        }
        if (consoScope === 'all') {
          const h = Math.max(260, consoData.length * 28 + 24);
          return (
            <div className={cn('overflow-y-auto pr-1', expanded ? 'max-h-[400px]' : 'max-h-[275px]')}>
              <div style={{ height: h }} className="w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={consoData} layout="vertical" margin={{ top: 4, right: 20, left: 6, bottom: 4 }}>
                    <CartesianGrid horizontal={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                    <XAxis
                      type="number"
                      tickLine={false}
                      axisLine={false}
                      fontSize={10}
                      stroke="hsl(var(--muted-foreground))"
                      tickFormatter={(v: number) => `${Math.round(v).toLocaleString('fr-FR')} €`}
                    />
                    <YAxis type="category" dataKey="plate" width={88} tickLine={false} axisLine={false} fontSize={10} stroke="hsl(var(--foreground))" />
                    <Tooltip
                      cursor={{ fill: 'hsl(var(--muted))' }}
                      formatter={(v: any) => [eur(Number(v)), consoEnergy === 'elec' ? 'Chargemap (6 mois)' : 'Carburant Total (6 mois)']}
                      labelFormatter={(lbl: any) => {
                        const row = consoData.find((r) => r.plate === String(lbl));
                        return row ? `${row.plate}${row.num ? ` (#${row.num})` : ''}${row.model ? ` — ${row.model}` : ''}` : String(lbl);
                      }}
                      contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 10, fontSize: 12 }}
                    />
                    <Bar dataKey="total" fill={fillCol} radius={[0, 5, 5, 0]} maxBarSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          );
        }
        return (
          <div style={{ height: chartBoxHeight }} className="w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={consoData} margin={{ top: 10, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                <XAxis
                  dataKey="plate"
                  tickLine={false}
                  axisLine={false}
                  fontSize={10}
                  interval={0}
                  angle={consoData.length > 5 && !expanded ? -22 : 0}
                  textAnchor={consoData.length > 5 && !expanded ? 'end' : 'middle'}
                  height={consoData.length > 5 && !expanded ? 40 : 24}
                  stroke="hsl(var(--muted-foreground))"
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  width={52}
                  stroke="hsl(var(--muted-foreground))"
                  tickFormatter={(v: number) => `${Math.round(v).toLocaleString('fr-FR')} €`}
                />
                <Tooltip
                  cursor={{ fill: 'hsl(var(--muted))' }}
                  formatter={(v: any) => [eur(Number(v)), consoEnergy === 'elec' ? 'Chargemap (6 mois)' : 'Carburant Total (6 mois)']}
                  labelFormatter={(lbl: any) => {
                    const row = consoData.find((r) => r.plate === String(lbl));
                    return row ? `${row.plate}${row.num ? ` (#${row.num})` : ''}${row.model ? ` — ${row.model}` : ''}` : String(lbl);
                  }}
                  contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 10, fontSize: 12 }}
                />
                <Bar dataKey="total" fill={fillCol} radius={[6, 6, 0, 0]} maxBarSize={42} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        );
      }
    }
  };

  return (
    <div className="flex w-full flex-col justify-between gap-3 rounded-[var(--radius-xl)] border border-border bg-background p-4 sm:p-5">
      {/* 1. Bandeau compact des 4 KPIs du Dashboard Suivi des véhicules */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="flex items-center gap-2 rounded-lg border border-border/80 bg-card px-2.5 py-2 shadow-2xs">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#EBF6FC] text-[#39A9DC]">
            <Zap className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Électriques</p>
            <p className="font-[family-name:var(--font-heading)] text-base font-extrabold text-[#3989B7]">
              {overview ? overview.elec : '…'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-border/80 bg-card px-2.5 py-2 shadow-2xs">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#FFF4EB] text-[#D66927]">
            <Fuel className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Thermiques</p>
            <p className="font-[family-name:var(--font-heading)] text-base font-extrabold text-[#D66927]">
              {overview ? overview.therm : '…'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-border/80 bg-card px-2.5 py-2 shadow-2xs">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#E6F9F1] text-[#00C875]">
            <ShoppingCart className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Achat</p>
            <p className="font-[family-name:var(--font-heading)] text-base font-extrabold text-[#0E7042]">
              {overview ? overview.achat : '…'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-border/80 bg-card px-2.5 py-2 shadow-2xs">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#FEF6E7] text-[#F7AC37]">
            <FileText className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[10px] font-bold uppercase tracking-wider text-muted-foreground">LLD</p>
            <p className="font-[family-name:var(--font-heading)] text-base font-extrabold text-[#B87414]">
              {overview ? overview.lld : '…'}
            </p>
          </div>
        </div>
      </div>

      {/* 2. Barre de sélection de graphique (1 clic pour basculer entre tous les graphiques) */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar border-b border-border/80 pb-2.5 sm:flex-wrap sm:overflow-visible">
        {TABS.map(({ id, shortLabel, icon: Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onTabChange(id)}
              aria-pressed={isActive}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold transition cursor-pointer',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'border border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground',
              )}
            >
              <Icon className="h-3 w-3 shrink-0" />
              <span>{shortLabel}</span>
            </button>
          );
        })}
      </div>

      {/* 3. En-tête du graphique actif + sous-filtres contextuels + bouton Agrandir */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="truncate text-xs font-bold uppercase tracking-wider text-foreground">
            {activeTabMeta.label}
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {(activeTab === 'cost2026' || activeTab === 'costSince2025' || activeTab === 'interventions') && (
            <>
              {activeTab === 'interventions' && (
                <div className="inline-flex rounded-md border border-border bg-card p-0.5 text-[11px] font-bold">
                  {(['2025', '2026'] as const).map((y) => (
                    <button
                      key={y}
                      type="button"
                      onClick={() => setIntervYear(y)}
                      className={cn(
                        'rounded px-2 py-0.5 transition cursor-pointer',
                        intervYear === y ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {y}
                    </button>
                  ))}
                </div>
              )}
              <div className="inline-flex rounded-md border border-border bg-card p-0.5 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setScopeMode('top')}
                  className={cn(
                    'rounded px-2 py-0.5 transition cursor-pointer',
                    scopeMode === 'top' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  Top 8
                </button>
                <button
                  type="button"
                  onClick={() => setScopeMode('all')}
                  className={cn(
                    'rounded px-2 py-0.5 transition cursor-pointer',
                    scopeMode === 'all' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  Tous
                </button>
              </div>
            </>
          )}

          {activeTab === 'energy' && (
            <button
              type="button"
              onClick={() => setIncludeWellborne((w) => !w)}
              className={cn(
                'rounded-md border px-2 py-0.5 text-[11px] font-bold transition cursor-pointer',
                includeWellborne
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-card text-muted-foreground hover:text-foreground',
              )}
            >
              {includeWellborne ? '✓ Wellborne inclus' : '+ Inclure Wellborne'}
            </button>
          )}

          {activeTab === 'conso' && (
            <>
              <div className="inline-flex rounded-md border border-border bg-card p-0.5 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setConsoEnergy('elec')}
                  className={cn(
                    'rounded px-2 py-0.5 transition cursor-pointer',
                    consoEnergy === 'elec' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  Électrique
                </button>
                <button
                  type="button"
                  onClick={() => setConsoEnergy('total')}
                  className={cn(
                    'rounded px-2 py-0.5 transition cursor-pointer',
                    consoEnergy === 'total' ? 'bg-[#D66927] text-white' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  Total
                </button>
              </div>
              <div className="inline-flex rounded-md border border-border bg-card p-0.5 text-[11px] font-bold">
                {(
                  [
                    { id: 'all', label: 'Tous' },
                    { id: 'top10', label: 'Top 10' },
                    { id: 'top5', label: 'Top 5' },
                  ] as const
                ).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setConsoScope(s.id)}
                    className={cn(
                      'rounded px-2 py-0.5 transition cursor-pointer',
                      consoScope === s.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </>
          )}

          <button
            type="button"
            onClick={onToggleExpand}
            title={expanded ? 'Réduire le graphique' : 'Agrandir en pleine largeur'}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[11px] font-bold text-muted-foreground transition hover:border-primary/40 hover:text-foreground cursor-pointer"
          >
            {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{expanded ? 'Réduire' : 'Agrandir'}</span>
          </button>
        </div>
      </div>

      {/* 4. Zone Graphique principale */}
      <div className="min-w-0 flex-1">{renderChartContent()}</div>

      <p className="text-right text-[10px] text-muted-foreground">
        Tableau de bord Suivi des véhicules · {overview ? `${overview.total} véhicules en service` : 'Chargement…'}
      </p>
    </div>
  );
}
