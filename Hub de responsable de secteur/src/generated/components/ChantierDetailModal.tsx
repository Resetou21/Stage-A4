import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@components/ui/dialog';
import { 
  Building2, 
  MapPin, 
  Phone, 
  Mail, 
  User, 
  Key, 
  Clock, 
  ExternalLink, 
  X, 
  ShieldAlert, 
  CheckCircle2, 
  AlertCircle,
  Copy,
  Calendar,
  Pencil,
  Save,
  RotateCcw,
  Loader2,
  Lock,
  Plus,
  Sparkles,
  Tag,
  ArrowRightLeft,
  Info
} from 'lucide-react';
import { toast } from 'sonner';
import { monday } from '@api/BoardSDK';
import SearchableCombobox from './SearchableCombobox';
import AnimatriceSelect from './AnimatriceSelect';
import { 
  hasRealKey, 
  updateChantierDetails, 
  ANIMATEURS_OPTIONS,
  DEFAULT_VILLES_OPTIONS,
  DEFAULT_ACTIVITES_OPTIONS,
  fetchStatusColumnLabels,
  type ChantierItem 
} from '@generated/server/chantiers';

interface ChantierDetailModalProps {
  chantier: ChantierItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChantierUpdated?: (updated: ChantierItem) => void;
}

