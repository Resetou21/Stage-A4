import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BarChart3, Search, Table2 } from 'lucide-react';
import { clearEnergyTopServerCache, getTopVehicles } from '@generated/server/energyTop';
import { cn } from '@lib/utils';

type Data = Awaited<ReturnType<typeof getTopVehicles>>;
const eur = (n: number) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

type Source = 'chargemap' | 'carburant';
type LimitMode = 'all' | 'top10' | 'top5';
type ViewMode = 'table' | 'chart';

const TOP_STORAGE_PREFIX = 'hub_vincent_top_all_v2_';
const TOP_TTL_MS = 30 * 60 * 1000;
const cache = new Map<Source, Promise<Data>>();

function getStoredTop(source: Source): Data | null {
  try {
    const raw = localStorage.getItem(TOP_STORAGE_PREFIX + source);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.ts === 'number' && Date.now() - parsed.ts < TOP_TTL_MS && parsed.data) {
      return parsed.data as Data;
    }
  } catch {}
  return null;
}

export function clearTopCache() {
  cache.clear();
  clearEnergyTopServerCache();
  try {
    localStorage.removeItem(TOP_STORAGE_PREFIX + 'chargemap');
    localStorage.removeItem(TOP_STORAGE_PREFIX + 'carburant');
    // Nettoyage ancien préfixe Top 5
    localStorage.removeItem('hub_vincent_top_chargemap');
    localStorage.removeItem('hub_vincent_top_carburant');
  } catch {}
}

export function loadTop(source: Source, force = false): Promise<Data> {
  if (!force) {
    const stored = getStoredTop(source);
    if (stored) return Promise.resolve(stored);
  }
  let p = cache.get(source);
  if (!p) {
    p = getTopVehicles({ data: { source } })
      .then((res) => {
        if (res) {
          try {
            localStorage.setItem(TOP_STORAGE_PREFIX + source, JSON.stringify({ ts: Date.now(), data: res }));
          } catch {}
        }
        return res;
      })
      .finally(() => {
        cache.delete(source);
      });
    cache.set(source, p);
  }
  return p;
}

