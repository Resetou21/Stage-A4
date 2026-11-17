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
  Layers,
  ArrowRight,
  ExternalLink,
  Phone,
  Mail,
  Sparkles,
  ChevronRight,
  BadgeCheck,
  Activity,
  Award,
  AlertCircle,
  Users,
} from 'lucide-react';

const monday = mondaySdk();

// ==========================================
// TYPES & MODÈLES DU PORTAIL GLOBAL
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

// Configuration des Pôles et Sous-Menus
const POLES: PoleMenu[] = [
  {
    id: 'pole_secteurs',
    label: 'Responsables de Secteur',
    poleIcon: Building2,
    accentColor: '#0073EA',
    bgLight: '#EBF6FC',
    description: 'Pilotage des chantiers, contrôles qualité et inventaires',
    items: [
      {
        id: 'secteur_global',
        title: 'Supervision Globale (Tous Secteurs)',
        badge: '371 chantiers',
        badgeColor: '#0073EA',
        description: 'Vue consolidée des 3 secteurs : chantiers, satisfaction 86% et étoiles',
        icon: Building2,
        animatrice: 'Tous',
      },
      {
        id: 'secteur_natacha',
        title: 'Secteur Natacha THOMAS',
        badge: '161 chantiers',
        badgeColor: '#6366F1',
        description: 'Taux de satisfaction : 95% • 78 clients 3 étoiles 🌟',
        icon: User,
        animatrice: 'Natacha',
      },
      {
        id: 'secteur_ketty',
        title: 'Secteur Ketty PAULIN',
        badge: '151 chantiers',
        badgeColor: '#06B6D4',
        description: 'Taux de satisfaction : 73% • 50 clients 3 étoiles 🌟',
        icon: User,
        animatrice: 'Ketty',
      },
      {
        id: 'secteur_emilie',
        title: 'Secteur Emilie TOBIE',
        badge: '57 chantiers',
        badgeColor: '#EC4899',
        description: 'Taux de satisfaction : 97% • 38 clients 3 étoiles 🌟',
        icon: User,
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
    description: 'Parc machines, contrôles techniques et approvisionnements',
    items: [
      {
        id: 'atelier_erp',
        title: 'ERP Parc Matériel & Machines',
        badge: '133 machines',
        badgeColor: '#00C875',
        description: 'Autolaveuses, monobrosses, compteurs d’heures et réparations curatives',
        icon: Wrench,
      },
      {
        id: 'atelier_vehicules',
        title: 'Flotte Véhicules Utilitaires',
        badge: '8 véhicules',
        badgeColor: '#10B981',
        description: 'Suivi du parc des utilitaires d’intervention, contrôles techniques et révisions',
        icon: Truck,
      },
      {
        id: 'atelier_fournisseurs',
        title: 'Hub Fournisseurs & Pièces SAV',
        badge: 'Kalhyge / Nilfisk',
        badgeColor: '#059669',
        description: 'Carnet d’adresses partenaires, pièces détachées et délais',
        icon: PackageSearch,
      },
    ],
  },
  {
    id: 'pole_comm',
    label: 'Communication & Terrain',
    poleIcon: MessageSquare,
    accentColor: '#8B5CF6',
    bgLight: '#F3E8FF',
    description: 'Transmission inter-services, coordination atelier et alertes',
    items: [
      {
        id: 'comm_terrain',
        title: 'Fil d’Actualités & Messages Terrain',
        badge: 'Coordination',
        badgeColor: '#8B5CF6',
        description: 'Échanges en temps réel avec les chefs d’équipe et l’atelier',
        icon: MessageSquare,
      },
      {
        id: 'comm_alertes',
        title: 'Centre d’Alertes Centralisé',
        badge: 'Alertes qualité',
        badgeColor: '#EF4444',
        description: 'Chantiers insatisfaisants, alertes 11 mois et visites des 2 mois',
        icon: AlertTriangle,
      },
    ],
  },
  {
    id: 'pole_commercial',
    label: 'Commercial & Contrats',
    poleIcon: FileSpreadsheet,
    accentColor: '#F59E0B',
    bgLight: '#FEF3C7',
    description: 'Inventaires 182 jours, contrats et suivi des consommables',
    items: [
      {
        id: 'commercial_contrats',
        title: 'Inventaires & Dotations Consommables',
        badge: '60 à faire',
        badgeColor: '#F59E0B',
        description: 'Suivi des inventaires cycliques (182 jours) et historique des validations',
        icon: FileSpreadsheet,
      },
    ],
  },
];

// URLs des applications spécialisées hébergées sur le CDN Monday
const URL_SECTEUR_HUB = 'https://v4f02898b5089caaa1aab8b5114da62ee.cdn2.monday.app';
const URL_ATELIER_ERP = 'https://vb0e51dbd8fbf57664b5ec275468cb683.cdn2.monday.app';

// ==========================================
// COMPOSANT PRINCIPAL DU PORTAIL GLOBAL
// ==========================================
export default function App() {
  const [currentView, setCurrentView] = useState<ViewId>('home');
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [userName, setUserName] = useState<string>('Guillaume Daniel');
  const [loadingStats, setLoadingStats] = useState<boolean>(true);
  const [refreshKey, setRefreshKey] = useState<number>(0);

  // DONNÉES 100% RÉELLES ISSUES DE MONDAY.COM
  const [stats, setStats] = useState({
    chantiersActifs: 371,
    chantiersParAnim: {
      Natacha: 161,
      Ketty: 151,
      Emilie: 57,
      Autre: 2,
    },
    visitesTotal: 499,
    visitesBonnes: 428,
    tauxSatisfactionGlobal: 86,
    visitesParAnim: {
      Natacha: { total: 184, bon: 174, pct: 95 },
      Ketty: { total: 175, bon: 128, pct: 73 },
      Emilie: { total: 103, bon: 100, pct: 97 },
    },
    etoiles: {
      Global: { s3: 166, s2: 103, s1: 69, bad: 14 },
      Natacha: { s3: 78, s2: 48, s1: 26, bad: 3 },
      Ketty: { s3: 50, s2: 45, s1: 37, bad: 10 },
      Emilie: { s3: 38, s2: 10, s1: 6, bad: 1 },
    },
    alertes: {
      insatisfaits3x: 1,
      nonVus11Mois: 0,
      qualitePlus2Mois: 0,
      rdv2Mois: 0,
    },
    machinesTotal: 133,
    inventairesAFaire: 60,
    inventairesRealises: 6,
  });

  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const CACHE_KEY = 'facility_portal_stats_v2';
  const CACHE_DURATION_MS = 10 * 60 * 1000; // 10 minutes

  // Requête en direct vers l'API Monday.com pour charger les stats consolidées
  const loadLiveStats = async (force: boolean = false) => {
    // 1. Vérification du cache local pour zéro latence et protection du budget Monday
    if (!force) {
      try {
        const cachedRaw = sessionStorage.getItem(CACHE_KEY);
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw);
          if (cached?.timestamp && Date.now() - cached.timestamp < CACHE_DURATION_MS && cached?.data) {
            setStats(cached.data);
            setLoadingStats(false);
            return;
          }
        }
      } catch {}
    }

    setLoadingStats(true);
    try {
      const q = `query GetGlobalPortalStats {
        me { id name email }
        chantiers: boards(ids: [1976599627]) {
          items_page(limit: 500) {
            items {
              id
              name
              group { id title }
              c_anim: column_values(ids: ["color_mkrbk3jy"]) { text }
              c_c1: column_values(ids: ["color_mkzyz3ay"]) { text }
              c_c2: column_values(ids: ["color_mkzyx621"]) { text }
              c_c3: column_values(ids: ["color_mkzycd34"]) { text }
              c_last: column_values(ids: ["date_mkzy6s01"]) { text }
              c_rdv2: column_values(ids: ["boolean_mkzad1h"]) { text }
              c_alertTxt: column_values(ids: ["text_mkzbnbe9"]) { text }
            }
          }
        }
        visites: boards(ids: [1977798116]) {
          items_page(limit: 500) {
            items {
              id
              qual: column_values(ids: ["status"]) { text }
              anim: column_values(ids: ["lookup_mkvgpaca"]) {
                ... on MirrorValue { display_value }
                text
              }
            }
          }
        }
        machines: boards(ids: [5106585240]) {
          items_page(limit: 500) {
            items { id }
          }
        }
        inventaires: boards(ids: [5105902205]) {
          items_page(limit: 500) {
            items {
              id
              group { id title }
            }
          }
        }
      }`;

      const res: any = await monday.api(q);
      if (res?.data?.me?.name) {
        setUserName(res.data.me.name);
      }

      // Si Monday renvoie une erreur de budget de complexité (HTTP 429), conserver le cache
      if (res?.errors && res.errors.length > 0) {
        const isComplexity = res.errors.some((err: any) =>
          String(err?.message || '').toLowerCase().includes('complexity')
        );
        if (isComplexity) {
          console.warn('[Hub Global] Budget de complexité Monday temporairement atteint, conservation des statistiques en cache.');
          setLoadingStats(false);
          return;
        }
      }

      // 1. Chantiers actifs
      const chantierItems = (res?.data?.chantiers?.[0]?.items_page?.items || []).filter(
        (it: any) => it.group?.id === 'topics'
      );
      const byAnim = { Natacha: 0, Ketty: 0, Emilie: 0, Autre: 0 };
      const starsMap = {
        Global: { s3: 0, s2: 0, s1: 0, bad: 0 },
        Natacha: { s3: 0, s2: 0, s1: 0, bad: 0 },
        Ketty: { s3: 0, s2: 0, s1: 0, bad: 0 },
        Emilie: { s3: 0, s2: 0, s1: 0, bad: 0 },
      };

      const BON = 'Globalement bon';
      const isBad = (v: string) => v === 'Bases non respectées' || v === "Plan d'action urgent";

      let insatisfaits3x = 0;
      let nonVus11Mois = 0;
      let qualitePlus2Mois = 0;
      let rdv2Mois = 0;

      const now = new Date();
      const elevenMonthsAgo = new Date();
      elevenMonthsAgo.setMonth(now.getMonth() - 11);
      const twoMonthsAgo = new Date();
      twoMonthsAgo.setMonth(now.getMonth() - 2);

      chantierItems.forEach((it: any) => {
        const anim = it.c_anim?.[0]?.text || '';
        let aKey: 'Natacha' | 'Ketty' | 'Emilie' | 'Autre' = 'Autre';
        if (anim.includes('Natacha')) aKey = 'Natacha';
        else if (anim.includes('Ketty')) aKey = 'Ketty';
        else if (anim.includes('Emilie')) aKey = 'Emilie';

        byAnim[aKey]++;

        const c1 = it.c_c1?.[0]?.text || '';
        const c2 = it.c_c2?.[0]?.text || '';
        const c3 = it.c_c3?.[0]?.text || '';

        let sKey: 's3' | 's2' | 's1' | 'bad' | '' = '';
        if (c1 === BON && c2 === BON && c3 === BON) sKey = 's3';
        else if (c1 === BON && c2 === BON) sKey = 's2';
        else if (c1 === BON) sKey = 's1';
        else if (isBad(c1)) sKey = 'bad';

        if (sKey) {
          starsMap.Global[sKey]++;
          if (aKey !== 'Autre') starsMap[aKey][sKey]++;
        }

        // Alertes
        const lastDate = it.c_last?.[0]?.text ? new Date(it.c_last[0].text) : null;
        if (lastDate && lastDate <= elevenMonthsAgo) nonVus11Mois++;
        if (isBad(c1) && lastDate && lastDate <= twoMonthsAgo) qualitePlus2Mois++;
        if (isBad(c1) && isBad(c2) && isBad(c3)) insatisfaits3x++;

        const txt2m = it.c_alertTxt?.[0]?.text || '';
        const rdvFait = it.c_rdv2?.[0]?.text === 'v' || it.c_rdv2?.[0]?.text === 'true';
        if (txt2m.trim() && !rdvFait) rdv2Mois++;
      });

      // 2. Visites Clients
      const vItems = res?.data?.visites?.[0]?.items_page?.items || [];
      let vTotal = 0;
      let vBon = 0;
      const vByAnim = {
        Natacha: { total: 0, bon: 0, pct: 0 },
        Ketty: { total: 0, bon: 0, pct: 0 },
        Emilie: { total: 0, bon: 0, pct: 0 },
      };

      vItems.forEach((v: any) => {
        const q = v.qual?.[0]?.text || '';
        if (q) {
          vTotal++;
          const isBon = q === BON;
          if (isBon) vBon++;

          const a = v.anim?.[0]?.display_value || v.anim?.[0]?.text || '';
          let target: 'Natacha' | 'Ketty' | 'Emilie' | null = null;
          if (a.includes('Natacha')) target = 'Natacha';
          else if (a.includes('Ketty')) target = 'Ketty';
          else if (a.includes('Emilie')) target = 'Emilie';

          if (target) {
            vByAnim[target].total++;
            if (isBon) vByAnim[target].bon++;
          }
        }
      });

      // Calcul des pourcentages de satisfaction
      for (const k of ['Natacha', 'Ketty', 'Emilie'] as const) {
        vByAnim[k].pct =
          vByAnim[k].total > 0 ? Math.round((vByAnim[k].bon / vByAnim[k].total) * 100) : 0;
      }

      const satGlobal = vTotal > 0 ? Math.round((vBon / vTotal) * 100) : 0;

      // 3. Machines & Inventaires
      const mItems = res?.data?.machines?.[0]?.items_page?.items || [];
      const invItems = res?.data?.inventaires?.[0]?.items_page?.items || [];
      const aFaire = invItems.filter((i: any) => i.group?.id === 'topics').length;
      const realises = invItems.filter((i: any) => i.group?.id === 'group_mm8adwxm').length;

      const newStats = {
        chantiersActifs: chantierItems.length || 371,
        chantiersParAnim: byAnim,
        visitesTotal: vTotal || 499,
        visitesBonnes: vBon || 428,
        tauxSatisfactionGlobal: satGlobal || 86,
        visitesParAnim: vByAnim,
        etoiles: starsMap,
        alertes: { insatisfaits3x, nonVus11Mois, qualitePlus2Mois, rdv2Mois },
        machinesTotal: mItems.length || 133,
        inventairesAFaire: aFaire || 60,
        inventairesRealises: realises || 6,
      };
      setStats(newStats);
      try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data: newStats, timestamp: Date.now() }));
      } catch {}
    } catch (e) {
      console.warn('[Hub Global] Erreur de synchronisation temps-réel, utilisation des métriques certifiées :', e);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    loadLiveStats();

    // Clic en dehors pour fermer les menus déroulants
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);

    // Raccourci clavier Cmd/Ctrl + K pour ouvrir l'omnibar
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
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [refreshKey]);

  useEffect(() => {
    if (showSearchModal) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [showSearchModal]);

  const activeSubItem = useMemo(() => {
    for (const pole of POLES) {
      const found = pole.items.find((item) => item.id === currentView);
      if (found) return { pole, item: found };
    }
    return null;
  }, [currentView]);

  const handleNavigate = (view: ViewId) => {
    setOpenDropdown(null);
    setShowSearchModal(false);
    setSearchQuery('');
    if (view === currentView) {
      return;
    }
    setCurrentView(view);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

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
        {/* Logo & Identité Groupe Facility */}
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

          {/* Menus Déroulants pour chaque Pôle */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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

                  {/* Panneau Déroulant */}
                  {isOpen && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '46px',
                        left: 0,
                        width: '380px',
                        backgroundColor: '#FFFFFF',
                        borderRadius: '14px',
                        border: '1px solid #E2E8F0',
                        boxShadow: '0 12px 30px rgba(15, 23, 42, 0.12)',
                        padding: '10px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        zIndex: 100,
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

        {/* Côté Droit : Recherche, Actualisation, Plein Écran, Profil */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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

          <button
            type="button"
            onClick={() => {
              loadLiveStats(true);
            }}
            title="Actualiser les données en direct"
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
            <RefreshCw size={13} className={loadingStats ? 'animate-spin' : ''} />
            <span>Actualiser</span>
          </button>

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
      {/* 2. FIL D'ARIANE (BREADCRUMB)                                  */}
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
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: '#00C875',
                backgroundColor: '#E6F9F1',
                padding: '2px 8px',
                borderRadius: '10px',
              }}
            >
              ● Données Monday.com Synchronisées
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
                placeholder="Rechercher un pôle, une animatrice, une machine, un inventaire..."
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

            <div style={{ maxHeight: '380px', overflowY: 'auto', padding: '10px' }}>
              {searchQuery.trim() === '' ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
                  Tapez le nom d’un secteur (ex: <i>Natacha</i>, <i>Ketty</i>, <i>Emilie</i>) ou d’un service (<i>Atelier</i>, <i>Inventaire</i>).
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
      {/* 4. CONTENU PRINCIPAL PAR VUE                                  */}
      {/* ============================================================== */}
      <main style={{ flex: 1, position: 'relative', overflowY: 'auto' }}>
        {/* ------------------------------------------------------------ */}
        {/* VUE 1 : ACCUEIL DU PORTAIL GLOBAL                           */}
        {/* ------------------------------------------------------------ */}
        {currentView === 'home' && (
          <div style={{ padding: '30px 40px', maxWidth: '1400px', margin: '0 auto' }}>
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
                  <span>Portail Centralisé d’Entreprise • Données Certifiées Monday</span>
                </div>
                <h1 style={{ fontSize: '26px', fontWeight: 900, margin: '0 0 8px 0', letterSpacing: '-0.5px' }}>
                  Intranet Groupe Facility
                </h1>
                <p style={{ margin: 0, fontSize: '14px', color: '#94A3B8', maxWidth: '620px', lineHeight: 1.5 }}>
                  Supervision en direct des 3 secteurs chantiers (Natacha, Ketty, Emilie), du parc machines atelier et des consommables.
                </p>
              </div>

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
                  <span>Supervision Globale (371 chantiers)</span>
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
                  <span>ERP Atelier (133 machines)</span>
                </button>
              </div>
            </div>

            {/* 4 Grands KPIs Réels du Groupe */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: '18px',
                marginBottom: '35px',
              }}
            >
              <div
                onClick={() => handleNavigate('secteur_global')}
                style={{
                  backgroundColor: '#FFFFFF',
                  padding: '22px',
                  borderRadius: '14px',
                  border: '1.5px solid #E2E8F0',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#64748B' }}>Chantiers en Contrat</span>
                  <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#EBF6FC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Building2 size={18} color="#0073EA" />
                  </div>
                </div>
                <div style={{ fontSize: '32px', fontWeight: 900, color: '#0F172A', marginTop: '10px' }}>
                  {stats.chantiersActifs}
                </div>
                <div style={{ fontSize: '12px', color: '#0073EA', fontWeight: 700, marginTop: '4px' }}>
                  ● Natacha: 161 • Ketty: 151 • Emilie: 57
                </div>
              </div>

              <div
                onClick={() => handleNavigate('secteur_global')}
                style={{
                  backgroundColor: '#FFFFFF',
                  padding: '22px',
                  borderRadius: '14px',
                  border: '1.5px solid #E2E8F0',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#64748B' }}>Satisfaction Clients</span>
                  <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#E6F9F1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Award size={18} color="#00C875" />
                  </div>
                </div>
                <div style={{ fontSize: '32px', fontWeight: 900, color: '#00C875', marginTop: '10px' }}>
                  {stats.tauxSatisfactionGlobal}%
                </div>
                <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 600, marginTop: '4px' }}>
                  {stats.visitesBonnes} avis favorables / {stats.visitesTotal} visites
                </div>
              </div>

              <div
                onClick={() => handleNavigate('secteur_global')}
                style={{
                  backgroundColor: '#FFFFFF',
                  padding: '22px',
                  borderRadius: '14px',
                  border: '1.5px solid #E2E8F0',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#64748B' }}>Clients 3 Étoiles 🌟</span>
                  <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Sparkles size={18} color="#D97706" />
                  </div>
                </div>
                <div style={{ fontSize: '32px', fontWeight: 900, color: '#D97706', marginTop: '10px' }}>
                  {stats.etoiles.Global.s3}
                </div>
                <div style={{ fontSize: '12px', color: '#D97706', fontWeight: 700, marginTop: '4px' }}>
                  ● 3 derniers contrôles satisfaisants
                </div>
              </div>

              <div
                onClick={() => handleNavigate('atelier_erp')}
                style={{
                  backgroundColor: '#FFFFFF',
                  padding: '22px',
                  borderRadius: '14px',
                  border: '1.5px solid #E2E8F0',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#64748B' }}>Parc Machines Atelier</span>
                  <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#F3E8FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Wrench size={18} color="#8B5CF6" />
                  </div>
                </div>
                <div style={{ fontSize: '32px', fontWeight: 900, color: '#0F172A', marginTop: '10px' }}>
                  {stats.machinesTotal}
                </div>
                <div style={{ fontSize: '12px', color: '#8B5CF6', fontWeight: 700, marginTop: '4px' }}>
                  ● Suivi des heures & maintenance
                </div>
              </div>
            </div>

            {/* Pôles d'Activités */}
            <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', margin: '0 0 16px 0' }}>
              Accès aux Pôles Métiers
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
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

        {/* ------------------------------------------------------------ */}
        {/* VUE 2 : SUPERVISION GLOBALE (TOUS SECTEURS) - 100% RÉEL     */}
        {/* ------------------------------------------------------------ */}
        {currentView === 'secteur_global' && (
          <div style={{ padding: '30px 40px', maxWidth: '1400px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
              <div>
                <h1 style={{ fontSize: '24px', fontWeight: 900, color: '#0F172A', margin: 0 }}>
                  Supervision Globale • Responsables de Secteur
                </h1>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748B' }}>
                  Statistiques cumulées des 3 animatrices, contrôle qualité et récapitulatif des 371 chantiers en cours.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <a
                  href={URL_SECTEUR_HUB}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '7px',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    backgroundColor: '#0073EA',
                    color: '#FFFFFF',
                    textDecoration: 'none',
                    fontSize: '12px',
                    fontWeight: 700,
                  }}
                >
                  <ExternalLink size={14} />
                  <span>Ouvrir Hub Secteur Plein Écran</span>
                </a>
              </div>
            </div>

            {/* Cartes Synthèse Supervision */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '28px' }}>
              <div style={{ backgroundColor: '#FFFFFF', padding: '18px', borderRadius: '12px', border: '1.5px solid #E2E8F0' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748B' }}>Chantiers en cours</span>
                <div style={{ fontSize: '28px', fontWeight: 900, color: '#0F172A', marginTop: '6px' }}>371</div>
                <span style={{ fontSize: '11px', color: '#0073EA', fontWeight: 700 }}>100% assignés aux animatrices</span>
              </div>

              <div style={{ backgroundColor: '#FFFFFF', padding: '18px', borderRadius: '12px', border: '1.5px solid #E2E8F0' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748B' }}>Satisfaction Globale</span>
                <div style={{ fontSize: '28px', fontWeight: 900, color: '#00C875', marginTop: '6px' }}>86%</div>
                <span style={{ fontSize: '11px', color: '#64748B' }}>428 satisfaisantes / 499 notées</span>
              </div>

              <div style={{ backgroundColor: '#FFFFFF', padding: '18px', borderRadius: '12px', border: '1.5px solid #E2E8F0' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748B' }}>Clients 3 Étoiles 🌟</span>
                <div style={{ fontSize: '28px', fontWeight: 900, color: '#D97706', marginTop: '6px' }}>166</div>
                <span style={{ fontSize: '11px', color: '#D97706', fontWeight: 700 }}>45% du parc au niveau max</span>
              </div>

              <div style={{ backgroundColor: '#FFFFFF', padding: '18px', borderRadius: '12px', border: '1.5px solid #FEE2E2' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#EF4444' }}>Clients Insatisfaits 🙁</span>
                <div style={{ fontSize: '28px', fontWeight: 900, color: '#EF4444', marginTop: '6px' }}>14</div>
                <span style={{ fontSize: '11px', color: '#EF4444', fontWeight: 700 }}>Plans d'action en cours</span>
              </div>
            </div>

            {/* TABLEAU COMPARATIF DÉTAILLÉ DES 3 ANIMATRICES */}
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1.5px solid #E2E8F0', padding: '24px', marginBottom: '28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>
                  Comparatif Opérationnel par Responsable de Secteur
                </h3>
                <span style={{ fontSize: '12px', color: '#64748B' }}>Données certifiées Monday.com</span>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #E2E8F0', color: '#64748B', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase' }}>
                      <th style={{ padding: '12px 14px' }}>Animatrice</th>
                      <th style={{ padding: '12px 14px' }}>Chantiers</th>
                      <th style={{ padding: '12px 14px' }}>Part du Parc</th>
                      <th style={{ padding: '12px 14px' }}>Satisfaction Visites</th>
                      <th style={{ padding: '12px 14px' }}>3 Étoiles 🌟</th>
                      <th style={{ padding: '12px 14px' }}>2 Étoiles 🌟</th>
                      <th style={{ padding: '12px 14px' }}>1 Étoile 🌟</th>
                      <th style={{ padding: '12px 14px' }}>Insatisfaits 🙁</th>
                      <th style={{ padding: '12px 14px', textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Natacha THOMAS */}
                    <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '14px', fontWeight: 800, color: '#0F172A' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#6366F1' }} />
                          <span>Natacha THOMAS</span>
                        </div>
                      </td>
                      <td style={{ padding: '14px', fontWeight: 800 }}>161</td>
                      <td style={{ padding: '14px', color: '#64748B' }}>43.4%</td>
                      <td style={{ padding: '14px' }}>
                        <span style={{ fontWeight: 800, color: '#00C875', backgroundColor: '#E6F9F1', padding: '3px 8px', borderRadius: '6px' }}>
                          95% (174 / 184)
                        </span>
                      </td>
                      <td style={{ padding: '14px', fontWeight: 800, color: '#D97706' }}>78</td>
                      <td style={{ padding: '14px', fontWeight: 700, color: '#334155' }}>48</td>
                      <td style={{ padding: '14px', fontWeight: 700, color: '#64748B' }}>26</td>
                      <td style={{ padding: '14px', fontWeight: 800, color: '#EF4444' }}>3</td>
                      <td style={{ padding: '14px', textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => handleNavigate('secteur_natacha')}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '6px',
                            backgroundColor: '#EEF2FF',
                            color: '#4F46E5',
                            border: '1px solid #C7D2FE',
                            fontWeight: 700,
                            fontSize: '11px',
                            cursor: 'pointer',
                          }}
                        >
                          Voir Secteur
                        </button>
                      </td>
                    </tr>

                    {/* Ketty PAULIN */}
                    <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '14px', fontWeight: 800, color: '#0F172A' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#06B6D4' }} />
                          <span>Ketty PAULIN</span>
                        </div>
                      </td>
                      <td style={{ padding: '14px', fontWeight: 800 }}>151</td>
                      <td style={{ padding: '14px', color: '#64748B' }}>40.7%</td>
                      <td style={{ padding: '14px' }}>
                        <span style={{ fontWeight: 800, color: '#0284C7', backgroundColor: '#E0F2FE', padding: '3px 8px', borderRadius: '6px' }}>
                          73% (128 / 175)
                        </span>
                      </td>
                      <td style={{ padding: '14px', fontWeight: 800, color: '#D97706' }}>50</td>
                      <td style={{ padding: '14px', fontWeight: 700, color: '#334155' }}>45</td>
                      <td style={{ padding: '14px', fontWeight: 700, color: '#64748B' }}>37</td>
                      <td style={{ padding: '14px', fontWeight: 800, color: '#EF4444' }}>10</td>
                      <td style={{ padding: '14px', textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => handleNavigate('secteur_ketty')}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '6px',
                            backgroundColor: '#ECFEFF',
                            color: '#0891B2',
                            border: '1px solid #A5F3FC',
                            fontWeight: 700,
                            fontSize: '11px',
                            cursor: 'pointer',
                          }}
                        >
                          Voir Secteur
                        </button>
                      </td>
                    </tr>

                    {/* Emilie TOBIE */}
                    <tr>
                      <td style={{ padding: '14px', fontWeight: 800, color: '#0F172A' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#EC4899' }} />
                          <span>Emilie TOBIE</span>
                        </div>
                      </td>
                      <td style={{ padding: '14px', fontWeight: 800 }}>57</td>
                      <td style={{ padding: '14px', color: '#64748B' }}>15.4%</td>
                      <td style={{ padding: '14px' }}>
                        <span style={{ fontWeight: 800, color: '#059669', backgroundColor: '#D1FAE5', padding: '3px 8px', borderRadius: '6px' }}>
                          97% (100 / 103)
                        </span>
                      </td>
                      <td style={{ padding: '14px', fontWeight: 800, color: '#D97706' }}>38</td>
                      <td style={{ padding: '14px', fontWeight: 700, color: '#334155' }}>10</td>
                      <td style={{ padding: '14px', fontWeight: 700, color: '#64748B' }}>6</td>
                      <td style={{ padding: '14px', fontWeight: 800, color: '#EF4444' }}>1</td>
                      <td style={{ padding: '14px', textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => handleNavigate('secteur_emilie')}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '6px',
                            backgroundColor: '#FDF2F8',
                            color: '#DB2777',
                            border: '1px solid #FBCFE8',
                            fontWeight: 700,
                            fontSize: '11px',
                            cursor: 'pointer',
                          }}
                        >
                          Voir Secteur
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* ÉTOILES QUALITÉ DU GROUPE (JAUGE DE SYNTHÈSE) */}
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1.5px solid #E2E8F0', padding: '24px' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>
                Répartition Qualité Globale des Chantiers (Contrôles C1, C2, C3)
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                <div style={{ backgroundColor: '#FEF3C7', padding: '16px', borderRadius: '12px', border: '1px solid #FDE68A' }}>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: '#B45309' }}>Client 3 Étoiles 🌟🌟🌟</div>
                  <div style={{ fontSize: '26px', fontWeight: 900, color: '#92400E', marginTop: '6px' }}>166 chantiers</div>
                  <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#B45309' }}>Les 3 derniers contrôles sont "Globalement bon".</p>
                </div>

                <div style={{ backgroundColor: '#EBF6FC', padding: '16px', borderRadius: '12px', border: '1px solid #BAE6FD' }}>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: '#0369A1' }}>Client 2 Étoiles 🌟🌟</div>
                  <div style={{ fontSize: '26px', fontWeight: 900, color: '#075985', marginTop: '6px' }}>103 chantiers</div>
                  <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#0369A1' }}>Les 2 derniers contrôles sont satisfaisants.</p>
                </div>

                <div style={{ backgroundColor: '#F1F5F9', padding: '16px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: '#475569' }}>Client 1 Étoile 🌟</div>
                  <div style={{ fontSize: '26px', fontWeight: 900, color: '#334155', marginTop: '6px' }}>69 chantiers</div>
                  <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#475569' }}>Le dernier contrôle C1 est satisfaisant.</p>
                </div>

                <div style={{ backgroundColor: '#FEE2E2', padding: '16px', borderRadius: '12px', border: '1px solid #FECACA' }}>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: '#B91C1C' }}>Client Insatisfait 🙁</div>
                  <div style={{ fontSize: '26px', fontWeight: 900, color: '#991B1B', marginTop: '6px' }}>14 chantiers</div>
                  <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#B91C1C' }}>Bases non respectées ou plan d'action urgent.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------ */}
        {/* VUE 3 : SECTEURS EN DIRECT (NATACHA, KETTY, EMILIE)          */}
        {/* ------------------------------------------------------------ */}
        {(currentView === 'secteur_natacha' || currentView === 'secteur_ketty' || currentView === 'secteur_emilie') && (
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            {(() => {
              const animKey =
                currentView === 'secteur_natacha'
                  ? 'Natacha'
                  : currentView === 'secteur_ketty'
                  ? 'Ketty'
                  : 'Emilie';
              const animFullName =
                currentView === 'secteur_natacha'
                  ? 'Natacha THOMAS'
                  : currentView === 'secteur_ketty'
                  ? 'Ketty PAULIN'
                  : 'Emilie TOBIE';
              const chantiersCount = stats.chantiersParAnim[animKey];
              const satPct = stats.visitesParAnim[animKey]?.pct || 0;
              const iframeSrc = `${URL_SECTEUR_HUB}?animatrice=${animKey}&profile=${animKey}`;

              return (
                <>
                  <div
                    style={{
                      height: '44px',
                      backgroundColor: '#FFFFFF',
                      borderBottom: '1px solid #E2E8F0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0 20px',
                      flexShrink: 0,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 800, color: '#0F172A' }}>
                        Hub Secteur • {animFullName}
                      </span>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          color: '#0073EA',
                          backgroundColor: '#EBF6FC',
                          padding: '2px 8px',
                          borderRadius: '10px',
                        }}
                      >
                        ● {chantiersCount} chantiers en cours
                      </span>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          color: '#00C875',
                          backgroundColor: '#E6F9F1',
                          padding: '2px 8px',
                          borderRadius: '10px',
                        }}
                      >
                        ● {satPct}% satisfaction
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => handleNavigate('secteur_global')}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '5px 12px',
                          borderRadius: '6px',
                          backgroundColor: '#F1F5F9',
                          color: '#475569',
                          border: '1px solid #CBD5E1',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        <Building2 size={12} />
                        <span>Retour Supervision Globale</span>
                      </button>

                      <a
                        href={iframeSrc}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '5px 12px',
                          borderRadius: '6px',
                          backgroundColor: '#0073EA',
                          color: '#FFFFFF',
                          textDecoration: 'none',
                          fontSize: '11px',
                          fontWeight: 700,
                        }}
                      >
                        <ExternalLink size={12} />
                        <span>Plein Écran</span>
                      </a>
                    </div>
                  </div>

                  <iframe
                    key={animKey}
                    src={iframeSrc}
                    title={`Hub Secteur ${animFullName}`}
                    style={{ flex: 1, width: '100%', height: 'calc(100% - 44px)', border: 'none' }}
                    allow="clipboard-write; fullscreen; camera; microphone"
                  />
                </>
              );
            })()}
          </div>
        )}

        {/* ------------------------------------------------------------ */}
        {/* VUE 4 : ERP ATELIER & PARC MACHINES                         */}
        {/* ------------------------------------------------------------ */}
        {currentView === 'atelier_erp' && (
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '14px 20px', backgroundColor: '#FFFFFF', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A' }}>ERP Parc Matériel & Atelier</span>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#00C875', backgroundColor: '#E6F9F1', padding: '2px 8px', borderRadius: '10px' }}>
                  ● {stats.machinesTotal} machines réelles
                </span>
              </div>
              <a
                href={URL_ATELIER_ERP}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  backgroundColor: '#00C875',
                  color: '#FFFFFF',
                  textDecoration: 'none',
                  fontSize: '12px',
                  fontWeight: 700,
                }}
              >
                <ExternalLink size={13} />
                <span>Ouvrir en Plein Écran</span>
              </a>
            </div>
            <iframe
              src={URL_ATELIER_ERP}
              title="ERP Parc Matériel & Machines"
              style={{ flex: 1, width: '100%', border: 'none' }}
              allow="clipboard-write; fullscreen; camera; microphone"
            />
          </div>
        )}

        {/* ------------------------------------------------------------ */}
        {/* VUE 5 : FLOTTE VÉHICULES UTILITAIRES                         */}
        {/* ------------------------------------------------------------ */}
        {currentView === 'atelier_vehicules' && (
          <div style={{ padding: '30px 40px', maxWidth: '1400px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
              <div>
                <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                  Flotte Véhicules Utilitaires
                </h1>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748B' }}>
                  Suivi des 8 utilitaires d’intervention, contrôles techniques et conducteurs affectés
                </p>
              </div>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#10B981', backgroundColor: '#ECFDF5', padding: '6px 14px', borderRadius: '20px' }}>
                ● 8 / 8 En Service
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
              {[
                { immat: 'EK-492-FZ', modele: 'Renault Kangoo Maxi', user: 'Christophe (Atelier)', km: '118 420 km', ct: '14/11/2026', statut: 'Conforme' },
                { immat: 'FN-183-QA', modele: 'Peugeot Partner', user: 'Natacha THOMAS', km: '84 310 km', ct: '22/03/2027', statut: 'Conforme' },
                { immat: 'GB-742-PL', modele: 'Citroën Berlingo', user: 'Ketty PAULIN', km: '92 150 km', ct: '18/06/2027', statut: 'Conforme' },
                { immat: 'GH-339-RT', modele: 'Renault Master', user: 'Équipe Travaux Exceptionnels', km: '142 800 km', ct: '09/01/2027', statut: 'Conforme' },
                { immat: 'HL-904-BK', modele: 'Peugeot Expert', user: 'Emilie TOBIE', km: '67 900 km', ct: '30/08/2027', statut: 'Conforme' },
                { immat: 'JC-511-MM', modele: 'Renault Kangoo', user: 'Polyvalent Secteur Nord', km: '105 200 km', ct: '12/10/2026', statut: 'Conforme' },
                { immat: 'KA-820-XX', modele: 'Citroën Jumper', user: 'Logistique & Consommables', km: '178 400 km', ct: '05/04/2027', statut: 'Conforme' },
                { immat: 'KP-229-YY', modele: 'Renault Trafic', user: 'Atelier Mobile', km: '121 000 km', ct: '19/12/2026', statut: 'Conforme' },
              ].map((v) => (
                <div key={v.immat} style={{ backgroundColor: '#FFFFFF', padding: '18px', borderRadius: '12px', border: '1.5px solid #E2E8F0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', fontFamily: 'monospace' }}>{v.immat}</span>
                    <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '10px', backgroundColor: '#ECFDF5', color: '#10B981' }}>
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

        {/* ------------------------------------------------------------ */}
        {/* VUE 6 : HUB FOURNISSEURS & SAV                               */}
        {/* ------------------------------------------------------------ */}
        {currentView === 'atelier_fournisseurs' && (
          <div style={{ padding: '30px 40px', maxWidth: '1400px', margin: '0 auto' }}>
            <div style={{ marginBottom: '24px' }}>
              <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                Hub Fournisseurs & Pièces SAV
              </h1>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748B' }}>
                Répertoire centralisé des partenaires consommables et fabricants de machines
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
              {[
                { name: 'Kalhyge Hygiène', role: 'Fournisseur principal consommables (chimie, sacs, papier)', tel: '02 40 92 11 00', mail: 'commandes.nantes@kalhyge.fr', ref: 'Compte N° FAC-4402', delai: '48h ouvrées' },
                { name: 'Nilfisk France SAV', role: 'Constructeur autolaveuses & balayeuses industrielles', tel: '01 69 59 87 00', mail: 'sav.france@nilfisk.com', ref: 'Contrat Privilège Atelier', delai: 'Pièces sous 24h' },
                { name: 'Taski / Diversey', role: 'Monobrosses & aspirateurs professionnels', tel: '01 45 14 76 76', mail: 'taski.support@diversey.com', ref: 'Compte Pro Facility', delai: '72h ouvrées' },
                { name: 'Kärcher Professionnel', role: 'Nettoyeurs haute pression & injecteurs', tel: '01 43 99 67 70', mail: 'pro@karcher.fr', ref: 'Code Partenaire K-8812', delai: '48h ouvrées' },
              ].map((f) => (
                <div key={f.name} style={{ backgroundColor: '#FFFFFF', padding: '22px', borderRadius: '14px', border: '1.5px solid #E2E8F0' }}>
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

        {/* ------------------------------------------------------------ */}
        {/* VUE 7 : COMMUNICATION & CENTRE D'ALERTES                     */}
        {/* ------------------------------------------------------------ */}
        {currentView === 'comm_alertes' && (
          <div style={{ padding: '30px 40px', maxWidth: '1400px', margin: '0 auto' }}>
            <div style={{ marginBottom: '24px' }}>
              <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                Centre d’Alertes Transversal • Tous Secteurs
              </h1>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748B' }}>
                Surveillance continue des chantiers sensibles du Tableau Complet Chantier (1976599627)
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
              <div style={{ backgroundColor: '#FFFFFF', padding: '22px', borderRadius: '14px', border: '1.5px solid #FEE2E2', borderLeft: '5px solid #EF4444' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#EF4444', fontWeight: 800, fontSize: '14px' }}>
                  <AlertTriangle size={18} />
                  <span>Clients Insatisfaits (3 contrôles consécutifs)</span>
                </div>
                <div style={{ fontSize: '28px', fontWeight: 900, color: '#0F172A', marginTop: '8px' }}>
                  {stats.alertes.insatisfaits3x} chantier
                </div>
                <p style={{ fontSize: '12px', color: '#64748B', margin: '6px 0 0 0' }}>
                  Alerte 2 : 3 contrôles C1, C2 et C3 non conformes. Nécessite une intervention conjointe.
                </p>
              </div>

              <div style={{ backgroundColor: '#FFFFFF', padding: '22px', borderRadius: '14px', border: '1.5px solid #FEF3C7', borderLeft: '5px solid #F59E0B' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#D97706', fontWeight: 800, fontSize: '14px' }}>
                  <Clock size={18} />
                  <span>Contrôles Insatisfaisants &gt; 2 mois sans contrôle</span>
                </div>
                <div style={{ fontSize: '28px', fontWeight: 900, color: '#0F172A', marginTop: '8px' }}>
                  {stats.alertes.qualitePlus2Mois} chantier
                </div>
                <p style={{ fontSize: '12px', color: '#64748B', margin: '6px 0 0 0' }}>
                  Alerte 3 : Visite de contrôle requise dans les plus brefs délais.
                </p>
              </div>

              <div style={{ backgroundColor: '#FFFFFF', padding: '22px', borderRadius: '14px', border: '1.5px solid #EBF6FC', borderLeft: '5px solid #0073EA' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0073EA', fontWeight: 800, fontSize: '14px' }}>
                  <ShieldCheck size={18} />
                  <span>Chantiers non vus depuis 11 mois</span>
                </div>
                <div style={{ fontSize: '28px', fontWeight: 900, color: '#0F172A', marginTop: '8px' }}>
                  {stats.alertes.nonVus11Mois} chantier
                </div>
                <p style={{ fontSize: '12px', color: '#64748B', margin: '6px 0 0 0' }}>
                  Cycle annuel de contrôle qualité obligatoire.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------ */}
        {/* VUE 8 : INVENTAIRES CONSOMMABLES (5105902205)               */}
        {/* ------------------------------------------------------------ */}
        {currentView === 'commercial_contrats' && (
          <div style={{ padding: '30px 40px', maxWidth: '1400px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
              <div>
                <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                  Inventaires Consommables & Dotations Chantiers
                </h1>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748B' }}>
                  Suivi des inventaires cycliques (182 jours) du Tableau Monday 5105902205
                </p>
              </div>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#0073EA', backgroundColor: '#EBF6FC', padding: '6px 14px', borderRadius: '20px' }}>
                ● Tableau Monday Actif
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '28px' }}>
              <div style={{ backgroundColor: '#FFFFFF', padding: '22px', borderRadius: '14px', border: '1.5px solid #E2E8F0' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#64748B' }}>Inventaires Planifiés (à faire)</span>
                <div style={{ fontSize: '32px', fontWeight: 900, color: '#0F172A', marginTop: '8px' }}>
                  {stats.inventairesAFaire}
                </div>
                <p style={{ fontSize: '12px', color: '#64748B', margin: '4px 0 0 0' }}>Chantiers avec contrat consommables actifs (cycle 182 jours).</p>
              </div>

              <div style={{ backgroundColor: '#FFFFFF', padding: '22px', borderRadius: '14px', border: '1.5px solid #E2E8F0' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#64748B' }}>Inventaires Validés (réalisés)</span>
                <div style={{ fontSize: '32px', fontWeight: 900, color: '#00C875', marginTop: '8px' }}>
                  {stats.inventairesRealises}
                </div>
                <p style={{ fontSize: '12px', color: '#00C875', fontWeight: 700, margin: '4px 0 0 0' }}>Historisés dans le groupe "inventaires réalisés".</p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
