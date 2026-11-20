import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Car, Info, Loader2, Upload, X, Check, Download, AlertTriangle, Eye, ShieldCheck, Clock, Zap, Search } from 'lucide-react';
import UsersBadge from '@generated/components/UsersBadge';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@components/ui/dialog';
import { getWellborneMois } from '@generated/server/chargemap';
import { getWellborneNames, getWellborneMonthlyStats, importWellborne, getWellborneMonthCharges, type WellborneChargeItem } from '@generated/server/wellborne';
import { readSheet, extractHeadersAndRows } from '@generated/components/readSheet';

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

  // Données réelles des charges du mois sélectionné pour prévisualisation et export
  const [monthCharges, setMonthCharges] = useState<WellborneChargeItem[]>([]);
  const [chargesLoading, setChargesLoading] = useState(false);
  const [chargesSearch, setChargesSearch] = useState('');

  useEffect(() => {
    if (!selectedBornesMonth) {
      setMonthCharges([]);
      setChargesSearch('');
      return;
    }
    setChargesLoading(true);
    getWellborneMonthCharges({ data: { ym: selectedBornesMonth.ym } })
      .then((res: any) => {
        setMonthCharges(res?.charges || []);
      })
      .catch((err) => {
        console.error('Erreur chargement charges Wellborne:', err);
      })
      .finally(() => setChargesLoading(false));
  }, [selectedBornesMonth]);

  const filteredMonthCharges = useMemo(() => {
    if (!chargesSearch.trim()) return monthCharges;
    const s = chargesSearch.toLowerCase();
    return monthCharges.filter(
      (c) =>
        c.startTime.toLowerCase().includes(s) ||
        c.endTime.toLowerCase().includes(s) ||
        c.duration.toLowerCase().includes(s) ||
        c.energyKwh.toLowerCase().includes(s)
    );
  }, [monthCharges, chargesSearch]);

  const totalMonthEnergy = useMemo(() => {
    return monthCharges.reduce(
      (acc, c) => acc + (parseFloat(String(c.energyKwh || '0').replace(',', '.')) || 0),
      0
    );
  }, [monthCharges]);

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
      const charges = monthCharges.length > 0
        ? monthCharges
        : ((await getWellborneMonthCharges({ data: { ym: selectedBornesMonth.ym } }))?.charges ?? []);

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
      const { headers, dataRows: body } = extractHeadersAndRows(await readSheet(file));
      const all = body.map((r) => headers.map((h, i) => excelDate(r[i] ?? '', h)));
      const nameIdx = headers.findIndex((h) => {
        const s = h.replace(/[\s_-]/g, '').toLowerCase();
        return s === 'starttime' || s === 'datedebut' || s === 'heuredebut' || s.includes('start');
      });
      if (nameIdx < 0) throw new Error('Colonne « StartTime » (ou Date de début) absente du fichier Excel Wellborne');

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
                  <div className="rounded-lg bg-primary/10 border border-primary/20 p-3 text-xs font-medium text-primary">
                    ⚡ <strong>Filtre strict de date :</strong> Conformément aux consignes, toutes les charges situées{' '}
                    <strong>avant le 15-05</strong> sont automatiquement filtrées et non importées. Seules les charges
                    récentes à partir du 15 mai sont intégrées.
                  </div>

                  <ol className="list-decimal space-y-2 pl-5 text-xs text-foreground">
                    <li>
                      Rendez-vous sur{' '}
                      <a
                        href="https://wellborneplus.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-primary underline"
                      >
                        wellborneplus.com
                      </a>
                      .
                    </li>
                    <li>
                      Connectez-vous en indiquant les identifiants du tableau <em>« Codes sites fournisseurs »</em>.
                    </li>
                    <li>
                      Allez dans <strong>« Transaction »</strong> puis <strong>« Historique de charge »</strong>.
                    </li>
                    <li>
                      Cliquez sur le <strong>petit nuage avec la flèche au milieu</strong> (icône de téléchargement en haut à droite).
                    </li>
                    <li>
                      Le fichier se télécharge dans votre dossier <em>« Téléchargements »</em> (souvent nommé <em>Enregistrement de charge.xlsx</em>).
                    </li>
                    <li>
                      <strong>Importation &amp; Renommage :</strong> Déposez ce fichier ci-dessous. Le Hub vérifie les 4000+ charges existantes et propose un nom normé (ex: <code>WELLBORNE_2026-10_BORNE.xlsx</code>).
                    </li>
                    <li>
                      Dès validation, la date du dernier import et les compteurs mensuels s'actualisent automatiquement.
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

        {/* MODALE DE PRÉVISUALISATION D'UN MOIS WELLBORNE AU CLIC AVEC LIGNES ET EXPORT */}
        <Dialog open={!!selectedBornesMonth} onOpenChange={(o) => !o && setSelectedBornesMonth(null)}>
          <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base font-bold">
                <Zap className="h-5 w-5 text-emerald-600" />
                Charges Bornes Wellborne — {selectedBornesMonth?.label} {year}
              </DialogTitle>
            </DialogHeader>

            {selectedBornesMonth && (
              <div className="space-y-4 text-xs mt-1">
                {/* 1. Résumé en Cartes KPI (3 cartes harmonisées avec Chargemap/Total) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="p-3 rounded-xl border border-border bg-muted/30 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold text-base shrink-0">
                      <Zap className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11px] text-muted-foreground font-semibold">Période</div>
                      <div className="font-bold text-foreground text-xs truncate">
                        {selectedBornesMonth.label} {year}
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl border border-border bg-muted/30 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold text-base shrink-0">
                      ⚡
                    </div>
                    <div>
                      <div className="text-[11px] text-muted-foreground font-semibold">Total Énergie</div>
                      <div className="font-extrabold text-foreground text-sm">
                        {chargesLoading ? '…' : `${totalMonthEnergy.toFixed(1)} kWh`}
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl border border-border bg-muted/30 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold text-base shrink-0">
                      #
                    </div>
                    <div>
                      <div className="text-[11px] text-muted-foreground font-semibold">Charges Monday</div>
                      <div className="font-extrabold text-foreground text-sm">
                        {chargesLoading ? '…' : `${monthCharges.length || selectedBornesMonth.count} charge(s)`}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Tableau des lignes réelles ou état d'attente d'importation */}
                {chargesLoading ? (
                  <div className="py-12 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-2">
                    <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
                    <span>Recherche des charges de cette période sur Monday...</span>
                  </div>
                ) : monthCharges.length > 0 ? (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                        <input
                          type="text"
                          value={chargesSearch}
                          onChange={(e) => setChargesSearch(e.target.value)}
                          placeholder="Rechercher par date, heure, durée, kWh..."
                          className="w-full rounded-lg border border-border bg-background pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                      <span className="text-[11px] text-muted-foreground font-semibold shrink-0">
                        {filteredMonthCharges.length} sur {monthCharges.length}
                      </span>
                    </div>

                    {/* Vue Cartes Mobiles pour smartphone (md:hidden) */}
                    <div className="md:hidden space-y-2 max-h-72 overflow-y-auto pr-0.5">
                      {filteredMonthCharges.map((c) => (
                        <div key={c.id} className="p-3 bg-muted/20 border border-border/80 rounded-xl flex items-center justify-between gap-3 shadow-2xs">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-extrabold text-foreground text-xs font-mono">{c.startTime}</span>
                              <span className="text-[10px] text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded border border-border/40">
                                {c.duration ? `${c.duration} min` : '—'}
                              </span>
                            </div>
                            <div className="text-[11px] text-muted-foreground mt-0.5">
                              Fin : {c.endTime || '—'}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-extrabold text-emerald-600 text-xs font-mono">{c.energyKwh} kWh</div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Vue Tableau pour Desktop (hidden md:block) */}
                    <div className="hidden md:block rounded-xl border border-border overflow-hidden shadow-xs">
                      <div className="max-h-72 overflow-y-auto overflow-x-auto">
                        <table className="w-full text-left text-[11px] border-collapse">
                          <thead className="bg-muted/70 text-foreground font-bold sticky top-0 z-10 border-b border-border">
                            <tr>
                              <th className="py-2 px-3">Date / Début (StartTime)</th>
                              <th className="py-2 px-3">Fin (EndTime)</th>
                              <th className="py-2 px-3">Durée</th>
                              <th className="py-2 px-3">Énergie (kWh)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/40 font-medium">
                            {filteredMonthCharges.map((c) => (
                              <tr key={c.id} className="hover:bg-muted/40 transition-colors">
                                <td className="py-2 px-3 font-mono text-[10px] whitespace-nowrap text-foreground font-bold">
                                  {c.startTime}
                                </td>
                                <td className="py-2 px-3 font-mono text-[10px] whitespace-nowrap text-muted-foreground">
                                  {c.endTime || '—'}
                                </td>
                                <td className="py-2 px-3 text-muted-foreground whitespace-nowrap font-mono">
                                  {c.duration ? `${c.duration} min` : '—'}
                                </td>
                                <td className="py-2 px-3 font-bold text-emerald-600 whitespace-nowrap font-mono">
                                  {c.energyKwh} kWh
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border-2 border-dashed border-emerald-500/30 bg-emerald-500/5 p-6 text-center space-y-3">
                    <div className="h-12 w-12 rounded-full bg-emerald-500/10 text-emerald-600 mx-auto flex items-center justify-center">
                      <Upload className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-foreground">
                        Aucune charge enregistrée sur Monday pour ce mois
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                        Le fichier Wellborne pour {selectedBornesMonth.label} {year} n'a pas encore été importé.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedBornesMonth(null);
                        inputRef.current?.click();
                      }}
                      className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground shadow-sm hover:opacity-95 transition cursor-pointer"
                    >
                      <Upload className="h-4 w-4" />
                      <span>Importer le fichier de charges (.xlsx)</span>
                    </button>
                  </div>
                )}

                {/* 3. Informations normées & Actions Télécharger (Export) / Importer */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-border">
                  <div className="text-[11px] text-muted-foreground">
                    Format recommandé : <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-[10px] text-foreground font-bold">WELLBORNE_{selectedBornesMonth.ym}_BORNE.xlsx</code>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                    <button
                      type="button"
                      onClick={handleDownloadXls}
                      disabled={exporting || (monthCharges.length === 0 && selectedBornesMonth.count === 0)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 text-xs font-bold shadow-xs transition disabled:opacity-50 cursor-pointer"
                      title="Télécharger les charges de ce mois au format Excel / CSV"
                    >
                      {exporting ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Export en cours...</span>
                        </>
                      ) : (
                        <>
                          <Download className="h-3.5 w-3.5" />
                          <span>Télécharger le XLS ({monthCharges.length || selectedBornesMonth.count})</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedBornesMonth(null);
                        inputRef.current?.click();
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-primary hover:opacity-95 text-primary-foreground px-3.5 py-2 text-xs font-bold shadow-xs transition cursor-pointer"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      <span>{monthCharges.length > 0 ? 'Ajouter / Mettre à jour' : 'Importer'}</span>
                    </button>
                  </div>
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
