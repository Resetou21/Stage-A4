import { useEffect, useRef, useState } from 'react';
import { Bell, BellRing, ChevronDown, ChevronRight, Loader2, RefreshCw, Send, Wrench } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@components/ui/dialog';
import AlertContextSelect, { type AlertMachineOption } from '@generated/components/AlertContextSelect';
import AlertsList, { buildCategories } from '@generated/components/AlertsList';
import { totalAlerts, useAlerts } from '@generated/hooks/useAlerts';
import { getAlertContexts, sendAlertToMaintenance } from '@generated/server/visits';
import { cn } from '@lib/utils';

const NAV = [
  { href: '#formulaires', label: 'Formulaires', shortLabel: 'Formulaires' },
  { href: '#visites', label: 'Visites clients', shortLabel: 'Visites' },
  { href: '#chantiers', label: 'Tableau complet chantier', shortLabel: 'Chantiers' },
  { href: '#inventaire', label: 'Stocks & inventaires', shortLabel: 'Stocks' },
];

export default function AlertsCenter({ firstName }: { firstName: string }) {
  const { data, markSeen, archiveMessage, refreshMessages } = useAlerts(firstName);
  const [open, setOpen] = useState(false);
  const [zoneOpen, setZoneOpen] = useState(false);
  const [atelierOpen, setAtelierOpen] = useState(false);
  const [atelierContext, setAtelierContext] = useState('');
  const [atelierMsg, setAtelierMsg] = useState('');
  const [atelierSending, setAtelierSending] = useState(false);
  const [atelierSentOk, setAtelierSentOk] = useState(false);
  const [refreshingMsgs, setRefreshingMsgs] = useState(false);
  const [ctxLoaded, setCtxLoaded] = useState(false);
  const [ctxLoading, setCtxLoading] = useState(false);
  const [ctxChantiers, setCtxChantiers] = useState<string[]>([]);
  const [ctxMachines, setCtxMachines] = useState<AlertMachineOption[]>([]);
  const total = totalAlerts(data);

  useEffect(() => {
    if (!atelierOpen || ctxLoaded || ctxLoading) return;
    setCtxLoading(true);
    getAlertContexts({ data: { firstName } })
      .then((res) => {
        setCtxChantiers(res?.chantiers ?? []);
        setCtxMachines(res?.machines ?? []);
        setCtxLoaded(true);
      })
      .catch((err) => console.warn('Erreur chargement contextes alertes:', err))
      .finally(() => setCtxLoading(false));
  }, [atelierOpen, ctxLoaded, ctxLoading, firstName]);

  // Animation d'ouverture fluide dès la première visite de chaque journée
  useEffect(() => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const storageKey = `hub_alerts_seen_${firstName}_${today}`;
      const alreadySeen = sessionStorage.getItem(storageKey);
      if (!alreadySeen) {
        sessionStorage.setItem(storageKey, 'true');
        // Un léger micro-délai de 150ms permet au DOM de monter et déclenche l'animation complète d'entrée (zoom + fade)
        const timer = setTimeout(() => setOpen(true), 150);
        return () => clearTimeout(timer);
      }
    } catch {
      // ignore
    }
  }, [firstName]);

  // Si après chargement il y a 0 alerte, fermer automatiquement
  useEffect(() => {
    if (data !== null && total === 0) {
      setOpen(false);
    }
  }, [data, total]);

  const jump = (href: string) => document.querySelector(href)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const navRef = useRef<HTMLElement>(null);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    if (navRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = navRef.current;
      setCanScrollRight(scrollWidth - scrollLeft - clientWidth > 12);
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, []);

  const scrollRight = () => {
    if (navRef.current) {
      navRef.current.scrollBy({ left: 140, behavior: 'smooth' });
    }
  };

  return (
    <>
      <div className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur shadow-xs">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-2 sm:px-8">
          <div className="relative flex min-w-0 flex-1 items-center">
            <nav
              ref={navRef}
              onScroll={checkScroll}
              className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto no-scrollbar py-0.5"
              aria-label="Navigation rapide"
            >
              {NAV.map((n) => (
                <button
                  key={n.href}
                  type="button"
                  onClick={() => jump(n.href)}
                  className="min-h-9 sm:min-h-10 shrink-0 rounded-lg px-2 sm:px-3 text-xs sm:text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors whitespace-nowrap"
                >
                  <span className="hidden lg:inline">{n.label}</span>
                  <span className="lg:hidden">{n.shortLabel}</span>
                </button>
              ))}
            </nav>
            {canScrollRight && (
              <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center pl-3 bg-gradient-to-l from-card via-card/95 to-transparent">
                <button
                  type="button"
                  onClick={scrollRight}
                  aria-label="Voir la suite des onglets"
                  title="Faire défiler pour voir la suite des onglets"
                  className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full bg-primary/10 border border-primary/25 text-primary shadow-xs hover:bg-primary/20 active:scale-95 transition-all"
                >
                  <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 stroke-[2.2]" />
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            disabled={!data}
            className={cn(
              'inline-flex min-h-9 sm:min-h-10 shrink-0 items-center gap-1.5 sm:gap-2 rounded-lg px-2.5 sm:px-3.5 text-xs sm:text-sm font-bold transition-all disabled:opacity-60 shadow-2xs',
              total > 0
                ? 'bg-[hsl(var(--brand-orange))] text-white hover:opacity-90'
                : 'border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
            aria-label="Ouvrir les alertes"
            title="Consulter les alertes et rappels"
          >
            {total > 0 ? <BellRing className="h-4 w-4 shrink-0 animate-bounce" /> : <Bell className="h-4 w-4 shrink-0" />}
            <span className="hidden sm:inline">Alertes &amp; Rappels</span>
            <span
              className={cn(
                'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] sm:text-xs font-black',
                total > 0 ? 'bg-white text-[hsl(var(--brand-orange))] shadow-xs' : 'bg-muted text-muted-foreground'
              )}
            >
              {data ? total : '…'}
            </span>
          </button>
        </div>
      </div>

      {data && total > 0 && (
        <div className="relative mx-auto max-w-6xl px-4 pt-6 sm:px-8">
          <div className="rounded-[var(--radius-md)] border border-border bg-card">
            <button type="button" onClick={() => setZoneOpen((o) => !o)} aria-expanded={zoneOpen}
              className="flex min-h-11 w-full flex-wrap items-center gap-2 px-4 py-2 text-left">
              <BellRing className="h-4 w-4 text-[hsl(var(--brand-orange))]" />
              <span className="mr-2 text-sm font-bold">À traiter</span>
              {buildCategories(data).map((c) => (
                <span key={c.key} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold">
                  <c.icon className="h-3.5 w-3.5" /> {c.count}
                </span>
              ))}
              <ChevronDown className={cn('ml-auto h-5 w-5 text-primary transition-transform', zoneOpen && 'rotate-180')} aria-label={zoneOpen ? 'Replier' : 'Déplier'} />
            </button>
            {zoneOpen && <div className="border-t border-border p-3"><AlertsList data={data} onSeen={markSeen} onArchive={archiveMessage} compact /></div>}
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] w-[92vw] max-w-xl flex flex-col p-6 sm:p-7 rounded-2xl border border-border bg-card shadow-2xl">
          <DialogHeader className="space-y-1 text-left pb-1">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--brand-orange))]/15 text-[hsl(var(--brand-orange))]">
                <BellRing className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-xl font-extrabold tracking-tight">Alertes &amp; Rappels</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Récapitulatif de vos actions et alertes en attente.
                </DialogDescription>
              </div>
              <button
                type="button"
                disabled={refreshingMsgs}
                onClick={async () => {
                  setRefreshingMsgs(true);
                  try {
                    await refreshMessages();
                  } finally {
                    setRefreshingMsgs(false);
                  }
                }}
                title="Actualiser les messages reçus"
                className="mr-6 inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', refreshingMsgs && 'animate-spin')} />
                <span className="hidden sm:inline">Actualiser</span>
              </button>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-1 -mr-1 my-3 min-h-0 space-y-3">
            {data === null ? (
              <div className="space-y-3 py-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin text-[hsl(var(--brand-orange))]" />
                  Chargement de vos alertes et indicateurs…
                </div>
                <div className="h-16 animate-pulse rounded-xl bg-muted/60" />
                <div className="h-16 animate-pulse rounded-xl bg-muted/60" />
              </div>
            ) : total > 0 ? (
              <AlertsList data={data} onSeen={markSeen} onArchive={archiveMessage} />
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">Aucune alerte en cours.</p>
            )}

            {/* Alerte bidirectionnelle vers Christophe / Atelier Parc Machines */}
            <div className="rounded-xl border border-[#D2E9F6] bg-[#EBF6FC]/70 p-3">
              <button
                type="button"
                onClick={() => {
                  setAtelierOpen((v) => !v);
                  setAtelierSentOk(false);
                }}
                className="flex w-full items-center justify-between text-left text-xs font-bold text-[#1B4565]"
              >
                <span className="inline-flex items-center gap-2">
                  <Wrench className="h-3.5 w-3.5 text-[#39A9DC]" />
                  Alerter l&apos;Atelier / Christophe (Parc Machines)
                </span>
                <span className="text-[#3989B7]">{atelierOpen ? 'Masquer' : 'Envoyer une alerte'}</span>
              </button>

              {atelierOpen && (
                <div className="mt-2.5 space-y-2">
                  <AlertContextSelect
                    chantiers={ctxChantiers}
                    machines={ctxMachines}
                    loading={ctxLoading}
                    value={atelierContext}
                    onChange={setAtelierContext}
                    placeholder="Machine ou chantier concerné (optionnel)"
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={atelierMsg}
                      onChange={(e) => setAtelierMsg(e.target.value)}
                      placeholder="Ex: Panne câble, besoin intervention sur site..."
                      className="flex-1 rounded-lg border border-[#D2E9F6] bg-white px-2.5 py-1.5 text-xs text-[#1B4565] outline-none focus:border-[#39A9DC]"
                    />
                    <button
                      type="button"
                      disabled={atelierSending || !atelierMsg.trim()}
                      onClick={async () => {
                        if (!atelierMsg.trim()) return;
                        setAtelierSending(true);
                        try {
                          await sendAlertToMaintenance({
                            data: {
                              senderName: firstName,
                              context: atelierContext.trim() || undefined,
                              message: atelierMsg.trim(),
                            },
                          });
                          setAtelierMsg('');
                          setAtelierContext('');
                          setAtelierSentOk(true);
                        } finally {
                          setAtelierSending(false);
                        }
                      }}
                      className="inline-flex items-center gap-1 rounded-lg bg-[#39A9DC] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#3989B7] disabled:opacity-50"
                    >
                      <Send className="h-3 w-3" />
                      {atelierSending ? 'Envoi...' : 'Envoyer'}
                    </button>
                  </div>
                  {atelierSentOk && (
                    <p className="text-[11px] font-semibold text-[#0E7042]">
                      ✓ Alerte envoyée directement au Hub Maintenance / Christophe !
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-12 w-full rounded-xl bg-[hsl(var(--brand-blue))] text-base font-bold text-white shadow-md hover:opacity-95 active:scale-[0.99] transition-all cursor-pointer"
            >
              Fermer / J'ai compris
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
