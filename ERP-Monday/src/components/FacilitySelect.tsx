import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search, X } from 'lucide-react';

export interface FacilitySelectOption {
  value: string;
  label: string;
  dotColor?: string;
  badge?: string;
}

export interface FacilitySelectProps {
  value: string;
  options: FacilitySelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  searchable?: boolean;
  icon?: React.ReactNode;
  prefixLabel?: string;
  compact?: boolean;
  fullWidth?: boolean;
  minWidth?: string | number;
  maxWidth?: string | number;
  accentTone?: 'default' | 'amber' | 'blue';
  ariaLabel?: string;
  title?: string;
}

export const FacilitySelect: React.FC<FacilitySelectProps> = ({
  value,
  options,
  onChange,
  placeholder = 'Sélectionner...',
  disabled = false,
  searchable = false,
  icon,
  prefixLabel,
  compact = false,
  fullWidth = false,
  minWidth,
  maxWidth,
  accentTone = 'default',
  ariaLabel,
  title,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selectedOption = useMemo(
    () => options.find((o) => o.value === value),
    [options, value]
  );

  const showSearch = searchable || options.length > 7;

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q)
    );
  }, [options, query]);

  const updateMenuPosition = () => {
    const btn = triggerRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const desiredW = Math.min(Math.max(rect.width, 210), vw - 20);
    const left = Math.max(10, Math.min(rect.left, vw - desiredW - 10));
    const spaceBelow = vh - rect.bottom - 14;
    const spaceAbove = rect.top - 14;
    const estimatedH = Math.min(280, options.length * 36 + (showSearch ? 52 : 16));
    const openUpward = spaceBelow < Math.min(200, estimatedH) && spaceAbove > spaceBelow;

    setMenuStyle({
      position: 'fixed',
      left: `${left}px`,
      width: `${desiredW}px`,
      ...(openUpward
        ? { bottom: `${vh - rect.top + 6}px` }
        : { top: `${rect.bottom + 6}px` }),
      zIndex: 99999,
    });
  };

  useEffect(() => {
    if (!open) return;
    updateMenuPosition();
    setQuery('');
    if (showSearch) {
      window.setTimeout(() => searchRef.current?.focus(), 40);
    }

    const handleOutside = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const handleScrollOrResize = (e: Event) => {
      if (menuRef.current && e.target instanceof Node && menuRef.current.contains(e.target)) {
        return;
      }
      updateMenuPosition();
    };

    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleKey);
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKey);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [open, options.length]);

  const borderColor = open
    ? '#39A9DC'
    : accentTone === 'amber'
    ? '#F7AC37'
    : accentTone === 'blue'
    ? '#39A9DC'
    : '#C8DCE8';

  const bgColor = disabled
    ? '#F1F5F9'
    : accentTone === 'amber'
    ? '#FFF8EC'
    : accentTone === 'blue'
    ? '#F0F8FD'
    : '#FFFFFF';

  const menuNode = open
    ? createPortal(
        <div
          ref={menuRef}
          style={{
            ...menuStyle,
            backgroundColor: '#FFFFFF',
            border: '1.5px solid #B7D8EA',
            borderRadius: '12px',
            boxShadow: '0 14px 34px rgba(27, 69, 101, 0.2)',
            overflow: 'hidden',
            fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif",
          }}
        >
          {showSearch && (
            <div style={{ padding: '8px', borderBottom: '1px solid #EBF6FC', backgroundColor: '#F8FBFC', position: 'relative' }}>
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
                  border: '1px solid #C8DCE8',
                  backgroundColor: '#FFFFFF',
                  fontSize: '12px',
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
              <div style={{ padding: '12px', textAlign: 'center', fontSize: '12px', color: '#94A3B8' }}>
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
                      fontSize: '12.5px',
                      fontWeight: isSelected ? 800 : 600,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background-color 0.12s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = '#F4F9FC';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', minWidth: 0, flex: 1 }}>
                      {opt.dotColor && (
                        <span
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: opt.dotColor,
                            flexShrink: 0,
                          }}
                        />
                      )}
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {opt.label}
                      </span>
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
                      {isSelected && <Check size={14} color="#39A9DC" strokeWidth={3} />}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <div
      style={{
        display: fullWidth ? 'block' : 'inline-block',
        width: fullWidth ? '100%' : undefined,
        minWidth,
        maxWidth: maxWidth || '100%',
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        title={title || selectedOption?.label || placeholder}
        onClick={() => !disabled && setOpen((v) => !v)}
        style={{
          width: '100%',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '7px',
          padding: compact ? '5px 9px' : '7px 11px',
          borderRadius: '9px',
          border: `1.5px solid ${borderColor}`,
          backgroundColor: bgColor,
          color: disabled ? '#94A3B8' : '#1B4565',
          fontSize: compact ? '11.5px' : '12.5px',
          fontWeight: 800,
          fontFamily: "'Ruda', sans-serif",
          cursor: disabled ? 'not-allowed' : 'pointer',
          outline: 'none',
          boxShadow: open ? '0 0 0 3px rgba(57, 169, 220, 0.16)' : 'none',
          transition: 'all 0.15s ease',
          boxSizing: 'border-box',
          textAlign: 'left',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', minWidth: 0, flex: 1 }}>
          {icon && <span style={{ display: 'inline-flex', flexShrink: 0 }}>{icon}</span>}
          {prefixLabel && (
            <span style={{ fontWeight: 700, color: '#57778E', whiteSpace: 'nowrap' }}>{prefixLabel}</span>
          )}
          {selectedOption?.dotColor && (
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                backgroundColor: selectedOption.dotColor,
                flexShrink: 0,
              }}
            />
          )}
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </span>
        <ChevronDown
          size={compact ? 13 : 14}
          color="#3989B7"
          style={{
            flexShrink: 0,
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.16s ease',
          }}
        />
      </button>
      {menuNode}
    </div>
  );
};

export default FacilitySelect;
