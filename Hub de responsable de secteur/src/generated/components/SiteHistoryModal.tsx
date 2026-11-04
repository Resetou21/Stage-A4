import {
  Calendar,
  CheckCircle2,
  Clock,
  History,
  Inbox,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@components/ui/dialog';
import { cn } from '@lib/utils';
import type { SiteHistoryResult } from '@generated/server/inventory';

type HistoryData = SiteHistoryResult;

export default function SiteHistoryModal({
  open,
  onOpenChange,
  siteName,
  fournisseur,
  dernierInventaire,
  historyData,
  loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  siteName: string;
  fournisseur: string | null;
  dernierInventaire: string | null;
  historyData: HistoryData | null;
  loading: boolean;
}) {
  const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('fr-FR') : '—');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] w-[95vw] max-w-4xl flex flex-col p-6 sm:p-7 rounded-2xl border border-border bg-card shadow-2xl">
        <DialogHeader className="space-y-1 text-left pb-3 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <History className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-xl font-extrabold tracking-tight truncate">
                Historique &amp; Prévision 2027 — {siteName}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Fournisseur : <span className="font-semibold text-foreground">{fournisseur || 'Non spécifié'}</span> • Dernier inventaire : <span className="font-semibold text-foreground">{fmt(dernierInventaire)}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="overflow-y-auto space-y-5 py-4 pr-1 text-xs">
          {loading && (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="font-semibold text-sm">Chargement de l'historique depuis Monday...</p>
            </div>
          )}

          {!loading && (!historyData || historyData.history.length === 0) && (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-center text-muted-foreground">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Inbox className="h-6 w-6 opacity-60" />
              </div>
              <p className="font-semibold text-sm text-foreground">Aucun relevé archivé pour ce site</p>
              <p className="text-xs max-w-md leading-relaxed">
                Les inventaires réalisés dans le passé sur ce chantier s'afficheront automatiquement ici dès qu'une validation sera effectuée.
              </p>
            </div>
          )}

          {!loading && historyData && historyData.history.length > 0 && (
            <>
              {/* 1. Encadré d'anticipation pour 2027 */}
              {historyData.recommendation && (
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex items-start gap-3.5 shadow-2xs">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary mt-0.5">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-extrabold text-xs uppercase tracking-wide text-primary flex items-center gap-1.5">
                      Aide à l'anticipation — Contrat 2027 (Basé sur le réalisé 2026)
                    </p>
                    <p className="text-xs text-foreground leading-relaxed">
                      {historyData.recommendation}
                    </p>
                  </div>
                </div>
              )}

              {/* 2. Mini-graphique d'évolution (dates dédupliquées sans doublons) */}
              <div className="rounded-xl border border-border bg-background p-4 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h4 className="text-xs font-extrabold uppercase tracking-wide text-foreground">
                      Évolution des stocks relevés par passage
                    </h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Comparaison du stock réel compté et du surplus à récupérer
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-semibold">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-primary">
                      <span className="h-2 w-2 rounded-full bg-primary" />
                      Stock réel compté
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--brand-orange))]/15 px-2.5 py-0.5 text-[hsl(var(--brand-orange))]">
                      <span className="h-2 w-2 rounded-full bg-[hsl(var(--brand-orange))]" />
                      Surplus (À récupérer)
                    </span>
                  </div>
                </div>

                <div className="h-48 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[...historyData.history].reverse().map((h) => ({
                        date: h.dateFormatted,
                        'Stock réel': h.totalStockReel,
                        'Surplus': h.totalSurplus,
                      }))}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <Tooltip
                        formatter={(value: number, name: string) => [`${value} unité(s)`, name]}
                        cursor={{ fill: 'hsl(var(--muted))' }}
                      />
                      <Bar dataKey="Stock réel" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Surplus" fill="hsl(var(--brand-orange))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* 3. Détail chronologique des inventaires passés (par passage élégant) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold uppercase tracking-wide text-foreground">
                    Détail chronologique des inventaires passés
                  </h4>
                  <span className="text-[11px] text-muted-foreground">
                    {historyData.history.length} passage(s) archivé(s)
                  </span>
                </div>

                <div className="space-y-4">
                  {historyData.history.map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-2xs hover:border-primary/40 transition-colors"
                    >
                      {/* En-tête du passage */}
                      <div className="flex items-center justify-between flex-wrap gap-2 pb-2.5 border-b border-border">
                        <div className="flex items-center flex-wrap gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Calendar className="h-4 w-4" />
                          </div>
                          <span className="font-extrabold text-sm text-foreground">
                            Passage du {entry.dateFormatted}
                          </span>

                          {/* 1. Badge Statut du Surplus Physique */}
                          {entry.totalSurplus === 0 ? (
                            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold border bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>Stock conforme</span>
                            </span>
                          ) : entry.recuperationRealisee ? (
                            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold border bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>Surplus récupéré</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold border bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30">
                              <Clock className="h-3.5 w-3.5" />
                              <span>Surplus à récupérer</span>
                            </span>
                          )}

                          {/* 2. Badge Statut de l'Avenant Contractuel (si avenant préconisé) */}
                          {((entry.totalAvenant ?? entry.products.reduce((s, p) => s + p.avenant, 0)) > 0) && (
                            entry.avenantRealise ? (
                              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold border bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                <span>Avenant réalisé</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold border bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30">
                                <Clock className="h-3.5 w-3.5" />
                                <span>Avenant à faire</span>
                              </span>
                            )
                          )}
                        </div>

                        {/* Synthèse des totaux du passage */}
                        <div className="flex items-center gap-3 text-xs font-semibold">
                          <span className="text-muted-foreground">
                            Stock compté :{' '}
                            <strong className="text-foreground font-bold">{entry.totalStockReel}</strong> unité(s)
                          </span>
                          <span className="text-muted-foreground">•</span>
                          <span className="text-muted-foreground">
                            Surplus :{' '}
                            <strong
                              className={
                                entry.totalSurplus > 0
                                  ? 'text-[hsl(var(--brand-orange))] font-bold'
                                  : 'text-foreground font-bold'
                              }
                            >
                              {entry.totalSurplus} unité(s)
                            </strong>
                          </span>
                          {((entry.totalAvenant ?? entry.products.reduce((s, p) => s + p.avenant, 0)) > 0) && (
                            <>
                              <span className="text-muted-foreground">•</span>
                              <span className="text-muted-foreground">
                                Avenant :{' '}
                                <strong className="text-primary font-bold">
                                  {entry.totalAvenant ?? entry.products.reduce((s, p) => s + p.avenant, 0)} unité(s)
                                </strong>
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Tableau des produits pour ce relevé */}
                      <div className="overflow-x-auto rounded-[var(--radius-md)] border border-border bg-background">
                        <table className="w-full min-w-[540px] text-xs">
                          <thead className="bg-secondary text-left uppercase tracking-wide text-secondary-foreground font-semibold text-[11px]">
                            <tr>
                              <th className="px-3 py-2">Produit</th>
                              <th className="px-3 py-2 text-right">Contrat annuel</th>
                              <th className="px-3 py-2 text-right">Stock réel compté</th>
                              <th className="px-3 py-2 text-right">Surplus (À récupérer)</th>
                              <th className="px-3 py-2 text-right">Avenant préconisé</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {entry.products.map((prod) => (
                              <tr key={prod.name} className="hover:bg-muted/30 transition-colors">
                                <td className="px-3 py-2 font-medium text-foreground">{prod.name}</td>
                                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                                  {prod.contrat > 0 ? `${prod.contrat}` : '—'}
                                </td>
                                <td className="px-3 py-2 text-right font-bold tabular-nums text-foreground">
                                  {prod.stockReel} unité(s)
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums">
                                  {prod.aRecuperer > 0 ? (
                                    <span className="inline-flex items-center gap-1 rounded bg-[hsl(var(--brand-orange))]/15 px-2 py-0.5 font-bold text-[hsl(var(--brand-orange))]">
                                      {prod.aRecuperer} {prod.moisConso ? `(${prod.moisConso} mois)` : ''}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums">
                                  {prod.avenant > 0 ? (
                                    <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 font-bold text-primary">
                                      {prod.avenant}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}