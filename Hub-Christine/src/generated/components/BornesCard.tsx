import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Car, Info, Loader2, Upload, X, Check, Download, AlertTriangle, Eye, ShieldCheck, Clock, Zap } from 'lucide-react';
import UsersBadge from '@generated/components/UsersBadge';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@components/ui/dialog';
import { getWellborneMois } from '@generated/server/chargemap';
import { getWellborneNames, getWellborneMonthlyStats, importWellborne, getWellborneMonthCharges } from '@generated/server/wellborne';
import { readSheet } from '@generated/components/readSheet';

type Mois = { mois: string; ym: string; present: boolean; count: number };
const pad = (n: number) => String(n).padStart(2, '0');

// Date Excel (nombre de jours) → « AAAA-MM-JJ HH:MM:SS »
function excelDate(v: string, header: string): string {
  if (!/time/i.test(header) || !/^\d{5}(\.\d+)?$/.test(v.trim())) return v;
  const d = new Date(Math.round((Number(v) - 25569) * 86400000));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

function parseRowDate(str: string): string {
  const match = str.match(/(\d{4})[-/.](\d{2})[-/.](\d{2})/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  const fr = str.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (fr) return `${fr[3]}-${pad(Number(fr[2]))}-${pad(Number(fr[1]))}`;
  return '';
}

interface WellborneAnalysis {
  file: File;
  headers: string[];
  rowsToImport: string[][];
  totalFileRows: number;
  skippedBefore15May: number;
  duplicateCount: number;
  newCount: number;
  suggestedName: string;
  minDate: string;
  maxDate: string;
  preview: { date: string; kwh: string; isDuplicate: boolean; isBeforeMay15: boolean }[];
}

interface ScanHistoryEntry {
  id: string;
  timestamp: string;
  originalName: string;
  renamedName: string;
  periodText: string;
  imported: number;
  duplicates: number;
  skippedBeforeMay15: number;
}

export default function BornesCard() {
  const [mois, setMois] = useState<Mois[]>([]);
  const [monthlyCounts, setMonthlyCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);

  // Analyse et prévisualisation avant import
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<WellborneAnalysis | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Prévisualisation interactive au clic sur un mois Wellborne
  const [selectedBornesMonth, setSelectedBornesMonth] = useState<{
    label: string;
    ym: string;
    moisStr: string;
    count: number;
    present: boolean;
  } | null>(null);

  // Historique des 3 derniers imports Wellborne avec horodatage et période
  const [history, setHistory] = useState<ScanHistoryEntry[]>(() => {
    try {
      const saved = localStorage.getItem('hub_christine_history_wellborne');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const years = Array.from(new Set(mois.map((m) => m.ym.slice(0, 4)).filter(Boolean)));
  const displayYear = years.length > 0 ? years.join(' - ') : String(new Date().getFullYear());
  const year = displayYear;
  const [exporting, setExporting] = useState(false);

  // Téléchargement immédiat du fichier Excel / CSV des charges de ce mois
  const handleDownloadXls = async () => {
    if (!selectedBornesMonth) return;
    setExporting(true);
    try {
      const res = await getWellborneMonthCharges({ data: { ym: selectedBornesMonth.ym } });
      const charges = res?.charges ?? [];
      if (!charges.length) {
        toast.info(`Aucune charge trouvée pour ${selectedBornesMonth.label} ${year}.`);
        return;
      }

      const headers = ['StartTime', 'EndTime', 'Duration(min)', 'Energy(kwh)'];
      const rows = charges.map((c) => [c.startTime, c.endTime, c.duration, c.energyKwh]);

      const content = [
        headers.join(';'),
        ...rows.map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(';')),
      ].join('\r\n');

      const filename = `WELLBORNE_${selectedBornesMonth.ym}_BORNE.csv`;
      const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`${charges.length} charges exportées avec succès dans ${filename} !`);
    } catch (err) {
      console.error(err);
      toast.error("Impossible d'exporter les charges.");
    } finally {
      setExporting(false);
    }
  };

  const load = useCallback(() => {
    setLoading(true);
    getWellborneMois()
      .then((rMois) => {
        setMois(rMois?.mois ?? []);
        setMonthlyCounts(rMois?.counts ?? {});
        setError(false);
      })
      .catch((e) => {
        console.error(e);
        setError(true);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Analyse du fichier : filtre < 15-05, doublons exhaustifs et comptage mensuel
  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setAnalyzing(true);
    try {
      const [headers = [], ...body] = await readSheet(file);
      const all = body.map((r) => headers.map((h, i) => excelDate(r[i] ?? '', h)));
      const nameIdx = headers.findIndex((h) => h.replace(/\s+/g, '').toLowerCase() === 'starttime');
      if (nameIdx < 0) throw new Error('Colonne « StartTime » absente du fichier Excel Wellborne');

      const kwhIdx = headers.findIndex((h) => /kwh|energy/i.test(h));

      toast.info('Vérification exhaustive des doublons sur Monday (4000+ lignes)...');
      const existing = new Set((await getWellborneNames())?.names ?? []);

      let skippedBefore15May = 0;
      let duplicateCount = 0;
      let newCount = 0;
      const rowsToImport: string[][] = [];

      let minDate = '';
      let maxDate = '';

      const preview: { date: string; kwh: string; isDuplicate: boolean; isBeforeMay15: boolean }[] = [];

      all.forEach((r, idx) => {
        const rawDateStr = (r[nameIdx] ?? '').trim();
        const dateIso = parseRowDate(rawDateStr);
        const kwh = kwhIdx >= 0 ? r[kwhIdx] || '0' : '0';

        if (dateIso) {
          if (!minDate || dateIso < minDate) minDate = dateIso;
          if (!maxDate || dateIso > maxDate) maxDate = dateIso;
        }

        // RÈGLE MÉTIER STRICTE : "tout ce qui est avant le 15-05 je ne télécharge pas"
        const isBeforeMay15 = Boolean(dateIso && dateIso < '2026-05-15');
        const isDuplicate = existing.has(rawDateStr);

        if (isBeforeMay15) {
          skippedBefore15May++;
        } else if (isDuplicate) {
          duplicateCount++;
        } else {
          newCount++;
          existing.add(rawDateStr); // éviter les doublons internes au fichier
          rowsToImport.push(r);
        }

        if (idx < 50 || isDuplicate || isBeforeMay15) {
          preview.push({
            date: rawDateStr,
            kwh,
            isDuplicate,
            isBeforeMay15,
          });
        }
      });

      // Renommage automatique : WELLBORNE_[DATE_MIN]_au_[DATE_MAX].xlsx
      const ext = file.name.endsWith('.csv') ? '.csv' : '.xlsx';
      const suggestedName =
        minDate && maxDate
          ? `WELLBORNE_${minDate}_au_${maxDate}${ext}`
          : `WELLBORNE_${new Date().toISOString().slice(0, 10)}${ext}`;

      setAnalysis({
        file,
        headers,
        rowsToImport,
        totalFileRows: all.length,
        skippedBefore15May,
        duplicateCount,
        newCount,
        suggestedName,
        minDate,
        maxDate,
        preview: preview.slice(0, 30),
      });

      setPreviewOpen(true);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Échec de l'analyse du fichier.");
    } finally {
      setAnalyzing(false);
    }
  };

  // Exécution de l'import validé par lots de 50 avec pause de 1 seconde
  const confirmImport = async () => {
    if (!analysis) return;
    setPreviewOpen(false);

    const { headers, rowsToImport, suggestedName, file, minDate, maxDate, skippedBefore15May, duplicateCount } =
      analysis;
    const total = rowsToImport.length;
    let created = 0;

    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

    try {
      // Import par lots de 50 avec 1 seconde de pause
      for (let i = 0; i < total; i += 50) {
        if (i > 0) {
          setImporting(`Pause 1s de conformité... (${i}/${total})`);
          await wait(1000); // 1 seconde de pause demandée
        }

        setImporting(`Import en cours : ${Math.min(i + 50, total)} / ${total}`);

        for (let attempt = 0; ; attempt++) {
          try {
            const res = await importWellborne({
              data: { headers, rows: rowsToImport.slice(i, i + 50) },
            });
            created += res?.created ?? 0;
            break;
          } catch (err) {
            const limited = err instanceof Error && /429|rate|limit|complexity/i.test(err.message);
            if (!limited || attempt >= 3) throw err;
            setImporting(`Pause de sécurité Monday... (${Math.min(i + 50, total)}/${total})`);
            await wait(3000 * (attempt + 1));
          }
        }
      }

      // Enregistrement dans l'historique des 3 dernières factures scannées
      const periodText = minDate && maxDate ? `Du ${minDate} au ${maxDate}` : 'Période analysée';
      const newEntry: ScanHistoryEntry = {
        id: Date.now().toString(),
        timestamp: new Date().toLocaleString('fr-FR'),
        originalName: file.name,
        renamedName: suggestedName,
        periodText,
        imported: created,
        duplicates: duplicateCount,
        skippedBeforeMay15: skippedBefore15May,
      };

      const updatedHistory = [newEntry, ...history.slice(0, 2)];
      setHistory(updatedHistory);
      try {
        localStorage.setItem('hub_christine_history_wellborne', JSON.stringify(updatedHistory));
      } catch { }

      toast.success(
        `${created} nouvelle(s) charge(s) importée(s) ! (${duplicateCount} doublons et ${skippedBefore15May} lignes avant le 15-05 ignorées)`
      );
      load();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Échec lors de l'import.");
    } finally {
      setImporting(null);
      setAnalysis(null);
    }
  };

  // Télécharger le fichier sous son nom normalisé
  const downloadRenamed = () => {
    if (!analysis) return;
    const url = URL.createObjectURL(analysis.file);
    const a = document.createElement('a');
    a.href = url;
    a.download = analysis.suggestedName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Fichier téléchargé : ${analysis.suggestedName}`);
  };

  return (
    <div className="flex h-full min-h-56 w-full flex-col justify-between rounded-2xl border border-border bg-card p-5 shadow-sm">
      {/* En-tête de carte */}
      <div>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-[family-name:var(--font-heading)] text-lg font-bold text-foreground">
              Montant Wellborne {year}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Bornes électriques • Filtre après 15-05 • Pause 1s/50
            </p>
          </div>

          <div className="flex items-center gap-1">
            <UsersBadge boardId={5106822028} />

            <Dialog>
              <DialogTrigger
                aria-label="Informations"
                className="-mr-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
              >
                <Info className="h-4 w-4" />
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                    Information & Procédure Wellborne
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-3 text-sm leading-relaxed">
                  <div className="rounded-lg bg-primary/10 p-3 text-xs font-medium text-primary">
                    ⚡ <strong>Filtre strict de date :</strong> Conformément aux consignes, toutes les charges situées{' '}
                    <strong>avant le 15-05</strong> sont automatiquement filtrées et non importées. Seules les charges
                    récentes à partir du 15 mai sont intégrées.
                  </div>

                  <ol className="list-decimal space-y-2 pl-5 text-xs">
                    <li>
                      Rendez-vous sur{' '}
                      <a
                        href="https://wellborneplus.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-primary underline"
                      >
                        wellborneplus.com
                      </a>
                      .
                    </li>
                    <li>Connectez-vous avec les identifiants du fichier « Codes fournisseurs ».</li>
                    <li>Allez dans « Transaction » puis « Historique de charge ».</li>
                    <li>Cliquez sur le nuage avec la flèche de téléchargement.</li>
                    <li>
                      <strong>Fichier toujours identique :</strong> Le fichier téléchargé s'appelle souvent de la même
                      façon (ex. <em>Enregistrement de charge.xlsx</em>). Le Hub analyse automatiquement les dates du fichier
                      et vous propose de le renommer proprement avec la période couverte.
                    </li>
                  </ol>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Témoins visuels des mois avec COMPTEUR RÉEL D'ÉLÉMENTS PAR MOIS ET PRÉVISUALISATION AU CLIC */}
        <div className="my-3 grid grid-cols-6 gap-1.5">
          {loading
            ? Array.from({ length: 6 }, (_, i) => (
              <div key={`s${i}`} className="h-16 animate-pulse rounded-lg bg-muted" />
            ))
            : mois.map((m) => {
              const label = new Date(m.mois).toLocaleDateString('fr-FR', { month: 'short', timeZone: 'UTC' });
              const count = monthlyCounts[m.ym] || m.count || 0;
              return (
                <button
                  type="button"
                  key={m.mois}
                  onClick={() =>
                    setSelectedBornesMonth({
                      label: label.replace('.', ''),
                      ym: m.ym,
                      moisStr: m.mois,
                      count,
                      present: m.present,
                    })
                  }
                  title={`Cliquer pour prévisualiser ${label} : ${count} charge(s)`}
                  className={`flex h-16 flex-col items-center justify-between rounded-lg border p-1 text-xs transition-all cursor-pointer hover:scale-105 ${m.present
                    ? 'border-primary/40 bg-primary/10 text-primary'
                    : 'border-destructive/40 bg-destructive/10 text-destructive'
                    }`}
                >
                  <span className="capitalize font-medium text-[11px]">{label.replace('.', '')}</span>
                  {m.present ? <Car className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                  <span className="font-bold text-[10px] tabular-nums">
                    {count > 0 ? `${count} ch.` : '0'}
                  </span>
                </button>
              );
            })}
        </div>

        {/* MODALE DE PRÉVISUALISATION D'UN MOIS WELLBORNE AU CLIC */}
        <Dialog open={!!selectedBornesMonth} onOpenChange={(o) => !o && setSelectedBornesMonth(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base font-bold">
                <Zap className="h-5 w-5 text-emerald-600" />
                Charges Bornes Wellborne — {selectedBornesMonth?.label} {year}
              </DialogTitle>
            </DialogHeader>

            {selectedBornesMonth && (
              <div className="space-y-3.5 text-xs mt-1">
                {/* Badge compteur */}
                <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-900 flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-black text-emerald-700">
                      {selectedBornesMonth.count} charges
                    </div>
                    <div className="text-[11px] text-emerald-700 font-medium">
                      Enregistrées sur le tableau Monday
                    </div>
                  </div>
                  <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded bg-white border border-emerald-300 text-emerald-800">
                    {selectedBornesMonth.count > 0 ? 'Mois Actif' : '0 Donnée'}
                  </span>
                </div>

                {/* Détails techniques */}
                <div className="rounded-xl border border-border bg-card p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Filtre strict de date :</span>
                    <span className="font-bold text-foreground">Charges &gt; 15-05-{year} uniquement</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Cadencement anti-blocage :</span>
                    <span className="font-semibold text-foreground">Pause de 1s toutes les 50 lignes</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Tableau relié :</span>
                    <span className="font-bold text-primary">Data sur véhicule / Bornes (5106822028)</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Nom normé de fichier :</span>
                    <span className="font-mono text-[11px] font-bold text-foreground bg-muted px-1.5 py-0.5 rounded">
                      WELLBORNE_{selectedBornesMonth.ym}_BORNE.xlsx
                    </span>
                  </div>
                </div>

                {/* Règle métier & Sources */}
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-[11px] text-muted-foreground leading-relaxed space-y-1.5">
                  <div>
                    ⚡ <strong>Règle Wellborne :</strong> Le fichier téléchargé sur <a href="https://wellborneplus.com" target="_blank" rel="noopener noreferrer" className="font-bold text-primary underline">wellborneplus.com</a> est toujours nommé à l'identique (<em>Enregistrement de charge.xlsx</em>). Le moteur compare chaque ligne avec les 4000+ existantes et ignore silencieusement les doublons.
                  </div>
                  <div className="text-[10px] text-muted-foreground border-t border-primary/10 pt-1.5 flex items-center justify-between">
                    <span>Export direct :</span>
                    <span className="font-medium text-foreground">Fichier Excel/CSV formaté prêt pour analyse</span>
                  </div>
                </div>

                {/* Actions : Télécharger le fichier existant OU Importer un nouveau */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleDownloadXls}
                    disabled={exporting || selectedBornesMonth.count === 0}
                    className="h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition disabled:opacity-50 cursor-pointer"
                    title="Télécharger le fichier Excel/CSV des charges de ce mois"
                  >
                    {exporting ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Génération Excel...</span>
                      </>
                    ) : (
                      <>
                        <Download className="h-3.5 w-3.5" />
                        <span>Télécharger le XLS ({selectedBornesMonth.count})</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedBornesMonth(null);
                      inputRef.current?.click();
                    }}
                    className="h-10 rounded-xl bg-primary text-primary-foreground font-bold text-xs flex items-center justify-center gap-2 hover:opacity-95 shadow-xs transition cursor-pointer"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    <span>Importer un fichier</span>
                  </button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {error && <p className="text-xs text-destructive">Impossible de vérifier les mois sur Monday.</p>}

        {/* Historique des 3 dernières factures scannées Wellborne avec horodatage & période */}
        {history.length > 0 && (
          <div className="mt-3 rounded-lg border border-border/80 bg-muted/30 p-2.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
              3 derniers imports Wellborne (avec période) :
            </p>
            <ul className="space-y-1.5 text-xs">
              {history.map((h) => (
                <li key={h.id} className="text-[11px] text-muted-foreground">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground truncate max-w-[170px]" title={h.renamedName}>
                      ⚡ {h.renamedName}
                    </span>
                    <span className="text-emerald-600 font-bold shrink-0">{h.imported} charges</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-0.5">
                    <span>{h.periodText}</span>
                    <span>{h.timestamp}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Bouton d'import */}
      <div className="mt-4">
        <input ref={inputRef} type="file" accept=".xlsx,.csv" className="hidden" onChange={onFile} />
        <button
          type="button"
          disabled={!!importing || analyzing}
          onClick={() => inputRef.current?.click()}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-95 disabled:opacity-60 cursor-pointer"
        >
          {analyzing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Analyse des 4000+ lignes…
            </>
          ) : importing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> {importing}
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" /> Importer fichier Wellborne
            </>
          )}
        </button>
      </div>

      {/* MODAL DE PRÉVISUALISATION WELLBORNE (FILTRE < 15-05, DOUBLONS, RENOMMAGE) */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Eye className="h-5 w-5 text-primary" />
              Contrôle avant import Wellborne
            </DialogTitle>
          </DialogHeader>

          {analysis && (
            <div className="space-y-4 text-sm">
              {/* Badges de comptage */}
              <div className="grid grid-cols-4 gap-2">
                <div className="rounded-xl border border-border bg-muted/40 p-2.5 text-center">
                  <div className="text-lg font-extrabold text-foreground">{analysis.totalFileRows}</div>
                  <div className="text-[11px] text-muted-foreground">Total lignes</div>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-2.5 text-center">
                  <div className="text-lg font-extrabold text-emerald-700">+{analysis.newCount}</div>
                  <div className="text-[11px] text-emerald-700 font-medium">À importer</div>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-center">
                  <div className="text-lg font-extrabold text-amber-700">{analysis.duplicateCount}</div>
                  <div className="text-[11px] text-amber-700 font-medium">Doublons</div>
                </div>
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-center">
                  <div className="text-lg font-extrabold text-rose-700">{analysis.skippedBefore15May}</div>
                  <div className="text-[11px] text-rose-700 font-medium">Avant 15-05</div>
                </div>
              </div>

              {/* Renommage automatique avec dates détectées */}
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-primary">
                    Nom normalisé avec période (remplace le nom générique) :
                  </div>
                  <div className="font-mono text-xs font-bold text-foreground truncate mt-0.5">
                    {analysis.suggestedName}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Période du fichier : du {analysis.minDate || '—'} au {analysis.maxDate || '—'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={downloadRenamed}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-primary/30 bg-card px-3 py-1.5 text-xs font-semibold text-primary shadow-xs hover:bg-primary/10 cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" /> Télécharger renommé
                </button>
              </div>

              {/* Tableau d'aperçu */}
              <div>
                <p className="text-xs font-semibold text-foreground mb-2 flex items-center justify-between">
                  <span>Aperçu du traitement des lignes :</span>
                  <span className="text-muted-foreground font-normal">
                    {analysis.preview.length} affichées
                  </span>
                </p>
                <div className="max-h-56 overflow-y-auto rounded-lg border border-border">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted text-muted-foreground sticky top-0">
                      <tr>
                        <th className="p-2">Date / StartTime</th>
                        <th className="p-2">Énergie (kWh)</th>
                        <th className="p-2 text-right">Statut du filtre</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {analysis.preview.map((row, i) => (
                        <tr
                          key={i}
                          className={
                            row.isBeforeMay15
                              ? 'bg-rose-50/50'
                              : row.isDuplicate
                                ? 'bg-amber-50/50'
                                : 'hover:bg-muted/30'
                          }
                        >
                          <td className="p-2 font-medium">{row.date}</td>
                          <td className="p-2">{row.kwh} kWh</td>
                          <td className="p-2 text-right">
                            {row.isBeforeMay15 ? (
                              <span className="inline-flex items-center gap-1 rounded bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-800">
                                🚫 Avant 15-05 (Ignoré)
                              </span>
                            ) : row.isDuplicate ? (
                              <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                                <AlertTriangle className="h-3 w-3" /> Doublon (Ignoré)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                                <Check className="h-3 w-3" /> Prêt pour import
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Boutons d'action */}
              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setPreviewOpen(false)}
                  className="rounded-lg border border-input px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={confirmImport}
                  disabled={analysis.newCount === 0}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm hover:opacity-95 disabled:opacity-50 cursor-pointer"
                >
                  <Check className="h-4 w-4" />
                  {analysis.newCount > 0
                    ? `Confirmer l'import (${analysis.newCount} lignes)`
                    : 'Aucune nouvelle ligne à importer'}
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
