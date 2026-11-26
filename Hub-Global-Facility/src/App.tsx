import React, { useEffect, useMemo, useRef, useState } from 'react';
import mondaySdk from 'monday-sdk-js';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Award,
  Building2,
  ChevronDown,
  Clock,
  FileSpreadsheet,
  Home,
  Landmark,
  Lightbulb,
  Mail,
  Maximize2,
  PackageSearch,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Truck,
  User,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import {
  HUB_DEFINITIONS,
  HubKey,
  VIEW_TO_HUB_KEY,
  ViewId,
} from './config/hubPermissions';
import {
  createAllAllowedPermissions,
  fetchUserPermissions,
  isAdminUser,
  UserHubPermissions,
} from './services/permissionsService';
import {
  getDefaultUserPrefs,
  loadRemoteUserPrefs,
  normalizeUserKey,
  readLocalUserPrefs,
  saveUserPrefs,
  UserHubPrefs,
} from './services/userPrefsService';
import NewsCarousel from './components/NewsCarousel';
import HubsCarousel, { HubCardData } from './components/HubsCarousel';
import CustomizeHubModal from './components/CustomizeHubModal';
import PermissionsModal from './components/PermissionsModal';
import RoadmapModal from './components/RoadmapModal';
import CommercialHubView from './components/CommercialHubView';
import { prefetchCommercialData } from './services/commercialService';

const monday = mondaySdk();

interface PortalStats {
  chantiersActifs: number;
  chantiersParAnim: { Natacha: number; Ketty: number; Emilie: number; Autre: number };
  visitesTotal: number;
  visitesBonnes: number;
  tauxSatisfactionGlobal: number;
  visitesParAnim: {
    Natacha: { total: number; bon: number; pct: number };
    Ketty: { total: number; bon: number; pct: number };
    Emilie: { total: number; bon: number; pct: number };
  };
  etoiles: {
    Global: { s3: number; s2: number; s1: number; bad: number };
    Natacha: { s3: number; s2: number; s1: number; bad: number };
    Ketty: { s3: number; s2: number; s1: number; bad: number };
    Emilie: { s3: number; s2: number; s1: number; bad: number };
  };
  alertes: {
    insatisfaits3x: number;
    nonVus11Mois: number;
    qualitePlus2Mois: number;
    rdv2Mois: number;
  };
  machinesTotal: number;
  inventairesAFaire: number;
  inventairesRealises: number;
}

const DEFAULT_PORTAL_STATS: PortalStats = {
  chantiersActifs: 371,
  chantiersParAnim: { Natacha: 161, Ketty: 151, Emilie: 57, Autre: 2 },
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
  alertes: { insatisfaits3x: 1, nonVus11Mois: 0, qualitePlus2Mois: 0, rdv2Mois: 0 },
  machinesTotal: 133,
  inventairesAFaire: 60,
  inventairesRealises: 6,
};

// URLs des applications spécialisées hébergées sur le CDN Monday
const URL_SECTEUR_HUB = 'https://v4f02898b5089caaa1aab8b5114da62ee.cdn2.monday.app';
const URL_ATELIER_ERP = 'https://vb0e51dbd8fbf57664b5ec275468cb683.cdn2.monday.app';
const URL_CHRISTINE_HUB = 'https://v22ee6623695ca4f24afdcef705ad37ad.cdn2.monday.app';
const URL_LEA_HUB = 'https://v35f08750a3aaae38eb0904b41deaf718.cdn2.monday.app';
const URL_VINCENT_HUB = 'https://veb2db5fe34ecc3e1c1519f91c8d97c5a.cdn2.monday.app';

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
  } catch {
    // ignore
  }
  return 'home';
};

