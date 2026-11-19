import {
  AlertTriangle,
  CalendarClock,
  EyeOff,
  FileSignature,
  Frown,
  ListChecks,
  Megaphone,
  PackageOpen,
  Trash2,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import type { AlertsData, Message } from '@generated/hooks/useAlerts';
import { cn } from '@lib/utils';

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

type Line = { id: string; text: string; sub?: string; date?: string | null; msg?: Message };
type Category = { key: string; icon: LucideIcon; title: string; tone: 'orange' | 'red' | 'blue'; count: number; lines?: Line[] };

export function buildCategories(d: AlertsData): Category[] {
  const isAtelierMsg = (m: Message) => {
    const t = (m.texte || '').toLowerCase();
    return t.startsWith('[parc machines') || t.startsWith('[maintenance') || t.includes('christophe');
  };
  const atelierMsgs = d.messages.filter(isAtelierMsg);
  const generalMsgs = d.messages.filter((m) => !isAtelierMsg(m));

  const cats: Category[] = [
    { key: 'atelier', icon: Wrench, title: 'Messages Atelier / Christophe (Parc Machines)', tone: 'blue', count: atelierMsgs.length,
      lines: atelierMsgs.map((m) => ({ id: m.id, text: m.texte, sub: m.client, date: m.date, msg: m })) },
    { key: 'com', icon: Megaphone, title: 'Alertes / rappels', tone: 'orange', count: generalMsgs.length,
      lines: generalMsgs.map((m) => ({ id: m.id, text: m.texte, sub: m.client, date: m.date, msg: m })) },
    { key: 'insat', icon: Frown, title: 'Clients insatisfaits (3 contrôles de suite)', tone: 'red', count: d.insatisfaits.length,
      lines: d.insatisfaits.map((q) => ({ id: q.id, text: q.chantier, sub: q.resultat ?? '', date: q.date })) },
    { key: 'c2m', icon: AlertTriangle, title: 'Contrôle insatisfaisant > 2 mois sans vérification', tone: 'red', count: d.controle2Mois.length,
      lines: d.controle2Mois.map((q) => ({ id: q.id, text: q.chantier, sub: q.resultat ?? '', date: q.date })) },
    { key: 'nv', icon: EyeOff, title: 'Chantiers non vus depuis 11 mois', tone: 'orange', count: d.nonVus11Mois.length,
      lines: d.nonVus11Mois.map((q) => ({ id: q.id, text: q.chantier, date: q.date })) },
    { key: 'v2m', icon: CalendarClock, title: 'Visites des 2 mois', tone: 'blue', count: d.visites2Mois.length,
      lines: d.visites2Mois.map((v) => ({ id: v.id, text: v.texte, date: v.date })) },
    { key: 'due', icon: ListChecks, title: 'Inventaires à faire', tone: 'blue', count: d.due },
    { key: 'recup', icon: PackageOpen, title: 'Stocks à récupérer', tone: 'blue', count: d.recup },
    { key: 'ave', icon: FileSignature, title: 'Avenants à faire', tone: 'blue', count: d.avenants },
  ];
  // Une catégorie à 0 est totalement masquée
  return cats.filter((c) => c.count > 0);
}

const toneCls = {
  orange: 'border-l-[hsl(var(--brand-orange))] text-[hsl(var(--brand-orange))]',
  red: 'border-l-destructive text-destructive',
  blue: 'border-l-primary text-primary',
};

export default function AlertsList({
  data,
  onSeen,
  onArchive,
  compact,
}: {
  data: AlertsData;
  onSeen: (m: Message) => void;
  onArchive?: (m: Message) => void;
  compact?: boolean;
}) {
  const cats = buildCategories(data);
  return (
    <div className="space-y-3">
      {cats.map((c) => (
        <section key={c.key} className={cn('rounded-xl border border-border border-l-4 bg-card shadow-xs overflow-hidden', toneCls[c.tone].split(' ')[0])}>
          <h4 className={cn('flex items-center gap-2.5 px-4 py-3 text-sm font-bold', toneCls[c.tone].split(' ')[1])}>
            <c.icon className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1 leading-snug">{c.title}</span>
            <span className="rounded-full bg-muted/80 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-foreground">{c.count}</span>
          </h4>
          {c.lines && c.lines.length > 0 && (
            <ul className={cn('divide-y divide-border border-t border-border bg-card/50', compact && 'max-h-56 overflow-y-auto')}>
              {c.lines.map((l) => (
                <li key={l.id} className="flex items-start gap-3 px-4 py-2.5 text-sm hover:bg-muted/30 transition-colors">
                  {l.msg && (
                    <div className="flex shrink-0 items-center gap-2">
                      <label className="flex min-h-6 cursor-pointer items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                        <input type="checkbox" className="h-4 w-4 rounded accent-[hsl(var(--primary))]" onChange={() => l.msg && onSeen(l.msg)} aria-label="Marquer comme vu" />
                        Vu
                      </label>
                      {onArchive && (
                        <button
                          type="button"
                          onClick={() => l.msg && onArchive(l.msg)}
                          title="Supprimer (archiver sur Monday)"
                          aria-label="Supprimer cette alerte"
                          className="inline-flex h-6 items-center gap-1 rounded-md border border-red-200 bg-red-50 px-1.5 text-[11px] font-semibold text-red-700 hover:bg-red-100 transition-colors"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium break-words text-foreground/90">{l.text}</p>
                    {l.sub && <p className="text-xs text-muted-foreground mt-0.5">{l.sub}</p>}
                  </div>
                  {l.date !== undefined && <span className="shrink-0 text-xs font-medium text-muted-foreground">{fmtDate(l.date ?? null)}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
