import { useEffect, useState } from 'react';
import InfoTip from '@generated/components/InfoTip';
import {
  getAllSitesHistory,
  getInventory,
  getInventoryActions,
  getInventoryDue,
  getSitesCount,
  type SiteHistoryResult,
} from '@generated/server/inventory';
import InventoryActions from '@generated/components/InventoryActions';
import { ClipboardCheck, ListChecks, MapPin, Search } from 'lucide-react';
import { cn } from '@lib/utils';
import SitesList from '@generated/components/InventoryCard';
import InventoryDue from '@generated/components/InventoryDue';

const TILES = [
  { id: 'sites', title: 'Liste des sites avec hygiène', icon: MapPin },
  { id: 'todo', title: 'Inventaires à faire', icon: ListChecks },
  { id: 'actions', title: 'Actions suite inventaire', icon: ClipboardCheck },
] as const;

type TileId = (typeof TILES)[number]['id'];

export default function InventorySpace({ firstName, onInventoryValidated }: { firstName: string; onInventoryValidated?: () => void }) {
  const [active, setActive] = useState<TileId>('sites');
  const [sitesCount, setSitesCount] = useState<number | string | null>(null);
  const [dueCount, setDueCount] = useState<number | string | null>(null);
  const [actionsCount, setActionsCount] = useState<number | string | null>(null);
  const [sitesData, setSitesData] = useState<Awaited<ReturnType<typeof getInventory>> | null>(null);
  const [historyMap, setHistoryMap] = useState<Record<string, SiteHistoryResult>>({});
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [dueData, setDueData] = useState<Awaited<ReturnType<typeof getInventoryDue>> | null>(null);
  const [actionsData, setActionsData] = useState<Awaited<ReturnType<typeof getInventoryActions>> | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [search, setSearch] = useState('');

  // Pré-chargement de l'historique complet des sites (une seule fois par profil)
  useEffect(() => {
    let isMounted = true;
    setHistoryLoaded(false);
    getAllSitesHistory({ data: { firstName } })
      .then((r) => {
        if (isMounted) {
          if (r?.historyBySite) setHistoryMap(r.historyBySite);
          setHistoryLoaded(true);
        }
      })
      .catch((e) => {
        console.error(e);
        if (isMounted) setHistoryLoaded(true);
      });
    return () => { isMounted = false; };
  }, [firstName]);

  // Chargement et rafraîchissement réactif ultra-rapide des inventaires et actions
  useEffect(() => {
    let isMounted = true;

    // 1. Compteur de sites
    getSitesCount({ data: { firstName } })
      .then((r) => { if (isMounted) setSitesCount(r?.count ?? 0); })
      .catch((e) => { console.error(e); if (isMounted) setSitesCount('—'); });

    // 2. Pré-chargement liste des sites (Tile 01)
    getInventory({ data: { firstName } })
      .then((r) => { if (isMounted) setSitesData(r ?? null); })
      .catch((e) => console.error(e));

    // 3. Pré-chargement des inventaires à faire (Tile 02)
    getInventoryDue({ data: { firstName } })
      .then((r) => {
        if (isMounted) {
          setDueCount(r?.count ?? 0);
          setDueData(r ?? null);
        }
      })
      .catch((e) => { console.error(e); if (isMounted) setDueCount('—'); });

    // 4. Pré-chargement des actions suite inventaire (Tile 03)
    getInventoryActions({ data: { firstName } })
      .then((r) => {
        if (isMounted) {
          setActionsCount(r?.count ?? 0);
          setActionsData(r ?? null);
        }
      })
      .catch((e) => { console.error(e); if (isMounted) setActionsCount('—'); });

    return () => { isMounted = false; };
  }, [firstName, refreshKey]);
  const current = TILES.find((t) => t.id === active);

  return (
    <div className="relative rounded-[var(--radius-lg)] border border-border bg-card p-6 pt-8 sm:p-8">
      <div className="absolute -top-4 left-6 flex items-center gap-3 bg-background pr-3">
        <span className="inline-flex h-8 min-w-10 items-center justify-center rounded-[var(--radius-sm)] rounded-br-none bg-primary px-2 text-sm font-bold text-primary-foreground">01</span>
        <h2 className="text-xl font-bold">Inventaires consommables</h2>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {TILES.map((t, i) => {
          const Icon = t.icon;
          const on = t.id === active;
          return (
            <button key={t.id} type="button" onClick={() => setActive(t.id)} aria-pressed={on}
              className={cn(
                'flex aspect-[2/1] flex-col justify-between rounded-[var(--radius-md)] border-2 p-4 text-left transition-colors sm:aspect-square',
                on ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50 hover:bg-muted/50',
              )}>
              <div className="flex items-center justify-between">
                <Icon className="h-7 w-7 text-primary" />
                <span className="text-xs font-bold text-muted-foreground">0{i + 1}</span>
              </div>
              {(
                <span className="self-center text-5xl font-extrabold tracking-tight text-primary">
                  {(t.id === 'sites' ? sitesCount : t.id === 'todo' ? dueCount : actionsCount) ?? <span className="inline-block h-10 w-14 animate-pulse rounded bg-muted align-middle" />}
                </span>
              )}
              <span className="text-base font-bold leading-tight sm:text-lg">{t.title}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-8 border-t border-border pt-6">
        <div className="relative mb-5">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un site…"
            aria-label="Rechercher un site"
            className="h-11 w-full rounded-[var(--radius-md)] border border-input bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        {active === 'sites' ? (
          <>
            <h3 className="mb-3 flex items-center gap-1 text-lg font-semibold">
              {current?.title}
              <InfoTip
                label={current?.title ?? ''}
                text="Sites avec contrat hygiène suivis par la responsable de secteur. Les données et historiques sont pré-chargés pour un affichage immédiat."
              />
            </h3>
            <SitesList
              firstName={firstName}
              search={search}
              preloaded={sitesData}
              historyMap={historyMap}
              historyLoaded={historyLoaded}
            />
          </>
        ) : (
          <>
          <h3 className="mb-3 flex items-center gap-1 text-lg font-semibold">
            {current?.title}
            <InfoTip
              label={current?.title ?? ''}
              text={active === 'todo'
                ? 'Liste des sites dont le relevé de stock est en attente et où les quantités doivent être saisies.'
                : 'Le chiffre affiché entre parenthèses à côté de la quantité à récupérer indique à combien de mois de consommation correspond ce stock (Quantité à récupérer / Dotation mensuelle = Nombre de mois).'}
            />
          </h3>
          {active === 'todo' ? (
            <InventoryDue
              firstName={firstName}
              search={search}
              preloaded={dueData}
              onChanged={() => {
                setRefreshKey((k) => k + 1);
                onInventoryValidated?.();
              }}
            />
          ) : (
            <InventoryActions
              firstName={firstName}
              search={search}
              preloaded={actionsData}
              onChanged={(doneId?: string) => {
                if (doneId) {
                  setActionsData((prev) => {
                    if (!prev) return null;
                    const remaining = prev.rows.filter((x) => x.id !== doneId);
                    return {
                      ...prev,
                      count: remaining.length,
                      rows: remaining,
                    };
                  });
                }
                setActionsCount((n) => (typeof n === 'number' ? Math.max(0, n - 1) : n));
                onInventoryValidated?.();
              }}
            />
          )}
          </>
        )}
      </div>
    </div>
  );
}
