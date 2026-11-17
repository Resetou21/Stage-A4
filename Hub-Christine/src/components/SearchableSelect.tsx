import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, ChevronDown, Check, Plus, X, Sparkles, Trash2 } from 'lucide-react';
import { cn } from '@lib/utils';

export interface SelectOptionItem {
  value: string;
  label: string;
  sublabel?: string;
  badgeColor?: string;
  searchTokens?: string[];
  group?: string; // Nom du groupe (ex: "Véhicules en service", "Véhicule restitué")
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
}

const PRESET_COLORS = [
  '#0073ea', // Bleu Monday
  '#00c875', // Vert
  '#fdab3d', // Orange
  '#9d50dd', // Violet
  '#e2445c', // Rouge
  '#00a389', // Turquoise
  '#579bfc', // Ciel
  '#784bd1', // Indigo
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
  searchPlaceholder = 'Rechercher une étiquette...',
  label,
  required = false,
  allowCreate = false,
  createLabelPrefix = "Créer l'étiquette",
  autoUppercase = false,
  icon,
  onCreateOption,
  onDeleteOption,
  naturalSort = true,
  badgeColor,
  className,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Normaliser les options sous forme d'objets
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

  // Options triées naturellement (1, 2, 10, etc.) en préservant la séparation des groupes
  const sortedOptions = useMemo(() => {
    const copy = [...normalizedOptions];
    if (naturalSort) {
      copy.sort((a, b) => {
        // Si les options ont des groupes distincts
        if (a.group && b.group && a.group !== b.group) {
          const aRestitue = /restitu/i.test(a.group);
          const bRestitue = /restitu/i.test(b.group);
          if (aRestitue !== bRestitue) {
            return aRestitue ? 1 : -1; // "Véhicules en service" d'abord, "Véhicule restitué" en bas
          }
          return a.group.localeCompare(b.group, 'fr', { sensitivity: 'base' });
        }
        return a.label.localeCompare(b.label, 'fr', { numeric: true, sensitivity: 'base' });
      });
    }
    return copy;
  }, [normalizedOptions, naturalSort]);

  // Filtrage selon la recherche tapée
  const searchNorm = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!searchNorm) return sortedOptions;
    return sortedOptions.filter(
      (opt) =>
        opt.label.toLowerCase().includes(searchNorm) ||
        opt.value.toLowerCase().includes(searchNorm) ||
        (opt.sublabel && opt.sublabel.toLowerCase().includes(searchNorm)) ||
        (opt.group && opt.group.toLowerCase().includes(searchNorm)) ||
        (opt.searchTokens && opt.searchTokens.some((t) => t.toLowerCase().includes(searchNorm)))
    );
  }, [sortedOptions, searchNorm]);

  // Regroupement pour affichage par sections style Monday
  const hasGroups = useMemo(() => {
    return filtered.some((o) => !!o.group);
  }, [filtered]);

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
        return aRestitue ? 1 : -1; // "Véhicules en service" d'abord, "Véhicule restitué" en bas
      }
      return groupA.localeCompare(groupB, 'fr');
    });
  }, [groupedFiltered]);

  // Vérifier si une option correspond exactement à la recherche
  const exactMatchExists = useMemo(() => {
    if (!searchNorm) return true;
    return normalizedOptions.some(
      (opt) =>
        opt.label.toLowerCase() === searchNorm || opt.value.toLowerCase() === searchNorm
    );
  }, [normalizedOptions, searchNorm]);

  // Trouver l'élément sélectionné
  const selectedOption = useMemo(() => {
    if (!value) return null;
    return (
      normalizedOptions.find(
        (o) =>
          o.value.toLowerCase() === value.toLowerCase() ||
          o.label.toLowerCase() === value.toLowerCase()
      ) || {
        value,
        label: value,
        badgeColor: badgeColor || getColorForString(value),
      }
    );
  }, [normalizedOptions, value, badgeColor]);

  // Fermer lors d'un clic extérieur ou appui sur Échap
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
          'flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-colors group',
          isSelected ? 'bg-primary/10 text-primary font-bold' : 'text-foreground hover:bg-muted/70'
        )}
      >
        <div className="flex items-center gap-2.5 truncate flex-1">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs"
            style={{ backgroundColor: isRestitue ? '#fdab3d' : (item.badgeColor || '#0073ea') }}
          />
          <span className="truncate">{item.label}</span>
          {isRestitue ? (
            <span className="text-[10px] px-1.5 py-0.2 rounded-md font-bold uppercase tracking-wider bg-amber-500/20 text-amber-800 dark:text-amber-300 shrink-0 border border-amber-500/30">
              Restitué
            </span>
          ) : item.sublabel ? (
            <span className="text-[10px] text-muted-foreground font-normal shrink-0">
              ({item.sublabel})
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-2">
          {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
          {onDeleteOption && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteOption(item.value);
              }}
              className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-opacity"
              title="Supprimer cette étiquette"
            >
              <Trash2 className="h-3 w-3" />
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

      {/* Bouton Déclencheur Principal (Trigger style Monday) - Hauteur fixe h-11 uniforme */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'h-11 w-full flex items-center justify-between rounded-xl border border-input bg-card px-3.5 text-sm font-semibold text-foreground shadow-xs hover:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer',
          isOpen && 'border-primary ring-2 ring-primary/20 bg-muted/20'
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1 overflow-hidden">
          {icon ? (
            <span className="text-muted-foreground shrink-0">{icon}</span>
          ) : selectedOption ? (
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs"
              style={{
                backgroundColor: selectedOption.badgeColor || '#0073ea',
              }}
            />
          ) : null}

          {selectedOption ? (
            <span className="truncate font-semibold text-sm text-foreground flex items-center gap-2 min-w-0">
              <span className="truncate">{selectedOption.label}</span>
              {/restitu/i.test(selectedOption.group || '') && (
                <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                  Restitué
                </span>
              )}
              {selectedOption.sublabel && !/restitu/i.test(selectedOption.group || '') && (
                <span className="shrink-0 text-xs text-muted-foreground font-normal">
                  ({selectedOption.sublabel})
                </span>
              )}
            </span>
          ) : (
            <span className="text-muted-foreground font-normal text-sm truncate whitespace-nowrap">
              {placeholder}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0 text-muted-foreground ml-2">
          {value && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
              className="p-1 rounded-full hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              title="Effacer la sélection"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
          <ChevronDown
            className={cn('h-4 w-4 transition-transform duration-200', isOpen && 'rotate-180 text-primary')}
          />
        </div>
      </button>

      {/* Menu Déroulant (Popover / Dropdown) */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1.5 z-50 rounded-2xl border border-border bg-popover text-popover-foreground shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-100">
          {/* Barre de Recherche */}
          <div className="p-2.5 border-b border-border/60 bg-muted/20">
            <div className="relative flex items-center">
              <Search className="absolute left-3 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
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
                className="w-full rounded-lg border border-border bg-background pl-8.5 pr-8 py-1.5 text-xs font-medium text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
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

            <div className="flex items-center justify-between px-1 mt-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              <span>Résultats</span>
              <span>
                {filtered.length} sur {normalizedOptions.length}
              </span>
            </div>
          </div>

          {/* Liste des Options */}
          <div className="max-h-64 overflow-y-auto divide-y divide-border/20 p-1">
            {filtered.length > 0 ? (
              sortedGroupEntries.length > 0 ? (
                sortedGroupEntries.map(([groupName, items]) => {
                  const isRestitue = /restitu/i.test(groupName);
                  return (
                    <div key={groupName} className="mb-2 last:mb-0">
                      {/* En-tête de section Groupe style Monday */}
                      <div
                        className={cn(
                          "sticky top-0 z-10 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wider flex items-center justify-between rounded-md mb-1 backdrop-blur-md shadow-xs border",
                          isRestitue
                            ? "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30"
                            : "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30"
                        )}
                      >
                        <span className="flex items-center gap-1.5">
                          <span>{isRestitue ? '📦' : '🚗'}</span>
                          <span>{groupName}</span>
                        </span>
                        <span
                          className={cn(
                            "text-[10px] font-black px-2 py-0.5 rounded-full",
                            isRestitue
                              ? "bg-amber-500/30 text-amber-900 dark:text-amber-200"
                              : "bg-emerald-500/30 text-emerald-900 dark:text-emerald-200"
                          )}
                        >
                          {items.length}
                        </span>
                      </div>

                      {/* Éléments du groupe */}
                      <div className="space-y-0.5 pl-0.5">
                        {items.map((item) => renderOptionItem(item))}
                      </div>
                    </div>
                  );
                })
              ) : (
                filtered.map((item) => renderOptionItem(item))
              )
            ) : (
              <div className="p-4 text-center text-xs text-muted-foreground italic">
                Aucune étiquette trouvée pour « {search.trim()} »
              </div>
            )}
          </div>

          {/* Bouton de Création Inline */}
          {allowCreate && search.trim() && !exactMatchExists && (
            <button
              type="button"
              onClick={handleCreate}
              className="w-full flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold text-primary bg-primary/8 hover:bg-primary/15 border-t border-border transition-colors cursor-pointer text-left"
            >
              <Plus className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate flex-1">
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
