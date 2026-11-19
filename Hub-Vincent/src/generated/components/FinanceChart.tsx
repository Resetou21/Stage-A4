import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { getMonthlyFinance } from '@generated/server/direction';

type Data = Awaited<ReturnType<typeof getMonthlyFinance>>;
const fmt = (n: number) => n.toLocaleString('fr-FR');

export default function FinanceChart({ metric }: { metric: 'ca' | 'res' }) {
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    getMonthlyFinance({ data: {} }).then((r) => setData(r ?? null)).catch((e) => { console.error(e); setErr(true); });
  }, []);

  if (err) return <p className="text-sm text-destructive">Impossible de charger les données mensuelles.</p>;
  if (!data) return <div className="h-72 animate-pulse rounded-[var(--radius-md)] bg-muted" />;
  if (data.months.length === 0) return <p className="text-sm text-muted-foreground">Aucune donnée mensuelle pour {data.year}.</p>;

  const rows = data.months.map((m) => {
    const r = metric === 'ca' ? m.caRealise : m.resRealise;
    // Le budget n'apparaît que si un réalisé existe pour le même mois
    const b = r != null ? (metric === 'ca' ? m.caBudget : m.resBudget) : null;
    return { mois: m.label, Budget: b, Réalisé: r, ecart: b != null && r != null ? r - b : null };
  });
  const totB = rows.reduce((s, r) => s + (r.Budget ?? 0), 0);
  const totR = rows.reduce((s, r) => s + (r.Réalisé ?? 0), 0);
  const diff = totR - totB;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded-full border border-border bg-background px-3 py-1">Budget cumulé · <strong>{fmt(totB)}</strong></span>
        <span className="rounded-full border border-border bg-background px-3 py-1">Réalisé cumulé · <strong>{fmt(totR)}</strong></span>
        <span className={`rounded-full px-3 py-1 font-bold ${diff >= 0 ? 'bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]' : 'bg-destructive/15 text-destructive'}`}>
          Écart · {diff >= 0 ? '+' : ''}{fmt(diff)}
        </span>
      </div>
      <div className="h-72 w-full min-w-0 rounded-[var(--radius-md)] border border-border bg-background p-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="mois" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={fmt} width={56} />
            <Tooltip formatter={(v) => (typeof v === 'number' ? fmt(v) : String(v ?? '—'))}
              contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="Budget" fill="hsl(var(--muted-foreground))" fillOpacity={0.45} radius={[4, 4, 0, 0]} />
            <Bar dataKey="Réalisé" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {rows.map((r) => (
          <li key={r.mois} className="rounded-[var(--radius-sm)] border border-border bg-background px-2 py-1 text-center text-xs">
            <span className="capitalize text-muted-foreground">{r.mois}</span>
            <span className={`block font-bold ${r.ecart == null ? '' : r.ecart >= 0 ? 'text-[hsl(var(--success))]' : 'text-destructive'}`}>
              {r.ecart == null ? '—' : `${r.ecart >= 0 ? '+' : ''}${fmt(r.ecart)}`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
