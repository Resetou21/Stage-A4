import { useEffect, useState } from 'react';
import { Download, Users, Loader2 } from 'lucide-react';
import { useXlsxExport, createSpreadsheet, createTheme } from '@skills/xlsx-export.jsx';
import { getAllContacts } from '@generated/server/contacts';

type Result = { ok: boolean; date: string; count: number; message?: string };
const KEY = 'lea-hub-last-export';

export default function ContactsCard() {
  const { exportToXlsx } = useXlsxExport();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setResult(JSON.parse(raw) as Result);
    } catch { /* ignore */ }
  }, []);

  const save = (r: Result) => {
    setResult(r);
    try { localStorage.setItem(KEY, JSON.stringify(r)); } catch { /* ignore */ }
  };

  const handleDownload = async () => {
    setBusy(true);
    try {
      const res = await getAllContacts({ data: {} });
      const contacts = res?.contacts ?? [];
      if (contacts.length === 0) throw new Error('Aucun contact trouvé dans le tableau chantier.');
      const theme = createTheme({ primary: 'FF39A9DC', secondary: 'FF3989B7', accent: 'FFF7AC37', neutral: 'FFE6F4FB', font: 'Calibri' });
      const wb = createSpreadsheet({
        sheetName: 'Contacts clients',
        columns: ['INTERLOCUTEUR', 'ADRESSE MAIL'],
        rows: contacts.map((c) => [c.interlocuteur, c.adresseMail]),
        columnWidths: { 0: 40, 1: 50 },
        theme,
      });
      const d = new Date();
      const stamp = d.toISOString().slice(0, 10);
      await exportToXlsx(wb, `contacts-clients-${stamp}.xlsx`);
      save({ ok: true, date: d.toISOString(), count: contacts.length });
    } catch (e) {
      console.error(e);
      save({
        ok: false,
        date: new Date().toISOString(),
        count: 0,
        message: e instanceof Error && e.message ? e.message : 'Le téléchargement a échoué.',
      });
    } finally {
      setBusy(false);
    }
  };

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="relative rounded-[var(--radius-lg)] border border-border bg-card p-6 pt-8 sm:p-8">
      <div className="absolute -top-4 left-6 flex items-center gap-3 bg-background pr-3">
        <span className="inline-flex h-8 min-w-10 items-center justify-center rounded-[var(--radius-sm)] rounded-br-none bg-primary px-2 text-sm font-bold text-primary-foreground">01</span>
        <h2 className="text-xl font-bold">Contacts clients</h2>
      </div>

      <div className="grid gap-8 md:grid-cols-[1.3fr_1fr]">
        <div className="min-w-0">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
              <Users className="h-6 w-6" />
            </div>
            <p className="min-w-0 text-sm">
              Exportez les colonnes <strong>INTERLOCUTEUR</strong> et <strong>ADRESSE MAIL</strong> du tableau complet chantier au format Excel.
            </p>
          </div>
          <button
            type="button"
            onClick={handleDownload}
            disabled={busy}
            className="mt-8 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-primary px-5 text-sm font-bold text-primary-foreground transition hover:brightness-95 disabled:opacity-60 sm:w-auto"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {busy ? 'Préparation du fichier…' : 'Télécharger les contacts clients'}
          </button>
          <p className="mt-3 text-xs text-muted-foreground">Le fichier est enregistré dans votre dossier Téléchargements.</p>
        </div>

        <div className="border-t border-border pt-6 md:border-l md:border-t-0 md:pl-8 md:pt-0">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Dernier téléchargement</p>
          <div className="mt-3 flex items-start gap-3" role="status">
            {!result ? (
              <>
                <span className="mt-1 h-3 w-3 shrink-0 rounded-full bg-muted-foreground/40" />
                <span className="text-sm text-muted-foreground">Aucun téléchargement pour le moment</span>
              </>
            ) : result.ok ? (
              <>
                <span className="mt-1 h-3 w-3 shrink-0 rounded-full bg-[hsl(var(--success))] ring-4 ring-[hsl(var(--success))]/20" />
                <span className="text-sm">Réussi le <strong>{fmt(result.date)}</strong></span>
              </>
            ) : (
              <>
                <span className="mt-1 h-3 w-3 shrink-0 rounded-full bg-destructive ring-4 ring-destructive/20" />
                <span className="text-sm">
                  <strong className="text-destructive">Problème</strong> le {fmt(result.date)} — {result.message}
                </span>
              </>
            )}
          </div>
          <p className="mt-6 text-xs font-bold uppercase tracking-wider text-muted-foreground">Contacts téléchargés</p>
          <p className="mt-1 font-[family-name:var(--font-heading)] text-5xl font-extrabold text-[hsl(var(--brand-orange))]">
            {result?.ok ? result.count : '—'}
          </p>
        </div>
      </div>
    </div>
  );
}
