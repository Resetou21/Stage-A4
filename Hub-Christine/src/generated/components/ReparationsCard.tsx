import { useEffect, useState, useRef, type FormEvent, type ChangeEvent } from 'react';
import { Wrench, Plus, Upload, Check, Loader2, Info, ShieldCheck, Download, FileText, Sparkles, ExternalLink, Eye, ArrowLeft, X } from 'lucide-react';
import UsersBadge from '@generated/components/UsersBadge';
import SearchableSelect from '@components/SearchableSelect';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@components/ui/dialog';
import { createFactureReparation, getDernieresReparations, uploadReparationPdf } from '@generated/server/reparations';

interface ReparationItem {
  id: string;
  name: string;
  statut: string;
  montant: string;
  fournisseur: string;
  date: string;
  description: string;
}

const DEFAULT_REPARATEURS = [
  'COLUMBUS', 'DULEVO', 'FIMAP', 'KÄRCHER', 'NILFISK', 'TASKI', 'TENNANT', 'AUTRE RÉPARATEUR'
];

export default function ReparationsCard() {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [reparations, setReparations] = useState<ReparationItem[]>([]);
  const [selectedReparation, setSelectedReparation] = useState<ReparationItem | null>(null);

  // Formulaire simplifié : Fournisseur, Date de dépôt, PDF
  const [fournisseur, setFournisseur] = useState('KÄRCHER');
  const [dateDepot, setDateDepot] = useState(new Date().toISOString().slice(0, 10));

  // Fichier facture scannée et prévisualisation live
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [renamedFileName, setRenamedFileName] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<'pdf' | 'image' | 'other' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [reparateurs, setReparateurs] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('hub_christine_reparateurs');
      const list: string[] = saved ? JSON.parse(saved) : DEFAULT_REPARATEURS;
      return Array.from(new Set(list)).sort((a, b) => a.localeCompare(b, 'fr'));
    } catch {
      return DEFAULT_REPARATEURS;
    }
  });

  const handleCreateFournisseur = (newVal: string) => {
    const clean = newVal.trim().toUpperCase();
    if (!clean) return;
    if (!reparateurs.includes(clean)) {
      const updated = [...reparateurs, clean].sort((a, b) => a.localeCompare(b, 'fr'));
      setReparateurs(updated);
      try {
        localStorage.setItem('hub_christine_reparateurs', JSON.stringify(updated));
      } catch {}
      toast.success(`Prestataire "${clean}" ajouté à la liste`);
    }
    setFournisseur(clean);
  };

  const loadList = () => {
    setLoadingList(true);
    getDernieresReparations()
      .then((r) => setReparations(r?.reparations ?? []))
      .catch((e) => console.error(e))
      .finally(() => setLoadingList(false));
  };

  useEffect(() => {
    loadList();
  }, []);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);

    const ext = file.name.substring(file.name.lastIndexOf('.'));
    const fClean = (fournisseur || 'FACTURE').toUpperCase().replace(/[^A-Z0-9]/g, '_');
    const autoName = `REPARATION_${fClean}_${dateDepot || '2026'}${ext}`;
    setRenamedFileName(autoName);

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      setPreviewType('pdf');
    } else if (file.type.startsWith('image/')) {
      setPreviewType('image');
    } else {
      setPreviewType('other');
    }
  };

  const downloadRenamed = () => {
    if (!selectedFile) return;
    const url = URL.createObjectURL(selectedFile);
    const a = document.createElement('a');
    a.href = url;
    a.download = renamedFileName || selectedFile.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Fichier téléchargé : ${renamedFileName}`);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const finalFournisseur = (fournisseur || '').trim();

    if (!finalFournisseur) {
      toast.error('Veuillez indiquer le fournisseur / réparateur.');
      return;
    }
    if (!dateDepot) {
      toast.error('La date de dépôt est obligatoire.');
      return;
    }

    setSaving(true);
    try {
      const created = await createFactureReparation({
        data: {
          designation: `Réparation ${finalFournisseur} (${dateDepot})`,
          fournisseur: finalFournisseur,
          dateFacture: dateDepot,
          fileName: renamedFileName || selectedFile?.name || undefined,
        },
      });

      // Téléverser automatiquement le PDF / Image joint dans la colonne fichier de l'élément Monday
      if (created?.id && selectedFile) {
        try {
          const uploadFile =
            renamedFileName && renamedFileName !== selectedFile.name
              ? new File([selectedFile], renamedFileName, { type: selectedFile.type })
              : selectedFile;
          await uploadReparationPdf(created.id, uploadFile);
        } catch (upErr) {
          console.error('Erreur upload PDF réparation:', upErr);
          toast.warning('Ticket créé sur Monday, mais la pièce jointe PDF n’a pas pu être téléversée automatiquement.');
        }
      }

      // Mémoriser le nouveau réparateur dans la liste si pas déjà présent
      if (!reparateurs.includes(finalFournisseur)) {
        const updated = [...reparateurs, finalFournisseur].sort((a, b) => a.localeCompare(b, 'fr'));
        setReparateurs(updated);
        try {
          localStorage.setItem('hub_christine_reparateurs', JSON.stringify(updated));
        } catch {}
      }

      toast.success(
        `Dépôt enregistré et alerte transmise à Christophe sur l'ERP Atelier (Tableau Réparations Machines) !`
      );

      // Réinitialiser le formulaire
      setDateDepot(new Date().toISOString().slice(0, 10));
      setSelectedFile(null);
      setRenamedFileName('');
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setPreviewType(null);
      setOpen(false);

      loadList();
    } catch (err) {
      console.error(err);
      toast.error("Impossible d'enregistrer la réparation.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="flex h-full min-h-56 w-full flex-col justify-between rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div>
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-[family-name:var(--font-heading)] text-lg font-bold text-foreground">
                Réparations Matériel
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Factures SAV & atelier • Alerte transmise au Hub de Christophe
              </p>
            </div>

            <div className="flex items-center gap-1">
              <UsersBadge boardId={5106693291} />

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
                      <Wrench className="h-5 w-5 text-primary" />
                      Information & Procédure Réparations Matériel
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3 text-sm leading-relaxed">
                    <div className="rounded-lg bg-primary/10 p-3 text-xs font-medium text-primary">
                      ⚙️ <strong>Tableau Monday relié :</strong> <strong>Réparations machines (5106693291)</strong>.
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1.5">
                      <p><strong>1. Dépôt simplifié :</strong> Christine renseigne uniquement le fournisseur, la date de dépôt et joint la facture (PDF ou image).</p>
                      <p><strong>2. Ticket & Alerte Christophe :</strong> Un ticket « Curative » au statut « À traiter » est créé automatiquement avec une notification pour que Christophe l'affecte à la bonne machine.</p>
                      <p><strong>3. Pièce jointe centralisée :</strong> Le fichier PDF/image est renommé et rattaché directement sur la ligne Monday dans la colonne Fichier.</p>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 my-3">
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs leading-relaxed text-muted-foreground flex flex-col justify-center">
              <p className="font-bold text-primary mb-1">⚙️ Flux direct avec Christophe :</p>
              <p>
                En enregistrant une facture ici, un ticket d'intervention curative est automatiquement créé dans le <strong>Hub ERP Matériel</strong> avec le statut <em>« À traiter »</em> pour que Christophe l'affecte à la bonne machine.
              </p>
            </div>

            {/* 3 dernières factures déposées par Christine */}
            <div className="rounded-xl border border-border/80 bg-muted/30 p-2.5 flex flex-col justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                Dernières factures déposées par Christine :
              </p>
              {loadingList ? (
                <div className="h-10 animate-pulse rounded bg-muted" />
              ) : reparations.length === 0 ? (
                <p className="text-[11px] text-muted-foreground italic py-2">Aucune facture déposée pour le moment.</p>
              ) : (
                <ul className="space-y-1.5 text-xs">
                  {reparations.slice(0, 3).map((r) => (
                    <li
                      key={r.id}
                      onClick={() => setSelectedReparation(r)}
                      className="flex items-center justify-between text-[11px] p-1.5 rounded-lg hover:bg-muted/60 transition-colors cursor-pointer group"
                      title="Cliquer pour prévisualiser cette facture"
                    >
                      <span className="truncate max-w-[200px] font-medium text-foreground group-hover:text-primary transition-colors">
                        🔧 {r.fournisseur} ({r.date || 'Récemment'})
                      </span>
                      <span className="shrink-0 flex items-center gap-1.5">
                        {r.montant && r.montant !== '—' && (
                          <span className="font-bold text-primary">{r.montant} €</span>
                        )}
                        <span className="rounded bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 text-[9px] font-semibold text-amber-800 dark:text-amber-300">
                          {r.statut}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* MODALE DE PRÉVISUALISATION D'UNE FACTURE RÉPARATION */}
        <Dialog open={!!selectedReparation} onOpenChange={(o) => !o && setSelectedReparation(null)}>
          <DialogContent hideDefaultClose className="max-w-md overflow-hidden flex flex-col p-0">
            <div className="p-3.5 sm:p-4 border-b border-border bg-card/95 flex items-center justify-between gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setSelectedReparation(null)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary px-3 py-1.5 text-xs font-bold transition cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Retour</span>
              </button>
              <DialogTitle className="flex items-center gap-2 text-sm sm:text-base font-bold truncate min-w-0">
                <Wrench className="h-4 w-4 text-rose-500 shrink-0" />
                <span className="truncate">Détail — {selectedReparation?.fournisseur}</span>
              </DialogTitle>
              <DialogClose asChild>
                <button
                  type="button"
                  onClick={() => setSelectedReparation(null)}
                  className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-muted hover:bg-muted/80 text-foreground transition cursor-pointer shrink-0"
                  title="Fermer"
                >
                  <X className="h-4 w-4" />
                </button>
              </DialogClose>
            </div>

            {selectedReparation && (
              <div className="p-3.5 sm:p-5 flex-1 overflow-y-auto space-y-3.5 text-xs pb-32 sm:pb-8">
                <div className="p-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 flex items-center justify-between">
                  <div>
                    <div className="text-base font-black text-amber-800">
                      {selectedReparation.montant && selectedReparation.montant !== '—'
                        ? `${selectedReparation.montant} € HT`
                        : selectedReparation.fournisseur}
                    </div>
                    <div className="text-[11px] text-amber-700 font-medium">
                      Date de dépôt : {selectedReparation.date || 'Non renseignée'}
                    </div>
                  </div>
                  <span className="text-[10px] font-bold uppercase px-2 py-1 rounded bg-white border border-amber-300 text-amber-800">
                    {selectedReparation.statut || 'À traiter'}
                  </span>
                </div>

                <div className="rounded-xl border border-border bg-card p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Prestataire / SAV :</span>
                    <span className="font-bold text-foreground">{selectedReparation.fournisseur}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Tableau Monday :</span>
                    <span className="font-bold text-primary">Réparation machines (5106693291)</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Destinataire :</span>
                    <span className="font-semibold text-foreground">Christophe (Atelier ERP)</span>
                  </div>
                  {selectedReparation.description && (
                    <div className="border-t border-border pt-2 mt-1">
                      <span className="text-muted-foreground block mb-0.5">Description de la panne :</span>
                      <p className="font-medium text-foreground italic bg-muted/40 p-2 rounded-lg">
                        « {selectedReparation.description} »
                      </p>
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-[11px] text-muted-foreground leading-relaxed">
                  ⚙️ <strong>Flux Atelier actif :</strong> Cette facture est en attente d'affectation par Christophe sur la machine du parc concernée dans son Hub ERP.
                </div>
              </div>
            )}

            <div className="p-3 sm:p-4 border-t border-border bg-card/95 flex justify-end shrink-0">
              <DialogClose asChild>
                <button
                  type="button"
                  onClick={() => setSelectedReparation(null)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-muted/60 hover:bg-muted text-foreground px-4 py-2 text-xs font-bold shadow-xs transition cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                  <span>Fermer</span>
                </button>
              </DialogClose>
            </div>
          </DialogContent>
        </Dialog>

        <div className="mt-4">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-95 cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Enregistrer une facture réparation
          </button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1 sm:hidden">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary px-2.5 py-1 text-xs font-bold transition cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Retour</span>
              </button>
            </div>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <Wrench className="h-5 w-5 text-primary" />
              Nouvelle facture réparation & alerte Christophe
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={submit} className="grid gap-3.5 sm:grid-cols-2 mt-2">
            {/* Prestataire / Fournisseur avec SearchableSelect moderne et tri alphabétique */}
            <div className="grid gap-1.5 sm:col-span-2">
              <label className="text-sm font-semibold text-foreground">
                Fournisseur / Réparateur <span className="text-destructive">*</span>
              </label>
              <SearchableSelect
                value={fournisseur}
                onChange={(val) => setFournisseur(val)}
                options={reparateurs}
                placeholder="Sélectionner un réparateur ou atelier..."
                searchPlaceholder="Rechercher ou ajouter un réparateur (ex: KÄRCHER, NILFISK)..."
                allowCreate={true}
                createLabelPrefix="Ajouter le réparateur"
                autoUppercase={true}
                onCreateOption={handleCreateFournisseur}
                naturalSort={true}
                icon={<Wrench className="h-4 w-4 text-primary" />}
              />
            </div>

            {/* Date de dépôt (obligatoire) */}
            <div className="grid gap-1 sm:col-span-2">
              <label className="text-sm font-semibold text-foreground">
                Date de dépôt <span className="text-destructive">*</span>
              </label>
              <input
                type="date"
                required
                value={dateDepot}
                onChange={(e) => setDateDepot(e.target.value)}
                className="h-11 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Fichier joint PDF / Image */}
            <div className="grid gap-2 sm:col-span-2 rounded-xl border border-border bg-muted/30 p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-primary" /> Facture PDF / Image :
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.xlsx"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs font-semibold text-primary hover:underline cursor-pointer"
                >
                  {selectedFile ? 'Changer de fichier' : '+ Choisir un fichier'}
                </button>
              </div>

              {selectedFile ? (
                <div className="space-y-2 mt-1">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-emerald-700 truncate">
                        ✓ {selectedFile.name} ({(selectedFile.size / 1024).toFixed(0)} Ko)
                      </p>
                      <p className="text-[11px] font-mono text-muted-foreground truncate">
                        Nom normalisé : {renamedFileName}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={downloadRenamed}
                      className="inline-flex shrink-0 items-center gap-1 rounded bg-card px-2.5 py-1 text-xs font-semibold text-primary border border-primary/30 shadow-xs hover:bg-primary/10 cursor-pointer"
                    >
                      <Download className="h-3.5 w-3.5" /> Télécharger renommé
                    </button>
                  </div>

                  {/* Prévisualisation interactive directe du PDF ou de l'image */}
                  {previewUrl && (
                    <div className="rounded-xl border border-border bg-card p-2 space-y-1.5 shadow-xs">
                      <div className="flex items-center justify-between px-1">
                        <span className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
                          <Eye className="h-3.5 w-3.5 text-primary" />
                          Aperçu du document ({previewType === 'pdf' ? 'Facture PDF' : previewType === 'image' ? 'Image' : 'Fichier'})
                        </span>
                        <a
                          href={previewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1"
                        >
                          <ExternalLink className="h-3 w-3" /> Ouvrir en grand
                        </a>
                      </div>

                      {previewType === 'pdf' ? (
                        <iframe
                          src={previewUrl}
                          title="Aperçu Facture PDF"
                          className="w-full h-64 rounded-lg border border-border/60 bg-muted/20"
                        />
                      ) : previewType === 'image' ? (
                        <img
                          src={previewUrl}
                          alt="Aperçu Facture"
                          className="max-h-64 w-full object-contain rounded-lg border border-border/60 bg-muted/20"
                        />
                      ) : (
                        <div className="p-3 text-center text-xs text-muted-foreground bg-muted/20 rounded-lg">
                          📄 Fichier prêt : {selectedFile.name}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground italic">
                  Sélectionnez la facture pour générer automatiquement son nom normalisé.
                </p>
              )}
            </div>

            {/* Alerte et validation */}
            <div className="sm:col-span-2 mt-1">
              <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 p-2.5 text-xs text-emerald-800 font-medium">
                <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>
                  Un ticket « Curative » sera automatiquement créé sur le tableau Réparations Machines avec notification
                  pour Christophe.
                </span>
              </div>

              <div className="mt-3 flex items-center justify-end gap-2.5 pb-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border border-border bg-muted/60 hover:bg-muted px-4 text-xs font-bold text-foreground transition cursor-pointer"
                >
                  <X className="h-4 w-4" />
                  <span>Annuler</span>
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-95 disabled:opacity-60 cursor-pointer"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Envoi sur Monday & alerte de Christophe…
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" /> Enregistrer et transmettre au Hub Atelier
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
