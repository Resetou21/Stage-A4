import { useEffect, useState } from 'react';
import { Bell, BellRing, ChevronDown, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@components/ui/dialog';
import AlertsList, { buildCategories } from '@generated/components/AlertsList';
import { totalAlerts, useAlerts } from '@generated/hooks/useAlerts';
import { cn } from '@lib/utils';

const NAV = [
  { href: '#formulaires', label: 'Formulaires' },
  { href: '#visites', label: 'Visites clients' },
  { href: '#chantiers', label: 'Tableau complet chantier' },
  { href: '#inventaire', label: 'Stocks & inventaires' },
];

export default function AlertsCenter({ firstName }: { firstName: string }) {
  const { data, markSeen } = useAlerts(firstName);
  const [open, setOpen] = useState(false);
  const [zoneOpen, setZoneOpen] = useState(false);
  const total = totalAlerts(data);

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

  return (
    <>
      <div className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur shadow-xs">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-2 sm:px-8">
          <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto no-scrollbar py-0.5" aria-label="Navigation rapide">
            {NAV.map((n) => (
              <button
                key={n.href}
                type="button"
                onClick={() => jump(n.href)}
                className="min-h-9 sm:min-h-10 shrink-0 rounded-lg px-2.5 sm:px-3 text-xs sm:text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors whitespace-nowrap"
              >
                {n.label}
              </button>
            ))}
          </nav>
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
            {zoneOpen && <div className="border-t border-border p-3"><AlertsList data={data} onSeen={markSeen} compact /></div>}
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
              <AlertsList data={data} onSeen={markSeen} />
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">Aucune alerte en cours.</p>
            )}
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
