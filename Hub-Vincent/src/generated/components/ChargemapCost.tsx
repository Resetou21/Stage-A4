import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { getMonthlyCost } from '@generated/server/energy';

type Data = Awaited<ReturnType<typeof getMonthlyCost>>;
const eur = (n: number) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

type Source = 'chargemap' | 'carburant';
const cache = new Map<Source, Promise<Data>>();
export function loadCost(source: Source) {
  let p = cache.get(source);
  if (!p) {
    p = getMonthlyCost({ data: { source } });
    p.catch(() => cache.delete(source));
    cache.set(source, p);
  }
  return p;
}

export default function ChargemapCost({ source }: { source: 'chargemap' | 'carburant' }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    loadCost(source)
      .then((r) => setData(r ?? null))
      .catch((e) => { console.error(e); setError(true); });
  }, [source]);

  if (error) return <p className="text-sm text-destructive">Impossible de charger les dépenses.</p>;
  if (!data) return <div className="h-64 animate-pulse rounded-[var(--radius-md)] bg-muted" />;

  return (
    <div className="rounded-[var(--radius-md)] border border-border p-4">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Dépenses {data.year} par mois · « {data.group} »{data.hasWellborne ? ' + Wellborne' : ''}</p>
        <p className="font-[family-name:var(--font-heading)] text-2xl font-extrabold text-primary">{eur(data.total)}</p>
      </div>
      <div className="h-64 w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.months} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} stroke="hsl(var(--muted-foreground))" />
            <YAxis tickLine={false} axisLine={false} fontSize={12} width={56} stroke="hsl(var(--muted-foreground))"
              tickFormatter={(v: number) => `${Math.round(v).toLocaleString('fr-FR')} €`} />
            <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} formatter={(v) => eur(Number(v))}
              contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
            {data.hasWellborne && <Legend wrapperStyle={{ fontSize: 12 }} />}
            <Bar dataKey="total" name={data.hasWellborne ? 'Chargemap' : 'Dépenses'} stackId="c" fill="hsl(var(--chart-1))"
              radius={data.hasWellborne ? [0, 0, 0, 0] : [6, 6, 0, 0]} />
            {data.hasWellborne && <Bar dataKey="wellborne" name="Wellborne" stackId="c" fill="hsl(var(--chart-3))" radius={[6, 6, 0, 0]} />}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Mois calculé d’après {data.dateColumn ? `la colonne « ${data.dateColumn} »` : 'la date de création des lignes'}.
      </p>
    </div>
  );
}
