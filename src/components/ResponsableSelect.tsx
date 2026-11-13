import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, ChevronDown, Check, X } from 'lucide-react';
import { SECTEUR_RESPONSABLES } from '../services/maintenanceApi';

export interface ResponsableMeta {
  name: string;
  role: string;
  color: string;
  bgLight: string;
  border: string;
  initials: string;
}

export const RESPONSABLES_DATA: ResponsableMeta[] = [
  {
    name: 'Natacha THOMAS',
    role: 'Hub Responsable de Secteur',
    color: '#E2445C',
    bgLight: '#FDECEE',
    border: '#F5C6CB',
    initials: 'NT',
  },
  {
    name: 'Emilie TOBIE',
    role: 'Hub Responsable de Secteur',
    color: '#0073EA',
    bgLight: '#EBF6FC',
    border: '#D2E9F6',
    initials: 'ET',
  },
  {
    name: 'Ketty PAULIN',
    role: 'Hub Responsable de Secteur',
    color: '#00C875',
    bgLight: '#E6F8F0',
    border: '#A7F3D0',
    initials: 'KP',
  },
  {
    name: 'Andre LEVESQUE',
    role: 'Hub Responsable de Secteur',
    color: '#FDAB3D',
    bgLight: '#FFF8EC',
    border: '#FDE2B8',
    initials: 'AL',
  },
];

interface ResponsableSelectProps {
  value: string;
  onChange: (value: string) => void;
  accentColor?: string;
  fullWidth?: boolean;
}

export const ResponsableSelect: React.FC<ResponsableSelectProps> = React.memo(({
  value,
  onChange,
  accentColor = '#39A9DC',
  fullWidth = false,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [search, setSearch] = useState<string>('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Fermer lors d'un clic extérieur ou Échap
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

  // Focus recherche à l'ouverture
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearch('');
    }
  }, [isOpen]);

  // Récupérer les métadonnées de la personne sélectionnée
  const currentMeta = useMemo<ResponsableMeta>(() => {
    const found = RESPONSABLES_DATA.find(
      (r) => r.name.toLowerCase().trim() === (value || '').toLowerCase().trim()
    );
    if (found) return found;

    // Fallback dynamique
    const initials = (value || 'RS')
      .split(' ')
      .map((p) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

    return {
      name: value || 'Natacha THOMAS',
      role: 'Hub Responsable de Secteur',
      color: accentColor,
      bgLight: '#F5F9FC',
      border: '#D2E9F6',
      initials,
    };
  }, [value, accentColor]);

  // Liste filtrée par recherche
  const filteredResponsables = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return RESPONSABLES_DATA;
    return RESPONSABLES_DATA.filter(
      (r) => r.name.toLowerCase().includes(q) || r.role.toLowerCase().includes(q)
    );
  }, [search]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        display: fullWidth ? 'block' : 'inline-block',
        width: fullWidth ? '100%' : 'auto',
      }}
    >
      {/* Bouton Déclencheur Chic */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        title="Sélectionner le Responsable de Secteur destinataire de l'alerte"
        style={{
          width: fullWidth ? '100%' : 'auto',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          padding: '6px 12px',
          borderRadius: '10px',
          border: isOpen ? `1.5px solid ${accentColor}` : '1.5px solid #CBD5E1',
          backgroundColor: '#FFFFFF',
          color: '#1B4565',
          fontSize: '13px',
          fontWeight: 700,
          fontFamily: "'Ruda', sans-serif",
          cursor: 'pointer',
          boxShadow: isOpen
            ? `0 0 0 3px ${accentColor}26`
            : '0 1px 3px rgba(27, 69, 101, 0.05)',
          transition: 'all 0.15s ease',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          {/* Avatar avec initiales */}
          <span
            style={{
              width: '22px',
              height: '22px',
              borderRadius: '50%',
              backgroundColor: currentMeta.bgLight,
              color: currentMeta.color,
              border: `1px solid ${currentMeta.border}`,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              fontWeight: 800,
              fontFamily: "'Ruda', sans-serif",
              flexShrink: 0,
            }}
          >
            {currentMeta.initials}
          </span>

          <span
            style={{
              color: '#1B4565',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {currentMeta.name}
          </span>
        </div>

        <ChevronDown
          size={14}
          color="#64748B"
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
            flexShrink: 0,
            marginLeft: '4px',
          }}
        />
      </button>

      {/* Menu Déroulant avec Recherche & Design Hub */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            width: fullWidth ? '100%' : '280px',
            minWidth: '260px',
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
          {/* Barre de recherche */}
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
                  if (filteredResponsables.length > 0) {
                    onChange(filteredResponsables[0].name);
                    setIsOpen(false);
                  }
                }
              }}
              placeholder="Rechercher un responsable..."
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

          {/* En-tête de catégorie */}
          <div
            style={{
              padding: '6px 12px',
              fontSize: '10.5px',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              color: '#57778E',
              backgroundColor: '#FFFFFF',
              borderBottom: '1px solid #F1F5F9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>Hubs Responsables de Secteur</span>
            <span style={{ fontSize: '10px', color: '#94A3B8' }}>{SECTEUR_RESPONSABLES.length} Hubs</span>
          </div>

          {/* Liste des 4 Responsables officiels */}
          <div style={{ maxHeight: '240px', overflowY: 'auto', padding: '5px' }}>
            {filteredResponsables.length === 0 ? (
              <div
                style={{
                  padding: '16px 12px',
                  textAlign: 'center',
                  fontSize: '12px',
                  color: '#94A3B8',
                  fontStyle: 'italic',
                }}
              >
                Aucun responsable trouvé pour « {search} »
              </div>
            ) : (
              filteredResponsables.map((r) => {
                const isSelected = r.name.toLowerCase().trim() === (value || '').toLowerCase().trim();

                return (
                  <div
                    key={r.name}
                    onClick={() => {
                      onChange(r.name);
                      setIsOpen(false);
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onChange(r.name);
                        setIsOpen(false);
                      }
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      backgroundColor: isSelected ? '#F0F7FF' : 'transparent',
                      cursor: 'pointer',
                      transition: 'background-color 0.1s ease',
                      marginBottom: '2px',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = '#F8FAFC';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                      {/* Avatar avec initiales */}
                      <span
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          backgroundColor: r.bgLight,
                          color: r.color,
                          border: `1.5px solid ${r.border}`,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '10.5px',
                          fontWeight: 800,
                          fontFamily: "'Ruda', sans-serif",
                          flexShrink: 0,
                        }}
                      >
                        {r.initials}
                      </span>

                      <div>
                        <div
                          style={{
                            fontSize: '12.5px',
                            fontWeight: isSelected ? 800 : 700,
                            color: isSelected ? '#0073EA' : '#1B4565',
                            fontFamily: "'Ruda', sans-serif",
                          }}
                        >
                          {r.name}
                        </div>
                        <div style={{ fontSize: '10.5px', color: '#64748B' }}>
                          {r.role}
                        </div>
                      </div>
                    </div>

                    {isSelected && <Check size={15} color="#0073EA" />}
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
