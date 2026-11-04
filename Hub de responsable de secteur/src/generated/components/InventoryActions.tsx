import { useEffect, useState } from 'react';
import { Info } from 'lucide-react';
import { normalize } from '@generated/lib/normalize';
import { toast } from 'sonner';
import { getInventoryActions, markActionDone } from '@generated/server/inventory';

type Actions = Awaited<ReturnType<typeof getInventoryActions>>;
type ActionRow = Actions['rows'][number];

export default function InventoryActions({ firstName, onChanged, search = '', preloaded = null }: { firstName: string; onChanged?: (doneId?: string) => void; search?: string; preloaded?: Actions | null }) {
  const [data, setData] = useState<Actions | null>(preloaded);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(!preloaded);
  const [error, setError] = useState<string | null>(null);

  const markDone = async (r: ActionRow) => {
    if (busyIds.has(r.id)) return;
    const prev = data;
    setBusyIds((s) => new Set(s).add(r.id));
    setCheckedIds((s) => new Set(s).add(r.id));
    setCompletedIds((s) => new Set(s).add(r.id));

    // Suppression optimiste avec un léger délai pour que l'utilisateur voie la case cochée
    setTimeout(() => {
      setData((d) => d && ({ ...d, count: Math.max(0, d.count - 1), rows: d.rows.filter((x) => x.id !== r.id) }));
    }, 150);

    try {
      await markActionDone({ data: { itemId: r.itemId, itemIds: r.itemIds, type: r.type, done: true } });
      onChanged?.(r.id);
      toast.success(`Action "${r.type}" enregistrée`);
    } catch (e) {
      console.error(e);
      setData(prev);
      setCheckedIds((s) => {
        const next = new Set(s);
        next.delete(r.id);
        return next;
      });
      setCompletedIds((s) => {
        const next = new Set(s);
        next.delete(r.id);
        return next;
      });
      toast.error("Échec de l'enregistrement");
    } finally {
      setBusyIds((s) => {
        const next = new Set(s);
        next.delete(r.id);
        return next;
      });
    }
  };

  useEffect(() => {
    if (preloaded) {
      const remainingRows = preloaded.rows.filter((x) => !completedIds.has(x.id));
      setData({
        ...preloaded,
        rows: remainingRows,
        count: remainingRows.length,
      });
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    getInventoryActions({ data: { firstName } })
      .then((r) => {
        if (active && r) {
          const remainingRows = r.rows.filter((x) => !completedIds.has(x.id));
          setData({
            ...r,
            rows: remainingRows,
            count: remainingRows.length,
          });
        }
      })
      .catch((e) => { console.error(e); if (active) setError('Impossible de charger les actions.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [firstName, preloaded]);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (loading) {
    return (
      <div className="space-y-2" aria-label="Chargement">
        {['a', 'b', 'c'].map((k) => <div key={k} className="h-10 animate-pulse rounded bg-muted" />)}
      </div>
    );
  }
  if (!data || data.rows.length === 0) {
    return null;
  }

  const filteredRows = (data?.rows || [])
    .filter((r) => !completedIds.has(r.id))
    .filter((r) => normalize(r.chantier).includes(normalize(search)))
    .sort((a, b) => (a.type === b.type ? 0 : a.type === 'À récupérer' ? -1 : 1));

  if (filteredRows.length === 0) return null;

  const totalRefs = filteredRows.reduce((sum, r) => sum + r.values.length, 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">
          {filteredRows.length} chantier(s) concerné(s) — {totalRefs} référence(s) à traiter
        </span>
        <span className="hidden sm:inline-flex items-center gap-1 text-[11px] bg-muted/60 px-2 py-0.5 rounded-full">
          Défiler vers la droite pour voir les colonnes produits →
        </span>
      </div>
      <div className="overflow-x-auto rounded-[var(--radius-md)] border border-border shadow-sm">
        <table className="w-full min-w-max text-center text-sm">
          <thead className="bg-muted/70 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-semibold">Réalisé (Réf.)</th>
              <th className="px-3 py-2 font-semibold text-left">Site</th>
              <th className="px-3 py-2 font-semibold">Type</th>
              {data.columns.map((c) => (
                <th key={c} className="px-3 py-2 font-semibold">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((r) => (
              <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                <td className="px-3 py-2.5">
                  <div className="flex items-center justify-center gap-2">
                    <input
                      type="checkbox"
                      checked={checkedIds.has(r.id)}
                      disabled={busyIds.has(r.id)}
                      onChange={(e) => {
                        if (e.target.checked) void markDone(r);
                      }}
                      aria-label={`Marquer ${r.type} réalisé pour ${r.chantier}`}
                      className="h-5 w-5 cursor-pointer accent-[hsl(var(--primary))]"
                    />
                    <span
                      className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/10 px-1.5 text-[11px] font-bold text-primary tabular-nums"
                      title={`${r.values.length} référence(s) concernée(s)`}
                    >
                      {r.values.length}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2.5 font-semibold text-left">{r.chantier}</td>
                <td className="px-3 py-2.5">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold cursor-help transition-opacity hover:opacity-90 ${
                      r.type === 'Avenant'
                        ? 'bg-secondary text-secondary-foreground'
                        : 'bg-[hsl(var(--success)/0.18)] text-[hsl(var(--success))]'
                    }`}
                    title={
                      r.type === 'Avenant'
                        ? 'Avenant de diminution à faire (Attention : le nombre indiqué est le nombre annuel = revoir contrat)'
                        : 'À récupérer sur site'
                    }
                  >
                    <span>{r.type}</span>
                    <Info className="h-3.5 w-3.5 opacity-80 shrink-0" />
                  </span>
                </td>
                {data.columns.map((c) => (
                  <td key={c} className="px-3 py-2.5 tabular-nums">
                    {r.values.find((v) => v.name === c)?.value ?? ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
