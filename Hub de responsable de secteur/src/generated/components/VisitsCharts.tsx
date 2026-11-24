import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const MONTHS = ['Janv', 'Fév', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc'];

export function MonthlyChart({ monthly }: { monthly: number[] }) {
  const data = monthly.map((v, i) => ({ mois: MONTHS[i] ?? '', visites: v }));
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 20, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
          <XAxis dataKey="mois" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip formatter={(v: number) => [`${v} visite(s)`, 'Visites']} cursor={{ fill: 'hsl(var(--muted))' }} />
          <Bar dataKey="visites" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]}>
            <LabelList dataKey="visites" position="top" className="fill-foreground text-xs font-semibold" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Jauge demi-cercle : % de visites « Globalement bon »
export function Gauge({ value, label }: { value: number | null; label: string }) {
  const pct = value === null ? 0 : Math.max(0, Math.min(100, value));
  const r = 70;
  const len = Math.PI * r;
  const tone = pct >= 90 ? 'stroke-primary' : pct >= 75 ? 'stroke-[hsl(var(--brand-orange))]' : 'stroke-destructive';
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 180 100" className="w-full max-w-[220px]" role="img" aria-label={`${label} : ${value === null ? 'aucune donnée' : pct.toFixed(1) + ' % bon'}`}>
        <path d="M20 90 A70 70 0 0 1 160 90" fill="none" className="stroke-muted" strokeWidth="16" strokeLinecap="round" />
        <path d="M20 90 A70 70 0 0 1 160 90" fill="none" className={tone} strokeWidth="16" strokeLinecap="round"
          strokeDasharray={len} strokeDashoffset={len * (1 - pct / 100)} />
        <text x="90" y="80" textAnchor="middle" className="fill-foreground text-[22px] font-extrabold">
          {value === null ? '—' : `${pct.toLocaleString('fr-FR', { maximumFractionDigits: 1 })}%`}
        </text>
      </svg>
      <p className="-mt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-xs text-muted-foreground">bon</p>
    </div>
  );
}
