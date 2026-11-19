import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Zap, Fuel, DollarSign } from 'lucide-react';
import { loadCost } from '@generated/components/ChargemapCost';

const eur = (n: number) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

type MonthComparison = {
  label: string;
  carburant: number;
  electricite: number;
  total: number;
};

export default function EnergyComparisonChart() {
  const [data, setData] = useState<{
    months: MonthComparison[];
    totCarb: number;
    totElec: number;
    totGlobal: number;
    year: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([loadCost('carburant'), loadCost('chargemap')])
      .then(([carb, elec]) => {
        const months: MonthComparison[] = [];
        let totCarb = 0;
        let totElec = 0;

        const maxLen = Math.max(carb.months.length, elec.months.length);
        for (let i = 0; i < maxLen; i++) {
          const cM = carb.months[i];
          const eM = elec.months[i];
          const label = cM?.label || eM?.label || `M${i + 1}`;
          const cVal = cM?.total ?? 0;
          const eVal = (eM?.total ?? 0) + (eM?.wellborne ?? 0);

          totCarb += cVal;
          totElec += eVal;

          months.push({
            label,
            carburant: Math.round(cVal),
            electricite: Math.round(eVal),
            total: Math.round(cVal + eVal),
          });
        }

        setData({
          months,
          totCarb,
          totElec,
          totGlobal: totCarb + totElec,
          year: carb.year,
        });
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
        Impossible de charger le comparatif énergétique.
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-[var(--radius-md)] border border-border bg-card p-4">
      {/* KPI Énergie */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-3 shadow-xs">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-50 text-rose-600">
            <Fuel className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Total Carburant {data.year}</p>
            <p className="font-[family-name:var(--font-heading)] text-lg font-extrabold text-rose-600">
              {eur(data.totCarb)}
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                ({data.totGlobal > 0 ? Math.round((data.totCarb / data.totGlobal) * 100) : 0}%)
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-3 shadow-xs">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-50 text-amber-600">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Total Électricité {data.year}</p>
            <p className="font-[family-name:var(--font-heading)] text-lg font-extrabold text-amber-600">
              {eur(data.totElec)}
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                ({data.totGlobal > 0 ? Math.round((data.totElec / data.totGlobal) * 100) : 0}%)
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-3 shadow-xs">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-primary">
            <DollarSign className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Budget Énergie Global</p>
            <p className="font-[family-name:var(--font-heading)] text-lg font-extrabold text-primary">
              {eur(data.totGlobal)}
            </p>
          </div>
        </div>
      </div>

      <div className="border-b border-border pb-2 pt-2">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Comparatif mensuel du coût énergie {data.year} (Carburant vs Électrique / Chargemap)
        </p>
      </div>

      {/* Graphique empilé */}
      <div className="h-64 w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.months} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} stroke="hsl(var(--muted-foreground))" />
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
              formatter={(v, name) => [eur(Number(v)), name === 'carburant' ? 'Carburant' : 'Électricité (Chargemap + Wellborne)']}
              contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
            />
            <Legend
              formatter={(val) => (val === 'carburant' ? 'Carburant (Essence/Diesel)' : 'Électricité (Chargemap & Wellborne)')}
              wrapperStyle={{ fontSize: 12 }}
            />
            <Bar dataKey="carburant" stackId="energy" fill="#9B1B30" radius={[0, 0, 0, 0]} />
            <Bar dataKey="electricite" stackId="energy" fill="#FFB100" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <p className="text-right text-[11px] text-muted-foreground">
        Cumul mensuel des dépenses consolidées de la flotte
      </p>
    </div>
  );
}
