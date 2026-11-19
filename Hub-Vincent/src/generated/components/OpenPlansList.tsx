import { useEffect, useState, useMemo } from 'react';
import { Loader2, Search, FileSpreadsheet } from 'lucide-react';
import { getPlans } from '@generated/server/vehicles';
import { useXlsxExport } from '../../skills/xlsx-export';
import { toast } from 'sonner';

type Plan = Awaited<ReturnType<typeof getPlans>>['items'][number];

const tone = (s: string) =>
  s === 'Bloqué' ? 'bg-destructive/15 text-destructive'
  : s === 'Fait' ? 'bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]'
  : 'bg-[hsl(var(--brand-orange))]/15 text-foreground';

export default function OpenPlansList({ kind }: { kind: 'open' | 'done' }) {
  const [items, setItems] = useState<Plan[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [exporting, setExporting] = useState(false);
  const { exportToXlsx } = useXlsxExport();

  useEffect(() => {
    getPlans({ data: { kind } })
      .then((r) => { setItems(r?.items ?? []); setCursor(r?.cursor ?? null); })
      .catch((e) => { console.error(e); setError('Impossible de charger les plans d’action.'); })
      .finally(() => setLoading(false));
  }, [kind]);

  const more = async () => {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const r = await getPlans({ data: { kind, cursor } });
      setItems((p) => [...p, ...(r?.items ?? [])]);
      setCursor(r?.cursor ?? null);
    } catch (e) { console.error(e); setError('Chargement interrompu.'); }
    finally { setLoadingMore(false); }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (p) =>
        (p.immat && p.immat.toLowerCase().includes(q)) ||
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.action && p.action.toLowerCase().includes(q)) ||
        (p.zone && p.zone.toLowerCase().includes(q)) ||
        (p.statut && p.statut.toLowerCase().includes(q))
    );
  }, [items, query]);

  const handleExport = async () => {
    if (items.length === 0) return;
    setExporting(true);
    try {
      const rows = items.map((p) => [
        p.immat || '—',
        p.name || '—',
        p.zone || '—',
        p.action || '—',
        p.date ? new Date(p.date).toLocaleDateString('fr-FR') : '—',
        p.statut || '—',
      ]);

      await exportToXlsx(
        {
          sheetName: kind === 'open' ? 'Plans en cours' : 'Plans réalisés',
          columns: ['Immatriculation', 'Motif / Titre', 'Zone / Organe', 'Action à mener', 'Date', 'Statut'],
          rows,
          columnWidths: { 0: 18, 1: 30, 2: 25, 3: 45, 4: 15, 5: 18 },
        },
        `Plans_action_${kind === 'open' ? 'en_cours' : 'faits'}_${new Date().toISOString().slice(0, 10)}.xlsx`
      );
      toast.success('Export Excel téléchargé avec succès !');
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de l’export Excel.');
    } finally {
      setExporting(false);
    }
  };

  if (loading) return (
    <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-14 animate-pulse rounded-[var(--radius-md)] bg-muted" />)}</div>
  );
  if (error && items.length === 0) return <p className="text-sm text-destructive">{error}</p>;
  if (items.length === 0) return <p className="text-sm text-muted-foreground">Aucun plan d’action sur cette période.</p>;

  return (
    <div className="space-y-3">
      {/* Barre d'outils Recherche & Export Excel */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher par immat, panne, action…"
            className="w-full rounded-[var(--radius-md)] border border-border bg-background py-1.5 pl-9 pr-3 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-[var(--radius-md)] border border-border bg-background px-3 text-xs font-semibold text-foreground transition hover:bg-muted disabled:opacity-60 shadow-xs"
        >
          {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />}
          Exporter en Excel
        </button>
      </div>

      {filtered.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted-foreground">Aucun plan d'action ne correspond à votre recherche.</p>
      ) : (
        <ul className="divide-y divide-border rounded-[var(--radius-md)] border border-border bg-card">
          {filtered.map((p) => (
            <li key={p.id} className="flex flex-col gap-1 p-3 sm:flex-row sm:items-center sm:gap-4 transition hover:bg-muted/40">
              <span className="w-28 shrink-0 font-mono text-sm font-bold">{p.immat || '—'}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{p.name}{p.zone && <span className="font-normal text-muted-foreground"> · {p.zone}</span>}</p>
                {p.action && <p className="truncate text-xs text-muted-foreground">{p.action}</p>}
              </div>
              <span className="text-xs text-muted-foreground">{p.date ? new Date(p.date).toLocaleDateString('fr-FR') : '—'}</span>
              {p.statut && <span className={`w-fit rounded-full px-2 py-0.5 text-xs font-semibold ${tone(p.statut)}`}>{p.statut}</span>}
            </li>
          ))}
        </ul>
      )}

      {cursor && (
        <button type="button" onClick={more} disabled={loadingMore}
          className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-md)] border border-border px-4 text-sm font-semibold hover:bg-muted disabled:opacity-60">
          {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />} Afficher plus
        </button>
      )}
    </div>
  );
}
