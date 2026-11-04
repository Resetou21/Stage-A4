import { useEffect, useMemo, useState } from 'react';
import { normalize } from '@generated/lib/normalize';
import { toast } from 'sonner';
import { getInventoryDue, updateInventoryValue, validateInventory } from '@generated/server/inventory';

type Due = Awaited<ReturnType<typeof getInventoryDue>>;
type Product = Due['sites'][number]['products'][number];
type InvKey = Parameters<typeof updateInventoryValue>[0]['data']['key'];

function Cell({ itemId, product, onSaved }: { itemId: string; product: Product; onSaved: (v: number | null) => void }) {
  const [val, setVal] = useState(product.inventaire?.toString() ?? '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const trimmed = val.trim().replace(',', '.');
    const next = trimmed === '' ? null : Number(trimmed);
    if (next !== null && Number.isNaN(next)) { toast.error('Valeur invalide'); setVal(product.inventaire?.toString() ?? ''); return; }
    if (next === product.inventaire) return;
    const prev = product.inventaire;
    onSaved(next);
    setSaving(true);
    try {
      await updateInventoryValue({ data: { itemId, key: product.key as InvKey, value: next } });
    } catch (e) {
      console.error(e);
      onSaved(prev);
      setVal(prev?.toString() ?? '');
      toast.error("Échec de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      aria-label={product.name}
      placeholder="—"
      className={`h-10 w-20 rounded-[var(--radius-sm)] border-2 ${val.trim() === '' ? 'border-destructive' : 'border-[hsl(var(--success))]'} bg-background px-2 text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-ring ${saving ? 'opacity-60' : ''}`}
    />
  );
}

export default function InventoryDue({ firstName, onChanged, search = '', preloaded = null }: { firstName: string; onChanged?: () => void; search?: string; preloaded?: Due | null }) {
  const [due, setDue] = useState<Due | null>(preloaded);
  const [loading, setLoading] = useState(!preloaded);
  const [refetching, setRefetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (preloaded) {
      setDue(preloaded);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    getInventoryDue({ data: { firstName } })
      .then((r) => { if (active) setDue(r ?? null); })
      .catch((e) => { console.error(e); if (active) setError('Impossible de charger les inventaires à faire.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [firstName, preloaded]);

  const refresh = async () => {
    setRefetching(true);
    try {
      const r = await getInventoryDue({ data: { firstName } });
      if (r) setDue(r);
    } catch (e) {
      console.error(e);
      toast.error('Impossible de rafraîchir le tableau');
    } finally {
      setRefetching(false);
    }
  };

  const columns = useMemo(() => {
    const set: string[] = [];
    due?.sites.forEach((s) => s.products.forEach((p) => { if (!set.includes(p.name)) set.push(p.name); }));
    const order = due?.order ?? [];
    return set.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  }, [due]);

  const setValue = (siteId: string, name: string, v: number | null) =>
    setDue((d) => d && ({
      ...d,
      sites: d.sites.map((s) => s.id !== siteId ? s : { ...s, products: s.products.map((p) => p.name === name ? { ...p, inventaire: v } : p) }),
    }));

  const [validating, setValidating] = useState<string | null>(null);
  const toggleValid = async (siteId: string, v: boolean) => {
    if (!v || validating) return;
    const site = due?.sites.find((s) => s.id === siteId);
    const missing = site?.products.filter((p) => p.inventaire === null).map((p) => p.name) ?? [];
    if (missing.length > 0) {
      toast.error('Inventaire incomplet', { description: `Référence(s) non complétée(s) : ${missing.join(', ')}` });
      return;
    }
    const prev = due;
    setValidating(siteId);
    // Mise à jour optimiste immédiate : disparition instantanée de la ligne
    setDue((d) => d && ({ ...d, count: Math.max(0, d.count - 1), sites: d.sites.filter((s) => s.id !== siteId) }));
    toast.loading('Validation en cours...', { id: `val-${siteId}` });
    try {
      await validateInventory({ data: { itemId: siteId } });
      toast.success('Inventaire validé', { id: `val-${siteId}` });
      onChanged?.();
      void refresh();
    } catch (e) {
      console.error(e);
      setDue(prev);
      toast.error('Échec de la validation', { id: `val-${siteId}` });
    } finally {
      setValidating(null);
    }
  };

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (loading) {
    return (
      <div className="space-y-2" aria-label="Chargement">
        {['a', 'b', 'c', 'd'].map((k) => <div key={k} className="h-10 animate-pulse rounded bg-muted" />)}
      </div>
    );
  }
  if (!due || due.sites.length === 0) {
    return null;
  }

  const filteredSites = due.sites.filter((s) => normalize(s.chantier).includes(normalize(search)));
  if (filteredSites.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">
          {filteredSites.length} inventaire(s) à réaliser
        </span>
        <span className="hidden sm:inline-flex items-center gap-1 text-[11px] bg-muted/60 px-2 py-0.5 rounded-full">
          Défiler vers la droite pour voir les colonnes produits →
        </span>
      </div>
      <div className={`overflow-x-auto rounded-[var(--radius-md)] border border-border shadow-sm transition-opacity ${refetching ? 'opacity-60' : ''}`} aria-busy={refetching}>
        <table className="w-full min-w-max text-left text-sm">
          <thead className="bg-muted/70 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-semibold">Validé</th>
              <th className="bg-muted px-3 py-2 font-semibold">Site</th>
              {columns.map((c) => <th key={c} className="px-3 py-2 font-semibold">{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {filteredSites.map((s) => (
              <tr key={s.id} className="border-t border-border hover:bg-muted/30">
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={validating === s.id}
                    disabled={validating !== null}
                    onChange={(e) => toggleValid(s.id, e.target.checked)}
                    aria-label={`Valider l'inventaire de ${s.chantier}`}
                    className="h-5 w-5 cursor-pointer accent-[hsl(var(--primary))]"
                  />
                </td>
                <td className="bg-card px-3 py-2 font-semibold">{s.chantier}</td>
                {columns.map((c) => {
                  const p = s.products.find((x) => x.name === c);
                  return (
                    <td key={c} className="px-3 py-2">
                      {p && <Cell itemId={s.id} product={p} onSaved={(v) => setValue(s.id, c, v)} />}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
