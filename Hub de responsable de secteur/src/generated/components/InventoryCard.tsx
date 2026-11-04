import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, History, Loader2, MapPin } from 'lucide-react';
import { getInventory, getSiteInventoryHistory, type SiteHistoryResult } from '@generated/server/inventory';
import SiteHistoryModal from '@generated/components/SiteHistoryModal';
import { normalize } from '@generated/lib/normalize';
import { cn } from '@lib/utils';

type Site = Awaited<ReturnType<typeof getInventory>>['items'][number];
type HistoryData = SiteHistoryResult;

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('fr-FR') : '—');

function SiteRow({
  site,
  initialHistory,
  historyLoaded = false,
}: {
  site: Site;
  initialHistory?: HistoryData | null;
  historyLoaded?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyData, setHistoryData] = useState<HistoryData | null>(initialHistory ?? null);

  useEffect(() => {
    if (initialHistory) {
      setHistoryData(initialHistory);
    }
  }, [initialHistory]);

  const currentHistory = historyData || initialHistory;
  const hasHistory = Boolean(currentHistory && currentHistory.history.length > 0);

  const openHistory = async () => {
    setModalOpen(true);
    const existing = historyData || initialHistory;

    // 1. Si on a déjà les données de ce site en mémoire : ouverture immédiate à 0 ms
    if (existing) {
      setHistoryLoading(false);
      return;
    }

    // 2. Si le pré-chargement global de tous les sites est terminé et que ce chantier n'a aucun archivage :
    // On sait avec 100% de certitude qu'il n'y a rien. On affiche le message "Aucun relevé" sans spinner inutile !
    if (historyLoaded) {
      setHistoryData({ history: [], recommendation: null, trend: 'equilibre' });
      setHistoryLoading(false);
      return;
    }

    // 3. Fallback uniquement si le pré-chargement global était encore en cours lors du clic
    setHistoryLoading(true);
    try {
      const res = await getSiteInventoryHistory({
        data: {
          chantierId: site.chantierId,
          chantierName: site.chantier,
        },
      });
      setHistoryData(res);
    } catch (err) {
      console.error('Erreur chargement historique site:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <li className="border-t border-border first:border-t-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex min-h-12 w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
      >
        <MapPin className="h-4 w-4 shrink-0 text-primary" />
        <span className="min-w-0 flex-1 truncate font-semibold">{site.chantier}</span>
        <ChevronDown className={cn('h-5 w-5 shrink-0 transition-transform', open && 'rotate-180')} aria-label={open ? 'Masquer' : 'Afficher'} />
      </button>

      {open && (
        <div className="px-4 pb-5 space-y-3">
          {/* Tableau Contrat Actuel (2026) */}
          <div className="overflow-x-auto rounded-[var(--radius-md)] border border-border bg-card shadow-2xs">
            <table className="w-full min-w-[480px] text-sm">
              <thead className="bg-secondary text-left text-xs uppercase tracking-wide text-secondary-foreground font-semibold">
                <tr>
                  <th className="px-3 py-2">Chantier</th>
                  <th className="px-3 py-2">Fournisseur</th>
                  <th className="px-3 py-2">Dernier inventaire</th>
                  {site.contrats.map((c) => (
                    <th key={c.name} className="px-3 py-2">{c.name} – Contrat</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-border">
                  <td className="px-3 py-2.5 font-semibold text-foreground">{site.chantier}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{site.fournisseur || '—'}</td>
                  <td className="px-3 py-2.5 tabular-nums">{fmt(site.dateInventaire)}</td>
                  {site.contrats.map((c) => (
                    <td key={c.name} className="px-3 py-2.5 font-bold tabular-nums text-primary">{c.value}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          {site.contrats.length === 0 && (
            <p className="text-xs text-muted-foreground italic">Aucune quantité contrat renseignée sur ce chantier.</p>
          )}

          {/* Bouton élégant pour ouvrir la pop-up modale d'historique & analyse 2027 */}
          <div className="pt-2 flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs text-muted-foreground italic">
              Consommations annuelles prévues sous contrat 2026.
            </span>
            <button
              type="button"
              onClick={openHistory}
              className={cn(
                'inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-bold transition-all shadow-2xs',
                hasHistory
                  ? 'border-primary/40 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground'
                  : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <History className="h-4 w-4" />
              <span>
                {hasHistory
                  ? `📜 Historique (${currentHistory?.history.length} relevé${currentHistory?.history.length! > 1 ? 's' : ''}) & Analyse 2027`
                  : '📜 Historique des relevés & Analyse 2027'}
              </span>
            </button>
          </div>

          {/* Pop-up modale dédiée avec graphique, recommandation 2027 et tableau chronologique */}
          <SiteHistoryModal
            open={modalOpen}
            onOpenChange={setModalOpen}
            siteName={site.chantier}
            fournisseur={site.fournisseur}
            dernierInventaire={site.dateInventaire}
            historyData={historyData}
            loading={historyLoading}
          />
        </div>
      )}
    </li>
  );
}

export default function InventoryCard({
  firstName,
  search = '',
  preloaded,
  historyMap = {},
  historyLoaded = false,
}: {
  firstName: string;
  search?: string;
  preloaded?: Awaited<ReturnType<typeof getInventory>> | null;
  historyMap?: Record<string, SiteHistoryResult>;
  historyLoaded?: boolean;
}) {
  const [sites, setSites] = useState<Site[]>(preloaded?.items ?? []);
  const [cursor, setCursor] = useState<string | null>(preloaded?.cursor ?? null);
  const [loading, setLoading] = useState(!preloaded);
  const [refetching, setRefetching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [term, setTerm] = useState(search);
  const loadedOnce = useRef(Boolean(preloaded));

  useEffect(() => {
    if (preloaded?.items) {
      setSites(preloaded.items);
      setCursor(preloaded.cursor ?? null);
      setLoading(false);
      loadedOnce.current = true;
    }
  }, [preloaded]);

  useEffect(() => {
    const t = setTimeout(() => setTerm(search.trim()), 200);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (loadedOnce.current && preloaded) return;

    let active = true;
    if (loadedOnce.current) setRefetching(true); else setLoading(true);
    getInventory({ data: { firstName, search: term || undefined } })
      .then((res) => {
        if (!active) return;
        setSites(res?.items ?? []);
        setCursor(res?.cursor ?? null);
        setError(null);
        loadedOnce.current = true;
      })
      .catch((e) => {
        console.error(e);
        if (active) setError('Impossible de charger les sites.');
      })
      .finally(() => {
        if (active) {
          setLoading(false);
          setRefetching(false);
        }
      });
    return () => {
      active = false;
    };
  }, [firstName, term, preloaded]);

  // Filtrage mémoire ultra-rapide
  const displayedSites = useMemo(() => {
    const q = normalize(term);
    if (!q) return sites;
    return sites.filter((s) => normalize(s.chantier).includes(q) || normalize(s.fournisseur || '').includes(q));
  }, [sites, term]);

  const more = async () => {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const res = await getInventory({ data: { firstName, cursor, search: term || undefined } });
      setSites((p) => [...p, ...(res?.items ?? [])]);
      setCursor(res?.cursor ?? null);
    } catch (e) {
      console.error(e);
      setError('Chargement impossible.');
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div>
      <p className="mb-5 text-sm text-muted-foreground">
        Sites suivis par {firstName} — cliquez sur la flèche pour voir le détail. Les consommations prévues sont annuelles.
      </p>
      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}
      <ul
        className={cn('rounded-[var(--radius-md)] border border-border transition-opacity', refetching && 'opacity-60')}
        aria-busy={refetching}
      >
        {loading &&
          ['a', 'b', 'c', 'd'].map((k) => (
            <li key={k} className="border-t border-border px-4 py-4 first:border-t-0">
              <div className="h-4 animate-pulse rounded bg-muted" />
            </li>
          ))}
        {!loading && displayedSites.length === 0 && (
          <li className="px-4 py-10 text-center text-sm text-muted-foreground">
            {term ? `Aucun site ne correspond à « ${term} »` : `Aucun site trouvé pour ${firstName}.`}
          </li>
        )}
        {!loading &&
          displayedSites.map((s) => (
            <SiteRow
              key={s.id}
              site={s}
              initialHistory={historyMap[s.chantierId] || historyMap[s.id] || historyMap[normalize(s.chantier)]}
              historyLoaded={historyLoaded}
            />
          ))}
      </ul>
      {cursor && !loading && (
        <button
          type="button"
          onClick={more}
          disabled={loadingMore}
          className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-md)] border border-border px-4 text-sm font-semibold hover:bg-muted disabled:opacity-60"
        >
          {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />} Charger plus
        </button>
      )}
    </div>
  );
}