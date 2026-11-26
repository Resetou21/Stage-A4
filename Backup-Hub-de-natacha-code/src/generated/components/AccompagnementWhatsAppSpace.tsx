import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import {
  BookOpen,
  Camera,
  Check,
  ChevronDown,
  Clock,
  ExternalLink,
  FileSpreadsheet,
  Globe,
  Link2,
  Loader2,
  MessageCircle,
  Mic,
  MicOff,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  ACCOMPAGNEMENT_THEMES,
  AccompagnementRecord,
  archiveAccompagnementOrTemplate,
  BOARD_ACCOMPAGNEMENTS_ID,
  BOARD_SALARIES_ID,
  buildWhatsAppUrl,
  createAccompagnementRecord,
  createCustomMessageTemplate,
  createSalarieItem,
  fetchAccompagnements,
  fetchSalaries,
  formatPhoneDisplay,
  inferLanguageFromNationality,
  MessageTemplateRecord,
  ParsedExcelSalarie,
  SalarieRecord,
  SUPPORTED_LANGUAGES,
  translateFromFrench,
  updateSalarieFields,
} from '@generated/server/accompagnement';
import { cn } from '@lib/utils';

interface AccompagnementWhatsAppSpaceProps {
  firstName: string;
}

const ANIMATRICE_FULL_MAP: Record<string, string> = {
  Natacha: 'Natacha THOMAS',
  Ketty: 'Ketty PAULIN',
  Emilie: 'Emilie TOBIE',
};

const DEFAULT_TEMPLATES: MessageTemplateRecord[] = [
  {
    id: 'tpl-default-protocole',
    label: 'Protocole nettoyage',
    theme: 'Protocole nettoyage',
    text: 'Bonjour, suite à notre point ensemble aujourd’hui sur le chantier, voici le rappel du protocole vu ensemble : merci de bien respecter l’ordre de nettoyage et le dosage des produits.',
    author: 'Modèle Facility',
    isDefault: true,
  },
  {
    id: 'tpl-default-machine',
    label: 'Utilisation machine',
    theme: 'Utilisation machine',
    text: 'Bonjour, suite à notre démonstration machine aujourd’hui, pensez bien à vider et rincer la cuve d’eau sale après chaque utilisation et à mettre la machine en charge.',
    author: 'Modèle Facility',
    isDefault: true,
  },
  {
    id: 'tpl-default-felicitations',
    label: 'Félicitations qualité',
    theme: 'Félicitations',
    text: 'Bonjour, merci beaucoup pour la qualité de votre travail sur le site ! Le client est très satisfait de votre prestation. Continuez comme ça !',
    author: 'Modèle Facility',
    isDefault: true,
  },
];

