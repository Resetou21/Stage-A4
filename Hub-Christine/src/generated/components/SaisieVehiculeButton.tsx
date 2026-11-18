import { useEffect, useState, useMemo, type FormEvent } from "react";
import { Loader2, Plus, Check, Sparkles, Car, Info } from 'lucide-react';
import { toast } from 'sonner';
import UsersBadge from '@generated/components/UsersBadge';
import SearchableSelect from '@components/SearchableSelect';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@components/ui/dialog';
import { createSaisieVehicule, getVehicules, type VehiculeItem } from '@generated/server/vehicules';
import { monday } from '@api/mondayApi';

const DEFAULT_FOURNISSEURS = [
  '123 PAREBRISE', 'AD', 'AP AUTO', 'AUTRE', 'BPM', 'CHARGEMAP', 'CLARO AUTOMOBILE',
  'FRANCE PARE BRISE', 'GARAGE DELANOUE', 'GCA GROUPE', 'GEMI', 'SAFETY CAR', 'TOTAL'
];

const DEFAULT_PRESTATIONS = [
  'Autre', 'Carte grise', 'Changement batterie', 'changement pneus', 'contrôle technique',
  'lavage', 'Parebrise', 'Réparation', 'Vidange'
];

const DEFAULT_MENUS = [
  'Contrôle visuel', 'Electricité', 'Entretien', 'fixe', 'Réparation', 'carburant'
];

const field = 'h-11 w-full rounded-xl border border-input bg-background px-3.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors';
const empty = {
  immat: '',
  dateInfo: new Date().toISOString().slice(0, 10), // date du jour par défaut
  kmRelev: '',
  montantHt: '',
  fournisseur: '',
  prestation: '',
  menuDeSaisie: 'Entretien',
};

const STORAGE_GROUP_KEY = 'hub_christine_vehicules_group_filter';

function getCookie(name: string): string | null {
  try {
    const match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
    return match ? decodeURIComponent(match[3]) : null;
  } catch {
    return null;
  }
}

