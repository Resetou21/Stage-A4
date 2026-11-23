import { useEffect, useState } from 'react';
import { Landmark, TrendingDown, TrendingUp, ChevronDown, BarChart3, Euro, Users, ExternalLink } from 'lucide-react';
import { getLossesSummary } from '@generated/server/direction';
import LossesList, { eur } from '@generated/components/LossesList';
import FinanceChart from '@generated/components/FinanceChart';
import NewTopic from '@generated/components/NewTopic';
import { cn } from '@lib/utils';

type Summary = Awaited<ReturnType<typeof getLossesSummary>>;
type Panel = 'losses' | 'gains' | 'ca' | 'res' | null;

// Lien à renseigner plus tard.
const REUNION_URL = 'https://groupefacility.monday.com/boards/5099650983';

const tile = 'flex flex-col gap-3 rounded-[var(--radius-xl)] border border-border bg-background p-4 sm:aspect-square';
const head = 'flex items-start gap-2 text-xs font-bold uppercase leading-snug tracking-wider text-muted-foreground';
const badge = 'flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-primary';
const btn = 'inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] px-3 text-sm font-bold transition';

function ToggleButton({ active, onClick, label, icon: Icon }: { active: boolean; onClick: () => void; label: string; icon: typeof Euro }) {
  return (
    <button type="button" onClick={onClick} aria-expanded={active}
      className={cn(btn, active ? 'bg-primary text-primary-foreground' : 'border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground')}>
      <Icon className="h-4 w-4" aria-hidden /> {label}
      <ChevronDown className={cn('h-4 w-4 transition-transform', active && 'rotate-180')} aria-hidden />
    </button>
  );
}

