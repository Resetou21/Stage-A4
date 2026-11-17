import React, { useState, useEffect, useRef, useMemo } from 'react';
import mondaySdk from 'monday-sdk-js';
import {
  Building2,
  Wrench,
  Truck,
  PackageSearch,
  MessageSquare,
  FileSpreadsheet,
  AlertTriangle,
  TrendingUp,
  Search,
  ChevronDown,
  Maximize2,
  RefreshCw,
  Home,
  CheckCircle2,
  Clock,
  User,
  ShieldCheck,
  Calendar,
  Layers,
  ArrowRight,
  ExternalLink,
  Phone,
  Mail,
  Filter,
  Sparkles,
  Info,
  SlidersHorizontal,
  ChevronRight,
  BadgeCheck,
  Activity,
  Car,
  Fuel,
} from 'lucide-react';

const monday = mondaySdk();

// ==========================================
// TYPES & MODÈLES DE DONNÉES DU PORTAIL
// ==========================================
export type ViewId =
  | 'home'
  | 'secteur_global'
  | 'secteur_natacha'
  | 'secteur_ketty'
  | 'secteur_emilie'
  | 'atelier_erp'
  | 'atelier_vehicules'
  | 'atelier_fournisseurs'
  | 'comm_terrain'
  | 'comm_alertes'
  | 'commercial_contrats'
  | 'commercial_rentabilite';

export interface SubMenuItem {
  id: ViewId;
  title: string;
  badge?: string;
  badgeColor?: string;
  description: string;
  icon: React.ComponentType<{ size?: number; color?: string; className?: string; style?: React.CSSProperties }>;
  type: 'iframe_secteur' | 'iframe_erp' | 'dashboard';
  animatrice?: 'Natacha' | 'Ketty' | 'Emilie' | 'Tous';
}

export interface PoleMenu {
  id: string;
  label: string;
  poleIcon: React.ComponentType<{ size?: number; color?: string; className?: string; style?: React.CSSProperties }>;
  accentColor: string;
  bgLight: string;
  description: string;
  items: SubMenuItem[];
}

// ==========================================
// CONFIGURATION COMPLÈTE DU MEGA-MENU
// ==========================================
const POLES: PoleMenu[] = [
  {
    id: 'pole_secteurs',
    label: 'Responsables de Secteur',
    poleIcon: Building2,
    accentColor: '#0073EA',
    bgLight: '#EBF6FC',
    description: 'Pilotage opérationnel des chantiers, contrôles qualité et inventaires',
    items: [
      {
        id: 'secteur_global',
        title: 'Supervision Globale (Tous Secteurs)',
        badge: '116 chantiers',
        badgeColor: '#0073EA',
        description: 'Vue transversale de l’ensemble des chantiers et indicateurs 3 étoiles',
        icon: Building2,
        type: 'iframe_secteur',
        animatrice: 'Tous',
      },
      {
        id: 'secteur_natacha',
        title: 'Secteur Natacha THOMAS',
        badge: '42 chantiers',
        badgeColor: '#6366F1',
        description: 'Chantiers région Nord / Agglo, fiches d’accès et visites des 2 mois',
        icon: User,
        type: 'iframe_secteur',
        animatrice: 'Natacha',
      },
      {
        id: 'secteur_ketty',
        title: 'Secteur Ketty PAULIN',
        badge: '38 chantiers',
        badgeColor: '#06B6D4',
        description: 'Chantiers région Est / Sud, suivi des équipes et contrôles qualité',
        icon: User,
        type: 'iframe_secteur',
        animatrice: 'Ketty',
      },
      {
        id: 'secteur_emilie',
        title: 'Secteur Emilie TOBIE',
        badge: '36 chantiers',
        badgeColor: '#EC4899',
        description: 'Chantiers région Ouest / Centre, audits qualité et consommables',
        icon: User,
        type: 'iframe_secteur',
        animatrice: 'Emilie',
      },
    ],
  },
  {
    id: 'pole_atelier',
    label: 'Atelier & Logistique',
    poleIcon: Wrench,
    accentColor: '#00C875',
    bgLight: '#E6F9F1',
    description: 'Gestion du parc machines, flotte utilitaires et approvisionnements',
    items: [
      {
        id: 'atelier_erp',
        title: 'ERP Parc Matériel & Machines',
        badge: '107 machines',
        badgeColor: '#00C875',
        description: 'Autolaveuses, monobrosses, fiches de contrôle technique et réparations',
        icon: Wrench,
        type: 'iframe_erp',
      },
      {
        id: 'atelier_vehicules',
        title: 'Flotte Véhicules Utilitaires',
        badge: '8 véhicules',
        badgeColor: '#10B981',
        description: 'Suivi du parc de camionnettes, entretiens, contrôles techniques et kilométrage',
        icon: Truck,
        type: 'dashboard',
      },
      {
        id: 'atelier_fournisseurs',
        title: 'Hub Fournisseurs & Pièces SAV',
        badge: 'Kalhyge / Nilfisk',
        badgeColor: '#059669',
        description: 'Contacts clés, commandes de pièces détachées, bavettes, brosses et hotline',
        icon: PackageSearch,
        type: 'dashboard',
      },
    ],
  },
  {
    id: 'pole_comm',
    label: 'Communication & Terrain',
    poleIcon: MessageSquare,
    accentColor: '#8B5CF6',
    bgLight: '#F3E8FF',
    description: 'Transmission inter-services, coordination atelier et alertes prioritaires',
    items: [
      {
        id: 'comm_terrain',
        title: 'Fil d’Actualités & Messages Terrain',
        badge: 'En direct',
        badgeColor: '#8B5CF6',
        description: 'Signalements des animatrices, besoins urgents atelier et cahiers de liaison',
        icon: MessageSquare,
        type: 'dashboard',
      },
      {
        id: 'comm_alertes',
        title: 'Centre d’Alertes Centralisé',
        badge: 'Prioritaire',
        badgeColor: '#EF4444',
        description: 'Contrôles insatisfaisants > 2 mois, chantiers > 11 mois et urgences',
        icon: AlertTriangle,
        type: 'dashboard',
      },
    ],
  },
  {
    id: 'pole_commercial',
    label: 'Commercial & Contrats',
    poleIcon: FileSpreadsheet,
    accentColor: '#F59E0B',
    bgLight: '#FEF3C7',
    description: 'Gestion des dotations consommables, validation des avenants et rentabilité',
    items: [
      {
        id: 'commercial_contrats',
        title: 'Contrats & Dotations Consommables',
        badge: 'Samira',
        badgeColor: '#F59E0B',
        description: 'Inventaires 182 jours, régularisations stocks Kalhyge et avenants signés',
        icon: FileSpreadsheet,
        type: 'dashboard',
      },
      {
        id: 'commercial_rentabilite',
        title: 'Analyse & Rentabilité Chantiers',
        badge: 'KPIs Marge',
        badgeColor: '#D97706',
        description: 'Économies directes générées, gains sur 12 mois et maîtrise des coûts',
        icon: TrendingUp,
        type: 'dashboard',
      },
    ],
  },
];

