import React, { useState, useMemo, useEffect } from 'react';
import {
  Calendar,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Search,
  Layers,
  MapPin,
  User,
  LayoutGrid,
  Check,
  Archive,
  RotateCcw,
} from 'lucide-react';
import type { Machine } from '../types';
import {
  MONTH_COLUMN_IDS,
  toggleMachineMonth,
  setMachineAllMonths,
  updateMachinePreventiveSettings,
  clearMachinePreventiveMonths,
} from '../services/maintenanceApi';

const PREVENTIVE_ARCHIVE_PREFIX = 'facility_preventive_archive_';
const ACTIVE_PREVENTIVE_YEAR_KEY = 'facility_active_preventive_year';

export interface PreventiveArchiveSnapshot {
  year: number;
  savedAt: string;
  machines: Record<
    string,
    {
      name: string;
      type: string;
      site: string;
      isPreventive: boolean;
      frequence: string;
      required: number;
      months: Record<number, boolean>;
    }
  >;
}

interface CleanCheckboxProps {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  color?: 'green' | 'blue';
  title?: string;
}

const CleanCheckbox: React.FC<CleanCheckboxProps> = ({
  checked,
  onChange,
  disabled = false,
  color = 'green',
  title,
}) => {
  const activeBg = color === 'green' ? '#00C875' : '#39A9DC';
  const shadowColor = color === 'green' ? 'rgba(0, 200, 117, 0.3)' : 'rgba(57, 169, 220, 0.3)';

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onChange();
      }}
      title={title}
      style={{
        width: '21px',
        height: '21px',
        borderRadius: '6px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        backgroundColor: disabled ? '#F1F5F9' : checked ? activeBg : '#FFFFFF',
        border: disabled ? '1.5px solid #E2EEF5' : checked ? `1.5px solid ${activeBg}` : '1.5px solid #C8DCE8',
        boxShadow: !disabled && checked ? `0 2px 6px ${shadowColor}` : '0 1px 2px rgba(0,0,0,0.04)',
        transition: 'all 0.12s ease',
        opacity: disabled ? 0.45 : 1,
        padding: 0,
        outline: 'none',
      }}
      onMouseEnter={(e) => {
        if (!disabled && !checked) {
          e.currentTarget.style.borderColor = activeBg;
          e.currentTarget.style.backgroundColor = '#F0F8FD';
          e.currentTarget.style.transform = 'scale(1.08)';
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled && !checked) {
          e.currentTarget.style.borderColor = '#C8DCE8';
          e.currentTarget.style.backgroundColor = '#FFFFFF';
          e.currentTarget.style.transform = 'scale(1)';
        }
      }}
    >
      {checked && <Check size={13} strokeWidth={3.5} color="#FFFFFF" />}
    </button>
  );
};

interface MaintenanceMatrixProps {
  machines: Machine[];
  onDataChanged: () => void;
}

