import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from 'recharts';
import { Zap, Fuel, ShoppingCart, FileText } from 'lucide-react';
import { getFleetStats } from '@generated/server/fleet';
import { cn } from '@lib/utils';

type FleetData = Awaited<ReturnType<typeof getFleetStats>>;

const BRAND_COLORS: Record<string, string> = {
  TOYOTA: '#39A9DC',
  OPEL: '#F7AC37',
  'CITROËN': '#3989B7',
  FIAT: '#D66927',
  MG: '#1B4565',
  HYUNDAI: '#E07A38',
  AIXAM: '#5EC2EC',
  FUSO: '#00C875',
  ALFA: '#0E7042',
  'JOHN DEERE': '#475569',
};

export default function FleetCharts() {
  const [data, setData] = useState<FleetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'brand' | 'year'>('brand');

  useEffect(() => {
    getFleetStats({ data: {} })
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div className="h-72 animate-pulse rounded-[var(--radius-md)] bg-muted" />;
  }

  if (!data) {
    return (
      <div className="flex min-h-32 items-center justify-center rounded-[var(--radius-md)] border border-border p-6 text-sm text-destructive">
        Impossible de charger les statistiques du parc véhicules.
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-[var(--radius-md)] border border-border bg-card p-4">
      {/* KPI Flotte */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-3 shadow-xs">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EBF6FC] text-[#39A9DC]">
            <Zap className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Électriques</p>
            <p className="font-[family-name:var(--font-heading)] text-xl font-extrabold text-[#3989B7]">
              {data.elec} <span className="text-xs font-normal text-muted-foreground">({Math.round((data.elec / data.total) * 100)}%)</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-3 shadow-xs">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FFF4EB] text-[#D66927]">
            <Fuel className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Thermiques</p>
            <p className="font-[family-name:var(--font-heading)] text-xl font-extrabold text-[#D66927]">
              {data.therm} <span className="text-xs font-normal text-muted-foreground">({Math.round((data.therm / data.total) * 100)}%)</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-3 shadow-xs">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E6F9F1] text-[#00C875]">
            <ShoppingCart className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Achat</p>
            <p className="font-[family-name:var(--font-heading)] text-xl font-extrabold text-[#0E7042]">{data.achat}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-3 shadow-xs">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FEF6E7] text-[#F7AC37]">
            <FileText className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">LLD</p>
            <p className="font-[family-name:var(--font-heading)] text-xl font-extrabold text-[#B87414]">{data.lld}</p>
          </div>
        </div>
      </div>

      {/* Onglets Graphiques */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2 pt-2">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {tab === 'brand' ? 'Répartition par marque de véhicule' : 'Évolution des acquisitions par année'}
        </p>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setTab('brand')}
            className={cn(
              'rounded-md px-2.5 py-1 text-xs font-bold transition',
              tab === 'brand' ? 'bg-primary text-primary-foreground' : 'border border-border bg-background text-muted-foreground hover:bg-muted'
            )}
          >
            Par marque
          </button>
          <button
            type="button"
            onClick={() => setTab('year')}
            className={cn(
              'rounded-md px-2.5 py-1 text-xs font-bold transition',
              tab === 'year' ? 'bg-primary text-primary-foreground' : 'border border-border bg-background text-muted-foreground hover:bg-muted'
            )}
          >
            Par année
          </button>
        </div>
      </div>

      {/* Graphique Recharts */}
      <div className="h-64 w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          {tab === 'brand' ? (
            <BarChart data={data.brands} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="brand" tickLine={false} axisLine={false} fontSize={11} stroke="hsl(var(--muted-foreground))" />
              <YAxis tickLine={false} axisLine={false} fontSize={11} width={28} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
              <Tooltip
                cursor={{ fill: 'hsl(var(--muted))' }}
                formatter={(v) => [`${v} véhicule${Number(v) > 1 ? 's' : ''}`, 'Nombre']}
                contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
              />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {data.brands.map((entry) => (
                  <Cell key={entry.brand} fill={BRAND_COLORS[entry.brand] || '#39A9DC'} />
                ))}
              </Bar>
            </BarChart>
          ) : (
            <BarChart data={data.years} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="year" tickLine={false} axisLine={false} fontSize={11} stroke="hsl(var(--muted-foreground))" />
              <YAxis tickLine={false} axisLine={false} fontSize={11} width={28} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
              <Tooltip
                cursor={{ fill: 'hsl(var(--muted))' }}
                formatter={(v) => [`${v} véhicule${Number(v) > 1 ? 's' : ''}`, 'Acquisitions']}
                contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
              />
              <Bar dataKey="count" fill="#39A9DC" radius={[6, 6, 0, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      <p className="text-right text-[11px] text-muted-foreground">
        Source : Tableau de bord Suivi des véhicules ({data.total} véhicules en service)
      </p>
    </div>
  );
}
