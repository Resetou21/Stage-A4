import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Zap, Fuel, DollarSign } from 'lucide-react';
import { loadCost, getStorageCost } from '@generated/components/ChargemapCost';

const eur = (n: number) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

type MonthComparison = {
  label: string;
  carburant: number;
  electricite: number;
  total: number;
};

type ComparisonData = {
  months: MonthComparison[];
  totCarb: number;
  totElec: number;
  totGlobal: number;
  year: number;
};

function buildComparison(carb: any, elec: any): ComparisonData {
  const months: MonthComparison[] = [];
  let totCarb = 0;
  let totElec = 0;

  const maxLen = Math.max(carb?.months?.length || 0, elec?.months?.length || 0);
  for (let i = 0; i < maxLen; i++) {
    const cM = carb?.months?.[i];
    const eM = elec?.months?.[i];
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

  return {
    months,
    totCarb,
    totElec,
    totGlobal: totCarb + totElec,
    year: carb?.year || elec?.year || new Date().getFullYear(),
  };
}

export default function EnergyComparisonChart() {
  // Lecture synchrone immédiate du cache local pour un affichage instantané à 0 ms !
  const [data, setData] = useState<ComparisonData | null>(() => {
    const cachedCarb = getStorageCost('carburant');
    const cachedElec = getStorageCost('chargemap');
    if (cachedCarb && cachedElec) {
      return buildComparison(cachedCarb, cachedElec);
    }
    return null;
  });
  const [loading, setLoading] = useState(() => !data);

  useEffect(() => {
    Promise.all([loadCost('carburant'), loadCost('chargemap')])
      .then(([carb, elec]) => {
        setData(buildComparison(carb, elec));
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        if (!data) setLoading(false);
      });
  }, []);

  if (loading && !data) {
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
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FFF4EB] text-[#D66927]">
            <Fuel className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Total Carburant {data.year}</p>
            <p className="font-[family-name:var(--font-heading)] text-lg font-extrabold text-[#D66927]">
              {eur(data.totCarb)}
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                ({data.totGlobal > 0 ? Math.round((data.totCarb / data.totGlobal) * 100) : 0}%)
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-3 shadow-xs">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EBF6FC] text-[#39A9DC]">
            <Zap className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Total Électricité {data.year}</p>
            <p className="font-[family-name:var(--font-heading)] text-lg font-extrabold text-[#3989B7]">
              {eur(data.totElec)}
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                ({data.totGlobal > 0 ? Math.round((data.totElec / data.totGlobal) * 100) : 0}%)
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-3 shadow-xs">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FEF6E7] text-[#F7AC37]">
            <DollarSign className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Budget Énergie Global</p>
            <p className="font-[family-name:var(--font-heading)] text-lg font-extrabold text-[#1B4565]">
              {eur(data.totGlobal)}
            </p>
          </div>
        </div>
      </div>

      {/* Graphique empilé */}
      <div className="pt-2">
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Comparatif mensuel du coût énergie {data.year} (Carburant vs Électrique / Chargemap)
        </p>
        <div className="h-64 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.months} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                fontSize={12}
                stroke="hsl(var(--muted-foreground))"
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                fontSize={12}
                width={56}
                stroke="hsl(var(--muted-foreground))"
                tickFormatter={(v: number) => `${Math.round(v).toLocaleString('fr-FR')} €`}
              />
              <Tooltip
                cursor={{ fill: 'hsl(var(--muted))' }}
                formatter={(v, name) => [
                  eur(Number(v)),
                  name === 'carburant' ? 'Carburant (Essence/Diesel)' : 'Électricité (Chargemap & Wellborne)',
                ]}
                contentStyle={{
                  background: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: 12 }}
                formatter={(value) =>
                  value === 'carburant' ? 'Carburant (Essence/Diesel)' : 'Électricité (Chargemap & Wellborne)'
                }
              />
              <Bar dataKey="carburant" name="carburant" stackId="energy" fill="#D66927" radius={[0, 0, 0, 0]} />
              <Bar dataKey="electricite" name="electricite" stackId="energy" fill="#39A9DC" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-right text-[11px] text-muted-foreground italic">
          Cumul mensuel des dépenses consolidées de la flotte
        </p>
      </div>
    </div>
  );
}