/* Sélecteur custom Portal (0 <select> natif) */
function PillSelect({
  value,
  options,
  onChange,
  placeholder = 'Sélectionner...',
  searchable = false,
}: {
  value: string;
  options: Array<{ value: string; label: string; badge?: string; sub?: string }>;
  onChange: (val: string) => void;
  placeholder?: string;
  searchable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [pos, setPos] = useState<React.CSSProperties>({});
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(() => options.find((o) => o.value === value), [options, value]);
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return options;
    return options.filter(
      (o) => o.label.toLowerCase().includes(s) || (o.sub || '').toLowerCase().includes(s)
    );
  }, [options, q]);

  useEffect(() => {
    if (!open) return;
    setQ('');
    const update = () => {
      const btn = btnRef.current;
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const w = Math.min(Math.max(r.width, 240), vw - 20);
      const left = Math.max(10, Math.min(r.left, vw - w - 10));
      const openUp = vh - r.bottom < 220 && r.top > 220;
      setPos({
        position: 'fixed',
        left,
        width: w,
        ...(openUp ? { bottom: vh - r.top + 6 } : { top: r.bottom + 6 }),
        zIndex: 99999,
      });
    };
    update();
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, options.length]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-border bg-background px-3 py-2 text-left text-sm font-semibold text-foreground shadow-xs transition-colors hover:border-primary/60 focus:border-primary focus:outline-none"
      >
        <span className="flex min-w-0 items-center gap-2">
          {selected?.badge && (
            <span className="shrink-0 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-extrabold text-primary">
              {selected.badge}
            </span>
          )}
          <span className="truncate">{selected ? selected.label : placeholder}</span>
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            style={pos}
            className="overflow-hidden rounded-xl border border-border bg-popover shadow-xl"
          >
            {(searchable || options.length > 7) && (
              <div className="border-b border-border p-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Rechercher..."
                    autoFocus
                    className="w-full rounded-lg border border-border bg-background py-1.5 pl-8 pr-2 text-xs focus:border-primary focus:outline-none"
                  />
                </div>
              </div>
            )}
            <div className="max-h-60 overflow-y-auto p-1">
              {filtered.length === 0 ? (
                <div className="py-4 text-center text-xs text-muted-foreground">Aucun résultat</div>
              ) : (
                filtered.map((opt) => {
                  const active = opt.value === value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        onChange(opt.value);
                        setOpen(false);
                      }}
                      className={cn(
                        'flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold transition-colors hover:bg-muted',
                        active && 'bg-primary/10 text-primary'
                      )}
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        {opt.badge && (
                          <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-extrabold text-primary">
                            {opt.badge}
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="truncate">{opt.label}</div>
                          {opt.sub && <div className="truncate text-[11px] font-normal text-muted-foreground">{opt.sub}</div>}
                        </div>
                      </div>
                      {active && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

export default function AccompagnementWhatsAppSpace({ firstName }: AccompagnementWhatsAppSpaceProps) {
  const animatriceFull = ANIMATRICE_FULL_MAP[firstName] || firstName;

  const [tab, setTab] = useState<'compose' | 'library' | 'salaries'>('compose');
  const [salaries, setSalaries] = useState<SalarieRecord[]>([]);
  const [rawBoardRecords, setRawBoardRecords] = useState<AccompagnementRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Formulaire Nouvel Accompagnement
  const [selectedSalarieId, setSelectedSalarieId] = useState<string>('');
  const [editingContact, setEditingContact] = useState<boolean>(false);
  const [editPhone, setEditPhone] = useState<string>('');
  const [editLangue, setEditLangue] = useState<string>('Français');
  const [savingContact, setSavingContact] = useState(false);

  const [dateAccomp, setDateAccomp] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [theme, setTheme] = useState<string>('Protocole nettoyage');
  const [syntheseFr, setSyntheseFr] = useState<string>('');
  const [translatedText, setTranslatedText] = useState<string>('');
  const [includeBilingualFr, setIncludeBilingualFr] = useState<boolean>(true);
  const [translating, setTranslating] = useState<boolean>(false);
  const [resourceUrl, setResourceUrl] = useState<string>('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [sending, setSending] = useState<boolean>(false);

  // Création de modèle personnalisé partagé sur Monday
  const [showNewTplForm, setShowNewTplForm] = useState(false);
  const [newTplLabel, setNewTplLabel] = useState('');
  const [newTplText, setNewTplText] = useState('');
  const [savingTpl, setSavingTpl] = useState(false);

  // Dictée vocale (Web Speech API)
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Bibliothèque
  const [libSearch, setLibSearch] = useState('');
  const [libAnimFilter, setLibAnimFilter] = useState('all');
  const [libSalarieFilter, setLibSalarieFilter] = useState('all');

  // Gestion Salariés + Import Excel mensuel RGPD
  const [salSearch, setSalSearch] = useState('');
  const [newSalName, setNewSalName] = useState('');
  const [newSalPhone, setNewSalPhone] = useState('');
  const [newSalLangue, setNewSalLangue] = useState('Français');
  const [addingSal, setAddingSal] = useState(false);

  const [excelPreview, setExcelPreview] = useState<ParsedExcelSalarie[] | null>(null);
  const [excelFileName, setExcelFileName] = useState('');
  const [importingExcel, setImportingExcel] = useState(false);
  const excelInputRef = useRef<HTMLInputElement>(null);

  // Séparation propre : messages envoyés vs modèles personnalisés (sauvegardés sur Monday)
  const history = useMemo(
    () => rawBoardRecords.filter((r) => r.statut.toLowerCase() !== 'modèle' && r.statut.toLowerCase() !== 'modele'),
    [rawBoardRecords]
  );

  const customTemplates: MessageTemplateRecord[] = useMemo(
    () =>
      rawBoardRecords
        .filter((r) => r.statut.toLowerCase() === 'modèle' || r.statut.toLowerCase() === 'modele')
        .map((r) => ({
          id: r.id,
          label: r.title,
          theme: r.theme || 'Autre',
          text: r.syntheseFr,
          author: r.animatrice || 'Équipe',
        })),
    [rawBoardRecords]
  );

  const allTemplates = useMemo(
    () => [...DEFAULT_TEMPLATES, ...customTemplates],
    [customTemplates]
  );

  const loadAll = async () => {
    setLoading(true);
    try {
      const [sals, recs] = await Promise.all([fetchSalaries(), fetchAccompagnements()]);
      setSalaries(sals);
      setRawBoardRecords(recs);
      if (!selectedSalarieId && sals.length > 0) {
        const firstActive = sals.find((s) => s.statut !== 'Sorti') || sals[0];
        setSelectedSalarieId(firstActive.id);
        setEditPhone(firstActive.phone);
        setEditLangue(firstActive.langue || 'Français');
        setEditingContact(!firstActive.phone);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Erreur lors du chargement des données Accompagnement.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
    return () => {
      try {
        recognitionRef.current?.stop();
      } catch {
        // ignore
      }
    };
  }, []);

  const selectedSalarie = useMemo(
    () => salaries.find((s) => s.id === selectedSalarieId) || null,
    [salaries, selectedSalarieId]
  );

  // Fil chronologique des messages DÉJÀ envoyés au salarié sélectionné
  const selectedSalarieThread = useMemo(() => {
    if (!selectedSalarie) return [];
    const target = selectedSalarie.name.toLowerCase().trim();
    return history
      .filter((h) => h.salarie.toLowerCase().trim() === target)
      .slice()
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  }, [history, selectedSalarie]);

  const handleSelectSalarie = (id: string) => {
    setSelectedSalarieId(id);
    const found = salaries.find((s) => s.id === id);
    if (found) {
      setEditPhone(found.phone);
      setEditLangue(found.langue || 'Français');
      setEditingContact(!found.phone);
      setTranslatedText('');
    }
  };

  const handleSaveContactQuick = async () => {
    if (!selectedSalarie) return;
    setSavingContact(true);
    try {
      await updateSalarieFields(selectedSalarie.id, {
        phone: editPhone,
        langue: editLangue,
      });
      setSalaries((prev) =>
        prev.map((s) =>
          s.id === selectedSalarie.id ? { ...s, phone: editPhone.trim(), langue: editLangue } : s
        )
      );
      setEditingContact(false);
      toast.success(`Fiche ${selectedSalarie.name} mise à jour sur Monday`);
    } catch (err: any) {
      toast.error(err?.message || 'Impossible de mettre à jour le salarié.');
    } finally {
      setSavingContact(false);
    }
  };

  // Créer un modèle personnalisé partagé sur Monday
  const handleCreateTemplate = async () => {
    if (!newTplLabel.trim() || !newTplText.trim()) {
      toast.error('Indiquez un nom et le texte du modèle.');
      return;
    }
    setSavingTpl(true);
    try {
      const created = await createCustomMessageTemplate({
        label: newTplLabel,
        theme,
        text: newTplText,
        author: animatriceFull,
      });
      setRawBoardRecords((prev) => [
        {
          id: created.id,
          title: created.label,
          salarie: '',
          phone: '',
          date: new Date().toISOString().slice(0, 10),
          animatrice: created.author,
          theme: created.theme,
          syntheseFr: created.text,
          messageTraduit: '',
          langue: 'Français',
          url: '',
          statut: 'Modèle',
        },
        ...prev,
      ]);
      setNewTplLabel('');
      setNewTplText('');
      setShowNewTplForm(false);
      toast.success(`Modèle « ${created.label} » sauvegardé sur Monday pour toute l’équipe !`);
    } catch (err: any) {
      toast.error(err?.message || 'Impossible d’enregistrer ce modèle.');
    } finally {
      setSavingTpl(false);
    }
  };

  const handleDeleteTemplate = async (tpl: MessageTemplateRecord) => {
    if (tpl.isDefault) return;
    try {
      await archiveAccompagnementOrTemplate(tpl.id);
      setRawBoardRecords((prev) => prev.filter((r) => r.id !== tpl.id));
      toast.success(`Modèle « ${tpl.label} » retiré.`);
    } catch {
      toast.error('Impossible de retirer ce modèle.');
    }
  };

  // Dictée vocale (Oral -> Écrit)
  const toggleVoiceDictation = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error('La dictée vocale n’est pas supportée sur ce navigateur (utilisez Chrome, Edge ou le micro du clavier mobile).');
      return;
    }

    if (isListening) {
      try {
        recognitionRef.current?.stop();
      } catch {
        // ignore
      }
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'fr-FR';
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = (event: any) => {
      setIsListening(false);
      if (event?.error !== 'aborted') {
        toast.error('Micro non autorisé ou indisponible. Vérifiez les permissions micro.');
      }
    };
    recognition.onresult = (event: any) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          transcript += event.results[i][0].transcript + ' ';
        }
      }
      if (transcript.trim()) {
        setSyntheseFr((prev) => (prev ? `${prev.trim()} ${transcript.trim()}` : transcript.trim()));
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  // Traduction dans la langue du salarié
  const handleTranslate = async () => {
    if (!syntheseFr.trim()) {
      toast.error('Écrivez ou dictez d’abord votre synthèse en français.');
      return;
    }
    if (editLangue === 'Français') {
      setTranslatedText(syntheseFr.trim());
      toast.info('Le salarié est francophone : texte prêt en français.');
      return;
    }
    setTranslating(true);
    try {
      const tr = await translateFromFrench(syntheseFr, editLangue);
      setTranslatedText(tr);
      toast.success(`Traduit en ${editLangue} !`);
    } catch {
      toast.error('Traduction automatique temporairement indisponible. Vous pouvez saisir le texte manuellement.');
    } finally {
      setTranslating(false);
    }
  };

  // Construction du message WhatsApp final
  const finalWhatsAppMessage = useMemo(() => {
    const parts: string[] = [];
    const mainBody =
      editLangue !== 'Français' && translatedText.trim()
        ? translatedText.trim()
        : syntheseFr.trim();

    if (mainBody) parts.push(mainBody);

    if (editLangue !== 'Français' && translatedText.trim() && includeBilingualFr && syntheseFr.trim()) {
      parts.push(`\n— Version française —\n${syntheseFr.trim()}`);
    }

    if (resourceUrl.trim()) {
      const cleanUrl = resourceUrl.trim().startsWith('http') ? resourceUrl.trim() : `https://${resourceUrl.trim()}`;
      parts.push(`\n🔗 Lien utile : ${cleanUrl}`);
    }

    parts.push(`\n— ${animatriceFull} • Groupe Facility`);
    return parts.join('\n');
  }, [syntheseFr, translatedText, editLangue, includeBilingualFr, resourceUrl, animatriceFull]);

  const handlePhotoChange = (file: File | null) => {
    setPhotoFile(file);
    if (!file) {
      setPhotoPreview(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => setPhotoPreview(String(e.target?.result || ''));
    reader.readAsDataURL(file);
  };

  // Enregistrement trace Monday + Ouverture WhatsApp directe (0 €)
  const handleSendWhatsApp = async () => {
    if (!selectedSalarie) {
      toast.error('Veuillez sélectionner un salarié.');
      return;
    }
    if (!editPhone.trim()) {
      toast.error('Numéro de téléphone manquant sur la fiche RH : cliquez sur « Modifier » pour le renseigner.');
      setEditingContact(true);
      return;
    }
    if (!syntheseFr.trim()) {
      toast.error('Veuillez dicter ou saisir la synthèse de l’accompagnement.');
      return;
    }

    setSending(true);
    try {
      // Traduction automatique si la fiche RH indique une langue ≠ Français et pas encore traduite
      let effectiveTranslated = translatedText.trim();
      if (editLangue !== 'Français' && !effectiveTranslated) {
        try {
          effectiveTranslated = await translateFromFrench(syntheseFr.trim(), editLangue);
          setTranslatedText(effectiveTranslated);
        } catch {
          effectiveTranslated = syntheseFr.trim();
        }
      }

      if (editPhone.trim() !== selectedSalarie.phone || editLangue !== selectedSalarie.langue) {
        await updateSalarieFields(selectedSalarie.id, { phone: editPhone, langue: editLangue });
        setSalaries((prev) =>
          prev.map((s) =>
            s.id === selectedSalarie.id ? { ...s, phone: editPhone.trim(), langue: editLangue } : s
          )
        );
      }

      const { id, photoUrl } = await createAccompagnementRecord({
        salarieName: selectedSalarie.name,
        phone: editPhone.trim(),
        date: dateAccomp,
        animatrice: animatriceFull,
        theme,
        syntheseFr: syntheseFr.trim(),
        messageTraduit: effectiveTranslated || syntheseFr.trim(),
        langue: editLangue,
        url: resourceUrl.trim(),
        statut: 'Envoyé WhatsApp',
        photoFile,
      });

      const msgParts: string[] = [];
      const mainBody =
        editLangue !== 'Français' && effectiveTranslated ? effectiveTranslated : syntheseFr.trim();
      if (mainBody) msgParts.push(mainBody);
      if (editLangue !== 'Français' && effectiveTranslated && includeBilingualFr && syntheseFr.trim()) {
        msgParts.push(`\n— Version française —\n${syntheseFr.trim()}`);
      }
      if (resourceUrl.trim()) {
        const cleanUrl = resourceUrl.trim().startsWith('http') ? resourceUrl.trim() : `https://${resourceUrl.trim()}`;
        msgParts.push(`\nLien utile : ${cleanUrl}`);
      }
      msgParts.push(`\n— ${animatriceFull} • Groupe Facility`);

      const waUrl = buildWhatsAppUrl(editPhone, msgParts.join('\n'));
      window.open(waUrl, '_blank', 'noopener,noreferrer');

      setRawBoardRecords((prev) => [
        {
          id,
          title: `${selectedSalarie.name} — ${theme} (${dateAccomp})`,
          salarie: selectedSalarie.name,
          phone: editPhone.trim(),
          date: dateAccomp,
          animatrice: animatriceFull,
          theme,
          syntheseFr: syntheseFr.trim(),
          messageTraduit: effectiveTranslated || syntheseFr.trim(),
          langue: editLangue,
          url: resourceUrl.trim(),
          statut: 'Envoyé WhatsApp',
          photoUrl: photoUrl || undefined,
          photoName: photoFile?.name,
        },
        ...prev,
      ]);

      toast.success(
        editLangue !== 'Français'
          ? `Traduit en ${editLangue}, archivé sur Monday et WhatsApp ouvert !`
          : 'Trace enregistrée sur Monday et WhatsApp ouvert !'
      );
      setSyntheseFr('');
      setTranslatedText('');
      setResourceUrl('');
      handlePhotoChange(null);
    } catch (err: any) {
      toast.error(err?.message || 'Erreur lors de l’enregistrement.');
    } finally {
      setSending(false);
    }
  };

  // Ajout manuel rapide d'un salarié
  const handleAddSalarie = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSalName.trim()) return;
    setAddingSal(true);
    try {
      const created = await createSalarieItem({
        name: newSalName,
        phone: newSalPhone,
        langue: newSalLangue,
        secteur: animatriceFull,
        statut: 'En poste',
      });
      setSalaries((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name, 'fr')));
      setNewSalName('');
      setNewSalPhone('');
      toast.success(`${created.name} ajouté à la liste des salariés !`);
    } catch (err: any) {
      toast.error(err?.message || 'Impossible d’ajouter le salarié.');
    } finally {
      setAddingSal(false);
    }
  };

  // Lecture locale Excel (.xlsx) avec FILTRE RGPD STRICT
  const handleExcelFileSelect = async (file: File | null) => {
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });

      const parsed: ParsedExcelSalarie[] = [];
      for (const r of rows) {
        const findCol = (patterns: string[]) => {
          const key = Object.keys(r).find((k) => {
            const norm = k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            return patterns.some((p) => norm.includes(p));
          });
          return key ? String(r[key] ?? '').trim() : '';
        };

        const nom = findCol(['nom du salarie', 'nom']);
        const prenom = findCol(['prenom']);
        const fullName =
          prenom && !nom.toLowerCase().includes(prenom.toLowerCase())
            ? `${nom} ${prenom}`.trim()
            : nom;
        if (!fullName || fullName.length < 2) continue;

        const portable = findCol(['portable']);
        const tel = findCol(['telephone']);
        const phone = portable || tel;

        const nat = findCol(['nationalite']);
        const langue = inferLanguageFromNationality(nat);

        const secteur = findCol(['inspecteur', 'secteur']);
        const sortie = findCol(['sortie']);
        const etat = findCol(['etat']).toLowerCase();
        const isSorti = Boolean(sortie) || etat.includes('sorti') || etat.includes('inactif');

        parsed.push({
          name: fullName,
          phone,
          langue,
          secteur,
          statut: isSorti ? 'Sorti' : 'En poste',
        });
      }

      if (parsed.length === 0) {
        toast.error('Aucun salarié détecté dans ce fichier Excel.');
        return;
      }
      setExcelFileName(file.name);
      setExcelPreview(parsed);
      toast.success(`${parsed.length} salariés lus localement (colonnes sensibles RGPD ignorées).`);
    } catch {
      toast.error('Impossible de lire ce fichier Excel (.xlsx).');
    }
  };

  const handleConfirmExcelImport = async () => {
    if (!excelPreview || excelPreview.length === 0) return;
    setImportingExcel(true);
    try {
      const existingByNorm = new Map<string, SalarieRecord>();
      salaries.forEach((s) => {
        existingByNorm.set(
          s.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim(),
          s
        );
      });

      let createdCount = 0;
      let updatedCount = 0;
      for (const row of excelPreview) {
        const key = row.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
        const existing = existingByNorm.get(key);
        if (existing) {
          if (row.phone !== existing.phone || row.statut !== existing.statut) {
            await updateSalarieFields(existing.id, {
              phone: row.phone || existing.phone,
              statut: row.statut,
            });
            updatedCount++;
          }
        } else {
          await createSalarieItem({
            name: row.name,
            phone: row.phone,
            langue: row.langue,
            secteur: row.secteur || undefined,
            statut: row.statut,
          });
          createdCount++;
        }
      }

      toast.success(`Import terminé : ${createdCount} créés, ${updatedCount} mis à jour !`);
      setExcelPreview(null);
      setExcelFileName('');
      await loadAll();
    } catch (err: any) {
      toast.error(err?.message || 'Erreur lors de la synchronisation Monday.');
    } finally {
      setImportingExcel(false);
    }
  };

  const activeSalaries = useMemo(() => salaries.filter((s) => s.statut !== 'Sorti'), [salaries]);

  const historySalariesOptions = useMemo(() => {
    const counts = new Map<string, number>();
    history.forEach((h) => {
      if (h.salarie) counts.set(h.salarie, (counts.get(h.salarie) || 0) + 1);
    });
    return [
      { value: 'all', label: `Tous les salariés (${counts.size})` },
      ...Array.from(counts.entries())
        .sort((a, b) => a[0].localeCompare(b[0], 'fr'))
        .map(([name, count]) => ({ value: name, label: name, badge: `${count} msg` })),
    ];
  }, [history]);

  const filteredHistory = useMemo(() => {
    const q = libSearch.trim().toLowerCase();
    return history.filter((h) => {
      if (libAnimFilter !== 'all' && h.animatrice !== libAnimFilter) return false;
      if (libSalarieFilter !== 'all' && h.salarie !== libSalarieFilter) return false;
      if (!q) return true;
      return (
        h.salarie.toLowerCase().includes(q) ||
        h.syntheseFr.toLowerCase().includes(q) ||
        h.messageTraduit.toLowerCase().includes(q) ||
        h.theme.toLowerCase().includes(q)
      );
    });
  }, [history, libSearch, libAnimFilter, libSalarieFilter]);

  const filteredSalaries = useMemo(() => {
    const q = salSearch.trim().toLowerCase();
    if (!q) return salaries;
    return salaries.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.phone.toLowerCase().includes(q) ||
        s.langue.toLowerCase().includes(q) ||
        s.secteur.toLowerCase().includes(q)
    );
  }, [salaries, salSearch]);

  const salarieSelectOptions = useMemo(
    () =>
      activeSalaries.map((s) => {
        const langObj = SUPPORTED_LANGUAGES.find((l) => l.label === s.langue);
        return {
          value: s.id,
          label: s.name,
          badge: langObj?.short || 'FR',
          sub: `${s.phone ? formatPhoneDisplay(s.phone) : 'Tél. à renseigner RH'} • ${s.langue || 'Français'}`,
        };
      }),
    [activeSalaries]
  );

  const selectedLangShort = useMemo(
    () => SUPPORTED_LANGUAGES.find((l) => l.label === editLangue)?.short || 'FR',
    [editLangue]
  );

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      {/* En-tête Espace Accompagnement */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-gradient-to-r from-[#1B4565] via-[#2B6D98] to-[#39A9DC] px-4 py-4 text-white sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-400/20 border border-emerald-300/40">
            <MessageCircle className="h-6 w-6 text-emerald-300" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-extrabold sm:text-lg">Accompagnement Salariés &amp; WhatsApp</h3>
              <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-bold">
                0 € / mois • Pole RH
              </span>
            </div>
            <p className="text-xs text-white/80">
              Coordonnées gérées par les RH : sélectionnez un salarié, dictez ou écrivez, traduisez et envoyez sur WhatsApp.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void loadAll()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/25 transition-colors"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          <span>Actualiser</span>
        </button>
      </div>

      {/* Onglets */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/40 px-4 py-2.5 sm:px-6">
        {[
          { id: 'compose' as const, label: 'Nouvel accompagnement', icon: Send },
          { id: 'library' as const, label: `Bibliothèque (${history.length})`, icon: BookOpen },
          { id: 'salaries' as const, label: `Annuaire RH & Import Excel (${activeSalaries.length})`, icon: Users },
        ].map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all',
                active
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-background text-foreground border border-border hover:bg-muted'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {loading && salaries.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span>Chargement de l’espace Accompagnement (Pole RH)...</span>
        </div>
      ) : (
        <div className="p-4 sm:p-6">
          {/* ==================== ONGLET 1 : NOUVEL ACCOMPAGNEMENT ==================== */}
          {tab === 'compose' && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              {/* Colonne gauche : Formulaire simplifié */}
              <div className="space-y-4 lg:col-span-7">
                {/* 1. Salarié (Tél & Langue auto-remplis depuis RH, lecture seule par défaut) */}
                <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-extrabold uppercase tracking-wide text-primary">
                      1. Salarié concerné
                    </label>
                    <button
                      type="button"
                      onClick={() => setTab('salaries')}
                      className="text-xs font-bold text-primary hover:underline"
                    >
                      Annuaire RH / Import Excel
                    </button>
                  </div>

                  <PillSelect
                    value={selectedSalarieId}
                    options={salarieSelectOptions}
                    onChange={handleSelectSalarie}
                    placeholder="Choisir un salarié..."
                    searchable
                  />

                  {selectedSalarie && !editingContact && (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/80 bg-background px-3 py-2 text-xs">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="inline-flex items-center gap-1.5 font-bold text-foreground">
                          <Phone className="h-3.5 w-3.5 text-emerald-600" />
                          {editPhone ? formatPhoneDisplay(editPhone) : <span className="text-amber-600">Numéro non renseigné</span>}
                        </span>
                        <span className="text-muted-foreground">•</span>
                        <span className="inline-flex items-center gap-1.5 font-bold text-primary">
                          <Globe className="h-3.5 w-3.5" />
                          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-extrabold">{selectedLangShort}</span>
                          <span>{editLangue}</span>
                        </span>
                        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                          Fiche RH
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditingContact(true)}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold text-muted-foreground hover:bg-muted hover:text-foreground"
                        title="Corriger le numéro ou la langue si besoin"
                      >
                        <Pencil className="h-3 w-3" />
                        <span>Modifier</span>
                      </button>
                    </div>
                  )}

                  {selectedSalarie && editingContact && (
                    <div className="grid grid-cols-1 gap-2.5 rounded-xl border border-primary/30 bg-background p-3 sm:grid-cols-12">
                      <div className="sm:col-span-5">
                        <label className="mb-1 block text-[11px] font-bold text-muted-foreground">
                          Téléphone WhatsApp
                        </label>
                        <div className="relative">
                          <Phone className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-emerald-600" />
                          <input
                            type="tel"
                            value={editPhone}
                            onChange={(e) => setEditPhone(e.target.value)}
                            placeholder="Ex: 06 12 34 56 78"
                            className="w-full rounded-xl border border-border bg-background py-2 pl-8 pr-3 text-xs font-semibold focus:border-primary focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="sm:col-span-4">
                        <label className="mb-1 block text-[11px] font-bold text-muted-foreground">
                          Langue du salarié
                        </label>
                        <PillSelect
                          value={editLangue}
                          onChange={(val) => {
                            setEditLangue(val);
                            setTranslatedText('');
                          }}
                          options={SUPPORTED_LANGUAGES.map((l) => ({
                            value: l.label,
                            label: l.label,
                            badge: l.short,
                          }))}
                        />
                      </div>

                      <div className="flex items-end gap-1.5 sm:col-span-3">
                        <button
                          type="button"
                          disabled={savingContact}
                          onClick={handleSaveContactQuick}
                          className="flex-1 rounded-xl bg-primary px-2.5 py-2 text-xs font-bold text-primary-foreground hover:opacity-95 disabled:opacity-50"
                        >
                          {savingContact ? '...' : 'OK'}
                        </button>
                        {selectedSalarie.phone && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditPhone(selectedSalarie.phone);
                              setEditLangue(selectedSalarie.langue || 'Français');
                              setEditingContact(false);
                            }}
                            className="rounded-xl border border-border p-2 text-muted-foreground hover:bg-muted"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Date & Thème */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-primary">
                      Date de l’accompagnement
                    </label>
                    <input
                      type="date"
                      value={dateAccomp}
                      onChange={(e) => setDateAccomp(e.target.value)}
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-primary">
                      Thème / Ce qui a été vu
                    </label>
                    <PillSelect
                      value={theme}
                      onChange={setTheme}
                      options={ACCOMPAGNEMENT_THEMES.map((t) => ({ value: t, label: t }))}
                    />
                  </div>
                </div>

                {/* 3. Synthèse (Dictée vocale OU Texte) + Modèles personnalisables partagés */}
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="text-xs font-extrabold uppercase tracking-wide text-primary">
                      2. Synthèse à envoyer (Français)
                    </label>
                    <button
                      type="button"
                      onClick={toggleVoiceDictation}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition-all',
                        isListening
                          ? 'bg-red-600 text-white animate-pulse shadow-sm'
                          : 'bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20'
                      )}
                    >
                      {isListening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                      <span>{isListening ? 'Arrêter la dictée...' : 'Dicter à la voix'}</span>
                    </button>
                  </div>

                  {/* Modèles rapides (base + modèles personnalisés sauvegardés sur Monday) */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {allTemplates.map((tpl) => (
                      <div
                        key={tpl.id}
                        className="inline-flex items-center rounded-full border border-border bg-muted/50 text-[11px] font-semibold text-foreground hover:border-primary/50 hover:bg-primary/5"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setTheme(tpl.theme);
                            setSyntheseFr(tpl.text);
                            setTranslatedText('');
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1"
                        >
                          <Sparkles className="h-3 w-3 text-amber-500" />
                          <span>{tpl.label}</span>
                        </button>
                        {!tpl.isDefault && (
                          <button
                            type="button"
                            onClick={() => void handleDeleteTemplate(tpl)}
                            title="Retirer ce modèle personnalisé"
                            className="pr-2 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={() => {
                        setShowNewTplForm((v) => !v);
                        if (!showNewTplForm && syntheseFr.trim()) {
                          setNewTplText(syntheseFr.trim());
                        }
                      }}
                      className="inline-flex items-center gap-1 rounded-full border border-dashed border-primary/60 bg-primary/5 px-2.5 py-1 text-[11px] font-bold text-primary hover:bg-primary/10"
                    >
                      <Plus className="h-3 w-3" />
                      <span>Créer un modèle</span>
                    </button>
                  </div>

                  {/* Mini formulaire création de modèle partagé Monday */}
                  {showNewTplForm && (
                    <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-primary">
                          Nouveau modèle partagé (sauvegardé sur Monday pour toute l’équipe)
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowNewTplForm(false)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <input
                        type="text"
                        value={newTplLabel}
                        onChange={(e) => setNewTplLabel(e.target.value)}
                        placeholder="Nom court du modèle (ex : Rappel EPI, Horaires été...)"
                        className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold focus:border-primary focus:outline-none"
                      />
                      <textarea
                        rows={2}
                        value={newTplText}
                        onChange={(e) => setNewTplText(e.target.value)}
                        placeholder="Texte réutilisable du modèle..."
                        className="w-full resize-none rounded-lg border border-border bg-background p-2 text-xs focus:border-primary focus:outline-none"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setShowNewTplForm(false)}
                          className="rounded-lg border border-border bg-background px-3 py-1 text-xs font-bold text-muted-foreground"
                        >
                          Annuler
                        </button>
                        <button
                          type="button"
                          disabled={savingTpl || !newTplLabel.trim() || !newTplText.trim()}
                          onClick={() => void handleCreateTemplate()}
                          className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1 text-xs font-bold text-primary-foreground disabled:opacity-50"
                        >
                          {savingTpl ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                          <span>Sauvegarder sur Monday</span>
                        </button>
                      </div>
                    </div>
                  )}

                  <textarea
                    rows={4}
                    value={syntheseFr}
                    onChange={(e) => setSyntheseFr(e.target.value)}
                    placeholder="Dictez au micro ou écrivez ce qui a été vu avec le salarié (ex : je t’ai montré l’utilisation de l’autolaveuse et le rinçage de la cuve)..."
                    className="w-full resize-none rounded-xl border border-border bg-background p-3 text-sm focus:border-primary focus:outline-none"
                  />
                </div>

                {/* 4. Traduction automatique dans la langue du salarié */}
                {editLangue !== 'Français' && (
                  <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-3.5 space-y-2.5 dark:bg-sky-950/20">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-sky-800 dark:text-sky-300">
                        <Globe className="h-4 w-4" />
                        Traduction automatique ({editLangue})
                      </span>
                      <button
                        type="button"
                        disabled={translating || !syntheseFr.trim()}
                        onClick={() => void handleTranslate()}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-sky-700 disabled:opacity-50"
                      >
                        {translating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Globe className="h-3.5 w-3.5" />}
                        <span>{translating ? 'Traduction...' : `Traduire en ${editLangue}`}</span>
                      </button>
                    </div>
                    <textarea
                      rows={3}
                      value={translatedText}
                      onChange={(e) => setTranslatedText(e.target.value)}
                      placeholder={`Cliquez sur "Traduire en ${editLangue}" pour générer le message traduit (modifiable)...`}
                      className="w-full resize-none rounded-xl border border-sky-200 bg-background p-2.5 text-sm focus:border-sky-500 focus:outline-none"
                    />
                    <label className="inline-flex items-center gap-2 text-xs font-semibold text-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeBilingualFr}
                        onChange={(e) => setIncludeBilingualFr(e.target.checked)}
                        className="rounded border-border"
                      />
                      <span>Inclure aussi la version française en dessous (bilingue)</span>
                    </label>
                  </div>
                )}

                {/* 5. Photo & Lien URL */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-bold text-muted-foreground">
                      Lien URL / Tuto (optionnel)
                    </label>
                    <div className="relative">
                      <Link2 className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-primary" />
                      <input
                        type="url"
                        value={resourceUrl}
                        onChange={(e) => setResourceUrl(e.target.value)}
                        placeholder="https://..."
                        className="w-full rounded-xl border border-border bg-background py-2 pl-8 pr-3 text-xs font-semibold focus:border-primary focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-bold text-muted-foreground">
                      Photo / Image jointe (optionnel)
                    </label>
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handlePhotoChange(e.target.files?.[0] || null)}
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => photoInputRef.current?.click()}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-dashed border-primary/50 bg-primary/5 px-3 py-2 text-xs font-bold text-primary hover:bg-primary/10"
                      >
                        <Camera className="h-3.5 w-3.5" />
                        <span className="truncate">{photoFile ? photoFile.name : 'Ajouter une photo'}</span>
                      </button>
                      {photoFile && (
                        <button
                          type="button"
                          onClick={() => handlePhotoChange(null)}
                          className="rounded-lg border border-border p-2 text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Colonne droite : Fil des messages envoyés à ce salarié + Aperçu WhatsApp en direct */}
              <div className="flex flex-col justify-between gap-4 rounded-2xl border border-emerald-200 bg-[#ECE5DD]/60 p-4 lg:col-span-5">
                <div className="flex flex-col gap-3 min-h-0">
                  <div className="flex items-center justify-between rounded-xl bg-[#075E54] px-3.5 py-2.5 text-white">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold">
                        {selectedSalarie ? selectedSalarie.name : 'Aperçu WhatsApp'}
                      </div>
                      <div className="text-[11px] text-emerald-200">
                        {editPhone ? formatPhoneDisplay(editPhone) : 'Tél. non renseigné'} • {editLangue}
                        {selectedSalarieThread.length > 0 ? ` • ${selectedSalarieThread.length} envoyé(s)` : ''}
                      </div>
                    </div>
                    <MessageCircle className="h-5 w-5 shrink-0 text-emerald-300" />
                  </div>

                  {/* Historique des messages déjà envoyés à ce salarié */}
                  <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                    {selectedSalarieThread.map((msg) => (
                      <div
                        key={msg.id}
                        className="ml-auto max-w-[92%] rounded-xl rounded-tr-none border border-emerald-200/80 bg-white/90 p-2.5 text-xs text-slate-800 shadow-2xs"
                      >
                        <div className="mb-1 flex items-center justify-between gap-2 text-[10px] font-bold text-slate-500">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5" />
                            {msg.date || '—'} • {msg.animatrice || 'Animatrice'}
                          </span>
                          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-800">{msg.theme}</span>
                        </div>
                        <div className="whitespace-pre-wrap leading-relaxed">
                          {msg.messageTraduit || msg.syntheseFr}
                        </div>
                      </div>
                    ))}

                    {/* Bulle aperçu du message en cours de rédaction */}
                    <div className="ml-auto max-w-[95%] rounded-xl rounded-tr-none border border-emerald-300 bg-[#DCF8C6] p-3 text-xs leading-relaxed text-slate-900 shadow-xs whitespace-pre-wrap">
                      <div className="mb-1 text-[10px] font-extrabold uppercase tracking-wide text-emerald-800">
                        Nouveau message (aperçu)
                      </div>
                      {syntheseFr.trim() ? (
                        finalWhatsAppMessage
                      ) : (
                        <span className="italic text-slate-500">
                          Votre message d’accompagnement apparaîtra ici en direct avant ouverture de WhatsApp...
                        </span>
                      )}
                      {photoPreview && (
                        <div className="mt-2 overflow-hidden rounded-lg border border-emerald-300/60">
                          <img src={photoPreview} alt="Aperçu pièce jointe" className="max-h-36 w-full object-cover" />
                        </div>
                      )}
                    </div>
                  </div>

                  <p className="text-[10.5px] leading-snug text-slate-600">
                    💡 Mode 0 € : cet écran affiche l’historique complet des messages envoyés par les animatrices. Les réponses du salarié arrivent directement dans votre application WhatsApp.
                  </p>
                </div>

                <div className="space-y-2.5">
                  <button
                    type="button"
                    disabled={sending || !selectedSalarie || !editPhone.trim() || !syntheseFr.trim()}
                    onClick={() => void handleSendWhatsApp()}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3 text-sm font-extrabold text-white shadow-md transition-all hover:bg-[#1FB858] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
                    <span>{sending ? 'Enregistrement Monday...' : 'Enregistrer & Ouvrir WhatsApp'}</span>
                  </button>

                  <div className="flex items-center justify-between text-[11px] text-slate-600">
                    <span className="inline-flex items-center gap-1 font-semibold">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-700" />
                      Trace archivée sur Monday (Pole RH)
                    </span>
                    <a
                      href={`https://groupefacility.monday.com/boards/${BOARD_ACCOMPAGNEMENTS_ID}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-bold text-[#075E54] hover:underline"
                    >
                      <span>Tableau</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ==================== ONGLET 2 : BIBLIOTHÈQUE & HISTORIQUE ==================== */}
          {tab === 'library' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[200px] flex-1 max-w-sm">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={libSearch}
                    onChange={(e) => setLibSearch(e.target.value)}
                    placeholder="Rechercher un salarié, un thème, un message..."
                    className="w-full rounded-xl border border-border bg-background py-2 pl-9 pr-3 text-xs font-semibold focus:border-primary focus:outline-none"
                  />
                </div>
                <div className="w-52">
                  <PillSelect
                    value={libSalarieFilter}
                    onChange={setLibSalarieFilter}
                    searchable
                    options={historySalariesOptions}
                  />
                </div>
                <div className="w-48">
                  <PillSelect
                    value={libAnimFilter}
                    onChange={setLibAnimFilter}
                    options={[
                      { value: 'all', label: 'Toutes les animatrices' },
                      { value: 'Natacha THOMAS', label: 'Natacha THOMAS' },
                      { value: 'Ketty PAULIN', label: 'Ketty PAULIN' },
                      { value: 'Emilie TOBIE', label: 'Emilie TOBIE' },
                    ]}
                  />
                </div>
              </div>

              {filteredHistory.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
                  Aucun accompagnement WhatsApp enregistré pour le moment.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {filteredHistory.map((item) => (
                    <div key={item.id} className="rounded-xl border border-border bg-background p-4 shadow-xs space-y-2">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-extrabold text-foreground">{item.salarie}</div>
                          <div className="text-[11px] font-semibold text-muted-foreground">
                            {item.date || '—'} • {item.animatrice || 'Animatrice'} • {item.langue}
                          </div>
                        </div>
                        <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                          {item.theme || 'Accompagnement'}
                        </span>
                      </div>

                      <p className="rounded-lg bg-muted/40 p-2.5 text-xs text-foreground whitespace-pre-wrap">
                        {item.syntheseFr}
                      </p>

                      {item.messageTraduit && item.messageTraduit !== item.syntheseFr && (
                        <p className="rounded-lg border border-sky-200 bg-sky-50/60 p-2.5 text-xs text-sky-950 whitespace-pre-wrap">
                          <span className="mb-1 block text-[10px] font-extrabold uppercase text-sky-700">
                            Traduction ({item.langue})
                          </span>
                          {item.messageTraduit}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          {item.url && (
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 font-bold text-primary hover:underline"
                            >
                              <Link2 className="h-3.5 w-3.5" />
                              <span>Lien</span>
                            </a>
                          )}
                          {item.photoUrl && (
                            <a
                              href={item.photoUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 font-bold text-sky-700 hover:underline"
                            >
                              <Camera className="h-3.5 w-3.5" />
                              <span>Photo</span>
                            </a>
                          )}
                        </div>

                        {item.phone && (
                          <button
                            type="button"
                            onClick={() => {
                              const url = buildWhatsAppUrl(item.phone, item.messageTraduit || item.syntheseFr);
                              window.open(url, '_blank', 'noopener,noreferrer');
                            }}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600/10 px-2.5 py-1 text-[11px] font-bold text-emerald-700 hover:bg-emerald-600/20"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                            <span>Ouvrir WhatsApp</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ==================== ONGLET 3 : ANNUAIRE RH & IMPORT MENSUEL RGPD ==================== */}
          {tab === 'salaries' && (
            <div className="space-y-5">
              {/* Zone Import Mensuel Excel (.xlsx) avec filtre RGPD strict */}
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-extrabold text-foreground">
                      <FileSpreadsheet className="h-4 w-4 text-primary" />
                      <span>Import Mensuel RH (.xlsx) — Filtre RGPD strict</span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Importez « Export liste salariés.xlsx » : seuls <strong>Nom, Téléphone, Secteur, Langue et Statut</strong> sont lus.
                      Les colonnes sensibles (N° SS, IBAN, salaire, handicap, adresse) sont <strong>automatiquement ignorées</strong>.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      ref={excelInputRef}
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      className="hidden"
                      onChange={(e) => void handleExcelFileSelect(e.target.files?.[0] || null)}
                    />
                    <button
                      type="button"
                      onClick={() => excelInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground hover:opacity-95"
                    >
                      <FileSpreadsheet className="h-4 w-4" />
                      <span>Choisir un fichier Excel</span>
                    </button>
                    <a
                      href={`https://groupefacility.monday.com/boards/${BOARD_SALARIES_ID}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold text-foreground hover:bg-muted"
                    >
                      <span>Tableau Monday</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>

                {excelPreview && (
                  <div className="rounded-xl border border-border bg-background p-3 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-extrabold text-foreground">
                        Aperçu : {excelPreview.length} salariés détectés dans « {excelFileName} »
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setExcelPreview(null);
                            setExcelFileName('');
                          }}
                          className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-muted-foreground hover:bg-muted"
                        >
                          Annuler
                        </button>
                        <button
                          type="button"
                          disabled={importingExcel}
                          onClick={() => void handleConfirmExcelImport()}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {importingExcel ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                          <span>{importingExcel ? 'Synchronisation...' : 'Synchroniser sur Monday'}</span>
                        </button>
                      </div>
                    </div>
                    <div className="max-h-44 overflow-auto text-xs">
                      <table className="w-full">
                        <thead className="bg-muted/50 text-left text-[11px] font-bold text-muted-foreground">
                          <tr>
                            <th className="px-2 py-1.5">Salarié</th>
                            <th className="px-2 py-1.5">Téléphone</th>
                            <th className="px-2 py-1.5">Langue suggérée</th>
                            <th className="px-2 py-1.5">Statut</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {excelPreview.slice(0, 30).map((r, i) => (
                            <tr key={`${r.name}-${i}`}>
                              <td className="px-2 py-1.5 font-semibold">{r.name}</td>
                              <td className="px-2 py-1.5">{r.phone ? formatPhoneDisplay(r.phone) : '—'}</td>
                              <td className="px-2 py-1.5">{r.langue}</td>
                              <td className="px-2 py-1.5">{r.statut}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Ajout rapide manuel */}
              <form
                onSubmit={handleAddSalarie}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/20 p-3"
              >
                <span className="inline-flex items-center gap-1 text-xs font-extrabold text-foreground">
                  <UserPlus className="h-4 w-4 text-primary" />
                  Ajouter :
                </span>
                <input
                  type="text"
                  value={newSalName}
                  onChange={(e) => setNewSalName(e.target.value)}
                  placeholder="Nom Prénom"
                  className="min-w-[160px] flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold focus:border-primary focus:outline-none"
                />
                <input
                  type="tel"
                  value={newSalPhone}
                  onChange={(e) => setNewSalPhone(e.target.value)}
                  placeholder="06 12 34 56 78"
                  className="w-40 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold focus:border-primary focus:outline-none"
                />
                <div className="w-40">
                  <PillSelect
                    value={newSalLangue}
                    onChange={setNewSalLangue}
                    options={SUPPORTED_LANGUAGES.map((l) => ({
                      value: l.label,
                      label: l.label,
                      badge: l.short,
                    }))}
                  />
                </div>
                <button
                  type="submit"
                  disabled={addingSal || !newSalName.trim()}
                  className="rounded-lg bg-primary px-3.5 py-1.5 text-xs font-bold text-primary-foreground hover:opacity-95 disabled:opacity-50"
                >
                  {addingSal ? 'Ajout...' : 'Ajouter'}
                </button>
              </form>

              {/* Liste des salariés */}
              <div className="space-y-2">
                <div className="relative max-w-sm">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={salSearch}
                    onChange={(e) => setSalSearch(e.target.value)}
                    placeholder="Filtrer un salarié, téléphone, langue..."
                    className="w-full rounded-xl border border-border bg-background py-2 pl-9 pr-3 text-xs font-semibold focus:border-primary focus:outline-none"
                  />
                </div>

                <div className="max-h-80 overflow-auto rounded-xl border border-border">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-muted text-left text-[11px] font-bold uppercase text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2">Salarié</th>
                        <th className="px-3 py-2">Téléphone</th>
                        <th className="px-3 py-2">Langue</th>
                        <th className="px-3 py-2">Statut</th>
                        <th className="px-3 py-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredSalaries.map((s) => (
                        <tr key={s.id} className="hover:bg-muted/30">
                          <td className="px-3 py-2 font-bold text-foreground">{s.name}</td>
                          <td className="px-3 py-2">{s.phone ? formatPhoneDisplay(s.phone) : '—'}</td>
                          <td className="px-3 py-2">{s.langue}</td>
                          <td className="px-3 py-2">
                            <span
                              className={cn(
                                'rounded-full px-2 py-0.5 text-[10.5px] font-bold',
                                s.statut === 'Sorti'
                                  ? 'bg-muted text-muted-foreground'
                                  : 'bg-emerald-500/15 text-emerald-700'
                              )}
                            >
                              {s.statut}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                handleSelectSalarie(s.id);
                                setTab('compose');
                              }}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600/10 px-2.5 py-1 text-[11px] font-bold text-emerald-700 hover:bg-emerald-600/20"
                            >
                              <MessageCircle className="h-3 w-3" />
                              <span>Écrire</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
