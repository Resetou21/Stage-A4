import React, { useEffect, useMemo, useState } from 'react';
import {
  Heart,
  Sparkles,
  ArrowRight,
  Building2,
  CheckCircle2,
  Star,
  AlertTriangle,
  Wrench,
  Car,
  Users,
  TrendingUp,
  Table2,
  Plus,
  Compass,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { HubKey, UserHubPermissions, ViewId } from '../config/hubPermissions';
import FavoriteHeartButton from './FavoriteHeartButton';

export interface FavoriteLiveStatsInput {
  chantiersActifs: number;
  chantiersParAnim: { Natacha: number; Ketty: number; Emilie: number };
  tauxSatisfactionGlobal: number;
  visitesBonnes: number;
  visitesTotal: number;
  visitesParAnim: {
    Natacha: { bon: number; total: number; pct: number };
    Ketty: { bon: number; total: number; pct: number };
    Emilie: { bon: number; total: number; pct: number };
  };
  etoiles: {
    Global: { s3: number; s2: number; s1: number; bad: number };
    Natacha: { s3: number; s2: number; s1: number; bad: number };
    Ketty: { s3: number; s2: number; s1: number; bad: number };
    Emilie: { s3: number; s2: number; s1: number; bad: number };
  };
  machinesTotal: number;
}

interface ExtraCrossHubStats {
  loaded: boolean;
  geolocWeekLabel: string;
  geolocActiveVehicles: number;
  geolocTotalKm: number;
  geolocTotalHours: number;
  salariesActifs: number;
  salariesTotal: number;
  relancesEnCours: number;
  reparationsActives: number;
}

export interface FavoriteWidgetDef {
  id: string;
  title: string;
  category: string;
  requiredHub: HubKey;
  targetView: ViewId;
  accentColor: string;
  bgLight: string;
  description: string;
  wide?: boolean;
}

export const FAVORITE_WIDGET_CATALOG: FavoriteWidgetDef[] = [
  // Responsables de Secteur
  {
    id: 'kpi_chantiers_actifs',
    title: 'Chantiers en cours',
    category: 'Responsables de Secteur',
    requiredHub: 'secteurs',
    targetView: 'secteur_global',
    accentColor: '#39A9DC',
    bgLight: '#EBF6FC',
    description: 'Nombre total de chantiers actifs et répartition Natacha / Ketty / Émilie.',
  },
  {
    id: 'kpi_satisfaction_globale',
    title: 'Satisfaction Visites Clients',
    category: 'Responsables de Secteur',
    requiredHub: 'secteurs',
    targetView: 'secteur_global',
    accentColor: '#00C875',
    bgLight: '#E6F9F1',
    description: 'Taux de satisfaction annuel des visites clients contrôlées.',
  },
  {
    id: 'kpi_clients_3_etoiles',
    title: 'Clients 3 Étoiles 🌟',
    category: 'Responsables de Secteur',
    requiredHub: 'secteurs',
    targetView: 'secteur_global',
    accentColor: '#F7AC37',
    bgLight: '#FEF6E7',
    description: 'Chantiers avec 3 contrôles consécutifs conformes.',
  },
  {
    id: 'kpi_clients_insatisfaits',
    title: 'Clients Insatisfaits 🙁',
    category: 'Responsables de Secteur',
    requiredHub: 'secteurs',
    targetView: 'secteur_global',
    accentColor: '#D66927',
    bgLight: '#FFF4EB',
    description: 'Chantiers prioritaires avec dernier contrôle non satisfaisant.',
  },
  {
    id: 'table_comparatif_secteurs',
    title: 'Tableau Comparatif par Secteur',
    category: 'Responsables de Secteur',
    requiredHub: 'secteurs',
    targetView: 'secteur_global',
    accentColor: '#1B4565',
    bgLight: '#EBF6FC',
    description: 'Comparatif complet Natacha, Ketty et Émilie (chantiers, satisfaction, étoiles).',
    wide: true,
  },
  {
    id: 'card_repartition_etoiles',
    title: 'Répartition Qualité C1 / C2 / C3',
    category: 'Responsables de Secteur',
    requiredHub: 'secteurs',
    targetView: 'secteur_global',
    accentColor: '#3989B7',
    bgLight: '#EBF6FC',
    description: 'Vue consolidée des 4 niveaux de qualité (3🌟, 2🌟, 1🌟, 🙁).',
    wide: true,
  },
  // Atelier & Matériel
  {
    id: 'kpi_parc_machines',
    title: 'Parc Machines Atelier',
    category: 'Atelier & Matériel',
    requiredHub: 'atelier',
    targetView: 'atelier_erp',
    accentColor: '#39A9DC',
    bgLight: '#EBF6FC',
    description: 'Nombre total de machines suivies dans le parc matériel.',
  },
  {
    id: 'kpi_reparations_atelier',
    title: 'Réparations Atelier en cours',
    category: 'Atelier & Matériel',
    requiredHub: 'atelier',
    targetView: 'atelier_erp',
    accentColor: '#D66927',
    bgLight: '#FFF4EB',
    description: 'Tickets de réparation curatifs non encore clôturés.',
  },
  // Véhicules & Flotte
  {
    id: 'kpi_geoloc_semaine',
    title: 'Activité Flotte GPS (Semaine)',
    category: 'Véhicules & Flotte',
    requiredHub: 'direction',
    targetView: 'direction_vincent',
    accentColor: '#1B4565',
    bgLight: '#EBF6FC',
    description: 'Dernière semaine GPS archivée : véhicules actifs, km et heures de conduite.',
  },
  // Commercial
  {
    id: 'kpi_relances_commerciales',
    title: 'Relances Devis en cours',
    category: 'Commercial & Contrats',
    requiredHub: 'commercial',
    targetView: 'commercial_contrats',
    accentColor: '#F7AC37',
    bgLight: '#FEF6E7',
    description: 'Devis actifs dans le tableau Relance commerciale.',
  },
  // Enchantement Salarié
  {
    id: 'kpi_salaries_actifs',
    title: 'Effectif Enchantement Salarié',
    category: 'Enchantement Salarié',
    requiredHub: 'salaries',
    targetView: 'salaries_rh',
    accentColor: '#0E7042',
    bgLight: '#E6F9F1',
    description: 'Nombre de salariés actifs suivis dans l’annuaire centralisé.',
  },
  // Zone Finance & Direction
  {
    id: 'kpi_finance_non_qualite',
    title: 'Coût de non-qualité',
    category: 'Finance & Direction',
    requiredHub: 'finance',
    targetView: 'finance_direction',
    accentColor: '#DC2626',
    bgLight: '#FEF2F2',
    description: 'Suivi annuel des pertes HT et coût de non-qualité par catégorie.',
  },
  {
    id: 'kpi_finance_gains',
    title: 'Gains financiers',
    category: 'Finance & Direction',
    requiredHub: 'finance',
    targetView: 'finance_direction',
    accentColor: '#0E7042',
    bgLight: '#E6F9F1',
    description: 'Suivi annuel des gains financiers HT réalisés.',
  },
  {
    id: 'kpi_finance_ca_res',
    title: 'CA & Résultat vs Budget',
    category: 'Finance & Direction',
    requiredHub: 'finance',
    targetView: 'finance_direction',
    accentColor: '#1B4565',
    bgLight: '#EBF6FC',
    description: 'Comparatif mensuel Chiffre d’affaires et Résultat réalisé vs budget.',
  },
];

interface FavoriteInfosSectionProps {
  mode: 'home' | 'full';
  monday: any;
  stats: FavoriteLiveStatsInput;
  curYear: number;
  permissions: UserHubPermissions;
  favoriteWidgets: string[];
  onToggleFavorite: (widgetId: string) => void;
  onNavigate: (view: ViewId) => void;
}

export const FavoriteInfosSection: React.FC<FavoriteInfosSectionProps> = ({
  mode,
  monday,
  stats,
  curYear,
  permissions,
  favoriteWidgets,
  onToggleFavorite,
  onNavigate,
}) => {
  const [showCatalog, setShowCatalog] = useState(mode === 'full');
  const [selectedCategory, setSelectedCategory] = useState<string>('Toutes');
  const [loadingExtra, setLoadingExtra] = useState(false);
  const [extra, setExtra] = useState<ExtraCrossHubStats>({
    loaded: false,
    geolocWeekLabel: 'Dernière semaine',
    geolocActiveVehicles: 0,
    geolocTotalKm: 0,
    geolocTotalHours: 0,
    salariesActifs: 0,
    salariesTotal: 0,
    relancesEnCours: 0,
    reparationsActives: 0,
  });

  // Seuls les indicateurs des Hubs auxquels l'utilisateur a accès sont disponibles
  const authorizedCatalog = useMemo(
    () => FAVORITE_WIDGET_CATALOG.filter((w) => Boolean(permissions[w.requiredHub])),
    [permissions],
  );

  const activeFavoriteDefs = useMemo(
    () =>
      favoriteWidgets
        .map((id) => authorizedCatalog.find((w) => w.id === id))
        .filter((w): w is FavoriteWidgetDef => Boolean(w)),
    [favoriteWidgets, authorizedCatalog],
  );

  const categories = useMemo(() => {
    const set = new Set<string>();
    authorizedCatalog.forEach((w) => set.add(w.category));
    return ['Toutes', ...Array.from(set)];
  }, [authorizedCatalog]);

  const needsExtraData = useMemo(() => {
    if (mode === 'full' || showCatalog) return true;
    return activeFavoriteDefs.some((w) =>
      ['kpi_geoloc_semaine', 'kpi_salaries_actifs', 'kpi_relances_commerciales', 'kpi_reparations_atelier'].includes(
        w.id,
      ),
    );
  }, [mode, showCatalog, activeFavoriteDefs]);

  const loadCrossHubStats = async () => {
    if (!monday?.api) return;
    setLoadingExtra(true);
    try {
      const next: ExtraCrossHubStats = { ...extra, loaded: true };
      const promises: Promise<void>[] = [];

      if (permissions.direction) {
        promises.push(
          monday
            .api(
              `query {
                boards(ids: [5108497111]) {
                  groups { id title }
                  items_page(limit: 100) {
                    items {
                      group { id title }
                      column_values(ids: ["numeric_mm9d7deb", "numeric_mm9dk1qv", "numeric_mm9dj6ag"]) { id text }
                    }
                  }
                }
              }`,
            )
            .then((res: any) => {
              const b = res?.data?.boards?.[0];
              const items: any[] = b?.items_page?.items || [];
              if (items.length > 0) {
                const latestGroupId = b?.groups?.[0]?.id || items[0]?.group?.id;
                const latestGroupTitle = b?.groups?.[0]?.title || items[0]?.group?.title || 'Semaine en cours';
                const weekItems = items.filter((it) => it.group?.id === latestGroupId);
                let km = 0;
                let hours = 0;
                let active = 0;
                weekItems.forEach((it) => {
                  const byId = new Map<string, string>();
                  (it.column_values || []).forEach((c: any) => byId.set(c.id, String(c.text || '')));
                  const k = parseFloat(byId.get('numeric_mm9d7deb')?.replace(',', '.') || '0') || 0;
                  const h = parseFloat(byId.get('numeric_mm9dk1qv')?.replace(',', '.') || '0') || 0;
                  const t = parseFloat(byId.get('numeric_mm9dj6ag')?.replace(',', '.') || '0') || 0;
                  km += k;
                  hours += h;
                  if (k > 0 || t > 0) active++;
                });
                next.geolocWeekLabel = latestGroupTitle;
                next.geolocActiveVehicles = active;
                next.geolocTotalKm = Math.round(km);
                next.geolocTotalHours = Math.round(hours * 10) / 10;
              }
            })
            .catch(() => {}),
        );
      }

      if (permissions.communication) {
        promises.push(
          monday
            .api(
              `query {
                boards(ids: [5108574616]) {
                  items_page(limit: 500) {
                    items {
                      column_values(ids: ["color_mm9ea1d9"]) { text }
                    }
                  }
                }
              }`,
            )
            .then((res: any) => {
              const items: any[] = res?.data?.boards?.[0]?.items_page?.items || [];
              next.salariesTotal = items.length;
              next.salariesActifs = items.filter(
                (it) => !/sorti/i.test(String(it.column_values?.[0]?.text || '')),
              ).length;
            })
            .catch(() => {}),
        );
      }

      if (permissions.commercial) {
        promises.push(
          monday
            .api(
              `query {
                boards(ids: [5093424499]) {
                  groups(ids: ["topics"]) {
                    items_page(limit: 500) {
                      items { id }
                    }
                  }
                }
              }`,
            )
            .then((res: any) => {
              const items: any[] = res?.data?.boards?.[0]?.groups?.[0]?.items_page?.items || [];
              next.relancesEnCours = items.length;
            })
            .catch(() => {}),
        );
      }

      if (permissions.atelier) {
        promises.push(
          monday
            .api(
              `query {
                boards(ids: [5106693291]) {
                  items_page(limit: 300) {
                    items {
                      column_values(ids: ["color_mm8vp2nd"]) { text }
                    }
                  }
                }
              }`,
            )
            .then((res: any) => {
              const items: any[] = res?.data?.boards?.[0]?.items_page?.items || [];
              next.reparationsActives = items.filter(
                (it) => !/r[ée]par[ée]e|cl[oô]tur/i.test(String(it.column_values?.[0]?.text || '')),
              ).length;
            })
            .catch(() => {}),
        );
      }

      await Promise.all(promises);
      setExtra(next);
    } finally {
      setLoadingExtra(false);
    }
  };

  useEffect(() => {
    if (needsExtraData && !extra.loaded && !loadingExtra) {
      loadCrossHubStats();
    }
  }, [needsExtraData, extra.loaded]);

  const renderWidgetCard = (w: FavoriteWidgetDef) => {
    const isFav = favoriteWidgets.includes(w.id);

    if (w.id === 'table_comparatif_secteurs') {
      const rows = [
        { name: 'Natacha THOMAS', key: 'Natacha' as const, view: 'secteur_natacha' as ViewId },
        { name: 'Ketty PAULIN', key: 'Ketty' as const, view: 'secteur_ketty' as ViewId },
        { name: 'Emilie TOBIE', key: 'Emilie' as const, view: 'secteur_emilie' as ViewId },
      ];
      return (
        <div
          key={w.id}
          style={{
            gridColumn: '1 / -1',
            backgroundColor: '#FFFFFF',
            borderRadius: '14px',
            border: '1.5px solid #D7EAF5',
            borderTop: `3.5px solid ${w.accentColor}`,
            padding: '16px 18px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Table2 size={16} color={w.accentColor} />
              <div>
                <div style={{ fontFamily: "'Ruda', sans-serif", fontSize: '14px', fontWeight: 800, color: '#1B4565' }}>
                  {w.title}
                </div>
                <div style={{ fontSize: '11px', color: '#64748B' }}>{w.category}</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={() => onNavigate(w.targetView)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 10px',
                  borderRadius: '8px',
                  border: '1px solid #D7EAF5',
                  backgroundColor: '#F4F9FC',
                  color: '#3989B7',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <span>Ouvrir</span>
                <ArrowRight size={12} />
              </button>
              <FavoriteHeartButton isFavorite={isFav} onToggle={() => onToggleFavorite(w.id)} label={w.title} />
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: '500px', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1.5px solid #E2EFF7', color: '#3989B7', fontSize: '10.5px', textTransform: 'uppercase' }}>
                  <th style={{ padding: '7px 8px', textAlign: 'left' }}>Animatrice</th>
                  <th style={{ padding: '7px 8px', textAlign: 'right' }}>Chantiers</th>
                  <th style={{ padding: '7px 8px', textAlign: 'right' }}>Satisfaction {curYear}</th>
                  <th style={{ padding: '7px 8px', textAlign: 'right' }}>3 🌟</th>
                  <th style={{ padding: '7px 8px', textAlign: 'right' }}>🙁</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.key}
                    onClick={() => onNavigate(r.view)}
                    style={{ borderBottom: '1px solid #F1F5F9', cursor: 'pointer' }}
                  >
                    <td style={{ padding: '8px', fontWeight: 700, color: '#1B4565' }}>{r.name}</td>
                    <td style={{ padding: '8px', textAlign: 'right', fontWeight: 800 }}>{stats.chantiersParAnim[r.key]}</td>
                    <td style={{ padding: '8px', textAlign: 'right', fontWeight: 800, color: '#0E7042' }}>
                      {stats.visitesParAnim[r.key].pct}%
                    </td>
                    <td style={{ padding: '8px', textAlign: 'right', fontWeight: 800, color: '#B87414' }}>
                      {stats.etoiles[r.key].s3}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'right', fontWeight: 800, color: stats.etoiles[r.key].bad > 0 ? '#D66927' : '#0E7042' }}>
                      {stats.etoiles[r.key].bad}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    if (w.id === 'card_repartition_etoiles') {
      return (
        <div
          key={w.id}
          style={{
            gridColumn: '1 / -1',
            backgroundColor: '#FFFFFF',
            borderRadius: '14px',
            border: '1.5px solid #D7EAF5',
            borderTop: `3.5px solid ${w.accentColor}`,
            padding: '16px 18px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Star size={16} color="#F7AC37" />
              <div>
                <div style={{ fontFamily: "'Ruda', sans-serif", fontSize: '14px', fontWeight: 800, color: '#1B4565' }}>
                  {w.title}
                </div>
                <div style={{ fontSize: '11px', color: '#64748B' }}>{w.category}</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={() => onNavigate(w.targetView)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 10px',
                  borderRadius: '8px',
                  border: '1px solid #D7EAF5',
                  backgroundColor: '#F4F9FC',
                  color: '#3989B7',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <span>Détails</span>
                <ArrowRight size={12} />
              </button>
              <FavoriteHeartButton isFavorite={isFav} onToggle={() => onToggleFavorite(w.id)} label={w.title} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
            {[
              { label: '3 Étoiles 🌟', val: stats.etoiles.Global.s3, bg: '#FEF9C3', col: '#92400E' },
              { label: '2 Étoiles 🌟', val: stats.etoiles.Global.s2, bg: '#E0F2FE', col: '#075985' },
              { label: '1 Étoile 🌟', val: stats.etoiles.Global.s1, bg: '#F1F5F9', col: '#1E293B' },
              { label: 'Insatisfaits 🙁', val: stats.etoiles.Global.bad, bg: '#FFF7ED', col: '#9A3412' },
            ].map((item) => (
              <div key={item.label} style={{ backgroundColor: item.bg, borderRadius: '10px', padding: '10px 12px' }}>
                <div style={{ fontSize: '11px', fontWeight: 800, color: item.col }}>{item.label}</div>
                <div style={{ fontFamily: "'Ruda', sans-serif", fontSize: '22px', fontWeight: 900, color: item.col, marginTop: '2px' }}>
                  {item.val}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // Cartes KPI unitaires
    let value = '—';
    let sub = w.description;
    let IconComp: React.ComponentType<{ size?: number; color?: string }> = Sparkles;

    if (w.id === 'kpi_chantiers_actifs') {
      value = String(stats.chantiersActifs);
      sub = `Natacha: ${stats.chantiersParAnim.Natacha} • Ketty: ${stats.chantiersParAnim.Ketty} • Émilie: ${stats.chantiersParAnim.Emilie}`;
      IconComp = Building2;
    } else if (w.id === 'kpi_satisfaction_globale') {
      value = `${stats.tauxSatisfactionGlobal}%`;
      sub = `${stats.visitesBonnes} satisfaisantes / ${stats.visitesTotal} visites (${curYear})`;
      IconComp = CheckCircle2;
    } else if (w.id === 'kpi_clients_3_etoiles') {
      value = String(stats.etoiles.Global.s3);
      sub = `${stats.chantiersActifs > 0 ? Math.round((stats.etoiles.Global.s3 / stats.chantiersActifs) * 100) : 0}% du parc au niveau maximal`;
      IconComp = Star;
    } else if (w.id === 'kpi_clients_insatisfaits') {
      value = String(stats.etoiles.Global.bad);
      sub = 'Plans d’action prioritaires';
      IconComp = AlertTriangle;
    } else if (w.id === 'kpi_parc_machines') {
      value = String(stats.machinesTotal);
      sub = 'Machines suivies dans l’ERP Atelier';
      IconComp = Wrench;
    } else if (w.id === 'kpi_reparations_atelier') {
      value = loadingExtra && !extra.loaded ? '…' : String(extra.reparationsActives);
      sub = 'Interventions curatives ouvertes';
      IconComp = Wrench;
    } else if (w.id === 'kpi_geoloc_semaine') {
      value = loadingExtra && !extra.loaded ? '…' : `${extra.geolocTotalKm.toLocaleString('fr-FR')} km`;
      sub = `${extra.geolocActiveVehicles} véh. actifs • ${extra.geolocTotalHours} h (${extra.geolocWeekLabel})`;
      IconComp = Car;
    } else if (w.id === 'kpi_relances_commerciales') {
      value = loadingExtra && !extra.loaded ? '…' : String(extra.relancesEnCours);
      sub = 'Devis actifs en cours de suivi';
      IconComp = TrendingUp;
    } else if (w.id === 'kpi_salaries_actifs') {
      value = loadingExtra && !extra.loaded ? '…' : String(extra.salariesActifs);
      sub = `Sur ${extra.salariesTotal} fiches dans Enchantement salarié`;
      IconComp = Users;
    } else if (w.id === 'kpi_finance_non_qualite') {
      value = 'Ouvrir →';
      sub = `Détail pertes HT ${curYear} dans Zone Finance`;
      IconComp = AlertTriangle;
    } else if (w.id === 'kpi_finance_gains') {
      value = 'Ouvrir →';
      sub = `Détail gains HT ${curYear} dans Zone Finance`;
      IconComp = TrendingUp;
    } else if (w.id === 'kpi_finance_ca_res') {
      value = 'Ouvrir →';
      sub = `CA & Résultat ${curYear} réalisé vs budget`;
      IconComp = TrendingUp;
    }

    return (
      <div
        key={w.id}
        className="kpi-interactive-card"
        onClick={() => onNavigate(w.targetView)}
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '14px',
          border: '1.5px solid #D7EAF5',
          borderLeft: `4px solid ${w.accentColor}`,
          padding: '15px 16px',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '6px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
          <div style={{ minWidth: 0 }}>
            <span
              style={{
                display: 'inline-block',
                fontSize: '10px',
                fontWeight: 800,
                color: w.accentColor,
                backgroundColor: w.bgLight,
                padding: '2px 7px',
                borderRadius: '999px',
                marginBottom: '5px',
              }}
            >
              {w.category}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 800, color: '#1B4565' }}>
              <IconComp size={14} color={w.accentColor} />
              <span>{w.title}</span>
            </div>
          </div>
          <FavoriteHeartButton isFavorite={isFav} onToggle={() => onToggleFavorite(w.id)} label={w.title} compact />
        </div>

        <div style={{ fontFamily: "'Ruda', sans-serif", fontSize: '28px', fontWeight: 900, color: '#1B4565', lineHeight: 1.1 }}>
          {value}
        </div>
        <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, lineHeight: 1.35 }}>{sub}</div>
      </div>
    );
  };

  const filteredCatalog = useMemo(
    () =>
      selectedCategory === 'Toutes'
        ? authorizedCatalog
        : authorizedCatalog.filter((w) => w.category === selectedCategory),
    [authorizedCatalog, selectedCategory],
  );

  // ==================== MODE ACCUEIL COMPACT ====================
  if (mode === 'home') {
    if (authorizedCatalog.length === 0) return null;

    return (
      <section
        className="reveal-3"
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '18px',
          border: '1.5px solid #FECDD3',
          background: 'linear-gradient(135deg, #FFFFFF 0%, #FFF5F7 100%)',
          padding: '20px 24px',
          marginBottom: '26px',
          boxShadow: '0 6px 20px rgba(225, 29, 72, 0.05)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                backgroundColor: '#FFF1F2',
                border: '1.5px solid #FDA4AF',
                color: '#E11D48',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Heart size={20} fill="#E11D48" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, fontFamily: "'Ruda', sans-serif", fontSize: '16.5px', fontWeight: 900, color: '#1B4565' }}>
                  Mes informations préférées
                </h3>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '999px',
                    backgroundColor: '#FFE4E6',
                    color: '#BE123C',
                    fontSize: '10.5px',
                    fontWeight: 800,
                  }}
                >
                  {activeFavoriteDefs.length} épinglée{activeFavoriteDefs.length > 1 ? 's' : ''}
                </span>
              </div>
              <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748B' }}>
                Cliquez sur le petit cœur ❤️ d’un indicateur ou tableau de n’importe quel Hub pour le suivre ici en un coup d’œil.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setShowCatalog((v) => !v)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '10px',
                backgroundColor: showCatalog ? '#1B4565' : '#FFFFFF',
                color: showCatalog ? '#FFFFFF' : '#1B4565',
                border: '1.5px solid #CBD5E1',
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              <Plus size={14} />
              <span>{showCatalog ? 'Fermer le catalogue' : 'Choisir mes infos'}</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('favorites')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '10px',
                backgroundColor: '#E11D48',
                color: '#FFFFFF',
                border: 'none',
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              <Compass size={14} />
              <span>Ouvrir mon espace</span>
            </button>
          </div>
        </div>

        {/* Grille des infos épinglées */}
        {activeFavoriteDefs.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 230px), 1fr))',
              gap: '12px',
              marginTop: '16px',
            }}
          >
            {activeFavoriteDefs.map((w) => renderWidgetCard(w))}
          </div>
        )}

        {/* Catalogue rapide dépliable directement sur l'accueil */}
        {showCatalog && (
          <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px dashed #FDA4AF' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
              <span style={{ fontSize: '11.5px', fontWeight: 800, color: '#1B4565' }}>
                Découvrir les indicateurs disponibles ({authorizedCatalog.length}) :
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '999px',
                      border: selectedCategory === cat ? '1px solid #E11D48' : '1px solid #E2E8F0',
                      backgroundColor: selectedCategory === cat ? '#FFF1F2' : '#FFFFFF',
                      color: selectedCategory === cat ? '#BE123C' : '#64748B',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 250px), 1fr))', gap: '10px' }}>
              {filteredCatalog.map((w) => {
                const isFav = favoriteWidgets.includes(w.id);
                return (
                  <div
                    key={w.id}
                    onClick={() => onToggleFavorite(w.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px',
                      padding: '10px 12px',
                      borderRadius: '11px',
                      border: isFav ? '1.5px solid #FDA4AF' : '1px solid #E2E8F0',
                      backgroundColor: isFav ? '#FFF1F2' : '#FFFFFF',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '10px', fontWeight: 800, color: w.accentColor }}>{w.category}</div>
                      <div style={{ fontSize: '12.5px', fontWeight: 800, color: '#1B4565' }}>{w.title}</div>
                      <div style={{ fontSize: '11px', color: '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {w.description}
                      </div>
                    </div>
                    <FavoriteHeartButton isFavorite={isFav} onToggle={() => onToggleFavorite(w.id)} label={w.title} compact />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
    );
  }

  // ==================== MODE PLEINE PAGE (VUE 'favorites') ====================
  return (
    <div className="hub-view-container" style={{ padding: '28px 36px', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 12px', borderRadius: '20px', backgroundColor: '#FFF1F2', color: '#BE123C', fontSize: '11px', fontWeight: 800, marginBottom: '8px' }}>
            <Heart size={13} fill="#E11D48" color="#E11D48" />
            <span>Espace Personnel &amp; Curiosité Entreprise</span>
          </div>
          <h1 style={{ fontFamily: "'Ruda', sans-serif", fontSize: '28px', fontWeight: 900, color: '#0F172A', margin: 0 }}>
            Mes informations préférées
          </h1>
          <div style={{ marginTop: '8px', height: '3.5px', width: '80px', borderRadius: '2px', background: 'linear-gradient(90deg, #E11D48, #F7AC37)' }} />
          <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: '#64748B', maxWidth: '760px', lineHeight: 1.5 }}>
            Suivez ici en temps réel tous les indicateurs, tableaux et chiffres qui vous intéressent sur la vie de Groupe Facility — y compris en dehors de votre propre service.
          </p>
        </div>

        <button
          type="button"
          onClick={loadCrossHubStats}
          disabled={loadingExtra}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '7px',
            padding: '9px 16px',
            borderRadius: '9px',
            backgroundColor: '#FFFFFF',
            color: '#1B4565',
            border: '1.5px solid #CBD5E1',
            fontSize: '12px',
            fontWeight: 700,
            cursor: loadingExtra ? 'wait' : 'pointer',
          }}
        >
          {loadingExtra ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          <span>Actualiser les chiffres</span>
        </button>
      </div>

      {/* Section 1 : Mes favoris épinglés */}
      <div style={{ marginBottom: '28px' }}>
        <h2 style={{ fontFamily: "'Ruda', sans-serif", fontSize: '16px', fontWeight: 900, color: '#1B4565', margin: '0 0 12px 0' }}>
          Mes indicateurs épinglés ({activeFavoriteDefs.length})
        </h2>

        {activeFavoriteDefs.length === 0 ? (
          <div
            style={{
              backgroundColor: '#FFF5F7',
              border: '1.5px dashed #FDA4AF',
              borderRadius: '16px',
              padding: '32px 20px',
              textAlign: 'center',
            }}
          >
            <Heart size={30} color="#E11D48" style={{ margin: '0 auto 10px' }} />
            <p style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: '#1B4565' }}>
              Vous n’avez encore aucune information préférée
            </p>
            <p style={{ margin: '6px 0 0 0', fontSize: '12.5px', color: '#64748B' }}>
              Cliquez sur le petit cœur ❤️ sur les indicateurs ci-dessous (ou directement dans vos Hubs) pour composer votre tableau de bord personnel.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: '14px' }}>
            {activeFavoriteDefs.map((w) => renderWidgetCard(w))}
          </div>
        )}
      </div>

      {/* Section 2 : Catalogue complet filtré par droits */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1.5px solid #D7EAF5', padding: '22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontFamily: "'Ruda', sans-serif", fontSize: '16px', fontWeight: 900, color: '#1B4565', margin: 0 }}>
              Catalogue des informations disponibles dans vos Hubs ({authorizedCatalog.length})
            </h2>
            <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748B' }}>
              Cochez ❤️ sur les indicateurs que vous souhaitez suivre automatiquement.
            </p>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '999px',
                  border: selectedCategory === cat ? '1.5px solid #E11D48' : '1px solid #CBD5E1',
                  backgroundColor: selectedCategory === cat ? '#FFF1F2' : '#FFFFFF',
                  color: selectedCategory === cat ? '#BE123C' : '#475569',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 270px), 1fr))', gap: '12px' }}>
          {filteredCatalog.map((w) => {
            const isFav = favoriteWidgets.includes(w.id);
            return (
              <div
                key={w.id}
                onClick={() => onToggleFavorite(w.id)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '10px',
                  padding: '13px 14px',
                  borderRadius: '12px',
                  border: isFav ? '1.5px solid #FDA4AF' : '1px solid #E2EFF7',
                  backgroundColor: isFav ? '#FFF5F7' : '#F8FAFC',
                  cursor: 'pointer',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <span
                    style={{
                      display: 'inline-block',
                      fontSize: '10px',
                      fontWeight: 800,
                      color: w.accentColor,
                      backgroundColor: w.bgLight,
                      padding: '2px 8px',
                      borderRadius: '999px',
                      marginBottom: '5px',
                    }}
                  >
                    {w.category}
                  </span>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: '#1B4565' }}>{w.title}</div>
                  <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '3px', lineHeight: 1.4 }}>
                    {w.description}
                  </div>
                </div>
                <FavoriteHeartButton isFavorite={isFav} onToggle={() => onToggleFavorite(w.id)} label={w.title} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default FavoriteInfosSection;
