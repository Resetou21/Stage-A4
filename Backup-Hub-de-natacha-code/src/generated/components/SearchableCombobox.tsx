import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, ChevronDown, Check, Plus, X, Sparkles } from 'lucide-react';
import { cn } from '@lib/utils';

interface SearchableComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  emptyHelperText?: string;
  allowCreate?: boolean;
  createLabelPrefix?: string;
  autoUppercase?: boolean;
  icon?: React.ReactNode;
}

export default function SearchableCombobox({
  value,
  onChange,
  options,
  placeholder = 'Rechercher une étiquette...',
  emptyHelperText = 'Tapez au moins 1 lettre pour filtrer les étiquettes...',
  allowCreate = true,
  createLabelPrefix = 'Créer la nouvelle étiquette',
  autoUppercase = true,
  icon,
}: SearchableComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState(value || '');
  const containerRef = useRef<HTMLDivElement>(null);

  // Synchroniser la saisie quand la valeur externe change
  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  // Fermer le menu lors d'un clic en dehors
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const trimmedQuery = query.trim();
  const normalizedQuery = trimmedQuery.toLowerCase();

  // Filtrage dynamique : Si 0 caractère saisi -> n'affiche pas la liste complète (règle demandée)
  const filtered = useMemo(() => {
    if (!normalizedQuery) return [];
    return options.filter((opt) => opt.toLowerCase().includes(normalizedQuery));
  }, [options, normalizedQuery]);

  const exactMatch = useMemo(() => {
    if (!trimmedQuery) return true;
    return options.some((opt) => opt.toLowerCase() === normalizedQuery);
  }, [options, normalizedQuery, trimmedQuery]);

  const handleSelect = (selectedVal: string) => {
    const finalVal = autoUppercase ? selectedVal.toUpperCase().trim() : selectedVal.trim();
    onChange(finalVal);
    setQuery(finalVal);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setQuery('');
    setIsOpen(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setQuery(raw);
    onChange(autoUppercase ? raw.toUpperCase() : raw);
    if (!isOpen) setIsOpen(true);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative flex items-center">
        {icon && (
          <span className="pointer-events-none absolute left-3 flex items-center text-muted-foreground">
            {icon}
          </span>
        )}
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className={cn(
            'w-full rounded-lg border border-border bg-card py-1.5 text-sm font-semibold text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-xs transition-colors',
            icon ? 'pl-9' : 'pl-3',
            query ? 'pr-16' : 'pr-9'
          )}
        />
        <div className="absolute right-2 flex items-center gap-1">
          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title="Effacer la saisie"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors"
            title={isOpen ? 'Fermer la liste' : 'Ouvrir la liste'}
          >
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform duration-200', isOpen && 'rotate-180')} />
          </button>
        </div>
      </div>

      {/* Menu déroulant vers le bas (aligné proprement sous le champ) */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-100">
          {!trimmedQuery ? (
            <div className="p-3 text-center text-xs text-muted-foreground font-medium bg-muted/20">
              {emptyHelperText}
            </div>
          ) : (
            <div className="max-h-56 overflow-y-auto divide-y divide-border/40">
              {filtered.length > 0 ? (
                filtered.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => handleSelect(opt)}
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-left hover:bg-muted/70 transition-colors cursor-pointer',
                      value?.toLowerCase() === opt.toLowerCase() ? 'bg-primary/10 text-primary font-bold' : 'text-foreground'
                    )}
                  >
                    <span>{opt}</span>
                    {value?.toLowerCase() === opt.toLowerCase() && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                  </button>
                ))
              ) : (
                <div className="p-3 text-center text-xs text-muted-foreground italic">
                  Aucune étiquette existante ne correspond à "{trimmedQuery}"
                </div>
              )}

              {/* Option de création directe de la nouvelle étiquette si elle n'existe pas encore */}
              {allowCreate && trimmedQuery && !exactMatch && (
                <button
                  type="button"
                  onClick={() => handleSelect(trimmedQuery)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-bold text-primary bg-primary/5 hover:bg-primary/15 transition-colors border-t border-border cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">
                    {createLabelPrefix} "{autoUppercase ? trimmedQuery.toUpperCase() : trimmedQuery}"
                  </span>
                  <Sparkles className="h-3.5 w-3.5 shrink-0 ml-auto text-amber-500 animate-pulse" />
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

