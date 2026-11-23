import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Lightbulb,
  PlusCircle,
  ListTodo,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Send,
  Search,
  Sparkles,
  X,
  User,
  Calendar,
  Building2,
  Wrench,
  Truck,
  FileSpreadsheet,
  Trash2,
  Check,
  TrendingUp,
  Paperclip,
  ExternalLink,
  UploadCloud,
  FileText,
  Pencil,
  Save,
} from 'lucide-react';

export interface RoadmapItem {
  id: string;
  name: string;
  groupTitle: string; // 'Tache à faire' ou 'Tâches effectuées'
  groupId: string;
  priority: '1 (Urgent)' | '2 (Normal)' | '3 (Basse)' | string;
  status: 'En cours' | 'Fait' | 'Bloqué' | string;
  description: string;
  author: string;
  workspace: string; // 'Animatrices', 'Gros Matos', 'Suivi Vehicules', 'Enchantement client'
  date: string;
  timeline: string;
  fileUrl?: string;
  fileName?: string;
}

interface RoadmapModalProps {
  isOpen: boolean;
  onClose: () => void;
  monday: any;
  currentUserName?: string;
  initialTab?: 'form' | 'list';
}

const BOARD_ROADMAP_ID = 5105479748;
const GROUP_TODO_ID = 'group_mm7y5mjp'; // Tache à faire
const GROUP_DONE_ID = 'group_mm7y1vv8'; // Tâches effectuées

const POLE_OPTIONS = [
  { id: 'Animatrices', label: 'Animatrices & Chantiers', icon: Building2, color: '#3989B7', bg: '#EBF6FC' },
  { id: 'Gros Matos', label: 'Atelier & Gros Matériel', icon: Wrench, color: '#39A9DC', bg: '#EBF6FC' },
  { id: 'Suivi Vehicules', label: 'Facturation & Véhicules', icon: Truck, color: '#1B4565', bg: '#EBF6FC' },
  { id: 'Enchantement client', label: 'Commercial & Contrats', icon: FileSpreadsheet, color: '#D66927', bg: '#FEF6E7' },
];

const TYPE_OPTIONS = [
  { id: 'feat', label: 'Nouvelle idée / Fonction', icon: Sparkles, color: '#39A9DC' },
  { id: 'adjust', label: 'Ajustement / Amélioration', icon: TrendingUp, color: '#3989B7' },
  { id: 'remove', label: 'À retirer / Simplifier', icon: Trash2, color: '#E2445C' },
  { id: 'bug', label: 'Signalement de bug', icon: AlertTriangle, color: '#D66927' },
];

// Cache mémoire court (2 min) pour éviter de recharger la Roadmap à chaque ouverture/fermeture de modale
let roadmapCache: { ts: number; data: RoadmapItem[] } | null = null;
const ROADMAP_CACHE_TTL_MS = 2 * 60 * 1000;

