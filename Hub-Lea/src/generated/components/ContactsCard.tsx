import { useEffect, useState } from 'react';
import { Download, Users, Loader2, Building2, CheckCircle2, Filter } from 'lucide-react';
import { toast } from 'sonner';
import { useXlsxExport, createSpreadsheet, createTheme, isAndroidMondayWebView } from '@skills/xlsx-export';
import { getAllContacts, type RawChantierItem } from '@generated/server/contacts';

type ExportType = 'dedup' | 'full';
type Result = {
  ok: boolean;
  date: string;
  count: number;
  type: ExportType;
  message?: string;
};

const KEY = 'lea-hub-last-export-v2';

export default function ContactsCard() {
  const { exportToXlsx } = useXlsxExport();
  const [busyType, setBusyType] = useState<ExportType | null>(null);
  const [scope, setScope] = useState<'en_cours' | 'all'>('en_cours');
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setResult(JSON.parse(raw) as Result);
    } catch {
      // ignore
    }
  }, []);

  const save = (r: Result) => {
    setResult(r);
    try {
      localStorage.setItem(KEY, JSON.stringify(r));
    } catch {
      // ignore
    }
  };

  const handleDownload = async (type: ExportType) => {
    if (isAndroidMondayWebView()) {
      toast.info('Export Excel disponible depuis un navigateur PC ou Chrome.');
      return;
    }
    setBusyType(type);
    try {
      const res = await getAllContacts({ data: {} });
      const rawItems: RawChantierItem[] = res?.items ?? [];

      if (rawItems.length === 0) {
        throw new Error('Aucun chantier trouvé dans le tableau Monday.');
      }

      // Filtrage selon le périmètre sélectionné
      const targetItems =
        scope === 'en_cours' ? rawItems.filter((r) => r.isEnCours) : rawItems;

      if (targetItems.length === 0) {
        throw new Error('Aucun contact trouvé pour le périmètre sélectionné.');
      }

      const theme = createTheme({
        primary: 'FF39A9DC',
        secondary: 'FF3989B7',
        accent: 'FFF7AC37',
        neutral: 'FFE1F2FA',
        font: 'Calibri',
      });

      const d = new Date();
      const stamp = d.toISOString().slice(0, 10);

      if (type === 'dedup') {
        // Dédoublonnage par email unique (ou par nom si pas d'email)
        const map = new Map<
          string,
          {
            interlocuteur: string;
            adresseMail: string;
            telephone: string;
            chantiers: string[];
          }
        >();

        for (const item of targetItems) {
          const key = item.adresseMail
            ? item.adresseMail.toLowerCase()
            : `name::${item.interlocuteur.toLowerCase()}`;

          if (!map.has(key)) {
            map.set(key, {
              interlocuteur: item.interlocuteur,
              adresseMail: item.adresseMail,
              telephone: item.telephone,
              chantiers: item.chantier ? [item.chantier] : [],
            });
          } else {
            const cur = map.get(key)!;
            if (!cur.interlocuteur && item.interlocuteur) cur.interlocuteur = item.interlocuteur;
            if (!cur.telephone && item.telephone) cur.telephone = item.telephone;
            if (item.chantier && !cur.chantiers.includes(item.chantier)) {
              cur.chantiers.push(item.chantier);
            }
          }
        }

        const dedupList = Array.from(map.values()).sort((a, b) =>
          (a.interlocuteur || a.adresseMail).localeCompare(b.interlocuteur || b.adresseMail, 'fr')
        );

        const wb = createSpreadsheet({
          sheetName: 'Contacts uniques',
          columns: ['INTERLOCUTEUR', 'ADRESSE MAIL', 'TELEPHONE', 'CHANTIERS ASSOCIES', 'NB CHANTIERS'],
          rows: dedupList.map((c) => [
            c.interlocuteur,
            c.adresseMail,
            c.telephone,
            c.chantiers.join(', '),
            c.chantiers.length,
          ]),
          columnWidths: { 0: 35, 1: 45, 2: 25, 3: 60, 4: 15 },
          theme,
        });

        const filename = `contacts-clients-uniques-${scope}-${stamp}.xlsx`;
        const ok = await exportToXlsx(wb, filename);
        if (!ok) {
          toast.info('Export Excel disponible depuis un navigateur PC ou Chrome.');
          return;
        }

        save({ ok: true, date: d.toISOString(), count: dedupList.length, type: 'dedup' });
        toast.success(`Export réussi : ${dedupList.length} contacts uniques téléchargés !`);
      } else {
        // Export complet par chantier
        const sortedItems = [...targetItems].sort((a, b) =>
          a.chantier.localeCompare(b.chantier, 'fr')
        );

        const includeGroupCol = scope === 'all';
        const columns = includeGroupCol
          ? ['CHANTIER', 'STATUT / GROUPE', 'INTERLOCUTEUR', 'TELEPHONE', 'ADRESSE MAIL']
          : ['CHANTIER', 'INTERLOCUTEUR', 'TELEPHONE', 'ADRESSE MAIL'];

        const rows = sortedItems.map((c) =>
          includeGroupCol
            ? [c.chantier, c.groupTitle, c.interlocuteur, c.telephone, c.adresseMail]
            : [c.chantier, c.interlocuteur, c.telephone, c.adresseMail]
        );

        const columnWidths = includeGroupCol
          ? { 0: 45, 1: 30, 2: 35, 3: 25, 4: 45 }
          : { 0: 45, 1: 35, 2: 25, 3: 45 };

        const wb = createSpreadsheet({
          sheetName: 'Liste par chantier',
          columns,
          rows,
          columnWidths,
          theme,
        });

        const filename = `contacts-clients-par-chantier-${scope}-${stamp}.xlsx`;
        const ok = await exportToXlsx(wb, filename);
        if (!ok) {
          toast.info('Export Excel disponible depuis un navigateur PC ou Chrome.');
          return;
        }

        save({ ok: true, date: d.toISOString(), count: sortedItems.length, type: 'full' });
        toast.success(`Export réussi : ${sortedItems.length} chantiers exportés !`);
      }
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error && e.message ? e.message : 'Le téléchargement a échoué.';
      save({
        ok: false,
        date: new Date().toISOString(),
        count: 0,
        type,
        message: msg,
      });
      toast.error(msg);
    } finally {
      setBusyType(null);
    }
  };

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <div className="relative rounded-[var(--radius-lg)] border border-border bg-card p-4 pt-8 sm:p-8 shadow-sm">
      <div className="absolute -top-4 left-4 sm:left-6 flex items-center gap-3 bg-background pr-3">
        <span className="inline-flex h-8 min-w-10 items-center justify-center rounded-[var(--radius-sm)] rounded-br-none bg-primary px-2 text-sm font-bold text-primary-foreground">
          01
        </span>
        <h2 className="text-lg sm:text-xl font-bold">Contacts clients &amp; Chantiers</h2>
      </div>

      {/* Barre de sélection de périmètre */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] bg-muted/50 p-3 sm:px-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          <Filter className="h-4 w-4 text-primary" />
          <span>Périmètre des chantiers :</span>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <button
            type="button"
            onClick={() => setScope('en_cours')}
            className={`flex-1 sm:flex-none rounded-[var(--radius-sm)] px-3 py-2 text-xs font-bold transition cursor-pointer ${
              scope === 'en_cours'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-background text-foreground hover:bg-muted'
            }`}
          >
            Chantiers en cours (Actifs)
          </button>
          <button
            type="button"
            onClick={() => setScope('all')}
            className={`flex-1 sm:flex-none rounded-[var(--radius-sm)] px-3 py-2 text-xs font-bold transition cursor-pointer ${
              scope === 'all'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-background text-foreground hover:bg-muted'
            }`}
          >
            Tous les chantiers (avec archives &amp; perdus)
          </button>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        {/* Colonne gauche : Les deux options de téléchargement */}
        <div className="flex flex-col gap-5 min-w-0">
          {/* Option A : Contacts uniques dédoublonnés */}
          <div className="rounded-[var(--radius-md)] border border-border/80 bg-background/60 p-4 transition hover:border-primary/50">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Users className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-foreground">Contacts uniques (dédoublonnés)</h3>
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-bold text-primary">
                    Recommandé mailing
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  Idéal pour envoyer un emailing ou des vœux sans envoyer plusieurs fois le même message. Chaque
                  adresse email n'apparaît <strong>qu'une seule fois</strong> avec la liste des chantiers associés.
                </p>
                <button
                  type="button"
                  onClick={() => handleDownload('dedup')}
                  disabled={busyType !== null}
                  className="mt-3 inline-flex min-h-10 w-full sm:w-auto items-center justify-center gap-2 rounded-[var(--radius-sm)] bg-primary px-4 text-xs font-bold text-primary-foreground transition hover:brightness-95 disabled:opacity-60"
                >
                  {busyType === 'dedup' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  {busyType === 'dedup'
                    ? 'Préparation du fichier…'
                    : 'Télécharger les contacts uniques (dédoublonnés)'}
                </button>
              </div>
            </div>
          </div>

          {/* Option B : Liste complète par chantier */}
          <div className="rounded-[var(--radius-md)] border border-border/80 bg-background/60 p-4 transition hover:border-primary/50">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
                <Building2 className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-foreground">Liste complète par chantier</h3>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                    1 ligne par chantier
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  Export détaillé pour identifier qui gère quel site. Comprend les colonnes <strong>Chantier</strong>,{' '}
                  <strong>Interlocuteur</strong>, <strong>Téléphone</strong> et <strong>Email</strong>.
                </p>
                <button
                  type="button"
                  onClick={() => handleDownload('full')}
                  disabled={busyType !== null}
                  className="mt-3 inline-flex min-h-10 w-full sm:w-auto items-center justify-center gap-2 rounded-[var(--radius-sm)] border-2 border-primary bg-background px-4 text-xs font-bold text-primary transition hover:bg-primary/10 disabled:opacity-60"
                >
                  {busyType === 'full' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  {busyType === 'full'
                    ? 'Préparation du fichier…'
                    : 'Télécharger la liste complète par chantier'}
                </button>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground italic">
            Les fichiers Excel générés respectent la charte Groupe Facility (en-têtes bleus, filtres automatiques, volet
            figé et lignes zébrées).
            {isAndroidMondayWebView() && (
              <span className="mt-1 block not-italic font-semibold text-primary">
                ℹ️ Sur téléphone/tablette Android, ouvrez le Hub dans Chrome ou sur PC pour exporter les fichiers Excel.
              </span>
            )}
          </p>
        </div>

        {/* Colonne droite : Dernier téléchargement & compteurs */}
        <div className="border-t border-border pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0 flex flex-col justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Dernier téléchargement
            </p>
            <div className="mt-3 flex items-start gap-3" role="status">
              {!result ? (
                <>
                  <span className="mt-1 h-3 w-3 shrink-0 rounded-full bg-muted-foreground/40" />
                  <span className="text-xs text-muted-foreground">Aucun téléchargement pour le moment</span>
                </>
              ) : result.ok ? (
                <>
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[hsl(var(--success))]" />
                  <div className="text-xs">
                    <p className="font-semibold text-foreground">
                      Réussi le {fmt(result.date)}
                    </p>
                    <p className="text-muted-foreground mt-0.5">
                      {result.type === 'dedup' ? 'Contacts uniques' : 'Liste par chantier'} ({result.count} lignes)
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <span className="mt-1 h-3 w-3 shrink-0 rounded-full bg-destructive ring-4 ring-destructive/20" />
                  <span className="text-xs text-destructive">
                    <strong>Erreur</strong> le {fmt(result.date)} : {result.message}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Cartes d'indicateurs métier */}
          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-[var(--radius-md)] border border-border bg-muted/30 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Contacts uniques
              </p>
              <p className="mt-1 font-[family-name:var(--font-heading)] text-3xl font-extrabold text-[hsl(var(--brand-orange))]">
                {scope === 'en_cours' ? '~291' : '~321'}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">sans doublon d'email</p>
            </div>

            <div className="rounded-[var(--radius-md)] border border-border bg-muted/30 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Chantiers avec contact
              </p>
              <p className="mt-1 font-[family-name:var(--font-heading)] text-3xl font-extrabold text-primary">
                {scope === 'en_cours' ? '~346' : '~420'}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {scope === 'en_cours' ? 'sur 371 chantiers actifs' : 'sur 535 chantiers totaux'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
