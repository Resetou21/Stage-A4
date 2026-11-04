import React, { useState, useEffect, useRef } from 'react';
import { User, ChevronDown, Check, ArrowRightLeft } from 'lucide-react';
import { cn } from '@lib/utils';
import { ANIMATEURS_OPTIONS } from '@generated/server/chantiers';

interface AnimatriceSelectProps {
  value: string;
  onChange: (value: string) => void;
  options?: readonly string[];
}

interface AnimatriceMeta {
  initials: string;
  bgBadge: string;
  role: string;
}

const ANIMATRICES_META: Record<string, AnimatriceMeta> = {
  'Natacha THOMAS': {
    initials: 'NT',
    bgBadge: 'bg-rose-500/15 text-rose-700 dark:bg-rose-500/25 dark:text-rose-300 border-rose-300/60 dark:border-rose-700/50',
    role: 'Animatrice de secteur',
  },
  'Ketty PAULIN': {
    initials: 'KP',
    bgBadge: 'bg-purple-500/15 text-purple-700 dark:bg-purple-500/25 dark:text-purple-300 border-purple-300/60 dark:border-purple-700/50',
    role: 'Animatrice de secteur',
  },
  'Emilie TOBIE': {
    initials: 'ET',
    bgBadge: 'bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/25 dark:text-emerald-300 border-emerald-300/60 dark:border-emerald-700/50',
    role: 'Animatrice de secteur',
  },
  'Andre LEVESQUE': {
    initials: 'AL',
    bgBadge: 'bg-sky-500/15 text-sky-700 dark:bg-sky-500/25 dark:text-sky-300 border-sky-300/60 dark:border-sky-700/50',
    role: 'Animateur de secteur',
  },
};

const getMeta = (name: string): AnimatriceMeta => {
  if (ANIMATRICES_META[name]) return ANIMATRICES_META[name];
  const parts = name.trim().split(/\s+/);
  const initials = parts.map((p) => p[0]).join('').substring(0, 2).toUpperCase() || 'AN';
  return {
    initials,
    bgBadge: 'bg-blue-500/15 text-blue-700 dark:bg-blue-500/25 dark:text-blue-300 border-blue-300/60 dark:border-blue-700/50',
    role: 'Responsable de secteur',
  };
};

export default function AnimatriceSelect({
  value,
  onChange,
  options = ANIMATEURS_OPTIONS,
}: AnimatriceSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const currentMeta = getMeta(value || 'Non assigné');

  // S'assurer que si la valeur actuelle n'est pas dans la liste par défaut, elle est tout de même affichée
  const allOptions = Array.from(new Set([...options, ...(value ? [value] : [])]));

  const handleSelect = (anim: string) => {
    onChange(anim);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Bouton Trigger personnalisé */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full flex items-center justify-between rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm font-bold text-foreground transition-all shadow-xs hover:border-primary/60 hover:bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/20',
          isOpen && 'border-primary ring-2 ring-primary/20'
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span
            className={cn(
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-black border',
              currentMeta.bgBadge
            )}
          >
            {currentMeta.initials}
          </span>
          <div className="text-left truncate">
            <span className="block text-sm font-extrabold text-foreground truncate leading-tight">
              {value || 'Sélectionner une animatrice...'}
            </span>
            <span className="block text-[11px] font-semibold text-muted-foreground leading-tight">
              {currentMeta.role}
            </span>
          </div>
        </div>

        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
            isOpen && 'rotate-180 text-primary'
          )}
        />
      </button>

      {/* Menu déroulant vers le bas (z-50) */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1.5 z-50 rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl p-1.5 space-y-1 animate-in fade-in-0 zoom-in-95 duration-100">
          <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Choisir la responsable du site
          </div>
          {allOptions.map((anim) => {
            const meta = getMeta(anim);
            const isSelected = value === anim;
            return (
              <button
                key={anim}
                type="button"
                onClick={() => handleSelect(anim)}
                className={cn(
                  'w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left transition-colors cursor-pointer group',
                  isSelected
                    ? 'bg-primary/10 text-primary font-bold'
                    : 'hover:bg-muted/70 text-foreground'
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={cn(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-black border transition-transform group-hover:scale-105',
                      meta.bgBadge
                    )}
                  >
                    {meta.initials}
                  </span>
                  <div className="truncate">
                    <p className={cn('text-xs font-bold leading-tight', isSelected ? 'text-primary' : 'text-foreground')}>
                      {anim}
                    </p>
                    <p className="text-[10px] text-muted-foreground leading-tight">
                      {meta.role}
                    </p>
                  </div>
                </div>

                {isSelected && (
                  <Check className="h-4 w-4 shrink-0 text-primary font-bold" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

