import React, { useMemo, useState } from 'react';
import { ChantierCommercial } from '../services/commercialService';

const MONTHS_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

const CA_PALETTE = ['#39A9DC', '#3989B7', '#1B4565', '#F7AC37', '#D66927', '#10B981', '#94A3B8'];

const getCaSortWeight = (label: string): number => {
  const l = label.toLowerCase();
  if (l.includes('0') && l.includes('5')) return 1;
  if (l.includes('5') && l.includes('20')) return 2;
  if (l.includes('20') && l.includes('50')) return 3;
  if (l.includes('50') && l.includes('100')) return 4;
  if (l.includes('plus') || l.includes('>')) return 5;
  if (l.includes('non renseign')) return 99;
  return 50;
};

const fmt = (n: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(n);

/* ============================================================================
 * 1. GRAPHIQUE SVG INTERACTIF : GAINS VS PERTES (MENSUEL OU ANNUEL)
 * ==========================================================================*/
interface GainsLossesChartProps {
  allItems: ChantierCommercial[];
  selectedYear: string;
  availableYears: string[];
}

export function GainsLossesBarChart({
  allItems,
  selectedYear,
  availableYears,
}: GainsLossesChartProps) {
  const defaultChartYear = useMemo(() => {
    if (selectedYear !== 'all') return selectedYear;
    const curYr = String(new Date().getFullYear());
    if (availableYears.includes(curYr)) return curYr;
    return availableYears[0] || curYr;
  }, [selectedYear, availableYears]);

  const [mode, setMode] = useState<'monthly' | 'yearly'>('monthly');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const effectiveMode = selectedYear !== 'all' ? 'monthly' : mode;
  const targetYear = selectedYear !== 'all' ? selectedYear : defaultChartYear;

  const series = useMemo(() => {
    if (effectiveMode === 'yearly') {
      const yrs = [...availableYears].sort((a, b) => a.localeCompare(b)).slice(-6);
      return yrs.map((yr) => {
        let gains = 0;
        let losses = 0;
        let hGain = 0;
        let hLoss = 0;
        allItems.forEach((c) => {
          if (c.dateDebut.startsWith(yr)) {
            gains += 1;
            hGain += c.heuresMois;
          }
          const isLost = c.groupId === 'group_mkx4z7nh' || c.groupId === 'group_mkzbvaee';
          if (isLost && c.dateFin.startsWith(yr)) {
            losses += 1;
            hLoss += c.heuresMois;
          }
        });
        return { label: yr, gains, losses, net: gains - losses, hGain, hLoss };
      });
    }

    return MONTHS_FR.map((label, idx) => {
      const prefix = `${targetYear}-${String(idx + 1).padStart(2, '0')}`;
      let gains = 0;
      let losses = 0;
      let hGain = 0;
      let hLoss = 0;
      allItems.forEach((c) => {
        if (c.dateDebut.startsWith(prefix)) {
          gains += 1;
          hGain += c.heuresMois;
        }
        const isLost = c.groupId === 'group_mkx4z7nh' || c.groupId === 'group_mkzbvaee';
        if (isLost && c.dateFin.startsWith(prefix)) {
          losses += 1;
          hLoss += c.heuresMois;
        }
      });
      return { label, gains, losses, net: gains - losses, hGain, hLoss };
    });
  }, [allItems, effectiveMode, targetYear, availableYears]);

  const maxBar = Math.max(4, ...series.map((s) => Math.max(s.gains, s.losses)));
  const totGains = series.reduce((a, s) => a + s.gains, 0);
  const totLosses = series.reduce((a, s) => a + s.losses, 0);
  const totNet = totGains - totLosses;
  const activePoint = hoveredIdx !== null ? series[hoveredIdx] : null;

  const svgW = 620;
  const svgH = 215;
  const padL = 32;
  const padR = 14;
  const padT = 18;
  const padB = 30;
  const plotW = svgW - padL - padR;
  const plotH = svgH - padT - padB;
  const slotW = plotW / Math.max(1, series.length);
  const barW = Math.min(18, Math.max(7, slotW * 0.3));

  const yTicks = [0, Math.ceil(maxBar / 2), maxBar];

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
        gap: '12px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: 0, fontFamily: "'Ruda', sans-serif", fontSize: '15.5px', fontWeight: 900, color: '#1B4565' }}>
            Dynamique Gains vs Pertes {effectiveMode === 'monthly' ? `(${targetYear})` : '(Par année)'}
          </h3>
          <p style={{ margin: '2px 0 0 0', fontSize: '11.5px', color: '#64748B' }}>
            Nouveaux chantiers gagnés face aux arrêts enregistrés
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {selectedYear === 'all' && availableYears.length > 1 && (
            <div
              style={{
                display: 'inline-flex',
                backgroundColor: '#F4F9FC',
                border: '1px solid #D7EAF5',
                borderRadius: '9px',
                padding: '2px',
                gap: '2px',
              }}
            >
              <button
                type="button"
                onClick={() => { setMode('monthly'); setHoveredIdx(null); }}
                style={{
                  padding: '4px 9px',
                  borderRadius: '7px',
                  border: 'none',
                  fontSize: '11px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  backgroundColor: mode === 'monthly' ? '#39A9DC' : 'transparent',
                  color: mode === 'monthly' ? '#FFFFFF' : '#3989B7',
                }}
              >
                Mois {targetYear}
              </button>
              <button
                type="button"
                onClick={() => { setMode('yearly'); setHoveredIdx(null); }}
                style={{
                  padding: '4px 9px',
                  borderRadius: '7px',
                  border: 'none',
                  fontSize: '11px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  backgroundColor: mode === 'yearly' ? '#39A9DC' : 'transparent',
                  color: mode === 'yearly' ? '#FFFFFF' : '#3989B7',
                }}
              >
                Années
              </button>
            </div>
          )}

          <span
            style={{
              fontSize: '11px',
              fontWeight: 800,
              padding: '4px 10px',
              borderRadius: '999px',
              backgroundColor: totNet >= 0 ? '#E6F9F1' : '#FFF4EB',
              color: totNet >= 0 ? '#0E7042' : '#D66927',
            }}
          >
            Solde net : {totNet >= 0 ? `+${totNet}` : totNet}
          </span>
        </div>
      </div>

      {/* Bandeau synthèse dynamique au survol */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
          flexWrap: 'wrap',
          padding: '8px 12px',
          borderRadius: '10px',
          backgroundColor: '#F4F9FC',
          fontSize: '11.5px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: '#1B4565' }}>
            <span style={{ width: '9px', height: '9px', borderRadius: '3px', backgroundColor: '#00C875' }} />
            Gains : <strong style={{ color: '#0E7042' }}>+{activePoint ? activePoint.gains : totGains}</strong>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: '#1B4565' }}>
            <span style={{ width: '9px', height: '9px', borderRadius: '3px', backgroundColor: '#D66927' }} />
            Pertes : <strong style={{ color: '#D66927' }}>-{activePoint ? activePoint.losses : totLosses}</strong>
          </span>
        </div>
        <span style={{ fontWeight: 700, color: '#3989B7' }}>
          {activePoint
            ? `${activePoint.label} • Solde ${activePoint.net >= 0 ? '+' : ''}${activePoint.net} (${activePoint.hGain > 0 ? `+${fmt(activePoint.hGain)}h` : '0h'} / -${fmt(activePoint.hLoss)}h)`
            : 'Survolez une période pour le détail'}
        </span>
      </div>

      {/* Graphique SVG responsive */}
      <div style={{ width: '100%', overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: '100%', height: 'auto', minHeight: '185px', display: 'block' }}>
          {/* Grille horizontale */}
          {yTicks.map((val) => {
            const y = padT + plotH - (val / maxBar) * plotH;
            return (
              <g key={val}>
                <line
                  x1={padL}
                  y1={y}
                  x2={svgW - padR}
                  y2={y}
                  stroke="#E2EFF7"
                  strokeDasharray={val === 0 ? undefined : '3 4'}
                  strokeWidth={1}
                />
                <text x={padL - 7} y={y + 4} textAnchor="end" fontSize="10" fontWeight="700" fill="#94A3B8">
                  {val}
                </text>
              </g>
            );
          })}

          {/* Barres groupées */}
          {series.map((s, idx) => {
            const cx = padL + idx * slotW + slotW / 2;
            const gainH = (s.gains / maxBar) * plotH;
            const lossH = (s.losses / maxBar) * plotH;
            const isHovered = hoveredIdx === idx;
            const gap = 3;

            return (
              <g
                key={s.label}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                onClick={() => setHoveredIdx(hoveredIdx === idx ? null : idx)}
              >
                {/* Zone de survol complète */}
                <rect
                  x={padL + idx * slotW + 2}
                  y={padT - 4}
                  width={Math.max(4, slotW - 4)}
                  height={plotH + 8}
                  rx={8}
                  fill={isHovered ? '#EBF6FC' : 'transparent'}
                />

                {/* Barre Gains */}
                {s.gains > 0 && (
                  <rect
                    x={cx - barW - gap / 2}
                    y={padT + plotH - gainH}
                    width={barW}
                    height={Math.max(3, gainH)}
                    rx={4}
                    fill="#00C875"
                    opacity={hoveredIdx === null || isHovered ? 1 : 0.45}
                  />
                )}

                {/* Barre Pertes */}
                {s.losses > 0 && (
                  <rect
                    x={cx + gap / 2}
                    y={padT + plotH - lossH}
                    width={barW}
                    height={Math.max(3, lossH)}
                    rx={4}
                    fill="#D66927"
                    opacity={hoveredIdx === null || isHovered ? 1 : 0.45}
                  />
                )}

                {/* Valeurs au-dessus si survol ou non nul et compact */}
                {isHovered && s.gains > 0 && (
                  <text
                    x={cx - barW / 2 - gap / 2}
                    y={padT + plotH - gainH - 4}
                    textAnchor="middle"
                    fontSize="9.5"
                    fontWeight="800"
                    fill="#0E7042"
                  >
                    +{s.gains}
                  </text>
                )}
                {isHovered && s.losses > 0 && (
                  <text
                    x={cx + barW / 2 + gap / 2}
                    y={padT + plotH - lossH - 4}
                    textAnchor="middle"
                    fontSize="9.5"
                    fontWeight="800"
                    fill="#D66927"
                  >
                    -{s.losses}
                  </text>
                )}

                {/* Libellé axe X */}
                <text
                  x={cx}
                  y={svgH - 8}
                  textAnchor="middle"
                  fontSize="10.5"
                  fontWeight={isHovered ? '800' : '700'}
                  fill={isHovered ? '#1B4565' : '#64748B'}
                >
                  {s.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

/* ============================================================================
 * 2. DONUT SVG INTERACTIF : PORTEFEUILLE PAR TRANCHE DE CA ANNUEL
 * ==========================================================================*/
interface CaDonutChartProps {
  activeChantiers: ChantierCommercial[];
  selectedCa: string;
  onSelectCa: (ca: string) => void;
}

export function CaDonutChart({
  activeChantiers,
  selectedCa,
  onSelectCa,
}: CaDonutChartProps) {
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);

  const slices = useMemo(() => {
    const map = new Map<string, { label: string; count: number; hours: number }>();
    activeChantiers.forEach((c) => {
      const label = c.caAnnuel.trim() || 'Non renseigné';
      const cur = map.get(label) || { label, count: 0, hours: 0 };
      cur.count += 1;
      cur.hours += c.heuresMois;
      map.set(label, cur);
    });
    const list = Array.from(map.values()).sort(
      (a, b) => getCaSortWeight(a.label) - getCaSortWeight(b.label)
    );
    const total = list.reduce((s, d) => s + d.count, 0) || 1;
    let offset = 0;
    return list.map((item, i) => {
      const pct = (item.count / total) * 100;
      const color = item.label === 'Non renseigné' ? '#CBD5E1' : CA_PALETTE[i % (CA_PALETTE.length - 1)];
      const seg = { ...item, pct, offset, color };
      offset += pct;
      return seg;
    });
  }, [activeChantiers]);

  const totalCount = activeChantiers.length;
  const focusedSlice = useMemo(() => {
    if (hoveredLabel) return slices.find((s) => s.label === hoveredLabel) || null;
    if (selectedCa !== 'all') return slices.find((s) => s.label === selectedCa) || null;
    return null;
  }, [hoveredLabel, selectedCa, slices]);

  const radius = 58;
  const circumference = 2 * Math.PI * radius;

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
        gap: '12px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <div>
          <h3 style={{ margin: 0, fontFamily: "'Ruda', sans-serif", fontSize: '15.5px', fontWeight: 900, color: '#1B4565' }}>
            Répartition par Tranche de CA
          </h3>
          <p style={{ margin: '2px 0 0 0', fontSize: '11.5px', color: '#64748B' }}>
            Cliquez sur une tranche pour filtrer les chantiers
          </p>
        </div>
        {selectedCa !== 'all' && (
          <button
            type="button"
            onClick={() => onSelectCa('all')}
            style={{
              padding: '4px 9px',
              borderRadius: '999px',
              border: '1px solid #B7D8EA',
              backgroundColor: '#EBF6FC',
              color: '#1B4565',
              fontSize: '10.5px',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Réinitialiser
          </button>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap' }}>
        {/* Anneau SVG */}
        <div style={{ position: 'relative', width: '156px', height: '156px', flexShrink: 0, margin: '0 auto' }}>
          <svg viewBox="0 0 156 156" style={{ width: '156px', height: '156px', transform: 'rotate(-90deg)' }}>
            <circle cx="78" cy="78" r={radius} fill="none" stroke="#EBF6FC" strokeWidth="20" />
            {slices.map((s) => {
              const dashLen = (s.pct / 100) * circumference;
              const dashOffset = -(s.offset / 100) * circumference;
              const isSelected = selectedCa === s.label;
              const isHovered = hoveredLabel === s.label;
              const dimmed =
                (hoveredLabel !== null && !isHovered) ||
                (hoveredLabel === null && selectedCa !== 'all' && !isSelected);

              return (
                <circle
                  key={s.label}
                  cx="78"
                  cy="78"
                  r={radius}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={isHovered || isSelected ? 24 : 20}
                  strokeDasharray={`${Math.max(0, dashLen - 1.4)} ${circumference}`}
                  strokeDashoffset={dashOffset}
                  opacity={dimmed ? 0.35 : 1}
                  style={{ cursor: 'pointer', transition: 'stroke-width 0.18s ease, opacity 0.18s ease' }}
                  onMouseEnter={() => setHoveredLabel(s.label)}
                  onMouseLeave={() => setHoveredLabel(null)}
                  onClick={() => onSelectCa(selectedCa === s.label ? 'all' : s.label)}
                />
              );
            })}
          </svg>

          {/* Texte central */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              pointerEvents: 'none',
              padding: '0 22px',
            }}
          >
            <span style={{ fontFamily: "'Ruda', sans-serif", fontSize: '24px', fontWeight: 900, color: '#1B4565', lineHeight: 1 }}>
              {focusedSlice ? focusedSlice.count : totalCount}
            </span>
            <span style={{ fontSize: '10px', fontWeight: 800, color: '#3989B7', marginTop: '3px' }}>
              {focusedSlice ? `${Math.round(focusedSlice.pct)}% du parc` : 'chantiers actifs'}
            </span>
            {focusedSlice && focusedSlice.hours > 0 && (
              <span style={{ fontSize: '9.5px', fontWeight: 700, color: '#64748B', marginTop: '2px' }}>
                {fmt(focusedSlice.hours)} h/m
              </span>
            )}
          </div>
        </div>

        {/* Légende interactive */}
        <div style={{ flex: 1, minWidth: '185px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {slices.map((s) => {
            const active = selectedCa === s.label || hoveredLabel === s.label;
            return (
              <button
                key={s.label}
                type="button"
                onMouseEnter={() => setHoveredLabel(s.label)}
                onMouseLeave={() => setHoveredLabel(null)}
                onClick={() => onSelectCa(selectedCa === s.label ? 'all' : s.label)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  padding: '6px 9px',
                  borderRadius: '9px',
                  border: selectedCa === s.label ? `1.5px solid ${s.color}` : '1px solid transparent',
                  backgroundColor: active ? '#F4F9FC' : 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.14s ease',
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: s.color, flexShrink: 0 }} />
                  <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#1B4565', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {s.label}
                  </span>
                </span>
                <span style={{ fontSize: '11.5px', fontWeight: 800, color: '#1B4565', whiteSpace: 'nowrap' }}>
                  {s.count}{' '}
                  <span style={{ color: '#64748B', fontWeight: 600 }}>({Math.round(s.pct)}%)</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
 * 3. COMPARATIF VISUEL PAR SECTEUR ANIMATRICE (CHANTIERS + VOLUME HORAIRE)
 * ==========================================================================*/
interface SectorBalanceChartProps {
  activeChantiers: ChantierCommercial[];
  selectedAnim: string;
  onSelectAnim: (anim: string) => void;
}

export function SectorBalanceChart({
  activeChantiers,
  selectedAnim,
  onSelectAnim,
}: SectorBalanceChartProps) {
  const sectors = useMemo(() => {
    const map = new Map<string, { name: string; count: number; hours: number; sensibles: number }>();
    activeChantiers.forEach((c) => {
      const name = c.animateur.trim() || 'Non assigné';
      const cur = map.get(name) || { name, count: 0, hours: 0, sensibles: 0 };
      cur.count += 1;
      cur.hours += c.heuresMois;
      if (c.sensible) cur.sensibles += 1;
      map.set(name, cur);
    });
    return Array.from(map.values())
      .filter((s) => s.count > 0)
      .sort((a, b) => b.hours - a.hours);
  }, [activeChantiers]);

  const maxHours = Math.max(1, ...sectors.map((s) => s.hours));
  const colors = ['#39A9DC', '#3989B7', '#D66927', '#1B4565', '#F7AC37'];

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
        gap: '12px',
      }}
    >
      <div>
        <h3 style={{ margin: 0, fontFamily: "'Ruda', sans-serif", fontSize: '15.5px', fontWeight: 900, color: '#1B4565' }}>
          Charge &amp; Volume Horaire par Secteur
        </h3>
        <p style={{ margin: '2px 0 0 0', fontSize: '11.5px', color: '#64748B' }}>
          Heures contractuelles mensuelles et nombre de sites actifs par animatrice
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '11px' }}>
        {sectors.map((s, idx) => {
          const pct = Math.max(8, Math.round((s.hours / maxHours) * 100));
          const color = colors[idx % colors.length];
          const isSelected = selectedAnim === s.name;
          return (
            <button
              key={s.name}
              type="button"
              onClick={() => onSelectAnim(isSelected ? 'all' : s.name)}
              style={{
                border: isSelected ? `1.5px solid ${color}` : '1px solid #EBF6FC',
                borderRadius: '12px',
                padding: '10px 12px',
                backgroundColor: isSelected ? '#F4F9FC' : '#FFFFFF',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '6px' }}>
                <span style={{ fontWeight: 800, fontSize: '12.5px', color: '#1B4565' }}>{s.name}</span>
                <span style={{ fontSize: '12px', fontWeight: 900, color }}>
                  {fmt(s.hours)} h/mois
                </span>
              </div>
              <div style={{ height: '8px', borderRadius: '999px', backgroundColor: '#EBF6FC', overflow: 'hidden', marginBottom: '6px' }}>
                <div style={{ width: `${pct}%`, height: '100%', borderRadius: '999px', backgroundColor: color, transition: 'width 0.4s ease' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: '#64748B' }}>
                <span><strong>{s.count}</strong> chantiers actifs</span>
                {s.sensibles > 0 && (
                  <span style={{ color: '#D66927', fontWeight: 700 }}>{s.sensibles} sensibles</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