export const MaintenanceMatrix: React.FC<MaintenanceMatrixProps> = ({
  machines,
  onDataChanged,
}) => {
  const currentCalendarYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentCalendarYear);
  const [rolloverBannerYear, setRolloverBannerYear] = useState<number | null>(() => {
    try {
      const stored = localStorage.getItem(ACTIVE_PREVENTIVE_YEAR_KEY);
      if (stored && Number(stored) < currentCalendarYear) {
        return Number(stored);
      }
      if (!stored) {
        localStorage.setItem(ACTIVE_PREVENTIVE_YEAR_KEY, String(currentCalendarYear));
      }
    } catch {}
    return null;
  });
  const [isResettingYear, setIsResettingYear] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [resetFeedback, setResetFeedback] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'preventive' | 'todo'>('preventive');
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<number>(() => {
    // Mois actuel par défaut (1 à 12)
    return new Date().getMonth() + 1;
  });

  // États locaux optimistes pour réactivité immédiate (DU TAC AU TAC 0ms)
  const [localMonthChecks, setLocalMonthChecks] = useState<Record<string, boolean>>({});
  const [localPreventive, setLocalPreventive] = useState<Record<string, boolean>>({});
  const [localFrequence, setLocalFrequence] = useState<Record<string, string>>({});

  // Helper pour extraire le texte d'une colonne
  const getCol = (m: Machine, colId: string) => {
    return m.column_values?.find((c) => c.id === colId)?.text || '';
  };

  // Helper pour savoir si une case à cocher est cochée (avec prise en compte immédiate du local state)
  const isChecked = (m: Machine, colId: string, monthNum?: number): boolean => {
    if (monthNum !== undefined) {
      const key = `${m.id}-${monthNum}`;
      if (localMonthChecks[key] !== undefined) {
        return localMonthChecks[key];
      }
    }
    const col = m.column_values?.find((c) => c.id === colId);
    if (!col) return false;
    if (col.text?.toLowerCase() === 'v' || col.text?.toLowerCase() === 'true') return true;
    if (col.value) {
      try {
        const parsed = JSON.parse(col.value);
        return parsed?.checked === 'true' || parsed?.checked === true;
      } catch {}
    }
    return false;
  };

  // Calcul du nombre de mois requis selon la fréquence (fallback si formule absente)
  const getRequiredMonthsCount = (frequenceText: string): number => {
    const lower = (frequenceText || '').toLowerCase();
    if (lower.includes('1 fois par mois') || (lower.includes('mois') && !lower.includes('trimestre') && !lower.includes('an'))) {
      return 12;
    }
    if (lower.includes('trimestre') || lower.includes('4 fois par an') || lower.includes('4 f')) {
      return 4;
    }
    if (lower.includes('2 fois par an') || lower.includes('2 f') || lower.includes('semestre') || lower.includes('6 mois')) {
      return 2;
    }
    if (lower.includes('1 fois par an') || lower.includes('1 f/an') || lower.includes('annuel')) {
      return 1;
    }
    return 2; // Par défaut 2 fois par an
  };

  // Liste des années disponibles (année en cours + années archivées)
  const availableYears = useMemo(() => {
    const yrs = new Set<number>([currentCalendarYear, currentCalendarYear - 1]);
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(PREVENTIVE_ARCHIVE_PREFIX)) {
          const y = Number(k.replace(PREVENTIVE_ARCHIVE_PREFIX, ''));
          if (!Number.isNaN(y) && y > 2020) yrs.add(y);
        }
      }
    } catch {}
    return Array.from(yrs).sort((a, b) => b - a);
  }, [currentCalendarYear, resetFeedback]);

  const isViewingArchive = selectedYear !== currentCalendarYear;

  const archivedSnapshot = useMemo<PreventiveArchiveSnapshot | null>(() => {
    if (!isViewingArchive) return null;
    try {
      const raw = localStorage.getItem(`${PREVENTIVE_ARCHIVE_PREFIX}${selectedYear}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, [isViewingArchive, selectedYear, resetFeedback]);

  // Sauvegarde automatique d'archive de l'année en cours dès que les machines se chargent
  useEffect(() => {
    if (machines.length === 0) return;
    try {
      const snapshot: PreventiveArchiveSnapshot = {
        year: currentCalendarYear,
        savedAt: new Date().toISOString(),
        machines: {},
      };
      for (const m of machines) {
        const isPrev = localPreventive[m.id] !== undefined ? localPreventive[m.id] : isChecked(m, 'boolean_mm8tv8zy');
        const freq = localFrequence[m.id] || getCol(m, 'color_mm8t3v6z') || '2 fois par an';
        const req = getRequiredMonthsCount(freq);
        const months: Record<number, boolean> = {};
        for (let month = 1; month <= 12; month++) {
          months[month] = isChecked(m, MONTH_COLUMN_IDS[month].id, month);
        }
        snapshot.machines[m.id] = {
          name: m.name,
          type: getCol(m, 'color_mm8t2mn5') || 'Général',
          site: getCol(m, 'dropdown_mm8d4vj2') || '—',
          isPreventive: isPrev,
          frequence: freq,
          required: req,
          months,
        };
      }
      localStorage.setItem(`${PREVENTIVE_ARCHIVE_PREFIX}${currentCalendarYear}`, JSON.stringify(snapshot));
    } catch {}
  }, [machines, localMonthChecks, localPreventive, localFrequence, currentCalendarYear]);

  // Traitement et enrichissement des machines (calcul 0ms, année active ou archive)
  const processedMachines = useMemo(() => {
    return machines.map((m) => {
      const archEntry = isViewingArchive ? archivedSnapshot?.machines?.[m.id] : undefined;
      const isPreventive = isViewingArchive
        ? Boolean(archEntry?.isPreventive)
        : localPreventive[m.id] !== undefined
        ? localPreventive[m.id]
        : isChecked(m, 'boolean_mm8tv8zy');
      const frequence = isViewingArchive
        ? archEntry?.frequence || getCol(m, 'color_mm8t3v6z') || '2 fois par an'
        : localFrequence[m.id] || getCol(m, 'color_mm8t3v6z') || '2 fois par an';
      const required = isViewingArchive ? archEntry?.required ?? getRequiredMonthsCount(frequence) : getRequiredMonthsCount(frequence);

      let checkedCount = 0;
      const monthMap: Record<number, boolean> = {};
      for (let month = 1; month <= 12; month++) {
        const colId = MONTH_COLUMN_IDS[month].id;
        const val = isViewingArchive ? Boolean(archEntry?.months?.[month]) : isChecked(m, colId, month);
        monthMap[month] = val;
        if (val) checkedCount++;
      }

      const diff = required - checkedCount;
      let balanceLabel = '';
      if (diff === 0) {
        balanceLabel = '0 (Équilibré)';
      } else if (diff < 0) {
        balanceLabel = `Trop (${Math.abs(diff)} en trop)`;
      } else {
        balanceLabel = String(diff);
      }

      return {
        id: m.id,
        name: m.name,
        type: getCol(m, 'color_mm8t2mn5') || 'Général',
        site: getCol(m, 'dropdown_mm8d4vj2') || '—',
        animateur: getCol(m, 'lookup_mm8d375q') || '—',
        isPreventive,
        frequence,
        required,
        checkedCount,
        balanceDiff: diff,
        indicReste: balanceLabel,
        balance: diff,
        monthMap,
        raw: m,
      };
    });
  }, [machines, localMonthChecks, localPreventive, localFrequence, isViewingArchive, archivedSnapshot]);

  // Filtrage des machines selon les onglets et le terme de recherche
  const filteredMachines = useMemo(() => {
    return processedMachines.filter((m) => {
      // Filtre de mode
      if (filterMode === 'preventive' && !m.isPreventive) return false;
      if (filterMode === 'todo') {
        if (!m.isPreventive) return false;
        // On affiche les machines pour lesquelles il reste des cases à cocher ou trop de cases
        if (m.indicReste === '0' || m.indicReste === '0 (Équilibré)') return false;
      }

      // Filtre de texte
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const matchName = m.name.toLowerCase().includes(q);
        const matchType = m.type.toLowerCase().includes(q);
        const matchSite = m.site.toLowerCase().includes(q);
        const matchResp = m.animateur.toLowerCase().includes(q);
        if (!matchName && !matchType && !matchSite && !matchResp) return false;
      }

      return true;
    });
  }, [processedMachines, filterMode, searchTerm]);

  // Machines programmées pour le mois sélectionné dans le focus
  const currentMonthDueMachines = useMemo(() => {
    return processedMachines.filter((m) => m.isPreventive && Boolean(m.monthMap?.[selectedMonthFilter]));
  }, [processedMachines, selectedMonthFilter]);

  const handleCloseYearAndReset = async (archiveTargetYear: number) => {
    setIsResettingYear(true);
    setResetFeedback(null);

    // 1. Sauvegarder d'abord l'archive complète de l'année écoulée
    try {
      const snapshot: PreventiveArchiveSnapshot = {
        year: archiveTargetYear,
        savedAt: new Date().toISOString(),
        machines: {},
      };
      for (const m of machines) {
        const isPrev = localPreventive[m.id] !== undefined ? localPreventive[m.id] : isChecked(m, 'boolean_mm8tv8zy');
        const freq = localFrequence[m.id] || getCol(m, 'color_mm8t3v6z') || '2 fois par an';
        const req = getRequiredMonthsCount(freq);
        const months: Record<number, boolean> = {};
        for (let month = 1; month <= 12; month++) {
          months[month] = isChecked(m, MONTH_COLUMN_IDS[month].id, month);
        }
        snapshot.machines[m.id] = {
          name: m.name,
          type: getCol(m, 'color_mm8t2mn5') || 'Général',
          site: getCol(m, 'dropdown_mm8d4vj2') || '—',
          isPreventive: isPrev,
          frequence: freq,
          required: req,
          months,
        };
      }
      localStorage.setItem(`${PREVENTIVE_ARCHIVE_PREFIX}${archiveTargetYear}`, JSON.stringify(snapshot));
      localStorage.setItem(ACTIVE_PREVENTIVE_YEAR_KEY, String(currentCalendarYear));
    } catch {}

    // 2. Remettre à 0 uniquement les cases mensuelles des machines préventives ayant au moins 1 mois coché
    const targetIds = processedMachines
      .filter((m) => m.isPreventive && m.checkedCount > 0)
      .map((m) => m.id);

    const optimisticReset: Record<string, boolean> = {};
    for (const id of targetIds) {
      for (let month = 1; month <= 12; month++) {
        optimisticReset[`${id}-${month}`] = false;
      }
    }
    setLocalMonthChecks((prev) => ({ ...prev, ...optimisticReset }));

    const res = await clearMachinePreventiveMonths(targetIds);
    setIsResettingYear(false);
    setConfirmResetOpen(false);
    setRolloverBannerYear(null);

    if (res.success) {
      setResetFeedback(
        `Année ${archiveTargetYear} archivée et ${res.updatedCount} machine(s) remises à 0 pour ${currentCalendarYear}.`
      );
      onDataChanged?.();
    } else {
      setResetFeedback(res.error || 'Archive enregistrée localement, mais erreur partielle sur Monday.');
    }
  };

  // Clic sur une case de mois (RÉACTIVITÉ DU TAC AU TAC 0ms + sauvegarde Monday en arrière-plan)
  const handleToggleMonth = (machineId: string, month: number, currentChecked: boolean) => {
    const newChecked = !currentChecked;
    const cellKey = `${machineId}-${month}`;

    // 1. Mise à jour instantanée à l'écran (0 milliseconde)
    setLocalMonthChecks((prev) => ({
      ...prev,
      [cellKey]: newChecked,
    }));

    // 2. Appel en arrière-plan vers Monday sans bloquer l'UI
    toggleMachineMonth(machineId, month, newChecked).then((res) => {
      if (!res.success) {
        console.error('Échec mise à jour Monday :', res.error);
        // Rollback seulement en cas d'erreur avérée
        setLocalMonthChecks((prev) => ({
          ...prev,
          [cellKey]: currentChecked,
        }));
      } else {
        onDataChanged?.();
      }
    }).catch((err) => {
      console.error('Erreur réseau :', err);
      setLocalMonthChecks((prev) => ({
        ...prev,
        [cellKey]: currentChecked,
      }));
    });
  };

  // Clic sur la case "Maintenance Préventive" (Instantané 0ms)
  const handleTogglePreventive = (machineId: string, currentVal: boolean) => {
    const newVal = !currentVal;
    setLocalPreventive((prev) => ({
      ...prev,
      [machineId]: newVal,
    }));

    updateMachinePreventiveSettings(machineId, { maintenancePreventive: newVal }).then((res) => {
      if (!res.success) {
        setLocalPreventive((prev) => ({
          ...prev,
          [machineId]: currentVal,
        }));
      } else {
        onDataChanged?.();
      }
    }).catch(() => {
      setLocalPreventive((prev) => ({
        ...prev,
        [machineId]: currentVal,
      }));
    });
  };

  // Changement de fréquence (Instantané 0ms)
  const handleChangeFrequence = (machineId: string, newFreq: string) => {
    setLocalFrequence((prev) => ({
      ...prev,
      [machineId]: newFreq,
    }));

    // Si la fréquence choisie est "1 fois par mois (12/an)", on coche automatiquement tous les 12 mois !
    if (newFreq.includes('1 fois par mois') || newFreq.includes('12/an') || newFreq.includes('12')) {
      const allMonthsUpdate: Record<string, boolean> = {};
      for (let m = 1; m <= 12; m++) {
        allMonthsUpdate[`${machineId}-${m}`] = true;
      }
      setLocalMonthChecks((prev) => ({
        ...prev,
        ...allMonthsUpdate,
      }));
      setMachineAllMonths(machineId, true).then(() => onDataChanged?.()).catch((err) => {
        console.error('Erreur coche automatique 12 mois:', err);
      });
    }

    updateMachinePreventiveSettings(machineId, { frequence: newFreq }).then((res) => {
      if (!res.success) {
        console.error('Erreur sauvegarde fréquence');
      } else {
        onDataChanged?.();
      }
    });
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '6px 0 30px 0' }}>
      {/* ================= BANNIÈRE DE TITRE FACILITY ================= */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          padding: '22px 28px',
          marginBottom: '22px',
          border: '1px solid #E2EEF5',
          boxShadow: '0 4px 16px rgba(27, 69, 101, 0.04)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              backgroundColor: '#1B4565',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
            }}
          >
            <LayoutGrid size={24} />
          </div>
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: '20px',
                fontWeight: 800,
                fontFamily: "'Ruda', sans-serif",
                color: '#1B4565',
                letterSpacing: '-0.3px',
              }}
            >
              Maintenance Préventive &amp; Matrice 12 Mois
            </h2>
            <p
              style={{
                margin: '4px 0 0 0',
                fontSize: '13px',
                color: '#3989B7',
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontWeight: 500,
              }}
            >
              Cochez les mois directement : mise à jour instantanée de Monday et calcul de l'indicateur reste à cocher
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div
            style={{
              padding: '5px 12px',
              borderRadius: '20px',
              backgroundColor: isViewingArchive ? '#FFF8EC' : '#F5F9FC',
              color: '#1B4565',
              border: `1px solid ${isViewingArchive ? '#F7AC37' : '#E2EEF5'}`,
              fontSize: '12.5px',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Calendar size={15} color={isViewingArchive ? '#D66927' : '#39A9DC'} />
            <span>Exercice :</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              style={{
                border: 'none',
                background: 'transparent',
                fontWeight: 800,
                color: '#1B4565',
                fontSize: '12.5px',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              {availableYears.map((yr) => (
                <option key={yr} value={yr}>
                  {yr} {yr === currentCalendarYear ? '(Actif)' : '(Archive)'}
                </option>
              ))}
            </select>
          </div>

          {!isViewingArchive && (
            <button
              type="button"
              onClick={() => setConfirmResetOpen((v) => !v)}
              title="Archiver l'exercice et remettre les cases mensuelles à 0 (clôture 31 décembre / 1er janvier)"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 12px',
                borderRadius: '18px',
                border: '1px solid #CBD5E1',
                backgroundColor: '#FFFFFF',
                color: '#1B4565',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <RotateCcw size={13} color="#D66927" />
              Clôturer / Remettre à 0
            </button>
          )}
        </div>
      </div>

      {/* Bannière passage d'année (31 déc -> 1er jan) ou confirmation manuelle */}
      {(rolloverBannerYear || confirmResetOpen || isViewingArchive || resetFeedback) && (
        <div
          style={{
            marginBottom: '16px',
            padding: '12px 18px',
            borderRadius: '12px',
            backgroundColor: isViewingArchive ? '#FFFBEB' : resetFeedback ? '#ECFDF5' : '#EFF6FF',
            border: `1px solid ${isViewingArchive ? '#FDE68A' : resetFeedback ? '#A7F3D0' : '#BFDBFE'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px',
            fontSize: '12.5px',
            color: '#1B4565',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
            <Archive size={16} color={isViewingArchive ? '#D97706' : '#0284C7'} />
            {isViewingArchive ? (
              archivedSnapshot ? (
                <span>
                  <b>Archive {selectedYear} (lecture seule)</b> — Sauvegardée le{' '}
                  {new Date(archivedSnapshot.savedAt).toLocaleDateString('fr-FR')}. Vos compteurs en direct de {currentCalendarYear} ne sont pas modifiés.
                </span>
              ) : (
                <span>
                  Aucune archive enregistrée localement pour {selectedYear}. Les futures clôtures annuelles conserveront automatiquement l&apos;historique ici.
                </span>
              )
            ) : resetFeedback ? (
              <span>{resetFeedback}</span>
            ) : rolloverBannerYear ? (
              <span>
                Nouvel exercice <b>{currentCalendarYear}</b> détecté : voulez-vous archiver <b>{rolloverBannerYear}</b> et remettre les compteurs mensuels à 0 ?
              </span>
            ) : (
              <span>
                <b>Clôture annuelle :</b> archive l&apos;année en cours dans l&apos;historique puis remet les 12 mois à 0 pour la nouvelle année.
              </span>
            )}
          </div>

          {!isViewingArchive && (rolloverBannerYear || confirmResetOpen) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                disabled={isResettingYear}
                onClick={() => handleCloseYearAndReset(rolloverBannerYear || currentCalendarYear - 1)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#0284C7',
                  color: '#FFFFFF',
                  fontSize: '12px',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                {isResettingYear ? 'Archivage en cours...' : `Confirmer l'archivage + remise à 0`}
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmResetOpen(false);
                  setRolloverBannerYear(null);
                  try {
                    localStorage.setItem(ACTIVE_PREVENTIVE_YEAR_KEY, String(currentCalendarYear));
                  } catch {}
                }}
                style={{
                  padding: '6px 10px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  color: '#475569',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Plus tard
              </button>
            </div>
          )}
        </div>
      )}

      {/* ================= BARRE DE RECHERCHE ET FILTRES ================= */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '20px',
        }}
      >
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setFilterMode('preventive')}
            style={{
              padding: '8px 16px',
              borderRadius: '10px',
              border: 'none',
              backgroundColor: filterMode === 'preventive' ? '#39A9DC' : '#FFFFFF',
              color: filterMode === 'preventive' ? '#FFFFFF' : '#3989B7',
              fontSize: '13px',
              fontWeight: 800,
              fontFamily: "'Ruda', sans-serif",
              cursor: 'pointer',
              boxShadow: filterMode === 'preventive' ? '0 4px 12px rgba(57, 169, 220, 0.3)' : 'none',
              borderWidth: filterMode === 'preventive' ? '0' : '1px',
              borderColor: '#E2EEF5',
              borderStyle: 'solid',
            }}
          >
            Machines en Maintenance ({processedMachines.filter((m) => m.isPreventive).length})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('todo')}
            style={{
              padding: '8px 16px',
              borderRadius: '10px',
              border: 'none',
              backgroundColor: filterMode === 'todo' ? '#F7AC37' : '#FFFFFF',
              color: filterMode === 'todo' ? '#FFFFFF' : '#3989B7',
              fontSize: '13px',
              fontWeight: 800,
              fontFamily: "'Ruda', sans-serif",
              cursor: 'pointer',
              boxShadow: filterMode === 'todo' ? '0 4px 12px rgba(247, 172, 55, 0.3)' : 'none',
              borderWidth: filterMode === 'todo' ? '0' : '1px',
              borderColor: '#E2EEF5',
              borderStyle: 'solid',
            }}
          >
            Reste des mois à cocher ({processedMachines.filter((m) => m.isPreventive && m.balance > 0).length})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('all')}
            style={{
              padding: '8px 16px',
              borderRadius: '10px',
              border: 'none',
              backgroundColor: filterMode === 'all' ? '#1B4565' : '#FFFFFF',
              color: filterMode === 'all' ? '#FFFFFF' : '#3989B7',
              fontSize: '13px',
              fontWeight: 800,
              fontFamily: "'Ruda', sans-serif",
              cursor: 'pointer',
              borderWidth: filterMode === 'all' ? '0' : '1px',
              borderColor: '#E2EEF5',
              borderStyle: 'solid',
            }}
          >
            Tout le parc ({machines.length})
          </button>
        </div>

        <div style={{ position: 'relative', width: '280px' }}>
          <Search
            size={16}
            color="#6C8CA3"
            style={{ position: 'absolute', left: '12px', top: '11px' }}
          />
          <input
            type="text"
            placeholder="Rechercher machine, site, type..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '9px 12px 9px 36px',
              borderRadius: '10px',
              border: '1px solid #C8DCE8',
              fontSize: '13px',
              fontFamily: 'inherit',
              outline: 'none',
              boxSizing: 'border-box',
              color: '#1B4565',
            }}
          />
        </div>
      </div>

      {/* ================= FOCUS OPÉRATIONS DU MOIS ================= */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          padding: '20px 24px',
          marginBottom: '22px',
          border: '1px solid #E2EEF5',
          boxShadow: '0 4px 14px rgba(27, 69, 101, 0.04)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '14px',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                backgroundColor: '#39A9DC',
                color: '#FFFFFF',
                borderRadius: '6px',
                padding: '3px 9px',
                fontSize: '11.5px',
                fontWeight: 800,
                fontFamily: "'Ruda', sans-serif",
              }}
            >
              FOCUS MENSUEL
            </span>
            <span style={{ fontSize: '15px', fontWeight: 800, fontFamily: "'Ruda', sans-serif", color: '#1B4565' }}>
              Opérations programmées pour :
            </span>
            <select
              value={selectedMonthFilter}
              onChange={(e) => setSelectedMonthFilter(Number(e.target.value))}
              style={{
                padding: '5px 12px',
                borderRadius: '8px',
                border: '1.5px solid #39A9DC',
                fontWeight: 800,
                fontFamily: "'Ruda', sans-serif",
                color: '#1B4565',
                fontSize: '13px',
                backgroundColor: '#F0F8FD',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {MONTH_COLUMN_IDS[m].label} ({MONTH_COLUMN_IDS[m].short})
                </option>
              ))}
            </select>
            <span style={{ fontSize: '13px', color: '#3989B7', fontWeight: 600 }}>
              ({currentMonthDueMachines.length} machine(s) programmée(s))
            </span>
          </div>
        </div>

        {currentMonthDueMachines.length === 0 ? (
          <div style={{ fontSize: '13px', color: '#6C8CA3', fontStyle: 'italic', padding: '6px 0' }}>
            Aucune machine cochée pour ce mois.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
            {currentMonthDueMachines.map((m) => (
              <div
                key={m.id}
                style={{
                  backgroundColor: '#F8FCFE',
                  border: '1px solid #D2E9F6',
                  borderRadius: '12px',
                  padding: '12px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <div style={{ fontWeight: 800, fontSize: '13.5px', color: '#1B4565', fontFamily: "'Ruda', sans-serif" }}>
                  {m.name}
                </div>
                <div style={{ fontSize: '12px', color: '#39A9DC', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 600 }}>
                  <Layers size={13} /> {m.type}
                </div>
                <div style={{ fontSize: '12px', color: '#57778E', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <MapPin size={13} /> {m.site}
                </div>
                {m.animateur !== '—' && (
                  <div style={{ fontSize: '11.5px', color: '#57778E', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <User size={12} /> Resp : {m.animateur}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ================= GRILLE MATRICE DES 12 MOIS ================= */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #E2EEF5',
          boxShadow: '0 4px 16px rgba(27, 69, 101, 0.04)',
          overflowX: 'auto',
        }}
      >
        <table
          style={{
            width: '100%',
            minWidth: '1090px',
            tableLayout: 'fixed',
            borderCollapse: 'collapse',
            fontSize: '13px',
            textAlign: 'left',
          }}
        >
          <colgroup>
            <col style={{ width: '235px' }} /> {/* Machine */}
            <col style={{ width: '54px' }} />  {/* Prév. */}
            <col style={{ width: '225px' }} /> {/* Fréquence */}
            {Array.from({ length: 12 }).map((_, i) => (
              <col key={i} style={{ width: '38px' }} />
            ))}
            <col style={{ width: '155px' }} /> {/* Reste à cocher */}
          </colgroup>
          <thead>
            <tr style={{ backgroundColor: '#F5F9FC', borderBottom: '1.5px solid #E2EEF5' }}>
              <th style={{ padding: '13px 14px', fontWeight: 800, fontFamily: "'Ruda', sans-serif", color: '#1B4565', width: '235px', boxSizing: 'border-box' }}>
                Machine
              </th>
              <th style={{ padding: '13px 4px', fontWeight: 800, fontFamily: "'Ruda', sans-serif", color: '#3989B7', width: '54px', textAlign: 'center', boxSizing: 'border-box' }}>
                Prév.
              </th>
              <th style={{ padding: '13px 10px', fontWeight: 800, fontFamily: "'Ruda', sans-serif", color: '#3989B7', width: '225px', boxSizing: 'border-box' }}>
                Fréquence
              </th>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <th
                  key={m}
                  style={{
                    padding: '11px 2px',
                    fontWeight: 800,
                    fontFamily: "'Ruda', sans-serif",
                    color: m === selectedMonthFilter ? '#39A9DC' : '#3989B7',
                    textAlign: 'center',
                    width: '38px',
                    backgroundColor: m === selectedMonthFilter ? '#EBF6FC' : 'transparent',
                    boxSizing: 'border-box',
                  }}
                >
                  {MONTH_COLUMN_IDS[m].short}
                </th>
              ))}
              <th style={{ padding: '13px 8px', fontWeight: 800, fontFamily: "'Ruda', sans-serif", color: '#1B4565', textAlign: 'center', width: '155px', boxSizing: 'border-box' }}>
                Reste à cocher
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredMachines.length === 0 ? (
              <tr>
                <td colSpan={16} style={{ padding: '28px', textAlign: 'center', color: '#6C8CA3', fontStyle: 'italic' }}>
                  Aucune machine trouvée pour ce filtre.
                </td>
              </tr>
            ) : (
              filteredMachines.map((m) => {
                const balanceBadge = () => {
                  const diff = m.balanceDiff !== undefined ? m.balanceDiff : (m.required - m.checkedCount);

                  // 1. Équilibré (diff === 0)
                  if (diff === 0) {
                    return (
                      <span
                        style={{
                          backgroundColor: '#E6F8F0',
                          color: '#0E7042',
                          padding: '4px 8px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: 800,
                          fontFamily: "'Ruda', sans-serif",
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '5px',
                          border: '1px solid #00C875',
                          whiteSpace: 'nowrap',
                          width: '100%',
                          maxWidth: '145px',
                          boxSizing: 'border-box',
                        }}
                      >
                        <CheckCircle2 size={13} color="#00C875" /> 0 (Équilibré)
                      </span>
                    );
                  }

                  // 2. Trop de cases cochées (diff < 0)
                  if (diff < 0) {
                    const surplus = Math.abs(diff);
                    return (
                      <span
                        style={{
                          backgroundColor: '#FDECEE',
                          color: '#961C2E',
                          padding: '4px 8px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: 800,
                          fontFamily: "'Ruda', sans-serif",
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '5px',
                          border: '1px solid #E2445C',
                          whiteSpace: 'nowrap',
                          width: '100%',
                          maxWidth: '145px',
                          boxSizing: 'border-box',
                        }}
                        title={`${surplus} case(s) en trop par rapport à la fréquence`}
                      >
                        <AlertTriangle size={13} color="#E2445C" /> Trop de cases (+{surplus})
                      </span>
                    );
                  }

                  // 3. Reste des cases à cocher (diff > 0)
                  return (
                    <span
                      style={{
                        backgroundColor: '#FFF8EC',
                        color: '#D66927',
                        padding: '4px 8px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: 800,
                        fontFamily: "'Ruda', sans-serif",
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '5px',
                        border: '1px solid #F7AC37',
                        whiteSpace: 'nowrap',
                        width: '100%',
                        maxWidth: '145px',
                        boxSizing: 'border-box',
                      }}
                    >
                      <AlertCircle size={13} color="#F7AC37" /> Reste {diff} à cocher
                    </span>
                  );
                };

                return (
                  <tr
                    key={m.id}
                    style={{
                      borderBottom: '1px solid #E2EEF5',
                      backgroundColor: m.isPreventive ? '#FFFFFF' : '#FAFCFD',
                    }}
                  >
                    {/* Machine info */}
                    <td style={{ padding: '11px 16px', width: '250px', boxSizing: 'border-box', overflow: 'hidden' }}>
                      <div
                        style={{
                          fontWeight: 700,
                          color: '#1B4565',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        title={m.name}
                      >
                        {m.name}
                      </div>
                      <div
                        style={{
                          fontSize: '11.5px',
                          color: '#3989B7',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {m.type} • {m.site}
                      </div>
                    </td>

                    {/* Case Maintenance Préventive */}
                    <td style={{ textAlign: 'center', padding: '10px 4px', width: '56px', boxSizing: 'border-box' }}>
                      <CleanCheckbox
                        checked={m.isPreventive}
                        disabled={isViewingArchive}
                        onChange={() => !isViewingArchive && handleTogglePreventive(m.id, m.isPreventive)}
                        color="blue"
                        title={isViewingArchive ? 'Mode archive (lecture seule)' : 'Activer la maintenance préventive'}
                      />
                    </td>

                    {/* Menu déroulant Fréquence */}
                    <td style={{ padding: '10px 8px', width: '225px', boxSizing: 'border-box' }}>
                      <select
                        value={m.frequence}
                        disabled={!m.isPreventive || isViewingArchive}
                        onChange={(e) => handleChangeFrequence(m.id, e.target.value)}
                        style={{
                          width: '100%',
                          maxWidth: '215px',
                          boxSizing: 'border-box',
                          padding: '6px 8px',
                          borderRadius: '8px',
                          border: '1.5px solid #C8DCE8',
                          fontSize: '12px',
                          fontWeight: 600,
                          color: '#1B4565',
                          backgroundColor: m.isPreventive && !isViewingArchive ? '#FFFFFF' : '#F1F5F9',
                          cursor: m.isPreventive && !isViewingArchive ? 'pointer' : 'not-allowed',
                          fontFamily: 'inherit',
                          outline: 'none',
                        }}
                      >
                        <option value="1 fois par mois">1 fois par mois (12/an)</option>
                        <option value="1 fois par trimestre">1 fois par trimestre (4/an)</option>
                        <option value="2 fois par an">2 fois par an (2/an)</option>
                        <option value="1 fois par an">1 fois par an (1/an)</option>
                      </select>
                    </td>

                    {/* Les 12 mois (tac au tac 0ms ou lecture archive) */}
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
                      const checked = Boolean(m.monthMap?.[month]);

                      return (
                        <td
                          key={month}
                          style={{
                            textAlign: 'center',
                            padding: '6px 2px',
                            width: '38px',
                            boxSizing: 'border-box',
                            backgroundColor: month === selectedMonthFilter ? '#F4FAFD' : 'transparent',
                          }}
                        >
                          <CleanCheckbox
                            checked={checked}
                            disabled={!m.isPreventive || isViewingArchive}
                            onChange={() => !isViewingArchive && handleToggleMonth(m.id, month, checked)}
                            color="green"
                            title={`${MONTH_COLUMN_IDS[month].label} - ${m.name}`}
                          />
                        </td>
                      );
                    })}

                    {/* Indicateur de reste à cocher */}
                    <td style={{ textAlign: 'center', padding: '10px 6px', width: '145px', boxSizing: 'border-box' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%' }}>
                        {m.isPreventive ? balanceBadge() : (
                          <span style={{ fontSize: '11px', color: '#94A3B8' }}>Non préventif</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
