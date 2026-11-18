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
  Filter,
  Layers,
  Sparkles,
  X,
  User,
  Calendar,
  Building2,
  Wrench,
  Truck,
  FileSpreadsheet,
  Trash2,
  HelpCircle,
  Check,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';

export interface RoadmapItem {
  id: string;
  name: string;
  groupTitle: string; // 'Tache à faire' ou 'Tâches effectuées'
  groupId: string;
  priority: '1 (Urgent)' | '2 (Normal)' | '3 (Basse)' | string;
  status: 'En cours' | 'Fait' | 'Bloqué' | string;
  description: string;
  workspace: string; // 'Animatrices', 'Gros Matos', 'Suivi Vehicules', 'Enchantement client'
  date: string;
  timeline: string;
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

const POLE_OPTIONS = [
  { id: 'Animatrices', label: 'Animatrices & Chantiers', icon: Building2, color: '#0073EA', bg: '#EBF6FC' },
  { id: 'Gros Matos', label: 'Atelier & Gros Matériel', icon: Wrench, color: '#00C875', bg: '#E6F9F1' },
  { id: 'Suivi Vehicules', label: 'Facturation & Véhicules', icon: Truck, color: '#0284C7', bg: '#E0F2FE' },
  { id: 'Enchantement client', label: 'Commercial & Contrats', icon: FileSpreadsheet, color: '#F59E0B', bg: '#FEF3C7' },
];

const TYPE_OPTIONS = [
  { id: 'feat', label: 'Nouvelle idée / Fonction', icon: Sparkles, color: '#8B5CF6' },
  { id: 'adjust', label: 'Ajustement / Amélioration', icon: TrendingUp, color: '#0073EA' },
  { id: 'remove', label: 'À retirer / Simplifier', icon: Trash2, color: '#EF4444' },
  { id: 'bug', label: 'Signalement de bug', icon: AlertTriangle, color: '#F97316' },
];

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

