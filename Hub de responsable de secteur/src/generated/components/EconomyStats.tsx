import { useEffect, useMemo, useState } from 'react';
import InfoTip from '@generated/components/InfoTip';
import { BarChart3 } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@components/ui/dialog';
import { getEconomies } from '@generated/server/inventory';

type Eco = Awaited<ReturnType<typeof getEconomies>>;
type Kind = 'directe' | 'contrat';
type ViewMode = 'cumul' | 'dernier';

const fmt = (n: number) =>
  n.toLocaleString('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function EconomyStats({ firstName, refreshKey = 0 }: { firstName: string; refreshKey?: number }) {
  const [data, setData] = useState<Eco | null>(null);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState<Kind | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('cumul');
  const [modalMode, setModalMode] = useState<ViewMode>('cumul');

  useEffect(() => {
    let active = true;
    getEconomies({ data: { firstName } })
      .then((r) => {
        if (active) {
          setData(
            r ?? {
              cumulDirecte: 0,
              cumulDouzeMois: 0,
              dernierDirecte: 0,
              dernierDouzeMois: 0,
              directe: 0,
              douzeMois: 0,
              year: new Date().getFullYear(),
              passagesCount: 0,
              sitesDernier: [],
              sitesCumul: [],
              sites: [],
            }
          );
        }
      })
      .catch((e) => {
        console.error(e);
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [firstName, refreshKey]);

  // Année dynamique et scalable (s'adapte automatiquement à 2026, 2027, 2028, etc.)
  const year = data?.year ?? new Date().getFullYear();

  const items: {
    kind: Kind;
    label: string;
    activeValue: number | undefined;
    tooltipText: string;
  }[] = [
    {
      kind: 'directe',
      label: 'Économie directe',
      activeValue: viewMode === 'cumul' ? data?.cumulDirecte : data?.dernierDirecte,
      tooltipText:
        viewMode === 'cumul'
          ? `Total financier cumulé des stocks excédentaires récupérés sur tous les passages de l'exercice ${year}.`
          : 'Valeur financière du stock excédentaire au tout dernier relevé en date de chaque site.',
    },
    {
      kind: 'contrat',
      label: 'Économie contrat (12 mois)',
      activeValue: viewMode === 'cumul' ? data?.cumulDouzeMois : data?.dernierDouzeMois,
      tooltipText:
        viewMode === 'cumul'
          ? `Projection annuelle cumulée des avenants de contrats générés sur tous les passages de l'exercice ${year}.`
          : 'Projection annuelle des avenants préconisés au tout dernier relevé en date de chaque site.',
    },
  ];

  const current = items.find((i) => i.kind === open);

  // Données du graphique dans la modale selon le mode choisi (Cumul ou Dernier relevé)
  const chartData = useMemo(() => {
    if (!open || !data) return [];
    const siteList = modalMode === 'cumul' ? (data.sitesCumul || data.sites) : (data.sitesDernier || data.sites);
    const map = new Map<string, number>();
    siteList.forEach((s) => {
      const val = open === 'directe' ? s.directe : s.contrat;
      map.set(s.name, (map.get(s.name) ?? 0) + val);
    });

    return [...map.entries()]
      .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
      .filter((d) => d.value !== 0)
      .sort((a, b) => b.value - a.value);
  }, [open, data, modalMode]);

  // Valeur totale affichée dans le titre de la modale selon le mode actif
  const modalTotal = useMemo(() => {
    if (!open || !data) return 0;
    if (modalMode === 'cumul') {
      return open === 'directe' ? data.cumulDirecte : data.cumulDouzeMois;
    }
    return open === 'directe' ? data.dernierDirecte : data.dernierDouzeMois;
  }, [open, data, modalMode]);

  return (
    <div className="mt-8 space-y-3">
      {/* Contrôle en haut avec explication claire et sélecteur dynamique */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Indicateurs financiers consommables
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {viewMode === 'cumul'
              ? `Cumul global de tous les inventaires réalisés sur l'exercice ${year} (total gagné)`
              : `Situation instantanée basée sur le dernier relevé de chaque site`}
          </p>
        </div>

        {/* Sélecteur scalable qui s'adapte à chaque année */}
        <div className="inline-flex items-center rounded-lg border border-border bg-muted/50 p-1 text-xs">
          <button
            type="button"
            onClick={() => setViewMode('cumul')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
              viewMode === 'cumul'
                ? 'bg-card text-primary font-bold shadow-xs border border-border/80'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span>Cumul {year} (Total gagné)</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('dernier')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
              viewMode === 'dernier'
                ? 'bg-card text-primary font-bold shadow-xs border border-border/80'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span>Dernier inventaire (Situation actuelle)</span>
          </button>
        </div>
      </div>

      {/* Cartes KPI épurées (sans aucun texte superflu en bas) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {items.map((it) => (
          <div
            key={it.label}
            className="relative rounded-[var(--radius-md)] border border-border bg-card px-5 py-4 transition-all hover:border-primary/30 shadow-xs"
          >
            <div className="flex items-center gap-1 pr-12">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{it.label}</p>
              <InfoTip label={it.label} text={it.tooltipText} />
            </div>

            <p className="mt-1 text-3xl font-extrabold tabular-nums text-primary tracking-tight">
              {error ? (
                '—'
              ) : it.activeValue === undefined ? (
                <span className="inline-block h-8 w-32 animate-pulse rounded bg-muted align-middle" />
              ) : (
                fmt(it.activeValue)
              )}
            </p>

            <button
              type="button"
              onClick={() => {
                setOpen(it.kind);
                setModalMode(viewMode);
              }}
              disabled={!data}
              aria-label={`Voir le détail par site : ${it.label}`}
              title="Afficher le graphique détaillé par chantier"
              className="absolute right-3 top-3 inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-sm)] text-primary hover:bg-primary/10 transition-colors disabled:opacity-40"
            >
              <BarChart3 className="h-5 w-5" />
            </button>
          </div>
        ))}
      </div>

      {/* Modale Recharts avec détail par site et switch intégré (Image 1) */}
      <Dialog
        open={open !== null}
        onOpenChange={(o) => {
          if (!o) setOpen(null);
        }}
      >
        <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-6xl">
          <DialogHeader className="pb-3 border-b border-border">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pr-6">
              <div>
                <DialogTitle className="text-base font-bold text-foreground">
                  {current?.label} — {fmt(modalTotal)}
                </DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Répartition par chantier en mode{' '}
                  <span className="font-semibold text-foreground">
                    {modalMode === 'cumul' ? `Cumul Annuel ${year}` : 'Dernier Relevé'}
                  </span>
                </p>
              </div>

              {/* Sélecteur Cumul / Dernier relevé à l'intérieur de la modale */}
              <div className="inline-flex items-center rounded-md border border-border bg-muted/60 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setModalMode('cumul')}
                  className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                    modalMode === 'cumul'
                      ? 'bg-card text-foreground font-semibold shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Cumul {year}
                </button>
                <button
                  type="button"
                  onClick={() => setModalMode('dernier')}
                  className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                    modalMode === 'dernier'
                      ? 'bg-card text-foreground font-semibold shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Dernier relevé
                </button>
              </div>
            </div>
          </DialogHeader>

          {chartData.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Aucune économie enregistrée pour cette vue ({modalMode === 'cumul' ? `Cumul ${year}` : 'Dernier relevé'}).
            </p>
          ) : (
            <div className="max-h-[75vh] overflow-y-auto pt-3">
              <div style={{ height: Math.max(220, chartData.length * 52) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    layout="vertical"
                    margin={{ left: 8, right: 96, top: 8, bottom: 8 }}
                    barCategoryGap={8}
                  >
                    <CartesianGrid horizontal={false} stroke="hsl(var(--border))" />
                    <XAxis type="number" tickFormatter={(v: number) => `${v} €`} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={260} tick={{ fontSize: 13 }} interval={0} />
                    <Tooltip
                      formatter={(v: number) => [fmt(Number(v)), current?.label ?? '']}
                      labelFormatter={(l: string) => l}
                      cursor={{ fill: 'hsl(var(--muted))' }}
                    />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={32}>
                      <LabelList
                        dataKey="value"
                        position="right"
                        formatter={(v: number) => fmt(Number(v))}
                        className="fill-foreground text-xs font-semibold"
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
