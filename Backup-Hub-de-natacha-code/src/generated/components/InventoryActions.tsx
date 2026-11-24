import { useEffect, useMemo, useState } from 'react';
import { Info, Check, Clock, Package, FileEdit, Loader2, LayoutGrid, Table, ExternalLink, X } from 'lucide-react';
import { normalize } from '@generated/lib/normalize';
import { toast } from 'sonner';
import { getInventoryActions, markActionDone, markAvenantDemande } from '@generated/server/inventory';
import { Dialog, DialogContent, DialogTitle, DialogClose } from '@components/ui/dialog';

type Actions = Awaited<ReturnType<typeof getInventoryActions>>;
type ActionRow = Actions['rows'][number];

export default function InventoryActions({
  firstName,
  onChanged,
  search = '',
  preloaded = null,
}: {
  firstName: string;
  onChanged?: (doneId?: string) => void;
  search?: string;
  preloaded?: Actions | null;
}) {
  const [data, setData] = useState<Actions | null>(preloaded);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [busyDemandeIds, setBusyDemandeIds] = useState<Set<string>>(new Set());
  const [demandeOverrides, setDemandeOverrides] = useState<Record<string, boolean>>({});
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(!preloaded);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);

  const isAvenantDemande = (r: ActionRow) =>
    demandeOverrides[r.id] !== undefined ? demandeOverrides[r.id] : Boolean(r.avenantDemande);

  const toggleAvenantDemande = async (r: ActionRow) => {
    if (busyDemandeIds.has(r.id)) return;
    const nextVal = !isAvenantDemande(r);
    setBusyDemandeIds((s) => new Set(s).add(r.id));
    setDemandeOverrides((prev) => ({ ...prev, [r.id]: nextVal }));

    try {
      await markAvenantDemande({ data: { itemId: r.itemId, itemIds: r.itemIds, demande: nextVal } });
      setData((d) =>
        d
          ? {
              ...d,
              rows: d.rows.map((x) => (x.id === r.id ? { ...x, avenantDemande: nextVal } : x)),
            }
          : d
      );
      toast.success(
        nextVal
          ? `Avenant marqué comme demandé (en cours) pour ${r.chantier}`
          : `Statut « Avenant demandé » retiré pour ${r.chantier}`
      );
    } catch (e) {
      console.error(e);
      setDemandeOverrides((prev) => ({ ...prev, [r.id]: !nextVal }));
      toast.error("Échec de la mise à jour « Avenant demandé »");
    } finally {
      setBusyDemandeIds((s) => {
        const next = new Set(s);
        next.delete(r.id);
        return next;
      });
    }
  };

  const markDone = async (r: ActionRow): Promise<boolean> => {
    if (busyIds.has(r.id)) return false;
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
      toast.success(`Action "${r.type}" enregistrée pour ${r.chantier}`);
      return true;
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
      return false;
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
      .catch((e) => {
        console.error(e);
        if (active) setError('Impossible de charger les actions.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [firstName, preloaded]);

  const filteredRows = useMemo(() => {
    return (data?.rows || [])
      .filter((r) => !completedIds.has(r.id))
      .filter((r) => normalize(r.chantier).includes(normalize(search)))
      .sort((a, b) => (a.type === b.type ? 0 : a.type === 'À récupérer' ? -1 : 1));
  }, [data?.rows, completedIds, search]);

  const selectedAction = useMemo(() => {
    return filteredRows.find((r) => r.id === selectedActionId) ?? null;
  }, [filteredRows, selectedActionId]);

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
  if (!data || data.rows.length === 0) {
    return null;
  }
  if (filteredRows.length === 0) return null;

  const totalRefs = filteredRows.reduce((sum, r) => sum + r.values.length, 0);

  return (
    <div className="space-y-4">
      {/* Barre d'en-tête et Sélecteur de vue Fiches vs Tableau */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
        <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
          <span className="font-extrabold text-base text-foreground font-[family-name:var(--font-heading)]">
            {filteredRows.length} action{filteredRows.length > 1 ? 's' : ''} à traiter
          </span>
          <span className="bg-primary/10 text-primary font-bold px-2.5 py-0.5 rounded-full text-[11px]">
            {totalRefs} référence{totalRefs > 1 ? 's' : ''} concernée{totalRefs > 1 ? 's' : ''}
          </span>
        </div>

        {/* Bascule Fiches / Tableau */}
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
            <span>📋 Liste des fiches</span>
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
            <span>📊 Vue Tableau ({data.columns.length} col.)</span>
          </button>
        </div>
      </div>

      {/* 1. VUE FICHES D'ACTIONS (RECOMMANDÉE — LECTURE IMMÉDIATE SANS SCROLL) */}
      {viewMode === 'cards' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filteredRows.map((r) => {
            const isRecup = r.type === 'À récupérer';
            const isBusy = busyIds.has(r.id);
            const isBusyDemande = busyDemandeIds.has(r.id);
            const isChecked = checkedIds.has(r.id);
            const demande = !isRecup && isAvenantDemande(r);

            return (
              <div
                key={r.id}
                onClick={() => setSelectedActionId(r.id)}
                className={`group rounded-2xl border-2 transition-all p-4 sm:p-4.5 bg-card hover:bg-muted/20 cursor-pointer shadow-xs flex flex-col justify-between gap-3 ${
                  isRecup
                    ? 'border-emerald-500/30 hover:border-emerald-500/70'
                    : demande
                      ? 'border-amber-500/50 hover:border-amber-500/80'
                      : 'border-blue-500/30 hover:border-blue-500/70'
                }`}
              >
                {/* Ligne 1 : Nom du site, Badge de type d'action et Badge de nombre */}
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`flex h-11 w-11 items-center justify-center rounded-xl font-bold shrink-0 shadow-xs ${
                        isRecup
                          ? 'bg-emerald-500/15 text-emerald-600'
                          : demande
                            ? 'bg-amber-500/15 text-amber-600'
                            : 'bg-blue-500/15 text-blue-600'
                      }`}
                    >
                      {isRecup ? <Package className="h-5 w-5" /> : <FileEdit className="h-5 w-5" />}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-extrabold text-base text-foreground tracking-tight truncate group-hover:text-primary transition-colors">
                        {r.chantier}
                      </h4>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-bold ${
                            isRecup
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-blue-600 dark:text-blue-400'
                          }`}
                        >
                          <span>{isRecup ? 'À récupérer sur site' : 'Avenant de diminution'}</span>
                        </span>
                        {demande && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-300 border border-amber-300/70">
                            <Clock className="h-2.5 w-2.5" />
                            <span>Avenant demandé • En cours</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-muted border border-border px-2 text-xs font-extrabold text-foreground tabular-nums shrink-0">
                    {r.values.length} réf.
                  </span>
                </div>

                {/* Ligne 2 : Liste directe des références et quantités (Plus besoin de chercher dans 30 colonnes !) */}
                <div className="space-y-1.5 pt-1">
                  {r.values.map((v) => (
                    <div
                      key={v.name}
                      className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-muted/40 border border-border/80 text-xs hover:bg-muted/60 transition-colors"
                    >
                      <span className="font-extrabold text-foreground truncate mr-2" title={v.name}>
                        {v.name}
                      </span>
                      <span className="font-black text-primary font-mono text-xs shrink-0 bg-card px-2.5 py-1 rounded-lg border border-border shadow-2xs">
                        {v.value}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Ligne 3 : Barre d'action rapide (Avenant demandé + Cocher comme fait OU ouvrir la fiche pop-up) */}
                <div className="flex items-center justify-between gap-2 flex-wrap pt-2.5 border-t border-border/60 text-xs">
                  <span className="text-muted-foreground text-[11px] flex items-center gap-1 group-hover:text-foreground transition-colors">
                    <span>Ouvrir la fiche détaillée</span>
                    <span>→</span>
                  </span>

                  <div className="flex items-center gap-2 flex-wrap">
                    {!isRecup && (
                      <label
                        onClick={(e) => e.stopPropagation()}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl font-bold text-xs transition-all border cursor-pointer select-none ${
                          demande
                            ? 'bg-amber-100 border-amber-400 text-amber-900 dark:bg-amber-900/40 dark:border-amber-600 dark:text-amber-200'
                            : 'bg-muted/50 hover:bg-muted border-border text-muted-foreground hover:text-foreground'
                        }`}
                        title="Cocher lorsque la demande d'avenant est envoyée et en cours de traitement"
                      >
                        {isBusyDemande ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-600" />
                        ) : (
                          <input
                            type="checkbox"
                            checked={demande}
                            disabled={isBusyDemande}
                            onChange={() => void toggleAvenantDemande(r)}
                            className="h-3.5 w-3.5 rounded accent-amber-600 cursor-pointer"
                          />
                        )}
                        <span>Avenant demandé</span>
                      </label>
                    )}

                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={(e) => {
                        e.stopPropagation();
                        void markDone(r);
                      }}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all shadow-2xs cursor-pointer ${
                        isChecked
                          ? 'bg-emerald-600 text-white'
                          : 'bg-primary/10 hover:bg-primary/20 text-primary'
                      }`}
                    >
                      {isBusy ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>En cours...</span>
                        </>
                      ) : isChecked ? (
                        <>
                          <Check className="h-3.5 w-3.5 stroke-[3]" />
                          <span>Fait !</span>
                        </>
                      ) : (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          <span>Marquer fait</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* 2. VUE TABLEAU BRUT HISTORIQUE AVEC LIENS VERS POP-UP */
        <div className="overflow-x-auto rounded-[var(--radius-md)] border border-border shadow-sm">
          <table className="w-full min-w-max text-center text-sm">
            <thead className="bg-muted/70 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-semibold">Réalisé (Réf.)</th>
                <th className="px-3 py-2 font-semibold text-left">Site (Cliquer = Fiche)</th>
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
                  <td className="px-3 py-2.5 font-semibold text-left">
                    <button
                      type="button"
                      onClick={() => setSelectedActionId(r.id)}
                      className="hover:text-primary hover:underline font-bold text-left inline-flex items-center gap-1.5 cursor-pointer text-foreground"
                      title="Ouvrir la fiche de cette action en pop-up"
                    >
                      <span>{r.chantier}</span>
                      <ExternalLink className="h-3 w-3 text-muted-foreground opacity-60 hover:opacity-100" />
                    </button>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-col items-center gap-1">
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-bold cursor-help transition-opacity hover:opacity-90 ${
                          r.type === 'Avenant'
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-emerald-600 dark:text-emerald-400'
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
                      {r.type === 'Avenant' && (
                        <label className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 dark:text-amber-300 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={isAvenantDemande(r)}
                            disabled={busyDemandeIds.has(r.id)}
                            onChange={() => void toggleAvenantDemande(r)}
                            className="h-3.5 w-3.5 rounded accent-amber-600 cursor-pointer"
                          />
                          <span>Demandé</span>
                        </label>
                      )}
                    </div>
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
      )}

      {/* 3. MODALE POP-UP DÉDIÉE : FICHE D'ACTION DU SITE SÉLECTIONNÉ */}
      <Dialog open={!!selectedAction} onOpenChange={(open) => !open && setSelectedActionId(null)}>
        <DialogContent className="max-w-xl w-full p-0 overflow-hidden flex flex-col max-h-[85vh]">
          {/* En-tête de la Pop-up */}
          <div className="p-4 sm:p-5 border-b border-border bg-card/95 flex items-center justify-between gap-3 shrink-0 pr-12">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`h-11 w-11 rounded-xl flex items-center justify-center font-bold shrink-0 ${
                  selectedAction?.type === 'À récupérer'
                    ? 'bg-emerald-500/15 text-emerald-600'
                    : 'bg-blue-500/15 text-blue-600'
                }`}
              >
                {selectedAction?.type === 'À récupérer' ? (
                  <Package className="h-5 w-5" />
                ) : (
                  <FileEdit className="h-5 w-5" />
                )}
              </div>
              <div className="min-w-0">
                <DialogTitle className="font-extrabold text-base sm:text-lg text-foreground truncate">
                  {selectedAction?.chantier}
                </DialogTitle>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-bold ${
                      selectedAction?.type === 'À récupérer'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-blue-600 dark:text-blue-400'
                    }`}
                  >
                    <span>
                      {selectedAction?.type === 'À récupérer'
                        ? 'À récupérer sur site'
                        : 'Avenant de diminution'}
                    </span>
                  </span>
                  <span className="text-[11px] text-muted-foreground font-semibold">
                    • {selectedAction?.values.length} référence(s) à traiter
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Corps de la Pop-up : Liste détaillée des références et explications */}
          {selectedAction && (
            <div className="p-4 sm:p-6 flex-1 overflow-y-auto space-y-4 text-xs pb-24 sm:pb-8">
              {/* Note explicative selon le type d'action */}
              <div className="p-3 rounded-xl border border-border/80 bg-card flex items-start gap-2.5 text-xs text-foreground shadow-2xs">
                <Info className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                <div className="leading-relaxed">
                  {selectedAction.type === 'À récupérer' ? (
                    <span>
                      <strong className="text-foreground font-black">Stock en surplus à récupérer sur site :</strong> Le chiffre entre parenthèses
                      indique à combien de mois de consommation correspond ce stock.
                    </span>
                  ) : (
                    <span>
                      <strong className="text-foreground font-black">Avenant de diminution à établir :</strong> Le nombre indiqué correspond à la diminution
                      annuelle recommandée pour réviser le contrat avec le client.
                    </span>
                  )}
                </div>
              </div>

              {/* Liste des produits avec quantités */}
              <div className="space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Détail des références concernées :
                </div>

                <div className="divide-y divide-border/60 rounded-xl border border-border bg-card overflow-hidden shadow-2xs">
                  {selectedAction.values.map((v) => (
                    <div
                      key={v.name}
                      className="p-3.5 flex items-center justify-between gap-3 hover:bg-muted/30 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-extrabold text-sm text-foreground truncate" title={v.name}>
                          {v.name}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {selectedAction.type === 'À récupérer'
                            ? 'Quantité physique à récupérer sur le site'
                            : 'Diminution annuelle du contrat recommandée'}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="inline-block font-black text-primary font-mono text-sm bg-muted/60 px-3 py-1 rounded-xl border border-border shadow-2xs">
                          {v.value}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Footer fixe de la Pop-up */}
          {selectedAction && (
            <div className="p-3.5 sm:p-4 border-t border-border bg-card/95 flex items-center justify-between gap-2.5 flex-wrap shrink-0">
              <DialogClose asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-muted/60 hover:bg-muted text-foreground px-4 py-2.5 text-xs font-bold transition cursor-pointer"
                >
                  <X className="h-4 w-4" />
                  <span>Fermer</span>
                </button>
              </DialogClose>

              <div className="flex items-center gap-2 flex-wrap">
                {selectedAction.type === 'Avenant' && (
                  <label
                    className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-bold transition cursor-pointer select-none ${
                      isAvenantDemande(selectedAction)
                        ? 'bg-amber-100 border-amber-400 text-amber-900 dark:bg-amber-900/40 dark:border-amber-600 dark:text-amber-200'
                        : 'bg-muted/50 hover:bg-muted border-border text-foreground'
                    }`}
                  >
                    {busyDemandeIds.has(selectedAction.id) ? (
                      <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
                    ) : (
                      <input
                        type="checkbox"
                        checked={isAvenantDemande(selectedAction)}
                        disabled={busyDemandeIds.has(selectedAction.id)}
                        onChange={() => void toggleAvenantDemande(selectedAction)}
                        className="h-4 w-4 rounded accent-amber-600 cursor-pointer"
                      />
                    )}
                    <span>Avenant demandé (en cours)</span>
                  </label>
                )}

                <button
                  type="button"
                  disabled={busyIds.has(selectedAction.id)}
                  onClick={async () => {
                    const action = selectedAction;
                    const ok = await markDone(action);
                    if (ok) setSelectedActionId(null);
                  }}
                  className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs sm:text-sm font-bold shadow-sm transition cursor-pointer disabled:opacity-60 ${
                    selectedAction.type === 'À récupérer'
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20'
                      : 'bg-primary hover:bg-primary/95 text-primary-foreground'
                  }`}
                >
                  {busyIds.has(selectedAction.id) ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Enregistrement...</span>
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 stroke-[3]" />
                      <span>Valider cette action</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