export default function ChantierDetailModal({ 
  chantier, 
  open, 
  onOpenChange,
  onChantierUpdated 
}: ChantierDetailModalProps) {
  if (!chantier) return null;

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Listes des étiquettes disponibles
  const [availableVilles, setAvailableVilles] = useState<string[]>([...DEFAULT_VILLES_OPTIONS]);
  const [availableActivites, setAvailableActivites] = useState<string[]>([...DEFAULT_ACTIVITES_OPTIONS]);

  // Formulaire local d'édition
  const [formData, setFormData] = useState({
    name: chantier.name || '',
    animateur: chantier.animateur || '',
    code: chantier.code || '',
    adresse: chantier.adresse || '',
    codePostal: chantier.codePostal !== null && chantier.codePostal !== undefined ? String(chantier.codePostal) : '',
    ville: chantier.ville || '',
    interlocuteur: chantier.interlocuteur || '',
    telephone: chantier.telephone || '',
    email: chantier.email || '',
    cle: chantier.cle || '',
    doubleCle: chantier.doubleCle || '',
    keycafe: chantier.keycafe || '',
    cahierLiaison: chantier.cahierLiaison || '',
    heuresMois: chantier.heuresMois !== null && chantier.heuresMois !== undefined ? String(chantier.heuresMois) : '',
    activite: chantier.activite || '',
    sensible: Boolean(chantier.sensible),
  });

  // Chargement dynamique des étiquettes Monday au montage / ouverture
  useEffect(() => {
    if (open) {
      fetchStatusColumnLabels().then(({ villes, activites }) => {
        setAvailableVilles((prev) => {
          const set = new Set([...prev, ...villes]);
          if (chantier.ville) set.add(chantier.ville);
          return Array.from(set).filter(Boolean).sort((a, b) => a.localeCompare(b, 'fr'));
        });
        setAvailableActivites((prev) => {
          const set = new Set([...prev, ...activites]);
          if (chantier.activite) set.add(chantier.activite);
          return Array.from(set).filter(Boolean).sort((a, b) => a.localeCompare(b, 'fr'));
        });
      });
    }
  }, [open, chantier.ville, chantier.activite]);

  // Synchronisation lors du changement de chantier ou de la fermeture
  useEffect(() => {
    if (chantier) {
      setFormData({
        name: chantier.name || '',
        animateur: chantier.animateur || '',
        code: chantier.code || '',
        adresse: chantier.adresse || '',
        codePostal: chantier.codePostal !== null && chantier.codePostal !== undefined ? String(chantier.codePostal) : '',
        ville: chantier.ville || '',
        interlocuteur: chantier.interlocuteur || '',
        telephone: chantier.telephone || '',
        email: chantier.email || '',
        cle: chantier.cle || '',
        doubleCle: chantier.doubleCle || '',
        keycafe: chantier.keycafe || '',
        cahierLiaison: chantier.cahierLiaison || '',
        heuresMois: chantier.heuresMois !== null && chantier.heuresMois !== undefined ? String(chantier.heuresMois) : '',
        activite: chantier.activite || '',
        sensible: Boolean(chantier.sensible),
      });
      setIsEditing(false);

      // S'assurer que la ville/activité actuelle est dans la liste des options
      if (chantier.ville) {
        setAvailableVilles((prev) => 
          prev.includes(chantier.ville!) ? prev : [...prev, chantier.ville!].sort((a, b) => a.localeCompare(b, 'fr'))
        );
      }
      if (chantier.activite) {
        setAvailableActivites((prev) => 
          prev.includes(chantier.activite!) ? prev : [...prev, chantier.activite!].sort((a, b) => a.localeCompare(b, 'fr'))
        );
      }
    }
  }, [chantier, open]);

  const handleOpenMondayCard = () => {
    try {
      monday.execute('openItemCard', { itemId: chantier.id });
    } catch (e) {
      console.error(e);
      toast.error('Impossible d\'ouvrir la fiche Monday');
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copié dans le presse-papiers`);
  };

  const handleCancel = () => {
    if (chantier) {
      setFormData({
        name: chantier.name || '',
        animateur: chantier.animateur || '',
        code: chantier.code || '',
        adresse: chantier.adresse || '',
        codePostal: chantier.codePostal !== null && chantier.codePostal !== undefined ? String(chantier.codePostal) : '',
        ville: chantier.ville || '',
        interlocuteur: chantier.interlocuteur || '',
        telephone: chantier.telephone || '',
        email: chantier.email || '',
        cle: chantier.cle || '',
        doubleCle: chantier.doubleCle || '',
        keycafe: chantier.keycafe || '',
        cahierLiaison: chantier.cahierLiaison || '',
        heuresMois: chantier.heuresMois !== null && chantier.heuresMois !== undefined ? String(chantier.heuresMois) : '',
        activite: chantier.activite || '',
        sensible: Boolean(chantier.sensible),
      });
    }
    setIsEditing(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const parsedCP = formData.codePostal.trim() ? Number(formData.codePostal.replace(/\s+/g, '')) : null;
      const parsedHeures = formData.heuresMois.trim() ? Number(formData.heuresMois.replace(',', '.').replace(/\s+/g, '')) : null;

      const finalVille = formData.ville.trim();
      const finalActivite = formData.activite.trim();

      // Diffing : n'envoyer à Monday que les champs qui ont réellement été modifiés
      const patch: any = { itemId: chantier.id };

      if (formData.name.trim() && formData.name.trim() !== (chantier.name || '')) {
        patch.name = formData.name.trim();
      }
      if (formData.animateur.trim() && formData.animateur.trim() !== (chantier.animateur || '')) {
        patch.animateur = formData.animateur.trim();
      }
      if (formData.code.trim() !== (chantier.code || '')) {
        patch.code = formData.code.trim();
      }
      if (formData.adresse.trim() !== (chantier.adresse || '')) {
        patch.adresse = formData.adresse.trim();
      }
      if (parsedCP !== (chantier.codePostal || null)) {
        patch.codePostal = parsedCP;
      }
      if (finalVille !== (chantier.ville || '')) {
        patch.ville = finalVille;
      }
      if (formData.interlocuteur.trim() !== (chantier.interlocuteur || '')) {
        patch.interlocuteur = formData.interlocuteur.trim();
      }
      if (formData.telephone.trim() !== (chantier.telephone || '')) {
        patch.telephone = formData.telephone.trim();
      }
      if (formData.email.trim() !== (chantier.email || '')) {
        patch.email = formData.email.trim();
      }
      if (formData.cle.trim() !== (chantier.cle || '')) {
        patch.cle = formData.cle.trim();
      }
      if (formData.doubleCle.trim() !== (chantier.doubleCle || '')) {
        patch.doubleCle = formData.doubleCle.trim();
      }
      if (formData.keycafe.trim() !== (chantier.keycafe || '')) {
        patch.keycafe = formData.keycafe.trim();
      }
      if (formData.cahierLiaison.trim() !== (chantier.cahierLiaison || '')) {
        patch.cahierLiaison = formData.cahierLiaison.trim();
      }
      if (parsedHeures !== (chantier.heuresMois || null)) {
        patch.heuresMois = parsedHeures;
      }
      if (finalActivite !== (chantier.activite || '')) {
        patch.activite = finalActivite;
      }
      if (formData.sensible !== Boolean(chantier.sensible)) {
        patch.sensible = formData.sensible;
      }

      // Si aucun champ n'a été modifié
      if (Object.keys(patch).length <= 1) {
        toast.info('Aucune modification détectée');
        setIsEditing(false);
        setIsSaving(false);
        return;
      }

      const res = await updateChantierDetails(patch);

      if (!res.success) {
        toast.error(res.error || 'Erreur lors de l\'enregistrement sur Monday');
        setIsSaving(false);
        return;
      }

      // Si de nouvelles étiquettes ont été créées, on les ajoute à la liste locale
      if (finalVille && !availableVilles.includes(finalVille)) {
        setAvailableVilles((prev) => [...prev, finalVille].sort((a, b) => a.localeCompare(b, 'fr')));
      }
      if (finalActivite && !availableActivites.includes(finalActivite)) {
        setAvailableActivites((prev) => [...prev, finalActivite].sort((a, b) => a.localeCompare(b, 'fr')));
      }

      // Construction de l'objet mis à jour
      const updatedChantier: ChantierItem = {
        ...chantier,
        name: formData.name.trim() || chantier.name,
        animateur: formData.animateur.trim() || chantier.animateur,
        code: formData.code.trim() || null,
        adresse: formData.adresse.trim() || null,
        codePostal: Number.isNaN(parsedCP) ? null : parsedCP,
        ville: finalVille || null,
        interlocuteur: formData.interlocuteur.trim() || null,
        telephone: formData.telephone.trim() || null,
        email: formData.email.trim() || null,
        cle: formData.cle.trim() || null,
        doubleCle: formData.doubleCle.trim() || null,
        keycafe: formData.keycafe.trim() || null,
        cahierLiaison: formData.cahierLiaison.trim() || null,
        heuresMois: Number.isNaN(parsedHeures) ? null : parsedHeures,
        activite: finalActivite || null,
        sensible: formData.sensible,
      };

      const animChanged = chantier.animateur && formData.animateur && chantier.animateur !== formData.animateur;

      if (animChanged) {
        toast.success(`Chantier réattribué à ${formData.animateur} avec succès !`, {
          description: 'Le site apparaîtra désormais dans son Hub.',
          duration: 4500,
        });
      } else if (res.warnings && res.warnings.length > 0) {
        toast.warning(res.warnings[0], {
          description: 'Les autres modifications (statut sensible, adresse, clés...) ont été enregistrées avec succès.',
          duration: 6500,
        });
      } else {
        const isNewVille = finalVille && !DEFAULT_VILLES_OPTIONS.includes(finalVille as any);
        const isNewActivite = finalActivite && !DEFAULT_ACTIVITES_OPTIONS.includes(finalActivite as any);
        
        if (isNewVille || isNewActivite) {
          toast.success('Fiche enregistrée & nouvelle étiquette créée sur Monday !');
        } else {
          toast.success('Fiche chantier mise à jour avec succès sur Monday.com');
        }
      }

      setIsEditing(false);

      if (onChantierUpdated) {
        onChantierUpdated(updatedChantier);
      }

      if (animChanged) {
        onOpenChange(false);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Erreur imprévue lors de la mise à jour');
    } finally {
      setIsSaving(false);
    }
  };

  const fullAddress = [chantier.adresse, chantier.codePostal, chantier.ville].filter(Boolean).join(', ');
  const mapsUrl = fullAddress ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}` : null;

  const fmtDate = (dStr: string | null) => {
    if (!dStr) return 'Aucun contrôle enregistré';
    const d = new Date(dStr);
    return !Number.isNaN(d.getTime())
      ? d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
      : dStr;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto p-6 rounded-2xl border border-border bg-card shadow-2xl">
        <form onSubmit={handleSave}>
          {/* Header */}
          <div className="flex items-start justify-between gap-4 border-b border-border pb-4 pr-6">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                  <Building2 className="h-3 w-3" />
                  {isEditing ? (
                    <input
                      type="text"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      placeholder="Code (ex: 001757)"
                      className="bg-transparent border-b border-primary/40 text-xs font-mono font-bold focus:outline-none focus:border-primary w-24"
                    />
                  ) : (
                    chantier.code ? `Code : ${chantier.code}` : 'Chantier'
                  )}
                </span>
                {chantier.stars && (
                  <span className="inline-flex items-center rounded-md bg-amber-500/15 px-2 py-0.5 text-xs font-bold text-amber-600 dark:text-amber-400">
                    {chantier.stars}
                  </span>
                )}
                {isEditing ? (
                  <label className="inline-flex items-center gap-1.5 rounded-md bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive cursor-pointer hover:bg-destructive/20 transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.sensible}
                      onChange={(e) => setFormData({ ...formData, sensible: e.target.checked })}
                      className="rounded border-destructive text-destructive focus:ring-destructive h-3.5 w-3.5"
                    />
                    <span>Sensible ?</span>
                  </label>
                ) : (
                  chantier.sensible && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-destructive/15 px-2 py-0.5 text-xs font-semibold text-destructive">
                      <ShieldAlert className="h-3 w-3" />
                      Sensible
                    </span>
                  )
                )}
                {isEditing && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-600 text-white px-2.5 py-0.5 text-xs font-extrabold shadow-xs">
                    <Pencil className="h-3 w-3" />
                    Modification en cours
                  </span>
                )}
              </div>

              {isEditing ? (
                <div className="mt-1">
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Nom du chantier"
                    className="w-full text-lg sm:text-xl font-extrabold text-foreground border border-border rounded-lg px-2.5 py-1 bg-background focus:ring-1 focus:ring-primary focus:border-primary"
                    required
                  />
                </div>
              ) : (
                <DialogTitle className="text-xl font-extrabold tracking-tight sm:text-2xl text-foreground">
                  {chantier.name}
                </DialogTitle>
              )}

              <DialogDescription className="sr-only">
                Détails et modification du chantier {chantier.name}
              </DialogDescription>

              {!isEditing && chantier.ville && (
                <p className="mt-0.5 text-sm text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                  {chantier.ville}
                </p>
              )}
            </div>

            {/* Actions d'en-tête */}
            <div className="flex items-center gap-2 shrink-0">
              {isEditing ? (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={isSaving}
                    className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs disabled:opacity-50"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Enregistrement...</span>
                      </>
                    ) : (
                      <>
                        <Save className="h-3.5 w-3.5" />
                        <span>Enregistrer</span>
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/20 transition-colors shadow-2xs"
                    title="Modifier directement les coordonnées, clés, animateur de ce chantier"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    <span>Modifier</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenMondayCard}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground hover:bg-secondary/80 transition-colors shadow-xs"
                    title="Ouvrir la fiche complète dans Monday.com"
                  >
                    <ExternalLink className="h-3.5 w-3.5 text-primary" />
                    <span className="hidden sm:inline">Fiche Monday</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Grille d'informations structurées */}
          <div className="mt-5 space-y-4">
            {/* Section 0 : Animatrice Responsable (Transfert / Attribution) */}
            <div className={`rounded-xl border p-4 transition-colors ${
              isEditing 
                ? 'border-primary/40 bg-primary/5' 
                : 'border-border bg-muted/20'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
                  <User className="h-4 w-4" />
                  Animatrice Responsable du Site
                </h4>
                {isEditing && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold text-primary border border-primary/20">
                    <ArrowRightLeft className="h-3 w-3" />
                    Transférable
                  </span>
                )}
              </div>

              {isEditing ? (
                <div className="space-y-2.5">
                  <AnimatriceSelect
                    value={formData.animateur}
                    onChange={(anim) => setFormData({ ...formData, animateur: anim })}
                  />
                  <div className="rounded-xl border border-primary/30 bg-primary/5 p-3.5 flex items-start gap-3 shadow-2xs">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary mt-0.5">
                      <ArrowRightLeft className="h-4 w-4" />
                    </div>
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <h5 className="text-xs font-black uppercase tracking-wide text-primary">
                        Règle de transfert du chantier
                      </h5>
                      <p className="text-xs text-foreground/90 leading-relaxed font-medium">
                        Si vous attribuez ce chantier à une autre animatrice, il disparaîtra immédiatement de votre Hub et apparaîtra dans le sien.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shrink-0" />
                    <span className="text-sm font-bold text-foreground">
                      {chantier.animateur || 'Non assigné'}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground font-medium">Chantiers en cours</span>
                </div>
              )}
            </div>

            {/* Section 1 : Localisation & Adresse */}
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                <MapPin className="h-4 w-4 text-primary" />
                Adresse &amp; Localisation
              </h4>

              {isEditing ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">
                      Adresse postale
                    </label>
                    <input
                      type="text"
                      value={formData.adresse}
                      onChange={(e) => setFormData({ ...formData, adresse: e.target.value })}
                      placeholder="Ex: 12 Rue Jean Jaurès"
                      className="w-full rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-semibold text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                    <div>
                      <div className="flex items-center justify-between h-5 mb-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                          Code Postal
                        </label>
                      </div>
                      <input
                        type="text"
                        value={formData.codePostal}
                        onChange={(e) => setFormData({ ...formData, codePostal: e.target.value })}
                        placeholder="Ex: 44600"
                        className="w-full rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-semibold text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
                      />
                    </div>

                    {/* VILLE : Barre de recherche dynamique des étiquettes existantes + création auto */}
                    <div>
                      <div className="flex items-center justify-between h-5 mb-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block truncate">
                          Ville
                        </label>
                        <span className="text-[10px] text-muted-foreground font-medium shrink-0">
                          {availableVilles.length} options
                        </span>
                      </div>
                      <SearchableCombobox
                        value={formData.ville}
                        onChange={(v) => setFormData({ ...formData, ville: v })}
                        options={availableVilles}
                        placeholder="Rechercher une ville (ex: SAINT...)"
                        emptyHelperText={`Tapez le nom d'une ville pour filtrer parmi les ${availableVilles.length} étiquettes...`}
                        allowCreate={true}
                        createLabelPrefix="Créer la ville"
                        autoUppercase={true}
                        icon={<MapPin className="h-3.5 w-3.5" />}
                      />
                    </div>
                  </div>
                </div>
              ) : fullAddress ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{chantier.adresse || 'Adresse non spécifiée'}</p>
                    <p className="text-xs text-muted-foreground">
                      {[chantier.codePostal, chantier.ville].filter(Boolean).join(' ')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => copyToClipboard(fullAddress, 'Adresse')}
                      className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Copy className="h-3 w-3" />
                      <span>Copier</span>
                    </button>
                    {mapsUrl && (
                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" />
                        <span>Google Maps</span>
                      </a>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">Aucune adresse renseignée sur Monday.</p>
              )}
            </div>

            {/* Section 2 : Interlocuteur & Contacts */}
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                <User className="h-4 w-4 text-[hsl(var(--brand-orange))]" />
                Contact Client
              </h4>

              {isEditing ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">
                      Interlocuteur
                    </label>
                    <input
                      type="text"
                      value={formData.interlocuteur}
                      onChange={(e) => setFormData({ ...formData, interlocuteur: e.target.value })}
                      placeholder="Ex: MR LOIRET"
                      className="w-full rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-semibold text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">
                      Téléphone
                    </label>
                    <input
                      type="text"
                      value={formData.telephone}
                      onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                      placeholder="Ex: 06 74 98 13 65"
                      className="w-full rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-semibold text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">
                      Email
                    </label>
                    <input
                      type="text"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="Ex: client@facility.fr"
                      className="w-full rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-semibold text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-lg border border-border bg-card p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Interlocuteur</p>
                    <p className="text-sm font-bold text-foreground truncate" title={chantier.interlocuteur || ''}>
                      {chantier.interlocuteur || '—'}
                    </p>
                  </div>

                  <div className="rounded-lg border border-border bg-card p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Téléphone</p>
                    {chantier.telephone ? (
                      <div className="flex items-center justify-between gap-1">
                        <a
                          href={`tel:${chantier.telephone.replace(/\s+/g, '')}`}
                          className="text-sm font-bold text-emerald-600 hover:underline dark:text-emerald-400 truncate"
                        >
                          {chantier.telephone}
                        </a>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(chantier.telephone!, 'Téléphone')}
                          className="text-muted-foreground hover:text-foreground p-0.5"
                          title="Copier le numéro"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">—</p>
                    )}
                  </div>

                  <div className="rounded-lg border border-border bg-card p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Email</p>
                    {chantier.email ? (
                      <div className="flex items-center justify-between gap-1">
                        <a
                          href={`mailto:${chantier.email}`}
                          className="text-sm font-bold text-primary hover:underline truncate"
                          title={chantier.email}
                        >
                          {chantier.email}
                        </a>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(chantier.email!, 'Email')}
                          className="text-muted-foreground hover:text-foreground p-0.5"
                          title="Copier l'email"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">—</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Section 3 : Clés & Accès */}
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                <Key className="h-4 w-4 text-amber-500" />
                Accès &amp; Gestion des clés
              </h4>

              {isEditing ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">
                      N° de clé
                    </label>
                    <input
                      type="text"
                      value={formData.cle}
                      onChange={(e) => setFormData({ ...formData, cle: e.target.value })}
                      placeholder="Ex: Clé 31, Badge 97, ou Pas de clé"
                      className="w-full rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-semibold text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">
                      Double de clé
                    </label>
                    <input
                      type="text"
                      value={formData.doubleCle}
                      onChange={(e) => setFormData({ ...formData, doubleCle: e.target.value })}
                      placeholder="Ex: Double au bureau, Clé B2"
                      className="w-full rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-semibold text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">
                      Boîte à clés / Keycafe
                    </label>
                    <input
                      type="text"
                      value={formData.keycafe}
                      onChange={(e) => setFormData({ ...formData, keycafe: e.target.value })}
                      placeholder="Ex: KEYCAFE, Boîte code 4821"
                      className="w-full rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-semibold text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">
                      Cahier de liaison
                    </label>
                    <input
                      type="text"
                      value={formData.cahierLiaison}
                      onChange={(e) => setFormData({ ...formData, cahierLiaison: e.target.value })}
                      placeholder="Ex: Tiroir accueil, Local ménage"
                      className="w-full rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-semibold text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-lg border border-border bg-card p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">N° de clé</p>
                    <p className="text-sm font-bold text-foreground">
                      {hasRealKey(chantier.cle) ? (
                        <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                          <Key className="h-3.5 w-3.5 shrink-0" />
                          {chantier.cle}
                        </span>
                      ) : chantier.cle ? (
                        <span className="text-xs text-muted-foreground italic font-normal">{chantier.cle}</span>
                      ) : (
                        <span className="text-muted-foreground font-normal">—</span>
                      )}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border bg-card p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Double clé</p>
                    <p className="text-sm font-bold text-foreground">
                      {hasRealKey(chantier.doubleCle) ? (
                        <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                          <Key className="h-3.5 w-3.5 shrink-0" />
                          {chantier.doubleCle}
                        </span>
                      ) : chantier.doubleCle ? (
                        <span className="text-xs text-muted-foreground italic font-normal">{chantier.doubleCle}</span>
                      ) : (
                        <span className="text-muted-foreground font-normal">—</span>
                      )}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border bg-card p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Boîte à clés / Keycafe</p>
                    <p className="text-sm font-bold text-foreground">
                      {hasRealKey(chantier.keycafe) ? (
                        <span className="text-foreground">{chantier.keycafe}</span>
                      ) : chantier.keycafe ? (
                        <span className="text-xs text-muted-foreground italic font-normal">{chantier.keycafe}</span>
                      ) : (
                        <span className="text-muted-foreground font-normal">—</span>
                      )}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border bg-card p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Cahier de liaison</p>
                    <p className="text-sm font-bold text-foreground">{chantier.cahierLiaison || '—'}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Section 4 : Qualité & Contrôles (Lecture Seule Protégée) */}
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  Qualité &amp; Derniers Contrôles
                  <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    <Lock className="h-2.5 w-2.5" />
                    Calculé auto
                  </span>
                </h4>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Dernier contrôle : <span className="font-semibold text-foreground">{fmtDate(chantier.dernierControle)}</span>
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-border bg-card p-3 text-center">
                  <p className="text-xs font-bold uppercase text-muted-foreground mb-1">C1 (Le plus récent)</p>
                  <span
                    className={`inline-block rounded-md px-2 py-0.5 text-xs font-bold ${
                      chantier.c1 === 'Globalement bon'
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                        : chantier.c1
                        ? 'bg-destructive/15 text-destructive'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {chantier.c1 || 'Non noté'}
                  </span>
                </div>

                <div className="rounded-lg border border-border bg-card p-3 text-center">
                  <p className="text-xs font-bold uppercase text-muted-foreground mb-1">C2 (Avant-dernier)</p>
                  <span
                    className={`inline-block rounded-md px-2 py-0.5 text-xs font-bold ${
                      chantier.c2 === 'Globalement bon'
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                        : chantier.c2
                        ? 'bg-destructive/15 text-destructive'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {chantier.c2 || 'Non noté'}
                  </span>
                </div>

                <div className="rounded-lg border border-border bg-card p-3 text-center">
                  <p className="text-xs font-bold uppercase text-muted-foreground mb-1">C3 (3ème contrôle)</p>
                  <span
                    className={`inline-block rounded-md px-2 py-0.5 text-xs font-bold ${
                      chantier.c3 === 'Globalement bon'
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                        : chantier.c3
                        ? 'bg-destructive/15 text-destructive'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {chantier.c3 || 'Non noté'}
                  </span>
                </div>
              </div>
            </div>

            {/* Section 5 : Exploitation & Type de site */}
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                <Clock className="h-4 w-4 text-primary" />
                Exploitation &amp; Activité
              </h4>

              {isEditing ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                  <div>
                    <div className="flex items-center justify-between h-5 mb-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                        Heures par mois (h/mois)
                      </label>
                    </div>
                    <input
                      type="text"
                      value={formData.heuresMois}
                      onChange={(e) => setFormData({ ...formData, heuresMois: e.target.value })}
                      placeholder="Ex: 12.5"
                      className="w-full rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-semibold text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
                    />
                  </div>

                  {/* ACTIVITÉ : Barre de recherche dynamique des étiquettes existantes + création auto */}
                  <div>
                    <div className="flex items-center justify-between h-5 mb-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block truncate">
                        Activité / Type de site
                      </label>
                      <span className="text-[10px] text-muted-foreground font-medium shrink-0">
                        {availableActivites.length} options
                      </span>
                    </div>
                    <SearchableCombobox
                      value={formData.activite}
                      onChange={(a) => setFormData({ ...formData, activite: a })}
                      options={availableActivites}
                      placeholder="Rechercher une activité (ex: PART...)"
                      emptyHelperText={`Tapez le nom d'une activité pour filtrer parmi les ${availableActivites.length} étiquettes...`}
                      allowCreate={true}
                      createLabelPrefix="Créer l'activité"
                      autoUppercase={true}
                      icon={<Building2 className="h-3.5 w-3.5" />}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-6 text-xs text-muted-foreground">
                  <p className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-primary" />
                    Volume horaire :{' '}
                    <span className="font-bold text-foreground">
                      {chantier.heuresMois !== null && chantier.heuresMois !== undefined
                        ? `${chantier.heuresMois} h / mois`
                        : 'Non renseigné'}
                    </span>
                  </p>
                  <p className="flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-primary" />
                    Activité :{' '}
                    <span className="font-bold text-foreground">
                      {chantier.activite || 'Non renseignée'}
                    </span>
                  </p>
                </div>
              )}
            </div>

            {/* Barre de boutons d'action en bas si en édition */}
            {isEditing && (
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={isSaving}
                  className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
                >
                  Annuler les modifications
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Enregistrement sur Monday...</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-3.5 w-3.5" />
                      <span>Enregistrer les modifications</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
