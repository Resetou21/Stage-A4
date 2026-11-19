import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { getPlans } from '@generated/server/vehicles';

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

  if (loading) return (
    <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-14 animate-pulse rounded-[var(--radius-md)] bg-muted" />)}</div>
  );
  if (error && items.length === 0) return <p className="text-sm text-destructive">{error}</p>;
  if (items.length === 0) return <p className="text-sm text-muted-foreground">Aucun plan d’action sur cette période.</p>;

  return (
    <div>
      <ul className="divide-y divide-border rounded-[var(--radius-md)] border border-border">
        {items.map((p) => (
          <li key={p.id} className="flex flex-col gap-1 p-3 sm:flex-row sm:items-center sm:gap-4">
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
      {cursor && (
        <button type="button" onClick={more} disabled={loadingMore}
          className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-md)] border border-border px-4 text-sm font-semibold hover:bg-muted disabled:opacity-60">
          {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />} Afficher plus
        </button>
      )}
    </div>
  );
}
