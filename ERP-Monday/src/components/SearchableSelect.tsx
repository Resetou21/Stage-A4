import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, ChevronDown, Check, X, MapPin } from 'lucide-react';

export interface SearchableOptionItem {
  value: string;
  label: string;
  badge?: string;
  icon?: React.ReactNode;
  color?: string;
}

export type SearchableOption = string | SearchableOptionItem;

export interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SearchableOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  icon?: React.ReactNode;
  allOptionValue?: string;
  allOptionLabel?: string;
  width?: string | number;
  minWidth?: string | number;
}

const PRESET_DOT_COLORS = [
  '#0073EA', // Bleu Monday
  '#00C875', // Vert
  '#FDAB3D', // Orange
  '#9D50DD', // Violet
  '#E2445C', // Rouge
  '#00A389', // Turquoise
  '#579BFC', // Ciel
  '#784BD1', // Indigo
];

function getDotColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % PRESET_DOT_COLORS.length;
  return PRESET_DOT_COLORS[index];
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Sélectionner...',
  searchPlaceholder = 'Rechercher (ex: Donges, Leclerc, Arkteos)...',
  icon,
  allOptionValue = 'all',
  allOptionLabel,
  width = '320px',
  minWidth = '240px',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Normalisation des options
  const normalizedOptions: SearchableOptionItem[] = useMemo(() => {
    return options.map((opt) => {
      if (typeof opt === 'string') {
        return {
          value: opt,
          label: opt,
          color: getDotColor(opt),
        };
      }
      return {
        ...opt,
        color: opt.color || getDotColor(opt.label),
      };
    });
  }, [options]);

  // Label actif affiché
  const currentOption = useMemo(() => {
    if (value === allOptionValue) {
      return {
        value: allOptionValue,
        label: allOptionLabel || 'Tous les secteurs',
        color: '#39A9DC',
      };
    }
    return normalizedOptions.find((o) => o.value === value);
  }, [value, allOptionValue, allOptionLabel, normalizedOptions]);

  // Filtrage par recherche
  const filteredOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return normalizedOptions;
    return normalizedOptions.filter((opt) =>
      opt.label.toLowerCase().includes(q) || opt.value.toLowerCase().includes(q)
    );
  }, [search, normalizedOptions]);

  // Fermeture au clic extérieur et touche Échap
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    setSearch('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(allOptionValue);
  };

  const isFiltered = value !== allOptionValue && value !== '';

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        display: 'inline-block',
        width: width,
        minWidth: minWidth,
        userSelect: 'none',
        fontFamily: "'Ruda', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* Bouton déclencheur */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          padding: '7px 12px',
          borderRadius: '10px',
          border: isOpen ? '2px solid #39A9DC' : '1.5px solid #C8DCE8',
          backgroundColor: '#FFFFFF',
          color: '#1B4565',
          fontSize: '13px',
          fontWeight: 700,
          cursor: 'pointer',
          outline: 'none',
          boxShadow: isOpen
            ? '0 0 0 3px rgba(57, 169, 220, 0.18)'
            : '0 1px 3px rgba(27, 69, 101, 0.04)',
          transition: 'all 0.15s ease',
          boxSizing: 'border-box',
          minHeight: '36px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
          {icon || <MapPin size={15} color="#39A9DC" style={{ flexShrink: 0 }} />}

          {/* Pastille de couleur si sélectionné */}
          {currentOption?.color && value !== allOptionValue && (
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: currentOption.color,
                flexShrink: 0,
              }}
            />
          )}

          <span
            title={currentOption ? currentOption.label : placeholder}
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              color: currentOption ? '#1B4565' : '#8A9EA7',
              textAlign: 'left',
              flex: 1,
            }}
          >
            {currentOption ? currentOption.label : placeholder}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
          {isFiltered && (
            <span
              onClick={handleClear}
              title="Effacer le filtre"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                backgroundColor: '#F3F4F6',
                color: '#6B7280',
                cursor: 'pointer',
                transition: 'all 0.12s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#FDECEE';
                e.currentTarget.style.color = '#E2445C';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#F3F4F6';
                e.currentTarget.style.color = '#6B7280';
              }}
            >
              <X size={12} />
            </span>
          )}
          <ChevronDown
            size={16}
            color="#57778E"
            style={{
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.18s ease',
            }}
          />
        </div>
      </button>

      {/* Menu déroulant */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            width: '100%',
            minWidth: '280px',
            backgroundColor: '#FFFFFF',
            border: '1.5px solid #C8DCE8',
            borderRadius: '12px',
            boxShadow: '0 10px 28px rgba(27, 69, 101, 0.16)',
            zIndex: 9999,
            overflow: 'hidden',
            animation: 'fadeInMenu 0.15s ease-out',
          }}
        >
          {/* Barre de recherche intégrée */}
          <div
            style={{
              padding: '8px 10px',
              borderBottom: '1px solid #E5EDF2',
              backgroundColor: '#F8FBFC',
            }}
          >
            <div
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <Search
                size={14}
                color="#8A9EA7"
                style={{ position: 'absolute', left: '10px' }}
              />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                style={{
                  width: '100%',
                  padding: '7px 28px 7px 30px',
                  borderRadius: '8px',
                  border: '1.5px solid #D2E3ED',
                  backgroundColor: '#FFFFFF',
                  color: '#1B4565',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  outline: 'none',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                }}
                onFocus={(e) => (e.target.style.borderColor = '#39A9DC')}
                onBlur={(e) => (e.target.style.borderColor = '#D2E3ED')}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    background: 'none',
                    border: 'none',
                    color: '#8A9EA7',
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

            {/* Compteur de résultats */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '11px',
                fontWeight: 800,
                color: '#8A9EA7',
                marginTop: '6px',
                padding: '0 4px',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              <span>Résultats</span>
              <span>
                {filteredOptions.length} sur {normalizedOptions.length}
              </span>
            </div>
          </div>

          {/* Liste déroulante des options */}
          <div
            style={{
              maxHeight: '260px',
              overflowY: 'auto',
              padding: '6px 4px',
            }}
          >
            {/* Option "Tous les secteurs" si pas de filtre de recherche bloquant */}
            {allOptionLabel && (!search || allOptionLabel.toLowerCase().includes(search.toLowerCase())) && (
              <div
                onClick={() => handleSelect(allOptionValue)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  backgroundColor: value === allOptionValue ? '#EBF6FC' : 'transparent',
                  color: value === allOptionValue ? '#1B4565' : '#334E68',
                  fontSize: '13px',
                  fontWeight: value === allOptionValue ? 800 : 600,
                  transition: 'background-color 0.12s ease',
                  marginBottom: '2px',
                }}
                onMouseEnter={(e) => {
                  if (value !== allOptionValue) e.currentTarget.style.backgroundColor = '#F4F8FA';
                }}
                onMouseLeave={(e) => {
                  if (value !== allOptionValue) e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                  <MapPin size={14} color="#39A9DC" />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {allOptionLabel}
                  </span>
                </div>
                {value === allOptionValue && <Check size={14} color="#39A9DC" />}
              </div>
            )}

            {filteredOptions.length === 0 ? (
              <div
                style={{
                  padding: '16px 12px',
                  textAlign: 'center',
                  fontSize: '12.5px',
                  color: '#8A9EA7',
                  fontStyle: 'italic',
                }}
              >
                Aucun secteur correspondant à « {search} »
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <div
                    key={opt.value}
                    onClick={() => handleSelect(opt.value)}
                    title={opt.label}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      backgroundColor: isSelected ? '#EBF6FC' : 'transparent',
                      color: isSelected ? '#1B4565' : '#334E68',
                      fontSize: '13px',
                      fontWeight: isSelected ? 800 : 600,
                      transition: 'background-color 0.12s ease',
                      marginBottom: '2px',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = '#F4F8FA';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                      <span
                        style={{
                          width: '7px',
                          height: '7px',
                          borderRadius: '50%',
                          backgroundColor: opt.color || '#39A9DC',
                          flexShrink: 0,
                        }}
                      />
                      <span
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          flex: 1,
                        }}
                      >
                        {opt.label}
                      </span>
                    </div>
                    {isSelected && <Check size={14} color="#39A9DC" style={{ flexShrink: 0, marginLeft: '6px' }} />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;