export default function RoadmapModal({
  isOpen,
  onClose,
  monday,
  currentUserName = 'Guillaume Daniel',
  initialTab = 'list',
}: RoadmapModalProps) {
  const [activeTab, setActiveTab] = useState<'form' | 'list'>(initialTab);
  const [items, setItems] = useState<RoadmapItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successSent, setSuccessSent] = useState(false);
  const [successMode, setSuccessMode] = useState<'create' | 'edit'>('create');
  const [editingItem, setEditingItem] = useState<RoadmapItem | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Droits d'administration : SEUL Guillaume Daniel peut cocher / valider les demandes livrées
  const isManager = useMemo(() => {
    const u = (currentUserName || '').toLowerCase();
    return u.includes('guillaume') || u.includes('daniel');
  }, [currentUserName]);

  // Filtres onglet Roadmap
  const [search, setSearch] = useState('');
  const [selectedPoleFilter, setSelectedPoleFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'all' | 'todo' | 'done' | 'mine'>('all');

  // Champs du formulaire (le nom du demandeur est 100% automatique via currentUserName)
  const [typeDemande, setTypeDemande] = useState<string>('adjust');
  const [poleConcerne, setPoleConcerne] = useState<string>('Animatrices');
  const [titre, setTitre] = useState('');
  const [description, setDescription] = useState('');
  const [priorite, setPriorite] = useState<'1 (Urgent)' | '2 (Normal)' | '3 (Basse)'>('2 (Normal)');

  // Plage de temps souhaitée pour le diagramme de Gantt
  const todayIso = new Date().toISOString().slice(0, 10);
  const defaultEndIso = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const [dateDebut, setDateDebut] = useState(todayIso);
  const [dateFin, setDateFin] = useState(defaultEndIso);

  // Pièce jointe / Document (PDF, Word, Excel, Images...)
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload d'un fichier vers Monday via la colonne file_mm7wtnz1
  const uploadFileToMonday = async (itemId: string | number, file: File): Promise<boolean> => {
    const mutation = `mutation ($file: File!) {
      add_file_to_column(item_id: ${itemId}, column_id: "file_mm7wtnz1", file: $file) {
        id
        name
      }
    }`;

    // 1. Essai via SDK monday.api
    try {
      const res: any = await (monday as any).api(mutation, {
        variables: { file },
      });
      if (res?.data?.add_file_to_column?.id) {
        return true;
      }
    } catch (sdkErr) {
      console.warn('Tentative monday.api échouée pour fichier, fallback fetch:', sdkErr);
    }

    // 2. Fallback direct via fetch https://api.monday.com/v2/file
    try {
      let token = '';
      try {
        const sessionRes: any = await (monday as any).get('sessionToken');
        token = sessionRes?.data || '';
      } catch {}

      const formData = new FormData();
      formData.append('query', mutation);
      formData.append('variables[file]', file);

      const headers: Record<string, string> = {
        'API-Version': '2024-04',
      };
      if (token) {
        headers['Authorization'] = token;
      }

      const res = await fetch('https://api.monday.com/v2/file', {
        method: 'POST',
        headers,
        body: formData,
      });
      const json = await res.json();
      if (json?.data?.add_file_to_column?.id) {
        return true;
      }
    } catch (fetchErr) {
      console.warn('Erreur fallback fetch /v2/file:', fetchErr);
    }

    return false;
  };

  const handlePresetTimeline = (days: number) => {
    const start = new Date().toISOString().slice(0, 10);
    const end = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
    setDateDebut(start);
    setDateFin(end);
  };

  const resetForm = () => {
    setEditingItem(null);
    setTypeDemande('adjust');
    setPoleConcerne('Animatrices');
    setTitre('');
    setDescription('');
    setPriorite('2 (Normal)');
    setDateDebut(new Date().toISOString().slice(0, 10));
    setDateFin(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
    setAttachedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const startEditItem = (item: RoadmapItem) => {
    // Détecte un éventuel préfixe [Ajustement], [Nouvelle idée], [À retirer], [Signalement de bug]
    let detectedType = 'adjust';
    let cleanTitle = item.name.trim();
    const prefixMatch = cleanTitle.match(/^\[([^\]]+)\]\s*(.*)$/);
    if (prefixMatch) {
      const pText = prefixMatch[1].toLowerCase();
      if (pText.includes('nouvelle') || pText.includes('fonction') || pText.includes('idée') || pText.includes('idee')) {
        detectedType = 'feat';
      } else if (pText.includes('retirer') || pText.includes('simplif')) {
        detectedType = 'remove';
      } else if (pText.includes('bug') || pText.includes('signalement')) {
        detectedType = 'bug';
      } else {
        detectedType = 'adjust';
      }
      cleanTitle = prefixMatch[2].trim() || cleanTitle;
    }

    const matchedPole =
      POLE_OPTIONS.find((p) => item.workspace.toLowerCase().includes(p.id.toLowerCase()))?.id || 'Animatrices';

    const matchedPriority: '1 (Urgent)' | '2 (Normal)' | '3 (Basse)' = item.priority.includes('1')
      ? '1 (Urgent)'
      : item.priority.includes('3')
      ? '3 (Basse)'
      : '2 (Normal)';

    const tlMatch = item.timeline.match(/(\d{4}-\d{2}-\d{2})\s*[-–]\s*(\d{4}-\d{2}-\d{2})/);
    const start = tlMatch ? tlMatch[1] : item.date || new Date().toISOString().slice(0, 10);
    const end = tlMatch ? tlMatch[2] : start;

    setEditingItem(item);
    setTypeDemande(detectedType);
    setPoleConcerne(matchedPole);
    setTitre(cleanTitle);
    setDescription(item.description || '');
    setPriorite(matchedPriority);
    setDateDebut(start);
    setDateFin(end);
    setAttachedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setSuccessSent(false);
    setActiveTab('form');
  };

  const cancelEdit = () => {
    resetForm();
    setActiveTab('list');
  };

  // Synchronisation onglet initial
  useEffect(() => {
    if (isOpen) {
      setEditingItem(null);
      setSuccessSent(false);
      setActiveTab(initialTab);
      loadRoadmap();
    }
  }, [isOpen, initialTab]);

  // Charger les données du tableau Roadmap Monday (avec cache 2 min sauf si forceRefresh)
  const loadRoadmap = async (forceRefresh = false) => {
    if (!forceRefresh && roadmapCache && Date.now() - roadmapCache.ts < ROADMAP_CACHE_TTL_MS) {
      setItems(roadmapCache.data);
      return;
    }
    setLoading(true);
    try {
      const q = `query {
        boards(ids: [${BOARD_ROADMAP_ID}]) {
          items_page(limit: 100) {
            items {
              id
              name
              group { id title }
              column_values {
                id
                text
                value
                ... on FileValue {
                  files {
                    ... on FileAssetValue {
                      name
                      asset {
                        url
                        public_url
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }`;

      const res: any = await monday.api(q);
      const rawItems = res?.data?.boards?.[0]?.items_page?.items || [];

      const parsed: RoadmapItem[] = rawItems.map((it: any) => {
        const valMap = new Map<string, string>();
        let fileUrl = '';
        let fileName = '';

        it.column_values?.forEach((cv: any) => {
          if (cv.id && cv.text) valMap.set(cv.id, cv.text);
          if (cv.id === 'file_mm7wtnz1') {
            if (cv.files && cv.files.length > 0) {
              const f = cv.files[0];
              fileName = f.name || '';
              fileUrl = f.asset?.public_url || f.asset?.url || cv.text || '';
            } else if (cv.value) {
              try {
                const parsed = JSON.parse(cv.value);
                if (parsed?.files && parsed.files.length > 0) {
                  fileName = parsed.files[0]?.name || '';
                }
              } catch {}
              fileUrl = cv.text || '';
            } else if (cv.text) {
              fileUrl = cv.text;
              const parts = cv.text.split('/');
              fileName = decodeURIComponent(parts[parts.length - 1] || 'Document joint');
            }
          }
        });

        const authorFromCol = valMap.get('dropdown_mm978xpa') || '';
        const rawDesc = valMap.get('short_text2v8w5gvp') || '';
        let author = authorFromCol;
        let cleanDesc = rawDesc;
        if (!author && rawDesc.startsWith('Demandé par :')) {
          const parts = rawDesc.split('|');
          author = parts[0].replace('Demandé par :', '').trim();
          cleanDesc = parts.slice(1).join('|').trim();
        }

        return {
          id: it.id,
          name: it.name || 'Sans titre',
          groupTitle: it.group?.title || 'Tache à faire',
          groupId: it.group?.id || '',
          priority: (valMap.get('color_mm7yntfh') as any) || '2 (Normal)',
          status: valMap.get('status') || 'En cours',
          description: cleanDesc,
          author: author,
          workspace: valMap.get('multi_selectp70jvoio') || 'Général',
          date: valMap.get('date_mm7yphvc') || '',
          timeline: valMap.get('timerange_mm7wqn4x') || '',
          fileUrl,
          fileName,
        };
      });

      roadmapCache = { ts: Date.now(), data: parsed };
      setItems(parsed);
    } catch (err) {
      console.error('Erreur chargement Roadmap:', err);
    } finally {
      setLoading(false);
    }
  };

  // Cocher / décocher une demande (Marquer comme Fait / En cours) - RÉSERVÉ À GUILLAUME
  const handleToggleItemStatus = async (item: RoadmapItem) => {
    if (!isManager) return;
    const isCurrentlyDone = /effectu|fait/i.test(item.groupTitle) || item.status === 'Fait';
    const newStatus = isCurrentlyDone ? 'En cours' : 'Fait';
    const newGroupId = isCurrentlyDone ? GROUP_TODO_ID : GROUP_DONE_ID;
    const newGroupTitle = isCurrentlyDone ? 'Tache à faire' : 'Tâches effectuées';

    setUpdatingId(item.id);

    // Mise à jour optimiste instantanée dans l'UI
    setItems((prev) =>
      prev.map((it) =>
        it.id === item.id
          ? {
              ...it,
              status: newStatus,
              groupId: newGroupId,
              groupTitle: newGroupTitle,
            }
          : it
      )
    );

    // Mise à jour en tâche de fond sur Monday
    try {
      const mutation = `mutation ($itemId: ID!) {
        change_simple_column_value(
          board_id: ${BOARD_ROADMAP_ID},
          item_id: $itemId,
          column_id: "status",
          value: "${newStatus}"
        ) {
          id
        }
        move_item_to_group(
          item_id: $itemId,
          group_id: "${newGroupId}"
        ) {
          id
        }
      }`;

      await monday.api(mutation, { variables: { itemId: item.id } });
      roadmapCache = null;
    } catch (err) {
      console.error('Erreur mise à jour statut Monday:', err);
      // Restaurer les données en cas d'erreur
      await loadRoadmap(true);
    } finally {
      setUpdatingId(null);
    }
  };

  // Soumission d'une nouvelle demande OU mise à jour d'une demande existante vers Monday
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titre.trim()) return;

    setSubmitting(true);
    try {
      const typeObj = TYPE_OPTIONS.find((t) => t.id === typeDemande);
      const formattedTitle = `[${typeObj?.label.split('/')[0].trim() || 'Demande'}] ${titre.trim()}`;
      const cleanDesc = description.trim();

      if (editingItem) {
        // MODE ÉDITION : mise à jour de l'élément existant sur Monday (sans toucher auteur/date/statut)
        const updateColsObj: Record<string, any> = {
          name: formattedTitle,
          short_text2v8w5gvp: cleanDesc,
          color_mm7yntfh: { label: priorite },
          multi_selectp70jvoio: { labels: [poleConcerne] },
        };

        if (dateDebut && dateFin) {
          updateColsObj.timerange_mm7wqn4x = {
            from: dateDebut,
            to: dateFin >= dateDebut ? dateFin : dateDebut,
          };
        }

        const colVals = JSON.stringify(updateColsObj);
        const mutation = `mutation ($itemId: ID!, $colVals: JSON!) {
          change_multiple_column_values(
            board_id: ${BOARD_ROADMAP_ID},
            item_id: $itemId,
            column_values: $colVals,
            create_labels_if_missing: true
          ) {
            id
            name
          }
        }`;

        const res: any = await monday.api(mutation, {
          variables: {
            itemId: editingItem.id,
            colVals,
          },
        });

        if (res?.errors?.length) {
          throw new Error(res.errors.map((err: any) => err.message).join(' | '));
        }

        // Pièce jointe supplémentaire éventuelle
        if (attachedFile) {
          try {
            await uploadFileToMonday(editingItem.id, attachedFile);
          } catch (upErr) {
            console.error("Erreur d'upload du document sur Monday :", upErr);
          }
        }

        setSuccessMode('edit');
        setSuccessSent(true);
        resetForm();

        roadmapCache = null;
        await loadRoadmap(true);

        setTimeout(() => {
          setSuccessSent(false);
          setActiveTab('list');
        }, 1400);
        return;
      }

      // MODE CRÉATION : auteur automatiquement injecté via la colonne dédiée "Personne concerné"
      const senderName = currentUserName && currentUserName !== 'Utilisateur' ? currentUserName.trim() : 'Collaborateur';
      const nowIso = new Date().toISOString().slice(0, 10);

      const colValsObj: any = {
        short_text2v8w5gvp: cleanDesc,
        dropdown_mm978xpa: { labels: [senderName] },
        color_mm7yntfh: { label: priorite },
        status: { label: 'En cours' },
        date_mm7yphvc: { date: nowIso },
        multi_selectp70jvoio: { labels: [poleConcerne] },
      };

      if (dateDebut && dateFin) {
        colValsObj.timerange_mm7wqn4x = {
          from: dateDebut,
          to: dateFin >= dateDebut ? dateFin : dateDebut,
        };
      }

      const colVals = JSON.stringify(colValsObj);

      const mutation = `mutation ($name: String!, $colVals: JSON!) {
        create_item(
          board_id: ${BOARD_ROADMAP_ID},
          group_id: "${GROUP_TODO_ID}",
          item_name: $name,
          column_values: $colVals,
          create_labels_if_missing: true
        ) {
          id
          name
        }
      }`;

      const res: any = await monday.api(mutation, {
        variables: {
          name: formattedTitle,
          colVals,
        },
      });

      const newItemId = res?.data?.create_item?.id;

      // Si une pièce jointe a été sélectionnée, on l'upload directement vers la colonne file_mm7wtnz1
      if (newItemId && attachedFile) {
        try {
          await uploadFileToMonday(newItemId, attachedFile);
        } catch (upErr) {
          console.error("Erreur d'upload du document sur Monday :", upErr);
        }
      }

      // Notification succès
      setSuccessMode('create');
      setSuccessSent(true);
      resetForm();

      // Recharger la liste (invalidation cache)
      roadmapCache = null;
      await loadRoadmap(true);

      setTimeout(() => {
        setSuccessSent(false);
        setActiveTab('list');
      }, 1500);
    } catch (err) {
      console.error('Erreur enregistrement suggestion:', err);
      alert("Une erreur s'est produite lors de la transmission à Monday.");
    } finally {
      setSubmitting(false);
    }
  };

  // Statistiques Roadmap
  const stats = useMemo(() => {
    const u = (currentUserName || '').toLowerCase().trim();
    const myItems = items.filter((i) => {
      if (!u || u === 'utilisateur') return false;
      const matchAuth = i.author && i.author.toLowerCase().includes(u);
      const matchDesc = i.description && i.description.toLowerCase().includes(u);
      return matchAuth || matchDesc;
    });

    const relevantItems = isManager ? items : myItems;

    const todo = relevantItems.filter((i) => !/effectu|fait/i.test(i.groupTitle) && i.status !== 'Fait');
    const done = relevantItems.filter((i) => /effectu|fait/i.test(i.groupTitle) || i.status === 'Fait');

    return {
      total: relevantItems.length,
      todoCount: todo.length,
      doneCount: done.length,
      myCount: myItems.length,
      pctDone: relevantItems.length > 0 ? Math.round((done.length / relevantItems.length) * 100) : 0,
    };
  }, [items, currentUserName, isManager]);

  // Filtrage des éléments pour la vue liste
  const filteredItems = useMemo(() => {
    return items.filter((it) => {
      const isDone = /effectu|fait/i.test(it.groupTitle) || it.status === 'Fait';

      // RÈGLE STRICTE DE CONFIDENTIALITÉ :
      // Seul Guillaume Daniel peut voir l'intégralité de la roadmap (tous collaborateurs et développements internes).
      // Tous les autres collaborateurs ne voient STRICTEMENT ET UNIQUEMENT QUE LEURS PROPRES DEMANDES !
      if (!isManager) {
        const u = (currentUserName || '').toLowerCase().trim();
        const isMine =
          (it.author && it.author.toLowerCase().includes(u)) ||
          (it.description && it.description.toLowerCase().includes(u));
        if (!isMine) return false;
      }

      // Filtre statut
      if (selectedStatusFilter === 'todo' && isDone) return false;
      if (selectedStatusFilter === 'done' && !isDone) return false;
      if (selectedStatusFilter === 'mine') {
        const u = currentUserName.toLowerCase();
        if (!it.author.toLowerCase().includes(u) && !it.description.toLowerCase().includes(u)) {
          return false;
        }
      }

      // Filtre pôle (applicable uniquement pour Guillaume)
      if (isManager && selectedPoleFilter !== 'all') {
        if (!it.workspace.toLowerCase().includes(selectedPoleFilter.toLowerCase())) return false;
      }

      // Filtre recherche
      if (search.trim()) {
        const s = search.toLowerCase();
        const matchName = it.name.toLowerCase().includes(s);
        const matchDesc = it.description.toLowerCase().includes(s);
        const matchWs = it.workspace.toLowerCase().includes(s);
        const matchAuth = it.author.toLowerCase().includes(s);
        if (!matchName && !matchDesc && !matchWs && !matchAuth) return false;
      }

      return true;
    });
  }, [items, selectedStatusFilter, selectedPoleFilter, search, currentUserName, isManager]);

  if (!isOpen) return null;

  return (
    <div
      className="roadmap-modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.7)',
        backdropFilter: 'blur(6px)',
        zIndex: 300,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.15s ease-out',
      }}
      onClick={onClose}
    >
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.98); }
          to { opacity: 1; transform: scale(1); }
        }
        @media (max-width: 640px) {
          .roadmap-modal-overlay { padding: 8px 8px 96px !important; align-items: flex-start !important; }
          .roadmap-modal-container { max-height: calc(100dvh - 104px) !important; border-radius: 14px !important; }
          .roadmap-header { padding: 10px 14px 8px !important; }
          .roadmap-header-icon { width: 28px !important; height: 28px !important; border-radius: 8px !important; }
          .roadmap-header-icon svg { width: 16px !important; height: 16px !important; }
          .roadmap-header-title { font-size: 14px !important; }
          .roadmap-header-live-badge { font-size: 10px !important; padding: 1px 6px !important; }
          .roadmap-close-btn { top: 8px !important; right: 10px !important; width: 28px !important; height: 28px !important; }
          .roadmap-subtitle { display: none !important; }
          .roadmap-header-kpis {
            display: flex !important;
            flex-direction: row !important;
            align-items: center !important;
            gap: 6px !important;
            margin-top: 6px !important;
            flex-wrap: nowrap !important;
            overflow-x: auto !important;
          }
          .roadmap-kpi-chip {
            width: auto !important;
            padding: 3px 8px !important;
            font-size: 10.5px !important;
            border-radius: 6px !important;
            gap: 4px !important;
            white-space: nowrap !important;
            flex-shrink: 0 !important;
          }
          .roadmap-kpi-label-full { display: none !important; }
          .roadmap-tab-bar { padding: 0 10px !important; }
          .roadmap-tab-button { padding: 9px 12px !important; font-size: 12px !important; gap: 6px !important; }
          .roadmap-body-scroll {
            padding: 12px 14px 100px !important;
            -webkit-overflow-scrolling: touch !important;
          }
          .roadmap-card-header { flex-direction: column !important; align-items: flex-start !important; gap: 8px !important; }
          .roadmap-card-badges { width: 100% !important; justify-content: flex-start !important; }
          .roadmap-filter-bar { flex-direction: column !important; align-items: stretch !important; }
          .roadmap-filter-buttons { overflow-x: auto !important; width: 100% !important; padding-bottom: 4px !important; }
          .roadmap-footer { display: none !important; }
        }
      `}</style>

      <div
        className="roadmap-modal-container"
        style={{
          width: '920px',
          maxWidth: '100%',
          maxHeight: '90vh',
          backgroundColor: '#FFFFFF',
          borderRadius: '20px',
          boxShadow: '0 25px 60px -15px rgba(15, 23, 42, 0.4)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid #E2E8F0',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ============================================================== */}
        {/* EN-TÊTE ÉPURÉ & PROFESSIONNEL                                  */}
        {/* ============================================================== */}
        <div
          className="roadmap-header"
          style={{
            padding: '22px 28px',
            backgroundColor: '#1B4565',
            backgroundImage: 'linear-gradient(135deg, #1B4565 0%, #3989B7 100%)',
            color: '#FFFFFF',
            position: 'relative',
          }}
        >
          <button
            type="button"
            className="roadmap-close-btn"
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '18px',
              right: '18px',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.12)',
              border: 'none',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background-color 0.15s',
            }}
            title="Fermer"
          >
            <X size={18} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '8px' }}>
            <div
              className="roadmap-header-icon"
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                backgroundColor: 'rgba(245, 158, 11, 0.2)',
                border: '1px solid rgba(245, 158, 11, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Lightbulb size={22} color="#FBBF24" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h2 className="roadmap-header-title" style={{ margin: 0, fontSize: '19px', fontWeight: 800, letterSpacing: '-0.3px' }}>
                  Boîte à Idées & Suivi des Améliorations
                </h2>
                <span
                  className="roadmap-header-live-badge"
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '20px',
                    backgroundColor: 'rgba(16, 185, 129, 0.25)',
                    color: '#34D399',
                    border: '1px solid rgba(52, 211, 153, 0.4)',
                  }}
                >
                  ● En direct
                </span>
              </div>
              <p className="roadmap-subtitle" style={{ margin: '3px 0 0 0', fontSize: '12px', color: '#94A3B8', lineHeight: 1.4 }}>
                {isManager
                  ? "Exprimez vos besoins ou remarques • Suivez l'avancement et la mise en production des demandes"
                  : "Suivez l'avancement de vos demandes et exprimez vos besoins d'amélioration auprès de Guillaume"}
              </p>
            </div>
          </div>

          {/* Badges KPI Épurés */}
          <div className="roadmap-header-kpis" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '14px', flexWrap: 'wrap' }}>
            <div
              className="roadmap-kpi-chip"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '12px',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <Clock size={14} color="#F59E0B" />
              <span>
                <strong>{stats.todoCount}</strong> <span className="roadmap-kpi-label-full">demandes </span>en cours
              </span>
            </div>

            <div
              className="roadmap-kpi-chip"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '12px',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <CheckCircle2 size={14} color="#10B981" />
              <span>
                <strong>{stats.doneCount}</strong> <span className="roadmap-kpi-label-full">déjà </span>livrées
              </span>
            </div>

            <div
              className="roadmap-kpi-chip"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '12px',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <TrendingUp size={14} color="#60A5FA" />
              <span>
                <span className="roadmap-kpi-label-full">Avancement global : </span><strong>{stats.pctDone}%</strong>
              </span>
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* BARRE D'ONGLETS                                                */}
        {/* ============================================================== */}
        <div
          className="roadmap-tab-bar"
          style={{
            display: 'flex',
            alignItems: 'center',
            borderBottom: '1px solid #E2E8F0',
            backgroundColor: '#F8FAFC',
            padding: '0 20px',
          }}
        >
          <button
            type="button"
            className="roadmap-tab-button"
            onClick={() => {
              if (editingItem) resetForm();
              setActiveTab('list');
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '13px 18px',
              fontSize: '13px',
              fontWeight: 700,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: activeTab === 'list' ? '#39A9DC' : '#64748B',
              borderBottom: activeTab === 'list' ? '2.5px solid #39A9DC' : '2.5px solid transparent',
              transition: 'all 0.15s ease',
            }}
          >
            <ListTodo size={16} />
            <span>{isManager ? `Toutes les demandes (${items.length})` : `Mes demandes (${stats.total})`}</span>
          </button>

          <button
            type="button"
            className="roadmap-tab-button"
            onClick={() => setActiveTab('form')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '13px 18px',
              fontSize: '13px',
              fontWeight: 700,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: activeTab === 'form' ? '#39A9DC' : '#64748B',
              borderBottom: activeTab === 'form' ? '2.5px solid #39A9DC' : '2.5px solid transparent',
              transition: 'all 0.15s ease',
            }}
          >
            {editingItem ? <Pencil size={15} /> : <PlusCircle size={16} />}
            <span>{editingItem ? 'Modifier la demande' : 'Formuler une demande'}</span>
          </button>
        </div>

        {/* ============================================================== */}
        {/* CONTENU PRINCIPAL DES ONGLETS                                  */}
        {/* ============================================================== */}
        <div className="roadmap-body-scroll" style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', backgroundColor: '#FFFFFF' }}>
          {/* ------------------------------------------------------------ */}
          {/* ONGLET 1 : FORMULAIRE DE DEMANDE (ÉPURÉ & SANS CHAMP NOM)     */}
          {/* ------------------------------------------------------------ */}
          {activeTab === 'form' && (
            <div style={{ maxWidth: '680px', margin: '0 auto' }}>
              {successSent ? (
                <div
                  style={{
                    padding: '40px 20px',
                    textAlign: 'center',
                    borderRadius: '16px',
                    backgroundColor: '#ECFDF5',
                    border: '1.5px solid #A7F3D0',
                  }}
                >
                  <div
                    style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '50%',
                      backgroundColor: '#10B981',
                      color: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 14px auto',
                      boxShadow: '0 8px 18px rgba(16, 185, 129, 0.25)',
                    }}
                  >
                    <Check size={28} />
                  </div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#065F46' }}>
                    {successMode === 'edit' ? 'Modifications enregistrées avec succès !' : 'Demande enregistrée avec succès !'}
                  </h3>
                  <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: '#047857' }}>
                    {successMode === 'edit'
                      ? 'La demande a été mise à jour en direct sur Monday.com.'
                      : 'Elle apparaît dès maintenant dans la liste pour un suivi direct.'}
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  {/* Bandeau mode édition OU Badge d'identification automatique */}
                  {editingItem ? (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '10px',
                        padding: '12px 14px',
                        borderRadius: '10px',
                        backgroundColor: '#EBF6FC',
                        border: '1.5px solid #39A9DC',
                        fontSize: '12px',
                        color: '#1B4565',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                        <div
                          style={{
                            width: '30px',
                            height: '30px',
                            borderRadius: '50%',
                            backgroundColor: '#39A9DC',
                            color: '#FFFFFF',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <Pencil size={14} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 800, fontSize: '12.5px' }}>Modification d’une idée existante</div>
                          <div style={{ fontSize: '11px', color: '#3989B7' }}>
                            {editingItem.author ? `Par ${editingItem.author}` : 'Demande existante'}
                            {editingItem.date ? ` • Créée le ${editingItem.date}` : ''}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        style={{
                          padding: '5px 10px',
                          borderRadius: '7px',
                          border: '1px solid #93C5FD',
                          backgroundColor: '#FFFFFF',
                          color: '#1B4565',
                          fontSize: '11.5px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Annuler
                      </button>
                    </div>
                  ) : (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        backgroundColor: '#F8FAFC',
                        border: '1px solid #E2E8F0',
                        fontSize: '12px',
                        color: '#475569',
                      }}
                    >
                      <div
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          backgroundColor: '#E0F2FE',
                          color: '#0284C7',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '11px',
                        }}
                      >
                        <User size={14} />
                      </div>
                      <div>
                        Demandeur identifié : <strong>{currentUserName || 'Collaborateur connecté'}</strong>
                      </div>
                      <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#10B981', fontWeight: 700 }}>
                        ● Pris en compte
                      </span>
                    </div>
                  )}

                  {/* Type d'intervention */}
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#334155', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                      Nature de la demande <span style={{ color: '#EF4444' }}>*</span>
                    </label>
                    <div className="roadmap-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
                      {TYPE_OPTIONS.map((t) => {
                        const Icon = t.icon;
                        const isSelected = typeDemande === t.id;
                        return (
                          <button
                            type="button"
                            key={t.id}
                            onClick={() => setTypeDemande(t.id)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '10px 12px',
                              borderRadius: '10px',
                              fontSize: '12px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              border: isSelected ? `2px solid ${t.color}` : '1px solid #E2E8F0',
                              backgroundColor: isSelected ? `${t.color}12` : '#F8FAFC',
                              color: isSelected ? t.color : '#475569',
                              transition: 'all 0.15s ease',
                              textAlign: 'left',
                            }}
                          >
                            <Icon size={16} />
                            <span>{t.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Pôle concerné */}
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#334155', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                      Pôle concerné <span style={{ color: '#EF4444' }}>*</span>
                    </label>
                    <div className="roadmap-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
                      {POLE_OPTIONS.map((p) => {
                        const Icon = p.icon;
                        const isSelected = poleConcerne === p.id;
                        return (
                          <button
                            type="button"
                            key={p.id}
                            onClick={() => setPoleConcerne(p.id)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '10px 12px',
                              borderRadius: '10px',
                              fontSize: '12px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              border: isSelected ? `2px solid ${p.color}` : '1px solid #E2E8F0',
                              backgroundColor: isSelected ? p.bg : '#F8FAFC',
                              color: isSelected ? p.color : '#475569',
                              transition: 'all 0.15s ease',
                              textAlign: 'left',
                            }}
                          >
                            <Icon size={16} />
                            <span>{p.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Titre de la demande */}
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#334155', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                      Objet de la demande <span style={{ color: '#EF4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex : Pouvoir exporter la liste des inventaires en Excel..."
                      value={titre}
                      onChange={(e) => setTitre(e.target.value)}
                      style={{
                        width: '100%',
                        height: '42px',
                        padding: '0 14px',
                        borderRadius: '10px',
                        border: '1.5px solid #CBD5E1',
                        fontSize: '13px',
                        outline: 'none',
                        boxSizing: 'border-box',
                        transition: 'border-color 0.15s',
                      }}
                      onFocus={(e) => (e.target.style.borderColor = '#39A9DC')}
                      onBlur={(e) => (e.target.style.borderColor = '#CBD5E1')}
                    />
                  </div>

                  {/* Explication / détails */}
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#334155', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                      Précisions ou contexte du besoin
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Décrivez en quelques mots la situation ou ce qui vous ferait gagner du temps au quotidien..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        border: '1.5px solid #CBD5E1',
                        fontSize: '13px',
                        outline: 'none',
                        resize: 'none',
                        boxSizing: 'border-box',
                        transition: 'border-color 0.15s',
                        lineHeight: 1.4,
                      }}
                      onFocus={(e) => (e.target.style.borderColor = '#39A9DC')}
                      onBlur={(e) => (e.target.style.borderColor = '#CBD5E1')}
                    />
                  </div>

                  {/* Niveau de Priorité */}
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#334155', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                      Degré d'importance souhaité
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {(['3 (Basse)', '2 (Normal)', '1 (Urgent)'] as const).map((p) => {
                        const isSelected = priorite === p;
                        const color = p.includes('1') ? '#EF4444' : p.includes('2') ? '#F59E0B' : '#10B981';
                        return (
                          <button
                            type="button"
                            key={p}
                            onClick={() => setPriorite(p)}
                            style={{
                              flex: 1,
                              height: '38px',
                              borderRadius: '8px',
                              border: isSelected ? `2px solid ${color}` : '1px solid #E2E8F0',
                              backgroundColor: isSelected ? `${color}15` : '#FFFFFF',
                              color: isSelected ? color : '#64748B',
                              fontSize: '12px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              transition: 'all 0.15s',
                            }}
                          >
                            {p.includes('1') ? '🔴 Urgent' : p.includes('2') ? '🟠 Normal' : '🟢 Basse'}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Plage de temps souhaitée (Timeline / Gantt automatique) */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                        Plage de temps souhaitée (Gantt)
                      </label>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {[
                          { label: 'Sous 7j', days: 7 },
                          { label: 'Sous 15j', days: 15 },
                          { label: 'Ce mois-ci', days: 30 },
                        ].map((preset) => (
                          <button
                            type="button"
                            key={preset.label}
                            onClick={() => handlePresetTimeline(preset.days)}
                            style={{
                              padding: '2px 8px',
                              borderRadius: '6px',
                              border: '1px solid #CBD5E1',
                              backgroundColor: '#FFFFFF',
                              color: '#0284C7',
                              fontSize: '11px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              transition: 'all 0.15s',
                            }}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div>
                        <span style={{ display: 'block', fontSize: '10px', color: '#64748B', fontWeight: 700, marginBottom: '3px' }}>
                          DATE DE DÉBUT
                        </span>
                        <input
                          type="date"
                          value={dateDebut}
                          onChange={(e) => setDateDebut(e.target.value)}
                          style={{
                            width: '100%',
                            height: '38px',
                            padding: '0 10px',
                            borderRadius: '8px',
                            border: '1.5px solid #CBD5E1',
                            fontSize: '12px',
                            fontWeight: 600,
                            outline: 'none',
                            boxSizing: 'border-box',
                            backgroundColor: '#FFFFFF',
                          }}
                        />
                      </div>
                      <div>
                        <span style={{ display: 'block', fontSize: '10px', color: '#64748B', fontWeight: 700, marginBottom: '3px' }}>
                          DATE D'ÉCHÉANCE / FIN
                        </span>
                        <input
                          type="date"
                          value={dateFin}
                          onChange={(e) => setDateFin(e.target.value)}
                          style={{
                            width: '100%',
                            height: '38px',
                            padding: '0 10px',
                            borderRadius: '8px',
                            border: '1.5px solid #CBD5E1',
                            fontSize: '12px',
                            fontWeight: 600,
                            outline: 'none',
                            boxSizing: 'border-box',
                            backgroundColor: '#FFFFFF',
                          }}
                        />
                      </div>
                    </div>
                    <p style={{ margin: '5px 0 0 0', fontSize: '11px', color: '#64748B', fontStyle: 'italic' }}>
                      Alimente automatiquement le diagramme de Gantt Monday.com pour planifier la livraison.
                    </p>
                  </div>

                  {/* Pièce jointe / Document (PDF, Word, Excel, Images...) */}
                  <div>
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '11px',
                        fontWeight: 800,
                        color: '#334155',
                        marginBottom: '6px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.4px',
                      }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <Paperclip size={13} color="#39A9DC" />
                        Pièce jointe / Document explicatif (optionnel)
                      </span>
                      <span style={{ fontSize: '10px', color: '#64748B', fontWeight: 600, textTransform: 'none' }}>
                        PDF, Word (.docx), Excel, Photos jusqu'à 50 Mo
                      </span>
                    </label>

                    <input
                      ref={fileInputRef}
                      type="file"
                      style={{ display: 'none' }}
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.txt,.csv"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setAttachedFile(e.target.files[0]);
                        }
                      }}
                    />

                    {editingItem?.fileUrl && !attachedFile && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px',
                          padding: '8px 12px',
                          marginBottom: '8px',
                          borderRadius: '9px',
                          backgroundColor: '#F0F9FF',
                          border: '1px solid #BAE6FD',
                          fontSize: '11.5px',
                          color: '#0369A1',
                        }}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                          <Paperclip size={13} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            Document déjà joint : <strong>{editingItem.fileName || 'Pièce jointe'}</strong>
                          </span>
                        </span>
                        <a
                          href={editingItem.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: '#0284C7', fontWeight: 700, textDecoration: 'none', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                        >
                          Ouvrir <ExternalLink size={11} />
                        </a>
                      </div>
                    )}

                    {!attachedFile ? (
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setIsDragging(true);
                        }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setIsDragging(false);
                          if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                            setAttachedFile(e.dataTransfer.files[0]);
                          }
                        }}
                        style={{
                          border: isDragging ? '2px dashed #39A9DC' : '1.5px dashed #CBD5E1',
                          backgroundColor: isDragging ? '#EBF6FC' : '#F8FAFC',
                          borderRadius: '12px',
                          padding: '16px 20px',
                          textAlign: 'center',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                        }}
                      >
                        <div
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            backgroundColor: '#E0F2FE',
                            color: '#0284C7',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <UploadCloud size={20} />
                        </div>
                        <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#1E293B' }}>
                          Cliquez pour sélectionner un fichier <span style={{ color: '#64748B', fontWeight: 500 }}>ou glissez-déposez-le ici</span>
                        </div>
                        <div style={{ fontSize: '11px', color: '#94A3B8' }}>
                          Ex : Fichier Word (.docx), PDF de consignes, capture d'écran, devis...
                        </div>
                      </div>
                    ) : (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          borderRadius: '10px',
                          backgroundColor: '#EFF6FF',
                          border: '1.5px solid #BFDBFE',
                          gap: '12px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                          <div
                            style={{
                              width: '34px',
                              height: '34px',
                              borderRadius: '8px',
                              backgroundColor: '#DBEAFE',
                              color: '#1D4ED8',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <FileText size={18} />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: '13px',
                                fontWeight: 700,
                                color: '#1E3A8A',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                              title={attachedFile.name}
                            >
                              {attachedFile.name}
                            </div>
                            <div style={{ fontSize: '11px', color: '#3B82F6', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>{(attachedFile.size / 1024).toFixed(1)} Ko</span>
                              <span>•</span>
                              <span style={{ color: '#10B981', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                <Check size={11} strokeWidth={3} /> Prêt à être joint sur Monday
                              </span>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setAttachedFile(null);
                            if (fileInputRef.current) fileInputRef.current.value = '';
                          }}
                          style={{
                            padding: '6px 10px',
                            borderRadius: '8px',
                            border: '1px solid #FECACA',
                            backgroundColor: '#FEF2F2',
                            color: '#DC2626',
                            fontSize: '11.5px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            flexShrink: 0,
                          }}
                          title="Supprimer ce document"
                        >
                          <Trash2 size={13} />
                          <span>Retirer</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Bouton de validation */}
                  <div style={{ marginTop: '6px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    {editingItem && (
                      <button
                        type="button"
                        onClick={cancelEdit}
                        disabled={submitting}
                        style={{
                          height: '46px',
                          padding: '0 18px',
                          backgroundColor: '#FFFFFF',
                          color: '#475569',
                          border: '1.5px solid #CBD5E1',
                          borderRadius: '12px',
                          fontSize: '13.5px',
                          fontWeight: 700,
                          cursor: submitting ? 'not-allowed' : 'pointer',
                        }}
                      >
                        Annuler
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={submitting || !titre.trim()}
                      style={{
                        flex: 1,
                        minWidth: '200px',
                        height: '46px',
                        backgroundColor: '#39A9DC',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '12px',
                        fontSize: '14px',
                        fontWeight: 700,
                        cursor: submitting || !titre.trim() ? 'not-allowed' : 'pointer',
                        opacity: submitting || !titre.trim() ? 0.6 : 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 12px rgba(57, 169, 220, 0.25)',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {editingItem ? <Save size={16} /> : <Send size={16} />}
                      <span>
                        {submitting
                          ? 'Enregistrement...'
                          : editingItem
                          ? 'Enregistrer les modifications'
                          : 'Envoyer ma demande'}
                      </span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* ------------------------------------------------------------ */}
          {/* ONGLET 2 : LISTE DES DEMANDES AVEC COCHAGE RAPIDE             */}
          {/* ------------------------------------------------------------ */}
          {activeTab === 'list' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Barre de filtres & recherche */}
              <div
                className="roadmap-filter-bar"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                  flexWrap: 'wrap',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                }}
              >
                {/* Recherche */}
                <div style={{ position: 'relative', flex: 1, minWidth: '180px', display: 'flex', alignItems: 'center' }}>
                  <Search size={14} color="#64748B" style={{ position: 'absolute', left: '10px' }} />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Filtrer une demande..."
                    style={{
                      width: '100%',
                      height: '34px',
                      paddingLeft: '32px',
                      paddingRight: '12px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      fontSize: '12px',
                      outline: 'none',
                      backgroundColor: '#FFFFFF',
                      boxSizing: 'border-box',
                    }}
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch('')}
                      style={{
                        position: 'absolute',
                        right: '8px',
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer',
                        color: '#94A3B8',
                      }}
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                {/* Filtres de statut */}
                <div className="roadmap-filter-buttons" style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#FFFFFF', padding: '3px', borderRadius: '8px', border: '1px solid #CBD5E1', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => setSelectedStatusFilter('all')}
                    style={{
                      padding: '4px 9px',
                      borderRadius: '6px',
                      border: 'none',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      backgroundColor: selectedStatusFilter === 'all' ? '#0F172A' : 'transparent',
                      color: selectedStatusFilter === 'all' ? '#FFFFFF' : '#64748B',
                    }}
                  >
                    {isManager ? `Toutes (${items.length})` : `Toutes mes demandes (${stats.total})`}
                  </button>
                  {isManager && (
                    <button
                      type="button"
                      onClick={() => setSelectedStatusFilter('mine')}
                      style={{
                        padding: '4px 9px',
                        borderRadius: '6px',
                        border: 'none',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        backgroundColor: selectedStatusFilter === 'mine' ? '#0284C7' : 'transparent',
                        color: selectedStatusFilter === 'mine' ? '#FFFFFF' : '#64748B',
                      }}
                      title="Voir uniquement mes demandes personnelles"
                    >
                      Mes demandes ({stats.myCount})
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setSelectedStatusFilter('todo')}
                    style={{
                      padding: '4px 9px',
                      borderRadius: '6px',
                      border: 'none',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      backgroundColor: selectedStatusFilter === 'todo' ? '#F59E0B' : 'transparent',
                      color: selectedStatusFilter === 'todo' ? '#FFFFFF' : '#64748B',
                    }}
                  >
                    En cours ({stats.todoCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedStatusFilter('done')}
                    style={{
                      padding: '4px 9px',
                      borderRadius: '6px',
                      border: 'none',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      backgroundColor: selectedStatusFilter === 'done' ? '#10B981' : 'transparent',
                      color: selectedStatusFilter === 'done' ? '#FFFFFF' : '#64748B',
                    }}
                  >
                    Livrées ({stats.doneCount})
                  </button>
                </div>

                {/* Bouton Proposer une idée */}
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setActiveTab('form');
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '7px 12px',
                    borderRadius: '8px',
                    backgroundColor: '#39A9DC',
                    color: '#FFFFFF',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(57, 169, 220, 0.2)',
                  }}
                >
                  <PlusCircle size={14} />
                  <span>Ajouter</span>
                </button>
              </div>

              {/* Liste des cartes Roadmap */}
              {loading ? (
                <div style={{ padding: '50px 0', textAlign: 'center', color: '#64748B' }}>
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      border: '3px solid #CBD5E1',
                      borderTopColor: '#39A9DC',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                      margin: '0 auto 10px auto',
                    }}
                  />
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>Chargement des demandes...</span>
                </div>
              ) : filteredItems.length === 0 ? (
                !isManager && stats.total === 0 ? (
                  <div style={{ padding: '36px 20px', textAlign: 'center', backgroundColor: '#F8FAFC', borderRadius: '12px', border: '1px dashed #CBD5E1' }}>
                    <Lightbulb size={32} color="#F59E0B" style={{ margin: '0 auto 10px auto' }} />
                    <h4 style={{ margin: '0 0 6px 0', fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>
                      Vous n'avez pas encore formulé de demande
                    </h4>
                    <p style={{ margin: '0 0 14px 0', fontSize: '12px', color: '#64748B', maxWidth: '380px', marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.4 }}>
                      Exprimez une idée, un ajustement ou un besoin pour votre travail. Vous pourrez suivre ici l'état d'avancement de vos demandes !
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        resetForm();
                        setActiveTab('form');
                      }}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '8px',
                        backgroundColor: '#39A9DC',
                        color: '#FFFFFF',
                        border: 'none',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        boxShadow: '0 2px 8px rgba(57, 169, 220, 0.25)',
                      }}
                    >
                      + Formuler une demande
                    </button>
                  </div>
                ) : (
                  <div style={{ padding: '40px 0', textAlign: 'center', color: '#94A3B8' }}>
                    <ListTodo size={32} color="#CBD5E1" style={{ margin: '0 auto 8px auto' }} />
                    <p style={{ margin: 0, fontSize: '13px', fontWeight: 600 }}>Aucune demande trouvée avec ces critères.</p>
                  </div>
                )
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
                  {filteredItems.map((item) => {
                    const isDone = /effectu|fait/i.test(item.groupTitle) || item.status === 'Fait';
                    const priorityColor = item.priority.includes('1')
                      ? '#EF4444'
                      : item.priority.includes('2')
                      ? '#F59E0B'
                      : '#10B981';

                    const isBeingUpdated = updatingId === item.id;

                    return (
                      <div
                        key={item.id}
                        style={{
                          padding: '14px 16px',
                          borderRadius: '12px',
                          border: isDone ? '1px solid #E2E8F0' : '1px solid #CBD5E1',
                          borderLeft: isDone ? '4px solid #10B981' : `4px solid ${priorityColor}`,
                          backgroundColor: isDone ? '#F8FAFC' : '#FFFFFF',
                          boxShadow: isDone ? 'none' : '0 2px 6px rgba(15, 23, 42, 0.03)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                          transition: 'all 0.15s ease',
                          opacity: isBeingUpdated ? 0.6 : 1,
                        }}
                      >
                        <div className="roadmap-card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                          {/* Checkbox d'action rapide + Titre */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                            {isManager ? (
                              <button
                                type="button"
                                onClick={() => handleToggleItemStatus(item)}
                                title={isDone ? 'Cliquer pour repasser en cours (Action Guillaume)' : 'Cliquer pour marquer comme fait (Action Guillaume)'}
                                style={{
                                  width: '24px',
                                  height: '24px',
                                  borderRadius: '50%',
                                  border: isDone ? '2px solid #10B981' : '2px solid #94A3B8',
                                  backgroundColor: isDone ? '#10B981' : '#FFFFFF',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer',
                                  flexShrink: 0,
                                  padding: 0,
                                  transition: 'all 0.15s ease',
                                }}
                              >
                                {isDone ? (
                                  <Check size={14} color="#FFFFFF" strokeWidth={3} />
                                ) : (
                                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'transparent' }} />
                                )}
                              </button>
                            ) : (
                              <div
                                title={isDone ? 'Demande livrée' : 'Demande en cours'}
                                style={{
                                  width: '24px',
                                  height: '24px',
                                  borderRadius: '50%',
                                  border: isDone ? '2px solid #10B981' : '2px solid #CBD5E1',
                                  backgroundColor: isDone ? '#10B981' : '#F8FAFC',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                }}
                              >
                                {isDone ? (
                                  <Check size={14} color="#FFFFFF" strokeWidth={3} />
                                ) : (
                                  <Clock size={12} color="#F59E0B" />
                                )}
                              </div>
                            )}

                            <h4
                              style={{
                                margin: 0,
                                fontSize: '13.5px',
                                fontWeight: 700,
                                color: isDone ? '#64748B' : '#0F172A',
                                textDecoration: isDone ? 'line-through' : 'none',
                                lineHeight: 1.3,
                                wordBreak: 'break-word',
                              }}
                            >
                              {item.name}
                            </h4>
                          </div>

                          {/* Badges statut & priorité + bouton Modifier */}
                          <div className="roadmap-card-badges" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              onClick={() => startEditItem(item)}
                              title="Modifier cette idée"
                              style={{
                                fontSize: '10.5px',
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: '5px',
                                backgroundColor: '#EBF6FC',
                                color: '#3989B7',
                                border: '1px solid #BAE6FD',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                transition: 'all 0.15s ease',
                              }}
                            >
                              <Pencil size={11} />
                              <span>Modifier</span>
                            </button>

                            {item.workspace && (
                              <span
                                style={{
                                  fontSize: '10.5px',
                                  fontWeight: 700,
                                  padding: '2px 7px',
                                  borderRadius: '5px',
                                  backgroundColor: '#F1F5F9',
                                  color: '#475569',
                                }}
                              >
                                {item.workspace}
                              </span>
                            )}

                            <span
                              style={{
                                fontSize: '10.5px',
                                fontWeight: 700,
                                padding: '2px 7px',
                                borderRadius: '5px',
                                backgroundColor: `${priorityColor}15`,
                                color: priorityColor,
                                border: `1px solid ${priorityColor}30`,
                              }}
                            >
                              {item.priority.includes('1') ? 'Urgent' : item.priority.includes('2') ? 'Normal' : 'Basse'}
                            </span>

                            {isManager ? (
                              <button
                                type="button"
                                onClick={() => handleToggleItemStatus(item)}
                                title="Cliquer pour changer le statut (Action Guillaume)"
                                style={{
                                  fontSize: '10.5px',
                                  fontWeight: 800,
                                  padding: '2px 8px',
                                  borderRadius: '5px',
                                  backgroundColor: isDone ? '#10B981' : '#F59E0B',
                                  color: '#FFFFFF',
                                  border: 'none',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                              >
                                {isDone ? 'Livrée' : 'En cours'}
                              </button>
                            ) : (
                              <span
                                style={{
                                  fontSize: '10.5px',
                                  fontWeight: 800,
                                  padding: '2px 8px',
                                  borderRadius: '5px',
                                  backgroundColor: isDone ? '#10B981' : '#F59E0B',
                                  color: '#FFFFFF',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  cursor: 'default',
                                }}
                              >
                                {isDone ? 'Livrée' : 'En cours'}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Description / commentaire */}
                        {item.description && (
                          <p
                            style={{
                              margin: '2px 0 0 34px',
                              fontSize: '12px',
                              color: '#64748B',
                              lineHeight: 1.4,
                              wordBreak: 'break-word',
                            }}
                          >
                            {item.description}
                          </p>
                        )}

                        {/* Auteur & date */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            margin: '2px 0 0 34px',
                            fontSize: '11px',
                            color: '#94A3B8',
                            flexWrap: 'wrap',
                          }}
                        >
                          {item.author && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#39A9DC', fontWeight: 600 }}>
                              <User size={11} /> {item.author}
                            </span>
                          )}

                          {item.date && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <Clock size={11} /> Enregistré le {item.date}
                            </span>
                          )}

                          {item.timeline && (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                color: '#6366F1',
                                backgroundColor: '#EEF2FF',
                                padding: '1px 7px',
                                borderRadius: '6px',
                                fontWeight: 700,
                              }}
                            >
                              <Calendar size={11} /> Gantt : {item.timeline}
                            </span>
                          )}

                          {item.fileUrl && (
                            <a
                              href={item.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                color: '#39A9DC',
                                backgroundColor: '#EBF6FC',
                                border: '1px solid #BFDBFE',
                                padding: '2px 8px',
                                borderRadius: '6px',
                                fontWeight: 700,
                                textDecoration: 'none',
                                transition: 'all 0.15s ease',
                              }}
                              title="Ouvrir la pièce jointe associée sur Monday"
                            >
                              <Paperclip size={11} color="#39A9DC" />
                              <span style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {item.fileName || 'Document joint'}
                              </span>
                              <ExternalLink size={10} color="#39A9DC" />
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ============================================================== */}
        {/* PIED DE MODAL ÉPURÉ (SANS TEXTE TECHNIQUE NI ID DE TABLEAU)     */}
        {/* ============================================================== */}
        <div
          className="roadmap-footer"
          style={{
            padding: '12px 24px',
            backgroundColor: '#F8FAFC',
            borderTop: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '12px',
            color: '#64748B',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sparkles size={13} color="#F59E0B" />
            <span>Feuille de route collaborative Groupe Facility</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '6px 16px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              backgroundColor: '#FFFFFF',
              color: '#334155',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'background-color 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F1F5F9')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#FFFFFF')}
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
