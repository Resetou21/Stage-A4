import { useEffect, useMemo, useState } from 'react';
import { 
  Building2, 
  Search, 
  MapPin, 
  Phone, 
  Key, 
  ExternalLink, 
  ChevronRight, 
  Filter, 
  Sun, 
  Frown, 
  LayoutGrid, 
  List,
  Sparkles,
  Pencil
} from 'lucide-react';
import { getChantiersList, hasRealKey, type ChantierItem } from '@generated/server/chantiers';
import { monday } from '@api/BoardSDK';
import ChantierDetailModal from '@generated/components/ChantierDetailModal';
import { cn } from '@lib/utils';

export default function ChantiersSpace({ firstName }: { firstName: string }) {
  const [chantiers, setChantiers] = useState<ChantierItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedStar, setSelectedStar] = useState<string | null>(null);
  const [onlyWithKey, setOnlyWithKey] = useState(false);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('table');
  const [activeChantier, setActiveChantier] = useState<ChantierItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 9; // 9 cartes par page (3 rangées de 3 cartes)

  useEffect(() => {
    let active = true;
    setLoading(true);
    getChantiersList({ data: { firstName } })
      .then((data) => {
        if (active) {
          setChantiers(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Erreur chargement chantiers:', err);
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [firstName]);

  const handleOpenMondayCard = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      monday.execute('openItemCard', { itemId: id });
    } catch (err) {
      console.error(err);
    }
  };

  const handleRowClick = (c: ChantierItem) => {
    setActiveChantier(c);
    setModalOpen(true);
  };

  const handleChantierUpdated = (updated: ChantierItem) => {
    const normUser = firstName.toLowerCase().trim();
    const anim = (updated.animateur || '').toLowerCase();

    // Vérifier si le chantier appartient toujours à l'animatrice active de cette session
    let isStillMine = false;
    if (normUser.includes('emilie') || normUser.includes('émilie')) isStillMine = anim.includes('emilie') || anim.includes('émilie');
    else if (normUser.includes('natacha')) isStillMine = anim.includes('natacha');
    else if (normUser.includes('ketty')) isStillMine = anim.includes('ketty');
    else if (normUser.includes('andre') || normUser.includes('andré')) isStillMine = anim.includes('andre') || anim.includes('andré');
    else isStillMine = anim.includes(normUser);

    if (!isStillMine) {
      // Reattribué à une autre animatrice -> despawn du hub actuel
      setChantiers((prev) => prev.filter((c) => c.id !== updated.id));
      setActiveChantier(null);
      setModalOpen(false);
    } else {
      // Mise à jour sur place
      setChantiers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setActiveChantier(updated);
    }
  };

  // Filtrage
  const filteredChantiers = useMemo(() => {
    return chantiers.filter((c) => {
      if (selectedStar && c.stars !== selectedStar) return false;
      if (onlyWithKey && !hasRealKey(c.cle)) return false;

      if (!search.trim()) return true;
      const s = search.toLowerCase().trim();
      const matchName = c.name.toLowerCase().includes(s);
      const matchCode = (c.code || '').toLowerCase().includes(s);
      const matchVille = (c.ville || '').toLowerCase().includes(s);
      const matchAdresse = (c.adresse || '').toLowerCase().includes(s);
      const matchContact = (c.interlocuteur || '').toLowerCase().includes(s);
      const matchCle = (c.cle || '').toLowerCase().includes(s);
      const matchTel = (c.telephone || '').replace(/\s+/g, '').includes(s);

      return matchName || matchCode || matchVille || matchAdresse || matchContact || matchCle || matchTel;
    });
  }, [chantiers, search, selectedStar, onlyWithKey]);

  // Réinitialiser la page à 1 si les filtres changent
  useEffect(() => {
    setPage(1);
  }, [search, selectedStar, onlyWithKey]);

  const totalPages = Math.max(1, Math.ceil(filteredChantiers.length / PAGE_SIZE));
  const paginatedChantiers = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredChantiers.slice(start, start + PAGE_SIZE);
  }, [filteredChantiers, page]);

  // Pagination compacte et intelligente avec "..."
  const paginationItems = useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (page <= 4) {
      return [1, 2, 3, 4, 5, 'ellipsis-end', totalPages];
    }
    if (page >= totalPages - 3) {
      return [1, 'ellipsis-start', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, 'ellipsis-start', page - 1, page, page + 1, 'ellipsis-end', totalPages];
  }, [page, totalPages]);

  // Statistiques rapides
  const stats = useMemo(() => {
    let s3 = 0, s2 = 0, s1 = 0, s0 = 0, withKey = 0;
    for (const c of chantiers) {
      if (c.stars === '3🌟') s3++;
      else if (c.stars === '2🌟') s2++;
      else if (c.stars === '1🌟') s1++;
      else if (c.stars === '🙁') s0++;
      if (hasRealKey(c.cle)) withKey++;
    }
    return { s3, s2, s1, s0, withKey, total: chantiers.length };
  }, [chantiers]);

  return (
    <div className="space-y-6">
      {/* En-tête de section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            Accédez en 1 clic à toutes les fiches chantiers, coordonnées, clés et contrôles de {firstName} {!loading && <span className="font-bold text-foreground">({chantiers.length} sites suivis)</span>}.
          </p>
        </div>

        {/* Switcher de vue */}
        <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-1 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-all',
              viewMode === 'table' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <List className="h-3.5 w-3.5" />
            Tableau
          </button>
          <button
            type="button"
            onClick={() => setViewMode('cards')}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-all',
              viewMode === 'cards' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Cartes
          </button>
        </div>
      </div>

      {/* Barre de recherche et filtres rapides */}
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom de chantier, ville, contact, clé, code..."
            className="w-full rounded-xl border border-border bg-card py-2 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
            >
              Effacer
            </button>
          )}
        </div>

        {/* Filtres étoiles & clés */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setSelectedStar(null);
              setOnlyWithKey(false);
            }}
            className={cn(
              'rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer',
              selectedStar === null && !onlyWithKey
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'border border-border bg-card text-muted-foreground hover:bg-muted'
            )}
          >
            Tous ({stats.total})
          </button>
          <button
            type="button"
            onClick={() => {
              setOnlyWithKey(false);
              setSelectedStar(selectedStar === '3🌟' ? null : '3🌟');
            }}
            className={cn(
              'inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer',
              selectedStar === '3🌟' && !onlyWithKey
                ? 'bg-amber-500 text-white shadow-xs'
                : 'border border-border bg-card text-muted-foreground hover:bg-muted'
            )}
          >
            3🌟 ({stats.s3})
          </button>
          <button
            type="button"
            onClick={() => {
              setOnlyWithKey(false);
              setSelectedStar(selectedStar === '2🌟' ? null : '2🌟');
            }}
            className={cn(
              'inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer',
              selectedStar === '2🌟' && !onlyWithKey
                ? 'bg-amber-500 text-white shadow-xs'
                : 'border border-border bg-card text-muted-foreground hover:bg-muted'
            )}
          >
            2🌟 ({stats.s2})
          </button>
          <button
            type="button"
            onClick={() => {
              setOnlyWithKey(false);
              setSelectedStar(selectedStar === '1🌟' ? null : '1🌟');
            }}
            className={cn(
              'inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer',
              selectedStar === '1🌟' && !onlyWithKey
                ? 'bg-amber-500 text-white shadow-xs'
                : 'border border-border bg-card text-muted-foreground hover:bg-muted'
            )}
          >
            1🌟 ({stats.s1})
          </button>
          <button
            type="button"
            onClick={() => {
              setOnlyWithKey(false);
              setSelectedStar(selectedStar === '🙁' ? null : '🙁');
            }}
            className={cn(
              'inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer',
              selectedStar === '🙁' && !onlyWithKey
                ? 'bg-destructive text-destructive-foreground shadow-xs'
                : 'border border-border bg-card text-muted-foreground hover:bg-muted'
            )}
          >
            🙁 ({stats.s0})
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedStar(null);
              setOnlyWithKey(!onlyWithKey);
            }}
            className={cn(
              'inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer',
              onlyWithKey
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'border border-border bg-card text-muted-foreground hover:bg-muted'
            )}
          >
            <Key className="h-3 w-3" />
            Clés ({stats.withKey})
          </button>
        </div>
      </div>

      {/* Contenu principal */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-14 w-full animate-pulse rounded-xl bg-card border border-border" />
          ))}
        </div>
      ) : filteredChantiers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center bg-card/50">
          <Building2 className="mx-auto h-8 w-8 text-muted-foreground opacity-50" />
          <p className="mt-2 text-sm font-semibold text-foreground">Aucun chantier ne correspond à votre recherche</p>
          <p className="text-xs text-muted-foreground mt-1">Essayez de modifier votre mot-clé ou vos filtres.</p>
        </div>
      ) : viewMode === 'table' ? (
        /* VUE TABLEAU INTERACTIF */
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
          <div className="max-h-[36rem] overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur-xs text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border shadow-2xs">
                <tr>
                  <th className="px-4 py-3">Chantier</th>
                  <th className="px-4 py-3">Ville</th>
                  <th className="px-4 py-3">Interlocuteur &amp; Contact</th>
                  <th className="px-4 py-3">Clé &amp; Accès</th>
                  <th className="px-4 py-3">Qualité</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredChantiers.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => handleRowClick(c)}
                    className="hover:bg-muted/40 cursor-pointer transition-colors group"
                  >
                    {/* Nom + Code */}
                    <td className="px-4 py-3 font-medium">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground group-hover:text-primary transition-colors">
                          {c.name}
                        </span>
                        {c.sensible && (
                          <span className="rounded bg-destructive/15 px-1.5 py-0.2 text-[10px] font-bold text-destructive">
                            Sensible
                          </span>
                        )}
                      </div>
                      {c.code && (
                        <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                          Code : {c.code}
                        </p>
                      )}
                    </td>

                    {/* Ville */}
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {c.ville ? (
                        <span className="flex items-center gap-1 text-xs">
                          <MapPin className="h-3 w-3 text-primary shrink-0" />
                          {c.ville}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>

                    {/* Interlocuteur & Contact */}
                    <td className="px-4 py-3">
                      <div className="text-xs">
                        <p className="font-semibold text-foreground">{c.interlocuteur || '—'}</p>
                        {c.telephone && (
                          <p className="text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
                            {c.telephone}
                          </p>
                        )}
                      </div>
                    </td>

                    {/* Clé */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {hasRealKey(c.cle) ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-bold text-amber-600 dark:text-amber-400">
                          <Key className="h-3 w-3" />
                          {c.cle}
                        </span>
                      ) : c.cle ? (
                        <span className="text-xs text-muted-foreground italic">{c.cle}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>

                    {/* Qualité */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {c.stars ? (
                        <span className="inline-block rounded-md bg-muted px-2 py-0.5 text-xs font-extrabold text-foreground">
                          {c.stars}
                        </span>
                      ) : c.c1 ? (
                        <span className="text-xs font-semibold text-muted-foreground">{c.c1}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>

                    {/* Boutons actions */}
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRowClick(c);
                          }}
                          className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-xs font-bold text-primary hover:bg-primary/20 transition-colors shadow-2xs"
                          title="Modifier la fiche chantier"
                        >
                          <Pencil className="h-3 w-3" />
                          <span className="hidden sm:inline">Modifier</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleOpenMondayCard(e, c.id)}
                          className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                          title="Ouvrir la fiche latérale Monday"
                        >
                          <ExternalLink className="h-3 w-3 text-primary" />
                          <span className="hidden sm:inline">Monday</span>
                        </button>
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* VUE CARTES CALIBRÉE & HAUTEUR FIXE POUR STABILITÉ */
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 min-h-[220px] sm:min-h-[460px] lg:min-h-[675px] content-start">
            {paginatedChantiers.map((c) => (
              <div
                key={c.id}
                onClick={() => handleRowClick(c)}
                className="rounded-xl border border-border bg-card p-4 hover:border-primary/50 hover:shadow-md cursor-pointer transition-all flex flex-col justify-between h-[215px] group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-foreground group-hover:text-primary transition-colors truncate" title={c.name}>
                        {c.name}
                      </h4>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
                        <MapPin className="h-3 w-3 text-primary shrink-0" />
                        <span>{c.ville || 'Ville non spécifiée'}</span>
                      </p>
                    </div>
                    {c.stars ? (
                      <span className="shrink-0 rounded-md bg-amber-500/15 px-2 py-0.5 text-xs font-bold text-amber-600 dark:text-amber-400">
                        {c.stars}
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground opacity-60">
                        Non noté
                      </span>
                    )}
                  </div>

                  <div className="mt-3 space-y-1.5 text-xs">
                    <p className="text-muted-foreground truncate">
                      Code : <span className="font-mono font-semibold text-foreground">{c.code || '—'}</span>
                    </p>
                    <p className="text-muted-foreground truncate">
                      Contact : <span className="font-semibold text-foreground">{c.interlocuteur || '—'}</span>
                    </p>
                    <p className="text-muted-foreground truncate flex items-center gap-1">
                      <Phone className="h-3 w-3 shrink-0 text-muted-foreground/70" />
                      {c.telephone ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{c.telephone}</span>
                      ) : (
                        <span>—</span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="mt-auto pt-3 border-t border-border flex items-center justify-between">
                  <div>
                    {hasRealKey(c.cle) ? (
                      <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-2 py-0.5 text-xs font-bold text-amber-600 dark:text-amber-400">
                        <Key className="h-3 w-3" />
                        {c.cle}
                      </span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground italic">{c.cle || 'Sans clé'}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRowClick(c);
                      }}
                      className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary hover:bg-primary/20 transition-colors shadow-2xs"
                      title="Consulter et modifier la fiche chantier"
                    >
                      <Pencil className="h-3 w-3" />
                      <span>Fiche</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleOpenMondayCard(e, c.id)}
                      className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary px-2 py-1 text-xs font-semibold text-secondary-foreground hover:bg-secondary/80 transition-colors shadow-2xs"
                      title="Ouvrir dans Monday.com"
                    >
                      <ExternalLink className="h-3 w-3 text-primary" />
                      <span className="hidden sm:inline">Monday</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground">
                Affichage de <span className="font-semibold text-foreground">{(page - 1) * PAGE_SIZE + 1}</span> à{' '}
                <span className="font-semibold text-foreground">{Math.min(page * PAGE_SIZE, filteredChantiers.length)}</span> sur{' '}
                <span className="font-semibold text-foreground">{filteredChantiers.length}</span> chantiers
              </p>

              <div className="flex items-center gap-1 self-center sm:self-auto">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Précédent
                </button>

                <div className="flex items-center gap-1">
                  {paginationItems.map((item, idx) => {
                    if (typeof item === 'string') {
                      return (
                        <span
                          key={`ellipsis-${idx}`}
                          className="flex h-7 w-6 items-center justify-center text-xs font-bold text-muted-foreground select-none"
                        >
                          ...
                        </span>
                      );
                    }
                    const pNum = item;
                    return (
                      <button
                        key={pNum}
                        type="button"
                        onClick={() => setPage(pNum)}
                        className={cn(
                          'h-7 w-7 rounded-lg text-xs font-bold transition-all',
                          page === pNum
                            ? 'bg-primary text-primary-foreground shadow-xs'
                            : 'border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
                        )}
                      >
                        {pNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Suivant
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modale de fiche complète */}
      <ChantierDetailModal
        chantier={activeChantier}
        open={modalOpen}
        onOpenChange={setModalOpen}
        onChantierUpdated={handleChantierUpdated}
      />
    </div>
  );
}

