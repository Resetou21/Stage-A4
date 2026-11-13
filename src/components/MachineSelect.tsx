import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Wrench,
  ChevronDown,
  Check,
  Search,
  X,
  MapPin,
} from 'lucide-react';
import type { Machine } from '../types';

interface MachineSelectProps {
  machines: Machine[];
  selectedMachineId: string;
  onSelectMachine: (machineId: string) => void;
  getCol: (m: Machine, colId: string) => string;
}

export function isRealCleaningMachine(m: Machine, getCol: (m: Machine, colId: string) => string): boolean {
  const name = (m.name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
  const type = getCol(m, 'color_mm8t2mn5')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  // 1. Exclure les types explicitement classés en accessoires / batteries / chargeurs
  const excludeTypes = ['batterie', 'chargeur', 'charge', 'accu', 'cable', 'flexible', 'accessoire', 'suceur', 'lamelle', 'bavette', 'brosse seule', 'disque'];
  if (excludeTypes.some((kw) => type.includes(kw))) {
    return false;
  }

  // 2. Une machine "à batterie" ou "avec batterie(s)" (ex: Mini Monobrosse à batterie, Souffleur avec batterie) est bien une machine
  if (/\b(a|avec|sur|sans)\s+batteries?\b/.test(name)) {
    return true;
  }

  // 3. Si le type est un vrai type machine connu, on la garde même si son libellé mentionne batterie/chargeur
  const realMachineTypes = ['autolaveuse', 'monobrosse', 'aspirateur', 'souffleur', 'balayeuse', 'haute pression', 'chariot', 'manutention', 'injecteur', 'escabeau', 'nettoyeur'];
  if (realMachineTypes.some((rt) => type.includes(rt))) {
    // Sauf s'il s'agit explicitement d'un doublon accessoire "bis"
    if (name.includes('bis') && (name.includes('bat') || name.includes('charg') || name.includes('accu') || name.includes('access'))) {
      return false;
    }
    return true;
  }

  // 4. Sinon (type vide ou non classé), exclure les batteries/chargeurs autonomes et doublons accessoires "bis"
  if (name.includes('bis') && (name.includes('bat') || name.includes('charg') || name.includes('accu') || name.includes('access'))) {
    return false;
  }
  if (name.includes('batterie') || name.includes('chargeur')) {
    return false;
  }

  return true;
}

export const MachineSelect: React.FC<MachineSelectProps> = React.memo(({
  machines,
  selectedMachineId,
  onSelectMachine,
  getCol,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Fermer lors d'un clic en dehors ou appui sur Escape
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

  // Autofocus sur la recherche à l'ouverture
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Machine sélectionnée
  const selectedMachine = useMemo(() => {
    return machines.find((m) => m.id === selectedMachineId) || null;
  }, [machines, selectedMachineId]);

  // Filtrage automatique des vraies machines (exclusion des chargeurs, batteries et accessoires)
  const realMachines = useMemo(() => {
    return machines.filter((m) => isRealCleaningMachine(m, getCol));
  }, [machines, getCol]);

  // Tri naturel des vraies machines par nom/numéro (ex: 1, 2, 10, 22...)
  const sortedMachines = useMemo(() => {
    return [...realMachines].sort((a, b) => {
      return a.name.localeCompare(b.name, 'fr', { numeric: true, sensitivity: 'base' });
    });
  }, [realMachines]);

  // Filtrage selon la recherche
  const filteredMachines = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return sortedMachines;
    return sortedMachines.filter((m) => {
      const name = m.name.toLowerCase();
      const type = getCol(m, 'color_mm8t2mn5').toLowerCase();
      const site = getCol(m, 'dropdown_mm8d4vj2').toLowerCase();
      return name.includes(q) || type.includes(q) || site.includes(q);
    });
  }, [sortedMachines, search, getCol]);

  // Extrait le numéro ou les initiales de la machine pour le badge visuel
  const getBadgeNumber = (name: string) => {
    const match = name.match(/^(\d+)/);
    if (match) return match[1];
    const parts = name.trim().split(/\s+/);
    if (parts.length > 0 && parts[0].length <= 3) return parts[0];
    return name.substring(0, 2).toUpperCase();
  };

  const handleSelect = (mId: string) => {
    onSelectMachine(mId);
    setIsOpen(false);
    setSearch('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectMachine('');
    setSearch('');
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      {/* En-tête avec compteur d'options comme sur AnimatriceSelect */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '8px',
        }}
      >
        <span
          style={{
            fontSize: '13px',
            fontWeight: 800,
            fontFamily: "'Ruda', sans-serif",
            color: '#1B4565',
            letterSpacing: '0.2px',
          }}
        >
          MACHINE DU PARC
        </span>
        <span
          style={{
            fontSize: '12px',
            fontWeight: 700,
            color: '#3989B7',
            fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}
        >
          {sortedMachines.length} machines disponibles (batteries &amp; accessoires exclus)
        </span>
      </div>

      {/* Bouton Déclencheur Principal (Trigger style Animatrices Hub) */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderRadius: '14px',
          border: isOpen ? '2px solid #39A9DC' : '1.5px solid #C8DCE8',
          backgroundColor: selectedMachine ? '#FFFFFF' : '#FAFCFD',
          boxShadow: isOpen
            ? '0 0 0 3px rgba(57, 169, 220, 0.18)'
            : '0 2px 6px rgba(27, 69, 101, 0.03)',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          userSelect: 'none',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0, flex: 1 }}>
          {selectedMachine ? (
            <>
              {/* Badge numéro machine */}
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  backgroundColor: '#EBF6FC',
                  color: '#39A9DC',
                  fontSize: '13px',
                  fontWeight: 900,
                  fontFamily: "'Ruda', sans-serif",
                  border: '1.5px solid #D2E9F6',
                  flexShrink: 0,
                }}
              >
                {getBadgeNumber(selectedMachine.name)}
              </span>

              {/* Détails de la machine */}
              <div style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                <span
                  style={{
                    display: 'block',
                    fontSize: '14.5px',
                    fontWeight: 800,
                    fontFamily: "'Ruda', sans-serif",
                    color: '#1B4565',
                    lineHeight: 1.25,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {selectedMachine.name}
                </span>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    marginTop: '3px',
                    fontSize: '12px',
                    color: '#57778E',
                  }}
                >
                  <span
                    style={{
                      color: '#39A9DC',
                      fontWeight: 700,
                      backgroundColor: '#EBF6FC',
                      padding: '1px 7px',
                      borderRadius: '5px',
                      fontSize: '11px',
                    }}
                  >
                    {getCol(selectedMachine, 'color_mm8t2mn5') || 'Général'}
                  </span>
                  {getCol(selectedMachine, 'dropdown_mm8d4vj2') && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <MapPin size={12} color="#3989B7" />
                      {getCol(selectedMachine, 'dropdown_mm8d4vj2')}
                    </span>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#6C8CA3' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  backgroundColor: '#F0F5F8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#6C8CA3',
                }}
              >
                <Wrench size={18} />
              </div>
              <span style={{ fontSize: '14px', fontWeight: 600 }}>
                Sélectionner une machine parmi les {machines.length} disponibles...
              </span>
            </div>
          )}
        </div>

        {/* Boutons d'action à droite (Supprimer / Chevron) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, marginLeft: '12px' }}>
          {selectedMachine && (
            <button
              type="button"
              onClick={handleClear}
              title="Désélectionner"
              style={{
                background: 'none',
                border: 'none',
                color: '#6C8CA3',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={16} />
            </button>
          )}

          <ChevronDown
            size={18}
            color={isOpen ? '#39A9DC' : '#6C8CA3'}
            style={{
              transition: 'transform 0.2s ease',
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          />
        </div>
      </div>

      {/* ================= MENU DÉROULANT FLOTTANT (S'OUVRE TOUJOURS VERS LE BAS) ================= */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            zIndex: 9999,
            backgroundColor: '#FFFFFF',
            borderRadius: '14px',
            border: '1.5px solid #39A9DC',
            boxShadow: '0 12px 36px rgba(27, 69, 101, 0.18)',
            padding: '10px',
            animation: 'fadeIn 0.12s ease-out',
            boxSizing: 'border-box',
          }}
        >
          {/* Barre de recherche intégrée dans le menu */}
          <div style={{ position: 'relative', marginBottom: '10px' }}>
            <Search
              size={16}
              color="#39A9DC"
              style={{ position: 'absolute', left: '12px', top: '12px' }}
            />
            <input
              ref={searchInputRef}
              type="text"
              placeholder={`Rechercher parmi les ${machines.length} machines (nom, n°, type, site)...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px 10px 38px',
                borderRadius: '10px',
                border: '1px solid #C8DCE8',
                fontSize: '13.5px',
                fontFamily: 'inherit',
                color: '#1B4565',
                outline: 'none',
                boxSizing: 'border-box',
                backgroundColor: '#F8FCFE',
              }}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '10px',
                  background: 'none',
                  border: 'none',
                  color: '#6C8CA3',
                  cursor: 'pointer',
                  padding: '2px',
                }}
              >
                <X size={15} />
              </button>
            )}
          </div>

          <div
            style={{
              padding: '2px 8px 8px 8px',
              fontSize: '11px',
              fontWeight: 800,
              fontFamily: "'Ruda', sans-serif",
              color: '#3989B7',
              textTransform: 'uppercase',
              letterSpacing: '0.4px',
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span>Liste complète du parc</span>
            <span>{filteredMachines.length} résultat(s)</span>
          </div>

          {/* Liste déroulante complète et scrollable */}
          <div
            style={{
              maxHeight: '340px',
              overflowY: 'auto',
              paddingRight: '4px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            {filteredMachines.length === 0 ? (
              <div
                style={{
                  padding: '24px 16px',
                  textAlign: 'center',
                  color: '#6C8CA3',
                  fontSize: '13px',
                  fontStyle: 'italic',
                }}
              >
                Aucune machine ne correspond à « {search} »
              </div>
            ) : (
              filteredMachines.map((m) => {
                const isSelected = selectedMachineId === m.id;
                const type = getCol(m, 'color_mm8t2mn5') || 'Général';
                const site = getCol(m, 'dropdown_mm8d4vj2');
                const badgeNum = getBadgeNumber(m.name);

                return (
                  <div
                    key={m.id}
                    onClick={() => handleSelect(m.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      backgroundColor: isSelected ? '#EBF6FC' : 'transparent',
                      border: isSelected ? '1px solid #39A9DC' : '1px solid transparent',
                      transition: 'all 0.12s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = '#F5F9FC';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                      {/* Pastille numéro */}
                      <span
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          backgroundColor: isSelected ? '#39A9DC' : '#EBF6FC',
                          color: isSelected ? '#FFFFFF' : '#39A9DC',
                          fontSize: '12px',
                          fontWeight: 900,
                          fontFamily: "'Ruda', sans-serif",
                          flexShrink: 0,
                          border: isSelected ? 'none' : '1px solid #D2E9F6',
                        }}
                      >
                        {badgeNum}
                      </span>

                      {/* Libellé et méta-données */}
                      <div style={{ minWidth: 0, overflow: 'hidden' }}>
                        <div
                          style={{
                            fontSize: '13.5px',
                            fontWeight: 800,
                            fontFamily: "'Ruda', sans-serif",
                            color: isSelected ? '#0073EA' : '#1B4565',
                            lineHeight: 1.25,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {m.name}
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            marginTop: '2px',
                            fontSize: '11.5px',
                            color: '#57778E',
                          }}
                        >
                          <span
                            style={{
                              color: '#39A9DC',
                              fontWeight: 700,
                              backgroundColor: '#EBF6FC',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              fontSize: '10.5px',
                            }}
                          >
                            {type}
                          </span>
                          {site && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                              <MapPin size={11} color="#6C8CA3" />
                              {site}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Coche de validation si sélectionné */}
                    {isSelected && (
                      <div
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          backgroundColor: '#39A9DC',
                          color: '#FFFFFF',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          marginLeft: '10px',
                        }}
                      >
                        <Check size={14} strokeWidth={3} />
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
});

interface AlertContextSelectProps {
  machines: Machine[];
  value: string;
  onChange: (value: string) => void;
  getCol: (m: Machine, colId: string) => string;
  placeholder?: string;
  accentColor?: string;
}

/**
 * Sélecteur déroulant style Google (adapté depuis MachineSelect) pour choisir
 * rapidement une machine du parc, un site d'affectation ou une saisie libre.
 */
export const AlertContextSelect: React.FC<AlertContextSelectProps> = React.memo(({
  machines,
  value,
  onChange,
  getCol,
  placeholder = 'Machine / Site concerné (optionnel)',
  accentColor = '#F7AC37',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 40);
    }
  }, [isOpen]);

  const sites = useMemo(() => {
    const set = new Set<string>();
    machines.forEach((m) => {
      const s = getCol(m, 'dropdown_mm8d4vj2');
      if (s && s !== '—' && s.toLowerCase() !== 'non attribué') {
        set.add(s);
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
  }, [machines, getCol]);

  const sortedMachines = useMemo(() => {
    return machines
      .filter((m) => isRealCleaningMachine(m, getCol))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr', { numeric: true, sensitivity: 'base' }));
  }, [machines, getCol]);

  const q = search.toLowerCase().trim();
  const filteredSites = useMemo(() => {
    if (!q) return sites;
    return sites.filter((s) => s.toLowerCase().includes(q));
  }, [sites, q]);

  const filteredMachines = useMemo(() => {
    if (!q) return sortedMachines;
    return sortedMachines.filter((m) => {
      const name = m.name.toLowerCase();
      const type = getCol(m, 'color_mm8t2mn5').toLowerCase();
      const site = getCol(m, 'dropdown_mm8d4vj2').toLowerCase();
      return name.includes(q) || type.includes(q) || site.includes(q);
    });
  }, [sortedMachines, q, getCol]);

  const getBadgeNumber = (name: string) => {
    const match = name.match(/^(\d+)/);
    if (match) return match[1];
    const parts = name.trim().split(/\s+/);
    if (parts.length > 0 && parts[0].length <= 3) return parts[0];
    return name.substring(0, 2).toUpperCase();
  };

  const handlePick = (nextValue: string) => {
    onChange(nextValue);
    setIsOpen(false);
    setSearch('');
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsOpen((o) => !o);
          }
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          padding: '7px 10px',
          borderRadius: '8px',
          border: `1px solid ${isOpen ? '#39A9DC' : accentColor}`,
          backgroundColor: '#FFFFFF',
          cursor: 'pointer',
          minHeight: '36px',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flex: 1 }}>
          <Search size={13} color="#3989B7" style={{ flexShrink: 0 }} />
          <span
            style={{
              fontSize: '12.5px',
              fontWeight: value ? 700 : 500,
              color: value ? '#1B4565' : '#6C8CA3',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {value || placeholder}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
          {value && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
                setSearch('');
              }}
              title="Effacer"
              style={{
                background: 'none',
                border: 'none',
                color: '#6C8CA3',
                cursor: 'pointer',
                padding: '2px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <X size={13} />
            </button>
          )}
          <ChevronDown
            size={14}
            color={isOpen ? '#39A9DC' : '#6C8CA3'}
            style={{
              transition: 'transform 0.15s ease',
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          />
        </div>
      </div>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 5px)',
            left: 0,
            right: 0,
            zIndex: 10050,
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1.5px solid #39A9DC',
            boxShadow: '0 14px 36px rgba(27, 69, 101, 0.22)',
            padding: '8px',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ position: 'relative', marginBottom: '8px' }}>
            <Search size={14} color="#39A9DC" style={{ position: 'absolute', left: '10px', top: '9px' }} />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher n°, machine ou site..."
              style={{
                width: '100%',
                padding: '7px 28px 7px 32px',
                borderRadius: '8px',
                border: '1px solid #C8DCE8',
                backgroundColor: '#F8FCFE',
                fontSize: '12.5px',
                color: '#1B4565',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '7px',
                  background: 'none',
                  border: 'none',
                  color: '#6C8CA3',
                  cursor: 'pointer',
                }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          <div style={{ maxHeight: '240px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {filteredSites.length > 0 && (
              <>
                <div style={{ padding: '2px 6px', fontSize: '10px', fontWeight: 800, color: '#3989B7', textTransform: 'uppercase' }}>
                  Sites d&apos;affectation ({filteredSites.length})
                </div>
                {filteredSites.slice(0, 25).map((site) => {
                  const formatted = `Site : ${site}`;
                  const isSelected = value === formatted || value === site;
                  return (
                    <div
                      key={`site-${site}`}
                      onClick={() => handlePick(formatted)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 8px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        backgroundColor: isSelected ? '#EBF6FC' : 'transparent',
                        fontSize: '12px',
                        fontWeight: 700,
                        color: '#1B4565',
                      }}
                      onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = '#F5F9FC'; }}
                      onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <MapPin size={13} color="#39A9DC" />
                        {site}
                      </span>
                      {isSelected && <Check size={13} color="#39A9DC" />}
                    </div>
                  );
                })}
              </>
            )}

            {filteredMachines.length > 0 && (
              <>
                <div style={{ padding: '4px 6px 2px', fontSize: '10px', fontWeight: 800, color: '#3989B7', textTransform: 'uppercase' }}>
                  Machines du parc ({filteredMachines.length})
                </div>
                {filteredMachines.map((m) => {
                  const site = getCol(m, 'dropdown_mm8d4vj2');
                  const type = getCol(m, 'color_mm8t2mn5') || 'Général';
                  const formatted = site && site !== '—' ? `${m.name} (${site})` : m.name;
                  const isSelected = value === formatted || value === m.name;
                  return (
                    <div
                      key={m.id}
                      onClick={() => handlePick(formatted)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                        padding: '7px 8px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        backgroundColor: isSelected ? '#EBF6FC' : 'transparent',
                      }}
                      onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = '#F5F9FC'; }}
                      onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                        <span
                          style={{
                            width: '26px',
                            height: '26px',
                            borderRadius: '6px',
                            backgroundColor: isSelected ? '#39A9DC' : '#EBF6FC',
                            color: isSelected ? '#FFFFFF' : '#39A9DC',
                            fontSize: '11px',
                            fontWeight: 900,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {getBadgeNumber(m.name)}
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: '#1B4565', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {m.name}
                          </div>
                          <div style={{ fontSize: '10.5px', color: '#57778E', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            <span>{type}</span>
                            {site && site !== '—' && <span>· {site}</span>}
                          </div>
                        </div>
                      </div>
                      {isSelected && <Check size={13} color="#39A9DC" />}
                    </div>
                  );
                })}
              </>
            )}

            {filteredSites.length === 0 && filteredMachines.length === 0 && !search.trim() && (
              <div style={{ padding: '14px', textAlign: 'center', fontSize: '12px', color: '#6C8CA3' }}>
                Aucune machine ou site disponible.
              </div>
            )}

            {search.trim() && (
              <div
                onClick={() => handlePick(search.trim())}
                style={{
                  marginTop: '4px',
                  padding: '7px 10px',
                  borderRadius: '8px',
                  border: '1px dashed #39A9DC',
                  backgroundColor: '#F8FCFE',
                  color: '#1B4565',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                + Utiliser « {search.trim()} »
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