// URLs officielles déployées sur Monday CDN
const URL_SECTEUR_HUB = 'https://v4f02898b5089caaa1aab8b5114da62ee.cdn2.monday.app';
const URL_ATELIER_ERP = 'https://vb0e51dbd8fbf57664b5ec275468cb683.cdn2.monday.app';

export default function App() {
  const [currentView, setCurrentView] = useState<ViewId>('home');
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [userName, setUserName] = useState<string>('Guillaume Daniel');
  const [iframeLoading, setIframeLoading] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Initialisation Monday SDK + Contexte utilisateur
  useEffect(() => {
    try {
      monday.listen('context', (res: any) => {
        if (res?.data?.user?.name) {
          setUserName(res.data.user.name);
        }
      });
      monday.api('query { me { name } }')
        .then((res: any) => {
          if (res?.data?.me?.name) {
            setUserName(res.data.me.name);
          }
        })
        .catch(() => {});
    } catch {}

    // Pont bidirectionnel transparent Monday SDK pour les iframes imbriquées
    const handleBridgeMessage = (event: MessageEvent) => {
      // 1. Enfant vers Parent Monday
      if (event.source === iframeRef.current?.contentWindow) {
        if (event.data && typeof event.data === 'object') {
          window.parent.postMessage(event.data, '*');
        }
        return;
      }
      // 2. Parent Monday vers Enfant
      if (event.source === window.parent && iframeRef.current?.contentWindow) {
        if (event.data && typeof event.data === 'object') {
          iframeRef.current.contentWindow.postMessage(event.data, '*');
        }
      }
    };

    window.addEventListener('message', handleBridgeMessage);

    // Clic en dehors pour fermer les menus déroulants
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);

    // Raccourci clavier Cmd/Ctrl + K pour ouvrir la recherche rapide
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearchModal((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setShowSearchModal(false);
        setOpenDropdown(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('message', handleBridgeMessage);
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Focus automatique du champ recherche à l'ouverture du modal
  useEffect(() => {
    if (showSearchModal) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [showSearchModal]);

  // Détermination de l'élément actif actuel dans les menus
  const activeSubItem = useMemo(() => {
    for (const pole of POLES) {
      const found = pole.items.find((item) => item.id === currentView);
      if (found) return { pole, item: found };
    }
    return null;
  }, [currentView]);

  // Construction de l'URL cible pour l'iframe avec cache-buster et paramètres
  const getIframeSrc = (item: SubMenuItem) => {
    const timestamp = Date.now();
    if (item.type === 'iframe_secteur') {
      const animParam = item.animatrice && item.animatrice !== 'Tous' ? `&animatrice=${item.animatrice}&profile=${item.animatrice}` : '';
      return `${URL_SECTEUR_HUB}?t=${timestamp}${animParam}`;
    }
    if (item.type === 'iframe_erp') {
      return `${URL_ATELIER_ERP}?t=${timestamp}`;
    }
    return '';
  };

  const handleNavigate = (view: ViewId) => {
    setCurrentView(view);
    setOpenDropdown(null);
    setShowSearchModal(false);
    setSearchQuery('');
    setIframeLoading(true);

    // Si on navigue vers un sous-secteur, envoyer également un signal postMessage à l'iframe
    const targetItem = POLES.flatMap((p) => p.items).find((i) => i.id === view);
    if (targetItem?.animatrice && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        {
          type: 'SWITCH_PROFILE',
          profile: targetItem.animatrice === 'Tous' ? 'Natacha' : targetItem.animatrice,
          animatrice: targetItem.animatrice === 'Tous' ? 'Natacha' : targetItem.animatrice,
        },
        '*'
      );
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // Filtrage pour la recherche globale (Omnibar)
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    const results: Array<{ pole: PoleMenu; item: SubMenuItem }> = [];

    POLES.forEach((pole) => {
      pole.items.forEach((item) => {
        if (
          item.title.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          pole.label.toLowerCase().includes(q) ||
          (item.badge && item.badge.toLowerCase().includes(q))
        ) {
          results.push({ pole, item });
        }
      });
    });
    return results;
  }, [searchQuery]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100%',
        backgroundColor: '#F8FAFC',
        overflow: 'hidden',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* ============================================================== */}
      {/* 1. HEADER MAÎTRE AVEC MEGA-MENU ET NAVIGATION INTERACTIVE    */}
      {/* ============================================================== */}
      <header
        ref={dropdownRef}
        style={{
          height: '64px',
          backgroundColor: '#FFFFFF',
          borderBottom: '1.5px solid #E2E8F0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          flexShrink: 0,
          boxShadow: '0 2px 10px rgba(15, 23, 42, 0.05)',
          zIndex: 50,
          position: 'relative',
        }}
      >
        {/* Logo & Marque Groupe Facility */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div
            onClick={() => handleNavigate('home')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '11px',
                backgroundColor: '#0F172A',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 3px 8px rgba(15, 23, 42, 0.25)',
              }}
            >
              <Layers size={22} color="#38BDF8" />
            </div>
            <div>
              <div
                style={{
                  fontSize: '15px',
                  fontWeight: 900,
                  color: '#0F172A',
                  letterSpacing: '0.6px',
                  lineHeight: 1.1,
                }}
              >
                GROUPE FACILITY
              </div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#0284C7' }}>
                Portail Intranet Multi-Hubs
              </div>
            </div>
          </div>

          <div style={{ height: '26px', width: '1px', backgroundColor: '#E2E8F0' }} />

          {/* Navigation Principale avec Menus Déroulants (Dropdowns) */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {/* Bouton Accueil */}
            <button
              type="button"
              onClick={() => handleNavigate('home')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 14px',
                borderRadius: '9px',
                fontSize: '13px',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                backgroundColor: currentView === 'home' ? '#0F172A' : 'transparent',
                color: currentView === 'home' ? '#FFFFFF' : '#475569',
              }}
            >
              <Home size={16} />
              <span>Accueil</span>
            </button>

            {/* Menus Déroulants pour chaque Pôle */}
            {POLES.map((pole) => {
              const isPoleActive = pole.items.some((item) => item.id === currentView);
              const isOpen = openDropdown === pole.id;
              const Icon = pole.poleIcon;

              return (
                <div key={pole.id} style={{ position: 'relative' }}>
                  <button
                    type="button"
                    onClick={() => setOpenDropdown(isOpen ? null : pole.id)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '7px',
                      padding: '8px 14px',
                      borderRadius: '9px',
                      fontSize: '13px',
                      fontWeight: 700,
                      border: isPoleActive
                        ? `1.5px solid ${pole.accentColor}`
                        : isOpen
                        ? '1px solid #CBD5E1'
                        : '1px solid transparent',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      backgroundColor: isPoleActive
                        ? pole.bgLight
                        : isOpen
                        ? '#F1F5F9'
                        : 'transparent',
                      color: isPoleActive ? pole.accentColor : '#334155',
                    }}
                  >
                    <Icon size={16} color={isPoleActive ? pole.accentColor : '#64748B'} />
                    <span>{pole.label}</span>
                    <ChevronDown
                      size={14}
                      style={{
                        transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s ease',
                        color: isPoleActive ? pole.accentColor : '#94A3B8',
                      }}
                    />
                  </button>

                  {/* Panneau Déroulant (Dropdown Menu) */}
                  {isOpen && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '46px',
                        left: 0,
                        width: '360px',
                        backgroundColor: '#FFFFFF',
                        borderRadius: '14px',
                        border: '1px solid #E2E8F0',
                        boxShadow: '0 12px 30px rgba(15, 23, 42, 0.12)',
                        padding: '10px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        zIndex: 100,
                        animation: 'fadeIn 0.15s ease-out',
                      }}
                    >
                      <div
                        style={{
                          padding: '6px 10px',
                          fontSize: '11px',
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          color: '#94A3B8',
                          letterSpacing: '0.5px',
                        }}
                      >
                        {pole.description}
                      </div>

                      {pole.items.map((subItem) => {
                        const SubIcon = subItem.icon;
                        const isSubActive = currentView === subItem.id;

                        return (
                          <div
                            key={subItem.id}
                            onClick={() => handleNavigate(subItem.id)}
                            style={{
                              padding: '10px 12px',
                              borderRadius: '10px',
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '12px',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                              backgroundColor: isSubActive ? pole.bgLight : 'transparent',
                            }}
                            onMouseEnter={(e) => {
                              if (!isSubActive) e.currentTarget.style.backgroundColor = '#F8FAFC';
                            }}
                            onMouseLeave={(e) => {
                              if (!isSubActive) e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                          >
                            <div
                              style={{
                                width: '34px',
                                height: '34px',
                                borderRadius: '8px',
                                backgroundColor: isSubActive ? pole.accentColor : '#F1F5F9',
                                color: isSubActive ? '#FFFFFF' : '#475569',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                marginTop: '2px',
                              }}
                            >
                              <SubIcon size={18} />
                            </div>

                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: '8px',
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: '13px',
                                    fontWeight: 700,
                                    color: isSubActive ? pole.accentColor : '#1E293B',
                                  }}
                                >
                                  {subItem.title}
                                </span>
                                {subItem.badge && (
                                  <span
                                    style={{
                                      fontSize: '10px',
                                      fontWeight: 800,
                                      padding: '2px 7px',
                                      borderRadius: '12px',
                                      backgroundColor: `${subItem.badgeColor || pole.accentColor}15`,
                                      color: subItem.badgeColor || pole.accentColor,
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {subItem.badge}
                                  </span>
                                )}
                              </div>
                              <p
                                style={{
                                  margin: '2px 0 0 0',
                                  fontSize: '11px',
                                  color: '#64748B',
                                  lineHeight: 1.3,
                                }}
                              >
                                {subItem.description}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>

        {/* Côté Droit : Recherche Omnibar, Actualiser, Plein Écran, Profil */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Barre de Recherche Rapide (Omnibar) */}
          <button
            type="button"
            onClick={() => setShowSearchModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '7px 12px',
              borderRadius: '9px',
              backgroundColor: '#F1F5F9',
              border: '1px solid #E2E8F0',
              color: '#64748B',
              fontSize: '12px',
              cursor: 'pointer',
              fontWeight: 500,
              transition: 'background-color 0.15s ease',
            }}
          >
            <Search size={14} color="#64748B" />
            <span>Rechercher...</span>
            <kbd
              style={{
                backgroundColor: '#FFFFFF',
                border: '1px solid #CBD5E1',
                borderRadius: '4px',
                padding: '1px 5px',
                fontSize: '10px',
                fontWeight: 700,
                color: '#475569',
              }}
            >
              Ctrl K
            </kbd>
          </button>

          {/* Bouton Actualiser */}
          {currentView !== 'home' && (
            <button
              type="button"
              onClick={() => {
                setRefreshNonce((n) => n + 1);
                setIframeLoading(true);
              }}
              title="Recharger le sous-hub actif"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 12px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                backgroundColor: '#FFFFFF',
                color: '#475569',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={13} />
              <span>Actualiser</span>
            </button>
          )}

          {/* Bouton Plein Écran */}
          <button
            type="button"
            onClick={toggleFullscreen}
            title="Basculer en plein écran"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 12px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              backgroundColor: '#FFFFFF',
              color: '#475569',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <Maximize2 size={13} />
            <span>Plein écran</span>
          </button>

          {/* Profil Utilisateur Connecté */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '5px 12px',
              borderRadius: '20px',
              backgroundColor: '#F1F5F9',
              border: '1px solid #E2E8F0',
              fontSize: '12px',
              fontWeight: 700,
              color: '#334155',
            }}
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: '#00C875',
              }}
            />
            <span>{userName}</span>
          </div>
        </div>
      </header>

      {/* ============================================================== */}
      {/* 2. FIL D'ARIANE (BREADCRUMB) & STATUS BAR                     */}
      {/* ============================================================== */}
      {currentView !== 'home' && activeSubItem && (
        <div
          style={{
            height: '36px',
            backgroundColor: '#FFFFFF',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 20px',
            fontSize: '12px',
            flexShrink: 0,
            color: '#64748B',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              onClick={() => handleNavigate('home')}
              style={{ cursor: 'pointer', fontWeight: 600, color: '#0284C7' }}
            >
              Accueil
            </span>
            <ChevronRight size={13} color="#94A3B8" />
            <span style={{ fontWeight: 600, color: activeSubItem.pole.accentColor }}>
              {activeSubItem.pole.label}
            </span>
            <ChevronRight size={13} color="#94A3B8" />
            <span style={{ fontWeight: 700, color: '#0F172A' }}>
              {activeSubItem.item.title}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {activeSubItem.item.badge && (
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: activeSubItem.item.badgeColor || activeSubItem.pole.accentColor,
                  backgroundColor: `${activeSubItem.item.badgeColor || activeSubItem.pole.accentColor}15`,
                  padding: '2px 8px',
                  borderRadius: '10px',
                }}
              >
                ● {activeSubItem.item.badge}
              </span>
            )}
            <span style={{ fontSize: '11px', color: '#94A3B8' }}>
              Groupe Facility Live Hub
            </span>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 3. MODAL DE RECHERCHE RAPIDE (OMNIBAR)                        */}
      {/* ============================================================== */}
      {showSearchModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(3px)',
            zIndex: 200,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            paddingTop: '12vh',
          }}
          onClick={() => setShowSearchModal(false)}
        >
          <div
            style={{
              width: '580px',
              maxWidth: '92vw',
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              boxShadow: '0 20px 40px rgba(15, 23, 42, 0.25)',
              overflow: 'hidden',
              border: '1px solid #E2E8F0',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Champ de saisie */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '16px 20px',
                borderBottom: '1px solid #E2E8F0',
              }}
            >
              <Search size={20} color="#64748B" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher un pôle, une animatrice, une machine, un fournisseur..."
                style={{
                  flex: 1,
                  border: 'none',
                  outline: 'none',
                  fontSize: '15px',
                  fontWeight: 600,
                  color: '#0F172A',
                }}
              />
              <kbd
                style={{
                  backgroundColor: '#F1F5F9',
                  border: '1px solid #CBD5E1',
                  borderRadius: '4px',
                  padding: '2px 6px',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#64748B',
                }}
              >
                ESC
              </kbd>
            </div>

            {/* Liste des résultats */}
            <div style={{ maxHeight: '380px', overflowY: 'auto', padding: '10px' }}>
              {searchQuery.trim() === '' ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
                  Tapez le nom d’un secteur (ex: <i>Natacha</i>, <i>Ketty</i>), d’un outil (<i>Machine</i>, <i>Atelier</i>) ou d’un service (<i>Fournisseur</i>, <i>Contrat</i>).
                </div>
              ) : searchResults.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
                  Aucun résultat pour « {searchQuery} »
                </div>
              ) : (
                searchResults.map(({ pole, item }) => {
                  const ItemIcon = item.icon;
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleNavigate(item.id)}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '14px',
                        cursor: 'pointer',
                        transition: 'background-color 0.1s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F8FAFC')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <div
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '8px',
                          backgroundColor: pole.bgLight,
                          color: pole.accentColor,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <ItemIcon size={18} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
                            {item.title}
                          </span>
                          <span style={{ fontSize: '11px', color: '#94A3B8' }}>• {pole.label}</span>
                        </div>
                        <p style={{ margin: 0, fontSize: '11px', color: '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.description}
                        </p>
                      </div>
                      <ArrowRight size={15} color="#94A3B8" />
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 4. CONTENU PRINCIPAL                                          */}
      {/* ============================================================== */}
      <main style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {/* VUE 1 : ACCUEIL DU PORTAIL GLOBAL */}
        {currentView === 'home' && (
          <div
            style={{
              height: '100%',
              overflowY: 'auto',
              padding: '30px 40px',
              maxWidth: '1400px',
              margin: '0 auto',
            }}
          >
            {/* Bannière de Bienvenue */}
            <div
              style={{
                backgroundColor: '#0F172A',
                borderRadius: '18px',
                padding: '30px 36px',
                color: '#FFFFFF',
                backgroundImage: 'radial-gradient(circle at top right, #1E3A8A 0%, #0F172A 70%)',
                boxShadow: '0 10px 25px rgba(15, 23, 42, 0.15)',
                marginBottom: '30px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '20px',
              }}
            >
              <div>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    backgroundColor: 'rgba(56, 189, 248, 0.15)',
                    color: '#38BDF8',
                    fontSize: '12px',
                    fontWeight: 700,
                    marginBottom: '12px',
                  }}
                >
                  <Sparkles size={14} />
                  <span>Portail Centralisé d’Entreprise</span>
                </div>
                <h1 style={{ fontSize: '26px', fontWeight: 900, margin: '0 0 8px 0', letterSpacing: '-0.5px' }}>
                  Bienvenue sur l’Intranet Groupe Facility
                </h1>
                <p style={{ margin: 0, fontSize: '14px', color: '#94A3B8', maxWidth: '620px', lineHeight: 1.5 }}>
                  Point d’accès unique pour les animatrices de secteur, techniciens de maintenance, logistique et direction. Consultez vos tableaux de bord, suivez vos machines et pilotez vos contrats.
                </p>
              </div>

              {/* Raccourcis Rapides */}
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => handleNavigate('secteur_global')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 18px',
                    borderRadius: '10px',
                    backgroundColor: '#0073EA',
                    color: '#FFFFFF',
                    border: 'none',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(0, 115, 234, 0.35)',
                  }}
                >
                  <Building2 size={16} />
                  <span>Hub Secteur</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleNavigate('atelier_erp')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 18px',
                    borderRadius: '10px',
                    backgroundColor: '#00C875',
                    color: '#FFFFFF',
                    border: 'none',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(0, 200, 117, 0.35)',
                  }}
                >
                  <Wrench size={16} />
                  <span>ERP Atelier</span>
                </button>
              </div>
            </div>

            {/* Cartes Métriques Globales */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '18px',
                marginBottom: '35px',
              }}
            >
              <div
                onClick={() => handleNavigate('secteur_global')}
                style={{
                  backgroundColor: '#FFFFFF',
                  padding: '20px',
                  borderRadius: '14px',
                  border: '1.5px solid #E2E8F0',
                  cursor: 'pointer',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 115, 234, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.03)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#64748B' }}>Chantiers en Contrat</span>
                  <div style={{ width: '34px', height: '34px', borderRadius: '8px', backgroundColor: '#EBF6FC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Building2 size={18} color="#0073EA" />
                  </div>
                </div>
                <div style={{ fontSize: '28px', fontWeight: 900, color: '#0F172A', marginTop: '10px' }}>116</div>
                <div style={{ fontSize: '12px', color: '#00C875', fontWeight: 700, marginTop: '4px' }}>
                  ● 3 secteurs opérationnels
                </div>
              </div>

              <div
                onClick={() => handleNavigate('atelier_erp')}
                style={{
                  backgroundColor: '#FFFFFF',
                  padding: '20px',
                  borderRadius: '14px',
                  border: '1.5px solid #E2E8F0',
                  cursor: 'pointer',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 200, 117, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.03)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#64748B' }}>Parc Machines Atelier</span>
                  <div style={{ width: '34px', height: '34px', borderRadius: '8px', backgroundColor: '#E6F9F1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Wrench size={18} color="#00C875" />
                  </div>
                </div>
                <div style={{ fontSize: '28px', fontWeight: 900, color: '#0F172A', marginTop: '10px' }}>107</div>
                <div style={{ fontSize: '12px', color: '#00C875', fontWeight: 700, marginTop: '4px' }}>
                  ● Suivi préventif actif
                </div>
              </div>

              <div
                onClick={() => handleNavigate('atelier_vehicules')}
                style={{
                  backgroundColor: '#FFFFFF',
                  padding: '20px',
                  borderRadius: '14px',
                  border: '1.5px solid #E2E8F0',
                  cursor: 'pointer',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(16, 185, 129, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.03)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#64748B' }}>Flotte Utilitaires</span>
                  <div style={{ width: '34px', height: '34px', borderRadius: '8px', backgroundColor: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Truck size={18} color="#10B981" />
                  </div>
                </div>
                <div style={{ fontSize: '28px', fontWeight: 900, color: '#0F172A', marginTop: '10px' }}>8</div>
                <div style={{ fontSize: '12px', color: '#10B981', fontWeight: 700, marginTop: '4px' }}>
                  ● 100% en conformité CT
                </div>
              </div>

              <div
                onClick={() => handleNavigate('commercial_rentabilite')}
                style={{
                  backgroundColor: '#FFFFFF',
                  padding: '20px',
                  borderRadius: '14px',
                  border: '1.5px solid #E2E8F0',
                  cursor: 'pointer',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(245, 158, 11, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.03)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#64748B' }}>Économies Générées</span>
                  <div style={{ width: '34px', height: '34px', borderRadius: '8px', backgroundColor: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <TrendingUp size={18} color="#D97706" />
                  </div>
                </div>
                <div style={{ fontSize: '28px', fontWeight: 900, color: '#0F172A', marginTop: '10px' }}>14 850 €</div>
                <div style={{ fontSize: '12px', color: '#D97706', fontWeight: 700, marginTop: '4px' }}>
                  ● Récupération & Avenants
                </div>
              </div>
            </div>

            {/* Grille des 4 Pôles Majeurs du Groupe Facility */}
            <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', margin: '0 0 16px 0' }}>
              Pôles & Applications du Groupe
            </h2>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: '24px',
              }}
            >
              {POLES.map((pole) => {
                const PoleIcon = pole.poleIcon;
                return (
                  <div
                    key={pole.id}
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: '16px',
                      border: '1.5px solid #E2E8F0',
                      padding: '24px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      boxShadow: '0 3px 12px rgba(15, 23, 42, 0.04)',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                        <div
                          style={{
                            width: '42px',
                            height: '42px',
                            borderRadius: '10px',
                            backgroundColor: pole.bgLight,
                            color: pole.accentColor,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <PoleIcon size={22} />
                        </div>
                        <div>
                          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>
                            {pole.label}
                          </h3>
                          <span style={{ fontSize: '12px', color: '#64748B' }}>{pole.items.length} modules disponibles</span>
                        </div>
                      </div>

                      <p style={{ margin: '0 0 18px 0', fontSize: '13px', color: '#475569', lineHeight: 1.4 }}>
                        {pole.description}
                      </p>

                      {/* Sous-modules listés avec clic direct */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {pole.items.map((subItem) => {
                          const SubIcon = subItem.icon;
                          return (
                            <button
                              key={subItem.id}
                              type="button"
                              onClick={() => handleNavigate(subItem.id)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '9px 12px',
                                borderRadius: '8px',
                                backgroundColor: '#F8FAFC',
                                border: '1px solid #E2E8F0',
                                color: '#1E293B',
                                fontSize: '12px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                textAlign: 'left',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = pole.bgLight;
                                e.currentTarget.style.borderColor = pole.accentColor;
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = '#F8FAFC';
                                e.currentTarget.style.borderColor = '#E2E8F0';
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <SubIcon size={14} color={pole.accentColor} />
                                <span>{subItem.title}</span>
                              </div>
                              <ChevronRight size={14} color="#94A3B8" />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* VUES IFRAMES (HUB RESPONSABLE DE SECTEUR & ERP ATELIER) */}
        {activeSubItem && (activeSubItem.item.type === 'iframe_secteur' || activeSubItem.item.type === 'iframe_erp') && (
          <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            {iframeLoading && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundColor: '#FFFFFF',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '14px',
                  zIndex: 10,
                }}
              >
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    border: `3px solid ${activeSubItem.pole.bgLight}`,
                    borderTop: `3px solid ${activeSubItem.pole.accentColor}`,
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                  }}
                />
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#475569' }}>
                  Chargement de l’application {activeSubItem.item.title}...
                </span>
              </div>
            )}
            <iframe
              ref={iframeRef}
              key={`${currentView}-${refreshNonce}`}
              src={getIframeSrc(activeSubItem.item)}
              title={activeSubItem.item.title}
              onLoad={() => setIframeLoading(false)}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                display: 'block',
              }}
              allow="clipboard-write; fullscreen; camera; microphone"
            />
          </div>
        )}

        {/* DASHBOARD SPÉCIFIQUE : FLOTTE VÉHICULES */}
        {currentView === 'atelier_vehicules' && (
          <div style={{ height: '100%', overflowY: 'auto', padding: '30px 40px', maxWidth: '1400px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
              <div>
                <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                  Flotte Véhicules Utilitaires
                </h1>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748B' }}>
                  Suivi des 8 camionnettes d’intervention, contrôles techniques, affectations et révisions
                </p>
              </div>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#10B981', backgroundColor: '#ECFDF5', padding: '6px 14px', borderRadius: '20px' }}>
                ● 8 / 8 En Service
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '30px' }}>
              {[
                { immat: 'EK-492-FZ', modele: 'Renault Kangoo Maxi', user: 'Christophe (Atelier)', km: '118 420 km', ct: '14/11/2026', statut: 'Conforme' },
                { immat: 'FN-183-QA', modele: 'Peugeot Partner', user: 'Natacha THOMAS', km: '84 310 km', ct: '22/03/2027', statut: 'Conforme' },
                { immat: 'GB-742-PL', modele: 'Citroën Berlingo', user: 'Ketty PAULIN', km: '92 150 km', ct: '18/06/2027', statut: 'Conforme' },
                { immat: 'GH-339-RT', modele: 'Renault Master', user: 'Équipe Travaux Exceptionnels', km: '142 800 km', ct: '09/01/2027', statut: 'Conforme' },
                { immat: 'HL-904-BK', modele: 'Peugeot Expert', user: 'Emilie TOBIE', km: '67 900 km', ct: '30/08/2027', statut: 'Conforme' },
                { immat: 'JC-511-MM', modele: 'Renault Kangoo', user: 'Polyvalent Secteur Nord', km: '105 200 km', ct: '12/10/2026', statut: 'À Prévoir (3 mois)' },
                { immat: 'KA-820-XX', modele: 'Citroën Jumper', user: 'Logistique & Consommables', km: '178 400 km', ct: '05/04/2027', statut: 'Conforme' },
                { immat: 'KP-229-YY', modele: 'Renault Trafic', user: 'Atelier Mobile', km: '121 000 km', ct: '19/12/2026', statut: 'Conforme' },
              ].map((v) => (
                <div key={v.immat} style={{ backgroundColor: '#FFFFFF', padding: '18px', borderRadius: '12px', border: '1.5px solid #E2E8F0', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', fontFamily: 'monospace' }}>{v.immat}</span>
                    <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '10px', backgroundColor: v.statut.includes('À Prévoir') ? '#FEF3C7' : '#ECFDF5', color: v.statut.includes('À Prévoir') ? '#D97706' : '#10B981' }}>
                      {v.statut}
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>{v.modele}</div>
                  <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>Affectation : <b>{v.user}</b></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #F1F5F9', fontSize: '11px', color: '#64748B' }}>
                    <span>Kilométrage : <b>{v.km}</b></span>
                    <span>Prochain CT : <b>{v.ct}</b></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* DASHBOARD SPÉCIFIQUE : HUB FOURNISSEURS & SAV */}
        {currentView === 'atelier_fournisseurs' && (
          <div style={{ height: '100%', overflowY: 'auto', padding: '30px 40px', maxWidth: '1400px', margin: '0 auto' }}>
            <div style={{ marginBottom: '24px' }}>
              <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                Hub Fournisseurs & Pièces SAV
              </h1>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748B' }}>
                Répertoire centralisé des partenaires consommables, fabricants de machines et contacts urgents
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
              {[
                { name: 'Kalhyge Hygiène', role: 'Fournisseur principal consommables (chimie, sacs, papier)', tel: '02 40 92 11 00', mail: 'commandes.nantes@kalhyge.fr', ref: 'Client N° FAC-4402', delai: '48h ouvrées' },
                { name: 'Nilfisk France SAV', role: 'Constructeur autolaveuses & balayeuses industrielles', tel: '01 69 59 87 00', mail: 'sav.france@nilfisk.com', ref: 'Contrat Maintenance Privilège', delai: 'Pièces sous 24h' },
                { name: 'Taski / Diversey', role: 'Monobrosses & aspirateurs professionnels', tel: '01 45 14 76 76', mail: 'taski.support@diversey.com', ref: 'Compte Pro Facility', delai: '72h ouvrées' },
                { name: 'Kärcher Professionnel', role: 'Nettoyeurs haute pression & injecteurs-extracteurs', tel: '01 43 99 67 70', mail: 'pro@karcher.fr', ref: 'Code Partenaire K-8812', delai: '48h ouvrées' },
              ].map((f) => (
                <div key={f.name} style={{ backgroundColor: '#FFFFFF', padding: '22px', borderRadius: '14px', border: '1.5px solid #E2E8F0', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>{f.name}</div>
                  <p style={{ fontSize: '12px', color: '#64748B', margin: '4px 0 14px 0' }}>{f.role}</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#334155' }}>
                      <Phone size={14} color="#0073EA" />
                      <span>{f.tel}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#334155' }}>
                      <Mail size={14} color="#0073EA" />
                      <span>{f.mail}</span>
                    </div>
                  </div>
                  <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94A3B8' }}>
                    <span>{f.ref}</span>
                    <span style={{ fontWeight: 700, color: '#00C875' }}>{f.delai}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* DASHBOARD SPÉCIFIQUE : FIL D'ACTUALITÉS TERRAIN */}
        {currentView === 'comm_terrain' && (
          <div style={{ height: '100%', overflowY: 'auto', padding: '30px 40px', maxWidth: '1400px', margin: '0 auto' }}>
            <div style={{ marginBottom: '24px' }}>
              <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                Fil d’Actualités & Messages Terrain
              </h1>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748B' }}>
                Coordination directe entre animateurs de secteur, chefs d’équipe et atelier
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {[
                { auteur: 'Christophe (Atelier)', date: 'Aujourd’hui 09:15', chantier: 'Atelier Central', msg: 'Autolaveuse Nilfisk SC401 réparée et prête pour réaffectation sur chantier.', type: 'info' },
                { auteur: 'Natacha THOMAS', date: 'Hier 16:40', chantier: 'Drogou Transports', msg: 'Stock papier essuie-mains validé. Avenant de réduction de dotation à transmettre à Samira.', type: 'action' },
                { auteur: 'Ketty PAULIN', date: '15/11/2026', chantier: 'Clinique Jules Verne', msg: 'Contrôle qualité 3 étoiles validé ce matin. Équipe félicitée pour la tenue des vestiaires.', type: 'success' },
                { auteur: 'Emilie TOBIE', date: '14/11/2026', chantier: 'Logistiport', msg: 'Remplacement de la bavette avant sur la monobrosse demandé à l’atelier.', type: 'urgent' },
              ].map((m, idx) => (
                <div key={idx} style={{ backgroundColor: '#FFFFFF', padding: '18px 22px', borderRadius: '12px', border: '1.5px solid #E2E8F0', display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                  <div style={{ width: '38px', height: '38px', borderRadius: '50%', backgroundColor: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#334155', flexShrink: 0 }}>
                    {m.auteur.charAt(0)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A' }}>{m.auteur}</span>
                      <span style={{ fontSize: '11px', color: '#94A3B8' }}>{m.date}</span>
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#0284C7', marginTop: '2px' }}>Chantier : {m.chantier}</div>
                    <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: '#334155', lineHeight: 1.4 }}>{m.msg}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* DASHBOARD SPÉCIFIQUE : CENTRE D'ALERTES CENTRALISÉ */}
        {currentView === 'comm_alertes' && (
          <div style={{ height: '100%', overflowY: 'auto', padding: '30px 40px', maxWidth: '1400px', margin: '0 auto' }}>
            <div style={{ marginBottom: '24px' }}>
              <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                Centre d’Alertes Centralisé
              </h1>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748B' }}>
                Surveillance transverse de l’ensemble des points de non-conformité et chantiers sensibles
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
              <div style={{ backgroundColor: '#FFFFFF', padding: '22px', borderRadius: '14px', border: '1.5px solid #FEE2E2', borderLeft: '5px solid #EF4444' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#EF4444', fontWeight: 800, fontSize: '14px' }}>
                  <AlertTriangle size={18} />
                  <span>Contrôles Insatisfaisants &gt; 2 mois</span>
                </div>
                <div style={{ fontSize: '26px', fontWeight: 900, color: '#0F172A', marginTop: '8px' }}>2 chantiers</div>
                <p style={{ fontSize: '12px', color: '#64748B', margin: '6px 0 0 0' }}>Nécessitent un contre-audit immédiat par l’animatrice de secteur.</p>
              </div>

              <div style={{ backgroundColor: '#FFFFFF', padding: '22px', borderRadius: '14px', border: '1.5px solid #FEF3C7', borderLeft: '5px solid #F59E0B' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#D97706', fontWeight: 800, fontSize: '14px' }}>
                  <Clock size={18} />
                  <span>Chantiers non vus depuis 11 mois</span>
                </div>
                <div style={{ fontSize: '26px', fontWeight: 900, color: '#0F172A', marginTop: '8px' }}>3 chantiers</div>
                <p style={{ fontSize: '12px', color: '#64748B', margin: '6px 0 0 0' }}>Visite annuelle obligatoire avant expiration du cycle qualité.</p>
              </div>

              <div style={{ backgroundColor: '#FFFFFF', padding: '22px', borderRadius: '14px', border: '1.5px solid #EBF6FC', borderLeft: '5px solid #0073EA' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0073EA', fontWeight: 800, fontSize: '14px' }}>
                  <ShieldCheck size={18} />
                  <span>Visites des 2 Mois à Planifier</span>
                </div>
                <div style={{ fontSize: '26px', fontWeight: 900, color: '#0F172A', marginTop: '8px' }}>4 chantiers</div>
                <p style={{ fontSize: '12px', color: '#64748B', margin: '6px 0 0 0' }}>Point d’étape démarrage nouveaux chantiers signés récemment.</p>
              </div>
            </div>
          </div>
        )}

        {/* DASHBOARD SPÉCIFIQUE : COMMERCIAL & CONTRATS */}
        {currentView === 'commercial_contrats' && (
          <div style={{ height: '100%', overflowY: 'auto', padding: '30px 40px', maxWidth: '1400px', margin: '0 auto' }}>
            <div style={{ marginBottom: '24px' }}>
              <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                Contrats & Dotations Consommables
              </h1>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748B' }}>
                Suivi des régularisations de stocks Kalhyge, inventaires 182 jours et avenants
              </p>
            </div>

            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '14px', border: '1.5px solid #E2E8F0', padding: '24px' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>
                Derniers Avenants Consommables Validés
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  { client: 'Logistiport Ouest', dotationInitiale: '1 200 € / an', ajustement: '- 300 € / an', economieDirecte: '450 € récupérés', statut: 'Signé' },
                  { client: 'Transports Drogou', dotationInitiale: '2 400 € / an', ajustement: '- 600 € / an', economieDirecte: '820 € récupérés', statut: 'Signé' },
                  { client: 'Clinique Saint-Augustin', dotationInitiale: '4 800 € / an', ajustement: '- 850 € / an', economieDirecte: '1 100 € récupérés', statut: 'En attente signature' },
                ].map((c, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', backgroundColor: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A' }}>{c.client}</div>
                      <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>Dotation : {c.dotationInitiale} • Ajustement : <b style={{ color: '#00C875' }}>{c.ajustement}</b></div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: '#D97706' }}>{c.economieDirecte}</div>
                      <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', backgroundColor: c.statut.includes('Signé') ? '#ECFDF5' : '#FEF3C7', color: c.statut.includes('Signé') ? '#10B981' : '#D97706' }}>
                        {c.statut}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* DASHBOARD SPÉCIFIQUE : ANALYSE & RENTABILITÉ */}
        {currentView === 'commercial_rentabilite' && (
          <div style={{ height: '100%', overflowY: 'auto', padding: '30px 40px', maxWidth: '1400px', margin: '0 auto' }}>
            <div style={{ marginBottom: '24px' }}>
              <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                Analyse & Rentabilité Chantiers
              </h1>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748B' }}>
                Indicateurs financiers, économies directes et optimisation des coûts sur 12 mois
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '24px' }}>
              <div style={{ backgroundColor: '#FFFFFF', padding: '24px', borderRadius: '14px', border: '1.5px solid #E2E8F0' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#64748B' }}>Économie Directe (Stocks Récupérés)</span>
                <div style={{ fontSize: '32px', fontWeight: 900, color: '#00C875', marginTop: '8px' }}>8 420 €</div>
                <p style={{ fontSize: '12px', color: '#64748B', margin: '6px 0 0 0' }}>Valeur HT des produits de sur-stock réinjectés dans l’Atelier Central.</p>
              </div>

              <div style={{ backgroundColor: '#FFFFFF', padding: '24px', borderRadius: '14px', border: '1.5px solid #E2E8F0' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#64748B' }}>Économie Contrats (Projection 12 Mois)</span>
                <div style={{ fontSize: '32px', fontWeight: 900, color: '#0073EA', marginTop: '8px' }}>14 850 €</div>
                <p style={{ fontSize: '12px', color: '#64748B', margin: '6px 0 0 0' }}>Gains annuels récurrents issus des baisses de dotations négociées.</p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Style global pour animations douces et spinners */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
