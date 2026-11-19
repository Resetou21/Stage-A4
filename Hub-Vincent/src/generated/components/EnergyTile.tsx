import { Wallet, TriangleAlert, BarChart3, type LucideIcon } from 'lucide-react';
import { cn } from '@lib/utils';

export type EnergyMenu = 'cout' | 'top' | 'graph';
export const ENERGY_MENUS: { id: EnergyMenu; label: string; icon: LucideIcon }[] = [
  { id: 'cout', label: 'Coût', icon: Wallet },
  { id: 'top', label: 'Consommation importante', icon: TriangleAlert },
  { id: 'graph', label: 'Graphiques', icon: BarChart3 },
];

export default function EnergyTile({ label, icon: Icon, active, onSelect }: {
  label: string; icon: LucideIcon; active: EnergyMenu | null; onSelect: (m: EnergyMenu) => void;
}) {
  return (
    <div className={cn('flex flex-col gap-3 rounded-[var(--radius-xl)] border border-border bg-background p-4 sm:aspect-square',
      active && 'border-primary ring-2 ring-primary/20')}>
      <p className="flex items-start gap-2 text-xs font-bold uppercase leading-snug tracking-wider text-muted-foreground">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-primary"><Icon className="h-4 w-4" aria-hidden /></span>
        <span className="pt-1">{label}</span>
      </p>
      <div className="flex flex-1 flex-col justify-center gap-1.5">
        {ENERGY_MENUS.map(({ id, label: l, icon: I }) => (
          <button key={id} type="button" onClick={() => onSelect(id)} aria-pressed={active === id}
            className={cn('inline-flex min-h-9 items-center gap-2 rounded-[var(--radius-md)] border px-3 text-left text-xs font-semibold transition',
              active === id ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted')}>
            <I className="h-3.5 w-3.5 shrink-0" aria-hidden /> {l}
          </button>
        ))}
      </div>
    </div>
  );
}
