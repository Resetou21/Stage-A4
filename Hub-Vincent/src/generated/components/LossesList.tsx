import { useEffect, useState, useMemo } from 'react';
import { Loader2, Search, FileSpreadsheet } from 'lucide-react';
import { getLosses } from '@generated/server/direction';
import { useXlsxExport, isAndroidMondayWebView } from '../../skills/xlsx-export';
import { toast } from 'sonner';

type Loss = Awaited<ReturnType<typeof getLosses>>['items'][number];
export const eur = (n: number) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

export default function LossesList({ categories, kind = 'loss' }: { categories: { label: string; total: number }[]; kind?: 'loss' | 'gain' }) {
  const [items, setItems] = useState<Loss[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [exporting, setExporting] = useState(false);
  const { exportToXlsx } = useXlsxExport();

  useEffect(() => {
    getLosses({ data: { kind } })
      .then((r) => { setItems(r?.items ?? []); setCursor(r?.cursor ?? null); })
      .catch((e) => { console.error(e); setError('Impossible de charger le détail.'); })
      .finally(() => setLoading(false));
  }, [kind]);

  const more = async () => {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const r = await getLosses({ data: { kind, cursor } });
      setItems((p) => [...p, ...(r?.items ?? [])]);
      setCursor(r?.cursor ?? null);
    } catch (e) { console.error(e); setError('Chargement interrompu.'); }
    finally { setLoadingMore(false); }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (l) =>
        (l.name && l.name.toLowerCase().includes(q)) ||
        (l.fournisseur && l.fournisseur.toLowerCase().includes(q)) ||
        (l.categorie && l.categorie.toLowerCase().includes(q))
    );
  }, [items, query]);

  const handleExport = async () => {
    if (isAndroidMondayWebView()) {
      toast.info('Export Excel disponible depuis un navigateur PC ou Chrome.');
      return;
    }
    if (items.length === 0) return;
    setExporting(true);
    try {
      const rows = items.map((l) => [
        l.date ? new Date(l.date).toLocaleDateString('fr-FR') : '—',
        l.name || '—',
        l.fournisseur || '—',
        l.categorie || '—',
        l.montant || 0,
      ]);

      const ok = await exportToXlsx(
        {
          sheetName: kind === 'gain' ? 'Gains financiers' : 'Pertes financières',
          columns: ['Date', 'Intitulé', 'Fournisseur', 'Catégorie', 'Montant HT (€)'],
          rows,
          columnWidths: { 0: 15, 1: 35, 2: 25, 3: 25, 4: 18 },
        },
        `${kind === 'gain' ? 'Gains_financiers' : 'Cout_non_qualite'}_${new Date().toISOString().slice(0, 10)}.xlsx`
      );
      if (ok) {
        toast.success('Bilan financier exporté avec succès en Excel !');
      } else {
        toast.info('Export Excel disponible depuis un navigateur PC ou Chrome.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de l’export Excel.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <span key={c.label} className="rounded-full border border-border bg-background px-3 py-1 text-xs">
              <strong>{c.label}</strong> · {eur(c.total)}
            </span>
          ))}
        </div>
      )}

      {/* Barre de recherche et Export */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher par intitulé, fournisseur, catégorie…"
            className="w-full rounded-[var(--radius-md)] border border-border bg-background py-1.5 pl-9 pr-3 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <button
          type="button"
          onClick={handleExport}
          disabled={exporting || items.length === 0}
          className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-[var(--radius-md)] border border-border bg-background px-3 text-xs font-semibold text-foreground transition hover:bg-muted disabled:opacity-60 shadow-xs"
        >
          {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />}
          Exporter en Excel
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">{['a', 'b', 'c'].map((k) => <div key={k} className="h-14 animate-pulse rounded-[var(--radius-md)] bg-muted" />)}</div>
      ) : error && items.length === 0 ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{kind === 'gain' ? 'Aucun gain financier cette année.' : 'Aucune perte financière cette année.'}</p>
      ) : filtered.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted-foreground">Aucun résultat pour cette recherche.</p>
      ) : (
        <ul className="divide-y divide-border rounded-[var(--radius-md)] border border-border bg-card">
          {filtered.map((l) => (
            <li key={l.id} className="flex flex-col gap-1 p-3 sm:flex-row sm:items-center sm:gap-4 transition hover:bg-muted/40">
              <span className="w-24 shrink-0 text-xs text-muted-foreground">{l.date ? new Date(l.date).toLocaleDateString('fr-FR') : '—'}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{l.name}</p>
                <p className="truncate text-xs text-muted-foreground">{[l.fournisseur, l.categorie].filter(Boolean).join(' · ') || '—'}</p>
              </div>
              <span className={kind === 'gain' ? 'text-sm font-bold text-[hsl(var(--brand-blue))]' : 'text-sm font-bold text-destructive'}>{eur(l.montant)}</span>
            </li>
          ))}
        </ul>
      )}

      {cursor && (
        <button type="button" onClick={more} disabled={loadingMore}
          className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-md)] border border-border px-4 text-sm font-semibold hover:bg-muted disabled:opacity-60">
          {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />} Afficher plus
        </button>
      )}
    </div>
  );
}