  // Filtres onglet Roadmap
  const [search, setSearch] = useState('');
  const [selectedPoleFilter, setSelectedPoleFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'all' | 'todo' | 'done'>('all');

  // Champs du formulaire
  const [typeDemande, setTypeDemande] = useState<string>('adjust');
  const [poleConcerne, setPoleConcerne] = useState<string>('Animatrices');
  const [titre, setTitre] = useState('');
  const [description, setDescription] = useState('');
  const [priorite, setPriorite] = useState<'1 (Urgent)' | '2 (Normal)' | '3 (Basse)'>('2 (Normal)');
  const [demandeur, setDemandeur] = useState(currentUserName);

  // Synchronisation nom utilisateur
  useEffect(() => {
    if (currentUserName && currentUserName !== 'Utilisateur') {
      setDemandeur(currentUserName);
    }
  }, [currentUserName]);

  // Synchronisation onglet initial
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      loadRoadmap();
    }
  }, [isOpen, initialTab]);

  // Charger les données du tableau Roadmap Monday
  const loadRoadmap = async () => {
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
              }
            }
          }
        }
      }`;

      const res: any = await monday.api(q);
      const rawItems = res?.data?.boards?.[0]?.items_page?.items || [];

      const parsed: RoadmapItem[] = rawItems.map((it: any) => {
        const valMap = new Map<string, string>();
        it.column_values?.forEach((cv: any) => {
          if (cv.id && cv.text) valMap.set(cv.id, cv.text);
        });

        return {
          id: it.id,
          name: it.name || 'Sans titre',
          groupTitle: it.group?.title || 'Tache à faire',
          groupId: it.group?.id || '',
          priority: (valMap.get('color_mm7yntfh') as any) || '2 (Normal)',
          status: valMap.get('status') || 'En cours',
          description: valMap.get('short_text2v8w5gvp') || '',
          workspace: valMap.get('multi_selectp70jvoio') || 'Général',
          date: valMap.get('date_mm7yphvc') || '',
          timeline: valMap.get('timerange_mm7wqn4x') || '',
        };
      });

      setItems(parsed);
    } catch (err) {
      console.error('Erreur chargement Roadmap:', err);
    } finally {
      setLoading(false);
    }
  };

  // Soumission d'une nouvelle demande vers Monday
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titre.trim()) return;

    setSubmitting(true);
    try {
      // Déterminer le préfixe du type
      const typeObj = TYPE_OPTIONS.find((t) => t.id === typeDemande);
      const formattedTitle = `[${typeObj?.label.split('/')[0].trim() || 'Demande'}] ${titre.trim()}`;

      // Construction de la description avec auteur
      const fullDesc = `Demandé par : ${demandeur.trim()} | ${description.trim()}`;

      const todayIso = new Date().toISOString().slice(0, 10);

      const colVals = JSON.stringify({
        short_text2v8w5gvp: fullDesc,
        color_mm7yntfh: { label: priorite },
        status: { label: 'En cours' },
        date_mm7yphvc: { date: todayIso },
        multi_selectp70jvoio: { labels: [poleConcerne] },
      });

      const mutation = `mutation ($name: String!, $colVals: JSON!) {
        create_item(
          board_id: ${BOARD_ROADMAP_ID},
          group_id: "${GROUP_TODO_ID}",
          item_name: $name,
          column_values: $colVals
        ) {
          id
          name
        }
      }`;

      await monday.api(mutation, {
        variables: {
          name: formattedTitle,
          colVals,
        },
      });

      // Notification succès
      setSuccessSent(true);
      setTitre('');
      setDescription('');

      // Recharger la liste
      await loadRoadmap();

      setTimeout(() => {
        setSuccessSent(false);
        setActiveTab('list');
      }, 1600);
    } catch (err) {
      console.error('Erreur création suggestion:', err);
      alert("Une erreur s'est produite lors de la transmission à Monday.");
    } finally {
      setSubmitting(false);
    }
  };

  // Statistiques Roadmap
  const stats = useMemo(() => {
    const todo = items.filter((i) => !/effectu|fait/i.test(i.groupTitle) && i.status !== 'Fait');
    const done = items.filter((i) => /effectu|fait/i.test(i.groupTitle) || i.status === 'Fait');
    return {
      total: items.length,
      todoCount: todo.length,
      doneCount: done.length,
      pctDone: items.length > 0 ? Math.round((done.length / items.length) * 100) : 0,
    };
  }, [items]);

  // Filtrage des éléments pour la vue liste
  const filteredItems = useMemo(() => {
    return items.filter((it) => {
      // Filtre statut
      if (selectedStatusFilter === 'todo') {
        if (/effectu|fait/i.test(it.groupTitle) || it.status === 'Fait') return false;
      } else if (selectedStatusFilter === 'done') {
        if (!/effectu|fait/i.test(it.groupTitle) && it.status !== 'Fait') return false;
      }

      // Filtre pôle
      if (selectedPoleFilter !== 'all') {
        if (!it.workspace.toLowerCase().includes(selectedPoleFilter.toLowerCase())) return false;
      }

      // Filtre recherche
      if (search.trim()) {
        const s = search.toLowerCase();
        const matchName = it.name.toLowerCase().includes(s);
        const matchDesc = it.description.toLowerCase().includes(s);
        const matchWs = it.workspace.toLowerCase().includes(s);
        if (!matchName && !matchDesc && !matchWs) return false;
      }

      return true;
    });
  }, [items, selectedStatusFilter, selectedPoleFilter, search]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(5px)',
        zIndex: 300,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        animation: 'fadeIn 0.15s ease-out',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '920px',
          maxWidth: '96vw',
          maxHeight: '90vh',
          backgroundColor: '#FFFFFF',
          borderRadius: '22px',
          boxShadow: '0 25px 60px -15px rgba(15, 23, 42, 0.35)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid #E2E8F0',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ============================================================== */}
        {/* EN-TÊTE ÉLÉGANT AVEC GRADIENT & STATS EN DIRECT                */}
        {/* ============================================================== */}
        <div
          style={{
            padding: '24px 28px',
            backgroundColor: '#0F172A',
            backgroundImage: 'radial-gradient(circle at top right, #1E3A8A 0%, #0F172A 70%)',
            color: '#FFFFFF',
            position: 'relative',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                backgroundColor: 'rgba(251, 191, 36, 0.2)',
                border: '1px solid rgba(251, 191, 36, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Lightbulb size={24} color="#FBBF24" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, letterSpacing: '-0.3px' }}>
                  Boîte à Idées & Roadmap Collaborative
                </h2>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: '20px',
                    backgroundColor: 'rgba(16, 185, 129, 0.25)',
                    color: '#34D399',
                    border: '1px solid rgba(52, 211, 153, 0.4)',
                  }}
                >
                  ● En direct Monday.com
                </span>
              </div>
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94A3B8' }}>
                Formulez un souhait, un ajustement ou un retrait • Vos demandes alimentent directement le tableau Roadmap de Guillaume
              </p>
            </div>
          </div>

          {/* Mini-Badges KPI */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '14px', flexWrap: 'wrap' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '12px',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                padding: '6px 12px',
                borderRadius: '10px',
              }}
            >
              <Clock size={14} color="#F59E0B" />
              <span>
                <strong>{stats.todoCount}</strong> demandes en cours
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '12px',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                padding: '6px 12px',
                borderRadius: '10px',
              }}
            >
              <CheckCircle2 size={14} color="#10B981" />
              <span>
                <strong>{stats.doneCount}</strong> fonctionnalités livrées
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '12px',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                padding: '6px 12px',
                borderRadius: '10px',
              }}
            >
              <Layers size={14} color="#60A5FA" />
              <span>
                Taux de réalisation : <strong>{stats.pctDone}%</strong>
              </span>
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* BARRE D'ONGLETS                                                */}
        {/* ============================================================== */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            borderBottom: '1px solid #E2E8F0',
            backgroundColor: '#F8FAFC',
            padding: '0 24px',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('list')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '14px 18px',
              fontSize: '13px',
              fontWeight: 700,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: activeTab === 'list' ? '#0073EA' : '#64748B',
              borderBottom: activeTab === 'list' ? '2.5px solid #0073EA' : '2.5px solid transparent',
              transition: 'all 0.15s ease',
            }}
          >
            <ListTodo size={16} />
            <span>Consulter la Roadmap ({items.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('form')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '14px 18px',
              fontSize: '13px',
              fontWeight: 700,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: activeTab === 'form' ? '#0073EA' : '#64748B',
              borderBottom: activeTab === 'form' ? '2.5px solid #0073EA' : '2.5px solid transparent',
              transition: 'all 0.15s ease',
            }}
          >
            <PlusCircle size={16} />
            <span>Formuler une demande ou idée</span>
          </button>
        </div>

        {/* ============================================================== */}
        {/* CONTENU PRINCIPAL DES ONGLETS                                  */}
        {/* ============================================================== */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', backgroundColor: '#FFFFFF' }}>
          {/* ------------------------------------------------------------ */}
          {/* ONGLET 1 : FORMULAIRE DE PROPOSITION                         */}
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
                      width: '60px',
                      height: '60px',
                      borderRadius: '50%',
                      backgroundColor: '#10B981',
                      color: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 16px auto',
                      boxShadow: '0 10px 20px rgba(16, 185, 129, 0.3)',
                    }}
                  >
                    <Check size={32} />
                  </div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#065F46' }}>
                    Demande transmise avec succès !
                  </h3>
                  <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: '#047857' }}>
                    Votre suggestion a été enregistrée directement dans le tableau <strong>Road map de Guillaume</strong>.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Type d'intervention */}
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#1E293B', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                      Type d'intervention <span style={{ color: '#EF4444' }}>*</span>
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px' }}>
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
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#1E293B', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                      Pôle ou Espace concerné <span style={{ color: '#EF4444' }}>*</span>
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px' }}>
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
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#1E293B', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                      Titre de votre demande ou idée <span style={{ color: '#EF4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex : Ajouter un export Excel sur les inventaires, modifier l'ordre des colonnes..."
                      value={titre}
                      onChange={(e) => setTitre(e.target.value)}
                      style={{
                        width: '100%',
                        height: '44px',
                        padding: '0 14px',
                        borderRadius: '10px',
                        border: '1.5px solid #CBD5E1',
                        fontSize: '14px',
                        outline: 'none',
                        boxSizing: 'border-box',
                        transition: 'border-color 0.15s',
                      }}
                      onFocus={(e) => (e.target.style.borderColor = '#0073EA')}
                      onBlur={(e) => (e.target.style.borderColor = '#CBD5E1')}
                    />
                  </div>

                  {/* Détails et explications */}
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#1E293B', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                      Détail de votre besoin ou problème actuel
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Expliquez concrètement ce que vous aimeriez améliorer, ajouter ou retirer, et pourquoi cela vous ferait gagner du temps..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '12px 14px',
                        borderRadius: '10px',
                        border: '1.5px solid #CBD5E1',
                        fontSize: '13px',
                        outline: 'none',
                        resize: 'none',
                        boxSizing: 'border-box',
                        transition: 'border-color 0.15s',
                        lineHeight: 1.4,
                      }}
                      onFocus={(e) => (e.target.style.borderColor = '#0073EA')}
                      onBlur={(e) => (e.target.style.borderColor = '#CBD5E1')}
                    />
                  </div>

                  {/* Ligne : Priorité ressentie + Nom du demandeur */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#1E293B', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                        Niveau de Priorité
                      </label>
                      <div style={{ display: 'flex', gap: '6px' }}>
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
                                height: '40px',
                                borderRadius: '8px',
                                border: isSelected ? `2px solid ${color}` : '1px solid #E2E8F0',
                                backgroundColor: isSelected ? `${color}15` : '#FFFFFF',
                                color: isSelected ? color : '#64748B',
                                fontSize: '11px',
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

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#1E293B', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                        Votre Nom / Demandeur
                      </label>
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <User size={16} color="#64748B" style={{ position: 'absolute', left: '12px' }} />
                        <input
                          type="text"
                          required
                          value={demandeur}
                          onChange={(e) => setDemandeur(e.target.value)}
                          placeholder="Votre prénom & nom..."
                          style={{
                            width: '100%',
                            height: '40px',
                            paddingLeft: '36px',
                            paddingRight: '12px',
                            borderRadius: '8px',
                            border: '1.5px solid #CBD5E1',
                            fontSize: '13px',
                            fontWeight: 600,
                            outline: 'none',
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Bouton de validation */}
                  <div style={{ marginTop: '8px' }}>
                    <button
                      type="submit"
                      disabled={submitting || !titre.trim()}
                      style={{
                        width: '100%',
                        height: '48px',
                        backgroundColor: '#0073EA',
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
                        boxShadow: '0 4px 14px rgba(0, 115, 234, 0.3)',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <Send size={16} />
                      <span>{submitting ? 'Envoi en cours sur Monday...' : 'Transmettre à Guillaume & Ajouter à la Roadmap'}</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* ------------------------------------------------------------ */}
          {/* ONGLET 2 : LISTE DE LA ROADMAP EN DIRECT                     */}
          {/* ------------------------------------------------------------ */}
          {activeTab === 'list' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Barre de filtres & recherche */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  flexWrap: 'wrap',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                }}
              >
                {/* Recherche */}
                <div style={{ position: 'relative', flex: 1, minWidth: '220px', display: 'flex', alignItems: 'center' }}>
                  <Search size={15} color="#64748B" style={{ position: 'absolute', left: '12px' }} />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Filtrer une demande par mot-clé..."
                    style={{
                      width: '100%',
                      height: '36px',
                      paddingLeft: '36px',
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
                        right: '10px',
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer',
                        color: '#94A3B8',
                      }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Filtre Statut */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#FFFFFF', padding: '3px', borderRadius: '8px', border: '1px solid #CBD5E1' }}>
                  <button
                    type="button"
                    onClick={() => setSelectedStatusFilter('all')}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: 'none',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      backgroundColor: selectedStatusFilter === 'all' ? '#0F172A' : 'transparent',
                      color: selectedStatusFilter === 'all' ? '#FFFFFF' : '#64748B',
                    }}
                  >
                    Toutes ({items.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedStatusFilter('todo')}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: 'none',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      backgroundColor: selectedStatusFilter === 'todo' ? '#F59E0B' : 'transparent',
                      color: selectedStatusFilter === 'todo' ? '#FFFFFF' : '#64748B',
                    }}
                  >
                    À faire / En cours ({stats.todoCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedStatusFilter('done')}
                    style={{
                      padding: '4px 10px',
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

                {/* Bouton ajouter rapide */}
                <button
                  type="button"
                  onClick={() => setActiveTab('form')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    backgroundColor: '#0073EA',
                    color: '#FFFFFF',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(0, 115, 234, 0.25)',
                  }}
                >
                  <PlusCircle size={15} />
                  <span>Proposer une idée</span>
                </button>
              </div>

              {/* Liste des cartes Roadmap */}
              {loading ? (
                <div style={{ padding: '60px 0', textAlign: 'center', color: '#64748B' }}>
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      border: '3px solid #CBD5E1',
                      borderTopColor: '#0073EA',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                      margin: '0 auto 12px auto',
                    }}
                  />
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>Chargement de la Roadmap Monday...</span>
                </div>
              ) : filteredItems.length === 0 ? (
                <div style={{ padding: '50px 0', textAlign: 'center', color: '#94A3B8' }}>
                  <ListTodo size={36} color="#CBD5E1" style={{ margin: '0 auto 10px auto' }} />
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Aucune demande trouvée avec ces critères.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
                  {filteredItems.map((item) => {
                    const isDone = /effectu|fait/i.test(item.groupTitle) || item.status === 'Fait';
                    const priorityColor = item.priority.includes('1')
                      ? '#EF4444'
                      : item.priority.includes('2')
                      ? '#F59E0B'
                      : '#10B981';

                    return (
                      <div
                        key={item.id}
                        style={{
                          padding: '16px 18px',
                          borderRadius: '14px',
                          border: isDone ? '1px solid #E2E8F0' : '1px solid #CBD5E1',
                          backgroundColor: isDone ? '#F8FAFC' : '#FFFFFF',
                          boxShadow: isDone ? 'none' : '0 2px 8px rgba(15, 23, 42, 0.04)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                            <div
                              style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '8px',
                                backgroundColor: isDone ? '#DCFCE7' : '#FEF3C7',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                shrink: 0,
                              }}
                            >
                              {isDone ? <CheckCircle2 size={16} color="#16A34A" /> : <Clock size={16} color="#D97706" />}
                            </div>

                            <div style={{ flex: 1 }}>
                              <h4
                                style={{
                                  margin: 0,
                                  fontSize: '14px',
                                  fontWeight: 700,
                                  color: isDone ? '#475569' : '#0F172A',
                                  textDecoration: isDone ? 'line-through' : 'none',
                                }}
                              >
                                {item.name}
                              </h4>
                            </div>
                          </div>

                          {/* Badges statut & priorité */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', shrink: 0 }}>
                            {item.workspace && (
                              <span
                                style={{
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  backgroundColor: '#F1F5F9',
                                  color: '#475569',
                                }}
                              >
                                {item.workspace}
                              </span>
                            )}

                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                padding: '3px 8px',
                                borderRadius: '6px',
                                backgroundColor: `${priorityColor}15`,
                                color: priorityColor,
                                border: `1px solid ${priorityColor}30`,
                              }}
                            >
                              {item.priority.includes('1') ? '🔴 Urgent' : item.priority.includes('2') ? '🟠 Normal' : '🟢 Basse'}
                            </span>

                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 800,
                                padding: '3px 9px',
                                borderRadius: '6px',
                                backgroundColor: isDone ? '#10B981' : '#F59E0B',
                                color: '#FFFFFF',
                              }}
                            >
                              {item.status || (isDone ? 'Fait' : 'En cours')}
                            </span>
                          </div>
                        </div>

                        {/* Description / commentaire */}
                        {item.description && (
                          <p
                            style={{
                              margin: '2px 0 0 38px',
                              fontSize: '12px',
                              color: '#64748B',
                              lineHeight: 1.4,
                            }}
                          >
                            {item.description}
                          </p>
                        )}

                        {/* Pied de carte avec timeline ou date */}
                        {(item.timeline || item.date) && (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px',
                              margin: '4px 0 0 38px',
                              fontSize: '11px',
                              color: '#94A3B8',
                            }}
                          >
                            {item.timeline && (
                              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Calendar size={12} /> Période prévue : <strong>{item.timeline}</strong>
                              </span>
                            )}
                            {item.date && (
                              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Clock size={12} /> Enregistré le : {item.date}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ============================================================== */}
        {/* PIED DE MODAL                                                  */}
        {/* ============================================================== */}
        <div
          style={{
            padding: '14px 28px',
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
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10B981' }} />
            <span>Tableau relié : <strong>Road map (5105479748)</strong> dans l'espace Guillaume TEST</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              backgroundColor: '#FFFFFF',
              color: '#334155',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
