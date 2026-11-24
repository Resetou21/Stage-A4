import { useEffect, useRef, useState, useMemo, type ChangeEvent } from 'react';
import { Check, Upload, Info, Loader2, X, Download, ShieldCheck, FileSpreadsheet, AlertTriangle, Eye, Fuel, Zap, Search, ArrowLeft, Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@components/ui/dialog';
import UsersBadge from '@generated/components/UsersBadge';
import { toast } from 'sonner';
import { cn } from '@lib/utils';
import { downloadFile, isAndroidMondayWebView } from '@lib/downloadFile';
import { getChargemapMois, getTotalBimonthlyStatus, getPeriodTransactions, type TotalPeriodMonth, type PeriodTransactionItem } from '@generated/server/chargemap';
import { analyzeFacturesChargemap, importFactures } from '@generated/server/factures';
import { analyzeFacturesTotal, importFacturesTotal } from '@generated/server/facturesTotal';
import { readSheet, extractHeadersAndRows } from '@generated/components/readSheet';

type Mois = { mois: string; present: boolean };

type Props = { variant?: 'chargemap' | 'total' };

interface AnalysisResult {
  file: File;
  headers: string[];
  rows: string[][];
  total: number;
  newCount: number;
  dupCount: number;
  suggestedName: string;
  preview: { index: number; date: string; vehicule: string; montant: string; isDuplicate: boolean }[];
}

interface ScanHistoryEntry {
  id: string;
  dateScan: string;
  originalName: string;
  renamedName: string;
  total: number;
  imported: number;
  duplicates: number;
}

export default function ChargemapCard({ variant = 'chargemap' }: Props) {
  const isTotal = variant === 'total';
  const boardId = isTotal ? 5092674084 : 5092349771;
  const historyKey = isTotal ? 'hub_christine_history_total' : 'hub_christine_history_chargemap';

  const [chargemapMois, setChargemapMois] = useState<Mois[]>([]);
  const [totalPeriods, setTotalPeriods] = useState<TotalPeriodMonth[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Analyse et prévisualisation avant import
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Prévisualisation interactive au clic sur un mois / une quinzaine
  const [selectedPeriodDetail, setSelectedPeriodDetail] = useState<{
    label: string;
    quinzaine?: '15' | '30' | null;
    present: boolean;
    moisStr: string;
  } | null>(null);

  // Données réelles chargées depuis Monday au clic sur le 15 ou le 30
  const [periodLoading, setPeriodLoading] = useState(false);
  const [periodTransactions, setPeriodTransactions] = useState<PeriodTransactionItem[]>([]);
  const [periodTotalMontant, setPeriodTotalMontant] = useState(0);
  const [periodLastImportedAt, setPeriodLastImportedAt] = useState<string | null>(null);
  const [periodSearch, setPeriodSearch] = useState('');

  useEffect(() => {
    if (!selectedPeriodDetail) {
      setPeriodTransactions([]);
      setPeriodLastImportedAt(null);
      setPeriodSearch('');
      return;
    }
    setPeriodLoading(true);
    getPeriodTransactions({
      data: {
        variant,
        mois: selectedPeriodDetail.moisStr,
        quinzaine: selectedPeriodDetail.quinzaine as any,
      },
    })
      .then((r: any) => {
        setPeriodTransactions(r?.transactions || []);
        setPeriodTotalMontant(r?.totalMontant || 0);
        setPeriodLastImportedAt(r?.lastImportedAt || null);
      })
      .catch((err) => {
        console.error('Erreur chargement transactions:', err);
      })
      .finally(() => setPeriodLoading(false));
  }, [selectedPeriodDetail, variant]);

  const periodLastImportedLabel = useMemo(() => {
    const raw =
      periodLastImportedAt ||
      periodTransactions.reduce<string | null>((latest, t) => {
        if (!t.createdAt) return latest;
        return !latest || t.createdAt > latest ? t.createdAt : latest;
      }, null);
    if (!raw) return null;
    const d = new Date(raw);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }, [periodLastImportedAt, periodTransactions]);

  // Transactions nettoyées : dédoublonnées automatiquement (on ne garde qu'une seule occurrence)
  // et on ignore les lignes totalement vides créées par erreur sur Monday
  const { cleanTransactions, rawCount, duplicatesRemovedCount, cleanTotalMontant } = useMemo(() => {
    const seen = new Set<string>();
    const clean: PeriodTransactionItem[] = [];
    let dupsCount = 0;
    let total = 0;

    for (const t of periodTransactions) {
      // Ignorer les lignes fantômes vides (sans véhicule et sans montant)
      const isVehiculeEmpty = !t.vehicule || t.vehicule === '—' || !t.vehicule.trim();
      const isMontantEmpty = !t.montant || t.montant === '—' || !t.montant.trim();
      if (isVehiculeEmpty && isMontantEmpty) {
        continue;
      }

      // Clé d'unicité basée sur la date, le véhicule, le produit, le montant et le volume
      const key = `${t.date}_${t.vehicule}_${t.produit}_${t.montant}_${t.quantite}`.toLowerCase().trim();
      if (seen.has(key)) {
        dupsCount++;
        continue;
      }
      seen.add(key);
      clean.push(t);

      const m = parseFloat(t.montant.replace(',', '.').replace(/[^\d.]/g, ''));
      if (!isNaN(m)) total += m;
    }

    return {
      cleanTransactions: clean,
      rawCount: periodTransactions.length,
      duplicatesRemovedCount: dupsCount,
      cleanTotalMontant: total,
    };
  }, [periodTransactions]);

  const filteredPeriodTransactions = useMemo(() => {
    if (!periodSearch.trim()) return cleanTransactions;
    const s = periodSearch.toLowerCase();
    return cleanTransactions.filter((t) =>
      t.vehicule.toLowerCase().includes(s) ||
      t.produit.toLowerCase().includes(s) ||
      t.station.toLowerCase().includes(s) ||
      t.date.toLowerCase().includes(s)
    );
  }, [cleanTransactions, periodSearch]);

  // Export des lignes de la période sélectionnée au format Excel / CSV avec BOM UTF-8
  const handleDownloadPeriodXls = async () => {
    if (!selectedPeriodDetail || !cleanTransactions.length) return;
    const headers = ['Date', 'Véhicule', 'Produit / Carte', 'Volume / Quantité', 'Montant HT', 'Station / Lieu'];
    const rows = cleanTransactions.map((t) => [
      t.date,
      t.vehicule,
      t.produit,
      t.quantite,
      t.montant,
      t.station,
    ]);

    const content = [
      headers.join(';'),
      ...rows.map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(';')),
    ].join('\r\n');

    const filename = isTotal
      ? `TOTAL_${selectedPeriodDetail.moisStr.slice(0, 7)}_${selectedPeriodDetail.quinzaine || '15'}.csv`
      : `CHARGEMAP_${selectedPeriodDetail.moisStr.slice(0, 7)}_VINCENT.csv`;

    const ok = await downloadFile(filename, content);
    if (ok) {
      toast.success(`Export de ${periodTransactions.length} transactions (${filename}) réussi !`);
    } else {
      toast.info('Export Excel disponible depuis un navigateur PC ou Chrome.');
    }
  };

  // État d'importation en cours
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState('');

  // Historique des 3 dernières factures scannées
  const [history, setHistory] = useState<ScanHistoryEntry[]>(() => {
    try {
      const saved = localStorage.getItem(historyKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const activeMonths = isTotal ? totalPeriods.map((p) => p.mois) : chargemapMois.map((m) => m.mois);
  const years = Array.from(new Set(activeMonths.map((m) => m.slice(0, 4)).filter(Boolean)));
  const displayYear = years.length > 0 ? years.join(' - ') : String(new Date().getFullYear());
  const year = displayYear;

  const loadStatus = () => {
    setLoading(true);
    if (isTotal) {
      getTotalBimonthlyStatus()
        .then((r) => {
          setTotalPeriods(r?.periods ?? []);
          setError(false);
        })
        .catch((e) => {
          console.error(e);
          setError(true);
        })
        .finally(() => setLoading(false));
    } else {
      getChargemapMois()
        .then((r) => {
          setChargemapMois(r?.mois ?? []);
          setError(false);
        })
        .catch((e) => {
          console.error(e);
          setError(true);
        })
        .finally(() => setLoading(false));
    }
  };

  useEffect(() => {
    loadStatus();
  }, [isTotal]);

  // Fonction pour proposer le renommage automatique
  const computeSuggestedName = (file: File, rows: string[][], headers: string[]): string => {
    const ext = file.name.endsWith('.csv') ? '.csv' : '.xlsx';
    let detectedDate = '';

    // Recherche de date dans les lignes
    for (const r of rows.slice(0, 50)) {
      for (const cell of r) {
        const m = (cell ?? '').match(/(\d{4})[-/.](\d{2})[-/.](\d{2})/);
        if (m) {
          detectedDate = `${m[1]}-${m[2]}-${m[3]}`;
          break;
        }
      }
      if (detectedDate) break;
    }

    if (isTotal) {
      if (detectedDate) {
        const d = Number(detectedDate.slice(8, 10));
        const ym = detectedDate.slice(0, 7);
        const quinzaine = d <= 15 ? '15' : '30';
        return `TOTAL_${ym}_${quinzaine}${ext}`;
      }
      return `TOTAL_${year}_Facture${ext}`;
    } else {
      if (detectedDate) {
        return `CHARGEMAP_${detectedDate.slice(0, 7)}_Facture${ext}`;
      }
      return `CHARGEMAP_${year}_Facture${ext}`;
    }
  };

  // Sélection du fichier et analyse préalable des doublons
  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setAnalyzing(true);
    try {
      const all = await readSheet(file);
      const { headers, dataRows: rows } = extractHeadersAndRows(all);
      if (!headers.length || !rows.length) {
        toast.info('Aucune ligne exploitable trouvée dans le fichier.');
        setAnalyzing(false);
        return;
      }

      toast.info('Analyse des doublons sur Monday en cours...');
      let res: any;
      if (isTotal) {
        res = await analyzeFacturesTotal({ data: { headers, rows } });
      } else {
        res = await analyzeFacturesChargemap({ data: { headers, rows } });
      }

      const suggestedName = computeSuggestedName(file, rows, headers);

      setAnalysis({
        file,
        headers,
        rows,
        total: res.total,
        newCount: res.newCount,
        dupCount: res.dupCount,
        suggestedName,
        preview: res.preview,
      });

      setPreviewOpen(true);
    } catch (err) {
      console.error(err);
      toast.error("Impossible de lire ou d'analyser le fichier.");
    } finally {
      setAnalyzing(false);
    }
  };

  // Exécution de l'import validé avec pauses de 1s par lot de 50
  const confirmImport = async () => {
    if (!analysis) return;
    setImporting(true);
    setPreviewOpen(false);

    const { headers, rows, suggestedName, file } = analysis;
    const importer = isTotal ? importFacturesTotal : importFactures;

    try {
      let ok = 0;
      let ko = 0;
      let dup = 0;

      for (let i = 0; i < rows.length; i += 50) {
        if (i > 0) {
          setProgress(`Pause 1s de conformité... (${i}/${rows.length})`);
          await new Promise((r) => setTimeout(r, 1000)); // 1 seconde de pause
        }
        setProgress(`Import en cours : ${Math.min(i + 50, rows.length)} / ${rows.length}`);
        const res = await importer({ data: { headers, rows: rows.slice(i, i + 50) } });
        ok += res?.ok ?? 0;
        ko += res?.ko ?? 0;
        dup += res?.dup ?? 0;
      }

      // Enregistrement dans l'historique des 3 dernières factures
      const newEntry: ScanHistoryEntry = {
        id: Date.now().toString(),
        dateScan: new Date().toLocaleString('fr-FR'),
        originalName: file.name,
        renamedName: suggestedName,
        total: rows.length,
        imported: ok,
        duplicates: dup,
      };

      const updatedHistory = [newEntry, ...history.slice(0, 2)];
      setHistory(updatedHistory);
      try {
        localStorage.setItem(historyKey, JSON.stringify(updatedHistory));
      } catch {}

      const dupTxt = dup ? `, ${dup} doublon(s) ignoré(s)` : '';
      if (ko) {
        toast.warning(`${ok} ligne(s) importée(s)${dupTxt}, ${ko} en erreur.`);
      } else {
        toast.success(
          `${ok} ligne(s) importée(s) avec succès dans « ${isTotal ? 'Facture TOTAL' : 'Facture Chargemap'} »${dupTxt} !`
        );
      }

      loadStatus();
    } catch (err) {
      console.error(err);
      toast.error("Échec lors de l'importation sur Monday.");
    } finally {
      setImporting(false);
      setProgress('');
      setAnalysis(null);
    }
  };

  // Télécharger le fichier sous son nom normalisé
  const downloadRenamed = async () => {
    if (!analysis) return;
    const ok = await downloadFile(analysis.suggestedName, analysis.file);
    if (ok) {
      toast.success(`Fichier téléchargé : ${analysis.suggestedName}`);
    } else {
      toast.info('Export disponible depuis un navigateur PC ou Chrome.');
    }
  };

  const hideDownloadInApp = isAndroidMondayWebView();

  return (
    <div className="flex h-full min-h-56 w-full flex-col justify-between rounded-2xl border border-border bg-card p-5 shadow-sm">
      {/* En-tête de carte */}
      <div>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-[family-name:var(--font-heading)] text-lg font-bold text-foreground">
              Factures {isTotal ? 'Total' : 'Chargemap'} {displayYear}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isTotal ? '2 factures/mois (15 et 30) • Gestion doublons' : 'Validation par Vincent • Rapprochement badges'}
            </p>
          </div>

          <div className="flex items-center gap-1">
            <UsersBadge boardId={boardId} />

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
                    Information & Procédure {isTotal ? 'Factures TOTAL' : 'Factures Chargemap'}
                  </DialogTitle>
                </DialogHeader>

                {isTotal ? (
                  <div className="space-y-3 text-sm leading-relaxed">
                    <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs font-medium text-amber-900">
                      💡 <strong>Règle d'or TOTAL :</strong> Il y a <strong>2 factures par mois</strong> (une au 15,
                      l'autre au dernier jour du mois). Les témoins ci-dessous indiquent si chaque quinzaine a bien été
                      importée.
                    </div>
                    <ol className="list-decimal space-y-2 pl-5 text-xs text-foreground">
                      <li>
                        Connectez-vous sur{' '}
                        <a
                          href="https://client.mobilitybusiness.totalenergies.com/signIn?tab=tid"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-primary underline"
                        >
                          Total Mobility Business
                        </a>
                        . Pour les identifiants de connexion, se référer au tableau <em>« Codes sites fournisseurs »</em>.
                      </li>
                      <li>Allez dans « Factures », puis « Fichiers de facturation ».</li>
                      <li>
                        Téléchargez le fichier de facturation de la quinzaine concernée (au format .xlsx ou .csv).
                      </li>
                      <li>
                        Importez le fichier via le bouton ci-dessous. Le Hub vérifie automatiquement la quinzaine (15 ou 30).
                      </li>
                      <li>
                        <strong>Gestion des doublons intégrale :</strong> Le Hub vérifie l'ensemble des lignes existantes
                        sans limitation à 500 lignes grâce à la pagination par curseur Monday.
                      </li>
                      <li>
                        <strong>Destination métier :</strong> Les données alimentent le tableau <em>« Facture TOTAL »</em> suivi par <strong>Laurent GUILLOU</strong>.
                      </li>
                    </ol>
                  </div>
                ) : (
                  <div className="space-y-3 text-sm leading-relaxed">
                    <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs font-medium text-emerald-800">
                      👤 <strong>Validation par Vincent :</strong> Ce tableau est dédié au contrôle des consommations
                      électriques par Vincent sur son Hub Facturation.
                    </div>
                    <ol className="list-decimal space-y-2 pl-5 text-xs text-foreground">
                      <li>
                        Connectez-vous sur{' '}
                        <a
                          href="https://www.chargemap-business.com/en"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-primary underline"
                        >
                          Chargemap Business
                        </a>
                        . Pour les emails et mots de passe de connexion, se référer au tableau <em>« Codes sites fournisseurs »</em>.
                      </li>
                      <li>Cliquez sur le menu « Factures ».</li>
                      <li>
                        Sur la ligne de facture concernée, cliquez sur les trois petits points <strong>« ... »</strong> puis sur <strong>« Exporter en XLS »</strong>.
                      </li>
                      <li>
                        <strong>Réception par email :</strong> Le fichier est automatiquement envoyé à <strong>facturation@groupefacility.fr</strong>.
                      </li>
                      <li>
                        Récupérez la pièce jointe reçue par email et déposez-la ici (formats .xlsx, .csv ou .xls supportés).
                      </li>
                      <li>
                        <strong>Attention période :</strong> La date de début de mois de la facture correspond aux consommations du mois précédent <em>(ex. facture émise le 1er mars = recharges effectuées en février)</em>.
                      </li>
                    </ol>
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground border-t border-border pt-2">
                  ℹ️ L'import s'effectue automatiquement par lots de 50 avec 1 seconde de pause pour garantir la conformité
                  Monday.
                </p>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Témoins visuels des périodes cliquables pour prévisualiser les détails */}
        {isTotal ? (
          /* TOTAL : 6 mois, chacun avec ses 2 quinzaines (15 et 30) */
          <div className="my-3 grid grid-cols-6 gap-1.5">
            {loading
              ? Array.from({ length: 6 }, (_, i) => (
                  <div key={`s${i}`} className="h-16 animate-pulse rounded-lg bg-muted" />
                ))
              : totalPeriods.map((p) => (
                  <div
                    key={p.mois}
                    className="flex flex-col items-center justify-between rounded-lg border border-border bg-muted/20 p-1 text-[11px]"
                  >
                    <span className="font-bold text-foreground">{p.label}</span>
                    <div className="flex w-full justify-around gap-1 my-0.5">
                      {/* Quinzaine 15 */}
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedPeriodDetail({
                            label: p.label,
                            quinzaine: '15',
                            present: p.has15,
                            moisStr: p.mois,
                          })
                        }
                        title={`Cliquer pour prévisualiser 1-15 ${p.label}`}
                        className={`inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold cursor-pointer transition-transform hover:scale-110 ${
                          p.has15
                            ? 'bg-primary/15 text-primary border border-primary/30'
                            : 'bg-destructive/15 text-destructive border border-destructive/30'
                        }`}
                      >
                        15
                      </button>
                      {/* Quinzaine 30 */}
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedPeriodDetail({
                            label: p.label,
                            quinzaine: '30',
                            present: p.has30,
                            moisStr: p.mois,
                          })
                        }
                        title={`Cliquer pour prévisualiser 16-30/31 ${p.label}`}
                        className={`inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold cursor-pointer transition-transform hover:scale-110 ${
                          p.has30
                            ? 'bg-primary/15 text-primary border border-primary/30'
                            : 'bg-destructive/15 text-destructive border border-destructive/30'
                        }`}
                      >
                        30
                      </button>
                    </div>
                  </div>
                ))}
          </div>
        ) : (
          /* CHARGEMAP : 6 mois simples */
          <div className="my-3 grid grid-cols-6 gap-1.5">
            {loading
              ? Array.from({ length: 6 }, (_, i) => (
                  <div key={`s${i}`} className="h-14 animate-pulse rounded-lg bg-muted" />
                ))
              : chargemapMois.map((m) => {
                  const label = new Date(m.mois).toLocaleDateString('fr-FR', { month: 'short', timeZone: 'UTC' });
                  return (
                    <button
                      type="button"
                      key={m.mois}
                      onClick={() =>
                        setSelectedPeriodDetail({
                          label: label.replace('.', ''),
                          quinzaine: null,
                          present: m.present,
                          moisStr: m.mois.slice(0, 7),
                        })
                      }
                      title={`Cliquer pour prévisualiser ${label}`}
                      className={`flex h-14 flex-col items-center justify-center rounded-lg border text-xs transition-all cursor-pointer hover:scale-105 ${
                        m.present
                          ? 'border-primary/40 bg-primary/10 text-primary'
                          : 'border-destructive/40 bg-destructive/10 text-destructive'
                      }`}
                    >
                      <span className="capitalize font-medium">{label.replace('.', '')}</span>
                      {m.present ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                    </button>
                  );
                })}
          </div>
        )}

        {/* MODALE DE PRÉVISUALISATION DÉTAILLÉE D'UNE PÉRIODE AU CLIC (15 / 30 / MOIS) */}
        <Dialog open={!!selectedPeriodDetail} onOpenChange={(o) => !o && setSelectedPeriodDetail(null)}>
          <DialogContent hideDefaultClose className="max-w-3xl sm:max-w-4xl overflow-hidden flex flex-col p-0">
            {/* EN-TÊTE FIXE STICKY AVEC RETOUR */}
            <div className="p-3.5 sm:p-4 border-b border-border bg-card/95 flex items-center justify-between gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setSelectedPeriodDetail(null)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary px-3 py-1.5 text-xs font-bold transition cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Retour</span>
              </button>
              <DialogTitle className="flex items-center gap-2 text-sm sm:text-base font-bold truncate min-w-0">
                {isTotal ? <Fuel className="h-4 w-4 text-amber-500 shrink-0" /> : <Zap className="h-4 w-4 text-blue-500 shrink-0" />}
                <span className="truncate">
                  {isTotal
                    ? `Total — ${selectedPeriodDetail?.label} (${selectedPeriodDetail?.quinzaine})`
                    : `Chargemap — ${selectedPeriodDetail?.label} ${year}`}
                </span>
              </DialogTitle>
              <DialogClose asChild>
                <button
                  type="button"
                  onClick={() => setSelectedPeriodDetail(null)}
                  className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-muted hover:bg-muted/80 text-foreground transition cursor-pointer shrink-0"
                  title="Fermer"
                >
                  <X className="h-4 w-4" />
                </button>
              </DialogClose>
            </div>

            {selectedPeriodDetail && (
              <div className="p-3.5 sm:p-5 flex-1 overflow-y-auto space-y-4 text-xs pb-6 sm:pb-6">
                {/* 1. Résumé en Cartes KPI */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="p-3 rounded-xl border border-border bg-muted/30 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-base shrink-0">
                      {isTotal ? <Fuel className="h-5 w-5" /> : <Zap className="h-5 w-5" />}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11px] text-muted-foreground font-semibold">Période</div>
                      <div className="font-bold text-foreground text-xs truncate">
                        {isTotal
                          ? selectedPeriodDetail.quinzaine === '15'
                            ? `1 au 15 ${selectedPeriodDetail.label}`
                            : `16 au 30/31 ${selectedPeriodDetail.label}`
                          : selectedPeriodDetail.label} {year}
                      </div>
                      <div className="text-[10px] font-medium text-muted-foreground mt-0.5 truncate">
                        {periodLoading
                          ? 'Date d’import : …'
                          : periodLastImportedLabel
                            ? `Importé le ${periodLastImportedLabel}`
                            : 'Non importé'}
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl border border-border bg-muted/30 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold text-base shrink-0">
                      €
                    </div>
                    <div>
                      <div className="text-[11px] text-muted-foreground font-semibold">Total Net (Dédoublonné)</div>
                      <div className="font-extrabold text-foreground text-sm">
                        {periodLoading ? '…' : `${cleanTotalMontant.toFixed(2)} €`}
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl border border-border bg-muted/30 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold text-base shrink-0">
                      #
                    </div>
                    <div>
                      <div className="text-[11px] text-muted-foreground font-semibold">Transactions Uniques</div>
                      <div className="font-extrabold text-foreground text-sm flex items-center gap-1.5 flex-wrap">
                        <span>{periodLoading ? '…' : `${cleanTransactions.length} transaction(s)`}</span>
                        {duplicatesRemovedCount > 0 && !periodLoading && (
                          <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-md border border-border">
                            {duplicatesRemovedCount} doublon(s) masqué(s)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Données réelles ou état d'attente d'importation */}
                {periodLoading ? (
                  <div className="py-12 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-2">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <span>Recherche des transactions de cette période sur Monday...</span>
                  </div>
                ) : cleanTransactions.length > 0 ? (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                        <input
                          type="text"
                          value={periodSearch}
                          onChange={(e) => setPeriodSearch(e.target.value)}
                          placeholder="Rechercher par véhicule, produit, station..."
                          className="w-full rounded-lg border border-border bg-background pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                      <span className="text-[11px] text-muted-foreground font-semibold shrink-0">
                        {filteredPeriodTransactions.length} sur {cleanTransactions.length}
                      </span>
                    </div>

                    {/* Vue Cartes Mobiles pour smartphone (md:hidden) */}
                    <div className="md:hidden space-y-2 max-h-72 overflow-y-auto pr-0.5">
                      {filteredPeriodTransactions.map((t) => (
                        <div key={t.id} className="p-3 bg-muted/20 border border-border/80 rounded-xl flex items-center justify-between gap-3 shadow-2xs">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-extrabold text-foreground text-xs">{t.vehicule}</span>
                              <span className="text-[10px] text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded border border-border/40">{t.date}</span>
                            </div>
                            <div className="text-[11px] text-muted-foreground truncate max-w-[200px] mt-1">
                              {t.station || t.produit}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-extrabold text-primary text-xs">{t.montant}</div>
                            <div className="text-[10px] text-muted-foreground font-mono">{t.quantite}</div>
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
                              <th className="py-2.5 px-3">Date</th>
                              <th className="py-2.5 px-3">Véhicule</th>
                              <th className="py-2.5 px-3">Produit</th>
                              <th className="py-2.5 px-3">Volume</th>
                              <th className="py-2.5 px-3">Montant</th>
                              <th className="py-2.5 px-3">Station / Lieu</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/40 font-medium">
                            {filteredPeriodTransactions.map((t) => (
                              <tr key={t.id} className="hover:bg-muted/50 transition-colors">
                                <td className="py-2 px-3 font-mono text-[10px] whitespace-nowrap text-muted-foreground">
                                   {t.date}
                                </td>
                                <td className="py-2 px-3 font-bold text-foreground whitespace-nowrap">
                                  {t.vehicule}
                                </td>
                                <td className="py-2 px-3 text-foreground whitespace-nowrap">
                                  {t.produit}
                                </td>
                                <td className="py-2 px-3 text-muted-foreground whitespace-nowrap font-mono">
                                  {t.quantite}
                                </td>
                                <td className="py-2 px-3 font-bold text-primary whitespace-nowrap">
                                  {t.montant}
                                </td>
                                <td className="py-2 px-3 text-muted-foreground truncate max-w-[160px]">
                                  {t.station}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 p-6 text-center space-y-3">
                    <div className="h-12 w-12 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center">
                      <Upload className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-foreground">
                        Aucune transaction enregistrée sur Monday pour cette période
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                        Le fichier pour la quinzaine du {selectedPeriodDetail.quinzaine === '15' ? `1 au 15 ${selectedPeriodDetail.label}` : `16 au 30/31 ${selectedPeriodDetail.label}`} {year} n'a pas encore été importé.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPeriodDetail(null);
                        inputRef.current?.click();
                      }}
                      className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground shadow-sm hover:opacity-95 transition cursor-pointer"
                    >
                      <Upload className="h-4 w-4" />
                      <span>Importer la facture de cette quinzaine (.xlsx)</span>
                    </button>
                  </div>
                )}

                <div className="text-[11px] text-muted-foreground pt-2">
                  Format recommandé : <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-[10px] text-foreground font-bold">{isTotal ? `TOTAL_${selectedPeriodDetail.moisStr.slice(0, 7)}_${selectedPeriodDetail.quinzaine || '15'}.xlsx` : `CHARGEMAP_${selectedPeriodDetail.moisStr.slice(0, 7)}_VINCENT.xlsx`}</code>
                </div>
              </div>
            )}

            {/* 3. FOOTER FIXE STICKY AVEC ACTIONS EXPORT / IMPORT */}
            {selectedPeriodDetail && (
              <div className="p-3 sm:p-4 border-t border-border bg-card/95 flex items-center justify-between gap-2.5 shrink-0">
                {!hideDownloadInApp && (
                  <button
                    type="button"
                    onClick={handleDownloadPeriodXls}
                    disabled={periodLoading || cleanTransactions.length === 0}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2.5 text-xs font-bold shadow-xs transition disabled:opacity-50 cursor-pointer"
                    title="Télécharger les lignes de cette période au format Excel / CSV"
                  >
                    <Download className="h-4 w-4 shrink-0" />
                    <span className="truncate">Télécharger XLS ({cleanTransactions.length})</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setSelectedPeriodDetail(null);
                    inputRef.current?.click();
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary hover:opacity-95 text-primary-foreground px-3 py-2.5 text-xs font-bold shadow-xs transition cursor-pointer"
                >
                  <Upload className="h-4 w-4 shrink-0" />
                  <span className="truncate">{cleanTransactions.length > 0 ? 'Mettre à jour' : 'Importer'}</span>
                </button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {error && <p className="text-xs text-destructive">Impossible de vérifier les périodes sur Monday.</p>}

        {/* Historique des 3 dernières factures scannées */}
        {history.length > 0 && (
          <div className="mt-3 rounded-lg border border-border/80 bg-muted/30 p-2.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
              3 dernières factures scannées :
            </p>
            <ul className="space-y-1.5 text-xs">
              {history.map((h) => (
                <li key={h.id} className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="truncate max-w-[165px] font-medium text-foreground" title={h.renamedName}>
                    📄 {h.renamedName}
                  </span>
                  <span className="shrink-0 text-[10px] flex items-center gap-1.5">
                    {h.dateScan && <span className="text-muted-foreground">{h.dateScan}</span>}
                    <span className="text-emerald-600 font-semibold">{h.imported} imp.</span>
                    {h.duplicates > 0 && (
                      <span className="text-amber-600">({h.duplicates} doubl.)</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Bouton d'import */}
      <div className="mt-4">
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.csv"
          className="hidden"
          onChange={onFile}
          aria-label="Fichier de factures"
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={importing || analyzing}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-95 disabled:opacity-60 cursor-pointer"
        >
          {analyzing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Analyse des doublons…
            </>
          ) : importing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> {progress || 'Import en cours…'}
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" /> Importer factures {isTotal ? 'TOTAL' : 'Chargemap'}
            </>
          )}
        </button>
      </div>

      {/* MODAL DE PRÉVISUALISATION VISUELLE DES DOUBLONS & RENOMMAGE AVANT IMPORT */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Eye className="h-5 w-5 text-primary" />
              Contrôle avant import — {isTotal ? 'Factures TOTAL' : 'Factures Chargemap'}
            </DialogTitle>
          </DialogHeader>

          {analysis && (
            <div className="space-y-4 text-sm">
              {/* Résumé des lignes et détection doublons */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-border bg-muted/40 p-3 text-center">
                  <div className="text-xl font-extrabold text-foreground">{analysis.total}</div>
                  <div className="text-xs text-muted-foreground">Lignes dans le fichier</div>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-center">
                  <div className="text-xl font-extrabold text-emerald-700">+{analysis.newCount}</div>
                  <div className="text-xs text-emerald-700 font-medium">Nouvelles à importer</div>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-center">
                  <div className="text-xl font-extrabold text-amber-700">{analysis.dupCount}</div>
                  <div className="text-xs text-amber-700 font-medium">Doublons ignorés</div>
                </div>
              </div>

              {/* Renommage automatique */}
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-primary">Renommage automatique suggéré :</div>
                  <div className="font-mono text-xs font-bold text-foreground truncate mt-0.5">
                    {analysis.suggestedName}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Fichier source : {analysis.file.name} • Date d'import : <strong className="text-foreground">{new Date().toLocaleDateString('fr-FR')}</strong>
                  </div>
                </div>
                {!hideDownloadInApp && (
                  <button
                    type="button"
                    onClick={downloadRenamed}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-primary/30 bg-card px-3 py-1.5 text-xs font-semibold text-primary shadow-xs hover:bg-primary/10 cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" /> Télécharger renommé
                  </button>
                )}
              </div>

              {/* Tableau de prévisualisation des lignes */}
              <div>
                <p className="text-xs font-semibold text-foreground mb-2 flex items-center justify-between">
                  <span>Aperçu des premières lignes du fichier :</span>
                  <span className="text-muted-foreground font-normal">
                    {analysis.preview.length} affichées
                  </span>
                </p>
                <div className="max-h-56 overflow-y-auto rounded-lg border border-border">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted text-muted-foreground sticky top-0">
                      <tr>
                        <th className="p-2">#</th>
                        <th className="p-2">Date</th>
                        <th className="p-2">Véhicule</th>
                        <th className="p-2">Montant</th>
                        <th className="p-2 text-right">Statut</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {analysis.preview.map((row) => (
                        <tr
                          key={row.index}
                          className={row.isDuplicate ? 'bg-amber-50/60' : 'hover:bg-muted/30'}
                        >
                          <td className="p-2 text-muted-foreground">{row.index}</td>
                          <td className="p-2 font-medium">{row.date}</td>
                          <td className="p-2 truncate max-w-[140px]">{row.vehicule}</td>
                          <td className="p-2">{row.montant}</td>
                          <td className="p-2 text-right">
                            {row.isDuplicate ? (
                              <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                                <AlertTriangle className="h-3 w-3" /> Doublon
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                                <Check className="h-3 w-3" /> Nouveau
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
