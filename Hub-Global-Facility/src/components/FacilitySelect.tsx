import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';

export interface FacilitySelectOption {
  value: string;
  label: string;
  badge?: string;
}

interface FacilitySelectProps {
  value: string;
  options: FacilitySelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  searchable?: boolean;
  icon?: React.ReactNode;
  minWidth?: string;
}

export default function FacilitySelect({
  value,
  options,
  onChange,
  placeholder = 'Sélectionner...',
  searchable = false,
  icon,
  minWidth = '190px',
}: FacilitySelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selectedOption = useMemo(
    () => options.find((o) => o.value === value),
    [options, value]
  );

  const filteredOptions = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      if (searchable) {
        window.setTimeout(() => searchRef.current?.focus(), 40);
      }
    }
  }, [open, searchable]);

  return (
    <div ref={containerRef} style={{ position: 'relative', minWidth, maxWidth: '100%' }}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        style={{
          width: '100%',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          padding: '7px 11px',
          borderRadius: '10px',
          border: open ? '1.5px solid #39A9DC' : '1px solid #B7D8EA',
          backgroundColor: open ? '#FFFFFF' : '#F4F9FC',
          boxShadow: open ? '0 0 0 3px rgba(57, 169, 220, 0.16)' : 'none',
          color: '#1B4565',
          fontSize: '12px',
          fontWeight: 700,
          cursor: 'pointer',
          transition: 'all 0.16s ease',
          textAlign: 'left',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', minWidth: 0, overflow: 'hidden' }}>
          {icon && <span style={{ display: 'inline-flex', flexShrink: 0 }}>{icon}</span>}
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </span>
        <ChevronDown
          size={14}
          color="#3989B7"
          style={{
            flexShrink: 0,
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.18s ease',
          }}
        />
      </button>

      {open && (
        <div
          className="hero-search-dropdown"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            minWidth: '220px',
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1.5px solid #B7D8EA',
            boxShadow: '0 14px 32px rgba(27, 69, 101, 0.16)',
            zIndex: 80,
            overflow: 'hidden',
          }}
        >
          {(searchable || options.length > 7) && (
            <div style={{ padding: '8px', borderBottom: '1px solid #EBF6FC', position: 'relative' }}>
              <Search
                size={13}
                color="#64748B"
                style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }}
              />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filtrer..."
                style={{
                  width: '100%',
                  padding: '6px 26px 6px 28px',
                  borderRadius: '8px',
                  border: '1px solid #D7EAF5',
                  backgroundColor: '#F8FBFD',
                  fontSize: '11.5px',
                  color: '#1B4565',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  style={{
                    position: 'absolute',
                    right: '14px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    border: 'none',
                    background: 'transparent',
                    color: '#94A3B8',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'inline-flex',
                  }}
                >
                  <X size={12} />
                </button>
              )}
            </div>
          )}

          <div style={{ maxHeight: '240px', overflowY: 'auto', padding: '5px' }}>
            {filteredOptions.length === 0 ? (
              <div style={{ padding: '12px', textAlign: 'center', fontSize: '11.5px', color: '#94A3B8' }}>
                Aucun résultat
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: isSelected ? '#EBF6FC' : 'transparent',
                      color: isSelected ? '#1B4565' : '#334155',
                      fontSize: '12px',
                      fontWeight: isSelected ? 800 : 600,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background-color 0.14s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = '#F4F9FC';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {opt.label}
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      {opt.badge && (
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 800,
                            padding: '1px 6px',
                            borderRadius: '999px',
                            backgroundColor: isSelected ? '#FFFFFF' : '#F1F5F9',
                            color: '#3989B7',
                          }}
                        >
                          {opt.badge}
                        </span>
                      )}
                      {isSelected && <Check size={13} color="#39A9DC" strokeWidth={3} />}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
