import { useEffect, useState } from 'react';
import { Truck, ExternalLink, ChevronDown, Eye, ClipboardList, ClipboardCheck, PlugZap, Fuel, type LucideIcon } from 'lucide-react';
import { countPlans, countRecentControls } from '@generated/server/vehicles';
import OpenPlansList from '@generated/components/OpenPlansList';
import { cn } from '@lib/utils';
import EnergyTile, { ENERGY_MENUS, type EnergyMenu } from '@generated/components/EnergyTile';
import ChargemapCost from '@generated/components/ChargemapCost';
import TopVehicles from '@generated/components/TopVehicles';
import FleetCharts from '@generated/components/FleetCharts';
import EnergyComparisonChart from '@generated/components/EnergyComparisonChart';
import SyncFixedChargesModal from '@generated/components/SyncFixedChargesModal';

const DASHBOARD_URL = 'https://groupefacility.monday.com/overviews/11196786';
type Kind = 'open' | 'done';
type Val = number | null | 'err';

function useCount(fn: () => Promise<{ total: number }>) {
  const [v, setV] = useState<Val>(null);
  useEffect(() => {
    fn().then((r) => setV(r?.total ?? 0)).catch((e) => { console.error(e); setV('err'); });
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

function Tile({ label, value, tone, open, onToggle, icon }: {
  icon: LucideIcon; label: string; value: Val; tone: string; open?: boolean; onToggle?: () => void;
}) {
  return (
    <div className={cn('flex flex-col justify-between gap-3 rounded-[var(--radius-xl)] border border-border bg-background p-4 sm:aspect-square',
      open && 'border-primary ring-2 ring-primary/20')}>
      <p className="flex items-start gap-2 text-xs font-bold uppercase leading-snug tracking-wider text-muted-foreground">
        <Badge icon={icon} /><span className="pt-1">{label}</span>
      </p>
      <div className="flex flex-1 items-center justify-center">
        <span className={cn('font-[family-name:var(--font-heading)] text-6xl font-extrabold leading-none sm:text-7xl', tone)}>
          {value === 'err' ? '—' : value === null ? <span className="inline-block h-10 w-12 animate-pulse rounded bg-muted align-middle" /> : value}
        </span>
      </div>
      <div className="flex justify-end">
        {onToggle && (
          <button type="button" onClick={onToggle} aria-expanded={open}
            aria-label={open ? `Masquer : ${label}` : `Afficher : ${label}`}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-primary text-primary transition hover:bg-primary hover:text-primary-foreground">
            <ChevronDown className={cn('h-5 w-5 transition-transform', open && 'rotate-180')} />
          </button>
        )}
      </div>
    </div>
  );
}

type Month = { label: string; count: number };

function ControlsTile() {
  const [data, setData] = useState<{ total: number; months: Month[] } | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    countRecentControls({ data: {} })
      .then((r) => setData({ total: r?.total ?? 0, months: r?.months ?? [] }))
      .catch((e) => { console.error(e); setErr(true); });
  }, []);
  const max = Math.max(1, ...(data?.months.map((m) => m.count) ?? [1]));
  return (
    <div className="flex flex-col justify-between gap-3 rounded-[var(--radius-xl)] border border-border bg-background p-4 sm:aspect-square">
      <div className="flex items-start justify-between gap-2">
        <p className="flex items-start gap-2 text-xs font-bold uppercase leading-snug tracking-wider text-muted-foreground">
          <Badge icon={Eye} /><span className="pt-1">Contrôles visuels · 3 derniers mois</span>
        </p>
        <span className="font-[family-name:var(--font-heading)] text-3xl font-extrabold leading-none text-primary">
          {err ? '—' : data ? data.total : <span className="inline-block h-8 w-10 animate-pulse rounded bg-muted" />}
        </span>
      </div>
      <div className="flex h-24 items-end gap-3" role="img"
        aria-label={data ? data.months.map((m) => `${m.label} : ${m.count}`).join(', ') : 'Chargement'}>
        {(data?.months ?? (['a', 'b', 'c'].map(() => null) as (Month | null)[])).map((m, i) => (
          <div key={m?.label ?? `sk-${['a', 'b', 'c'][i]}`} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
            <span className="text-xs font-bold">{m ? m.count : ''}</span>
            <div className={cn('w-full rounded-t-[var(--radius-sm)]', m ? 'bg-primary' : 'animate-pulse bg-muted')}
              style={{ height: m ? `${Math.max(4, (m.count / max) * 100)}%` : '40%' }} />
            <span className="text-[11px] capitalize text-muted-foreground">{m?.label ?? ''}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function VehiclesCard() {
  const openCount = useCount(() => countPlans({ data: { kind: 'open' } }));
  const doneCount = useCount(() => countPlans({ data: { kind: 'done' } }));
  const [shown, setShown] = useState<Kind | null>(null);
  const [energy, setEnergy] = useState<{ src: 'chargemap' | 'total'; menu: EnergyMenu } | null>(null);
  const toggle = (k: Kind) => { setEnergy(null); setShown((s) => (s === k ? null : k)); };

  return (
    <div className="relative rounded-[var(--radius-lg)] border border-border bg-card p-4 pt-8 sm:p-8">
      <div className="absolute -top-4 left-6 flex items-center gap-3 bg-background pr-3">
        <span className="inline-flex h-8 min-w-10 items-center justify-center rounded-[var(--radius-sm)] rounded-br-none bg-primary px-2 text-sm font-bold text-primary-foreground">01</span>
        <h2 className="text-xl font-bold">Suivi des véhicules</h2>
      </div>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
            <Truck className="h-6 w-6" />
          </div>
          <p className="min-w-0 text-sm">
            Consultez le tableau de bord de suivi de la flotte : kilométrage, entretiens et affectations des véhicules.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 sm:shrink-0">
          <SyncFixedChargesModal />
          <a href={DASHBOARD_URL} target="_blank" rel="noopener noreferrer"
            className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-primary px-5 text-sm font-bold text-primary-foreground transition hover:brightness-95 sm:w-auto">
            Ouvrir le tableau de bord
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3 lg:max-w-2xl">
        <ControlsTile />
        <Tile icon={ClipboardList} label="Plans d’action en cours" value={openCount} tone="text-[hsl(var(--brand-orange))]"
          open={shown === 'open'} onToggle={() => toggle('open')} />
        <Tile icon={ClipboardCheck} label="Plans d’action faits · 2 derniers mois" value={doneCount} tone="text-[hsl(var(--success))]"
          open={shown === 'done'} onToggle={() => toggle('done')} />
        {([{ src: 'chargemap', label: 'Électrique', icon: PlugZap }, { src: 'total', label: 'Total', icon: Fuel }] as const).map(({ src, label, icon }) => (
          <EnergyTile key={src} label={label} icon={icon} active={energy?.src === src ? energy.menu : null}
            onSelect={(menu) => { setShown(null); setEnergy((e) => (e?.src === src && e.menu === menu ? null : { src, menu })); }} />
        ))}
      </div>

      {energy && (
        <div className="mt-6">
          <p className="mb-3 text-sm font-bold">
            {energy.src === 'chargemap' ? 'Électrique' : 'Total'} · {ENERGY_MENUS.find((m) => m.id === energy.menu)?.label}
          </p>
          {energy.menu === 'cout' ? (
            <ChargemapCost key={energy.src} source={energy.src === 'chargemap' ? 'chargemap' : 'carburant'} />
          ) : energy.menu === 'top' ? (
            <TopVehicles key={energy.src} source={energy.src === 'chargemap' ? 'chargemap' : 'carburant'} />
          ) : energy.src === 'chargemap' ? (
            <FleetCharts key="fleet-charts" />
          ) : (
            <EnergyComparisonChart key="energy-comparison" />
          )}
        </div>
      )}

      {shown && (
        <div className="mt-6">
          <p className="mb-3 text-sm font-bold">
            {shown === 'open' ? 'Plans d’action en cours' : 'Plans d’action faits ces 2 derniers mois'}
          </p>
          <OpenPlansList key={shown} kind={shown} />
        </div>
      )}
    </div>
  );
}
