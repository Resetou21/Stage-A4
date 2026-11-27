import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Check,
  ChevronDown,
  Download,
  Euro,
  ExternalLink,
  Landmark,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  TrendingDown,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import {
  addAssociateMeetingTopic,
  clearFinanceCache,
  fetchFinanceBundle,
  FinanceImpactItem,
  FinanceOverviewBundle,
  MonthlyFinanceRow,
  REUNION_ASSOCIES_URL,
} from '../services/financeService';
import FavoriteHeartButton from './FavoriteHeartButton';

interface FinanceHubViewProps {
  monday: any;
  favoriteWidgets: string[];
  onToggleFavorite: (widgetId: string) => void;
}

type ActivePanel = 'losses' | 'gains' | 'ca' | 'res';

const eur = (n: number) =>
  Math.round(n).toLocaleString('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  });

const fmtNum = (n: number) => Math.round(n).toLocaleString('fr-FR');

function exportItemsCsv(items: FinanceImpactItem[], filename: string) {
  const header = ['Date', 'Intitulé', 'Fournisseur', 'Catégorie', 'Montant HT (€)'];
  const escapeCsv = (val: string | number) => `"${String(val).replace(/"/g, '""')}"`;
  const lines = [
    header.map(escapeCsv).join(';'),
    ...items.map((it) =>
      [
        it.date ? new Date(it.date).toLocaleDateString('fr-FR') : '',
        it.name || '',
        it.fournisseur || '',
        it.categorie || '',
        Math.round(it.montant || 0),
      ]
        .map(escapeCsv)
        .join(';')
    ),
  ];
  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function MonthlyComparisonChart({
  months,
  metric,
  year,
}: {
  months: MonthlyFinanceRow[];
  metric: 'ca' | 'res';
  year: number;
}) {
  const rows = useMemo(
    () =>
      months.map((m) => {
        const realise = metric === 'ca' ? m.caRealise : m.resRealise;
        // Le budget n'apparaît que si un réalisé existe pour le même mois (règle historique Hub Direction)
        const budget = realise != null ? (metric === 'ca' ? m.caBudget : m.resBudget) : null;
        return {
          mois: m.label,
          budget,
          realise,
          ecart: budget != null && realise != null ? realise - budget : null,
        };
      }),
    [months, metric]
  );

  const totB = rows.reduce((s, r) => s + (r.budget ?? 0), 0);
  const totR = rows.reduce((s, r) => s + (r.realise ?? 0), 0);
  const diff = totR - totB;

  const maxAbs = useMemo(() => {
    let m = 1;
    for (const r of rows) {
      if (r.budget != null) m = Math.max(m, Math.abs(r.budget));
      if (r.realise != null) m = Math.max(m, Math.abs(r.realise));
    }
    return m;
  }, [rows]);

  if (rows.length === 0) {
    return (
      <div
        style={{
          padding: '28px',
          textAlign: 'center',
          color: '#64748B',
          fontSize: '13px',
          backgroundColor: '#F8FBFD',
          borderRadius: '12px',
          border: '1px dashed #CBD5E1',
        }}
      >
        Aucune donnée mensuelle enregistrée pour {year}.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Synthèse cumulée */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
        <span
          style={{
            padding: '5px 12px',
            borderRadius: '999px',
            border: '1px solid #D7EAF5',
            backgroundColor: '#F8FBFD',
            fontSize: '12px',
            color: '#1B4565',
          }}
        >
          Budget cumulé : <strong>{eur(totB)}</strong>
        </span>
        <span
          style={{
            padding: '5px 12px',
            borderRadius: '999px',
            border: '1px solid #D7EAF5',
            backgroundColor: '#EBF6FC',
            fontSize: '12px',
            color: '#1B4565',
          }}
        >
          Réalisé cumulé : <strong>{eur(totR)}</strong>
        </span>
        <span
          style={{
            padding: '5px 12px',
            borderRadius: '999px',
            fontSize: '12px',
            fontWeight: 800,
            backgroundColor: diff >= 0 ? '#E6F9F1' : '#FEF2F2',
            color: diff >= 0 ? '#0E7042' : '#DC2626',
            border: `1px solid ${diff >= 0 ? '#A7F3D0' : '#FECACA'}`,
          }}
        >
          Écart : {diff >= 0 ? '+' : ''}
          {eur(diff)}
        </span>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11.5px', color: '#64748B' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: '#CBD5E1', display: 'inline-block' }} />
            Budget
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: '#1B4565', display: 'inline-block' }} />
            Réalisé
          </span>
        </div>
      </div>

      {/* Graphique barres mensuelles responsive */}
      <div
        style={{
          backgroundColor: '#F8FBFD',
          borderRadius: '14px',
          border: '1px solid #D7EAF5',
          padding: '18px 14px 12px',
          overflowX: 'auto',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${rows.length}, minmax(52px, 1fr))`,
            gap: '10px',
            alignItems: 'end',
            minHeight: '210px',
            paddingTop: '16px',
          }}
        >
          {rows.map((r) => {
            const hBudget = r.budget != null ? Math.max(4, Math.round((Math.abs(r.budget) / maxAbs) * 165)) : 0;
            const hReal = r.realise != null ? Math.max(4, Math.round((Math.abs(r.realise) / maxAbs) * 165)) : 0;
            const isNegReal = (r.realise ?? 0) < 0;

            return (
              <div
                key={r.mois}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}
                title={`${r.mois} — Budget : ${r.budget != null ? eur(r.budget) : '—'} | Réalisé : ${r.realise != null ? eur(r.realise) : '—'}`}
              >
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '170px' }}>
                  <div
                    style={{
                      width: '16px',
                      height: `${hBudget}px`,
                      backgroundColor: '#CBD5E1',
                      borderRadius: '5px 5px 0 0',
                      transition: 'height 0.25s ease',
                    }}
                  />
                  <div
                    style={{
                      width: '16px',
                      height: `${hReal}px`,
                      backgroundColor: isNegReal ? '#DC2626' : metric === 'ca' ? '#3989B7' : '#1B4565',
                      borderRadius: '5px 5px 0 0',
                      transition: 'height 0.25s ease',
                    }}
                  />
                </div>
                <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#475569', textTransform: 'capitalize' }}>
                  {r.mois}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Vignettes écart par mois */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
          gap: '8px',
        }}
      >
        {rows.map((r) => (
          <div
            key={r.mois}
            style={{
              padding: '8px 10px',
              borderRadius: '10px',
              border: '1px solid #D7EAF5',
              backgroundColor: '#FFFFFF',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '11px', color: '#64748B', textTransform: 'capitalize', fontWeight: 600 }}>{r.mois}</div>
            <div
              style={{
                fontSize: '12.5px',
                fontWeight: 800,
                marginTop: '2px',
                color: r.ecart == null ? '#94A3B8' : r.ecart >= 0 ? '#0E7042' : '#DC2626',
              }}
            >
              {r.ecart == null ? '—' : `${r.ecart >= 0 ? '+' : ''}${fmtNum(r.ecart)} €`}
            </div>
            {r.realise != null && (
              <div style={{ fontSize: '10px', color: '#64748B', marginTop: '2px' }}>
                Réal. {fmtNum(r.realise)} €
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function FinanceHubView({
  monday,
  favoriteWidgets,
  onToggleFavorite,
}: FinanceHubViewProps) {
  const [bundle, setBundle] = useState<FinanceOverviewBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<ActivePanel>('ca');

  // Recherche dans pertes / gains
  const [searchQuery, setSearchQuery] = useState('');

  // Formulaire nouveau sujet Réunion d'associés
  const [topicOpen, setTopicOpen] = useState(false);
  const [topicText, setTopicText] = useState('');
  const [topicBusy, setTopicBusy] = useState(false);
  const [topicFeedback, setTopicFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const loadData = async (force = false) => {
    if (force) {
      setRefreshing(true);
      clearFinanceCache();
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const data = await fetchFinanceBundle(monday, force);
      setBundle(data);
    } catch (err) {
      console.error('[FinanceHubView] Erreur chargement :', err);
      setError('Impossible de charger les données financières depuis Monday.com.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadData(false);
  }, []);

  const year = bundle?.year ?? new Date().getFullYear();

  const activeItems = useMemo(() => {
    if (!bundle) return [];
    const list = activePanel === 'losses' ? bundle.losses.items : activePanel === 'gains' ? bundle.gains.items : [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (it) =>
        it.name.toLowerCase().includes(q) ||
        it.fournisseur.toLowerCase().includes(q) ||
        it.categorie.toLowerCase().includes(q)
    );
  }, [bundle, activePanel, searchQuery]);

  const activeCategories = useMemo(() => {
    if (!bundle) return [];
    return activePanel === 'losses' ? bundle.losses.categories : activePanel === 'gains' ? bundle.gains.categories : [];
  }, [bundle, activePanel]);

  const handleSubmitTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topicText.trim()) return;
    setTopicBusy(true);
    setTopicFeedback(null);
    try {
      await addAssociateMeetingTopic(monday, topicText);
      setTopicText('');
      setTopicOpen(false);
      setTopicFeedback({ ok: true, text: 'Sujet ajouté dans « A faire » (statut En cours).' });
      window.setTimeout(() => setTopicFeedback(null), 5000);
    } catch (err) {
      console.error(err);
      setTopicFeedback({ ok: false, text: 'Erreur lors de la création du sujet.' });
    } finally {
      setTopicBusy(false);
    }
  };

  return (
    <div
      className="hub-view-container"
      style={{
        padding: '28px 34px 56px',
        maxWidth: '1380px',
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* En-tête Zone Finance & Direction */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '16px',
          flexWrap: 'wrap',
          marginBottom: '24px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #1B4565 0%, #3989B7 100%)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 20px rgba(27, 69, 101, 0.22)',
              flexShrink: 0,
            }}
          >
            <Landmark size={24} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h1
                style={{
                  margin: 0,
                  fontFamily: "'Ruda', sans-serif",
                  fontSize: '24px',
                  fontWeight: 900,
                  color: '#1B4565',
                }}
              >
                Zone Finance &amp; Direction
              </h1>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  color: '#1B4565',
                  backgroundColor: '#EBF6FC',
                  border: '1px solid #B7D8EA',
                  padding: '2px 9px',
                  borderRadius: '999px',
                }}
              >
                Exercice {year}
              </span>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#475569' }}>
              Coût de non-qualité, gains financiers, suivi Chiffre d’affaires / Résultat vs Budget &amp; réunion d’associés.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void loadData(true)}
          disabled={refreshing || loading}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '7px',
            padding: '8px 14px',
            borderRadius: '10px',
            border: '1px solid #B7D8EA',
            backgroundColor: '#FFFFFF',
            color: '#1B4565',
            fontSize: '12.5px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <RefreshCw size={14} className={refreshing || loading ? 'animate-spin' : ''} color="#39A9DC" />
          <span>Actualiser</span>
        </button>
      </div>

      {error && (
        <div
          style={{
            marginBottom: '20px',
            padding: '14px 18px',
            borderRadius: '12px',
            backgroundColor: '#FEF2F2',
            border: '1px solid #FECACA',
            color: '#B91C1C',
            fontSize: '13px',
            fontWeight: 600,
          }}
        >
          {error}
        </div>
      )}

      {/* 4 tuiles principales */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 265px), 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        {/* Tuile 1 : Coût de non-qualité */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            border: activePanel === 'losses' ? '2px solid #DC2626' : '1.5px solid #D7EAF5',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '14px',
            boxShadow: activePanel === 'losses' ? '0 8px 24px rgba(220,38,38,0.10)' : '0 2px 10px rgba(27,69,101,0.04)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '999px',
                  backgroundColor: '#FEF2F2',
                  color: '#DC2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <TrendingDown size={16} />
              </span>
              <span style={{ fontSize: '11.5px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.4px', color: '#475569' }}>
                Coût non-qualité {year}
              </span>
            </div>
            <FavoriteHeartButton
              isFavorite={favoriteWidgets.includes('kpi_finance_non_qualite')}
              onToggle={() => onToggleFavorite('kpi_finance_non_qualite')}
              label={`Coût de non-qualité ${year}`}
              size={14}
            />
          </div>

          <div style={{ textAlign: 'center', padding: '6px 0' }}>
            {loading && !bundle ? (
              <div style={{ height: '38px', width: '120px', margin: '0 auto', borderRadius: '8px', backgroundColor: '#F1F5F9' }} />
            ) : (
              <>
                <div style={{ fontFamily: "'Ruda', sans-serif", fontSize: '32px', fontWeight: 900, color: '#DC2626', lineHeight: 1.1 }}>
                  {bundle ? eur(bundle.losses.total) : '—'}
                </div>
                {bundle && (
                  <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
                    {bundle.losses.count} perte{bundle.losses.count > 1 ? 's' : ''} HT
                  </div>
                )}
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setActivePanel('losses');
            }}
            style={{
              width: '100%',
              padding: '9px 12px',
              borderRadius: '10px',
              border: activePanel === 'losses' ? '1.5px solid #DC2626' : '1.5px solid #D7EAF5',
              backgroundColor: activePanel === 'losses' ? '#DC2626' : '#F8FBFD',
              color: activePanel === 'losses' ? '#FFFFFF' : '#1B4565',
              fontSize: '12.5px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <span>Voir le détail des pertes</span>
            <ChevronDown size={15} style={{ transform: activePanel === 'losses' ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>
        </div>

        {/* Tuile 2 : Gain financier */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            border: activePanel === 'gains' ? '2px solid #0E7042' : '1.5px solid #D7EAF5',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '14px',
            boxShadow: activePanel === 'gains' ? '0 8px 24px rgba(14,112,66,0.10)' : '0 2px 10px rgba(27,69,101,0.04)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '999px',
                  backgroundColor: '#E6F9F1',
                  color: '#0E7042',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <TrendingUp size={16} />
              </span>
              <span style={{ fontSize: '11.5px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.4px', color: '#475569' }}>
                Gain financier {year}
              </span>
            </div>
            <FavoriteHeartButton
              isFavorite={favoriteWidgets.includes('kpi_finance_gains')}
              onToggle={() => onToggleFavorite('kpi_finance_gains')}
              label={`Gain financier ${year}`}
              size={14}
            />
          </div>

          <div style={{ textAlign: 'center', padding: '6px 0' }}>
            {loading && !bundle ? (
              <div style={{ height: '38px', width: '120px', margin: '0 auto', borderRadius: '8px', backgroundColor: '#F1F5F9' }} />
            ) : (
              <>
                <div style={{ fontFamily: "'Ruda', sans-serif", fontSize: '32px', fontWeight: 900, color: '#0E7042', lineHeight: 1.1 }}>
                  {bundle ? eur(bundle.gains.total) : '—'}
                </div>
                {bundle && (
                  <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
                    {bundle.gains.count} gain{bundle.gains.count > 1 ? 's' : ''} HT
                  </div>
                )}
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setActivePanel('gains');
            }}
            style={{
              width: '100%',
              padding: '9px 12px',
              borderRadius: '10px',
              border: activePanel === 'gains' ? '1.5px solid #0E7042' : '1.5px solid #D7EAF5',
              backgroundColor: activePanel === 'gains' ? '#0E7042' : '#F8FBFD',
              color: activePanel === 'gains' ? '#FFFFFF' : '#1B4565',
              fontSize: '12.5px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <span>Voir le détail des gains</span>
            <ChevronDown size={15} style={{ transform: activePanel === 'gains' ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>
        </div>

        {/* Tuile 3 : Indicateurs financiers (CA & Résultat) */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            border: activePanel === 'ca' || activePanel === 'res' ? '2px solid #1B4565' : '1.5px solid #D7EAF5',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '12px',
            boxShadow: activePanel === 'ca' || activePanel === 'res' ? '0 8px 24px rgba(27,69,101,0.10)' : '0 2px 10px rgba(27,69,101,0.04)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '999px',
                  backgroundColor: '#EBF6FC',
                  color: '#1B4565',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <BarChart3 size={16} />
              </span>
              <span style={{ fontSize: '11.5px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.4px', color: '#475569' }}>
                Indicateurs financiers
              </span>
            </div>
            <FavoriteHeartButton
              isFavorite={favoriteWidgets.includes('kpi_finance_ca_res')}
              onToggle={() => onToggleFavorite('kpi_finance_ca_res')}
              label="CA & Résultat vs Budget"
              size={14}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '9px', flex: 1, justifyContent: 'center' }}>
            <button
              type="button"
              onClick={() => setActivePanel('ca')}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '10px',
                border: '1.5px solid #1B4565',
                backgroundColor: activePanel === 'ca' ? '#1B4565' : '#FFFFFF',
                color: activePanel === 'ca' ? '#FFFFFF' : '#1B4565',
                fontSize: '13px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '7px',
              }}
            >
              <BarChart3 size={15} />
              <span>Chiffre d’affaires</span>
            </button>

            <button
              type="button"
              onClick={() => setActivePanel('res')}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '10px',
                border: '1.5px solid #3989B7',
                backgroundColor: activePanel === 'res' ? '#3989B7' : '#FFFFFF',
                color: activePanel === 'res' ? '#FFFFFF' : '#3989B7',
                fontSize: '13px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '7px',
              }}
            >
              <Euro size={15} />
              <span>Résultat</span>
            </button>
          </div>
        </div>

        {/* Tuile 4 : Réunion d'associés */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            border: '1.5px solid #D7EAF5',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '12px',
            boxShadow: '0 2px 10px rgba(27,69,101,0.04)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '999px',
                backgroundColor: '#FEF6E7',
                color: '#B87414',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Users size={16} />
            </span>
            <span style={{ fontSize: '11.5px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.4px', color: '#475569' }}>
              Réunion d’associés
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, justifyContent: 'center' }}>
            <a
              href={REUNION_ASSOCIES_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '10px',
                backgroundColor: '#1B4565',
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: 800,
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '7px',
                boxSizing: 'border-box',
              }}
            >
              <Users size={15} />
              <span>Ouvrir le tableau</span>
              <ExternalLink size={13} />
            </a>

            {!topicOpen ? (
              <button
                type="button"
                onClick={() => {
                  setTopicOpen(true);
                  setTopicFeedback(null);
                }}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '10px',
                  border: '1.5px dashed #3989B7',
                  backgroundColor: '#F4F9FC',
                  color: '#1B4565',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <Plus size={15} />
                <span>Nouveau sujet (En cours)</span>
              </button>
            ) : (
              <form onSubmit={handleSubmitTopic} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <textarea
                  value={topicText}
                  onChange={(e) => setTopicText(e.target.value)}
                  maxLength={255}
                  rows={2}
                  placeholder="Nouvelle action à ajouter dans « A faire »…"
                  style={{
                    width: '100%',
                    borderRadius: '9px',
                    border: '1px solid #B7D8EA',
                    padding: '8px 10px',
                    fontSize: '12.5px',
                    resize: 'none',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit',
                  }}
                />
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="submit"
                    disabled={topicBusy || !topicText.trim()}
                    style={{
                      flex: 1,
                      padding: '8px 10px',
                      borderRadius: '9px',
                      border: 'none',
                      backgroundColor: '#0E7042',
                      color: '#FFFFFF',
                      fontSize: '12.5px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px',
                      opacity: topicBusy || !topicText.trim() ? 0.6 : 1,
                    }}
                  >
                    {topicBusy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    <span>Valider</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTopicOpen(false);
                      setTopicText('');
                    }}
                    disabled={topicBusy}
                    aria-label="Annuler"
                    style={{
                      padding: '8px 10px',
                      borderRadius: '9px',
                      border: '1px solid #CBD5E1',
                      backgroundColor: '#FFFFFF',
                      color: '#475569',
                      cursor: 'pointer',
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
              </form>
            )}

            {topicFeedback && (
              <div
                style={{
                  fontSize: '11.5px',
                  fontWeight: 700,
                  padding: '6px 9px',
                  borderRadius: '8px',
                  textAlign: 'center',
                  backgroundColor: topicFeedback.ok ? '#E6F9F1' : '#FEF2F2',
                  color: topicFeedback.ok ? '#0E7042' : '#DC2626',
                  border: `1px solid ${topicFeedback.ok ? '#A7F3D0' : '#FECACA'}`,
                }}
              >
                {topicFeedback.text}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Panneau de détail actif */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '18px',
          border: '1.5px solid #D7EAF5',
          padding: '22px 24px',
          boxShadow: '0 4px 18px rgba(27,69,101,0.05)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
            marginBottom: '18px',
          }}
        >
          <h2
            style={{
              margin: 0,
              fontFamily: "'Ruda', sans-serif",
              fontSize: '17px',
              fontWeight: 900,
              color: '#1B4565',
            }}
          >
            {activePanel === 'losses'
              ? `Détail du coût de non-qualité ${year}`
              : activePanel === 'gains'
              ? `Détail des gains financiers ${year}`
              : activePanel === 'ca'
              ? `Chiffre d’affaires ${year} · Réalisé vs Budget`
              : `Résultat ${year} · Réalisé vs Budget`}
          </h2>

          {(activePanel === 'losses' || activePanel === 'gains') && bundle && (
            <button
              type="button"
              onClick={() =>
                exportItemsCsv(
                  activePanel === 'losses' ? bundle.losses.items : bundle.gains.items,
                  `${activePanel === 'losses' ? 'Cout_non_qualite' : 'Gains_financiers'}_${year}.csv`
                )
              }
              disabled={activeItems.length === 0}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 12px',
                borderRadius: '9px',
                border: '1px solid #B7D8EA',
                backgroundColor: '#F4F9FC',
                color: '#1B4565',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <Download size={14} color="#0E7042" />
              <span>Exporter CSV / Excel</span>
            </button>
          )}
        </div>

        {loading && !bundle ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '48px 0', color: '#64748B', fontSize: '13px' }}>
            <Loader2 size={18} className="animate-spin" color="#39A9DC" />
            <span>Chargement des indicateurs financiers Monday…</span>
          </div>
        ) : !bundle ? null : activePanel === 'ca' || activePanel === 'res' ? (
          <MonthlyComparisonChart months={bundle.monthly.months} metric={activePanel} year={year} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {activeCategories.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {activeCategories.map((c) => (
                  <span
                    key={c.label}
                    style={{
                      padding: '4px 11px',
                      borderRadius: '999px',
                      border: '1px solid #D7EAF5',
                      backgroundColor: '#F8FBFD',
                      fontSize: '12px',
                      color: '#1B4565',
                    }}
                  >
                    <strong>{c.label}</strong> · {eur(c.total)}
                  </span>
                ))}
              </div>
            )}

            <div style={{ position: 'relative', maxWidth: '380px' }}>
              <Search
                size={15}
                color="#64748B"
                style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)' }}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher par intitulé, fournisseur, catégorie…"
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 34px',
                  borderRadius: '10px',
                  border: '1px solid #CBD5E1',
                  fontSize: '12.5px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {activeItems.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', fontSize: '13px', color: '#64748B' }}>
                Aucun élément trouvé pour cette sélection.
              </div>
            ) : (
              <div
                style={{
                  borderRadius: '12px',
                  border: '1px solid #D7EAF5',
                  overflow: 'hidden',
                }}
              >
                {activeItems.map((it, idx) => (
                  <div
                    key={it.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                      padding: '11px 16px',
                      borderTop: idx === 0 ? 'none' : '1px solid #EBF6FC',
                      backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#FAFDFE',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span style={{ fontSize: '12px', color: '#64748B', minWidth: '82px' }}>
                      {it.date ? new Date(it.date).toLocaleDateString('fr-FR') : '—'}
                    </span>
                    <div style={{ flex: 1, minWidth: '180px' }}>
                      <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#1B4565' }}>{it.name}</div>
                      <div style={{ fontSize: '11.5px', color: '#64748B' }}>
                        {[it.fournisseur, it.categorie].filter(Boolean).join(' · ') || '—'}
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: '13.5px',
                        fontWeight: 800,
                        color: activePanel === 'gains' ? '#0E7042' : '#DC2626',
                      }}
                    >
                      {eur(it.montant)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