export default function TopVehicles({ source }: { source: 'chargemap' | 'carburant' }) {
  const [data, setData] = useState<Data | null>(() => getStoredTop(source));
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [limitMode, setLimitMode] = useState<LimitMode>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('table');

  useEffect(() => {
    setError(false);
    setData(getStoredTop(source));
    loadTop(source)
      .then((r) => setData(r ?? null))
      .catch((e) => {
        console.error(e);
        if (!getStoredTop(source)) setError(true);
      });
  }, [source]);

  const monthLabels = useMemo(() => {
    if (!data) return [] as string[];
    return data.monthLabels?.length ? data.monthLabels : data.series.map((s) => String(s.label));
  }, [data]);

  const filteredVehicles = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    let list = data.vehicles.map((v, idx) => ({
      ...v,
      origIdx: idx,
      monthValues:
        v.months && v.months.length === monthLabels.length
          ? v.months
          : data.series.map((m) => Number(m[`v${idx}`] ?? 0)),
    }));
    if (q) {
      list = list.filter(
        (v) =>
          v.name.toLowerCase().includes(q) ||
          v.model.toLowerCase().includes(q) ||
          v.num.toLowerCase().includes(q),
      );
    }
    if (limitMode === 'top5') return list.slice(0, 5);
    if (limitMode === 'top10') return list.slice(0, 10);
    return list;
  }, [data, search, limitMode, monthLabels]);

  if (error) return <p className="text-sm text-destructive">Impossible de charger les consommations.</p>;
  if (!data) return <div className="h-56 animate-pulse rounded-[var(--radius-md)] bg-muted" />;
  if (data.vehicles.length === 0) return <p className="text-sm text-muted-foreground">Aucune dépense sur les 6 derniers mois.</p>;

  const monthTotals = monthLabels.map((_, mIdx) =>
    filteredVehicles.reduce((s, v) => s + (v.monthValues[mIdx] ?? 0), 0),
  );
  const grand = filteredVehicles.reduce((s, v) => s + v.total, 0);
  const barColor = source === 'chargemap' ? '#39A9DC' : '#D66927';
  const chartHeight = Math.max(260, filteredVehicles.length * 34 + 32);

  return (
    <div className="min-w-0 rounded-[var(--radius-md)] border border-border bg-card overflow-hidden">
      {/* Barre d'outils responsive : titre + recherche + filtre Tous/Top 10/Top 5 + bascule Tableau/Graphique */}
      <div className="flex flex-col gap-3 border-b border-border bg-muted/25 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Synthèse · {limitMode === 'all' ? 'Tous les véhicules' : limitMode === 'top10' ? 'Top 10' : 'Top 5'} ({filteredVehicles.length}
            {filteredVehicles.length !== data.vehicles.length ? ` / ${data.vehicles.length}` : ''}) · 6 derniers mois · « {data.group} »
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Recherche rapide */}
          <div className="relative flex-1 min-w-[160px] sm:flex-initial">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Immat, n° ou modèle…"
              className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring sm:w-44"
            />
          </div>

          {/* Filtre Tous / Top 10 / Top 5 */}
          <div className="inline-flex rounded-md border border-border bg-background p-0.5 text-[11px] font-bold">
            {(
              [
                { id: 'all', label: `Tous (${data.vehicles.length})` },
                { id: 'top10', label: 'Top 10' },
                { id: 'top5', label: 'Top 5' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setLimitMode(opt.id)}
                className={cn(
                  'rounded px-2 py-1 transition cursor-pointer',
                  limitMode === opt.id
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Bascule Tableau / Graphique */}
          <div className="inline-flex rounded-md border border-border bg-background p-0.5 text-[11px] font-bold">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={cn(
                'inline-flex items-center gap-1 rounded px-2 py-1 transition cursor-pointer',
                viewMode === 'table'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Table2 className="h-3.5 w-3.5" /> Tableau
            </button>
            <button
              type="button"
              onClick={() => setViewMode('chart')}
              className={cn(
                'inline-flex items-center gap-1 rounded px-2 py-1 transition cursor-pointer',
                viewMode === 'chart'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <BarChart3 className="h-3.5 w-3.5" /> Graphique
            </button>
          </div>
        </div>
      </div>

      {filteredVehicles.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">Aucun véhicule ne correspond à « {search} ».</p>
      ) : viewMode === 'table' ? (
        <div className="max-h-[540px] overflow-auto">
          <table className="w-full min-w-[42rem] border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_hsl(var(--border))]">
              <tr className="text-xs text-muted-foreground">
                <th scope="col" className="sticky left-0 z-20 bg-card px-4 py-2.5 text-left font-semibold">
                  Immatriculation
                </th>
                <th scope="col" className="px-3 py-2.5 text-center font-semibold">
                  N°
                </th>
                <th scope="col" className="px-3 py-2.5 text-left font-semibold">
                  Modèle
                </th>
                {monthLabels.map((lbl) => (
                  <th key={lbl} scope="col" className="px-3 py-2.5 text-right font-semibold">
                    {lbl}
                  </th>
                ))}
                <th scope="col" className="px-4 py-2.5 text-right font-bold text-foreground">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredVehicles.map((v, i) => (
                <tr key={v.name} className="border-b border-border/70 hover:bg-muted/30 transition-colors">
                  <th scope="row" className="sticky left-0 bg-card px-4 py-2 text-left font-mono font-semibold whitespace-nowrap">
                    <span className="mr-2 text-xs text-muted-foreground">{i + 1}.</span>
                    {v.name}
                  </th>
                  <td className="px-3 py-2 text-center">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-bold bg-primary/10 text-primary border border-primary/20">
                      {v.num ? v.num.replace(/^#/, '') : '—'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-left text-xs text-muted-foreground font-medium whitespace-nowrap">
                    {v.model || '—'}
                  </td>
                  {v.monthValues.map((val, mIdx) => (
                    <td
                      key={monthLabels[mIdx]}
                      className={`px-3 py-2 text-right tabular-nums ${val ? '' : 'text-muted-foreground'}`}
                    >
                      {val ? eur(val) : '—'}
                    </td>
                  ))}
                  <td className="px-4 py-2 text-right font-bold tabular-nums text-primary whitespace-nowrap">
                    {eur(v.total)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="sticky bottom-0 z-10 bg-muted shadow-[0_-1px_0_0_hsl(var(--border))]">
              <tr className="font-bold">
                <th scope="row" colSpan={3} className="sticky left-0 z-20 bg-muted px-4 py-2.5 text-left">
                  Total ({filteredVehicles.length} véhicule{filteredVehicles.length > 1 ? 's' : ''})
                </th>
                {monthTotals.map((t, i) => (
                  <td key={monthLabels[i]} className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap">
                    {eur(t)}
                  </td>
                ))}
                <td className="px-4 py-2.5 text-right tabular-nums text-primary whitespace-nowrap">{eur(grand)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className="p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-muted-foreground">
              Dépenses cumulées sur les 6 derniers mois ({monthLabels[0]} → {monthLabels[monthLabels.length - 1]})
            </span>
            <span className="font-bold text-primary">Total affiché : {eur(grand)}</span>
          </div>
          <div className="max-h-[480px] overflow-y-auto pr-1">
            <div style={{ height: chartHeight }} className="w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={filteredVehicles}
                  layout="vertical"
                  margin={{ top: 4, right: 28, left: 8, bottom: 4 }}
                >
                  <CartesianGrid horizontal={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                  <XAxis
                    type="number"
                    tickLine={false}
                    axisLine={false}
                    fontSize={11}
                    stroke="hsl(var(--muted-foreground))"
                    tickFormatter={(v: number) => `${Math.round(v).toLocaleString('fr-FR')} €`}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={96}
                    tickLine={false}
                    axisLine={false}
                    fontSize={11}
                    stroke="hsl(var(--foreground))"
                  />
                  <Tooltip
                    cursor={{ fill: 'hsl(var(--muted))' }}
                    formatter={(val: any) => [eur(Number(val)), 'Dépenses 6 mois']}
                    labelFormatter={(label: any) => {
                      const row = filteredVehicles.find((v) => v.name === String(label));
                      return row ? `${row.name}${row.num && row.num !== '—' ? ` (#${row.num})` : ''}${row.model ? ` — ${row.model}` : ''}` : String(label);
                    }}
                    contentStyle={{
                      background: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 10,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="total" fill={barColor} radius={[0, 6, 6, 0]} maxBarSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
