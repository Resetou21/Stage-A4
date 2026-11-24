import { useEffect, useState } from 'react';
import {
  Truck,
  ExternalLink,
  ChevronDown,
  Eye,
  ClipboardList,
  ClipboardCheck,
  PlugZap,
  Fuel,
  Wallet,
  ListFilter,
  BarChart3,
  MapPin,
  X,
  type LucideIcon,
} from 'lucide-react';
import { countPlans } from '@generated/server/vehicles';
import {
  getFleetOverviewData,
  getStoredOverview,
  type FleetOverviewData,
} from '@generated/server/vehicleDashboard';
import OpenPlansList from '@generated/components/OpenPlansList';
import { cn } from '@lib/utils';
import ChargemapCost from '@generated/components/ChargemapCost';
import TopVehicles from '@generated/components/TopVehicles';
import SyncFixedChargesModal from '@generated/components/SyncFixedChargesModal';
import VehicleDashboardPanel, { type DashboardChartId } from '@generated/components/VehicleDashboardPanel';

const DASHBOARD_URL = 'https://groupefacility.monday.com/overviews/11196786';

type DetailPanel =
  | { type: 'plans'; kind: 'open' | 'done' }
  | { type: 'energy'; src: 'chargemap' | 'carburant'; view: 'cout' | 'all' }
  | null;

type Val = number | null | 'err';

