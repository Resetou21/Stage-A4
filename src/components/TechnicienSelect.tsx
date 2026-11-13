import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, ChevronDown, Check, Plus, X, Sparkles, Trash2 } from 'lucide-react';
import {
  fetchTechnicienStatusLabels,
  TechnicienLabel,
  DEFAULT_TECHNICIEN_LABELS,
} from '../services/maintenanceApi';

const EXCLUDED_TECH_STORAGE_KEY = 'facility_deleted_technicians_v2';
const CUSTOM_TECH_STORAGE_KEY = 'facility_custom_technicians_v2';

// Couleurs par défaut attrayantes pour de nouvelles étiquettes
const PRESET_NEW_COLORS = [
  { color: '#0073ea', border: '#0060b9' }, // Bleu Monday
  { color: '#00c875', border: '#00b461' }, // Vert
  { color: '#fdab3d', border: '#e99729' }, // Orange
  { color: '#9d50dd', border: '#9238af' }, // Violet
  { color: '#e2445c', border: '#cf384f' }, // Rouge / Corail
  { color: '#00a389', border: '#008a74' }, // Turquoise
  { color: '#579bfc', border: '#4384e6' }, // Ciel
  { color: '#784bd1', border: '#683bbd' }, // Indigo
];

interface TechnicienSelectProps {
  value: string;
  onChange: (value: string) => void;
}