export default function DirectionCard() {
  const [sum, setSum] = useState<Summary | null>(null);
  const [err, setErr] = useState(false);
  const [gain, setGain] = useState<Summary | null>(null);
  const [gainErr, setGainErr] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const toggle = (p: Panel) => setPanel((c) => (c === p ? null : p));

  useEffect(() => {
    getLossesSummary({ data: { kind: 'loss' } }).then((r) => setSum(r ?? null)).catch((e) => { console.error(e); setErr(true); });
    getLossesSummary({ data: { kind: 'gain' } }).then((r) => setGain(r ?? null)).catch((e) => { console.error(e); setGainErr(true); });
  }, []);

  const year = sum?.year ?? new Date().getFullYear();

  return (
    <div className="relative rounded-[var(--radius-lg)] border border-border bg-card p-4 pt-8 sm:p-8">
      <div className="absolute -top-4 left-6 flex items-center gap-3 bg-background pr-3">
        <span className="inline-flex h-8 min-w-10 items-center justify-center rounded-[var(--radius-sm)] rounded-br-none bg-primary px-2 text-sm font-bold text-primary-foreground">02</span>
        <h2 className="text-xl font-bold">Direction</h2>
      </div>
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-secondary text-primary"><Landmark className="h-6 w-6" /></div>
        <p className="min-w-0 text-sm">Coût de non-qualité et gains financiers de l’année, indicateurs financiers et réunion d’associés.</p>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className={cn(tile, panel === 'losses' && 'border-primary ring-2 ring-primary/20')}>
          <p className={head}><span className={badge}><TrendingDown className="h-4 w-4" aria-hidden /></span>
            <span className="pt-1">Coût de non-qualité {year}</span></p>
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <span className="font-[family-name:var(--font-heading)] text-3xl font-extrabold leading-none text-destructive sm:text-4xl">
              {err ? '—' : sum ? eur(sum.total) : <span className="inline-block h-9 w-24 animate-pulse rounded bg-muted" />}
            </span>
            {sum && <span className="mt-1 text-xs text-muted-foreground">{sum.count} perte{sum.count > 1 ? 's' : ''} HT</span>}
          </div>
          <div className="flex justify-end">
            <button type="button" onClick={() => toggle('losses')} aria-expanded={panel === 'losses'}
              aria-label={panel === 'losses' ? 'Masquer le détail des pertes' : 'Afficher le détail des pertes'}
              className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-primary text-primary transition hover:bg-primary hover:text-primary-foreground">
              <ChevronDown className={cn('h-5 w-5 transition-transform', panel === 'losses' && 'rotate-180')} />
            </button>
          </div>
        </div>

        <div className={cn(tile, panel === 'gains' && 'border-primary ring-2 ring-primary/20')}>
          <p className={head}><span className={badge}><TrendingUp className="h-4 w-4" aria-hidden /></span>
            <span className="pt-1">Gain financier {year}</span></p>
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <span className="font-[family-name:var(--font-heading)] text-3xl font-extrabold leading-none text-[hsl(var(--brand-blue))] sm:text-4xl">
              {gainErr ? '—' : gain ? eur(gain.total) : <span className="inline-block h-9 w-24 animate-pulse rounded bg-muted" />}
            </span>
            {gain && <span className="mt-1 text-xs text-muted-foreground">{gain.count} gain{gain.count > 1 ? 's' : ''} HT</span>}
          </div>
          <div className="flex justify-end">
            <button type="button" onClick={() => toggle('gains')} aria-expanded={panel === 'gains'}
              aria-label={panel === 'gains' ? 'Masquer le détail des gains' : 'Afficher le détail des gains'}
              className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-primary text-primary transition hover:bg-primary hover:text-primary-foreground">
              <ChevronDown className={cn('h-5 w-5 transition-transform', panel === 'gains' && 'rotate-180')} />
            </button>
          </div>
        </div>

        <div className={cn(tile, (panel === 'ca' || panel === 'res') && 'border-primary ring-2 ring-primary/20')}>
          <p className={head}><span className={badge}><BarChart3 className="h-4 w-4" aria-hidden /></span><span className="pt-1">Indicateurs financiers</span></p>
          <div className="flex flex-1 flex-col justify-center gap-3">
            <ToggleButton active={panel === 'ca'} onClick={() => toggle('ca')} label="Chiffre d’affaires" icon={BarChart3} />
            <ToggleButton active={panel === 'res'} onClick={() => toggle('res')} label="Résultat" icon={Euro} />
          </div>
        </div>

        <div className={tile}>
          <p className={head}><span className={badge}><Users className="h-4 w-4" aria-hidden /></span><span className="pt-1">Réunion d’associés</span></p>
          <div className="flex flex-1 flex-col justify-center gap-4">
            {REUNION_URL ? (
              <a href={REUNION_URL} target="_blank" rel="noopener noreferrer" className={cn(btn, 'bg-primary text-primary-foreground hover:brightness-95')}>
                <Users className="h-4 w-4" aria-hidden /> Ouvrir le tableau <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </a>
            ) : (
              <span className={cn(btn, 'cursor-not-allowed border border-dashed border-border text-muted-foreground')} title="Lien à venir">
                <Users className="h-4 w-4" aria-hidden /> Ouvrir le tableau
              </span>
            )}
            <NewTopic />
          </div>
        </div>
      </div>

      {panel && (
        <div className="mt-6">
          <p className="mb-3 text-sm font-bold">
            {panel === 'losses' ? `Détail du coût de non-qualité ${year}` : panel === 'gains' ? `Détail des gains financiers ${year}`
              : panel === 'ca' ? `Chiffre d’affaires ${year} · réalisé vs budget` : `Résultat ${year} · réalisé vs budget`}
          </p>
          {panel === 'losses' ? <LossesList key="loss" categories={sum?.categories ?? []} />
            : panel === 'gains' ? <LossesList key="gain" kind="gain" categories={gain?.categories ?? []} /> : <FinanceChart key={panel} metric={panel} />}
        </div>
      )}
    </div>
  );
}
