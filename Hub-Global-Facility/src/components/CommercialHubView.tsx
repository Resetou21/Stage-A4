import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Briefcase,
  Building2,
  Calendar,
  Clock,
  Euro,
  ExternalLink,
  Filter,
  Loader2,
  MapPin,
  PackageCheck,
  RefreshCw,
  Search,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  BOARD_CHANTIERS_ID,
  ChantierCommercial,
  fetchCommercialDataset,
  getCachedCommercialData,
  isCommercialCacheFresh,
} from '../services/commercialService';
import FacilitySelect, { FacilitySelectOption } from './FacilitySelect';
import {
  CaDonutChart,
  GainsLossesBarChart,
  SectorBalanceChart,
} from './CommercialCharts';

interface CommercialHubViewProps {
  monday: any;
}

const formatNumber = (n: number): string =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(n);

const buildBreakdown = (
  items: ChantierCommercial[],
  getter: (c: ChantierCommercial) => string,
  limit = 7
) => {
  const map = new Map<string, { label: string; count: number; hours: number }>();
  let missingCount = 0;

  items.forEach((c) => {
    const raw = getter(c).trim();
    if (!raw) {
      missingCount += 1;
      return;
    }
    const cur = map.get(raw) || { label: raw, count: 0, hours: 0 };
    cur.count += 1;
    cur.hours += c.heuresMois;
    map.set(raw, cur);
  });

  const rows = Array.from(map.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);

  return { rows, missingCount, knownTotal: items.length - missingCount };
};

