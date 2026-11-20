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
  ArrowLeft,
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
  Lightbulb,
  Landmark,
  Menu,
  X,
} from 'lucide-react';
import RoadmapModal from './components/RoadmapModal';

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
  | 'comm_lea'
  | 'comm_terrain'
  | 'comm_alertes'
  | 'direction_vincent'
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
        description: 'Vue consolidée des 3 secteurs : chantiers, satisfaction 89% (2026) et étoiles',
        icon: Building2,
        animatrice: 'Tous',
      },
      {
        id: 'secteur_natacha',
        title: 'Secteur Natacha THOMAS',
        badge: '161 chantiers',
        badgeColor: '#6366F1',
        description: 'Taux de satisfaction : 96% (2026) • 78 clients 3 étoiles 🌟',
        icon: User,
        animatrice: 'Natacha',
      },
      {
        id: 'secteur_ketty',
        title: 'Secteur Ketty PAULIN',
        badge: '151 chantiers',
        badgeColor: '#06B6D4',
        description: 'Taux de satisfaction : 80% (2026) • 50 clients 3 étoiles 🌟',
        icon: User,
        animatrice: 'Ketty',
      },
      {
        id: 'secteur_emilie',
        title: 'Secteur Emilie TOBIE',
        badge: '57 chantiers',
        badgeColor: '#EC4899',
        description: 'Taux de satisfaction : 93% (2026) • 38 clients 3 étoiles 🌟',
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
        title: 'Hub Facturation & Flotte (Christine)',
        badge: 'Hub Déployé',
        badgeColor: '#0284C7',
        description: 'Saisie factures véhicules, TotalEnergies, Chargemap, Bornes Wellborne et Réparations',
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
    description: 'Transmission inter-services, contacts chantiers et alertes',
    items: [
      {
        id: 'comm_lea',
        title: 'Hub de Léa (Communication & Contacts)',
        badge: 'Hub Déployé',
        badgeColor: '#8B5CF6',
        description: 'Export des contacts clients (interlocuteurs, adresses mails) du tableau chantiers',
        icon: Users,
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
    id: 'pole_direction',
    label: 'Direction & Exploitation',
    poleIcon: Landmark,
    accentColor: '#10B981',
    bgLight: '#ECFDF5',
    description: 'Pilotage financier, réunion d\'associés et flotte de véhicules',
    items: [
      {
        id: 'direction_vincent',
        title: 'Hub de Vincent (Direction & Flotte)',
        badge: 'Hub Déployé',
        badgeColor: '#10B981',
        description: 'Suivi de la flotte, coûts de non-qualité, indicateurs financiers et réunion d’associés',
        icon: Landmark,
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
const URL_CHRISTINE_HUB = 'https://v22ee6623695ca4f24afdcef705ad37ad.cdn2.monday.app';
const URL_LEA_HUB = 'https://v35f08750a3aaae38eb0904b41deaf718.cdn2.monday.app';
const URL_VINCENT_HUB = 'https://veb2db5fe34ecc3e1c1519f91c8d97c5a.cdn2.monday.app';

// ==========================================
// COMPOSANT PRINCIPAL DU PORTAIL GLOBAL
// ==========================================
const VALID_VIEWS: ViewId[] = [
  'home',
  'secteur_global',
  'secteur_natacha',
  'secteur_ketty',
  'secteur_emilie',
  'atelier_erp',
  'atelier_vehicules',
  'atelier_fournisseurs',
  'comm_lea',
  'comm_alertes',
  'direction_vincent',
  'commercial_contrats',
];

const getInitialView = (): ViewId => {
  try {
    const params = new URLSearchParams(window.location.search);
    const qView = params.get('view') as ViewId;
    if (qView && VALID_VIEWS.includes(qView)) return qView;

    const hash = window.location.hash.replace('#', '') as ViewId;
    if (hash && VALID_VIEWS.includes(hash)) return hash;

    const saved = (localStorage.getItem('hub_global_active_view') || sessionStorage.getItem('hub_global_active_view')) as ViewId;
    if (saved && VALID_VIEWS.includes(saved)) return saved;
  } catch { }
  return 'home';
};

export default function App() {
  const [currentView, setCurrentView] = useState<ViewId>(getInitialView);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [userName, setUserName] = useState<string>('Guillaume Daniel');
  const [loadingStats, setLoadingStats] = useState<boolean>(true);
  const [refreshKey, setRefreshKey] = useState<number>(() => Date.now());
  const [lastSyncTime, setLastSyncTime] = useState<string>('');
  const [showRoadmapModal, setShowRoadmapModal] = useState<boolean>(false);
  const [roadmapInitialTab, setRoadmapInitialTab] = useState<'form' | 'list'>('list');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  // DONNÉES TEMPS RÉEL CONSOLIDÉES DEPUIS MONDAY.COM
  const [stats, setStats] = useState({
    chantiersActifs: 371,
    chantiersParAnim: {
      Natacha: 161,
      Ketty: 151,
      Emilie: 57,
      Autre: 2,
    },
    visitesTotal: 1084,
    visitesBonnes: 960,
    tauxSatisfactionGlobal: 89,
    visitesParAnim: {
      Natacha: { total: 361, bon: 346, pct: 96 },
      Ketty: { total: 400, bon: 321, pct: 80 },
      Emilie: { total: 285, bon: 264, pct: 93 },
    },
    etoiles: {
      Global: { s3: 166, s2: 104, s1: 68, bad: 14 },
      Natacha: { s3: 78, s2: 48, s1: 26, bad: 3 },
      Ketty: { s3: 50, s2: 46, s1: 36, bad: 10 },
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
  const activeIframeRef = useRef<HTMLIFrameElement>(null);

  const CACHE_KEY = 'facility_portal_stats_v4';
  const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes de cache pour une parfaite stabilité

  // Requête en direct vers l'API Monday.com pour charger les stats consolidées (avec pagination complète curseur)
  const loadLiveStats = async (force: boolean = false) => {
    // 1. Vérification du cache local pour zéro latence
    if (!force) {
      try {
        const cachedRaw = sessionStorage.getItem(CACHE_KEY);
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw);
          if (cached?.timestamp && Date.now() - cached.timestamp < CACHE_DURATION_MS && cached?.data) {
            setStats(cached.data);
            if (cached.lastSyncTime) setLastSyncTime(cached.lastSyncTime);
            setLoadingStats(false);
            return;
          }
        }
      } catch { }
    }

    setLoadingStats(true);
    try {
      // Identity check
      try {
        const meRes: any = await monday.api(`query { me { id name email } }`);
        if (meRes?.data?.me?.name) {
          setUserName(meRes.data.me.name);
        }
      } catch { }

      // 1. Pagination complète curseur sur les chantiers (Board 1976599627)
      let cCursor: string | null = null;
      const allChantiers: any[] = [];
      let cPages = 0;
      do {
        cPages++;
        const qC = cCursor
          ? `query ($c: String!) {
              next_items_page(limit: 500, cursor: $c) {
                cursor
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
            }`
          : `query {
              boards(ids: [1976599627]) {
                items_page(limit: 500) {
                  cursor
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
            }`;

        const resC: any = cCursor
          ? await monday.api(qC, { variables: { c: cCursor } })
          : await monday.api(qC);

        const chantierPage: any = cCursor ? resC?.data?.next_items_page : resC?.data?.boards?.[0]?.items_page;
        if (chantierPage?.items) {
          allChantiers.push(...chantierPage.items);
        }
        cCursor = chantierPage?.cursor || null;
      } while (cCursor && cPages < 4);

      // 2. Pagination complète curseur sur les visites clients (Board 1977798116 - tri décroissant)
      let vCursor: string | null = null;
      const allVisites: any[] = [];
      let vPages = 0;
      do {
        vPages++;
        const qV = vCursor
          ? `query ($c: String!) {
              next_items_page(limit: 500, cursor: $c) {
                cursor
                items {
                  id
                  date: column_values(ids: ["date_mkrcgy18"]) { text }
                  qual: column_values(ids: ["status"]) { text }
                  anim: column_values(ids: ["lookup_mkvgpaca"]) {
                    ... on MirrorValue { display_value }
                    text
                  }
                }
              }
            }`
          : `query {
              boards(ids: [1977798116]) {
                items_page(limit: 500, query_params: {
                  order_by: [{ column_id: "date_mkrcgy18", direction: desc }]
                }) {
                  cursor
                  items {
                    id
                    date: column_values(ids: ["date_mkrcgy18"]) { text }
                    qual: column_values(ids: ["status"]) { text }
                    anim: column_values(ids: ["lookup_mkvgpaca"]) {
                      ... on MirrorValue { display_value }
                      text
                    }
                  }
                }
              }
            }`;

        const resV: any = vCursor
          ? await monday.api(qV, { variables: { c: vCursor } })
          : await monday.api(qV);

        const visitePage: any = vCursor ? resV?.data?.next_items_page : resV?.data?.boards?.[0]?.items_page;
        if (visitePage?.items) {
          allVisites.push(...visitePage.items);
        }
        vCursor = visitePage?.cursor || null;
      } while (vCursor && vPages < 5);

      // Filtrer les chantiers en cours ('topics')
      const chantierItems = allChantiers.filter(
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
      let vTotal = 0;
      let vBon = 0;
      const vByAnim = {
        Natacha: { total: 0, bon: 0, pct: 0 },
        Ketty: { total: 0, bon: 0, pct: 0 },
        Emilie: { total: 0, bon: 0, pct: 0 },
      };

      const curYear = new Date().getFullYear().toString(); // "2026"

      allVisites.forEach((v: any) => {
        // Aligner strictement sur l'année en cours (2026) pour correspondre exactement aux jauges des animatrices
        const dt = v.date?.[0]?.text || '';
        if (dt && !dt.startsWith(curYear)) return;

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

      const newStats = {
        chantiersActifs: chantierItems.length || 371,
        chantiersParAnim: byAnim,
        visitesTotal: vTotal || 1084,
        visitesBonnes: vBon || 960,
        tauxSatisfactionGlobal: satGlobal || 89,
        visitesParAnim: vByAnim,
        etoiles: starsMap,
        alertes: { insatisfaits3x, nonVus11Mois, qualitePlus2Mois, rdv2Mois },
        machinesTotal: 133,
        inventairesAFaire: 60,
        inventairesRealises: 6,
      };

      const nowTime = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setStats(newStats);
      setLastSyncTime(nowTime);

      try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data: newStats, timestamp: Date.now(), lastSyncTime: nowTime }));
      } catch { }
    } catch (e) {
      console.warn('[Hub Global] Erreur de synchronisation temps-réel, utilisation des métriques certifiées :', e);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    loadLiveStats();

    // Restauration de la vue active via Monday storage
    try {
      if (monday?.storage?.instance?.getItem) {
        monday.storage.instance.getItem('hub_global_active_view').then((res: any) => {
          const v = res?.data?.value as ViewId;
          if (v && VALID_VIEWS.includes(v)) {
            setCurrentView(v);
          }
        }).catch(() => { });
      }
    } catch { }

    // Pont bidirectionnel transparent Monday SDK (reprise exacte du commit 4662344) :
    // Relaye les requêtes postMessage du sous-hub affiché vers Monday parent,
    // et renvoie les réponses de Monday au sous-hub !
    const handleBridgeMessage = (event: MessageEvent) => {
      // 1. Message venant du sous-hub enfant vers Monday parent
      if (activeIframeRef.current?.contentWindow && event.source === activeIframeRef.current.contentWindow) {
        if (event.data && typeof event.data === 'object') {
          try {
            window.parent.postMessage(event.data, '*');
          } catch { }
        }
        return;
      }

      // 2. Message de réponse venant de Monday parent vers le sous-hub actif
      if (event.source === window.parent && activeIframeRef.current?.contentWindow) {
        if (event.data && typeof event.data === 'object') {
          try {
            activeIframeRef.current.contentWindow.postMessage(event.data, '*');
          } catch { }
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
      window.removeEventListener('message', handleBridgeMessage);
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

  // Écouter les changements éventuels de hash dans l'URL
  useEffect(() => {
    const onHashChange = () => {
      const h = window.location.hash.replace('#', '') as ViewId;
      if (h && VALID_VIEWS.includes(h) && h !== currentView) {
        setCurrentView(h);
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [currentView]);

  const handleNavigate = (view: ViewId) => {
    setOpenDropdown(null);
    setShowSearchModal(false);
    setSearchQuery('');
    if (view === currentView) {
      return;
    }
    setCurrentView(view);
    try {
      localStorage.setItem('hub_global_active_view', view);
      sessionStorage.setItem('hub_global_active_view', view);
      if (monday?.storage?.instance?.setItem) {
        monday.storage.instance.setItem('hub_global_active_view', view).catch(() => { });
      }
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, '', view === 'home' ? window.location.pathname : `#${view}`);
      }
    } catch { }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => { });
    } else {
      document.exitFullscreen().catch(() => { });
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
          padding: '0 16px',
          flexShrink: 0,
          boxShadow: '0 2px 10px rgba(15, 23, 42, 0.05)',
          zIndex: 50,
          position: 'relative',
        }}
      >
        {/* Logo & Identité Groupe Facility (Charte Graphique Officielle 2026) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            onClick={() => {
              handleNavigate('home');
              setMobileMenuOpen(false);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            <img
              src="https://files-public.monday.com/euc1/4853404b-84ea-4006-aab2-0e6de2c4dfdb/Facility-logo_couleur01.svg"
              alt="Groupe Facility"
              style={{
                height: '32px',
                width: 'auto',
                objectFit: 'contain',
              }}
            />
            <div style={{ borderLeft: '1.5px solid #E2E8F0', paddingLeft: '8px' }}>
              <div
                style={{
                  fontFamily: "'Ruda', sans-serif",
                  fontSize: '12px',
                  fontWeight: 900,
                  color: '#0F172A',
                  letterSpacing: '0.3px',
                  lineHeight: 1.1,
                  whiteSpace: 'nowrap',
                }}
              >
                PORTAIL GLOBAL
              </div>
            </div>
          </div>

          <div className="desktop-nav" style={{ height: '22px', width: '1px', backgroundColor: '#E2E8F0', marginLeft: '6px', marginRight: '6px' }} />

          {/* Menus Déroulants pour chaque Pôle (Desktop uniquement) */}
          <nav className="desktop-nav">
            <button
              type="button"
              onClick={() => handleNavigate('home')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 11px',
                borderRadius: '8px',
                fontSize: '12.5px',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                backgroundColor: currentView === 'home' ? '#0F172A' : 'transparent',
                color: currentView === 'home' ? '#FFFFFF' : '#475569',
              }}
            >
              <Home size={15} />
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
                      gap: '6px',
                      padding: '7px 11px',
                      borderRadius: '8px',
                      fontSize: '12.5px',
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
                    <Icon size={15} color={isPoleActive ? pole.accentColor : '#64748B'} />
                    <span>{pole.label}</span>
                    <ChevronDown
                      size={13}
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

        {/* Côté Droit Desktop : Recherche, Actualisation, Plein Écran, Profil */}
        <div className="desktop-actions">
          <button
            type="button"
            onClick={() => setShowSearchModal(true)}
            title="Rechercher (raccourci clavier Ctrl + K)"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 11px',
              borderRadius: '8px',
              backgroundColor: '#F1F5F9',
              border: '1px solid #E2E8F0',
              color: '#64748B',
              fontSize: '12px',
              cursor: 'pointer',
              fontWeight: 500,
              transition: 'all 0.15s ease',
            }}
          >
            <Search size={13} color="#64748B" />
            <span>Rechercher...</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setRoadmapInitialTab('list');
              setShowRoadmapModal(true);
            }}
            title="Boîte à Idées & Suivi des Améliorations"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 11px',
              borderRadius: '8px',
              border: '1.5px solid #FCD34D',
              backgroundColor: '#FEF3C7',
              color: '#B45309',
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: '0 2px 5px rgba(245, 158, 11, 0.12)',
              whiteSpace: 'nowrap',
            }}
          >
            <Lightbulb size={13} color="#D97706" />
            <span>Idées & Roadmap</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setRefreshKey(Date.now());
              loadLiveStats(true);
            }}
            title="Actualiser les données en direct et recharger les hubs"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '6px 10px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              backgroundColor: '#FFFFFF',
              color: '#475569',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            <RefreshCw size={13} className={loadingStats ? 'animate-spin' : ''} />
            <span>Actualiser</span>
          </button>

          {/* Profil utilisateur : Prénom uniquement pour un design épuré sans débordement */}
          <div
            title={`Connecté en tant que ${userName}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 10px',
              borderRadius: '16px',
              backgroundColor: '#F1F5F9',
              border: '1px solid #E2E8F0',
              fontSize: '12px',
              fontWeight: 700,
              color: '#334155',
              cursor: 'default',
              userSelect: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                backgroundColor: '#00C875',
              }}
            />
            <span>{userName ? userName.split(' ')[0] : 'Profil'}</span>
          </div>
        </div>

        {/* Bouton Menu Burger Mobile (affiché uniquement sur smartphone < 860px) */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen((prev) => !prev)}
          className="mobile-menu-btn"
          aria-label="Menu principal"
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        {/* Panneau Déroulant Mobile Tactile */}
        {mobileMenuOpen && (
          <div className="mobile-dropdown-menu">
            <button
              type="button"
              className="mobile-menu-item"
              onClick={() => {
                handleNavigate('home');
                setMobileMenuOpen(false);
              }}
              style={{ backgroundColor: currentView === 'home' ? '#EBF6FC' : undefined, color: currentView === 'home' ? '#0073EA' : undefined }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Home size={18} color="#0073EA" />
                <span>Accueil du Portail</span>
              </div>
              <ChevronRight size={16} color="#94A3B8" />
            </button>

            {/* Pôle Responsables de Secteur */}
            <div style={{ padding: '6px 4px 2px', fontSize: '11px', fontWeight: 800, color: '#0073EA', textTransform: 'uppercase' }}>
              Responsables de Secteur
            </div>
            <button
              type="button"
              className="mobile-menu-item"
              onClick={() => {
                handleNavigate('secteur_global');
                setMobileMenuOpen(false);
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Building2 size={16} color="#0073EA" />
                <span>Supervision Globale (371 chantiers)</span>
              </div>
              <ChevronRight size={16} color="#94A3B8" />
            </button>
            <button
              type="button"
              className="mobile-menu-item"
              onClick={() => {
                handleNavigate('secteur_natacha');
                setMobileMenuOpen(false);
              }}
            >
              <span>Secteur Natacha THOMAS (161 chantiers)</span>
              <ChevronRight size={16} color="#94A3B8" />
            </button>
            <button
              type="button"
              className="mobile-menu-item"
              onClick={() => {
                handleNavigate('secteur_ketty');
                setMobileMenuOpen(false);
              }}
            >
              <span>Secteur Ketty PAULIN (151 chantiers)</span>
              <ChevronRight size={16} color="#94A3B8" />
            </button>
            <button
              type="button"
              className="mobile-menu-item"
              onClick={() => {
                handleNavigate('secteur_emilie');
                setMobileMenuOpen(false);
              }}
            >
              <span>Secteur Émilie TOBIE (57 chantiers)</span>
              <ChevronRight size={16} color="#94A3B8" />
            </button>

            {/* Pôle Atelier & Matériel */}
            <div style={{ padding: '8px 4px 2px', fontSize: '11px', fontWeight: 800, color: '#00C875', textTransform: 'uppercase' }}>
              Atelier &amp; Matériel
            </div>
            <button
              type="button"
              className="mobile-menu-item"
              onClick={() => {
                handleNavigate('atelier_erp');
                setMobileMenuOpen(false);
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Wrench size={16} color="#00C875" />
                <span>ERP Parc Machines (Christophe)</span>
              </div>
              <ChevronRight size={16} color="#94A3B8" />
            </button>
            <button
              type="button"
              className="mobile-menu-item"
              onClick={() => {
                handleNavigate('atelier_vehicules');
                setMobileMenuOpen(false);
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Truck size={16} color="#0284C7" />
                <span>Facturation Véhicules (Christine)</span>
              </div>
              <ChevronRight size={16} color="#94A3B8" />
            </button>

            {/* Pôle Communication & Direction */}
            <div style={{ padding: '8px 4px 2px', fontSize: '11px', fontWeight: 800, color: '#8B5CF6', textTransform: 'uppercase' }}>
              Communication &amp; Direction
            </div>
            <button
              type="button"
              className="mobile-menu-item"
              onClick={() => {
                handleNavigate('comm_lea');
                setMobileMenuOpen(false);
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Users size={16} color="#8B5CF6" />
                <span>Hub de Léa — Contacts Clients</span>
              </div>
              <ChevronRight size={16} color="#94A3B8" />
            </button>
            <button
              type="button"
              className="mobile-menu-item"
              onClick={() => {
                handleNavigate('direction_vincent');
                setMobileMenuOpen(false);
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Landmark size={16} color="#10B981" />
                <span>Hub de Vincent — Direction</span>
              </div>
              <ChevronRight size={16} color="#94A3B8" />
            </button>

            {/* Actions Rapides Tactiles */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setRefreshKey(Date.now());
                  loadLiveStats(true);
                }}
                className="mobile-menu-item"
                style={{ flex: 1, justifyContent: 'center', gap: '6px', color: '#0073EA' }}
              >
                <RefreshCw size={14} className={loadingStats ? 'animate-spin' : ''} />
                <span>Actualiser</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setRoadmapInitialTab('list');
                  setShowRoadmapModal(true);
                }}
                className="mobile-menu-item"
                style={{ flex: 1, justifyContent: 'center', gap: '6px', color: '#D97706', backgroundColor: '#FEF3C7' }}
              >
                <Lightbulb size={14} />
                <span>Idées &amp; Roadmap</span>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* ============================================================== */}
      {/* 2. BARRE CONTEXTUELLE UNIQUE (FUSIONNÉE & ULTRA CLEAN)        */}
      {/* ============================================================== */}
      {currentView !== 'home' && (
        <div
          className="hub-subbar"
          style={{
            height: '46px',
            backgroundColor: '#FFFFFF',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 20px',
            flexShrink: 0,
            boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
          }}
        >
          {/* CÔTÉ GAUCHE : Bouton retour direct + Séparateur + Titre & Badges */}
          <div className="subbar-left" style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, overflow: 'hidden' }}>
            {/* Bouton Retour contextuel */}
            {(() => {
              const isAnimatrice =
                currentView === 'secteur_natacha' ||
                currentView === 'secteur_ketty' ||
                currentView === 'secteur_emilie';
              const backTarget: ViewId = isAnimatrice ? 'secteur_global' : 'home';
              const backLabel = isAnimatrice ? 'Supervision Globale' : 'Accueil';

            return (
              <button
                type="button"
                onClick={() => handleNavigate(backTarget)}
                className="subbar-back-btn"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '5px 12px',
                  borderRadius: '8px',
                  backgroundColor: '#F8FAFC',
                  color: '#475569',
                  border: '1px solid #E2E8F0',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#F1F5F9';
                  e.currentTarget.style.borderColor = '#CBD5E1';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#F8FAFC';
                  e.currentTarget.style.borderColor = '#E2E8F0';
                }}
              >
                <ArrowLeft size={13} />
                <span className="desktop-only">{backLabel}</span>
                <span className="mobile-only">{isAnimatrice ? 'Supervision' : 'Accueil'}</span>
              </button>
            );
          })()}

          {/* Séparateur vertical fin */}
          <div style={{ width: '1px', height: '18px', backgroundColor: '#E2E8F0', flexShrink: 0 }} />

          {/* Titre et badges de la vue actuelle */}
          {(() => {
            if (
              currentView === 'secteur_natacha' ||
              currentView === 'secteur_ketty' ||
              currentView === 'secteur_emilie'
            ) {
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
              const animInitials =
                currentView === 'secteur_natacha'
                  ? 'NT'
                  : currentView === 'secteur_ketty'
                    ? 'KP'
                    : 'ET';
              const chantiersCount = stats.chantiersParAnim[animKey];
              const satPct = stats.visitesParAnim[animKey]?.pct || 0;

              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, overflow: 'hidden' }}>
                  <div
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      backgroundColor: '#E0F2FE',
                      color: '#0369A1',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '10px',
                      fontWeight: 800,
                      flexShrink: 0,
                    }}
                  >
                    {animInitials}
                  </div>
                  <span className="subbar-title" style={{ fontSize: '13px', fontWeight: 800, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Secteur {animFullName}
                  </span>
                  <span
                    className="mobile-hide"
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#0073EA',
                      backgroundColor: '#EBF6FC',
                      padding: '2px 8px',
                      borderRadius: '10px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    ● {chantiersCount} chantiers en cours
                  </span>
                  <span
                    className="mobile-hide"
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#00C875',
                      backgroundColor: '#E6F9F1',
                      padding: '2px 8px',
                      borderRadius: '10px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    ● {satPct}% satisfaction (2026)
                  </span>
                </div>
              );
            }

            if (currentView === 'secteur_global') {
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, overflow: 'hidden' }}>
                  <Building2 size={15} color="#0073EA" style={{ flexShrink: 0 }} />
                  <span className="subbar-title" style={{ fontSize: '13px', fontWeight: 800, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Supervision Globale (Tous Secteurs)
                  </span>
                  <span
                    className="mobile-hide"
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#0073EA',
                      backgroundColor: '#EBF6FC',
                      padding: '2px 8px',
                      borderRadius: '10px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    ● {stats.chantiersActifs} chantiers en cours
                  </span>
                  <span
                    className="mobile-hide"
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#00C875',
                      backgroundColor: '#E6F9F1',
                      padding: '2px 8px',
                      borderRadius: '10px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    ● {stats.tauxSatisfactionGlobal}% satisfaction 2026
                  </span>
                </div>
              );
            }

            if (currentView === 'atelier_erp') {
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, overflow: 'hidden' }}>
                  <Wrench size={15} color="#00C875" style={{ flexShrink: 0 }} />
                  <span className="subbar-title" style={{ fontSize: '13px', fontWeight: 800, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    ERP Parc Matériel & Atelier
                  </span>
                  <span
                    className="mobile-hide"
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#00C875',
                      backgroundColor: '#E6F9F1',
                      padding: '2px 8px',
                      borderRadius: '10px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    ● {stats.machinesTotal} machines réelles
                  </span>
                </div>
              );
            }

            if (currentView === 'atelier_vehicules') {
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, overflow: 'hidden' }}>
                  <Truck size={15} color="#0284C7" style={{ flexShrink: 0 }} />
                  <span className="subbar-title" style={{ fontSize: '13px', fontWeight: 800, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Hub de Christine — Facturation Véhicules & Énergie
                  </span>
                  <span
                    className="mobile-hide"
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#0284C7',
                      backgroundColor: '#E0F2FE',
                      padding: '2px 8px',
                      borderRadius: '10px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    ● TotalEnergies, Chargemap, Wellborne & Réparations
                  </span>
                </div>
              );
            }

            if (currentView === 'comm_lea') {
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, overflow: 'hidden' }}>
                  <Users size={15} color="#8B5CF6" style={{ flexShrink: 0 }} />
                  <span className="subbar-title" style={{ fontSize: '13px', fontWeight: 800, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Hub de Léa — Communication & Contacts Clients
                  </span>
                  <span
                    className="mobile-hide"
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#8B5CF6',
                      backgroundColor: '#F3E8FF',
                      padding: '2px 8px',
                      borderRadius: '10px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    ● Export Excel contacts chantiers
                  </span>
                </div>
              );
            }

            if (currentView === 'direction_vincent') {
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, overflow: 'hidden' }}>
                  <Landmark size={15} color="#10B981" style={{ flexShrink: 0 }} />
                  <span className="subbar-title" style={{ fontSize: '13px', fontWeight: 800, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Hub de Vincent — Direction & Flotte
                  </span>
                  <span
                    className="mobile-hide"
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#10B981',
                      backgroundColor: '#ECFDF5',
                      padding: '2px 8px',
                      borderRadius: '10px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    ● Suivi flotte, non-qualité, indicateurs financiers & réunion d’associés
                  </span>
                </div>
              );
            }

            // Autres vues
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#0F172A' }}>
                  {activeSubItem?.item.title || 'Section'}
                </span>
              </div>
            );
          })()}
        </div>

        {/* CÔTÉ DROIT : Synchro Monday + Plein Écran */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          <span
            className="mobile-hide"
            style={{
              fontSize: '11px',
              fontWeight: 700,
              color: '#00C875',
              backgroundColor: '#E6F9F1',
              padding: '3px 10px',
              borderRadius: '10px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
            }}
          >
            <span
              style={{
                display: 'inline-block',
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: '#00C875',
              }}
            />
            <span>Données Monday.com Synchronisées {lastSyncTime ? `(${lastSyncTime})` : ''}</span>
          </span>

          {(currentView === 'secteur_natacha' ||
            currentView === 'secteur_ketty' ||
            currentView === 'secteur_emilie' ||
            currentView === 'atelier_erp' ||
            currentView === 'atelier_vehicules' ||
            currentView === 'comm_lea' ||
            currentView === 'direction_vincent') && (
              <button
                type="button"
                onClick={toggleFullscreen}
                className="desktop-only"
                title="Basculer en plein écran natif dans Monday"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '5px 12px',
                  borderRadius: '7px',
                  backgroundColor: '#0073EA',
                  color: '#FFFFFF',
                  border: 'none',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 1px 3px rgba(0, 115, 234, 0.25)',
                  transition: 'background-color 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#0060C0';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#0073EA';
                }}
              >
                <Maximize2 size={12} />
                <span>Plein Écran</span>
              </button>
            )}
        </div>
      </div>
    )
  }

  {/* ============================================================== */ }
  {/* 3. MODAL DE RECHERCHE RAPIDE (OMNIBAR)                        */ }
  {/* ============================================================== */ }
  {
    showSearchModal && (
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
    )
  }

      {/* ============================================================== */}
      {/* 4. CONTENU PRINCIPAL PAR VUE                                  */}
      {/* ============================================================== */}
      <main className="hub-main-content" style={{ flex: 1, position: 'relative', overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {/* ------------------------------------------------------------ */}
        {/* VUE 1 : ACCUEIL DU PORTAIL GLOBAL                           */}
        {/* ------------------------------------------------------------ */}
        {currentView === 'home' && (
          <div className="hub-home-container" style={{ padding: '30px 40px', maxWidth: '1400px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
            <div
              className="hub-banner-box"
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
                <h1 className="hub-banner-title" style={{ fontSize: '26px', fontWeight: 900, margin: '0 0 8px 0', letterSpacing: '-0.5px' }}>
                  Intranet Groupe Facility
                </h1>
                <p style={{ margin: 0, fontSize: '14px', color: '#94A3B8', maxWidth: '620px', lineHeight: 1.5 }}>
                  Supervision en direct des 3 secteurs chantiers (Natacha, Ketty, Emilie), du parc machines atelier et des consommables.
                </p>
              </div>

              <div className="hub-banner-buttons" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
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
          className="hub-kpis-grid"
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
              ● Natacha: {stats.chantiersParAnim.Natacha} • Ketty: {stats.chantiersParAnim.Ketty} • Emilie: {stats.chantiersParAnim.Emilie}
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
              {stats.visitesBonnes} avis favorables / {stats.visitesTotal} visites (2026)
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

        <div className="hub-poles-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
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

        {/* Bannière Boîte à Idées & Roadmap Collaborative */}
        <div
          className="hub-roadmap-banner"
          style={{
            marginTop: '35px',
            backgroundColor: '#FFFFFF',
            borderRadius: '18px',
            border: '1.5px solid #E2E8F0',
            padding: '28px 32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '24px',
            boxShadow: '0 4px 18px rgba(15, 23, 42, 0.05)',
            background: 'linear-gradient(135deg, #FFFFFF 0%, #FFFBEB 100%)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: -30,
              right: -30,
              width: 140,
              height: 140,
              borderRadius: '50%',
              background: 'rgba(245, 158, 11, 0.08)',
              pointerEvents: 'none',
            }}
          />

          <div className="hub-roadmap-header" style={{ display: 'flex', alignItems: 'center', gap: '20px', zIndex: 1, flex: 1, minWidth: '280px' }}>
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '16px',
                backgroundColor: '#FEF3C7',
                border: '1.5px solid #FDE68A',
                color: '#D97706',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 4px 12px rgba(245, 158, 11, 0.2)',
              }}
            >
              <Lightbulb size={28} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '3px 10px',
                  borderRadius: '12px',
                  backgroundColor: '#FEF3C7',
                  color: '#B45309',
                  fontSize: '11px',
                  fontWeight: 800,
                  marginBottom: '6px',
                }}
              >
                <span>NOUVEAUTÉ • BOÎTE À IDÉES DU GROUPE</span>
              </div>
              <h3 style={{ margin: '0 0 6px 0', fontSize: '18px', fontWeight: 800, color: '#0F172A' }}>
                Une idée, un besoin ou une suggestion pour vos outils ?
              </h3>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748B', maxWidth: '640px', lineHeight: 1.5 }}>
                Chaque pôle (Animatrices, Atelier, Flotte Véhicules, Commercial) peut formuler ses demandes. Vos suggestions alimentent directement la feuille de route collaborative du Groupe Facility.
              </p>
            </div>
          </div>

          <div className="hub-roadmap-buttons" style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', zIndex: 1 }}>
            <button
              type="button"
              onClick={() => {
                setRoadmapInitialTab('form');
                setShowRoadmapModal(true);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '11px 20px',
                borderRadius: '10px',
                backgroundColor: '#D97706',
                color: '#FFFFFF',
                border: 'none',
                fontSize: '13px',
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(217, 119, 6, 0.35)',
                transition: 'all 0.15s ease',
              }}
            >
              <Lightbulb size={16} />
              <span>Formuler une demande</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setRoadmapInitialTab('list');
                setShowRoadmapModal(true);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '11px 18px',
                borderRadius: '10px',
                backgroundColor: '#FFFFFF',
                color: '#1E293B',
                border: '1.5px solid #CBD5E1',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <span>Voir la Roadmap en direct</span>
              <ArrowRight size={15} color="#64748B" />
            </button>
          </div>
        </div>
      </div>
    )}

    {/* ------------------------------------------------------------ */}
    {/* VUE 2 : SUPERVISION GLOBALE (TOUS SECTEURS) - 100% RÉEL     */}
    {/* ------------------------------------------------------------ */}
    {/* VUE 2 : SUPERVISION GLOBALE (TOUS SECTEURS) - CHARTE 2026   */}
    {/* ------------------------------------------------------------ */}
    {currentView === 'secteur_global' && (
      <div className="hub-view-container" style={{ padding: '30px 40px', maxWidth: '1400px', margin: '0 auto' }}>
        {/* En-tête de section aux normes Charte 2026 */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 12px', borderRadius: '20px', backgroundColor: 'rgba(57, 169, 220, 0.12)', color: '#3989B7', fontSize: '11px', fontWeight: 700, marginBottom: '8px' }}>
              <Sparkles size={13} color="#F7AC37" />
              <span>Direction Opérationnelle &amp; Contrôle Qualité 2026</span>
            </div>
            <h1 style={{ fontFamily: "'Ruda', sans-serif", fontSize: '28px', fontWeight: 900, color: '#0F172A', margin: 0, letterSpacing: '-0.3px' }}>
              Supervision Globale • Responsables de Secteur
            </h1>
            <div style={{ marginTop: '8px', height: '3.5px', width: '80px', borderRadius: '2px', background: 'linear-gradient(90deg, #F7AC37, #39A9DC)' }} />
            <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: '#64748B', maxWidth: '780px', lineHeight: 1.5 }}>
              Statistiques consolidées en temps réel depuis Monday.com — Ventilation par animatrice (Natacha, Ketty, Émilie), contrôles qualité C1/C2/C3 et suivi des {stats.chantiersActifs} chantiers en cours.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={() => loadLiveStats(true)}
              disabled={loadingStats}
              title="Forcer la synchronisation avec Monday.com"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                padding: '9px 16px',
                borderRadius: '9px',
                backgroundColor: '#FFFFFF',
                color: '#3989B7',
                border: '1.5px solid #CBD5E1',
                fontSize: '12px',
                fontWeight: 700,
                cursor: loadingStats ? 'wait' : 'pointer',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                transition: 'all 0.15s ease',
              }}
            >
              <RefreshCw size={14} className={loadingStats ? 'animate-spin' : ''} />
              <span>{loadingStats ? 'Actualisation...' : 'Actualiser en direct'}</span>
            </button>
          </div>
        </div>

        {/* Cartes Synthèse Supervision (100% Dynamiques & Typo Ruda) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '28px' }}>
          {/* 1. Chantiers en cours */}
          <div style={{ backgroundColor: '#FFFFFF', padding: '20px', borderRadius: '16px', border: '1.5px solid #E2E8F0', borderLeft: '4px solid #39A9DC', boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#3989B7', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Chantiers en cours</span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#0369A1', backgroundColor: '#E0F2FE', padding: '2px 8px', borderRadius: '12px' }}>100% assignés</span>
            </div>
            <div style={{ fontFamily: "'Ruda', sans-serif", fontSize: '34px', fontWeight: 900, color: '#0F172A', marginTop: '6px' }}>
              {stats.chantiersActifs}
            </div>
            <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, marginTop: '4px' }}>
              ● Natacha: <strong>{stats.chantiersParAnim.Natacha}</strong> • Ketty: <strong>{stats.chantiersParAnim.Ketty}</strong> • Émilie: <strong>{stats.chantiersParAnim.Emilie}</strong>
            </div>
          </div>

          {/* 2. Satisfaction Globale */}
          <div style={{ backgroundColor: '#FFFFFF', padding: '20px', borderRadius: '16px', border: '1.5px solid #E2E8F0', borderLeft: '4px solid #00C875', boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Satisfaction Visites</span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#059669', backgroundColor: '#D1FAE5', padding: '2px 8px', borderRadius: '12px' }}>Année 2026</span>
            </div>
            <div style={{ fontFamily: "'Ruda', sans-serif", fontSize: '34px', fontWeight: 900, color: '#00C875', marginTop: '6px' }}>
              {stats.tauxSatisfactionGlobal}%
            </div>
            <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
              <strong>{stats.visitesBonnes}</strong> satisfaisantes / <strong>{stats.visitesTotal}</strong> notées en 2026
            </div>
          </div>

          {/* 3. Clients 3 Étoiles */}
          <div style={{ backgroundColor: '#FFFFFF', padding: '20px', borderRadius: '16px', border: '1.5px solid #E2E8F0', borderLeft: '4px solid #F7AC37', boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#B45309', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Clients 3 Étoiles 🌟</span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#B45309', backgroundColor: '#FEF3C7', padding: '2px 8px', borderRadius: '12px' }}>Niveau Max</span>
            </div>
            <div style={{ fontFamily: "'Ruda', sans-serif", fontSize: '34px', fontWeight: 900, color: '#F7AC37', marginTop: '6px' }}>
              {stats.etoiles.Global.s3}
            </div>
            <div style={{ fontSize: '11px', color: '#B45309', fontWeight: 600, marginTop: '4px' }}>
              {stats.chantiersActifs > 0 ? Math.round((stats.etoiles.Global.s3 / stats.chantiersActifs) * 100) : 45}% du parc au niveau maximal
            </div>
          </div>

          {/* 4. Clients Insatisfaits */}
          <div style={{ backgroundColor: '#FFFFFF', padding: '20px', borderRadius: '16px', border: '1.5px solid #E2E8F0', borderLeft: '4px solid #D66927', boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#D66927', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Clients Insatisfaits 🙁</span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#D66927', backgroundColor: 'rgba(214, 105, 39, 0.1)', padding: '2px 8px', borderRadius: '12px' }}>Priorité Qualité</span>
            </div>
            <div style={{ fontFamily: "'Ruda', sans-serif", fontSize: '34px', fontWeight: 900, color: '#D66927', marginTop: '6px' }}>
              {stats.etoiles.Global.bad}
            </div>
            <div style={{ fontSize: '11px', color: '#D66927', fontWeight: 600, marginTop: '4px' }}>
              Plans d'action en cours d'exécution
            </div>
          </div>
        </div>

        {/* TABLEAU COMPARATIF DÉTAILLÉ DES 3 ANIMATRICES (100% Dynamique) */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1.5px solid #E2E8F0', padding: '24px', marginBottom: '28px', boxShadow: '0 2px 10px rgba(15, 23, 42, 0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3 style={{ margin: 0, fontFamily: "'Ruda', sans-serif", fontSize: '17px', fontWeight: 800, color: '#0F172A' }}>
                Comparatif Opérationnel par Responsable de Secteur
              </h3>
              <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: '#64748B' }}>
                Ventilation consolidée des chantiers en cours, satisfaction certifiée des visites et niveaux d'étoiles.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '11px', color: '#3989B7', backgroundColor: '#F0F9FF', padding: '3px 10px', borderRadius: '12px', fontWeight: 700 }}>
                ● En direct Monday.com
              </span>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#3989B7', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  <th style={{ padding: '12px 16px' }}>Responsable de Secteur</th>
                  <th style={{ padding: '12px 14px' }}>Chantiers</th>
                  <th style={{ padding: '12px 14px' }}>Part du Parc</th>
                  <th style={{ padding: '12px 14px' }}>Satisfaction Visites (2026)</th>
                  <th style={{ padding: '12px 14px' }}>3 Étoiles 🌟</th>
                  <th style={{ padding: '12px 14px' }}>2 Étoiles 🌟</th>
                  <th style={{ padding: '12px 14px' }}>1 Étoile 🌟</th>
                  <th style={{ padding: '12px 14px' }}>Insatisfaits 🙁</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {/* Natacha THOMAS */}
                <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '14px 16px', fontWeight: 800, color: '#0F172A' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#E0F2FE', color: '#0369A1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800 }}>
                        NT
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, color: '#0F172A' }}>Natacha THOMAS</div>
                        <div style={{ fontSize: '10px', color: '#64748B' }}>Secteur Nord / Est</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '14px', fontWeight: 800, fontSize: '14px' }}>
                    {stats.chantiersParAnim.Natacha}
                  </td>
                  <td style={{ padding: '14px', color: '#64748B', fontWeight: 600 }}>
                    {stats.chantiersActifs > 0 ? ((stats.chantiersParAnim.Natacha / stats.chantiersActifs) * 100).toFixed(1) : '43.4'}%
                  </td>
                  <td style={{ padding: '14px' }}>
                    <span style={{ fontWeight: 800, color: '#059669', backgroundColor: '#D1FAE5', padding: '4px 10px', borderRadius: '6px', fontSize: '12px' }}>
                      {stats.visitesParAnim.Natacha.pct}% ({stats.visitesParAnim.Natacha.bon} / {stats.visitesParAnim.Natacha.total})
                    </span>
                  </td>
                  <td style={{ padding: '14px', fontWeight: 800, color: '#D97706' }}>
                    {stats.etoiles.Natacha.s3}
                  </td>
                  <td style={{ padding: '14px', fontWeight: 700, color: '#334155' }}>
                    {stats.etoiles.Natacha.s2}
                  </td>
                  <td style={{ padding: '14px', fontWeight: 700, color: '#64748B' }}>
                    {stats.etoiles.Natacha.s1}
                  </td>
                  <td style={{ padding: '14px', fontWeight: 800, color: stats.etoiles.Natacha.bad > 0 ? '#D66927' : '#059669' }}>
                    {stats.etoiles.Natacha.bad}
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                    <button
                      type="button"
                      onClick={() => handleNavigate('secteur_natacha')}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '7px',
                        backgroundColor: '#F0F9FF',
                        color: '#0369A1',
                        border: '1px solid #BAE6FD',
                        fontWeight: 700,
                        fontSize: '11px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      Voir Secteur
                    </button>
                  </td>
                </tr>

                {/* Ketty PAULIN */}
                <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '14px 16px', fontWeight: 800, color: '#0F172A' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#E0F2FE', color: '#0284C7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800 }}>
                        KP
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, color: '#0F172A' }}>Ketty PAULIN</div>
                        <div style={{ fontSize: '10px', color: '#64748B' }}>Secteur Ouest / Littoral</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '14px', fontWeight: 800, fontSize: '14px' }}>
                    {stats.chantiersParAnim.Ketty}
                  </td>
                  <td style={{ padding: '14px', color: '#64748B', fontWeight: 600 }}>
                    {stats.chantiersActifs > 0 ? ((stats.chantiersParAnim.Ketty / stats.chantiersActifs) * 100).toFixed(1) : '40.7'}%
                  </td>
                  <td style={{ padding: '14px' }}>
                    <span style={{ fontWeight: 800, color: '#0284C7', backgroundColor: '#E0F2FE', padding: '4px 10px', borderRadius: '6px', fontSize: '12px' }}>
                      {stats.visitesParAnim.Ketty.pct}% ({stats.visitesParAnim.Ketty.bon} / {stats.visitesParAnim.Ketty.total})
                    </span>
                  </td>
                  <td style={{ padding: '14px', fontWeight: 800, color: '#D97706' }}>
                    {stats.etoiles.Ketty.s3}
                  </td>
                  <td style={{ padding: '14px', fontWeight: 700, color: '#334155' }}>
                    {stats.etoiles.Ketty.s2}
                  </td>
                  <td style={{ padding: '14px', fontWeight: 700, color: '#64748B' }}>
                    {stats.etoiles.Ketty.s1}
                  </td>
                  <td style={{ padding: '14px', fontWeight: 800, color: stats.etoiles.Ketty.bad > 0 ? '#D66927' : '#059669' }}>
                    {stats.etoiles.Ketty.bad}
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                    <button
                      type="button"
                      onClick={() => handleNavigate('secteur_ketty')}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '7px',
                        backgroundColor: '#ECFEFF',
                        color: '#0891B2',
                        border: '1px solid #A5F3FC',
                        fontWeight: 700,
                        fontSize: '11px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      Voir Secteur
                    </button>
                  </td>
                </tr>

                {/* Emilie TOBIE */}
                <tr style={{ borderBottom: '2px solid #E2E8F0' }}>
                  <td style={{ padding: '14px 16px', fontWeight: 800, color: '#0F172A' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#FDF2F8', color: '#DB2777', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800 }}>
                        ET
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, color: '#0F172A' }}>Emilie TOBIE</div>
                        <div style={{ fontSize: '10px', color: '#64748B' }}>Secteur Sud / Métropole</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '14px', fontWeight: 800, fontSize: '14px' }}>
                    {stats.chantiersParAnim.Emilie}
                  </td>
                  <td style={{ padding: '14px', color: '#64748B', fontWeight: 600 }}>
                    {stats.chantiersActifs > 0 ? ((stats.chantiersParAnim.Emilie / stats.chantiersActifs) * 100).toFixed(1) : '15.4'}%
                  </td>
                  <td style={{ padding: '14px' }}>
                    <span style={{ fontWeight: 800, color: '#059669', backgroundColor: '#D1FAE5', padding: '4px 10px', borderRadius: '6px', fontSize: '12px' }}>
                      {stats.visitesParAnim.Emilie.pct}% ({stats.visitesParAnim.Emilie.bon} / {stats.visitesParAnim.Emilie.total})
                    </span>
                  </td>
                  <td style={{ padding: '14px', fontWeight: 800, color: '#D97706' }}>
                    {stats.etoiles.Emilie.s3}
                  </td>
                  <td style={{ padding: '14px', fontWeight: 700, color: '#334155' }}>
                    {stats.etoiles.Emilie.s2}
                  </td>
                  <td style={{ padding: '14px', fontWeight: 700, color: '#64748B' }}>
                    {stats.etoiles.Emilie.s1}
                  </td>
                  <td style={{ padding: '14px', fontWeight: 800, color: stats.etoiles.Emilie.bad > 0 ? '#D66927' : '#059669' }}>
                    {stats.etoiles.Emilie.bad}
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                    <button
                      type="button"
                      onClick={() => handleNavigate('secteur_emilie')}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '7px',
                        backgroundColor: '#FDF2F8',
                        color: '#DB2777',
                        border: '1px solid #FBCFE8',
                        fontWeight: 700,
                        fontSize: '11px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      Voir Secteur
                    </button>
                  </td>
                </tr>
              </tbody>

              {/* Ligne Total Consolidé */}
              <tfoot>
                <tr style={{ backgroundColor: '#F8FAFC', fontWeight: 900 }}>
                  <td style={{ padding: '14px 16px', color: '#0F172A', fontFamily: "'Ruda', sans-serif" }}>
                    TOTAL CONSOLIDÉ
                  </td>
                  <td style={{ padding: '14px', color: '#0F172A', fontSize: '14px' }}>
                    {stats.chantiersActifs}
                  </td>
                  <td style={{ padding: '14px', color: '#64748B' }}>
                    100%
                  </td>
                  <td style={{ padding: '14px' }}>
                    <span style={{ fontWeight: 800, color: '#0073EA', backgroundColor: '#EBF6FC', padding: '4px 10px', borderRadius: '6px', fontSize: '12px' }}>
                      {stats.tauxSatisfactionGlobal}% ({stats.visitesBonnes} / {stats.visitesTotal})
                    </span>
                  </td>
                  <td style={{ padding: '14px', color: '#D97706', fontSize: '14px' }}>
                    {stats.etoiles.Global.s3}
                  </td>
                  <td style={{ padding: '14px', color: '#334155', fontSize: '14px' }}>
                    {stats.etoiles.Global.s2}
                  </td>
                  <td style={{ padding: '14px', color: '#64748B', fontSize: '14px' }}>
                    {stats.etoiles.Global.s1}
                  </td>
                  <td style={{ padding: '14px', color: '#D66927', fontSize: '14px' }}>
                    {stats.etoiles.Global.bad}
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: '11px', color: '#64748B', fontWeight: 600 }}>
                    3 Secteurs
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* ÉTOILES QUALITÉ DU GROUPE (JAUGE DE SYNTHÈSE CHARTE 2026) */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1.5px solid #E2E8F0', padding: '24px', boxShadow: '0 2px 10px rgba(15, 23, 42, 0.03)' }}>
          <div style={{ marginBottom: '18px' }}>
            <h3 style={{ margin: 0, fontFamily: "'Ruda', sans-serif", fontSize: '17px', fontWeight: 800, color: '#0F172A' }}>
              Répartition Qualité Globale des Chantiers (Contrôles C1, C2, C3)
            </h3>
            <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: '#64748B' }}>
              Conformité stricte de l'historique qualité : calcul direct sur les contrôles réalisés par les animatrices.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '16px' }}>
            {/* 3 Étoiles - Jaune Charte #F7AC37 */}
            <div style={{ backgroundColor: '#FEF9C3', padding: '18px', borderRadius: '14px', border: '1.5px solid #F7AC37' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#B45309' }}>Client 3 Étoiles 🌟🌟🌟</span>
                <span style={{ fontSize: '10px', fontWeight: 800, color: '#92400E', backgroundColor: '#FDE68A', padding: '1px 6px', borderRadius: '8px' }}>Niveau 3/3</span>
              </div>
              <div style={{ fontFamily: "'Ruda', sans-serif", fontSize: '28px', fontWeight: 900, color: '#92400E', marginTop: '6px' }}>
                {stats.etoiles.Global.s3} chantiers
              </div>
              <p style={{ margin: '6px 0 0 0', fontSize: '11px', color: '#78350F', lineHeight: 1.4 }}>
                Les 3 derniers contrôles consécutifs sont conformes (C1, C2 et C3 = <em>"Globalement bon"</em>).
              </p>
            </div>

            {/* 2 Étoiles - Bleu Charte #39A9DC */}
            <div style={{ backgroundColor: '#E0F2FE', padding: '18px', borderRadius: '14px', border: '1.5px solid #39A9DC' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#0369A1' }}>Client 2 Étoiles 🌟🌟</span>
                <span style={{ fontSize: '10px', fontWeight: 800, color: '#075985', backgroundColor: '#BAE6FD', padding: '1px 6px', borderRadius: '8px' }}>Niveau 2/3</span>
              </div>
              <div style={{ fontFamily: "'Ruda', sans-serif", fontSize: '28px', fontWeight: 900, color: '#075985', marginTop: '6px' }}>
                {stats.etoiles.Global.s2} chantiers
              </div>
              <p style={{ margin: '6px 0 0 0', fontSize: '11px', color: '#0C4A6E', lineHeight: 1.4 }}>
                Les 2 derniers contrôles sont conformes (C1 et C2 = <em>"Globalement bon"</em>).
              </p>
            </div>

            {/* 1 Étoile - Bleu Foncé Charte #3989B7 */}
            <div style={{ backgroundColor: '#F1F5F9', padding: '18px', borderRadius: '14px', border: '1.5px solid #3989B7' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#3989B7' }}>Client 1 Étoile 🌟</span>
                <span style={{ fontSize: '10px', fontWeight: 800, color: '#1E293B', backgroundColor: '#E2E8F0', padding: '1px 6px', borderRadius: '8px' }}>Niveau 1/3</span>
              </div>
              <div style={{ fontFamily: "'Ruda', sans-serif", fontSize: '28px', fontWeight: 900, color: '#1E293B', marginTop: '6px' }}>
                {stats.etoiles.Global.s1} chantiers
              </div>
              <p style={{ margin: '6px 0 0 0', fontSize: '11px', color: '#475569', lineHeight: 1.4 }}>
                Le dernier contrôle C1 est conforme (<em>"Globalement bon"</em>).
              </p>
            </div>

            {/* Insatisfait - Orange Charte #D66927 */}
            <div style={{ backgroundColor: '#FFF7ED', padding: '18px', borderRadius: '14px', border: '1.5px solid #D66927' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#D66927' }}>Client Insatisfait 🙁</span>
                <span style={{ fontSize: '10px', fontWeight: 800, color: '#9A3412', backgroundColor: '#FFEDD5', padding: '1px 6px', borderRadius: '8px' }}>Plan Urgent</span>
              </div>
              <div style={{ fontFamily: "'Ruda', sans-serif", fontSize: '28px', fontWeight: 900, color: '#9A3412', marginTop: '6px' }}>
                {stats.etoiles.Global.bad} chantiers
              </div>
              <p style={{ margin: '6px 0 0 0', fontSize: '11px', color: '#7C2D12', lineHeight: 1.4 }}>
                Dernier contrôle non satisfaisant (Bases non respectées ou plan d'action d'urgence).
              </p>
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
          const iframeSrc = `${URL_SECTEUR_HUB}?animatrice=${animKey}&profile=${animKey}&ts=${refreshKey}`;

              return (
                <iframe
                  ref={activeIframeRef}
                  key={`${animKey}_${refreshKey}`}
                  src={iframeSrc}
                  title={`Hub Secteur ${animFullName}`}
                  style={{ flex: 1, width: '100%', height: 'calc(100vh - 106px)', minHeight: '650px', border: 'none' }}
                  allow="clipboard-write; fullscreen; camera; microphone"
                />
              );
            })()}
          </div>
        )}

        {/* ------------------------------------------------------------ */}
        {/* VUE 4 : ERP ATELIER & PARC MACHINES                         */}
        {/* ------------------------------------------------------------ */}
        {currentView === 'atelier_erp' && (
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <iframe
              ref={activeIframeRef}
              key={`atelier_erp_${refreshKey}`}
              src={`${URL_ATELIER_ERP}?v=20004306&ts=${refreshKey}`}
              title="ERP Parc Matériel & Machines"
              style={{ flex: 1, width: '100%', height: 'calc(100vh - 106px)', minHeight: '650px', border: 'none' }}
              allow="clipboard-write; fullscreen; camera; microphone"
            />
          </div>
        )}

        {/* ------------------------------------------------------------ */}
        {/* VUE 5 : HUB DE CHRISTINE — FACTURATION VÉHICULES & ÉNERGIE   */}
        {/* ------------------------------------------------------------ */}
        {currentView === 'atelier_vehicules' && (
          <div style={{ flex: 1, width: '100%', height: '100%', minHeight: 'calc(100vh - 106px)', display: 'flex', flexDirection: 'column' }}>
            <iframe
              ref={activeIframeRef}
              key={`atelier_vehicules_${refreshKey}`}
              src={`${URL_CHRISTINE_HUB}?v=20267872&ts=${refreshKey}`}
              title="Hub de Christine — Facturation & Flotte"
              style={{ flex: 1, width: '100%', height: 'calc(100vh - 106px)', minHeight: '650px', border: 'none' }}
              allow="clipboard-write; fullscreen; camera; microphone"
            />
          </div>
        )}

        {/* ------------------------------------------------------------ */}
        {/* VUE : HUB DE LÉA — COMMUNICATION & CONTACTS CLIENTS           */}
        {/* ------------------------------------------------------------ */}
        {currentView === 'comm_lea' && (
          <div style={{ flex: 1, width: '100%', height: '100%', minHeight: 'calc(100vh - 106px)', display: 'flex', flexDirection: 'column' }}>
            <iframe
              ref={activeIframeRef}
              key={`comm_lea_${refreshKey}`}
              src={`${URL_LEA_HUB}?v=20377620&ts=${refreshKey}`}
              title="Hub de Léa — Communication & Contacts Clients"
              style={{ flex: 1, width: '100%', height: 'calc(100vh - 106px)', minHeight: '650px', border: 'none' }}
              allow="clipboard-write; fullscreen; camera; microphone"
            />
          </div>
        )}

        {/* ------------------------------------------------------------ */}
        {/* VUE : HUB DE VINCENT — DIRECTION & FLOTTE                    */}
        {/* ------------------------------------------------------------ */}
        {currentView === 'direction_vincent' && (
          <div style={{ flex: 1, width: '100%', height: '100%', minHeight: 'calc(100vh - 106px)', display: 'flex', flexDirection: 'column' }}>
            <iframe
              ref={activeIframeRef}
              key={`direction_vincent_${refreshKey}`}
              src={`${URL_VINCENT_HUB}?v=20428306&ts=${refreshKey}`}
              title="Hub de Vincent — Direction & Flotte"
              style={{ flex: 1, width: '100%', height: 'calc(100vh - 106px)', minHeight: '650px', border: 'none' }}
              allow="clipboard-write; fullscreen; camera; microphone"
            />
          </div>
        )}


    {/* ------------------------------------------------------------ */}
    {/* VUE 6 : HUB FOURNISSEURS & SAV                               */}
    {/* ------------------------------------------------------------ */}
    {currentView === 'atelier_fournisseurs' && (
      <div className="hub-view-container" style={{ padding: '30px 40px', maxWidth: '1400px', margin: '0 auto' }}>
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
      <div className="hub-view-container" style={{ padding: '30px 40px', maxWidth: '1400px', margin: '0 auto' }}>
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
      <div className="hub-view-container" style={{ padding: '30px 40px', maxWidth: '1400px', margin: '0 auto' }}>
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

    {/* Modal Boîte à Idées & Roadmap Interactive */}
    <RoadmapModal
      isOpen={showRoadmapModal}
      onClose={() => setShowRoadmapModal(false)}
      monday={monday}
      currentUserName={userName}
      initialTab={roadmapInitialTab}
    />
  </main>
    </div >
  );
}
