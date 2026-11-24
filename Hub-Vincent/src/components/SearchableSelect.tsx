import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, ChevronDown, Check, Plus, X, Sparkles, Trash2 } from 'lucide-react';
import { cn } from '@lib/utils';

export interface SelectOptionItem {
  value: string;
  label: string;
  sublabel?: string;
  badgeColor?: string;
  searchTokens?: string[];
  group?: string;
}

export type SelectOption = string | SelectOptionItem;

export interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  label?: string;
  required?: boolean;
  allowCreate?: boolean;
  createLabelPrefix?: string;
  autoUppercase?: boolean;
  icon?: React.ReactNode;
  onCreateOption?: (newVal: string) => void;
  onDeleteOption?: (optionValue: string) => void;
  naturalSort?: boolean;
  badgeColor?: string;
  className?: string;
  dropdownClassName?: string;
  size?: 'sm' | 'md';
  clearable?: boolean;
  searchable?: boolean;
  showDot?: boolean;
}

const PRESET_COLORS = [
  '#39A9DC',
  '#00c875',
  '#fdab3d',
  '#9d50dd',
  '#e2445c',
  '#00a389',
  '#579bfc',
  '#784bd1',
];

function getColorForString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % PRESET_COLORS.length;
  return PRESET_COLORS[index];
}