function setCookie(name: string, value: string) {
  try {
    document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=31536000; SameSite=Lax`;
  } catch {}
}

function readStorageImmediate<T extends string>(key: string, valid: T[], fallback: T): T {
  try {
    const fromLocal = localStorage.getItem(key);
    if (fromLocal && valid.includes(fromLocal as T)) return fromLocal as T;
  } catch {}
  try {
    const fromSession = sessionStorage.getItem(key);
    if (fromSession && valid.includes(fromSession as T)) return fromSession as T;
  } catch {}
  try {
    const fromCookie = getCookie(key);
    if (fromCookie && valid.includes(fromCookie as T)) return fromCookie as T;
  } catch {}
  return fallback;
}

function writeStorageAll(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch {}
  try { sessionStorage.setItem(key, value); } catch {}
  try { setCookie(key, value); } catch {}
  try {
    if (monday?.storage?.instance?.setItem) {
      monday.storage.instance.setItem(key, value).catch(() => {});
    }
  } catch {}
  try {
    if (monday?.storage?.setItem) {
      monday.storage.setItem(key, value).catch(() => {});
    }
  } catch {}
}

export default function SaisieVehiculeButton() {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState(empty);
  const [vehicules, setVehicules] = useState<VehiculeItem[]>([]);
  const [loadingV, setLoadingV] = useState(false);

  const [groupFilter, setGroupFilterState] = useState<'all' | 'active' | 'restitue'>(() =>
    readStorageImmediate(STORAGE_GROUP_KEY, ['all', 'active', 'restitue'], 'all')
  );

  // Synchronisation asynchrone depuis Monday Storage sur le montage
  useEffect(() => {
    let mounted = true;
    try {
      if (monday?.storage?.instance?.getItem) {
        monday.storage.instance.getItem(STORAGE_GROUP_KEY).then((res: any) => {
          if (!mounted) return;
          const val = res?.data?.value;
          if (val === 'all' || val === 'active' || val === 'restitue') {
            setGroupFilterState(val);
            try { localStorage.setItem(STORAGE_GROUP_KEY, val); } catch {}
            try { sessionStorage.setItem(STORAGE_GROUP_KEY, val); } catch {}
            setCookie(STORAGE_GROUP_KEY, val);
          }
        }).catch(() => {});

        monday.storage.instance.getItem('hub_christine_fournisseurs').then((res: any) => {
          if (!mounted) return;
          const val = res?.data?.value;
          if (val) {
            try {
              const list = JSON.parse(val);
              if (Array.isArray(list) && list.length) setFournisseurs(list);
            } catch {}
          }
        }).catch(() => {});
      }
    } catch {}
    return () => {
      mounted = false;
    };
  }, []);

  const setGroupFilter = (g: 'all' | 'active' | 'restitue') => {
    setGroupFilterState(g);
    writeStorageAll(STORAGE_GROUP_KEY, g);
  };
  const [showInfo, setShowInfo] = useState(false);

  const countActive = useMemo(() => vehicules.filter((v) => !v.isRestitue).length, [vehicules]);
  const countRestitue = useMemo(() => vehicules.filter((v) => v.isRestitue).length, [vehicules]);

  // Listes dynamiques avec persistance locale
  const [fournisseurs, setFournisseurs] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('hub_christine_fournisseurs');
      return saved ? JSON.parse(saved) : DEFAULT_FOURNISSEURS;
    } catch {
      return DEFAULT_FOURNISSEURS;
    }
  });

  const [prestations, setPrestations] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('hub_christine_prestations');
      return saved ? JSON.parse(saved) : DEFAULT_PRESTATIONS;
    } catch {
      return DEFAULT_PRESTATIONS;
    }
  });

  const [menus, setMenus] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('hub_christine_menus');
      return saved ? JSON.parse(saved) : DEFAULT_MENUS;
    } catch {
      return DEFAULT_MENUS;
    }
  });

  const set = (k: keyof typeof empty) => (e: { target: { value: string } }) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  useEffect(() => {
    if (!open || vehicules.length) return;
    setLoadingV(true);
    getVehicules()
      .then((r) => setVehicules((r?.vehicules as VehiculeItem[]) ?? []))
      .catch((e) => {
        console.error(e);
        toast.error('Impossible de charger les véhicules.');
      })
      .finally(() => setLoadingV(false));
  }, [open, vehicules.length]);

  // Options véhicules : UNIQUEMENT l'immatriculation du véhicule, groupée et triée impeccablement
  const vehiculeOptions = useMemo(() => {
    let list = [...vehicules];

    if (groupFilter === 'active') {
      list = list.filter((v) => !v.isRestitue);
    } else if (groupFilter === 'restitue') {
      list = list.filter((v) => v.isRestitue);
    }

    // Tri naturel par numéro de flotte (#1, #2, ... #43), véhicules en service d'abord
    list.sort((a, b) => {
      if (groupFilter === 'all' && a.isRestitue !== b.isRestitue) {
        return a.isRestitue ? 1 : -1;
      }
      if (a.num != null && b.num != null) return a.num - b.num;
      if (a.num != null) return -1;
      if (b.num != null) return 1;
      return a.immat.localeCompare(b.immat, 'fr', { numeric: true, sensitivity: 'base' });
    });

    return list.map((v) => ({
      value: v.id,
      label: v.immat, // Plaque d'immatriculation en clair style Image 1 (ex: "EK-116-VR")
      sublabel: v.num ? `N° ${v.num}` : undefined, // Numéro de flotte entre parenthèses : "(N° 8)"
      group: v.groupTitle || (v.isRestitue ? 'Véhicule restitué' : 'Véhicules en service'),
      searchTokens: [
        v.immat,
        v.rawName,
        v.groupTitle,
        v.isRestitue ? 'restitué' : 'en service',
        v.num ? `#${v.num}` : '',
        v.num ? `${v.num}` : '',
        v.num ? `n° ${v.num}` : '',
        v.num ? `n°${v.num}` : '',
      ].filter(Boolean),
    }));
  }, [vehicules, groupFilter]);

  // Sauvegarde des listes custom
  const saveCustomItem = (type: 'fournisseur' | 'prestation' | 'menu', val: string) => {
    const trimmed = val.trim();
    if (!trimmed) return;

    if (type === 'fournisseur') {
      const cleanUpper = trimmed.toUpperCase();
      if (!fournisseurs.includes(cleanUpper)) {
        const updated = [...fournisseurs, cleanUpper].sort((a, b) =>
          a.localeCompare(b, 'fr', { sensitivity: 'base' })
        );
        setFournisseurs(updated);
        try { localStorage.setItem('hub_christine_fournisseurs', JSON.stringify(updated)); } catch {}
        try { monday?.storage?.instance?.setItem('hub_christine_fournisseurs', JSON.stringify(updated)).catch(() => {}); } catch {}
      }
      setF((p) => ({ ...p, fournisseur: cleanUpper }));
      toast.success(`Fournisseur « ${cleanUpper} » ajouté aux favoris`);
    } else if (type === 'prestation') {
      if (!prestations.includes(trimmed)) {
        const updated = [...prestations, trimmed].sort((a, b) =>
          a.localeCompare(b, 'fr', { sensitivity: 'base' })
        );
        setPrestations(updated);
        localStorage.setItem('hub_christine_prestations', JSON.stringify(updated));
      }
      setF((p) => ({ ...p, prestation: trimmed }));
      toast.success(`Prestation « ${trimmed} » ajoutée`);
    } else if (type === 'menu') {
      if (!menus.includes(trimmed)) {
        const updated = [...menus, trimmed].sort((a, b) =>
          a.localeCompare(b, 'fr', { sensitivity: 'base' })
        );
        setMenus(updated);
        localStorage.setItem('hub_christine_menus', JSON.stringify(updated));
      }
      setF((p) => ({ ...p, menuDeSaisie: trimmed }));
      toast.success(`Type de saisie « ${trimmed} » ajouté`);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const v = vehicules.find((x) => x.id === f.immat);
    if (!v) {
      toast.error('Veuillez sélectionner un véhicule valide.');
      return;
    }
    if (!f.dateInfo) {
      toast.error('La date est obligatoire.');
      return;
    }
    const montant = Number(f.montantHt);
    if (!f.montantHt || isNaN(montant) || montant <= 0) {
      toast.error('Le montant HT est obligatoire et doit être supérieur à 0.');
      return;
    }

    setSaving(true);
    try {
      await createSaisieVehicule({
        data: {
          vehiculeId: v.id,
          vehiculeName: v.immat, // Uniquement l'immatriculation
          dateInfo: f.dateInfo,
          montantHt: montant,
          kmRelev: f.kmRelev ? Number(f.kmRelev) : null,
          fournisseur: f.fournisseur || undefined,
          prestation: f.prestation || undefined,
          menuDeSaisie: f.menuDeSaisie || undefined,
        },
      });

      // Mémoriser la dernière saisie pour l'historique local
      try {
        const historyKey = 'hub_christine_recent_saisies';
        const cur = JSON.parse(localStorage.getItem(historyKey) || '[]');
        const entry = {
          date: f.dateInfo,
          vehicule: v.immat,
          fournisseur: f.fournisseur || '—',
          prestation: f.prestation || '—',
          montant: montant,
          at: new Date().toISOString(),
        };
        localStorage.setItem(historyKey, JSON.stringify([entry, ...cur].slice(0, 5)));
      } catch {}

      toast.success('Saisie enregistrée avec succès dans le tableau véhicules !');
      setF(empty);
      setOpen(false);
    } catch (err) {
      console.error(err);
      toast.error("Impossible d'enregistrer la saisie.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="relative w-full h-full flex flex-col">
        <div className="absolute right-4 top-5 z-10 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <UsersBadge boardId={5092124669} />

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
                  <Car className="h-5 w-5 text-primary" />
                  Information & Procédure Saisie Véhicules
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm leading-relaxed">
                <div className="rounded-lg bg-primary/10 p-3 text-xs font-medium text-primary">
                  💡 <strong>Tableau Monday relié :</strong> <strong>Data sur véhicule (5092124669)</strong>.
                  Toute facture ou dépense enregistrée ici est automatiquement partagée avec Christine, Vincent et Christophe.
                </div>
                <div className="text-xs text-muted-foreground space-y-1.5">
                  <p><strong>1. Rapprochement automatique :</strong> La dépense est rattachée à l'immatriculation du véhicule.</p>
                  <p><strong>2. Ventilation des coûts :</strong> Les entretiens, carburants ou réparations alimentent les indicateurs de suivi de flotte.</p>
                  <p><strong>3. Atelier mécanique :</strong> En cas de révision ou réparation, l'information est synchronisée avec l'ERP Atelier.</p>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Ajouter une saisie véhicule"
          className="group flex h-full min-h-56 w-full flex-col justify-between rounded-2xl border border-border bg-card p-5 text-left shadow-sm transition hover:border-primary hover:shadow-md cursor-pointer"
        >
          <div className="pr-12">
            <h3 className="font-[family-name:var(--font-heading)] text-lg font-bold text-foreground">
              Données facturation véhicules
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Nouvelle facture, entretien ou carburant avec tri par immatriculation
            </p>
          </div>
          <div className="flex w-full items-center justify-center py-6">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition group-hover:scale-105 group-hover:shadow-md">
              <Plus className="h-8 w-8" />
            </span>
          </div>
          <div className="w-full text-center text-xs font-bold text-primary">
            + Saisir une facture
          </div>
        </button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[95vh] overflow-y-auto w-[95vw] sm:max-w-[620px]">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between text-xl font-bold pr-10">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <span>Nouvelle saisie véhicule</span>
              </div>
              <button
                type="button"
                onClick={() => setShowInfo(!showInfo)}
                className={`inline-flex h-7 w-7 items-center justify-center rounded-full transition-colors cursor-pointer mr-1 ${
                  showInfo
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                }`}
                title="À qui sert cette saisie et sur quel Hub ? (cliquer pour afficher/masquer)"
                aria-label="Informations sur la saisie"
              >
                <Info className="h-4 w-4" />
              </button>
            </DialogTitle>
          </DialogHeader>

          {/* Encadré d'information compact (dépliable uniquement au clic sur le bouton (i)) */}
          {showInfo && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground leading-relaxed animate-in fade-in-0 duration-150">
              <div className="flex items-center justify-between font-bold text-foreground mb-1">
                <span className="flex items-center gap-1.5 text-primary">
                  <Info className="h-4 w-4" /> À qui sert cette saisie et sur quel Hub ?
                </span>
                <button
                  type="button"
                  onClick={() => setShowInfo(false)}
                  className="text-muted-foreground hover:text-foreground text-xs cursor-pointer px-1"
                >
                  ✕
                </button>
              </div>
              <p>
                Toute facture ou dépense enregistrée ici est transmise directement au tableau <strong>Data sur véhicule (5092124669)</strong>.
                Elle est automatiquement partagée avec le <strong>Hub Facturation de Christine</strong>, le <strong>Suivi de Parc de Vincent</strong> (cartes & badges), et l'<strong>ERP Atelier de Christophe</strong> en cas d'intervention mécanique.
              </p>
            </div>
          )}

          <form onSubmit={submit} className="grid gap-3.5 sm:grid-cols-2 mt-1">
            {/* 1. Sélection du véhicule : Label indépendant + Filtres & Tri pleine largeur */}
            <div className="sm:col-span-2 space-y-1.5">
              <label className="block text-xs font-bold text-foreground uppercase tracking-wide">
                Véhicule concerné <span className="text-destructive">*</span>
              </label>

              <div className="flex items-center justify-between gap-2 w-full">
                {/* Onglets Filtre par Groupe Monday */}
                <div className="flex items-center bg-muted/60 p-0.5 rounded-lg border border-border text-[11px]">
                  <button
                    type="button"
                    onClick={() => setGroupFilter('all')}
                    className={`px-2 py-0.5 rounded-md font-semibold transition-all cursor-pointer ${
                      groupFilter === 'all'
                        ? 'bg-background text-foreground shadow-xs font-bold'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Tous {loadingV ? '' : `(${vehicules.length})`}
                  </button>
                  <button
                    type="button"
                    onClick={() => setGroupFilter('active')}
                    className={`px-2 py-0.5 rounded-md font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                      groupFilter === 'active'
                        ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 shadow-xs font-bold'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    title="Afficher uniquement les véhicules en service"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    En service {loadingV ? '' : `(${countActive})`}
                  </button>
                  <button
                    type="button"
                    onClick={() => setGroupFilter('restitue')}
                    className={`px-2 py-0.5 rounded-md font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                      groupFilter === 'restitue'
                        ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300 shadow-xs font-bold'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    title="Afficher uniquement les véhicules restitués"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    Restitués {loadingV ? '' : `(${countRestitue})`}
                  </button>
                </div>

                <span className="text-[11px] text-muted-foreground font-medium shrink-0">
                  Trié par N° de flotte (#1 à #{vehicules.length || 43})
                </span>
              </div>

              <SearchableSelect
                value={f.immat}
                onChange={(val) => setF((p) => ({ ...p, immat: val }))}
                options={vehiculeOptions}
                placeholder={
                  loadingV
                    ? 'Chargement des véhicules utilitaires…'
                    : 'Sélectionner une plaque d’immatriculation...'
                }
                searchPlaceholder="Rechercher par plaque ou numéro (ex: CW, 12, FA)..."
                naturalSort={false}
                allowCreate={false}
                icon={<Car className="h-4 w-4 text-primary" />}
              />

              {f.immat && vehicules.find((v) => v.id === f.immat)?.isRestitue && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs font-semibold mt-1.5">
                  <span className="text-base">📦</span>
                  <span>
                    Véhicule restitué : <strong>{vehicules.find((v) => v.id === f.immat)?.immat}</strong> n'est plus en service actif.
                  </span>
                </div>
              )}
            </div>

            {/* 2. Date obligatoire */}
            <div className="grid gap-1.5">
              <label className="block text-xs font-bold text-foreground uppercase tracking-wide">
                Date de l'opération <span className="text-destructive">*</span>
              </label>
              <div className="relative flex items-center">
                <input
                  type="date"
                  required
                  value={f.dateInfo}
                  onChange={set('dateInfo')}
                  className={field}
                />
              </div>
            </div>

            {/* 3. Type de saisie avec recherche et création inline */}
            <div>
              <SearchableSelect
                label="Type de saisie (Menu)"
                value={f.menuDeSaisie}
                onChange={(val) => setF((p) => ({ ...p, menuDeSaisie: val }))}
                options={menus}
                placeholder="Sélectionner le type…"
                searchPlaceholder="Rechercher ou ajouter un type (ex: Fixe, Entretien)..."
                allowCreate={true}
                createLabelPrefix="Ajouter le type"
                onCreateOption={(val) => saveCustomItem('menu', val)}
              />
            </div>

            {/* 4. Fournisseur avec recherche et création inline */}
            <div>
              <SearchableSelect
                label="Fournisseur"
                value={f.fournisseur}
                onChange={(val) => setF((p) => ({ ...p, fournisseur: val }))}
                options={fournisseurs}
                placeholder="Sélectionner un fournisseur…"
                searchPlaceholder="Rechercher ou ajouter (ex: TOTAL, CHARGEMAP, AD)..."
                allowCreate={true}
                autoUppercase={true}
                createLabelPrefix="Créer le fournisseur"
                onCreateOption={(val) => saveCustomItem('fournisseur', val)}
              />
            </div>

            {/* 5. Prestation avec recherche et création inline */}
            <div>
              <SearchableSelect
                label="Prestation effectuée"
                value={f.prestation}
                onChange={(val) => setF((p) => ({ ...p, prestation: val }))}
                options={prestations}
                placeholder="Choisir une prestation…"
                searchPlaceholder="Rechercher ou ajouter (ex: Vidange, Pneus, Lavage)..."
                allowCreate={true}
                createLabelPrefix="Créer la prestation"
                onCreateOption={(val) => saveCustomItem('prestation', val)}
              />
            </div>

            {/* 6. Km relevé */}
            <div className="grid gap-1.5">
              <label className="block text-xs font-bold text-foreground uppercase tracking-wide">
                Km relevé
              </label>
              <div className="relative flex items-center">
                <input
                  type="number"
                  min="0"
                  placeholder="Ex : 45200"
                  value={f.kmRelev}
                  onChange={set('kmRelev')}
                  className={field}
                />
              </div>
            </div>

            {/* 7. Montant HT OBLIGATOIRE */}
            <div className="grid gap-1.5">
              <label className="block text-xs font-bold text-foreground uppercase tracking-wide">
                Montant HT (€) <span className="text-destructive">*</span>
              </label>
              <div className="relative flex items-center">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="Ex : 129.50"
                  value={f.montantHt}
                  onChange={set('montantHt')}
                  className={field}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="mt-3 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground shadow-sm transition hover:opacity-95 disabled:opacity-60 sm:col-span-2 cursor-pointer"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Enregistrement sur Monday en cours…
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Enregistrer dans le tableau véhicules
                </>
              )}
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