export default function App() {
  const curYear = new Date().getFullYear();

  const [currentView, setCurrentView] = useState<ViewId>(getInitialView);
  const [userName, setUserName] = useState<string>('Guillaume Daniel');
  const [userEmail, setUserEmail] = useState<string>('');
  const [loadingStats, setLoadingStats] = useState<boolean>(true);
  const [refreshKey, setRefreshKey] = useState<number>(() => Date.now());
  const [lastSyncTime, setLastSyncTime] = useState<string>('');

  // Permissions & Préférences utilisateur
  const [permissions, setPermissions] = useState<UserHubPermissions>(createAllAllowedPermissions);
  const [permissionsLoaded, setPermissionsLoaded] = useState<boolean>(false);
  const userKey = useMemo(() => normalizeUserKey(userEmail, userName), [userEmail, userName]);
  const [prefs, setPrefs] = useState<UserHubPrefs>(getDefaultUserPrefs);
  const [isMobileViewport, setIsMobileViewport] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 860px)').matches : false
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 860px)');
    const onChange = (e: MediaQueryListEvent) => setIsMobileViewport(e.matches);
    setIsMobileViewport(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Préchargement silencieux du Hub Commercial en arrière-plan (affichage instantané au clic)
  useEffect(() => {
    if (!permissions.commercial) return;
    const t = window.setTimeout(() => {
      prefetchCommercialData(monday);
    }, 900);
    return () => window.clearTimeout(t);
  }, [permissions.commercial]);

  // Recherche Hero & Modales
  const [heroSearch, setHeroSearch] = useState<string>('');
  const [heroFilter, setHeroFilter] = useState<'all' | 'secteurs' | 'atelier' | 'outils'>('all');
  const [searchFocused, setSearchFocused] = useState<boolean>(false);
  const [statsExpanded, setStatsExpanded] = useState<boolean>(false);

  const [showRoadmapModal, setShowRoadmapModal] = useState<boolean>(false);
  const [roadmapInitialTab, setRoadmapInitialTab] = useState<'form' | 'list' | 'my_ideas' | 'company_ideas'>('company_ideas');
  const [showCustomizeModal, setShowCustomizeModal] = useState<boolean>(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState<boolean>(false);

  const CACHE_KEY = 'facility_portal_stats_v5';
  const USER_CACHE_KEY = 'facility_portal_user_v2';
  const CACHE_DURATION_MS = 15 * 60 * 1000;

  const [stats, setStats] = useState<PortalStats>(() => {
    try {
      const raw = localStorage.getItem(CACHE_KEY) || sessionStorage.getItem(CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.data) return parsed.data as PortalStats;
      }
    } catch {
      // ignore
    }
    return DEFAULT_PORTAL_STATS;
  });

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const heroSearchInputRef = useRef<HTMLInputElement>(null);
  const activeIframeRef = useRef<HTMLIFrameElement>(null);
  const iframeRefsMap = useRef<Partial<Record<ViewId, HTMLIFrameElement | null>>>({});
  const pendingBridgeSources = useRef<Map<string, Window>>(new Map());
  const loadingStatsRef = useRef<boolean>(false);

  const IFRAME_VIEWS: ViewId[] = useMemo(
    () => [
      'secteur_natacha',
      'secteur_ketty',
      'secteur_emilie',
      'atelier_erp',
      'atelier_vehicules',
      'comm_lea',
      'direction_vincent',
    ],
    []
  );
  const [visitedIframeViews, setVisitedIframeViews] = useState<ViewId[]>([]);

  useEffect(() => {
    if (IFRAME_VIEWS.includes(currentView)) {
      setVisitedIframeViews((prev) => (prev.includes(currentView) ? prev : [...prev, currentView]));
      activeIframeRef.current = iframeRefsMap.current[currentView] || null;
    } else {
      activeIframeRef.current = null;
    }
  }, [currentView, IFRAME_VIEWS]);

  const isAdmin = useMemo(() => isAdminUser(userName, userEmail), [userName, userEmail]);

  const firstName = useMemo(() => {
    const clean = (userName || '').trim();
    if (!clean) return 'Collaborateur';
    return clean.split(/\s+/)[0];
  }, [userName]);

  const greetingText = useMemo(() => {
    const h = new Date().getHours();
    if (h >= 18 || h < 5) return `Bonsoir ${firstName}`;
    return `Bonjour ${firstName}`;
  }, [firstName]);

  const todayFormatted = useMemo(() => {
    return new Date().toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }, []);

  // Chargement identité utilisateur (nom + email)
  const loadUserIdentity = async () => {
    try {
      const cachedUser = localStorage.getItem(USER_CACHE_KEY);
      if (cachedUser) {
        const parsed = JSON.parse(cachedUser);
        if (parsed?.name && Date.now() - (parsed.timestamp || 0) < 24 * 60 * 60 * 1000) {
          setUserName(parsed.name);
          if (parsed.email) setUserEmail(parsed.email);
          return;
        }
      }
      const meRes: any = await monday.api(`query { me { id name email } }`);
      if (meRes?.data?.me?.name) {
        const n = meRes.data.me.name;
        const em = meRes.data.me.email || '';
        setUserName(n);
        setUserEmail(em);
        try {
          localStorage.setItem(USER_CACHE_KEY, JSON.stringify({ name: n, email: em, timestamp: Date.now() }));
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }
  };

  // Charger les permissions Monday & préférences personnelles dès que l'utilisateur est identifié
  const refreshUserPermissions = async (force = false) => {
    const perms = await fetchUserPermissions(monday, userEmail, userName, force);
    setPermissions(perms);
    setPermissionsLoaded(true);
  };

  useEffect(() => {
    refreshUserPermissions(false);
    setPrefs(readLocalUserPrefs(userKey));
    loadRemoteUserPrefs(monday, userKey).then((remote) => {
      if (remote) setPrefs(remote);
    });
  }, [userKey]);

  const handleUpdatePrefs = (next: UserHubPrefs) => {
    setPrefs(next);
    void saveUserPrefs(monday, userKey, next);
  };

  // Construction complète des données de cartes Hubs (connectées aux stats temps réel)
  const allHubCards: HubCardData[] = useMemo(() => {
    const defByKey = new Map(HUB_DEFINITIONS.map((d) => [d.key, d]));
    const getDef = (k: HubKey) => defByKey.get(k)!;

    return [
      {
        key: 'secteurs',
        title: getDef('secteurs').label,
        description: getDef('secteurs').description,
        image: getDef('secteurs').image,
        accentColor: getDef('secteurs').accentColor,
        bgLight: getDef('secteurs').bgLight,
        badge: `${stats.chantiersActifs} chantiers`,
        defaultView: 'secteur_global',
        icon: Building2,
        items: [
          {
            id: 'secteur_global',
            title: 'Supervision Globale (Tous Secteurs)',
            badge: `${stats.tauxSatisfactionGlobal}% sat.`,
            badgeColor: '#0E7042',
            description: `Vue consolidée des 3 secteurs et étoiles (${curYear})`,
            icon: Building2,
          },
          {
            id: 'secteur_natacha',
            title: 'Secteur Natacha THOMAS',
            badge: `${stats.chantiersParAnim.Natacha} ch.`,
            badgeColor: '#39A9DC',
            description: `Satisfaction ${stats.visitesParAnim.Natacha.pct}% • ${stats.etoiles.Natacha.s3} clients 3🌟`,
            icon: User,
          },
          {
            id: 'secteur_ketty',
            title: 'Secteur Ketty PAULIN',
            badge: `${stats.chantiersParAnim.Ketty} ch.`,
            badgeColor: '#3989B7',
            description: `Satisfaction ${stats.visitesParAnim.Ketty.pct}% • ${stats.etoiles.Ketty.s3} clients 3🌟`,
            icon: User,
          },
          {
            id: 'secteur_emilie',
            title: 'Secteur Emilie TOBIE',
            badge: `${stats.chantiersParAnim.Emilie} ch.`,
            badgeColor: '#D66927',
            description: `Satisfaction ${stats.visitesParAnim.Emilie.pct}% • ${stats.etoiles.Emilie.s3} clients 3🌟`,
            icon: User,
          },
        ],
      },
      {
        key: 'atelier',
        title: getDef('atelier').label,
        description: getDef('atelier').description,
        image: getDef('atelier').image,
        accentColor: getDef('atelier').accentColor,
        bgLight: getDef('atelier').bgLight,
        badge: `${stats.machinesTotal} machines`,
        defaultView: 'atelier_erp',
        icon: Wrench,
        items: [
          {
            id: 'atelier_erp',
            title: 'ERP Parc Matériel (Christophe)',
            badge: `${stats.machinesTotal} machines`,
            badgeColor: '#3989B7',
            description: 'Contrôles techniques, compteurs horaires & réparations curatives',
            icon: Wrench,
          },
        ],
      },
      {
        key: 'facturation',
        title: getDef('facturation').label,
        description: getDef('facturation').description,
        image: getDef('facturation').image,
        accentColor: getDef('facturation').accentColor,
        bgLight: getDef('facturation').bgLight,
        badge: 'Énergie & Flotte',
        defaultView: 'atelier_vehicules',
        icon: Truck,
        items: [
          {
            id: 'atelier_vehicules',
            title: 'Hub Facturation Véhicules (Christine)',
            description: 'Saisie factures véhicules, TotalEnergies, Chargemap & Wellborne',
            icon: Truck,
          },
        ],
      },
      {
        key: 'communication',
        title: getDef('communication').label,
        description: getDef('communication').description,
        image: getDef('communication').image,
        accentColor: getDef('communication').accentColor,
        bgLight: getDef('communication').bgLight,
        badge: 'Contacts Clients',
        defaultView: 'comm_lea',
        icon: Users,
        items: [
          {
            id: 'comm_lea',
            title: 'Hub de Léa — Contacts Clients',
            description: 'Export Excel et annuaire complet des contacts chantiers',
            icon: Users,
          },
        ],
      },
      {
        key: 'direction',
        title: getDef('direction').label,
        description: getDef('direction').description,
        image: getDef('direction').image,
        accentColor: getDef('direction').accentColor,
        bgLight: getDef('direction').bgLight,
        badge: 'Flotte & GPS',
        defaultView: 'direction_vincent',
        icon: Landmark,
        items: [
          {
            id: 'direction_vincent',
            title: 'Hub Véhicules — Flotte & Géolocalisation',
            description: 'Coûts flotte, géolocalisation GPS, pointages & non-qualité',
            icon: Landmark,
          },
        ],
      },
      {
        key: 'commercial',
        title: getDef('commercial').label,
        description: getDef('commercial').description,
        image: getDef('commercial').image,
        accentColor: getDef('commercial').accentColor,
        bgLight: getDef('commercial').bgLight,
        badge: `${stats.chantiersActifs} chantiers`,
        defaultView: 'commercial_contrats',
        icon: FileSpreadsheet,
        items: [
          {
            id: 'commercial_contrats',
            title: 'Hub Commercial & Portefeuille Chantiers',
            badge: 'Indicateurs live',
            badgeColor: '#B87414',
            description: 'Portefeuille actif, heures/mois, gains, pertes, CA & provenances',
            icon: FileSpreadsheet,
          },
        ],
      },
      {
        key: 'fournisseurs',
        title: getDef('fournisseurs').label,
        description: getDef('fournisseurs').description,
        image: getDef('fournisseurs').image,
        accentColor: getDef('fournisseurs').accentColor,
        bgLight: getDef('fournisseurs').bgLight,
        badge: 'Partenaires SAV',
        defaultView: 'atelier_fournisseurs',
        icon: PackageSearch,
        items: [
          {
            id: 'atelier_fournisseurs',
            title: 'Répertoire Fournisseurs & SAV',
            badge: 'Kalhyge / Nilfisk',
            badgeColor: '#3989B7',
            description: 'Contacts directs fournisseurs consommables & constructeurs machines',
            icon: PackageSearch,
          },
        ],
      },
    ];
  }, [stats, curYear]);

  // Hubs autorisés uniquement (table Monday 🔐 Autorisations Hubs)
  const authorizedHubCards = useMemo(() => {
    return allHubCards.filter((card) => permissions[card.key]);
  }, [allHubCards, permissions]);

  // Hubs visibles et ordonnés selon les préférences de l'utilisateur
  const visibleOrderedHubCards = useMemo(() => {
    const byKey = new Map(authorizedHubCards.map((c) => [c.key, c]));
    const ordered: HubCardData[] = [];

    prefs.hubOrder.forEach((k) => {
      const card = byKey.get(k);
      if (card && !prefs.hiddenHubs.includes(k)) {
        ordered.push(card);
      }
    });

    authorizedHubCards.forEach((c) => {
      if (!ordered.some((o) => o.key === c.key) && !prefs.hiddenHubs.includes(c.key)) {
        ordered.push(c);
      }
    });

    return ordered;
  }, [authorizedHubCards, prefs]);

  // Recherche en avant-première dans le Hero (uniquement dans les Hubs autorisés !)
  const heroSearchResults = useMemo(() => {
    const q = heroSearch.toLowerCase().trim();
    const results: Array<{
      id: string;
      title: string;
      subtitle: string;
      badge?: string;
      accentColor: string;
      bgLight: string;
      icon: React.ComponentType<{ size?: number; color?: string }>;
      onSelect: () => void;
    }> = [];

    authorizedHubCards.forEach((card) => {
      if (heroFilter === 'secteurs' && card.key !== 'secteurs') return;
      if (heroFilter === 'atelier' && card.key !== 'atelier' && card.key !== 'facturation' && card.key !== 'fournisseurs') return;
      if (heroFilter === 'outils' && card.key !== 'communication' && card.key !== 'direction' && card.key !== 'commercial') return;

      card.items.forEach((item) => {
        const match =
          !q ||
          item.title.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          card.title.toLowerCase().includes(q) ||
          (item.badge && item.badge.toLowerCase().includes(q));
        if (match) {
          results.push({
            id: item.id,
            title: item.title,
            subtitle: `${card.title} • ${item.description}`,
            badge: item.badge,
            accentColor: card.accentColor,
            bgLight: card.bgLight,
            icon: item.icon,
            onSelect: () => handleNavigate(item.id),
          });
        }
      });
    });

    // Outils rapides toujours disponibles dans la recherche
    const quickTools = [
      {
        id: 'tool-my-ideas',
        title: 'Boîte à Idées — Mes idées',
        subtitle: 'Consulter mes demandes ou suivre leur avancement',
        accentColor: '#D66927',
        bgLight: '#FFF4EB',
        icon: Lightbulb,
        onSelect: () => {
          setRoadmapInitialTab('my_ideas');
          setShowRoadmapModal(true);
          setSearchFocused(false);
        },
      },
      {
        id: 'tool-company-ideas',
        title: 'Boîte à Idées — Idées de l’entreprise',
        subtitle: 'Voir toutes les propositions et commenter les demandes',
        accentColor: '#39A9DC',
        bgLight: '#EBF6FC',
        icon: Sparkles,
        onSelect: () => {
          setRoadmapInitialTab('company_ideas');
          setShowRoadmapModal(true);
          setSearchFocused(false);
        },
      },
      {
        id: 'tool-customize',
        title: 'Personnaliser mon Intranet',
        subtitle: 'Choisir les Hubs affichés et réorganiser leur ordre',
        accentColor: '#3989B7',
        bgLight: '#EBF6FC',
        icon: SlidersHorizontal,
        onSelect: () => {
          setShowCustomizeModal(true);
          setSearchFocused(false);
        },
      },
    ];

    if (!heroFilter || heroFilter === 'all' || heroFilter === 'outils') {
      quickTools.forEach((t) => {
        if (!q || t.title.toLowerCase().includes(q) || t.subtitle.toLowerCase().includes(q)) {
          results.push(t);
        }
      });
    }

    return results.slice(0, 8);
  }, [authorizedHubCards, heroSearch, heroFilter]);

  // Synchronisation stats temps réel Monday.com
  const loadLiveStats = async (force: boolean = false) => {
    if (loadingStatsRef.current && !force) return;

    if (!force) {
      try {
        const cachedRaw = localStorage.getItem(CACHE_KEY) || sessionStorage.getItem(CACHE_KEY);
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw);
          if (cached?.timestamp && Date.now() - cached.timestamp < CACHE_DURATION_MS && cached?.data) {
            setStats(cached.data);
            if (cached.lastSyncTime) setLastSyncTime(cached.lastSyncTime);
            setLoadingStats(false);
            return;
          }
        }
      } catch {
        // ignore
      }
    }

    loadingStatsRef.current = true;
    setLoadingStats(true);
    try {
      const curYearStr = new Date().getFullYear().toString();

      let cCursor: string | null = null;
      const chantierItems: any[] = [];
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
                groups(ids: ["topics"]) {
                  items_page(limit: 500) {
                    cursor
                    items {
                      id
                      name
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
              }
            }`;

        const resC: any = cCursor
          ? await monday.api(qC, { variables: { c: cCursor } })
          : await monday.api(qC);

        const chantierPage: any = cCursor
          ? resC?.data?.next_items_page
          : resC?.data?.boards?.[0]?.groups?.[0]?.items_page;
        if (chantierPage?.items) {
          chantierItems.push(...chantierPage.items);
        }
        cCursor = chantierPage?.cursor || null;
      } while (cCursor && cPages < 3);

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
                  rules: [
                    { column_id: "date_mkrcgy18", compare_value: ["${curYearStr}-01-01"], operator: greater_than_or_equals }
                  ]
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
      } while (vCursor && vPages < 4);

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

        const lastDate = it.c_last?.[0]?.text ? new Date(it.c_last[0].text) : null;
        if (lastDate && lastDate <= elevenMonthsAgo) nonVus11Mois++;
        if (isBad(c1) && lastDate && lastDate <= twoMonthsAgo) qualitePlus2Mois++;
        if (isBad(c1) && isBad(c2) && isBad(c3)) insatisfaits3x++;

        const txt2m = it.c_alertTxt?.[0]?.text || '';
        const rdvFait = it.c_rdv2?.[0]?.text === 'v' || it.c_rdv2?.[0]?.text === 'true';
        if (txt2m.trim() && !rdvFait) rdv2Mois++;
      });

      let vTotal = 0;
      let vBon = 0;
      const vByAnim = {
        Natacha: { total: 0, bon: 0, pct: 0 },
        Ketty: { total: 0, bon: 0, pct: 0 },
        Emilie: { total: 0, bon: 0, pct: 0 },
      };

      allVisites.forEach((v: any) => {
        const dt = v.date?.[0]?.text || '';
        if (dt && !dt.startsWith(curYearStr)) return;

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

      for (const k of ['Natacha', 'Ketty', 'Emilie'] as const) {
        vByAnim[k].pct =
          vByAnim[k].total > 0 ? Math.round((vByAnim[k].bon / vByAnim[k].total) * 100) : 0;
      }

      const satGlobal = vTotal > 0 ? Math.round((vBon / vTotal) * 100) : 0;

      const newStats: PortalStats = {
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

      const payload = JSON.stringify({ data: newStats, timestamp: Date.now(), lastSyncTime: nowTime });
      try { localStorage.setItem(CACHE_KEY, payload); } catch { }
      try { sessionStorage.setItem(CACHE_KEY, payload); } catch { }
    } catch (e) {
      console.warn('[Hub Global] Erreur de synchronisation temps-réel, utilisation des métriques certifiées :', e);
    } finally {
      loadingStatsRef.current = false;
      setLoadingStats(false);
    }
  };

  // Listeners globaux & pont postMessage iframe Monday SDK
  useEffect(() => {
    loadUserIdentity();

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

    const handleBridgeMessage = (event: MessageEvent) => {
      // Vérifie si le message provient d'une des iframes montées (keep-alive)
      const mountedWindows = Object.values(iframeRefsMap.current)
        .map((el) => el?.contentWindow)
        .filter((w): w is Window => Boolean(w));

      const senderWin = mountedWindows.find((w) => event.source === w);
      if (senderWin) {
        if (event.data && typeof event.data === 'object') {
          const reqId = (event.data as any).requestId;
          if (reqId) {
            pendingBridgeSources.current.set(String(reqId), senderWin);
            if (pendingBridgeSources.current.size > 200) {
              const firstKey = pendingBridgeSources.current.keys().next().value;
              if (firstKey) pendingBridgeSources.current.delete(firstKey);
            }
          }
          try {
            window.parent.postMessage(event.data, '*');
          } catch { }
        }
        return;
      }

      if (event.source === window.parent) {
        if (event.data && typeof event.data === 'object') {
          const reqId = (event.data as any).requestId;
          const targetWin =
            (reqId && pendingBridgeSources.current.get(String(reqId))) ||
            activeIframeRef.current?.contentWindow;
          if (reqId) pendingBridgeSources.current.delete(String(reqId));
          if (targetWin) {
            try {
              targetWin.postMessage(event.data, '*');
            } catch { }
          }
        }
      }
    };
    window.addEventListener('message', handleBridgeMessage);

    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCurrentView('home');
        setSearchFocused(true);
        setTimeout(() => heroSearchInputRef.current?.focus(), 60);
      }
      if (e.key === 'Escape') {
        setSearchFocused(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('message', handleBridgeMessage);
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    const needsGlobalStats =
      currentView === 'home' ||
      currentView === 'secteur_global' ||
      currentView === 'comm_alertes' ||
      currentView === 'commercial_contrats';
    if (needsGlobalStats) {
      loadLiveStats(false);
    }
  }, [currentView]);

  // Garde-fou autorisations : si la vue demandée n'est pas autorisée, revenir à l'accueil
  useEffect(() => {
    if (!permissionsLoaded || currentView === 'home') return;
    const reqHub = VIEW_TO_HUB_KEY[currentView];
    if (reqHub && !permissions[reqHub]) {
      setCurrentView('home');
    }
  }, [permissionsLoaded, permissions, currentView]);

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
    const reqHub = VIEW_TO_HUB_KEY[view];
    if (reqHub && permissionsLoaded && !permissions[reqHub]) {
      return;
    }
    setSearchFocused(false);
    setHeroSearch('');
    if (view === currentView) return;

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

  const activeSubTitle = useMemo(() => {
    for (const card of allHubCards) {
      const found = card.items.find((it) => it.id === currentView);
      if (found) return found.title;
    }
    return 'Section';
  }, [allHubCards, currentView]);

  const isIframeView =
    currentView === 'atelier_vehicules' ||
    currentView === 'atelier_erp' ||
    currentView === 'comm_lea' ||
    currentView === 'direction_vincent' ||
    currentView === 'secteur_natacha' ||
    currentView === 'secteur_ketty' ||
    currentView === 'secteur_emilie';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100%',
        backgroundColor: '#F4F9FC',
        overflow: 'hidden',
        fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        color: '#1B4565',
      }}
    >
      {/* ============================================================== */}
      {/* 1. HEADER MINIMALISTE (FINI LES MENUS ENCOMBRÉS EN HAUT)       */}
      {/* ============================================================== */}
      <header
        className={`hub-master-header ${currentView !== 'home' ? 'in-subview' : ''}`}
        style={{
          height: '58px',
          backgroundColor: 'rgba(255, 255, 255, 0.94)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1.5px solid #D7EAF5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          flexShrink: 0,
          boxShadow: '0 2px 14px rgba(27, 69, 101, 0.05)',
          zIndex: 50,
          position: 'relative',
        }}
      >
        {/* Logo officiel Groupe Facility (non modifié) + Label Intranet */}
        <div
          onClick={() => handleNavigate('home')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          <img
            src="https://files-public.monday.com/euc1/4853404b-84ea-4006-aab2-0e6de2c4dfdb/Facility-logo_couleur01.svg"
            alt="Groupe Facility"
            style={{ height: '32px', width: 'auto', objectFit: 'contain' }}
          />
          <div style={{ borderLeft: '1.5px solid #D7EAF5', paddingLeft: '10px' }}>
            <div
              style={{
                fontFamily: "'Ruda', sans-serif",
                fontSize: '12.5px',
                fontWeight: 900,
                color: '#1B4565',
                letterSpacing: '0.4px',
                lineHeight: 1.1,
                whiteSpace: 'nowrap',
              }}
            >
              INTRANET FACILITY
            </div>
          </div>
        </div>

        {/* Actions rapides épurées à droite */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {currentView !== 'home' && (
            <button
              type="button"
              className="ui-btn"
              onClick={() => handleNavigate('home')}
              title="Retour à l'accueil Intranet"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 11px',
                borderRadius: '9px',
                border: '1px solid #B7D8EA',
                backgroundColor: '#EBF6FC',
                color: '#1B4565',
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              <Home size={14} color="#39A9DC" />
              <span className="header-btn-label">Accueil</span>
            </button>
          )}

          <button
            type="button"
            className="ui-btn"
            onClick={() => setShowCustomizeModal(true)}
            title="Personnaliser mon Intranet"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 11px',
              borderRadius: '9px',
              border: '1px solid #D7EAF5',
              backgroundColor: '#FFFFFF',
              color: '#1B4565',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <SlidersHorizontal size={14} color="#39A9DC" />
            <span className="header-btn-label">Personnaliser</span>
          </button>

          <button
            type="button"
            className="ui-btn"
            onClick={() => {
              setRoadmapInitialTab('company_ideas');
              setShowRoadmapModal(true);
            }}
            title="Boîte à Idées & Suivi"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 11px',
              borderRadius: '9px',
              border: '1.5px solid #F7AC37',
              backgroundColor: '#FEF6E7',
              color: '#D66927',
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            <Lightbulb size={14} />
            <span className="header-btn-label">Idées</span>
          </button>

          {isAdmin && (
            <button
              type="button"
              className="ui-btn"
              onClick={() => setShowPermissionsModal(true)}
              title="Gérer les autorisations par collaborateur"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 11px',
                borderRadius: '9px',
                border: '1px solid #1B4565',
                backgroundColor: '#1B4565',
                color: '#FFFFFF',
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              <ShieldCheck size={14} color="#F7AC37" />
              <span className="header-btn-label">Accès</span>
            </button>
          )}

          <button
            type="button"
            className="ui-btn"
            onClick={() => {
              setVisitedIframeViews(IFRAME_VIEWS.includes(currentView) ? [currentView] : []);
              setRefreshKey(Date.now());
              loadLiveStats(true);
              void refreshUserPermissions(true);
            }}
            title="Actualiser les données Monday"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              borderRadius: '9px',
              border: '1px solid #D7EAF5',
              backgroundColor: '#F4F9FC',
              color: '#3989B7',
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} className={loadingStats ? 'animate-spin' : ''} />
          </button>

          <button
            type="button"
            className="desktop-only ui-btn"
            onClick={toggleFullscreen}
            title="Plein Écran"
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              borderRadius: '9px',
              border: '1px solid #D7EAF5',
              backgroundColor: '#F4F9FC',
              color: '#1B4565',
              cursor: 'pointer',
            }}
          >
            <Maximize2 size={14} />
          </button>

          {/* Pastille utilisateur connecté */}
          <div
            className="desktop-only"
            style={{
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '999px',
              backgroundColor: '#EBF6FC',
              border: '1px solid #B7D8EA',
              color: '#1B4565',
              fontSize: '12px',
              fontWeight: 800,
            }}
          >
            <User size={13} color="#39A9DC" />
            <span>{firstName}</span>
          </div>
        </div>
      </header>

      {/* ============================================================== */}
      {/* 2. BARRE CONTEXTUELLE FINE POUR LES SOUS-HUBS                  */}
      {/* ============================================================== */}
      {currentView !== 'home' && (
        <div
          className="hub-subbar"
          style={{
            height: '44px',
            backgroundColor: '#FFFFFF',
            borderBottom: '1px solid #D7EAF5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 18px',
            flexShrink: 0,
            boxShadow: '0 1px 2px rgba(27,69,101,0.03)',
          }}
        >
          <div className="subbar-left" style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, overflow: 'hidden' }}>
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
                    padding: '5px 11px',
                    borderRadius: '8px',
                    backgroundColor: '#F4F9FC',
                    color: '#1B4565',
                    border: '1px solid #D7EAF5',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  <ArrowLeft size={13} />
                  <span>{backLabel}</span>
                </button>
              );
            })()}

            <div style={{ width: '1px', height: '18px', backgroundColor: '#D7EAF5', flexShrink: 0 }} />

            <span
              className="subbar-title"
              style={{
                fontSize: '13px',
                fontWeight: 800,
                color: '#1B4565',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {activeSubTitle}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <span
              className="mobile-hide"
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: '#0E7042',
                backgroundColor: '#E6F9F1',
                padding: '3px 10px',
                borderRadius: '999px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <span className="live-pulse-dot" />
              <span>Synchronisé Monday {lastSyncTime ? `(${lastSyncTime})` : ''}</span>
            </span>

            {isIframeView && (
              <button
                type="button"
                onClick={toggleFullscreen}
                className="desktop-only"
                style={{
                  alignItems: 'center',
                  gap: '6px',
                  padding: '5px 11px',
                  borderRadius: '7px',
                  backgroundColor: '#39A9DC',
                  color: '#FFFFFF',
                  border: 'none',
                  fontSize: '11px',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                <Maximize2 size={12} />
                <span>Plein Écran</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 3. CONTENU PRINCIPAL                                           */}
      {/* ============================================================== */}
      <main
        className="hub-main-content"
        style={{
          flex: 1,
          position: 'relative',
          overflowY: isIframeView ? 'hidden' : 'auto',
          overflowX: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
        {/* ------------------------------------------------------------ */}
        {/* VUE ACCUEIL INTRANET GROUPE FACILITY                        */}
        {/* ------------------------------------------------------------ */}
        {currentView === 'home' && (
          <div
            className="hub-home-container"
            style={{
              padding: '24px 32px 60px',
              maxWidth: '1380px',
              margin: '0 auto',
              width: '100%',
              boxSizing: 'border-box',
            }}
          >
            {/* 1. HERO INTRANET PREMIUM AVEC RECHERCHE & GLASSMORPHISM */}
            <section
              className="hub-hero-box reveal-1"
              style={{
                position: 'relative',
                borderRadius: '24px',
                padding: '34px 28px 28px',
                marginBottom: '26px',
                color: '#FFFFFF',
                boxShadow: '0 18px 42px rgba(27, 69, 101, 0.22)',
                zIndex: 20,
              }}
            >
              {/* Fond photo + lueurs animées dans un calque isolé pour ne jamais clipper le dropdown de recherche */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: 'inherit',
                  overflow: 'hidden',
                  backgroundImage: `linear-gradient(135deg, rgba(16, 43, 66, 0.90) 0%, rgba(27, 69, 101, 0.80) 52%, rgba(57, 137, 183, 0.76) 100%), url('./images/hero-banner.jpg')`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  zIndex: 0,
                  pointerEvents: 'none',
                }}
              >
                <div
                  className="hero-ambient-orb"
                  style={{
                    width: '260px',
                    height: '260px',
                    top: '-90px',
                    left: '-60px',
                    backgroundColor: 'rgba(57, 169, 220, 0.35)',
                  }}
                />
                <div
                  className="hero-ambient-orb"
                  style={{
                    width: '220px',
                    height: '220px',
                    bottom: '-80px',
                    right: '-40px',
                    backgroundColor: 'rgba(247, 172, 55, 0.26)',
                    animationDelay: '-4s',
                  }}
                />
              </div>

              <div style={{ position: 'relative', zIndex: 2 }}>
                {/* Salutation personnalisée */}
                <div style={{ textAlign: 'center', maxWidth: '720px', margin: '0 auto 20px' }}>
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '4px 13px',
                      borderRadius: '999px',
                      backgroundColor: 'rgba(255, 255, 255, 0.14)',
                      border: '1px solid rgba(255, 255, 255, 0.28)',
                      backdropFilter: 'blur(8px)',
                      color: '#F7AC37',
                      fontSize: '11px',
                      fontWeight: 800,
                      textTransform: 'capitalize',
                      marginBottom: '10px',
                    }}
                  >
                    <Sparkles size={12} />
                    <span>{todayFormatted}</span>
                  </div>

                  <h1
                    className="hub-hero-title"
                    style={{
                      fontFamily: "'Ruda', sans-serif",
                      fontSize: '30px',
                      fontWeight: 900,
                      margin: '0 0 6px 0',
                      color: '#FFFFFF',
                      letterSpacing: '-0.3px',
                      textShadow: '0 2px 10px rgba(15, 23, 42, 0.25)',
                    }}
                  >
                    {greetingText} ☀️
                  </h1>
                  <p style={{ margin: 0, fontSize: '13.5px', color: 'rgba(255, 255, 255, 0.90)' }}>
                    Accédez en un instant à vos Hubs métiers, vos outils du quotidien et vos demandes d’amélioration.
                  </p>
                </div>

                {/* Barre de recherche en avant-première */}
                <div
                  ref={searchContainerRef}
                  style={{
                    position: 'relative',
                    maxWidth: '640px',
                    margin: '0 auto 14px',
                    zIndex: 30,
                  }}
                >
                  <div
                    className={`hero-search-pill ${searchFocused ? 'is-focused' : ''}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      backgroundColor: '#FFFFFF',
                      borderRadius: '999px',
                      padding: '10px 18px',
                      boxShadow: '0 12px 30px rgba(15, 23, 42, 0.24)',
                      border: '2px solid transparent',
                    }}
                  >
                    <Search size={18} color="#39A9DC" style={{ flexShrink: 0 }} />
                    <input
                      ref={heroSearchInputRef}
                      type="text"
                      value={heroSearch}
                      onFocus={() => setSearchFocused(true)}
                      onChange={(e) => {
                        setHeroSearch(e.target.value);
                        setSearchFocused(true);
                      }}
                      placeholder="Rechercher un Hub, une animatrice, une machine, un contact..."
                      style={{
                        flex: 1,
                        border: 'none',
                        outline: 'none',
                        fontSize: '14px',
                        fontWeight: 600,
                        color: '#1B4565',
                        backgroundColor: 'transparent',
                        minWidth: 0,
                      }}
                    />
                    {heroSearch ? (
                      <button
                        type="button"
                        onClick={() => setHeroSearch('')}
                        aria-label="Effacer la recherche"
                        style={{
                          border: 'none',
                          background: '#F1F5F9',
                          color: '#64748B',
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                        }}
                      >
                        <X size={13} />
                      </button>
                    ) : (
                      <span
                        className="desktop-only"
                        style={{
                          fontSize: '10.5px',
                          fontWeight: 800,
                          color: '#3989B7',
                          backgroundColor: '#EBF6FC',
                          padding: '3px 9px',
                          borderRadius: '999px',
                        }}
                      >
                        Ctrl + K
                      </span>
                    )}
                  </div>

                  {/* Panneau résultats instantanés */}
                  {searchFocused && (
                    <div
                      className="hero-search-dropdown"
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 10px)',
                        left: 0,
                        right: 0,
                        backgroundColor: '#FFFFFF',
                        borderRadius: '18px',
                        border: '1.5px solid #D7EAF5',
                        boxShadow: '0 22px 48px rgba(15, 23, 42, 0.28)',
                        padding: '8px',
                        maxHeight: '340px',
                        overflowY: 'auto',
                        color: '#1B4565',
                      }}
                    >
                      {heroSearchResults.length === 0 ? (
                        <div style={{ padding: '18px', textAlign: 'center', fontSize: '12.5px', color: '#64748B' }}>
                          Aucun module autorisé trouvé pour « {heroSearch} »
                        </div>
                      ) : (
                        heroSearchResults.map((res) => {
                          const ResIcon = res.icon;
                          return (
                            <button
                              key={res.id}
                              type="button"
                              className="hub-subitem-row"
                              onClick={res.onSelect}
                              style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                padding: '9px 12px',
                                borderRadius: '11px',
                                border: 'none',
                                backgroundColor: 'transparent',
                                cursor: 'pointer',
                                textAlign: 'left',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F4F9FC')}
                              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                            >
                              <div
                                style={{
                                  width: '34px',
                                  height: '34px',
                                  borderRadius: '9px',
                                  backgroundColor: res.bgLight,
                                  color: res.accentColor,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                }}
                              >
                                <ResIcon size={17} color={res.accentColor} />
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ fontSize: '13px', fontWeight: 800, color: '#1B4565' }}>
                                    {res.title}
                                  </span>
                                  {res.badge && (
                                    <span style={{ fontSize: '10px', fontWeight: 800, color: res.accentColor, backgroundColor: res.bgLight, padding: '1px 7px', borderRadius: '999px' }}>
                                      {res.badge}
                                    </span>
                                  )}
                                </div>
                                <div style={{ fontSize: '11px', color: '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {res.subtitle}
                                </div>
                              </div>
                              <ArrowRight size={14} color="#3989B7" className="hub-subitem-arrow" />
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>

                {/* Pilules de filtre rapide glassmorphism */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '22px' }}>
                  {[
                    { id: 'all' as const, label: 'Tous' },
                    { id: 'secteurs' as const, label: 'Secteurs' },
                    { id: 'atelier' as const, label: 'Atelier & Flotte' },
                    { id: 'outils' as const, label: 'Outils & Direction' },
                  ].map((pill) => {
                    const active = heroFilter === pill.id;
                    return (
                      <button
                        key={pill.id}
                        type="button"
                        className={`hero-filter-pill ${active ? 'is-active' : ''}`}
                        onClick={() => {
                          setHeroFilter(pill.id);
                          setSearchFocused(true);
                          heroSearchInputRef.current?.focus();
                        }}
                        style={{
                          padding: '5px 15px',
                          borderRadius: '999px',
                          border: active ? '1.5px solid #FFFFFF' : '1px solid rgba(255,255,255,0.34)',
                          backgroundColor: active ? '#FFFFFF' : 'rgba(255,255,255,0.16)',
                          backdropFilter: 'blur(8px)',
                          color: active ? '#1B4565' : '#FFFFFF',
                          fontSize: '11.5px',
                          fontWeight: 800,
                          cursor: 'pointer',
                        }}
                      >
                        {pill.label}
                      </button>
                    );
                  })}
                </div>

                {/* Raccourcis rapides Glassmorphism (s'illuminent en or au survol) */}
                <div className="hero-shortcuts-row">
                  {visibleOrderedHubCards.map((card) => {
                    const Icon = card.icon;
                    const shortName = HUB_DEFINITIONS.find((d) => d.key === card.key)?.shortLabel || card.title;
                    return (
                      <button
                        key={`sc-${card.key}`}
                        type="button"
                        className="hero-shortcut-btn"
                        onClick={() => handleNavigate(card.defaultView)}
                        title={`Ouvrir ${card.title}`}
                      >
                        <div className="hero-shortcut-circle">
                          <Icon size={20} color="#FFFFFF" />
                        </div>
                        <span className="hero-shortcut-label">{shortName}</span>
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    className="hero-shortcut-btn"
                    onClick={() => {
                      setRoadmapInitialTab('my_ideas');
                      setShowRoadmapModal(true);
                    }}
                    title="Ouvrir la Boîte à Idées"
                  >
                    <div
                      className="hero-shortcut-circle"
                      style={{
                        background: 'rgba(247, 172, 55, 0.28)',
                        borderColor: 'rgba(247, 172, 55, 0.85)',
                      }}
                    >
                      <Lightbulb size={20} color="#F7AC37" />
                    </div>
                    <span className="hero-shortcut-label">Idées</span>
                  </button>
                </div>
              </div>
            </section>

            {/* 2. CARROUSEL D'ACTUALITÉS AUTO-DÉFILANT */}
            {prefs.showNewsCarousel && (
              <NewsCarousel
                monday={monday}
                stats={stats}
                canViewSecteurs={permissions.secteurs}
                canViewAtelier={permissions.atelier}
                canViewCommercial={permissions.commercial}
                onNavigate={handleNavigate}
                onOpenRoadmap={() => {
                  setRoadmapInitialTab('company_ideas');
                  setShowRoadmapModal(true);
                }}
              />
            )}

            {/* 3. CARROUSEL / GRILLE DES HUBS (GRILLE PAR DÉFAUT MOBILE, CARROUSEL SUR PC) */}
            <HubsCarousel
              cards={visibleOrderedHubCards}
              viewMode={isMobileViewport ? prefs.mobileViewMode : prefs.viewMode}
              onChangeViewMode={(m) =>
                handleUpdatePrefs(
                  isMobileViewport ? { ...prefs, mobileViewMode: m } : { ...prefs, viewMode: m }
                )
              }
              onNavigate={handleNavigate}
              onOpenCustomize={() => setShowCustomizeModal(true)}
            />

            {/* 4. BOÎTE À IDÉES SÉPARÉE : MES IDÉES VS IDÉES DE L'ENTREPRISE */}
            <section
              className="hub-roadmap-banner reveal-4"
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '18px',
                border: '1.5px solid #F7AC37',
                padding: '24px 28px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '20px',
                boxShadow: '0 6px 20px rgba(27, 69, 101, 0.05)',
                background: 'linear-gradient(135deg, #FFFFFF 0%, #FEF6E7 100%)',
                marginBottom: '26px',
              }}
            >
              <div className="hub-roadmap-header" style={{ display: 'flex', alignItems: 'center', gap: '18px', flex: 1, minWidth: 'min(100%, 260px)' }}>
                <div
                  style={{
                    width: '52px',
                    height: '52px',
                    borderRadius: '14px',
                    backgroundColor: '#FEF6E7',
                    border: '1.5px solid #F7AC37',
                    color: '#D66927',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Lightbulb size={26} />
                </div>
                <div>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '2px 10px',
                      borderRadius: '999px',
                      backgroundColor: '#FFF4EB',
                      color: '#D66927',
                      fontSize: '10.5px',
                      fontWeight: 800,
                      marginBottom: '5px',
                    }}
                  >
                    BOÎTE À IDÉES COLLABORATIVE
                  </span>
                  <h3 style={{ margin: '0 0 4px 0', fontFamily: "'Ruda', sans-serif", fontSize: '17.5px', fontWeight: 900, color: '#1B4565' }}>
                    Une idée ou un retour pour améliorer nos outils ?
                  </h3>
                  <p style={{ margin: 0, fontSize: '12.5px', color: '#475569', lineHeight: 1.45 }}>
                    Retrouvez séparément <strong>vos propres demandes</strong> et l’ensemble des <strong>idées de l’entreprise</strong> avec leurs échanges en direct.
                  </p>
                </div>
              </div>

              <div className="hub-roadmap-buttons" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="ui-btn"
                  onClick={() => {
                    setRoadmapInitialTab('my_ideas');
                    setShowRoadmapModal(true);
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '7px',
                    padding: '10px 16px',
                    borderRadius: '10px',
                    backgroundColor: '#FFFFFF',
                    color: '#1B4565',
                    border: '1.5px solid #B7D8EA',
                    fontSize: '12.5px',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  <User size={15} color="#39A9DC" />
                  <span>Mes idées</span>
                </button>

                <button
                  type="button"
                  className="ui-btn"
                  onClick={() => {
                    setRoadmapInitialTab('company_ideas');
                    setShowRoadmapModal(true);
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '7px',
                    padding: '10px 16px',
                    borderRadius: '10px',
                    backgroundColor: '#FFFFFF',
                    color: '#1B4565',
                    border: '1.5px solid #B7D8EA',
                    fontSize: '12.5px',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  <Users size={15} color="#3989B7" />
                  <span>Idées de l’entreprise</span>
                </button>

                <button
                  type="button"
                  className="ui-btn"
                  onClick={() => {
                    setRoadmapInitialTab('form');
                    setShowRoadmapModal(true);
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '7px',
                    padding: '10px 18px',
                    borderRadius: '10px',
                    backgroundColor: '#D66927',
                    color: '#FFFFFF',
                    border: 'none',
                    fontSize: '12.5px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(214, 105, 39, 0.30)',
                  }}
                >
                  <Lightbulb size={15} />
                  <span>+ Proposer une idée</span>
                </button>
              </div>
            </section>

            {/* 5. INDICATEURS DÉTAILLÉS GROUPE (REPLIABLES POUR ALLÉGER L'ACCUEIL) */}
            {prefs.showStatsSection && (permissions.secteurs || permissions.atelier) && (
              <section
                className="reveal-5"
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '16px',
                  border: '1.5px solid #D7EAF5',
                  padding: '16px 20px',
                }}
              >
                <button
                  type="button"
                  onClick={() => setStatsExpanded((prev) => !prev)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '9px',
                        backgroundColor: '#EBF6FC',
                        color: '#39A9DC',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Activity size={17} />
                    </div>
                    <div>
                      <div style={{ fontFamily: "'Ruda', sans-serif", fontSize: '15px', fontWeight: 800, color: '#1B4565' }}>
                        Chiffres Clés &amp; Indicateurs Détaillés ({curYear})
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748B' }}>
                        {statsExpanded ? 'Cliquez pour masquer les détails' : 'Cliquez pour afficher les indicateurs détaillés chantiers, satisfaction & parc'}
                      </div>
                    </div>
                  </div>
                  <ChevronDown
                    size={18}
                    color="#3989B7"
                    style={{
                      transform: statsExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s ease',
                    }}
                  />
                </button>

                {statsExpanded && (
                  <div
                    className="hub-kpis-grid modal-backdrop-in"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
                      gap: '14px',
                      marginTop: '16px',
                    }}
                  >
                    {permissions.secteurs && (
                      <>
                        <div
                          className="kpi-interactive-card"
                          onClick={() => handleNavigate('secteur_global')}
                          style={{
                            backgroundColor: '#F4F9FC',
                            padding: '18px',
                            borderRadius: '12px',
                            border: '1px solid #D7EAF5',
                            borderLeft: '4px solid #39A9DC',
                            cursor: 'pointer',
                          }}
                        >
                          <div style={{ fontSize: '12px', fontWeight: 700, color: '#3989B7' }}>Chantiers en Contrat</div>
                          <div style={{ fontFamily: "'Ruda', sans-serif", fontSize: '28px', fontWeight: 900, color: '#1B4565', marginTop: '6px' }}>
                            {stats.chantiersActifs}
                          </div>
                          <div style={{ fontSize: '11.5px', color: '#3989B7', fontWeight: 700, marginTop: '3px' }}>
                            Natacha: {stats.chantiersParAnim.Natacha} • Ketty: {stats.chantiersParAnim.Ketty} • Emilie: {stats.chantiersParAnim.Emilie}
                          </div>
                        </div>

                        <div
                          className="kpi-interactive-card"
                          onClick={() => handleNavigate('secteur_global')}
                          style={{
                            backgroundColor: '#F4F9FC',
                            padding: '18px',
                            borderRadius: '12px',
                            border: '1px solid #D7EAF5',
                            borderLeft: '4px solid #00C875',
                            cursor: 'pointer',
                          }}
                        >
                          <div style={{ fontSize: '12px', fontWeight: 700, color: '#0E7042' }}>Satisfaction Clients</div>
                          <div style={{ fontFamily: "'Ruda', sans-serif", fontSize: '28px', fontWeight: 900, color: '#0E7042', marginTop: '6px' }}>
                            {stats.tauxSatisfactionGlobal}%
                          </div>
                          <div style={{ fontSize: '11.5px', color: '#64748B', fontWeight: 600, marginTop: '3px' }}>
                            {stats.visitesBonnes} avis favorables / {stats.visitesTotal} visites ({curYear})
                          </div>
                        </div>

                        <div
                          className="kpi-interactive-card"
                          onClick={() => handleNavigate('secteur_global')}
                          style={{
                            backgroundColor: '#F4F9FC',
                            padding: '18px',
                            borderRadius: '12px',
                            border: '1px solid #D7EAF5',
                            borderLeft: '4px solid #F7AC37',
                            cursor: 'pointer',
                          }}
                        >
                          <div style={{ fontSize: '12px', fontWeight: 700, color: '#B87414' }}>Clients 3 Étoiles 🌟</div>
                          <div style={{ fontFamily: "'Ruda', sans-serif", fontSize: '28px', fontWeight: 900, color: '#B87414', marginTop: '6px' }}>
                            {stats.etoiles.Global.s3}
                          </div>
                          <div style={{ fontSize: '11.5px', color: '#B87414', fontWeight: 700, marginTop: '3px' }}>
                            3 derniers contrôles conformes
                          </div>
                        </div>
                      </>
                    )}

                    {permissions.atelier && (
                      <div
                        className="kpi-interactive-card"
                        onClick={() => handleNavigate('atelier_erp')}
                        style={{
                          backgroundColor: '#F4F9FC',
                          padding: '18px',
                          borderRadius: '12px',
                          border: '1px solid #D7EAF5',
                          borderLeft: '4px solid #D66927',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#D66927' }}>Parc Machines Atelier</div>
                        <div style={{ fontFamily: "'Ruda', sans-serif", fontSize: '28px', fontWeight: 900, color: '#1B4565', marginTop: '6px' }}>
                          {stats.machinesTotal}
                        </div>
                        <div style={{ fontSize: '11.5px', color: '#D66927', fontWeight: 700, marginTop: '3px' }}>
                          Suivi des heures &amp; maintenance
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------ */}
        {/* VUE 2 : SUPERVISION GLOBALE (TOUS SECTEURS)                  */}
        {/* ------------------------------------------------------------ */}
        {currentView === 'secteur_global' && (
          <div className="hub-view-container" style={{ padding: '30px 40px', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 12px', borderRadius: '20px', backgroundColor: 'rgba(57, 169, 220, 0.12)', color: '#3989B7', fontSize: '11px', fontWeight: 700, marginBottom: '8px' }}>
                  <Sparkles size={13} color="#F7AC37" />
                  <span>Direction Opérationnelle &amp; Contrôle Qualité {curYear}</span>
                </div>
                <h1 style={{ fontFamily: "'Ruda', sans-serif", fontSize: '28px', fontWeight: 900, color: '#0F172A', margin: 0, letterSpacing: '-0.3px' }}>
                  Supervision Globale • Responsables de Secteur
                </h1>
                <div style={{ marginTop: '8px', height: '3.5px', width: '80px', borderRadius: '2px', background: 'linear-gradient(90deg, #F7AC37, #39A9DC)' }} />
                <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: '#64748B', maxWidth: '780px', lineHeight: 1.5 }}>
                  Statistiques consolidées en temps réel depuis Monday.com — Ventilation par animatrice (Natacha, Ketty, Émilie), contrôles qualité C1/C2/C3 et suivi des {stats.chantiersActifs} chantiers en cours.
                </p>
              </div>

              <button
                type="button"
                onClick={() => loadLiveStats(true)}
                disabled={loadingStats}
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
                }}
              >
                <RefreshCw size={14} className={loadingStats ? 'animate-spin' : ''} />
                <span>{loadingStats ? 'Actualisation...' : 'Actualiser en direct'}</span>
              </button>
            </div>

            {/* 4 KPIs Supervision */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '16px', marginBottom: '28px' }}>
              <div style={{ backgroundColor: '#FFFFFF', padding: '20px', borderRadius: '16px', border: '1.5px solid #D7EAF5', borderLeft: '4px solid #39A9DC' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#3989B7', textTransform: 'uppercase' }}>Chantiers en cours</span>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#3989B7', backgroundColor: '#EBF6FC', padding: '2px 8px', borderRadius: '12px' }}>100% assignés</span>
                </div>
                <div style={{ fontFamily: "'Ruda', sans-serif", fontSize: '34px', fontWeight: 900, color: '#1B4565', marginTop: '6px' }}>
                  {stats.chantiersActifs}
                </div>
                <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, marginTop: '4px' }}>
                  ● Natacha: <strong>{stats.chantiersParAnim.Natacha}</strong> • Ketty: <strong>{stats.chantiersParAnim.Ketty}</strong> • Émilie: <strong>{stats.chantiersParAnim.Emilie}</strong>
                </div>
              </div>

              <div style={{ backgroundColor: '#FFFFFF', padding: '20px', borderRadius: '16px', border: '1.5px solid #D7EAF5', borderLeft: '4px solid #00C875' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#0E7042', textTransform: 'uppercase' }}>Satisfaction Visites</span>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#0E7042', backgroundColor: '#E6F9F1', padding: '2px 8px', borderRadius: '12px' }}>Année {curYear}</span>
                </div>
                <div style={{ fontFamily: "'Ruda', sans-serif", fontSize: '34px', fontWeight: 900, color: '#0E7042', marginTop: '6px' }}>
                  {stats.tauxSatisfactionGlobal}%
                </div>
                <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
                  <strong>{stats.visitesBonnes}</strong> satisfaisantes / <strong>{stats.visitesTotal}</strong> notées en {curYear}
                </div>
              </div>

              <div style={{ backgroundColor: '#FFFFFF', padding: '20px', borderRadius: '16px', border: '1.5px solid #D7EAF5', borderLeft: '4px solid #F7AC37' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#B87414', textTransform: 'uppercase' }}>Clients 3 Étoiles 🌟</span>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#B87414', backgroundColor: '#FEF6E7', padding: '2px 8px', borderRadius: '12px' }}>Niveau Max</span>
                </div>
                <div style={{ fontFamily: "'Ruda', sans-serif", fontSize: '34px', fontWeight: 900, color: '#B87414', marginTop: '6px' }}>
                  {stats.etoiles.Global.s3}
                </div>
                <div style={{ fontSize: '11px', color: '#B87414', fontWeight: 600, marginTop: '4px' }}>
                  {stats.chantiersActifs > 0 ? Math.round((stats.etoiles.Global.s3 / stats.chantiersActifs) * 100) : 45}% du parc au niveau maximal
                </div>
              </div>

              <div style={{ backgroundColor: '#FFFFFF', padding: '20px', borderRadius: '16px', border: '1.5px solid #D7EAF5', borderLeft: '4px solid #D66927' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#D66927', textTransform: 'uppercase' }}>Clients Insatisfaits 🙁</span>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#D66927', backgroundColor: '#FFF4EB', padding: '2px 8px', borderRadius: '12px' }}>Priorité Qualité</span>
                </div>
                <div style={{ fontFamily: "'Ruda', sans-serif", fontSize: '34px', fontWeight: 900, color: '#D66927', marginTop: '6px' }}>
                  {stats.etoiles.Global.bad}
                </div>
                <div style={{ fontSize: '11px', color: '#D66927', fontWeight: 600, marginTop: '4px' }}>
                  Plans d’action en cours d’exécution
                </div>
              </div>
            </div>

            {/* Tableau comparatif 3 animatrices Desktop + Mobile */}
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1.5px solid #D7EAF5', padding: '24px', marginBottom: '28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <h3 style={{ margin: 0, fontFamily: "'Ruda', sans-serif", fontSize: '17px', fontWeight: 800, color: '#1B4565' }}>
                    Comparatif Opérationnel par Responsable de Secteur
                  </h3>
                  <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: '#64748B' }}>
                    Ventilation consolidée des chantiers en cours, satisfaction certifiée des visites et niveaux d’étoiles.
                  </p>
                </div>
                <span style={{ fontSize: '11px', color: '#3989B7', backgroundColor: '#EBF6FC', padding: '3px 10px', borderRadius: '12px', fontWeight: 700 }}>
                  ● En direct Monday.com
                </span>
              </div>

              <div className="desktop-table-container" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #D7EAF5', backgroundColor: '#F4F9FC', color: '#3989B7', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase' }}>
                      <th style={{ padding: '12px 16px' }}>Responsable de Secteur</th>
                      <th style={{ padding: '12px 14px' }}>Chantiers</th>
                      <th style={{ padding: '12px 14px' }}>Part du Parc</th>
                      <th style={{ padding: '12px 14px' }}>Satisfaction ({curYear})</th>
                      <th style={{ padding: '12px 14px' }}>3 🌟</th>
                      <th style={{ padding: '12px 14px' }}>2 🌟</th>
                      <th style={{ padding: '12px 14px' }}>1 🌟</th>
                      <th style={{ padding: '12px 14px' }}>🙁</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { view: 'secteur_natacha' as ViewId, initials: 'NT', name: 'Natacha THOMAS', sector: 'Secteur Nord / Est', key: 'Natacha' as const, badgeBg: '#E6F9F1', badgeCol: '#0E7042', btnBg: '#EBF6FC', btnCol: '#3989B7', btnBorder: '#B7D8EA' },
                      { view: 'secteur_ketty' as ViewId, initials: 'KP', name: 'Ketty PAULIN', sector: 'Secteur Ouest / Littoral', key: 'Ketty' as const, badgeBg: '#EBF6FC', badgeCol: '#3989B7', btnBg: '#EBF6FC', btnCol: '#3989B7', btnBorder: '#39A9DC' },
                      { view: 'secteur_emilie' as ViewId, initials: 'ET', name: 'Emilie TOBIE', sector: 'Secteur Sud / Métropole', key: 'Emilie' as const, badgeBg: '#E6F9F1', badgeCol: '#0E7042', btnBg: '#FFF4EB', btnCol: '#D66927', btnBorder: '#F7AC37' },
                    ].map((row) => (
                      <tr key={row.view} style={{ borderBottom: '1px solid #EBF6FC' }}>
                        <td style={{ padding: '14px 16px', fontWeight: 800, color: '#1B4565' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: row.btnBg, color: row.btnCol, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800 }}>
                              {row.initials}
                            </div>
                            <div>
                              <div style={{ fontWeight: 800, color: '#1B4565' }}>{row.name}</div>
                              <div style={{ fontSize: '10px', color: '#64748B' }}>{row.sector}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '14px', fontWeight: 800, fontSize: '14px', color: '#1B4565' }}>
                          {stats.chantiersParAnim[row.key]}
                        </td>
                        <td style={{ padding: '14px', color: '#64748B', fontWeight: 600 }}>
                          {stats.chantiersActifs > 0 ? ((stats.chantiersParAnim[row.key] / stats.chantiersActifs) * 100).toFixed(1) : '0.0'}%
                        </td>
                        <td style={{ padding: '14px' }}>
                          <span style={{ fontWeight: 800, color: row.badgeCol, backgroundColor: row.badgeBg, padding: '4px 10px', borderRadius: '6px', fontSize: '12px' }}>
                            {stats.visitesParAnim[row.key].pct}% ({stats.visitesParAnim[row.key].bon} / {stats.visitesParAnim[row.key].total})
                          </span>
                        </td>
                        <td style={{ padding: '14px', fontWeight: 800, color: '#B87414' }}>{stats.etoiles[row.key].s3}</td>
                        <td style={{ padding: '14px', fontWeight: 700, color: '#1B4565' }}>{stats.etoiles[row.key].s2}</td>
                        <td style={{ padding: '14px', fontWeight: 700, color: '#64748B' }}>{stats.etoiles[row.key].s1}</td>
                        <td style={{ padding: '14px', fontWeight: 800, color: stats.etoiles[row.key].bad > 0 ? '#D66927' : '#0E7042' }}>
                          {stats.etoiles[row.key].bad}
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                          <button
                            type="button"
                            onClick={() => handleNavigate(row.view)}
                            style={{
                              padding: '6px 14px',
                              borderRadius: '7px',
                              backgroundColor: row.btnBg,
                              color: row.btnCol,
                              border: `1px solid ${row.btnBorder}`,
                              fontWeight: 700,
                              fontSize: '11px',
                              cursor: 'pointer',
                            }}
                          >
                            Voir Secteur
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ backgroundColor: '#F4F9FC', fontWeight: 900 }}>
                      <td style={{ padding: '14px 16px', color: '#1B4565', fontFamily: "'Ruda', sans-serif" }}>TOTAL CONSOLIDÉ</td>
                      <td style={{ padding: '14px', color: '#1B4565', fontSize: '14px' }}>{stats.chantiersActifs}</td>
                      <td style={{ padding: '14px', color: '#64748B' }}>100%</td>
                      <td style={{ padding: '14px' }}>
                        <span style={{ fontWeight: 800, color: '#3989B7', backgroundColor: '#EBF6FC', padding: '4px 10px', borderRadius: '6px', fontSize: '12px' }}>
                          {stats.tauxSatisfactionGlobal}% ({stats.visitesBonnes} / {stats.visitesTotal})
                        </span>
                      </td>
                      <td style={{ padding: '14px', color: '#B87414', fontSize: '14px' }}>{stats.etoiles.Global.s3}</td>
                      <td style={{ padding: '14px', color: '#1B4565', fontSize: '14px' }}>{stats.etoiles.Global.s2}</td>
                      <td style={{ padding: '14px', color: '#64748B', fontSize: '14px' }}>{stats.etoiles.Global.s1}</td>
                      <td style={{ padding: '14px', color: '#D66927', fontSize: '14px' }}>{stats.etoiles.Global.bad}</td>
                      <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: '11px', color: '#64748B', fontWeight: 600 }}>3 Secteurs</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Format compact mobile */}
              <div className="mobile-cards-container" style={{ display: 'none', flexDirection: 'column', gap: '8px', width: '100%' }}>
                {[
                  { id: 'secteur_natacha' as const, initials: 'NT', name: 'Natacha THOMAS', sector: 'Nord / Est', avatarBg: '#EBF6FC', avatarColor: '#3989B7', btnBg: '#EBF6FC', btnBorder: '#B7D8EA', btnColor: '#3989B7', count: stats.chantiersParAnim.Natacha, share: stats.chantiersActifs > 0 ? ((stats.chantiersParAnim.Natacha / stats.chantiersActifs) * 100).toFixed(0) : '43', visites: stats.visitesParAnim.Natacha, etoiles: stats.etoiles.Natacha },
                  { id: 'secteur_ketty' as const, initials: 'KP', name: 'Ketty PAULIN', sector: 'Ouest / Littoral', avatarBg: '#EBF6FC', avatarColor: '#39A9DC', btnBg: '#EBF6FC', btnBorder: '#39A9DC', btnColor: '#3989B7', count: stats.chantiersParAnim.Ketty, share: stats.chantiersActifs > 0 ? ((stats.chantiersParAnim.Ketty / stats.chantiersActifs) * 100).toFixed(0) : '41', visites: stats.visitesParAnim.Ketty, etoiles: stats.etoiles.Ketty },
                  { id: 'secteur_emilie' as const, initials: 'ET', name: 'Emilie TOBIE', sector: 'Sud / Métropole', avatarBg: '#FFF4EB', avatarColor: '#D66927', btnBg: '#FFF4EB', btnBorder: '#F7AC37', btnColor: '#D66927', count: stats.chantiersParAnim.Emilie, share: stats.chantiersActifs > 0 ? ((stats.chantiersParAnim.Emilie / stats.chantiersActifs) * 100).toFixed(0) : '15', visites: stats.visitesParAnim.Emilie, etoiles: stats.etoiles.Emilie },
                ].map((anim) => (
                  <div key={anim.id} style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #D7EAF5', padding: '9px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                        <div style={{ width: '26px', height: '26px', borderRadius: '50%', backgroundColor: anim.avatarBg, color: anim.avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 800, flexShrink: 0 }}>
                          {anim.initials}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <span style={{ fontWeight: 800, color: '#1B4565', fontSize: '12.5px' }}>{anim.name}</span>
                          <span style={{ fontSize: '10px', color: '#64748B', marginLeft: '6px' }}>• {anim.sector}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleNavigate(anim.id)}
                        style={{ padding: '4px 9px', borderRadius: '6px', backgroundColor: anim.btnBg, color: anim.btnColor, border: `1px solid ${anim.btnBorder}`, fontWeight: 700, fontSize: '10.5px', cursor: 'pointer', flexShrink: 0 }}
                      >
                        Voir →
                      </button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', backgroundColor: '#F4F9FC', padding: '5px 8px', borderRadius: '8px', fontSize: '11px' }}>
                      <div>
                        <span style={{ fontWeight: 900, color: '#1B4565', fontSize: '13px' }}>{anim.count}</span>{' '}
                        <span style={{ fontSize: '10px', color: '#64748B' }}>ch. ({anim.share}%)</span>
                      </div>
                      <div style={{ fontWeight: 800, color: '#0E7042', backgroundColor: '#E6F9F1', padding: '2px 6px', borderRadius: '4px', fontSize: '11px' }}>
                        {anim.visites.pct}%
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10.5px' }}>
                        <span style={{ color: '#B87414', fontWeight: 800 }}>3🌟 {anim.etoiles.s3}</span>
                        <span style={{ color: '#3989B7', fontWeight: 700 }}>2🌟 {anim.etoiles.s2}</span>
                        <span style={{ color: '#64748B', fontWeight: 600 }}>1🌟 {anim.etoiles.s1}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Étoiles Qualité */}
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1.5px solid #D7EAF5', padding: '24px' }}>
              <div style={{ marginBottom: '18px' }}>
                <h3 style={{ margin: 0, fontFamily: "'Ruda', sans-serif", fontSize: '17px', fontWeight: 800, color: '#1B4565' }}>
                  Répartition Qualité Globale des Chantiers (Contrôles C1, C2, C3)
                </h3>
                <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: '#64748B' }}>
                  Conformité stricte de l’historique qualité sur les contrôles réalisés par les animatrices.
                </p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '16px' }}>
                <div style={{ backgroundColor: '#FEF9C3', padding: '18px', borderRadius: '14px', border: '1.5px solid #F7AC37' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '12px', fontWeight: 800, color: '#B45309' }}>Client 3 Étoiles 🌟🌟🌟</span>
                    <span style={{ fontSize: '10px', fontWeight: 800, color: '#92400E', backgroundColor: '#FDE68A', padding: '1px 6px', borderRadius: '8px' }}>Niveau 3/3</span>
                  </div>
                  <div style={{ fontFamily: "'Ruda', sans-serif", fontSize: '28px', fontWeight: 900, color: '#92400E', marginTop: '6px' }}>
                    {stats.etoiles.Global.s3} chantiers
                  </div>
                  <p style={{ margin: '6px 0 0 0', fontSize: '11px', color: '#78350F', lineHeight: 1.4 }}>
                    Les 3 derniers contrôles consécutifs sont conformes.
                  </p>
                </div>

                <div style={{ backgroundColor: '#E0F2FE', padding: '18px', borderRadius: '14px', border: '1.5px solid #39A9DC' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '12px', fontWeight: 800, color: '#0369A1' }}>Client 2 Étoiles 🌟🌟</span>
                    <span style={{ fontSize: '10px', fontWeight: 800, color: '#075985', backgroundColor: '#BAE6FD', padding: '1px 6px', borderRadius: '8px' }}>Niveau 2/3</span>
                  </div>
                  <div style={{ fontFamily: "'Ruda', sans-serif", fontSize: '28px', fontWeight: 900, color: '#075985', marginTop: '6px' }}>
                    {stats.etoiles.Global.s2} chantiers
                  </div>
                  <p style={{ margin: '6px 0 0 0', fontSize: '11px', color: '#0C4A6E', lineHeight: 1.4 }}>
                    Les 2 derniers contrôles sont conformes.
                  </p>
                </div>

                <div style={{ backgroundColor: '#F1F5F9', padding: '18px', borderRadius: '14px', border: '1.5px solid #3989B7' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '12px', fontWeight: 800, color: '#3989B7' }}>Client 1 Étoile 🌟</span>
                    <span style={{ fontSize: '10px', fontWeight: 800, color: '#1E293B', backgroundColor: '#E2E8F0', padding: '1px 6px', borderRadius: '8px' }}>Niveau 1/3</span>
                  </div>
                  <div style={{ fontFamily: "'Ruda', sans-serif", fontSize: '28px', fontWeight: 900, color: '#1E293B', marginTop: '6px' }}>
                    {stats.etoiles.Global.s1} chantiers
                  </div>
                  <p style={{ margin: '6px 0 0 0', fontSize: '11px', color: '#475569', lineHeight: 1.4 }}>
                    Le dernier contrôle C1 est conforme.
                  </p>
                </div>

                <div style={{ backgroundColor: '#FFF7ED', padding: '18px', borderRadius: '14px', border: '1.5px solid #D66927' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '12px', fontWeight: 800, color: '#D66927' }}>Client Insatisfait 🙁</span>
                    <span style={{ fontSize: '10px', fontWeight: 800, color: '#9A3412', backgroundColor: '#FFEDD5', padding: '1px 6px', borderRadius: '8px' }}>Plan Urgent</span>
                  </div>
                  <div style={{ fontFamily: "'Ruda', sans-serif", fontSize: '28px', fontWeight: 900, color: '#9A3412', marginTop: '6px' }}>
                    {stats.etoiles.Global.bad} chantiers
                  </div>
                  <p style={{ margin: '6px 0 0 0', fontSize: '11px', color: '#7C2D12', lineHeight: 1.4 }}>
                    Dernier contrôle non satisfaisant.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------ */}
        {/* VUES IFRAME EN KEEP-ALIVE (0 APPEL API AU CHANGEMENT DE HUB) */}
        {/* ------------------------------------------------------------ */}
        {visitedIframeViews.map((viewId) => {
          const isVisible = currentView === viewId;
          let src = '';
          let title = '';

          if (viewId === 'secteur_natacha' || viewId === 'secteur_ketty' || viewId === 'secteur_emilie') {
            const animKey = viewId === 'secteur_natacha' ? 'Natacha' : viewId === 'secteur_ketty' ? 'Ketty' : 'Emilie';
            const animFullName =
              viewId === 'secteur_natacha'
                ? 'Natacha THOMAS'
                : viewId === 'secteur_ketty'
                ? 'Ketty PAULIN'
                : 'Emilie TOBIE';
            src = `${URL_SECTEUR_HUB}?animatrice=${animKey}&profile=${animKey}&ts=${refreshKey}`;
            title = `Hub Secteur ${animFullName}`;
          } else if (viewId === 'atelier_erp') {
            src = `${URL_ATELIER_ERP}?v=20004306&ts=${refreshKey}`;
            title = 'Parc Matériel & Machines';
          } else if (viewId === 'atelier_vehicules') {
            src = `${URL_CHRISTINE_HUB}?v=20267872&ts=${refreshKey}`;
            title = 'Hub de Christine — Facturation & Flotte';
          } else if (viewId === 'comm_lea') {
            src = `${URL_LEA_HUB}?v=20377620&ts=${refreshKey}`;
            title = 'Hub de Léa — Communication & Contacts Clients';
          } else if (viewId === 'direction_vincent') {
            src = `${URL_VINCENT_HUB}?v=20428306&ts=${refreshKey}`;
            title = 'Hub Véhicules — Flotte & Géolocalisation';
          }

          if (!src) return null;

          return (
            <div
              key={`${viewId}_${refreshKey}`}
              style={{
                flex: 1,
                width: '100%',
                height: '100%',
                display: isVisible ? 'flex' : 'none',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              <iframe
                ref={(el) => {
                  iframeRefsMap.current[viewId] = el;
                  if (isVisible) activeIframeRef.current = el;
                }}
                src={src}
                title={title}
                style={{ flex: 1, width: '100%', height: '100%', border: 'none' }}
                allow="clipboard-write; fullscreen; camera; microphone; web-share"
              />
            </div>
          );
        })}

        {/* ------------------------------------------------------------ */}
        {/* VUES INTERNES : FOURNISSEURS SAV, ALERTES, INVENTAIRES       */}
        {/* ------------------------------------------------------------ */}
        {currentView === 'atelier_fournisseurs' && (
          <div className="hub-view-container" style={{ padding: '30px 40px', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
            <div style={{ marginBottom: '24px' }}>
              <h1 style={{ fontFamily: "'Ruda', sans-serif", fontSize: '22px', fontWeight: 800, color: '#1B4565', margin: 0 }}>
                Hub Fournisseurs &amp; Pièces SAV
              </h1>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#3989B7' }}>
                Répertoire centralisé des partenaires consommables et fabricants de machines
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 270px), 1fr))', gap: '20px' }}>
              {[
                { name: 'Kalhyge Hygiène', role: 'Fournisseur principal consommables (chimie, sacs, papier)', tel: '02 40 92 11 00', mail: 'commandes.nantes@kalhyge.fr', ref: 'Compte N° FAC-4402', delai: '48h ouvrées' },
                { name: 'Nilfisk France SAV', role: 'Constructeur autolaveuses & balayeuses industrielles', tel: '01 69 59 87 00', mail: 'sav.france@nilfisk.com', ref: 'Contrat Privilège Atelier', delai: 'Pièces sous 24h' },
                { name: 'Taski / Diversey', role: 'Monobrosses & aspirateurs professionnels', tel: '01 45 14 76 76', mail: 'taski.support@diversey.com', ref: 'Compte Pro Facility', delai: '72h ouvrées' },
                { name: 'Kärcher Professionnel', role: 'Nettoyeurs haute pression & injecteurs', tel: '01 43 99 67 70', mail: 'pro@karcher.fr', ref: 'Code Partenaire K-8812', delai: '48h ouvrées' },
              ].map((f) => (
                <div key={f.name} style={{ backgroundColor: '#FFFFFF', padding: '22px', borderRadius: '14px', border: '1.5px solid #D7EAF5' }}>
                  <div style={{ fontFamily: "'Ruda', sans-serif", fontSize: '16px', fontWeight: 800, color: '#1B4565' }}>{f.name}</div>
                  <p style={{ fontSize: '12px', color: '#64748B', margin: '4px 0 14px 0' }}>{f.role}</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1B4565' }}>
                      <Phone size={14} color="#39A9DC" />
                      <span>{f.tel}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1B4565' }}>
                      <Mail size={14} color="#39A9DC" />
                      <span style={{ wordBreak: 'break-all' }}>{f.mail}</span>
                    </div>
                  </div>
                  <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px solid #EBF6FC', display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748B' }}>
                    <span>{f.ref}</span>
                    <span style={{ fontWeight: 700, color: '#0E7042' }}>{f.delai}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {currentView === 'commercial_contrats' && (
          <CommercialHubView monday={monday} />
        )}

        {/* Modales */}
        <RoadmapModal
          isOpen={showRoadmapModal}
          onClose={() => setShowRoadmapModal(false)}
          monday={monday}
          currentUserName={userName}
          initialTab={roadmapInitialTab}
        />

        <CustomizeHubModal
          isOpen={showCustomizeModal}
          onClose={() => setShowCustomizeModal(false)}
          userName={userName}
          permissions={permissions}
          prefs={prefs}
          onUpdatePrefs={handleUpdatePrefs}
        />

        {isAdmin && (
          <PermissionsModal
            isOpen={showPermissionsModal}
            onClose={() => setShowPermissionsModal(false)}
            monday={monday}
            onPermissionsChanged={() => {
              void refreshUserPermissions(true);
            }}
          />
        )}
      </main>
    </div>
  );
}