export default function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = 'Sélectionner...',
  searchPlaceholder = 'Rechercher...',
  label,
  required = false,
  allowCreate = false,
  createLabelPrefix = "Créer l'étiquette",
  autoUppercase = false,
  icon,
  onCreateOption,
  onDeleteOption,
  naturalSort = false,
  badgeColor,
  className,
  dropdownClassName,
  size = 'md',
  clearable = true,
  searchable = true,
  showDot = true,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const normalizedOptions: SelectOptionItem[] = useMemo(() => {
    return options.map((opt) => {
      if (typeof opt === 'string') {
        return {
          value: opt,
          label: opt,
          badgeColor: getColorForString(opt),
        };
      }
      return {
        ...opt,
        badgeColor: opt.badgeColor || getColorForString(opt.label),
      };
    });
  }, [options]);

  const sortedOptions = useMemo(() => {
    const copy = [...normalizedOptions];
    if (naturalSort) {
      copy.sort((a, b) => {
        if (a.group && b.group && a.group !== b.group) {
          const aRestitue = /restitu/i.test(a.group);
          const bRestitue = /restitu/i.test(b.group);
          if (aRestitue !== bRestitue) {
            return aRestitue ? 1 : -1;
          }
          return a.group.localeCompare(b.group, 'fr', { sensitivity: 'base' });
        }
        return a.label.localeCompare(b.label, 'fr', { numeric: true, sensitivity: 'base' });
      });
    }
    return copy;
  }, [normalizedOptions, naturalSort]);

  const searchNorm = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!searchNorm) return sortedOptions;
    return sortedOptions.filter(
      (opt) =>
        opt.label.toLowerCase().includes(searchNorm) ||
        opt.value.toLowerCase().includes(searchNorm) ||
        (opt.sublabel && opt.sublabel.toLowerCase().includes(searchNorm)) ||
        (opt.group && opt.group.toLowerCase().includes(searchNorm)) ||
        (opt.searchTokens && opt.searchTokens.some((t) => t.toLowerCase().includes(searchNorm))),
    );
  }, [sortedOptions, searchNorm]);

  const hasGroups = useMemo(() => filtered.some((o) => !!o.group), [filtered]);

  const groupedFiltered = useMemo(() => {
    if (!hasGroups) return null;
    const groups: { [key: string]: SelectOptionItem[] } = {};
    for (const item of filtered) {
      const g = item.group || 'Autres';
      if (!groups[g]) groups[g] = [];
      groups[g].push(item);
    }
    return groups;
  }, [filtered, hasGroups]);

  const sortedGroupEntries = useMemo(() => {
    if (!groupedFiltered) return [];
    return Object.entries(groupedFiltered).sort(([groupA], [groupB]) => {
      const aRestitue = /restitu/i.test(groupA);
      const bRestitue = /restitu/i.test(groupB);
      if (aRestitue !== bRestitue) {
        return aRestitue ? 1 : -1;
      }
      return groupA.localeCompare(groupB, 'fr');
    });
  }, [groupedFiltered]);

  const exactMatchExists = useMemo(() => {
    if (!searchNorm) return true;
    return normalizedOptions.some(
      (opt) => opt.label.toLowerCase() === searchNorm || opt.value.toLowerCase() === searchNorm,
    );
  }, [normalizedOptions, searchNorm]);

  const selectedOption = useMemo(() => {
    if (!value) return null;
    return (
      normalizedOptions.find(
        (o) =>
          o.value.toLowerCase() === value.toLowerCase() ||
          o.label.toLowerCase() === value.toLowerCase(),
      ) || {
        value,
        label: value,
        badgeColor: badgeColor || getColorForString(value),
      }
    );
  }, [normalizedOptions, value, badgeColor]);

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
    if (isOpen && searchable) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 40);
    } else if (!isOpen) {
      setSearch('');
    }
  }, [isOpen, searchable]);

  const handleSelect = (item: SelectOptionItem) => {
    const finalVal = autoUppercase ? item.value.toUpperCase().trim() : item.value.trim();
    onChange(finalVal);
    setIsOpen(false);
    setSearch('');
  };

  const handleCreate = () => {
    const trimmed = search.trim();
    if (!trimmed) return;
    const finalVal = autoUppercase ? trimmed.toUpperCase() : trimmed;
    if (onCreateOption) {
      onCreateOption(finalVal);
    }
    onChange(finalVal);
    setIsOpen(false);
    setSearch('');
  };

  const renderOptionItem = (item: SelectOptionItem) => {
    const isSelected =
      value?.toLowerCase() === item.value.toLowerCase() ||
      value?.toLowerCase() === item.label.toLowerCase();
    const isRestitue = /restitu/i.test(item.group || '') || /restitu/i.test(item.sublabel || '');

    return (
      <div
        key={item.value}
        onClick={() => handleSelect(item)}
        className={cn(
          'flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-colors group min-w-0',
          isSelected ? 'bg-primary/10 text-primary font-bold' : 'text-foreground hover:bg-muted/70',
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1 overflow-hidden">
          {showDot && (
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs"
              style={{ backgroundColor: isRestitue ? '#fdab3d' : item.badgeColor || '#39A9DC' }}
            />
          )}
          <span className="truncate block">{item.label}</span>
          {isRestitue ? (
            <span className="text-[10px] px-1.5 py-0.2 rounded-md font-bold uppercase tracking-wider bg-amber-500/20 text-amber-800 shrink-0 border border-amber-500/30">
              Restitué
            </span>
          ) : item.sublabel ? (
            <span className="text-[10px] text-muted-foreground font-normal shrink-0 truncate">
              ({item.sublabel})
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
          {onDeleteOption && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteOption(item.value);
              }}
              className="opacity-40 group-hover:opacity-100 hover:opacity-100 p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-all cursor-pointer"
              title="Supprimer de la liste"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div ref={containerRef} className={cn('relative w-full', className)}>
      {label && (
        <label className="block text-xs font-bold text-foreground mb-1.5 uppercase tracking-wide">
          {label} {required && <span className="text-destructive">*</span>}
        </label>
      )}

      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full flex items-center justify-between border border-border bg-card font-semibold text-foreground shadow-xs hover:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer',
          size === 'sm' ? 'h-9 rounded-lg px-2.5 text-xs' : 'h-11 rounded-xl px-3.5 text-sm',
          isOpen && 'border-primary ring-2 ring-primary/20 bg-muted/20',
        )}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
          {icon ? (
            <span className="text-muted-foreground shrink-0">{icon}</span>
          ) : showDot && selectedOption ? (
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs"
              style={{ backgroundColor: selectedOption.badgeColor || '#39A9DC' }}
            />
          ) : null}

          {selectedOption ? (
            <span className={cn('truncate font-bold text-foreground flex items-center gap-1.5 min-w-0', size === 'sm' ? 'text-xs' : 'text-sm')}>
              <span className="truncate">{selectedOption.label}</span>
              {selectedOption.sublabel && (
                <span className="shrink-0 text-[11px] text-muted-foreground font-normal hidden sm:inline">
                  ({selectedOption.sublabel})
                </span>
              )}
            </span>
          ) : (
            <span className={cn('text-muted-foreground font-normal truncate whitespace-nowrap', size === 'sm' ? 'text-xs' : 'text-sm')}>
              {placeholder}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 text-muted-foreground ml-1.5">
          {clearable && value && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
              className="p-0.5 rounded-full hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              title="Effacer la sélection"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
          <ChevronDown
            className={cn('h-3.5 w-3.5 transition-transform duration-200', isOpen && 'rotate-180 text-primary')}
          />
        </div>
      </button>

      {isOpen && (
        <div
          className={cn(
            'absolute top-full left-0 mt-1.5 z-50 min-w-full rounded-xl border border-border bg-card text-foreground shadow-xl overflow-hidden',
            dropdownClassName,
          )}
        >
          {searchable && (
            <div className="p-2 border-b border-border/60 bg-muted/20">
              <div className="relative flex items-center">
                <Search className="absolute left-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (filtered.length > 0) {
                        handleSelect(filtered[0]);
                      } else if (allowCreate && !exactMatchExists) {
                        handleCreate();
                      }
                    }
                  }}
                  placeholder={searchPlaceholder}
                  className="w-full rounded-lg border border-border bg-background pl-8 pr-7 py-1.5 text-xs font-medium text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-2 p-0.5 text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between px-1 mt-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <span>Résultats</span>
                <span>
                  {filtered.length} sur {normalizedOptions.length}
                </span>
              </div>
            </div>
          )}

          <div className="max-h-72 overflow-y-auto divide-y divide-border/20 p-1">
            {filtered.length > 0 ? (
              sortedGroupEntries.length > 0 ? (
                sortedGroupEntries.map(([groupName, items]) => (
                  <div key={groupName} className="mb-1.5 last:mb-0">
                    <div className="sticky top-0 z-10 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider flex items-center justify-between rounded-md mb-0.5 bg-muted/80 text-muted-foreground backdrop-blur-md">
                      <span>{groupName}</span>
                      <span className="text-[10px] font-black px-1.5 py-0.2 rounded-full bg-background/80">
                        {items.length}
                      </span>
                    </div>
                    <div className="space-y-0.5">{items.map((item) => renderOptionItem(item))}</div>
                  </div>
                ))
              ) : (
                filtered.map((item) => renderOptionItem(item))
              )
            ) : (
              <div className="p-4 text-center text-xs text-muted-foreground italic">
                Aucun résultat pour « {search.trim()} »
              </div>
            )}
          </div>

          {allowCreate && search.trim() && !exactMatchExists && (
            <button
              type="button"
              onClick={handleCreate}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-primary bg-primary/8 hover:bg-primary/15 border-t border-border transition-colors cursor-pointer text-left min-w-0 overflow-hidden"
            >
              <Plus className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate flex-1 min-w-0 block">
                {createLabelPrefix} « <b>{autoUppercase ? search.trim().toUpperCase() : search.trim()}</b> »
              </span>
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-amber-500 animate-pulse ml-auto" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
