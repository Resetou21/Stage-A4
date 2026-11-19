import { useEffect, useState } from 'react';
import { getTopVehicles } from '@generated/server/energyTop';

type Data = Awaited<ReturnType<typeof getTopVehicles>>;
const eur = (n: number) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

type Source = 'chargemap' | 'carburant';
const cache = new Map<Source, Promise<Data>>();
export function loadTop(source: Source) {
  let p = cache.get(source);
  if (!p) {
    p = getTopVehicles({ data: { source } });
    p.catch(() => cache.delete(source));
    cache.set(source, p);
  }
  return p;
}

export default function TopVehicles({ source }: { source: 'chargemap' | 'carburant' }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    loadTop(source)
      .then((r) => setData(r ?? null))
      .catch((e) => { console.error(e); setError(true); });
  }, [source]);

  if (error) return <p className="text-sm text-destructive">Impossible de charger les consommations.</p>;
  if (!data) return <div className="h-48 animate-pulse rounded-[var(--radius-md)] bg-muted" />;
  if (data.vehicles.length === 0) return <p className="text-sm text-muted-foreground">Aucune dépense sur les 6 derniers mois.</p>;

  const monthTotals = data.series.map((m) => data.vehicles.reduce((s, _, i) => s + Number(m[`v${i}`] ?? 0), 0));
  const grand = data.vehicles.reduce((s, v) => s + v.total, 0);

  return (
    <div className="min-w-0 overflow-x-auto rounded-[var(--radius-md)] border border-border">
      <table className="w-full min-w-[40rem] border-collapse text-sm">
        <caption className="px-4 pt-3 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Synthèse · Top 5 des dépenses · 6 derniers mois · « {data.group} »
        </caption>
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            <th scope="col" className="sticky left-0 bg-card px-4 py-2 text-left font-semibold">Immatriculation</th>
            <th scope="col" className="px-3 py-2 text-center font-semibold">N°</th>
            <th scope="col" className="px-3 py-2 text-left font-semibold">Modèle</th>
            {data.series.map((m) => <th key={String(m.label)} scope="col" className="px-3 py-2 text-right font-semibold">{m.label}</th>)}
            <th scope="col" className="px-4 py-2 text-right font-bold text-foreground">Total</th>
          </tr>
        </thead>
        <tbody>
          {data.vehicles.map((v, i) => (
            <tr key={v.name} className="border-b border-border hover:bg-muted/30 transition-colors">
              <th scope="row" className="sticky left-0 bg-card px-4 py-2 text-left font-mono font-semibold">
                <span className="mr-2 text-xs text-muted-foreground">{i + 1}.</span>{v.name}
              </th>
              <td className="px-3 py-2 text-center">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-bold bg-primary/10 text-primary border border-primary/20">
                  {v.num ? v.num.replace(/^#/, '') : '—'}
                </span>
              </td>
              <td className="px-3 py-2 text-left text-xs text-muted-foreground font-medium whitespace-nowrap">
                {v.model || '—'}
              </td>
              {data.series.map((m) => {
                const val = Number(m[`v${i}`] ?? 0);
                return <td key={String(m.label)} className={`px-3 py-2 text-right tabular-nums ${val ? '' : 'text-muted-foreground'}`}>{val ? eur(val) : '—'}</td>;
              })}
              <td className="px-4 py-2 text-right font-bold tabular-nums text-primary">{eur(v.total)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-muted/50 font-bold">
            <th scope="row" colSpan={3} className="sticky left-0 bg-muted px-4 py-2 text-left">Total</th>
            {monthTotals.map((t, i) => <td key={String(data.series[i]?.label)} className="px-3 py-2 text-right tabular-nums">{eur(t)}</td>)}
            <td className="px-4 py-2 text-right tabular-nums">{eur(grand)}</td>
          </tr>
        </tfoot>
      </table>
      {!data.vehicleColumn && <p className="px-4 pb-3 text-xs text-muted-foreground">Véhicule identifié par le nom de la ligne.</p>}
    </div>
  );
}
