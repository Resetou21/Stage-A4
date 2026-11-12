import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, MapPin, Search, Wrench, X } from 'lucide-react';
import { cn } from '@lib/utils';

export interface AlertMachineOption {
  id: string;
  name: string;
  type: string;
  site: string;
}

interface AlertContextSelectProps {
  chantiers: string[];
  machines: AlertMachineOption[];
  loading?: boolean;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

function getBadgeNumber(name: string): string {
  const match = name.match(/^(\d+)/);
  if (match) return match[1];
  const parts = name.trim().split(/\s+/);
  if (parts.length > 0 && parts[0].length <= 3) return parts[0];
  return name.substring(0, 2).toUpperCase();
}

export default function AlertContextSelect({
  chantiers,
  machines,
  loading = false,
  value,
  onChange,
  placeholder = 'Machine ou chantier concerné (optionnel)',
}: AlertContextSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('keydown', onEsc);
    };
  }, []);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => searchRef.current?.focus(), 40);
      return () => clearTimeout(t);
    }
  }, [open]);

  const q = search.toLowerCase().trim();

  const filteredChantiers = useMemo(() => {
    if (!q) return chantiers;
    return chantiers.filter((c) => c.toLowerCase().includes(q));
  }, [chantiers, q]);

  const filteredMachines = useMemo(() => {
    if (!q) return machines;
    return machines.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.type.toLowerCase().includes(q) ||
        m.site.toLowerCase().includes(q)
    );
  }, [machines, q]);

  const pick = (nextVal: string) => {
    onChange(nextVal);
    setOpen(false);
    setSearch('');
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen((o) => !o);
          }
        }}
        className={cn(
          'flex min-h-8 w-full cursor-pointer items-center justify-between gap-2 rounded-lg border bg-white px-2.5 py-1.5 text-xs transition-colors',
          open ? 'border-[#39A9DC] ring-1 ring-[#39A9DC]/30' : 'border-[#D2E9F6] hover:border-[#39A9DC]'
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <Search className="h-3.5 w-3.5 shrink-0 text-[#3989B7]" />
          <span className={cn('truncate', value ? 'font-bold text-[#1B4565]' : 'text-[#57778E]')}>
            {value || placeholder}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {value && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
                setSearch('');
              }}
              aria-label="Effacer"
              className="rounded p-0.5 text-[#57778E] hover:bg-muted hover:text-[#1B4565]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <ChevronDown className={cn('h-3.5 w-3.5 text-[#3989B7] transition-transform', open && 'rotate-180')} />
        </div>
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 rounded-xl border border-[#39A9DC] bg-white p-2 shadow-xl">
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-[#39A9DC]" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un chantier, n°, machine ou site..."
              className="w-full rounded-lg border border-[#C8DCE8] bg-[#F8FCFE] py-1.5 pl-8 pr-7 text-xs text-[#1B4565] outline-none focus:border-[#39A9DC]"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-2 text-[#6C8CA3] hover:text-[#1B4565]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="max-h-56 overflow-y-auto space-y-1 pr-0.5">
            {loading && chantiers.length === 0 && machines.length === 0 && (
              <p className="py-3 text-center text-xs text-[#57778E]">Chargement des chantiers et machines…</p>
            )}

            {filteredChantiers.length > 0 && (
              <div>
                <div className="px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-[#3989B7]">
                  Chantiers / Sites ({filteredChantiers.length})
                </div>
                {filteredChantiers.slice(0, 30).map((site) => {
                  const formatted = `Site : ${site}`;
                  const selected = value === formatted || value === site;
                  return (
                    <button
                      key={`site-${site}`}
                      type="button"
                      onClick={() => pick(formatted)}
                      className={cn(
                        'flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-semibold transition-colors',
                        selected ? 'bg-[#EBF6FC] text-[#1B4565]' : 'text-[#1B4565] hover:bg-[#F5F9FC]'
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-1.5 truncate">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-[#39A9DC]" />
                        <span className="truncate">{site}</span>
                      </span>
                      {selected && <Check className="h-3.5 w-3.5 shrink-0 text-[#39A9DC]" />}
                    </button>
                  );
                })}
              </div>
            )}

            {filteredMachines.length > 0 && (
              <div>
                <div className="px-1.5 pt-1 pb-0.5 text-[10px] font-extrabold uppercase tracking-wide text-[#3989B7]">
                  Machines du parc ({filteredMachines.length})
                </div>
                {filteredMachines.slice(0, 60).map((m) => {
                  const formatted = m.site ? `${m.name} (${m.site})` : m.name;
                  const selected = value === formatted || value === m.name;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => pick(formatted)}
                      className={cn(
                        'flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left transition-colors',
                        selected ? 'bg-[#EBF6FC]' : 'hover:bg-[#F5F9FC]'
                      )}
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <span
                          className={cn(
                            'flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px] font-black',
                            selected ? 'bg-[#39A9DC] text-white' : 'border border-[#D2E9F6] bg-[#EBF6FC] text-[#39A9DC]'
                          )}
                        >
                          {getBadgeNumber(m.name)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-bold text-[#1B4565]">{m.name}</div>
                          <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-[#57778E]">
                            {m.type && <span className="inline-flex items-center gap-0.5"><Wrench className="h-2.5 w-2.5" />{m.type}</span>}
                            {m.site && <span>· {m.site}</span>}
                          </div>
                        </div>
                      </div>
                      {selected && <Check className="h-3.5 w-3.5 shrink-0 text-[#39A9DC]" />}
                    </button>
                  );
                })}
              </div>
            )}

            {!loading && filteredChantiers.length === 0 && filteredMachines.length === 0 && !search.trim() && (
              <p className="py-3 text-center text-xs text-[#57778E]">Aucun chantier ni machine trouvé.</p>
            )}

            {search.trim() && (
              <button
                type="button"
                onClick={() => pick(search.trim())}
                className="mt-1 w-full rounded-lg border border-dashed border-[#39A9DC] bg-[#F8FCFE] px-2.5 py-1.5 text-left text-xs font-bold text-[#1B4565] hover:bg-[#EBF6FC]"
              >
                + Utiliser « {search.trim()} »
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

