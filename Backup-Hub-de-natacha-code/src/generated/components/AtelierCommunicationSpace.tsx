import { useEffect, useState } from 'react';
import { Wrench, Send, RefreshCw, CheckCircle2, Clock, Inbox, ArrowUpRight, ArrowDownLeft, ShieldCheck, Loader2, MessageSquare, AlertTriangle, Eye, Archive } from 'lucide-react';
import { toast } from 'sonner';
import AlertContextSelect, { type AlertMachineOption } from '@generated/components/AlertContextSelect';
import { getAlertContexts, getMaintenanceExchanges, sendAlertToMaintenance, markCommunicationSeen, archiveCommunication, type MaintenanceExchange } from '@generated/server/visits';
import { cn } from '@lib/utils';

export default function AtelierCommunicationSpace({ firstName }: { firstName: string }) {
  // Formulaire d'envoi
  const [contextVal, setContextVal] = useState('');
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);

  // Données contextuelles (Chantiers & Machines)
  const [ctxLoading, setCtxLoading] = useState(false);
  const [chantiers, setChantiers] = useState<string[]>([]);
  const [machines, setMachines] = useState<AlertMachineOption[]>([]);

  // Échanges / Historique des alertes
  const [exchanges, setExchanges] = useState<MaintenanceExchange[]>([]);
  const [loadingExchanges, setLoadingExchanges] = useState(true);
  const [filterDirection, setFilterDirection] = useState<'all' | 'from_atelier' | 'to_atelier'>('all');

  const loadContexts = async () => {
    setCtxLoading(true);
    try {
      const res = await getAlertContexts({ data: { firstName } });
      setChantiers(res?.chantiers ?? []);
      setMachines(res?.machines ?? []);
    } catch (err) {
      console.warn('Erreur chargement contextes:', err);
    } finally {
      setCtxLoading(false);
    }
  };

  const loadExchanges = async () => {
    setLoadingExchanges(true);
    try {
      const res = await getMaintenanceExchanges({ data: { firstName } });
      setExchanges(res?.exchanges ?? []);
    } catch (err) {
      console.warn('Erreur chargement échanges:', err);
    } finally {
      setLoadingExchanges(false);
    }
  };

  useEffect(() => {
    loadContexts();
    loadExchanges();
  }, [firstName]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const msg = messageText.trim();
    if (!msg) {
      toast.error('Veuillez saisir votre message pour Christophe.');
      return;
    }

    setSending(true);
    try {
      await sendAlertToMaintenance({
        data: {
          senderName: firstName,
          context: contextVal || undefined,
          message: msg,
        },
      });

      toast.success('Alerte transmise à Christophe !', {
        description: 'Votre message a été envoyé vers le tableau de maintenance et le Hub de Christophe.',
      });

      setMessageText('');
      setContextVal('');
      await loadExchanges();
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de l'envoi de l'alerte.");
    } finally {
      setSending(false);
    }
  };

  const handleToggleSeen = async (item: MaintenanceExchange) => {
    try {
      await markCommunicationSeen({ data: { itemId: item.id, vu: !item.seen } });
      setExchanges((prev) =>
        prev.map((x) => (x.id === item.id ? { ...x, seen: !item.seen } : x))
      );
      toast.success(item.seen ? 'Marqué comme non lu' : 'Alerte marquée comme lue');
    } catch (err) {
      console.error(err);
      toast.error('Erreur mise à jour');
    }
  };

  const handleArchive = async (item: MaintenanceExchange) => {
    try {
      await archiveCommunication({ data: { itemId: item.id } });
      setExchanges((prev) => prev.filter((x) => x.id !== item.id));
      toast.success('Alerte archivée avec succès');
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de l'archivage");
    }
  };

  const filteredExchanges = exchanges.filter((e) => {
    if (filterDirection === 'from_atelier') return e.direction === 'from_atelier';
    if (filterDirection === 'to_atelier') return e.direction === 'to_atelier';
    return true;
  });

  const unreadCount = exchanges.filter((e) => !e.seen && e.direction === 'from_atelier').length;

  return (
    <div className="rounded-[var(--radius-xl)] border border-border bg-card p-6 shadow-xs sm:p-8">
      {/* En-tête de section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-6">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20">
            <Wrench className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-[family-name:var(--font-heading)] text-xl font-extrabold text-foreground tracking-tight sm:text-2xl">
              Échanges Atelier &amp; Parc Matériel (Christophe)
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Signalements de pannes, suivi des réparations et communication bidirectionnelle en direct.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-600 border border-amber-500/20">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
              {unreadCount} message{unreadCount > 1 ? 's' : ''} de Christophe
            </span>
          )}

          <button
            type="button"
            onClick={loadExchanges}
            disabled={loadingExchanges}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3.5 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
            title="Rafraîchir les échanges"
          >
            <RefreshCw className={cn('h-3.5 w-3.5 text-primary', loadingExchanges && 'animate-spin')} />
            <span>Actualiser</span>
          </button>
        </div>
      </div>

      {/* Grille 2 colonnes : Formulaire d'envoi à gauche + Fil des messages à droite */}
      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Colonne Gauche : Formulaire de signalement */}
        <div className="lg:col-span-5 flex flex-col justify-between rounded-2xl border border-border bg-muted/20 p-5 sm:p-6">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-foreground">
              <Send className="h-4 w-4 text-primary" />
              <span>Transmettre un signalement à l'Atelier</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 mb-4">
              Christophe recevra immédiatement ce message sur son ERP avec la machine et le chantier ciblés.
            </p>

            <form onSubmit={handleSend} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Machine ou chantier concerné
                </label>
                <AlertContextSelect
                  chantiers={chantiers}
                  machines={machines}
                  loading={ctxLoading}
                  value={contextVal}
                  onChange={setContextVal}
                  placeholder="Rechercher une machine ou un chantier…"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Description du problème / Message <span className="text-destructive">*</span>
                </label>
                <textarea
                  rows={4}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Ex: Bavettes suceur déchirées sur autolaveuse, faire devis réparation ou changement..."
                  className="w-full rounded-xl border border-input bg-card p-3 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors resize-none shadow-xs"
                />
              </div>

              <button
                type="submit"
                disabled={sending || !messageText.trim()}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-md transition hover:brightness-95 disabled:opacity-50 cursor-pointer"
              >
                {sending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Transmission en cours…
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Alerter Christophe (Atelier)
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-border/80 bg-background/80 p-3 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
            <span>
              L'alerte s'inscrit automatiquement dans le tableau officiel de communication Monday et alerte le Hub Matériel de Christophe.
            </span>
          </div>
        </div>

        {/* Colonne Droite : Fil des échanges récents */}
        <div className="lg:col-span-7 flex flex-col rounded-2xl border border-border bg-card p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-bold text-foreground">Historique des échanges</h4>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
                {filteredExchanges.length}
              </span>
            </div>

            {/* Filtres de direction */}
            <div className="inline-flex rounded-lg bg-muted p-1 text-xs">
              <button
                type="button"
                onClick={() => setFilterDirection('all')}
                className={cn(
                  'rounded-md px-2.5 py-1 font-semibold transition',
                  filterDirection === 'all'
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Tous
              </button>
              <button
                type="button"
                onClick={() => setFilterDirection('from_atelier')}
                className={cn(
                  'rounded-md px-2.5 py-1 font-semibold transition',
                  filterDirection === 'from_atelier'
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                De Christophe
              </button>
              <button
                type="button"
                onClick={() => setFilterDirection('to_atelier')}
                className={cn(
                  'rounded-md px-2.5 py-1 font-semibold transition',
                  filterDirection === 'to_atelier'
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Envoyés
              </button>
            </div>
          </div>

          {/* Liste des messages */}
          <div className="mt-4 flex-1 overflow-y-auto space-y-3 max-h-[380px] pr-1">
            {loadingExchanges ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 className="h-7 w-7 animate-spin text-primary" />
                <p className="text-xs text-muted-foreground">Chargement des échanges…</p>
              </div>
            ) : filteredExchanges.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                <Inbox className="h-10 w-10 stroke-[1.5] mb-2 text-muted-foreground/60" />
                <p className="text-sm font-semibold">Aucun échange pour le moment</p>
                <p className="text-xs mt-0.5">
                  Les alertes échangées avec l'Atelier apparaîtront ici automatiquement.
                </p>
              </div>
            ) : (
              filteredExchanges.map((item) => {
                const isFromAtelier = item.direction === 'from_atelier';
                return (
                  <div
                    key={item.id}
                    className={cn(
                      'group relative rounded-xl border p-4 transition-all',
                      isFromAtelier
                        ? item.seen
                          ? 'border-border bg-muted/20'
                          : 'border-primary/40 bg-primary/5 ring-1 ring-primary/20'
                        : 'border-border bg-background'
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        {isFromAtelier ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-600 border border-blue-500/20">
                            <ArrowDownLeft className="h-3 w-3" /> De Christophe (Atelier)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-600 border border-amber-500/20">
                            <ArrowUpRight className="h-3 w-3" /> Envoyé à Christophe
                          </span>
                        )}

                        {item.context && (
                          <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground truncate max-w-[200px]">
                            {item.context}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{item.date || 'Récemment'}</span>
                      </div>
                    </div>

                    <p className="mt-2.5 text-xs text-foreground font-medium whitespace-pre-wrap leading-relaxed">
                      {item.message}
                    </p>

                    <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2 text-[11px]">
                      <span className="text-muted-foreground">
                        {isFromAtelier ? (
                          item.seen ? (
                            <span className="text-emerald-600 font-semibold inline-flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" /> Lu
                            </span>
                          ) : (
                            <span className="text-amber-600 font-bold inline-flex items-center gap-1">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Non lu
                            </span>
                          )
                        ) : (
                          <span className="text-muted-foreground">Transmis à l'Atelier</span>
                        )}
                      </span>

                      <div className="flex items-center gap-2">
                        {isFromAtelier && (
                          <button
                            type="button"
                            onClick={() => handleToggleSeen(item)}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline cursor-pointer"
                          >
                            <Eye className="h-3 w-3" />
                            {item.seen ? 'Marquer non lu' : 'Marquer comme lu'}
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleArchive(item)}
                          className="text-muted-foreground hover:text-destructive transition p-1 cursor-pointer"
                          title="Archiver cette alerte"
                        >
                          <Archive className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
