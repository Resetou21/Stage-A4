import { useEffect, useMemo, useRef, useState } from 'react';
import { normalize } from '@generated/lib/normalize';
import { toast } from 'sonner';
import { getInventoryDue, updateInventoryValue, validateInventory } from '@generated/server/inventory';
import { Building2, Check, CheckCircle2, AlertCircle, Loader2, LayoutGrid, Table, Layers, FileText, X, ExternalLink } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogClose } from '@components/ui/dialog';

type Due = Awaited<ReturnType<typeof getInventoryDue>>;
type Product = Due['sites'][number]['products'][number];
type InvKey = Parameters<typeof updateInventoryValue>[0]['data']['key'];

function Cell({
  itemId,
  product,
  onDraftChange,
  onRegisterSave,
  onSaved,
  layout = 'table',
}: {
  itemId: string;
  product: Product;
  onDraftChange: (v: number | null) => void;
  onRegisterSave: (p: Promise<void>) => void;
  onSaved: (v: number | null) => void;
  layout?: 'table' | 'fiche';
}) {
  const [val, setVal] = useState(product.inventaire?.toString() ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setVal(product.inventaire?.toString() ?? '');
  }, [product.inventaire]);

  const handleChange = (raw: string) => {
    setVal(raw);
    const trimmed = raw.trim().replace(',', '.');
    if (trimmed === '') {
      onDraftChange(null);
      return;
    }
    const parsed = Number(trimmed);
    if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
      onDraftChange(parsed);
    }
  };

  const save = () => {
    const trimmed = val.trim().replace(',', '.');
    const next = trimmed === '' ? null : Number(trimmed);
    if (next !== null && (Number.isNaN(next) || !Number.isFinite(next))) {
      toast.error('Valeur invalide');
      const fallback = product.inventaire?.toString() ?? '';
      setVal(fallback);
      onDraftChange(product.inventaire ?? null);
      return;
    }
    onDraftChange(next);
    if (next === product.inventaire) return;
    const prev = product.inventaire;
    onSaved(next);
    setSaving(true);
    const savePromise = (async () => {
      try {
        await updateInventoryValue({ data: { itemId, key: product.key as InvKey, value: next } });
      } catch (e) {
        console.error(e);
        onSaved(prev);
        onDraftChange(prev ?? null);
        setVal(prev?.toString() ?? '');
        toast.error("Échec de l'enregistrement");
      } finally {
        setSaving(false);
      }
    })();
    onRegisterSave(savePromise);
  };

  const isFilled = val.trim() !== '';

  if (layout === 'fiche') {
    return (
      <div className="flex items-center gap-2">
        <div className="relative">
          <input
            type="text"
            inputMode="decimal"
            value={val}
            onChange={(e) => handleChange(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            aria-label={product.name}
            placeholder="—"
            className={`h-11 w-24 sm:w-28 rounded-xl border-2 text-center text-sm font-extrabold tabular-nums transition-all focus:outline-none focus:ring-2 focus:ring-primary ${
              isFilled
                ? 'border-emerald-500 bg-emerald-50/50 text-emerald-950 dark:bg-emerald-950/20 dark:text-emerald-300'
                : 'border-destructive/80 bg-destructive/5 text-destructive placeholder:text-destructive/50'
            } ${saving ? 'opacity-60 animate-pulse' : ''}`}
          />
        </div>
        <div className="w-5 flex items-center justify-center">
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          ) : isFilled ? (
            <span className="text-emerald-600 font-bold text-sm">✓</span>
          ) : (
            <span className="text-destructive/60 font-bold text-xs" title="Quantité à renseigner">•</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      value={val}
      onChange={(e) => handleChange(e.target.value)}
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
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);

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

  const draftsRef = useRef<Record<string, Record<string, number | null>>>({});
  const pendingSavesRef = useRef<Record<string, Set<Promise<void>>>>({});

  const setDraftValue = (siteId: string, key: string, v: number | null) => {
    if (!draftsRef.current[siteId]) draftsRef.current[siteId] = {};
    draftsRef.current[siteId][key] = v;
  };

  const registerSave = (siteId: string, p: Promise<void>) => {
    if (!pendingSavesRef.current[siteId]) pendingSavesRef.current[siteId] = new Set();
    pendingSavesRef.current[siteId].add(p);
    p.finally(() => {
      pendingSavesRef.current[siteId]?.delete(p);
    });
  };

  const [validating, setValidating] = useState<string | null>(null);
  const toggleValid = async (siteId: string, v: boolean) => {
    if (!v || validating) return;
    // Si un champ de saisie a encore le focus, forcer son enregistrement avant de lire les valeurs
    if (document.activeElement instanceof HTMLInputElement) {
      document.activeElement.blur();
    }
    const site = due?.sites.find((s) => s.id === siteId);
    const siteDrafts = draftsRef.current[siteId] ?? {};
    const quantities: Record<string, number> = {};
    const missing: string[] = [];
    for (const p of site?.products ?? []) {
      const hasDraft = Object.prototype.hasOwnProperty.call(siteDrafts, p.key);
      const val = hasDraft ? siteDrafts[p.key] : p.inventaire;
      if (typeof val === 'number' && Number.isFinite(val)) {
        quantities[p.key] = val;
      } else {
        missing.push(p.name);
      }
    }
    if (missing.length > 0) {
      toast.error('Inventaire incomplet', { description: `Référence(s) non complétée(s) : ${missing.join(', ')}` });
      return;
    }
    const prev = due;
    setValidating(siteId);
    // Mise à jour optimiste immédiate : disparition instantanée du site
    setDue((d) => d && ({ ...d, count: Math.max(0, d.count - 1), sites: d.sites.filter((s) => s.id !== siteId) }));
    toast.loading('Validation en cours...', { id: `val-${siteId}` });
    try {
      const pending = Array.from(pendingSavesRef.current[siteId] ?? []);
      if (pending.length > 0) {
        await Promise.allSettled(pending);
      }
      await validateInventory({ data: { itemId: siteId, quantities } });
      delete draftsRef.current[siteId];
      toast.success('Inventaire validé', { id: `val-${siteId}` });
      onChanged?.();
    } catch (e) {
      console.error(e);
      setDue(prev);
      toast.error('Échec de la validation', { id: `val-${siteId}` });
    } finally {
      setValidating(null);
    }
  };

  const selectedSite = useMemo(
    () => due?.sites.find((s) => s.id === selectedSiteId) ?? null,
    [due, selectedSiteId]
  );

  const selectedSiteFilledCount = useMemo(() => {
    if (!selectedSite) return 0;
    return selectedSite.products.filter((p) => {
      const draft = draftsRef.current[selectedSite.id]?.[p.key];
      const val = draft !== undefined ? draft : p.inventaire;
      return typeof val === 'number' && Number.isFinite(val);
    }).length;
  }, [selectedSite, due]);

  const selectedSiteIsAllFilled =
    selectedSite !== null &&
    selectedSite.products.length > 0 &&
    selectedSiteFilledCount === selectedSite.products.length;

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (loading) {
    return (
      <div className="space-y-3" aria-label="Chargement">
        {['a', 'b', 'c'].map((k) => (
          <div key={k} className="h-24 animate-pulse rounded-2xl bg-muted/60 border border-border" />
        ))}
      </div>
    );
  }
  if (!due || due.sites.length === 0) {
    return null;
  }

  const filteredSites = due.sites.filter((s) => normalize(s.chantier).includes(normalize(search)));
  if (filteredSites.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* Barre d'en-tête et Sélecteur de vue Liste vs Tableau */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
        <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
          <span className="font-extrabold text-base text-foreground font-[family-name:var(--font-heading)]">
            {filteredSites.length} inventaire{filteredSites.length > 1 ? 's' : ''} à réaliser
          </span>
          <span className="bg-primary/10 text-primary font-bold px-2.5 py-0.5 rounded-full text-[11px]">
            Relevé semestriel (182 j)
          </span>
        </div>

        {/* Bascule Liste de chantiers / Tableau complet */}
        <div className="inline-flex items-center gap-1 bg-muted p-1 rounded-xl self-start sm:self-auto shrink-0 shadow-2xs">
          <button
            type="button"
            onClick={() => setViewMode('cards')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'cards'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5 text-primary" />
            <span>📋 Liste des chantiers</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'table'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Table className="h-3.5 w-3.5" />
            <span>📊 Vue Tableau ({columns.length} col.)</span>
          </button>
        </div>
      </div>

      {/* 1. VUE LISTE DE CHANTIERS (CLIQUEZ SUR UN CHANTIER -> OUVRE LA POP-UP) */}
      {viewMode === 'cards' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredSites.map((s) => {
            const filledCount = s.products.filter((p) => {
              const draft = draftsRef.current[s.id]?.[p.key];
              const val = draft !== undefined ? draft : p.inventaire;
              return typeof val === 'number' && Number.isFinite(val);
            }).length;
            const isAllFilled = filledCount === s.products.length && s.products.length > 0;

            return (
              <div
                key={s.id}
                onClick={() => setSelectedSiteId(s.id)}
                className={`group rounded-2xl border-2 transition-all p-4 bg-card hover:bg-muted/20 cursor-pointer shadow-xs flex flex-col justify-between gap-3.5 ${
                  isAllFilled
                    ? 'border-emerald-500/50 hover:border-emerald-500'
                    : 'border-border/80 hover:border-primary/50'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`flex h-11 w-11 items-center justify-center rounded-xl font-bold shrink-0 shadow-xs ${
                        isAllFilled
                          ? 'bg-emerald-500/15 text-emerald-600'
                          : 'bg-primary/10 text-primary'
                      }`}
                    >
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-extrabold text-base text-foreground tracking-tight truncate group-hover:text-primary transition-colors">
                        {s.chantier}
                      </h4>
                      <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground font-medium">
                        <Layers className="h-3 w-3 text-primary" />
                        <span>{s.products.length} référence{s.products.length > 1 ? 's' : ''} sous contrat</span>
                      </div>
                    </div>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-md text-[11px] shrink-0 ${
                      isAllFilled
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                    }`}
                  >
                    {isAllFilled ? (
                      <>
                        <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                        Prêt
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-3 w-3 text-amber-600" />
                        {filledCount} / {s.products.length}
                      </>
                    )}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border/60 text-xs">
                  <span className="text-muted-foreground text-[11px]">
                    Cliquer pour ouvrir la fiche
                  </span>
                  <span className="font-bold text-primary inline-flex items-center gap-1 text-xs group-hover:translate-x-0.5 transition-transform">
                    <FileText className="h-3.5 w-3.5" />
                    <span>Saisir l'inventaire →</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* 2. VUE TABLEAU BRUT HISTORIQUE AVEC LIENS VERS POP-UP */
        <div className={`overflow-x-auto rounded-[var(--radius-md)] border border-border shadow-sm transition-opacity ${refetching ? 'opacity-60' : ''}`} aria-busy={refetching}>
          <table className="w-full min-w-max text-left text-sm">
            <thead className="bg-muted/70 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-semibold">Validé</th>
                <th className="bg-muted px-3 py-2 font-semibold sticky left-0 z-10 shadow-xs">Site (Cliquer = Fiche)</th>
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
                  <td className="bg-card px-3 py-2 font-semibold sticky left-0 z-10 shadow-xs">
                    <button
                      type="button"
                      onClick={() => setSelectedSiteId(s.id)}
                      className="hover:text-primary hover:underline font-bold text-left inline-flex items-center gap-1.5 cursor-pointer text-foreground"
                      title="Ouvrir la fiche d'inventaire en pop-up"
                    >
                      <span>{s.chantier}</span>
                      <ExternalLink className="h-3 w-3 text-muted-foreground opacity-60 hover:opacity-100" />
                    </button>
                  </td>
                  {columns.map((c) => {
                    const p = s.products.find((x) => x.name === c);
                    return (
                      <td key={c} className="px-3 py-2">
                        {p && (
                          <Cell
                            layout="table"
                            itemId={s.id}
                            product={p}
                            onDraftChange={(v) => setDraftValue(s.id, p.key, v)}
                            onRegisterSave={(prom) => registerSave(s.id, prom)}
                            onSaved={(v) => setValue(s.id, c, v)}
                          />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 3. MODALE POP-UP DÉDIÉE : FICHE D'INVENTAIRE DU SITE SÉLECTIONNÉ */}
      <Dialog open={!!selectedSite} onOpenChange={(open) => !open && setSelectedSiteId(null)}>
        <DialogContent className="max-w-2xl w-full p-0 overflow-hidden flex flex-col max-h-[88vh]">
          {/* En-tête de la Pop-up */}
          <div className="p-4 sm:p-5 border-b border-border bg-card/95 flex items-center justify-between gap-3 shrink-0 pr-12">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Building2 className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="font-extrabold text-base sm:text-lg text-foreground truncate">
                  {selectedSite?.chantier}
                </DialogTitle>
                <div className="text-[11px] text-muted-foreground font-semibold flex items-center gap-2 mt-0.5 flex-wrap">
                  <span>Fiche d'inventaire consommables</span>
                  <span>•</span>
                  <span className="text-primary font-bold">
                    {selectedSite?.products.length} référence{selectedSite && selectedSite.products.length > 1 ? 's' : ''} sous contrat
                  </span>
                </div>
              </div>
            </div>

            {selectedSite && (
              <div className="shrink-0 hidden sm:block">
                <span
                  className={`inline-flex items-center gap-1 font-bold px-2.5 py-1 rounded-lg text-xs ${
                    selectedSiteIsAllFilled
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                  }`}
                >
                  {selectedSiteIsAllFilled ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      Prêt à valider
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                      {selectedSiteFilledCount} / {selectedSite.products.length} saisie(s)
                    </>
                  )}
                </span>
              </div>
            )}
          </div>

          {/* Corps de la Pop-up : Liste verticale des produits sous contrat */}
          {selectedSite && (
            <div className="p-4 sm:p-6 flex-1 overflow-y-auto space-y-3 pb-24 sm:pb-8">
              <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                <span>Références sous contrat hygiène :</span>
                <span className="text-[10px] lowercase italic text-muted-foreground/70">
                  Enregistrement automatique dès la saisie
                </span>
              </div>

              <div className="divide-y divide-border/60 rounded-xl border border-border bg-card overflow-hidden shadow-2xs">
                {selectedSite.products.map((p) => (
                  <div
                    key={p.name}
                    className="p-3.5 flex items-center justify-between gap-3 hover:bg-muted/30 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-extrabold text-sm text-foreground truncate" title={p.name}>
                        {p.name}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        Sous contrat hygiène
                      </div>
                    </div>

                    <div className="shrink-0">
                      <Cell
                        layout="fiche"
                        itemId={selectedSite.id}
                        product={p}
                        onDraftChange={(v) => {
                          setDraftValue(selectedSite.id, p.key, v);
                          setValue(selectedSite.id, p.name, v);
                        }}
                        onRegisterSave={(prom) => registerSave(selectedSite.id, prom)}
                        onSaved={(v) => setValue(selectedSite.id, p.name, v)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer fixe de la Pop-up */}
          {selectedSite && (
            <div className="p-3.5 sm:p-4 border-t border-border bg-card/95 flex items-center justify-between gap-3 shrink-0">
              <DialogClose asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-muted/60 hover:bg-muted text-foreground px-4 py-2.5 text-xs font-bold transition cursor-pointer"
                >
                  <X className="h-4 w-4" />
                  <span>Fermer</span>
                </button>
              </DialogClose>

              <button
                type="button"
                disabled={validating !== null}
                onClick={async () => {
                  const id = selectedSite.id;
                  await toggleValid(id, true);
                  setSelectedSiteId(null);
                }}
                className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs sm:text-sm font-bold shadow-sm transition cursor-pointer disabled:opacity-60 ${
                  selectedSiteIsAllFilled
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20'
                    : 'bg-primary hover:bg-primary/95 text-primary-foreground'
                }`}
              >
                {validating === selectedSite.id ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Validation en cours...</span>
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 stroke-[3]" />
                    <span>Valider l'inventaire</span>
                  </>
                )}
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