export default function CommercialHubView({ monday }: CommercialHubViewProps) {
  const initialCache = getCachedCommercialData();
  const [items, setItems] = useState<ChantierCommercial[]>(() => initialCache?.items || []);
  const [loading, setLoading] = useState<boolean>(() => !initialCache);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<string>(() => initialCache?.syncTime || '');

  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedAnim, setSelectedAnim] = useState<string>('all');
  const [selectedCa, setSelectedCa] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'actifs' | 'nouveaux' | 'perdus' | 'sensibles'>('actifs');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const loadData = async (force = false) => {
    const cached = getCachedCommercialData();
    if (!force && cached && isCommercialCacheFresh(cached)) {
      setItems(cached.items);
      setLastSync(cached.syncTime);
      setLoading(false);
      return;
    }

    // Stale-while-revalidate : si on a déjà des données, on n'affiche jamais d'écran blanc
    if (cached && cached.items.length > 0) {
      setItems(cached.items);
      setLastSync(cached.syncTime);
      setLoading(false);
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError(null);
    try {
      const ds = await fetchCommercialDataset(monday, force);
      setItems(ds.items);
      setLastSync(ds.syncTime);
    } catch (err: any) {
      setError(err?.message || 'Impossible de charger les données du Tableau Complet Chantier.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadData(false);
  }, []);

  // Années détectées dans les dates d'entrée/sortie
  const availableYears = useMemo(() => {
    const yrs = new Set<string>();
    items.forEach((c) => {
      if (c.dateDebut && c.dateDebut.length >= 4) yrs.add(c.dateDebut.slice(0, 4));
      if (c.dateFin && c.dateFin.length >= 4) yrs.add(c.dateFin.slice(0, 4));
    });
    return Array.from(yrs)
      .filter((y) => /^\d{4}$/.test(y))
      .sort((a, b) => b.localeCompare(a));
  }, [items]);

  // Animatrices disponibles (inclut "Non assigné" si présent)
  const availableAnims = useMemo(() => {
    const map = new Map<string, number>();
    items.forEach((c) => {
      if (c.groupId === 'topics') {
        const key = c.animateur.trim() || 'Non assigné';
        map.set(key, (map.get(key) || 0) + 1);
      }
    });
    return Array.from(map.entries()).sort((a, b) => {
      if (a[0] === 'Non assigné') return 1;
      if (b[0] === 'Non assigné') return -1;
      return b[1] - a[1];
    });
  }, [items]);

  // Tranches de CA disponibles
  const availableCaBrackets = useMemo(() => {
    const map = new Map<string, number>();
    items.forEach((c) => {
      if (c.groupId === 'topics') {
        const k = c.caAnnuel.trim() || 'Non renseigné';
        map.set(k, (map.get(k) || 0) + 1);
      }
    });
    return Array.from(map.entries());
  }, [items]);

  // Options pour FacilitySelect
  const yearOptions: FacilitySelectOption[] = useMemo(
    () => [
      { value: 'all', label: 'Toutes les années' },
      ...availableYears.map((y) => ({ value: y, label: `Année ${y}` })),
    ],
    [availableYears]
  );

  const animOptions: FacilitySelectOption[] = useMemo(
    () => [
      { value: 'all', label: 'Tous les secteurs' },
      ...availableAnims.map(([name, count]) => ({
        value: name,
        label: name,
        badge: `${count}`,
      })),
    ],
    [availableAnims]
  );

  const caOptions: FacilitySelectOption[] = useMemo(
    () => [
      { value: 'all', label: 'Toutes tranches de CA' },
      ...availableCaBrackets.map(([label, count]) => ({
        value: label,
        label,
        badge: `${count}`,
      })),
    ],
    [availableCaBrackets]
  );

  // Filtrage par animatrice (gère aussi "Non assigné")
  const animFiltered = useMemo(() => {
    if (selectedAnim === 'all') return items;
    return items.filter((c) => (c.animateur.trim() || 'Non assigné') === selectedAnim);
  }, [items, selectedAnim]);

  // Filtrage additionnel par tranche CA
  const scopedItems = useMemo(() => {
    if (selectedCa === 'all') return animFiltered;
    return animFiltered.filter((c) => (c.caAnnuel.trim() || 'Non renseigné') === selectedCa);
  }, [animFiltered, selectedCa]);

  // Segmentation métier des groupes
  const activeChantiersAllCa = useMemo(
    () => animFiltered.filter((c) => c.groupId === 'topics'),
    [animFiltered]
  );

  const activeChantiers = useMemo(
    () => scopedItems.filter((c) => c.groupId === 'topics'),
    [scopedItems]
  );

  const nouveauxChantiers = useMemo(() => {
    return scopedItems.filter((c) => {
      const isNewGroup = c.groupId === 'group_mkx4kd8x' || c.groupId === 'group_mkztb435';
      return selectedYear === 'all' ? isNewGroup : c.dateDebut.startsWith(selectedYear);
    });
  }, [scopedItems, selectedYear]);

  const perdusChantiers = useMemo(() => {
    return scopedItems.filter((c) => {
      const isLostGroup = c.groupId === 'group_mkx4z7nh' || c.groupId === 'group_mkzbvaee';
      if (!isLostGroup) return false;
      if (selectedYear === 'all') return true;
      return c.dateFin.startsWith(selectedYear);
    });
  }, [scopedItems, selectedYear]);

  const sensiblesChantiers = useMemo(
    () => activeChantiers.filter((c) => c.sensible),
    [activeChantiers]
  );

  // KPIs agrégés
  const kpis = useMemo(() => {
    const totalHoursActive = activeChantiers.reduce((acc, c) => acc + c.heuresMois, 0);
    const totalHoursNew = nouveauxChantiers.reduce((acc, c) => acc + c.heuresMois, 0);
    const hygieneCount = activeChantiers.filter((c) => c.hasHygiene).length;
    const hygienePct = activeChantiers.length > 0 ? Math.round((hygieneCount / activeChantiers.length) * 100) : 0;
    const denom = activeChantiers.length + perdusChantiers.length;
    const retentionPct = denom > 0 ? Math.round((activeChantiers.length / denom) * 100) : 100;

    return {
      actifs: activeChantiers.length,
      sensibles: sensiblesChantiers.length,
      totalHoursActive,
      totalHoursYear: totalHoursActive * 12,
      nouveaux: nouveauxChantiers.length,
      totalHoursNew,
      perdus: perdusChantiers.length,
      hygieneCount,
      hygienePct,
      retentionPct,
    };
  }, [activeChantiers, nouveauxChantiers, perdusChantiers, sensiblesChantiers]);

  // Répartitions analytiques (avec Non renseigné séparé pour ne pas écraser l'échelle)
  const provenanceData = useMemo(() => buildBreakdown(activeChantiers, (c) => c.provenance, 7), [activeChantiers]);
  const activiteData = useMemo(() => buildBreakdown(activeChantiers, (c) => c.activite, 7), [activeChantiers]);
  const raisonArretData = useMemo(() => buildBreakdown(perdusChantiers, (c) => c.raisonArret, 7), [perdusChantiers]);

  // Liste affichée dans l'explorateur
  const currentTabList = useMemo(() => {
    const base =
      activeTab === 'actifs'
        ? activeChantiers
        : activeTab === 'nouveaux'
        ? nouveauxChantiers
        : activeTab === 'perdus'
        ? perdusChantiers
        : sensiblesChantiers;

    const q = searchQuery.toLowerCase().trim();
    if (!q) return base;
    return base.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.ville.toLowerCase().includes(q) ||
        c.activite.toLowerCase().includes(q) ||
        c.provenance.toLowerCase().includes(q) ||
        c.codeChantier.toLowerCase().includes(q) ||
        c.animateur.toLowerCase().includes(q) ||
        c.raisonArret.toLowerCase().includes(q)
    );
  }, [activeTab, activeChantiers, nouveauxChantiers, perdusChantiers, sensiblesChantiers, searchQuery]);

  const hasActiveFilters = selectedYear !== 'all' || selectedAnim !== 'all' || selectedCa !== 'all';

  const renderAnalyticalCard = (
    title: string,
    subtitle: string,
    data: { rows: Array<{ label: string; count: number; hours: number }>; missingCount: number; knownTotal: number },
    accentColor: string,
    emptyText: string
  ) => {
    const maxVal = Math.max(1, ...data.rows.map((d) => d.count));
    const denom = Math.max(1, data.knownTotal);

    return (
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '18px',
          border: '1.5px solid #D7EAF5',
          padding: '18px 20px',
          boxShadow: '0 4px 16px rgba(27, 69, 101, 0.04)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        <div>
          <div style={{ marginBottom: '12px' }}>
            <h3 style={{ margin: 0, fontFamily: "'Ruda', sans-serif", fontSize: '15px', fontWeight: 900, color: '#1B4565' }}>
              {title}
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '11.5px', color: '#64748B' }}>{subtitle}</p>
          </div>

          {data.rows.length === 0 ? (
            <div style={{ padding: '18px 0', textAlign: 'center', color: '#94A3B8', fontSize: '12px' }}>
              {emptyText}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
              {data.rows.map((row) => {
                const pctOfMax = Math.max(8, Math.round((row.count / maxVal) * 100));
                const share = Math.round((row.count / denom) * 100);
                return (
                  <div key={row.label}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                        marginBottom: '4px',
                        fontSize: '12px',
                      }}
                    >
                      <span
                        style={{
                          fontWeight: 700,
                          color: '#1B4565',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {row.label}
                      </span>
                      <span style={{ fontWeight: 800, color: accentColor, whiteSpace: 'nowrap', fontSize: '11.5px' }}>
                        {row.count} <span style={{ color: '#94A3B8', fontWeight: 600 }}>({share}%)</span>
                      </span>
                    </div>
                    <div
                      style={{
                        height: '7px',
                        borderRadius: '999px',
                        backgroundColor: '#EBF6FC',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${pctOfMax}%`,
                          height: '100%',
                          borderRadius: '999px',
                          backgroundColor: accentColor,
                          transition: 'width 0.35s ease',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {data.missingCount > 0 && (
          <div
            style={{
              paddingTop: '8px',
              borderTop: '1px dashed #E2EFF7',
              fontSize: '11px',
              color: '#94A3B8',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>Non renseigné sur Monday</span>
            <strong style={{ color: '#64748B' }}>{data.missingCount} fiches</strong>
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className="hub-view-container"
      style={{
        padding: '24px 32px 60px',
        maxWidth: '1380px',
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* En-tête Commercial */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1B4565 0%, #2B6D98 58%, #39A9DC 100%)',
          borderRadius: '20px',
          padding: '22px 26px',
          color: '#FFFFFF',
          marginBottom: '18px',
          boxShadow: '0 14px 32px rgba(27, 69, 101, 0.16)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '14px',
              backgroundColor: 'rgba(247, 172, 55, 0.22)',
              border: '1.5px solid rgba(247, 172, 55, 0.65)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Briefcase size={24} color="#F7AC37" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontFamily: "'Ruda', sans-serif", fontSize: '21px', fontWeight: 900, color: '#FFFFFF' }}>
                Hub Commercial &amp; Portefeuille Chantiers
              </h1>
              <span
                style={{
                  fontSize: '10.5px',
                  fontWeight: 800,
                  padding: '2px 9px',
                  borderRadius: '999px',
                  backgroundColor: 'rgba(255,255,255,0.16)',
                  color: '#FEF6E7',
                  border: '1px solid rgba(255,255,255,0.28)',
                }}
              >
                Tableau Complet Chantier • En direct
              </span>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', color: 'rgba(255,255,255,0.86)' }}>
              Pilotage du portefeuille actif, dynamique gains/pertes, volume horaire, tranches de CA et provenances.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <a
            href={`https://groupefacility.monday.com/boards/${BOARD_CHANTIERS_ID}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 13px',
              borderRadius: '10px',
              backgroundColor: 'rgba(255,255,255,0.15)',
              border: '1px solid rgba(255,255,255,0.32)',
              color: '#FFFFFF',
              fontSize: '12px',
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            <span>Ouvrir Monday</span>
            <ExternalLink size={13} />
          </a>

          <button
            type="button"
            className="ui-btn"
            onClick={() => void loadData(true)}
            disabled={loading || refreshing}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '10px',
              backgroundColor: '#F7AC37',
              border: 'none',
              color: '#1B4565',
              fontSize: '12px',
              fontWeight: 800,
              cursor: loading || refreshing ? 'wait' : 'pointer',
            }}
          >
            <RefreshCw size={13} className={loading || refreshing ? 'animate-spin' : ''} />
            <span>
              {loading || refreshing ? 'Synchronisation...' : lastSync ? `Actualiser (${lastSync})` : 'Actualiser'}
            </span>
          </button>
        </div>
      </div>

      {/* Barre de filtres custom FacilitySelect (zéro <select> natif) */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '14px',
          border: '1.5px solid #D7EAF5',
          padding: '12px 16px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', flex: 1 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 800, color: '#1B4565' }}>
            <Filter size={14} color="#39A9DC" />
            Filtres :
          </span>

          <FacilitySelect
            value={selectedYear}
            options={yearOptions}
            onChange={setSelectedYear}
            icon={<Calendar size={13} color="#39A9DC" />}
            minWidth="175px"
          />

          <FacilitySelect
            value={selectedAnim}
            options={animOptions}
            onChange={setSelectedAnim}
            searchable
            icon={<Users size={13} color="#39A9DC" />}
            minWidth="195px"
          />

          <FacilitySelect
            value={selectedCa}
            options={caOptions}
            onChange={setSelectedCa}
            icon={<Euro size={13} color="#39A9DC" />}
            minWidth="195px"
          />

          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setSelectedYear('all');
                setSelectedAnim('all');
                setSelectedCa('all');
              }}
              style={{
                padding: '6px 11px',
                borderRadius: '9px',
                border: '1px solid #FDBA74',
                backgroundColor: '#FFF4EB',
                color: '#D66927',
                fontSize: '11.5px',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Réinitialiser
            </button>
          )}
        </div>

        <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#3989B7' }}>
          {items.length} fiches synchronisées
        </span>
      </div>

      {error && (
        <div
          style={{
            padding: '14px 18px',
            borderRadius: '12px',
            backgroundColor: '#FEF2F2',
            border: '1px solid #FECACA',
            color: '#DC2626',
            fontSize: '13px',
            fontWeight: 700,
            marginBottom: '18px',
          }}
        >
          {error}
        </div>
      )}

      {loading && items.length === 0 ? (
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '18px',
            border: '1.5px solid #D7EAF5',
            padding: '60px 20px',
            textAlign: 'center',
            color: '#3989B7',
          }}
        >
          <Loader2 size={30} className="animate-spin" style={{ margin: '0 auto 12px', color: '#39A9DC' }} />
          <div style={{ fontSize: '14px', fontWeight: 800, color: '#1B4565' }}>
            Chargement des indicateurs commerciaux...
          </div>
          <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
            Lecture optimisée du Tableau Complet Chantier (1976599627)
          </div>
        </div>
      ) : (
        <>
          {/* 5 KPIs Commerciaux */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 215px), 1fr))',
              gap: '14px',
              marginBottom: '20px',
            }}
          >
            <div
              className="kpi-interactive-card"
              onClick={() => setActiveTab('actifs')}
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '16px',
                border: '1.5px solid #D7EAF5',
                borderLeft: '4px solid #39A9DC',
                padding: '16px 18px',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '11.5px', fontWeight: 800, color: '#3989B7' }}>PORTEFEUILLE ACTIF</span>
                <Building2 size={16} color="#39A9DC" />
              </div>
              <div style={{ fontFamily: "'Ruda', sans-serif", fontSize: '28px', fontWeight: 900, color: '#1B4565', lineHeight: 1.1 }}>
                {kpis.actifs}
              </div>
              <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '5px' }}>
                dont <strong style={{ color: '#D66927' }}>{kpis.sensibles} sensibles</strong> à suivre
              </div>
            </div>

            <div
              className="kpi-interactive-card"
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '16px',
                border: '1.5px solid #D7EAF5',
                borderLeft: '4px solid #1B4565',
                padding: '16px 18px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '11.5px', fontWeight: 800, color: '#3989B7' }}>VOLUME HORAIRE / MOIS</span>
                <Clock size={16} color="#1B4565" />
              </div>
              <div style={{ fontFamily: "'Ruda', sans-serif", fontSize: '28px', fontWeight: 900, color: '#1B4565', lineHeight: 1.1 }}>
                {formatNumber(kpis.totalHoursActive)} h
              </div>
              <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '5px' }}>
                soit <strong>{formatNumber(kpis.totalHoursYear)} h / an</strong> contractuelles
              </div>
            </div>

            <div
              className="kpi-interactive-card"
              onClick={() => setActiveTab('nouveaux')}
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '16px',
                border: '1.5px solid #D7EAF5',
                borderLeft: '4px solid #00C875',
                padding: '16px 18px',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '11.5px', fontWeight: 800, color: '#0E7042' }}>NOUVEAUX CHANTIERS</span>
                <TrendingUp size={16} color="#00C875" />
              </div>
              <div style={{ fontFamily: "'Ruda', sans-serif", fontSize: '28px', fontWeight: 900, color: '#0E7042', lineHeight: 1.1 }}>
                +{kpis.nouveaux}
              </div>
              <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '5px' }}>
                {kpis.totalHoursNew > 0 ? `+${formatNumber(kpis.totalHoursNew)} h/mois gagnées` : 'Gains enregistrés'}
              </div>
            </div>

            <div
              className="kpi-interactive-card"
              onClick={() => setActiveTab('perdus')}
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '16px',
                border: '1.5px solid #D7EAF5',
                borderLeft: '4px solid #D66927',
                padding: '16px 18px',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '11.5px', fontWeight: 800, color: '#D66927' }}>CHANTIERS PERDUS</span>
                <TrendingDown size={16} color="#D66927" />
              </div>
              <div style={{ fontFamily: "'Ruda', sans-serif", fontSize: '28px', fontWeight: 900, color: '#D66927', lineHeight: 1.1 }}>
                {kpis.perdus}
              </div>
              <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '5px' }}>
                Rétention : <strong style={{ color: '#1B4565' }}>{kpis.retentionPct}%</strong>
              </div>
            </div>

            <div
              className="kpi-interactive-card"
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '16px',
                border: '1.5px solid #D7EAF5',
                borderLeft: '4px solid #F7AC37',
                padding: '16px 18px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '11.5px', fontWeight: 800, color: '#B87414' }}>CONTRATS HYGIÈNE</span>
                <PackageCheck size={16} color="#F7AC37" />
              </div>
              <div style={{ fontFamily: "'Ruda', sans-serif", fontSize: '28px', fontWeight: 900, color: '#1B4565', lineHeight: 1.1 }}>
                {kpis.hygieneCount}
              </div>
              <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '5px' }}>
                <strong>{kpis.hygienePct}%</strong> du parc équipé consommables
              </div>
            </div>
          </div>

          {/* Ligne 1 : 2 Grands Graphiques SVG Interactifs (Gains vs Pertes + Donut Tranches CA) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 440px), 1fr))',
              gap: '16px',
              marginBottom: '18px',
            }}
          >
            <GainsLossesBarChart
              allItems={scopedItems}
              selectedYear={selectedYear}
              availableYears={availableYears}
            />
            <CaDonutChart
              activeChantiers={activeChantiersAllCa}
              selectedCa={selectedCa}
              onSelectCa={setSelectedCa}
            />
          </div>

          {/* Ligne 2 : Charge Secteurs + 3 Analyses détaillées */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 290px), 1fr))',
              gap: '16px',
              marginBottom: '24px',
            }}
          >
            <SectorBalanceChart
              activeChantiers={activeChantiers}
              selectedAnim={selectedAnim}
              onSelectAnim={setSelectedAnim}
            />
            {renderAnalyticalCard(
              'Top Secteurs d’Activité',
              'Typologie métier du portefeuille actif',
              activiteData,
              '#3989B7',
              'Aucune activité renseignée.'
            )}
            {renderAnalyticalCard(
              'Provenance Commerciale',
              'Canaux d’acquisition des chantiers renseignés',
              provenanceData,
              '#39A9DC',
              'Aucune provenance renseignée.'
            )}
            {renderAnalyticalCard(
              'Motifs d’Arrêt (Chantiers Perdus)',
              `Causes de résiliation${selectedYear !== 'all' ? ` en ${selectedYear}` : ''}`,
              raisonArretData,
              '#D66927',
              'Aucun motif d’arrêt enregistré sur cette période.'
            )}
          </div>

          {/* Explorateur de Portefeuille */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '18px',
              border: '1.5px solid #D7EAF5',
              overflow: 'hidden',
              boxShadow: '0 4px 16px rgba(27, 69, 101, 0.04)',
            }}
          >
            <div
              style={{
                padding: '14px 18px',
                borderBottom: '1px solid #D7EAF5',
                backgroundColor: '#F4F9FC',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                {[
                  { id: 'actifs' as const, label: `Actifs (${activeChantiers.length})`, color: '#39A9DC' },
                  { id: 'nouveaux' as const, label: `Nouveaux (${nouveauxChantiers.length})`, color: '#00C875' },
                  { id: 'perdus' as const, label: `Perdus (${perdusChantiers.length})`, color: '#D66927' },
                  { id: 'sensibles' as const, label: `Sensibles (${sensiblesChantiers.length})`, color: '#F7AC37' },
                ].map((t) => {
                  const active = activeTab === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setActiveTab(t.id)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '9px',
                        border: active ? `1.5px solid ${t.color}` : '1px solid #CBD5E1',
                        backgroundColor: active ? '#1B4565' : '#FFFFFF',
                        color: active ? '#FFFFFF' : '#1B4565',
                        fontSize: '12px',
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>

              <div style={{ position: 'relative', minWidth: '220px', flex: '0 1 300px' }}>
                <Search size={14} color="#64748B" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher un chantier, ville, activité..."
                  style={{
                    width: '100%',
                    padding: '7px 10px 7px 32px',
                    borderRadius: '9px',
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#FFFFFF',
                    fontSize: '12px',
                    color: '#1B4565',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            {currentTabList.length === 0 ? (
              <div style={{ padding: '36px 20px', textAlign: 'center', color: '#64748B', fontSize: '13px' }}>
                <BarChart3 size={28} color="#B7D8EA" style={{ margin: '0 auto 8px' }} />
                Aucun chantier ne correspond à ces filtres.
              </div>
            ) : (
              <>
                {/* Vue Desktop Tableau */}
                <div className="desktop-table-container" style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#F8FBFD', borderBottom: '1.5px solid #D7EAF5', textAlign: 'left' }}>
                        <th style={{ padding: '10px 14px', color: '#1B4565', fontWeight: 800 }}>Chantier</th>
                        <th style={{ padding: '10px 10px', color: '#3989B7', fontWeight: 800 }}>Ville</th>
                        <th style={{ padding: '10px 10px', color: '#3989B7', fontWeight: 800 }}>Activité</th>
                        <th style={{ padding: '10px 10px', color: '#3989B7', fontWeight: 800 }}>CA Annuel</th>
                        <th style={{ padding: '10px 10px', color: '#3989B7', fontWeight: 800, textAlign: 'right' }}>H / mois</th>
                        <th style={{ padding: '10px 10px', color: '#3989B7', fontWeight: 800 }}>Provenance</th>
                        <th style={{ padding: '10px 10px', color: '#3989B7', fontWeight: 800 }}>Animatrice</th>
                        {activeTab === 'perdus' && (
                          <th style={{ padding: '10px 10px', color: '#D66927', fontWeight: 800 }}>Raison d’arrêt</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {currentTabList.slice(0, 120).map((c) => (
                        <tr key={c.id} style={{ borderBottom: '1px solid #EBF6FC' }}>
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: 800, color: '#1B4565' }}>{c.name}</span>
                              {c.sensible && (
                                <span
                                  style={{
                                    fontSize: '9.5px',
                                    fontWeight: 800,
                                    padding: '1px 6px',
                                    borderRadius: '999px',
                                    backgroundColor: '#FFF4EB',
                                    color: '#D66927',
                                    border: '1px solid #FDBA74',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                  }}
                                >
                                  <AlertTriangle size={9} /> Sensible
                                </span>
                              )}
                              {c.hasHygiene && (
                                <span
                                  style={{
                                    fontSize: '9.5px',
                                    fontWeight: 800,
                                    padding: '1px 6px',
                                    borderRadius: '999px',
                                    backgroundColor: '#EBF6FC',
                                    color: '#3989B7',
                                  }}
                                >
                                  Hygiène
                                </span>
                              )}
                            </div>
                            {c.codeChantier && (
                              <div style={{ fontSize: '10.5px', color: '#94A3B8' }}>Code : {c.codeChantier}</div>
                            )}
                          </td>
                          <td style={{ padding: '10px', color: '#475569' }}>{c.ville || '—'}</td>
                          <td style={{ padding: '10px', color: '#475569' }}>{c.activite || '—'}</td>
                          <td style={{ padding: '10px', fontWeight: 700, color: '#1B4565' }}>{c.caAnnuel || '—'}</td>
                          <td style={{ padding: '10px', textAlign: 'right', fontWeight: 800, color: '#1B4565' }}>
                            {c.heuresMois > 0 ? `${formatNumber(c.heuresMois)} h` : '—'}
                          </td>
                          <td style={{ padding: '10px', color: '#475569' }}>{c.provenance || '—'}</td>
                          <td style={{ padding: '10px', color: '#3989B7', fontWeight: 700 }}>{c.animateur || '—'}</td>
                          {activeTab === 'perdus' && (
                            <td style={{ padding: '10px', color: '#D66927', fontWeight: 700 }}>
                              {c.raisonArret || (c.dateFin ? `Arrêté le ${c.dateFin}` : '—')}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Vue Mobile Cartes */}
                <div className="mobile-cards-container" style={{ flexDirection: 'column', gap: '10px', padding: '12px' }}>
                  {currentTabList.slice(0, 60).map((c) => (
                    <div
                      key={c.id}
                      style={{
                        backgroundColor: '#F8FBFD',
                        borderRadius: '12px',
                        border: '1px solid #D7EAF5',
                        padding: '12px 14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                        <span style={{ fontWeight: 800, fontSize: '13px', color: '#1B4565' }}>{c.name}</span>
                        {c.heuresMois > 0 && (
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 800,
                              padding: '2px 8px',
                              borderRadius: '999px',
                              backgroundColor: '#EBF6FC',
                              color: '#1B4565',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {formatNumber(c.heuresMois)} h/m
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', fontSize: '11.5px', color: '#64748B' }}>
                        {c.ville && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <MapPin size={11} color="#39A9DC" /> {c.ville}
                          </span>
                        )}
                        {c.activite && <span>• {c.activite}</span>}
                        {c.caAnnuel && <span style={{ fontWeight: 700, color: '#1B4565' }}>• {c.caAnnuel}</span>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: '#3989B7', fontWeight: 700 }}>
                        <span>{c.animateur || 'Secteur non assigné'}</span>
                        <span>{c.provenance || ''}</span>
                      </div>
                      {activeTab === 'perdus' && c.raisonArret && (
                        <div style={{ fontSize: '11px', fontWeight: 700, color: '#D66927' }}>
                          Motif : {c.raisonArret}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {currentTabList.length > 120 && (
                  <div style={{ padding: '10px 16px', textAlign: 'center', fontSize: '11.5px', color: '#64748B', borderTop: '1px solid #EBF6FC' }}>
                    Affichage des 120 premiers résultats sur {currentTabList.length}. Utilisez la barre de recherche pour affiner.
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