function useCount(fn: () => Promise<{ total: number }>) {
  const [v, setV] = useState<Val>(null);
  useEffect(() => {
    fn()
      .then((r) => setV(r?.total ?? 0))
      .catch((e) => {
        console.error(e);
        setV('err');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return v;
}

function Badge({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
      <Icon className="h-4 w-4" aria-hidden />
    </span>
  );
}

function CompactKpiTile({
  label,
  value,
  tone,
  open,
  onToggle,
  icon,
}: {
  icon: LucideIcon;
  label: string;
  value: Val;
  tone: string;
  open?: boolean;
  onToggle?: () => void;
}) {
  return (
    <div
      className={cn(
        'flex flex-col justify-between gap-2 rounded-[var(--radius-xl)] border border-border bg-background p-3.5 sm:p-4 transition',
        open && 'border-primary ring-2 ring-primary/20',
      )}
    >
      <p className="flex items-start gap-2 text-[11px] font-bold uppercase leading-snug tracking-wider text-muted-foreground">
        <Badge icon={icon} />
        <span className="pt-1">{label}</span>
      </p>
      <div className="flex items-end justify-between gap-2 pt-1">
        <span className={cn('font-[family-name:var(--font-heading)] text-4xl sm:text-5xl font-extrabold leading-none', tone)}>
          {value === 'err' ? (
            '—'
          ) : value === null ? (
            <span className="inline-block h-10 w-12 animate-pulse rounded bg-muted align-middle" />
          ) : (
            value
          )}
        </span>
        {onToggle && (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            aria-label={open ? `Masquer : ${label}` : `Afficher : ${label}`}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-primary text-primary transition hover:bg-primary hover:text-primary-foreground cursor-pointer"
          >
            <ChevronDown className={cn('h-5 w-5 transition-transform', open && 'rotate-180')} />
          </button>
        )}
      </div>
    </div>
  );
}

function ControlsTile({
  overview,
  loading,
  activeChart,
  onOpenControlsChart,
}: {
  overview: FleetOverviewData | null;
  loading: boolean;
  activeChart: boolean;
  onOpenControlsChart: () => void;
}) {
  const data = overview?.controls ?? null;
  const max = Math.max(1, ...(data?.months3m.map((m) => m.count) ?? [1]));

  return (
    <div
      className={cn(
        'flex flex-col justify-between gap-3 rounded-[var(--radius-xl)] border border-border bg-background p-4 transition',
        activeChart && 'border-primary ring-2 ring-primary/15',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="flex items-start gap-2 text-[11px] font-bold uppercase leading-snug tracking-wider text-muted-foreground">
          <Badge icon={Eye} />
          <span className="pt-1">Contrôles visuels · 3 derniers mois</span>
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-[family-name:var(--font-heading)] text-3xl font-extrabold leading-none text-primary">
            {loading && !data ? (
              <span className="inline-block h-8 w-10 animate-pulse rounded bg-muted" />
            ) : (
              data?.total3m ?? '—'
            )}
          </span>
        </div>
      </div>

      <div className="flex items-end gap-4">
        <div
          className="flex h-20 flex-1 items-end gap-3"
          role="img"
          aria-label={data ? data.months3m.map((m) => `${m.label} : ${m.count}`).join(', ') : 'Chargement'}
        >
          {(data?.months3m ?? [null, null, null]).map((m, i) => (
            <div key={m?.label ?? `sk-${i}`} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
              <span className="text-xs font-bold">{m ? m.count : ''}</span>
              <div
                className={cn('w-full rounded-t-[var(--radius-sm)]', m ? 'bg-primary' : 'animate-pulse bg-muted')}
                style={{ height: m ? `${Math.max(8, (m.count / max) * 100)}%` : '40%' }}
              />
              <span className="text-[11px] capitalize text-muted-foreground">{m?.label ?? ''}</span>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={onOpenControlsChart}
          className={cn(
            'inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition cursor-pointer',
            activeChart
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground',
          )}
          title="Afficher le graphique détaillé des contrôles visuels"
        >
          <BarChart3 className="h-3.5 w-3.5" />
          <span>Détail</span>
        </button>
      </div>
    </div>
  );
}

export default function VehiclesCard() {
  const openCount = useCount(() => countPlans({ data: { kind: 'open' } }));
  const doneCount = useCount(() => countPlans({ data: { kind: 'done' } }));
  const [overview, setOverview] = useState<FleetOverviewData | null>(() => getStoredOverview());
  const [overviewLoading, setOverviewLoading] = useState(() => !getStoredOverview());

  const [detail, setDetail] = useState<DetailPanel>(null);
  const [activeChart, setActiveChart] = useState<DashboardChartId>('brands');
  const [chartExpanded, setChartExpanded] = useState(false);

  useEffect(() => {
    let mounted = true;
    getFleetOverviewData({ data: {} })
      .then((res) => {
        if (!mounted) return;
        setOverview(res);
        setOverviewLoading(false);
      })
      .catch((err) => {
        console.error(err);
        if (mounted) setOverviewLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const togglePlans = (kind: 'open' | 'done') => {
    setDetail((cur) => (cur?.type === 'plans' && cur.kind === kind ? null : { type: 'plans', kind }));
  };

  const toggleEnergy = (src: 'chargemap' | 'carburant', view: 'cout' | 'all') => {
    setDetail((cur) =>
      cur?.type === 'energy' && cur.src === src && cur.view === view ? null : { type: 'energy', src, view },
    );
  };

  const isEnergyActive = (src: 'chargemap' | 'carburant', view: 'cout' | 'all') =>
    detail?.type === 'energy' && detail.src === src && detail.view === view;

  return (
    <div className="relative rounded-[var(--radius-lg)] border border-border bg-card p-4 pt-8 sm:p-8">
      <div className="absolute -top-4 left-6 flex items-center gap-3 bg-background pr-3">
        <span className="inline-flex h-8 min-w-10 items-center justify-center rounded-[var(--radius-sm)] rounded-br-none bg-primary px-2 text-sm font-bold text-primary-foreground">
          01
        </span>
        <h2 className="text-xl font-bold">Suivi des véhicules</h2>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
            <Truck className="h-6 w-6" />
          </div>
          <p className="min-w-0 text-sm">
            Consultez le tableau de bord de suivi de la flotte : kilométrage, entretiens, coûts et affectations des véhicules.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 sm:shrink-0">
          <button
            type="button"
            onClick={() => document.getElementById('section-geoloc')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-border bg-background px-3.5 py-2 text-xs font-bold text-foreground transition hover:bg-muted shadow-xs cursor-pointer"
            title="Accéder au module Géolocalisation & Horaires"
          >
            <MapPin className="h-4 w-4 text-primary" />
            <span>Géoloc &amp; Horaires</span>
          </button>
          <SyncFixedChargesModal />
          <a
            href={DASHBOARD_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-primary px-5 text-sm font-bold text-primary-foreground transition hover:brightness-95 sm:w-auto"
          >
            Ouvrir le tableau de bord
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>

      {/* Grille principale : KPIs & Accès Énergie à gauche | Tableau de bord Graphique interactif à droite */}
      <div className={cn('mt-7 grid grid-cols-1 gap-5', !chartExpanded && 'lg:grid-cols-12 lg:items-stretch')}>
        {/* Colonne Gauche : Contrôles visuels + Plans d'action + Consommations Électrique / Total */}
        <div className={cn('flex flex-col gap-3.5', !chartExpanded ? 'lg:col-span-5' : 'grid grid-cols-1 md:grid-cols-3')}>
          <ControlsTile
            overview={overview}
            loading={overviewLoading}
            activeChart={activeChart === 'controls'}
            onOpenControlsChart={() => setActiveChart('controls')}
          />

          <div className={cn('grid grid-cols-2 gap-3.5', chartExpanded && 'md:col-span-2')}>
            <CompactKpiTile
              icon={ClipboardList}
              label="Plans d’action en cours"
              value={openCount}
              tone="text-[hsl(var(--brand-orange))]"
              open={detail?.type === 'plans' && detail.kind === 'open'}
              onToggle={() => togglePlans('open')}
            />
            <CompactKpiTile
              icon={ClipboardCheck}
              label="Plans d’action faits · 2 mois"
              value={doneCount}
              tone="text-[hsl(var(--success))]"
              open={detail?.type === 'plans' && detail.kind === 'done'}
              onToggle={() => togglePlans('done')}
            />
          </div>

          {/* Accès rapide Électrique & Total (Coût + Tous les véhicules sans doublon Graphiques) */}
          <div
            className={cn(
              'rounded-[var(--radius-xl)] border border-border bg-background p-3.5',
              chartExpanded && 'md:col-span-3',
            )}
          >
            <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Détails énergie · Coûts &amp; tous les véhicules
            </p>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {/* Électrique */}
              <div className="rounded-lg border border-border/80 bg-card p-2.5">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-[#3989B7]">
                  <PlugZap className="h-3.5 w-3.5 shrink-0" />
                  <span>Électrique</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => toggleEnergy('chargemap', 'cout')}
                    aria-pressed={isEnergyActive('chargemap', 'cout')}
                    className={cn(
                      'inline-flex min-h-8 items-center justify-center gap-1 rounded-md border px-2 text-[11px] font-bold transition cursor-pointer',
                      isEnergyActive('chargemap', 'cout')
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-background text-foreground hover:bg-muted',
                    )}
                  >
                    <Wallet className="h-3 w-3 shrink-0" />
                    <span>Coût</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleEnergy('chargemap', 'all')}
                    aria-pressed={isEnergyActive('chargemap', 'all')}
                    className={cn(
                      'inline-flex min-h-8 items-center justify-center gap-1 rounded-md border px-2 text-[11px] font-bold transition cursor-pointer',
                      isEnergyActive('chargemap', 'all')
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-background text-foreground hover:bg-muted',
                    )}
                  >
                    <ListFilter className="h-3 w-3 shrink-0" />
                    <span>Véhicules</span>
                  </button>
                </div>
              </div>

              {/* Total / Carburant */}
              <div className="rounded-lg border border-border/80 bg-card p-2.5">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-[#D66927]">
                  <Fuel className="h-3.5 w-3.5 shrink-0" />
                  <span>Total</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => toggleEnergy('carburant', 'cout')}
                    aria-pressed={isEnergyActive('carburant', 'cout')}
                    className={cn(
                      'inline-flex min-h-8 items-center justify-center gap-1 rounded-md border px-2 text-[11px] font-bold transition cursor-pointer',
                      isEnergyActive('carburant', 'cout')
                        ? 'border-[#D66927] bg-[#D66927] text-white'
                        : 'border-border bg-background text-foreground hover:bg-muted',
                    )}
                  >
                    <Wallet className="h-3 w-3 shrink-0" />
                    <span>Coût</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleEnergy('carburant', 'all')}
                    aria-pressed={isEnergyActive('carburant', 'all')}
                    className={cn(
                      'inline-flex min-h-8 items-center justify-center gap-1 rounded-md border px-2 text-[11px] font-bold transition cursor-pointer',
                      isEnergyActive('carburant', 'all')
                        ? 'border-[#D66927] bg-[#D66927] text-white'
                        : 'border-border bg-background text-foreground hover:bg-muted',
                    )}
                  >
                    <ListFilter className="h-3 w-3 shrink-0" />
                    <span>Véhicules</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Colonne Droite (ou Pleine Largeur si Agrandi) : Tous les graphiques du Dashboard Suivi des véhicules */}
        <div className={cn('flex min-w-0', !chartExpanded && 'lg:col-span-7')}>
          <VehicleDashboardPanel
            activeTab={activeChart}
            onTabChange={setActiveChart}
            expanded={chartExpanded}
            onToggleExpand={() => setChartExpanded((e) => !e)}
            overview={overview}
            overviewLoading={overviewLoading}
          />
        </div>
      </div>

      {/* Panneau de détail pleine largeur (Plans d'action ou Coût / Tous les véhicules Électrique & Total) */}
      {detail && (
        <div className="mt-6 border-t border-border/80 pt-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm font-bold">
              {detail.type === 'plans'
                ? detail.kind === 'open'
                  ? 'Plans d’action en cours'
                  : 'Plans d’action faits ces 2 derniers mois'
                : `${detail.src === 'chargemap' ? 'Électrique' : 'Total'} · ${
                    detail.view === 'cout' ? 'Coût mensuel' : 'Consommation de tous les véhicules'
                  }`}
            </p>
            <button
              type="button"
              onClick={() => setDetail(null)}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer"
            >
              <X className="h-3.5 w-3.5" /> Fermer
            </button>
          </div>

          {detail.type === 'plans' ? (
            <OpenPlansList key={detail.kind} kind={detail.kind} />
          ) : detail.view === 'cout' ? (
            <ChargemapCost key={`cost-${detail.src}`} source={detail.src} />
          ) : (
            <TopVehicles key={`all-${detail.src}`} source={detail.src} />
          )}
        </div>
      )}
    </div>
  );
}
