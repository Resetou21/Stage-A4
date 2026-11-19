import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { getLosses } from '@generated/server/direction';

type Loss = Awaited<ReturnType<typeof getLosses>>['items'][number];
export const eur = (n: number) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

export default function LossesList({ categories, kind = 'loss' }: { categories: { label: string; total: number }[]; kind?: 'loss' | 'gain' }) {
  const [items, setItems] = useState<Loss[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      {loading ? (
        <div className="space-y-2">{['a', 'b', 'c'].map((k) => <div key={k} className="h-14 animate-pulse rounded-[var(--radius-md)] bg-muted" />)}</div>
      ) : error && items.length === 0 ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{kind === 'gain' ? 'Aucun gain financier cette année.' : 'Aucune perte financière cette année.'}</p>
      ) : (
        <ul className="divide-y divide-border rounded-[var(--radius-md)] border border-border">
          {items.map((l) => (
            <li key={l.id} className="flex flex-col gap-1 p-3 sm:flex-row sm:items-center sm:gap-4">
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
