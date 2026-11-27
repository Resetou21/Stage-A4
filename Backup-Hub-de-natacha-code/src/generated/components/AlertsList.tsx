import {
  AlertTriangle,
  CalendarClock,
  EyeOff,
  FileSignature,
  Frown,
  ListChecks,
  Megaphone,
  PackageOpen,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import type { AlertsData, FinContratAlert, Message } from '@generated/hooks/useAlerts';
import { cn } from '@lib/utils';

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const fmtDateJJMM = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) : '—');

const MONTHS_MAP: Record<string, string> = {
  january: '01', jan: '01', janvier: '01', 'janv.': '01',
  february: '02', feb: '02', février: '02', fevrier: '02', 'févr.': '02', fev: '02',
  march: '03', mar: '03', mars: '03',
  april: '04', apr: '04', avril: '04', 'avr.': '04',
  may: '05', mai: '05',
  june: '06', jun: '06', juin: '06',
  july: '07', jul: '07', juillet: '07', 'juil.': '07',
  august: '08', aug: '08', août: '08', aout: '08',
  september: '09', sep: '09', sept: '09', septembre: '09', 'sept.': '09',
  october: '10', oct: '10', octobre: '10', 'oct.': '10',
  november: '11', nov: '11', novembre: '11', 'nov.': '11',
  december: '12', dec: '12', décembre: '12', decembre: '12', 'déc.': '12',
};

const MONTH_PATTERN = Object.keys(MONTHS_MAP).map((k) => k.replace('.', '\\.')).join('|');
const RE_DAY_MONTH = new RegExp(`\\b(\\d{1,2})\\s+(${MONTH_PATTERN})(?:\\s+\\d{4})?\\b`, 'gi');
const RE_MONTH_DAY = new RegExp(`\\b(${MONTH_PATTERN})\\s+(\\d{1,2})(?:,?\\s+\\d{4})?\\b`, 'gi');
const RE_ISO_DATE = /\b\d{4}-(\d{2})-(\d{2})\b/g;

function formatAlertTextDatesJJMM(text: string): string {
  if (!text) return text;
  return text
    .replace(RE_DAY_MONTH, (_m, d, mon) => {
      const mm = MONTHS_MAP[String(mon).toLowerCase()];
      return mm ? `${String(d).padStart(2, '0')}/${mm}` : _m;
    })
    .replace(RE_MONTH_DAY, (_m, mon, d) => {
      const mm = MONTHS_MAP[String(mon).toLowerCase()];
      return mm ? `${String(d).padStart(2, '0')}/${mm}` : _m;
    })
    .replace(RE_ISO_DATE, (_m, mm, dd) => `${dd}/${mm}`);
}

type Line = {
  id: string;
  text: string;
  sub?: string;
  date?: string | null;
  dateFormat?: 'jjmm';
  msg?: Message;
  finContrat?: FinContratAlert;
};
type Category = { key: string; icon: LucideIcon; title: string; tone: 'orange' | 'red' | 'blue'; count: number; lines?: Line[] };

export function buildCategories(d: AlertsData): Category[] {
  const isAtelierMsg = (m: Message) => {
    const t = (m.texte || '').toLowerCase();
    return t.startsWith('[parc machines') || t.startsWith('[maintenance') || t.includes('christophe');
  };
  const atelierMsgs = d.messages.filter(isAtelierMsg);
  const generalMsgs = d.messages.filter((m) => !isAtelierMsg(m));

  const formatFinContratSub = (f: FinContratAlert) => {
    if (f.daysRemaining > 0) return `Fin de contrat dans ${f.daysRemaining} j. — récupérer matériel & produits`;
    if (f.daysRemaining === 0) return `Fin de contrat aujourd'hui — récupérer matériel & produits`;
    return `Contrat terminé depuis ${Math.abs(f.daysRemaining)} j. — vérifier récupération matériel & produits`;
  };

  const cats: Category[] = [
    {
      key: 'fin_contrat',
      icon: PackageOpen,
      title: 'Fin de contrat (J-15) — Matériel & produits à récupérer',
      tone: 'red',
      count: d.finContratMateriel.length,
      lines: d.finContratMateriel.map((f) => ({
        id: f.id,
        text: f.chantier,
        sub: formatFinContratSub(f),
        date: f.dateFin,
        finContrat: f,
      })),
    },
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
      lines: d.visites2Mois.map((v) => ({ id: v.id, text: formatAlertTextDatesJJMM(v.texte), date: v.date, dateFormat: 'jjmm' as const })) },
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
  onFinContratSeen,
  compact,
}: {
  data: AlertsData;
  onSeen: (m: Message) => void;
  onFinContratSeen?: (f: FinContratAlert) => void;
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
                  {(l.msg || l.finContrat) && (
                    <div className="flex shrink-0 items-center gap-2">
                      <label className="flex min-h-6 cursor-pointer items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded accent-[hsl(var(--primary))]"
                          onChange={() => {
                            if (l.msg) onSeen(l.msg);
                            else if (l.finContrat && onFinContratSeen) onFinContratSeen(l.finContrat);
                          }}
                          aria-label="Marquer comme vu"
                        />
                        Vu
                      </label>
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium break-words text-foreground/90">{l.text}</p>
                    {l.sub && <p className="text-xs text-muted-foreground mt-0.5">{l.sub}</p>}
                    {l.finContrat && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {l.finContrat.hasHygiene ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800 border border-amber-200">
                            🧻 Produits hygiène : Oui
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground border border-border">
                            🧻 Produits hygiène : Non
                          </span>
                        )}
                        {l.finContrat.machines.length > 0 && (
                          <span
                            className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-800 border border-red-200"
                            title={l.finContrat.machines.join(', ')}
                          >
                            🔧 {l.finContrat.machines.length} machine{l.finContrat.machines.length > 1 ? 's' : ''} ({l.finContrat.machines.slice(0, 2).join(', ')}{l.finContrat.machines.length > 2 ? '…' : ''})
                          </span>
                        )}
                        {l.finContrat.cleInfo && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-800 border border-sky-200">
                            🔑 {l.finContrat.cleInfo}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  {l.date !== undefined && (
                    <span className="shrink-0 text-xs font-medium text-muted-foreground whitespace-nowrap">
                      {l.dateFormat === 'jjmm' ? fmtDateJJMM(l.date ?? null) : fmtDate(l.date ?? null)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