export const TechnicienSelect: React.FC<TechnicienSelectProps> = React.memo(({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [search, setSearch] = useState<string>('');
  const [labels, setLabels] = useState<TechnicienLabel[]>(() => {
    // Initialiser avec les valeurs par défaut + custom stockées
    try {
      const storedCustom = localStorage.getItem(CUSTOM_TECH_STORAGE_KEY);
      const parsedCustom: TechnicienLabel[] = storedCustom ? JSON.parse(storedCustom) : [];
      const combined = [...DEFAULT_TECHNICIEN_LABELS];
      for (const c of parsedCustom) {
        if (!combined.some((item) => item.name.toLowerCase() === c.name.toLowerCase())) {
          combined.push(c);
        }
      }
      return combined;
    } catch {
      return DEFAULT_TECHNICIEN_LABELS;
    }
  });

  const [excludedNames, setExcludedNames] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(EXCLUDED_TECH_STORAGE_KEY);
      const list = raw ? JSON.parse(raw) : [];
      // Auto-exclure les étiquettes de tests accidentelles
      const defaultsExcluded = ['test', 'testetstestetestets'];
      for (const d of defaultsExcluded) {
        if (!list.includes(d)) list.push(d);
      }
      return list;
    } catch {
      return ['test', 'testetstestetestets'];
    }
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Charger en direct les étiquettes depuis Monday
  useEffect(() => {
    let isMounted = true;
    fetchTechnicienStatusLabels().then((remoteLabels) => {
      if (!isMounted || !remoteLabels || remoteLabels.length === 0) return;
      setLabels((prev) => {
        const merged: TechnicienLabel[] = [...prev];
        for (const rl of remoteLabels) {
          const idx = merged.findIndex((m) => m.name.toLowerCase() === rl.name.toLowerCase());
          if (idx >= 0) {
            // Mettre à jour les couleurs de Monday
            merged[idx] = { ...merged[idx], color: rl.color, border: rl.border };
          } else {
            merged.push(rl);
          }
        }
        return merged;
      });
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Fermer lors d'un clic en dehors ou appui sur Échap
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Autofocus quand le menu s'ouvre
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearch('');
    }
  }, [isOpen]);

  // Étiquettes visibles (non supprimées / non exclues)
  const activeLabels = useMemo(() => {
    const exclLower = new Set(excludedNames.map((e) => e.toLowerCase()));
    return labels.filter((l) => !exclLower.has(l.name.toLowerCase()));
  }, [labels, excludedNames]);

  // Filtrage selon la recherche tapée
  const searchNorm = search.trim().toLowerCase();
  const filteredLabels = useMemo(() => {
    if (!searchNorm) return activeLabels;
    return activeLabels.filter((l) => l.name.toLowerCase().includes(searchNorm));
  }, [activeLabels, searchNorm]);

  const exactMatchExists = useMemo(() => {
    if (!searchNorm) return true;
    return activeLabels.some((l) => l.name.toLowerCase() === searchNorm);
  }, [activeLabels, searchNorm]);

  // Étiquette actuellement sélectionnée
  const currentLabel = useMemo(() => {
    return activeLabels.find((l) => l.name.toLowerCase() === (value || '').toLowerCase()) || {
      name: value || 'Christophe',
      color: '#0073ea',
      border: '#0060b9',
    };
  }, [activeLabels, value]);

  // Création d'une nouvelle étiquette
  const handleCreateLabel = (newName: string) => {
    const clean = newName.trim();
    if (!clean) return;

    // Si elle était dans les exclus, la réactiver
    if (excludedNames.some((e) => e.toLowerCase() === clean.toLowerCase())) {
      const nextExcl = excludedNames.filter((e) => e.toLowerCase() !== clean.toLowerCase());
      setExcludedNames(nextExcl);
      try {
        localStorage.setItem(EXCLUDED_TECH_STORAGE_KEY, JSON.stringify(nextExcl));
      } catch {}
    }

    // Choisir une couleur cyclique
    const colorPreset = PRESET_NEW_COLORS[labels.length % PRESET_NEW_COLORS.length];
    const newLabelObj: TechnicienLabel = {
      name: clean,
      color: colorPreset.color,
      border: colorPreset.border,
    };

    const nextLabels = [...labels.filter((l) => l.name.toLowerCase() !== clean.toLowerCase()), newLabelObj];
    setLabels(nextLabels);

    // Sauvegarder dans custom
    try {
      const storedCustom = localStorage.getItem(CUSTOM_TECH_STORAGE_KEY);
      const parsed: TechnicienLabel[] = storedCustom ? JSON.parse(storedCustom) : [];
      const updatedCustom = [...parsed.filter((p) => p.name.toLowerCase() !== clean.toLowerCase()), newLabelObj];
      localStorage.setItem(CUSTOM_TECH_STORAGE_KEY, JSON.stringify(updatedCustom));
    } catch {}

    onChange(clean);
    setSearch('');
    setIsOpen(false);
  };

  // Suppression d'une étiquette (pour tej les faux tests ou anciens techniciens)
  const handleDeleteLabel = (labelName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const clean = labelName.trim();
    const nextExcl = Array.from(new Set([...excludedNames, clean]));
    setExcludedNames(nextExcl);

    try {
      localStorage.setItem(EXCLUDED_TECH_STORAGE_KEY, JSON.stringify(nextExcl));
    } catch {}

    // Si on vient de supprimer celui qui est sélectionné, basculer sur le premier dispo
    if (value.toLowerCase() === clean.toLowerCase()) {
      const remaining = activeLabels.filter((l) => l.name.toLowerCase() !== clean.toLowerCase());
      const fallback = remaining[0]?.name || 'Christophe';
      onChange(fallback);
    }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      {/* Bouton Déclencheur Chic (Style étiquette Monday) */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        title="Changer de technicien ou gérer les étiquettes"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 12px',
          borderRadius: '10px',
          border: isOpen ? '1.5px solid #39A9DC' : '1.5px solid #C8DCE8',
          backgroundColor: '#FFFFFF',
          color: '#1B4565',
          fontSize: '13px',
          fontWeight: 700,
          fontFamily: "'Ruda', sans-serif",
          cursor: 'pointer',
          boxShadow: isOpen ? '0 0 0 3px rgba(57, 169, 220, 0.15)' : '0 1px 3px rgba(27, 69, 101, 0.05)',
          transition: 'all 0.15s ease',
        }}
      >
        {/* Pastille colorée Monday du technicien */}
        <span
          style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            backgroundColor: currentLabel.color || '#0073ea',
            boxShadow: `0 0 0 2px ${currentLabel.border || '#0060b9'}33`,
            flexShrink: 0,
          }}
        />

        <span style={{ color: '#1B4565' }}>{value || currentLabel.name}</span>

        <ChevronDown
          size={14}
          color="#3989B7"
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
          }}
        />
      </button>

      {/* Menu Déroulant Élégant (Style Hub Animatrices & MachineSelect) */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            width: '290px',
            maxHeight: '380px',
            backgroundColor: '#FFFFFF',
            borderRadius: '14px',
            border: '1.5px solid #D2E9F6',
            boxShadow: '0 12px 30px rgba(27, 69, 101, 0.16)',
            zIndex: 1000,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            animation: 'fadeIn 0.12s ease',
          }}
        >
          {/* Barre de recherche d'étiquettes */}
          <div
            style={{
              padding: '10px 12px',
              borderBottom: '1px solid #E2EEF5',
              backgroundColor: '#F8FCFE',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Search size={14} color="#3989B7" style={{ flexShrink: 0 }} />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (filteredLabels.length > 0) {
                    onChange(filteredLabels[0].name);
                    setIsOpen(false);
                  } else if (search.trim()) {
                    handleCreateLabel(search);
                  }
                }
              }}
              placeholder="Rechercher une étiquette..."
              style={{
                width: '100%',
                border: 'none',
                outline: 'none',
                backgroundColor: 'transparent',
                fontSize: '12.5px',
                fontWeight: 600,
                color: '#1B4565',
                fontFamily: 'inherit',
              }}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94A3B8',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* En-tête statut */}
          <div
            style={{
              padding: '6px 12px',
              fontSize: '11px',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              color: '#3989B7',
              backgroundColor: '#FFFFFF',
              borderBottom: '1px solid #F1F5F9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>Étiquettes Technicien</span>
            <span style={{ fontSize: '10px', color: '#94A3B8' }}>{activeLabels.length} au total</span>
          </div>

          {/* Liste des étiquettes */}
          <div
            style={{
              overflowY: 'auto',
              maxHeight: '220px',
              display: 'flex',
              flexDirection: 'column',
              padding: '4px',
            }}
          >
            {filteredLabels.length === 0 ? (
              <div
                style={{
                  padding: '14px 12px',
                  textAlign: 'center',
                  fontSize: '12px',
                  color: '#64748B',
                  fontStyle: 'italic',
                }}
              >
                Aucune étiquette trouvée pour « {search} »
              </div>
            ) : (
              filteredLabels.map((lbl) => {
                const isSelected = (value || '').toLowerCase() === lbl.name.toLowerCase();
                return (
                  <div
                    key={lbl.name}
                    onClick={() => {
                      onChange(lbl.name);
                      setIsOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '7px 10px',
                      borderRadius: '8px',
                      backgroundColor: isSelected ? '#EFF6FF' : 'transparent',
                      cursor: 'pointer',
                      transition: 'background-color 0.1s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = '#F8FCFE';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {/* Badge étiquette style Monday */}
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '3px 10px',
                          borderRadius: '16px',
                          backgroundColor: lbl.color || '#0073ea',
                          color: '#FFFFFF',
                          fontSize: '12px',
                          fontWeight: 700,
                          fontFamily: "'Ruda', sans-serif",
                          boxShadow: `0 1px 4px ${lbl.color || '#0073ea'}44`,
                        }}
                      >
                        {lbl.name}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {isSelected && <Check size={14} color="#0073ea" />}
                      {/* Bouton Supprimer l'étiquette (poubelle discrète au survol) */}
                      <button
                        type="button"
                        onClick={(e) => handleDeleteLabel(lbl.name, e)}
                        title={`Supprimer / masquer l'étiquette « ${lbl.name} »`}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#CBD5E1',
                          cursor: 'pointer',
                          padding: '3px',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'color 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = '#E2445C';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = '#CBD5E1';
                        }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Bouton Création d'étiquette quand non existant */}
          {search.trim() && !exactMatchExists && (
            <button
              type="button"
              onClick={() => handleCreateLabel(search)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 14px',
                borderTop: '1px solid #E2EEF5',
                backgroundColor: '#EFF6FF',
                color: '#0284C7',
                border: 'none',
                borderBottomLeftRadius: '14px',
                borderBottomRightRadius: '14px',
                fontSize: '12px',
                fontWeight: 800,
                fontFamily: "'Ruda', sans-serif",
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background-color 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#E0F2FE';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#EFF6FF';
              }}
            >
              <Plus size={14} color="#0284C7" />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                Créer l'étiquette « <b>{search.trim()}</b> »
              </span>
              <Sparkles size={13} color="#F59E0B" />
            </button>
          )}
        </div>
      )}
    </div>
  );
});
