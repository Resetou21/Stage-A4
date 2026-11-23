import { useEffect, useState } from 'react';
import { RefreshCw, CheckCircle2, AlertTriangle, Layers, X, Play, Loader2, ShieldCheck, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { getFixedChargesStatus, createSingleFixedCharge, type FixedChargesStatus, type MissingChargeItem } from '@generated/server/syncFixedCharges';
import { clearBoardCache } from '@api/mondayApi';

const FIXED_STATUS_CACHE_KEY = 'hub_vincent_fixed_charges_status_v1';
const FIXED_STATUS_TTL_MS = 30 * 60 * 1000; // 30 minutes

function getCachedFixedStatus(): FixedChargesStatus | null {
  try {
    const raw = localStorage.getItem(FIXED_STATUS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.ts === 'number' && Date.now() - parsed.ts < FIXED_STATUS_TTL_MS && parsed.data) {
      return parsed.data as FixedChargesStatus;
    }
  } catch {}
  return null;
}

export default function SyncFixedChargesModal({ onComplete }: { onComplete?: () => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<FixedChargesStatus | null>(() => getCachedFixedStatus());
  const [syncing, setSyncing] = useState(false);
  const [showVehicles, setShowVehicles] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number; currentItem?: MissingChargeItem } | null>(null);

  const fetchStatus = async (force = false) => {
    if (!force) {
      const cached = getCachedFixedStatus();
      if (cached) {
        setStatus(cached);
        return;
      }
    }
    setLoading(true);
    try {
      const res = await getFixedChargesStatus({});
      setStatus(res);
      try {
        localStorage.setItem(FIXED_STATUS_CACHE_KEY, JSON.stringify({ ts: Date.now(), data: res }));
      } catch {}
    } catch (err) {
      console.error(err);
      toast.error('Impossible de charger le statut des charges fixes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus(false);
  }, []);

  const handleStartSync = async () => {
    if (!status || status.missingItems.length === 0) return;
    setSyncing(true);
    const items = status.missingItems;
    const total = items.length;
    let createdCount = 0;

    try {
      for (let i = 0; i < total; i++) {
        const item = items[i];
        setProgress({ current: i + 1, total, currentItem: item });

        await createSingleFixedCharge({
          data: {
            plate: item.plate,
            monthDate: item.monthDate,
            monthlyCost: item.monthlyCost,
          },
        });
        createdCount++;

        // Pause anti-saturation douce pour respecter les limites Monday (80ms)
        await new Promise((r) => setTimeout(r, 80));
      }

      toast.success('Synchronisation terminée !', {
        description: `${createdCount} lignes de charges fixes ont été ajoutées avec succès dans le groupe Fixe.`,
      });

      clearBoardCache();
      try {
        localStorage.removeItem(FIXED_STATUS_CACHE_KEY);
      } catch {}
      await fetchStatus(true);
      if (onComplete) onComplete();
    } catch (err: any) {
      console.error(err);
      toast.error('Erreur pendant la synchronisation', {
        description: err?.message || 'Une interruption est survenue. Relancez pour continuer le rattrapage.',
      });
      await fetchStatus(true);
    } finally {
      setSyncing(false);
      setProgress(null);
    }
  };

  const isUpToDate = status && status.totalMissing === 0;

  return (
    <>
      {/* Bouton déclencheur dans la carte */}
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          fetchStatus(true);
        }}
        className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-border bg-background px-3.5 py-2 text-xs font-bold text-foreground transition hover:bg-muted shadow-xs cursor-pointer"
        title="Gérer et synchroniser les charges fixes mensuelles des véhicules"
      >
        <Layers className="h-4 w-4 text-primary" />
        <span>Charges fixes</span>
        {loading ? (
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        ) : isUpToDate ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 border border-emerald-500/20">
            <CheckCircle2 className="h-3 w-3" /> À jour
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-600 border border-amber-500/20">
            <AlertTriangle className="h-3 w-3" /> {status?.totalMissing ?? '…'} à créer
          </span>
        )}
      </button>

      {/* Fenêtre Modale de Contrôle & Synchronisation */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-2.5 pb-28 sm:items-center sm:p-4">
          {/* Backdrop avec flou */}
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-xs transition-opacity"
            onClick={() => !syncing && setOpen(false)}
          />

          {/* Contenu de la Modale */}
          <div className="relative z-10 flex max-h-[calc(100dvh-118px)] w-full max-w-xl flex-col overflow-hidden rounded-[var(--radius-xl)] border border-border bg-card shadow-2xl transition-all sm:max-h-[90vh]">
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-4 py-4 sm:px-6 sm:pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Layers className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-[family-name:var(--font-heading)] text-lg font-bold text-foreground">
                    Synchronisation des Charges Fixes
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Réplication mensuelle sécurisée du tableau Parc vers le tableau Données Véhicules.
                  </p>
                </div>
              </div>

              {!syncing && (
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6">
              {/* Encadré d'assurance ZÉRO CASSE */}
              <div className="flex items-start gap-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs text-emerald-800 dark:text-emerald-300">
                <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5" />
                <div>
                  <span className="font-bold">Sécurité « Zéro Casse » garantie</span> : Aucune ligne existante n'est écrasée.
                  Le système vérifie chaque immatriculation et chaque date. Seules les lignes manquantes sont générées dans le groupe <code className="font-mono font-bold">Fixe</code>.
                </div>
              </div>

              {loading ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-xs text-muted-foreground">Analyse des 41 véhicules et des mois manquants…</p>
                </div>
              ) : status ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-border bg-muted/40 p-3">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Véhicules en service</p>
                      <p className="mt-1 text-2xl font-extrabold text-foreground">{status.activeCount}</p>
                      <p className="text-[10px] text-muted-foreground">Restitués exclus automatiquement</p>
                    </div>

                    <div className="rounded-lg border border-border bg-muted/40 p-3">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Lignes à créer</p>
                      <p className="mt-1 text-2xl font-extrabold text-primary">
                        {status.totalMissing}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Sur l'ensemble des mois</p>
                    </div>
                  </div>

                  {/* Détail par mois */}
                  <div className="rounded-lg border border-border p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-bold text-foreground">Détail des mois détectés :</p>
                      <span className="text-[11px] text-muted-foreground font-normal">
                        1 véhicule actif = 1 charge mensuelle
                      </span>
                    </div>
                    {status.missingByMonth.length === 0 ? (
                      <div className="flex items-center gap-2 py-3 text-sm text-emerald-600 font-semibold">
                        <CheckCircle2 className="h-4 w-4" />
                        Toutes les charges fixes de l'année sont parfaitement à jour jusqu'à ce jour !
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto">
                        {status.missingByMonth.map((m) => (
                          <div key={m.key} className="flex items-center justify-between rounded bg-muted/60 px-2.5 py-1.5 text-xs">
                            <span className="font-medium text-foreground">{m.label}</span>
                            <span className="font-mono font-bold text-amber-600">+{m.count}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Accordéon : Liste des 41 véhicules & montants */}
                  {status.activeVehicles && status.activeVehicles.length > 0 && (
                    <div className="rounded-lg border border-border overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setShowVehicles(!showVehicles)}
                        className="w-full flex items-center justify-between p-2.5 bg-muted/30 text-xs font-bold text-foreground hover:bg-muted/50 transition cursor-pointer"
                      >
                        <span className="flex items-center gap-2">
                          <span>📋 Voir les {status.activeCount} véhicules et leurs montants mensuels</span>
                        </span>
                        <span className="flex items-center gap-1 text-primary">
                          <span className="text-[11px] font-normal text-muted-foreground">{showVehicles ? 'Masquer' : 'Afficher'}</span>
                          {showVehicles ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </span>
                      </button>
                      {showVehicles && (
                        <div className="max-h-56 overflow-y-auto p-2 divide-y divide-border/60 text-xs bg-card">
                          {status.activeVehicles.map((v) => (
                            <div key={v.plate} className="py-1.5 px-2 flex items-center justify-between gap-2 hover:bg-muted/20">
                              <div className="flex items-center gap-2 min-w-0">
                                {v.num && (
                                  <span className="font-mono font-bold text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 shrink-0">
                                    {v.num.replace(/^#/, '')}
                                  </span>
                                )}
                                <span className="font-mono font-bold text-foreground shrink-0">{v.plate}</span>
                                <span className="text-muted-foreground truncate">{v.model}</span>
                              </div>
                              <span className="font-mono font-bold text-primary shrink-0">
                                {v.monthlyCost.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}/mois
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Liens de vérification directe vers Monday.com */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground pt-1">
                    <span>Vérifier directement sur Monday :</span>
                    <div className="flex items-center gap-3">
                      <a
                        href="https://groupefacility.monday.com/boards/5092005027"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline font-semibold"
                      >
                        Suivi du parc (41 actifs) <ExternalLink className="h-3 w-3" />
                      </a>
                      <span>•</span>
                      <a
                        href="https://groupefacility.monday.com/boards/5092124669"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline font-semibold"
                      >
                        Data sur véhicule (Fixe) <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>

                  {/* Barre de progression pendant la synchronisation */}
                  {syncing && progress && (
                    <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-4">
                      <div className="flex items-center justify-between text-xs font-bold text-foreground">
                        <span className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          Création en cours…
                        </span>
                        <span className="font-mono text-primary">
                          {progress.current} / {progress.total} ({Math.round((progress.current / progress.total) * 100)}%)
                        </span>
                      </div>

                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full bg-primary transition-all duration-150 ease-out"
                          style={{ width: `${(progress.current / progress.total) * 100}%` }}
                        />
                      </div>

                      {progress.currentItem && (
                        <p className="text-[11px] text-muted-foreground truncate">
                          Ajout de <strong className="text-foreground">{progress.currentItem.plate}</strong> ({progress.currentItem.model || progress.currentItem.num}) pour {progress.currentItem.monthLabel}…
                        </p>
                      )}
                    </div>
                  )}
                </>
              ) : null}
            </div>

            {/* Pied de Modale */}
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2.5 border-t border-border bg-card px-4 py-3.5 sm:px-6 sm:py-4">
              <button
                type="button"
                disabled={syncing}
                onClick={() => setOpen(false)}
                className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer disabled:opacity-50"
              >
                Fermer
              </button>

              {!isUpToDate && status && status.totalMissing > 0 && (
                <button
                  type="button"
                  disabled={syncing || loading}
                  onClick={handleStartSync}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow transition hover:brightness-95 cursor-pointer disabled:opacity-50"
                >
                  {syncing ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Synchronisation ({progress?.current ?? 0}/{progress?.total ?? 0})…
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5 fill-current" />
                      Lancer la synchronisation ({status.totalMissing} lignes)
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
