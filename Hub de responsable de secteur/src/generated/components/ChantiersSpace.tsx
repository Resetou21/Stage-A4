import { useEffect, useMemo, useState } from 'react';
import { 
  Building2, 
  Search, 
  MapPin, 
  Phone, 
  Key, 
  ExternalLink, 
  ChevronRight, 
  ChevronLeft,
  Filter, 
  Sun, 
  Frown, 
  LayoutGrid, 
  List,
  Sparkles,
  Pencil,
  Copy,
  Mail,
  User,
  Calendar,
  Navigation
} from 'lucide-react';
import { toast } from 'sonner';
import { getChantiersList, hasRealKey, type ChantierItem } from '@generated/server/chantiers';
import { monday } from '@api/BoardSDK';
import ChantierDetailModal from '@generated/components/ChantierDetailModal';
import { cn } from '@lib/utils';

function splitMulti(val: string | null | undefined): string[] {
  if (!val) return [];
  return val
    .split(/[,;/]|\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  try {
    const date = new Date(d);
    if (Number.isNaN(date.getTime())) return d;
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return d;
  }
}

function formatAddress(c: ChantierItem): string {
  return [c.adresse, c.codePostal, c.ville].filter(Boolean).join(', ');
}

function getMapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

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

  const handleCopy = (e: React.MouseEvent, text: string, label: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    toast.success(`${label} copié !`, { duration: 2500 });
  };

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

        {/* Switcher de vue & Pagination rapide en haut */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {viewMode === 'cards' && totalPages > 1 && (
            <div className="flex items-center gap-1 rounded-lg border border-border bg-card px-2 py-1 text-xs shadow-2xs">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                title="Page précédente"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span className="font-semibold text-foreground px-1 select-none text-xs">
                Page {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                title="Page suivante"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-1">
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
      ) : chantiers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-amber-500/40 p-8 text-center bg-amber-500/5">
          <Building2 className="mx-auto h-8 w-8 text-amber-500 opacity-80" />
          <p className="mt-2 text-sm font-bold text-foreground">Aucun chantier chargé pour {firstName}</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
            Si vous utilisez ce widget sur un tableau de bord Monday, assurez-vous que le <strong>Tableau complet chantier</strong> est bien coché dans <strong>« Tableaux connectés »</strong> tout en haut du tableau de bord.
          </p>
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
          <div className="max-h-[38rem] overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 z-10 bg-muted/90 backdrop-blur-xs text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border shadow-2xs">
                <tr>
                  <th className="px-4 py-3 min-w-[220px]">Chantier &amp; Adresse</th>
                  <th className="px-4 py-3 min-w-[240px]">Interlocuteurs &amp; Contacts</th>
                  <th className="px-4 py-3 min-w-[140px]">Clé &amp; Accès</th>
                  <th className="px-4 py-3 min-w-[170px]">Qualité &amp; Contrôles</th>
                  <th className="px-4 py-3 text-right min-w-[160px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredChantiers.map((c) => {
                  const fullAddr = formatAddress(c);
                  const interlocuteurs = splitMulti(c.interlocuteur);
                  const phones = splitMulti(c.telephone);
                  const emails = splitMulti(c.email);

                  return (
                    <tr
                      key={c.id}
                      onClick={() => handleRowClick(c)}
                      className="hover:bg-muted/40 cursor-pointer transition-colors group"
                    >
                      {/* Chantier + Code + Adresse */}
                      <td className="px-4 py-3 font-medium">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-foreground group-hover:text-primary transition-colors text-sm">
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
                        {fullAddr ? (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1 group-hover:text-foreground transition-colors">
                            <MapPin className="h-3 w-3 text-primary shrink-0" />
                            <span className="break-words">{fullAddr}</span>
                            <button
                              type="button"
                              onClick={(e) => handleCopy(e, fullAddr, 'Adresse')}
                              className="text-muted-foreground hover:text-foreground p-0.5 shrink-0"
                              title="Copier l'adresse"
                            >
                              <Copy className="h-2.5 w-2.5" />
                            </button>
                            <a
                              href={getMapsUrl(fullAddr)}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-primary hover:text-primary/70 p-0.5 shrink-0"
                              title="Ouvrir dans Google Maps"
                            >
                              <Navigation className="h-2.5 w-2.5" />
                            </a>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground italic mt-0.5">Adresse non spécifiée</p>
                        )}
                      </td>

                      {/* Interlocuteur(s) & Contact(s) */}
                      <td className="px-4 py-3">
                        {(() => {
                          const mainCount = interlocuteurs.length > 0 ? interlocuteurs.length : Math.max(phones.length, emails.length);
                          const pairedList = [];
                          for (let i = 0; i < mainCount; i++) {
                            pairedList.push({
                              name: interlocuteurs[i] || (mainCount === 1 ? 'Contact principal' : `Contact #${i + 1}`),
                              phone: phones[i] || null,
                            });
                          }

                          return (
                            <div className="space-y-1.5 text-xs max-w-[280px]">
                              {pairedList.length > 0 ? (
                                <div className="space-y-1">
                                  {pairedList.map((contact, idx) => (
                                    <div key={idx} className="flex items-center justify-between gap-2">
                                      <span className="font-semibold text-foreground truncate max-w-[140px]" title={contact.name}>
                                        {contact.name}
                                      </span>
                                      {contact.phone && (
                                        <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.2 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">
                                          <a
                                            href={`tel:${contact.phone.replace(/\s+/g, '')}`}
                                            onClick={(e) => e.stopPropagation()}
                                            className="hover:underline font-mono"
                                            title="Appeler"
                                          >
                                            {contact.phone}
                                          </a>
                                          <button
                                            type="button"
                                            onClick={(e) => handleCopy(e, contact.phone!, 'Numéro')}
                                            className="text-emerald-700 dark:text-emerald-300 hover:text-emerald-900 cursor-pointer"
                                            title="Copier ce numéro"
                                          >
                                            <Copy className="h-2 w-2" />
                                          </button>
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-muted-foreground italic">—</p>
                              )}

                              {/* Emails */}
                              {emails.length > 0 && (
                                <div className="flex items-center gap-1.5 pt-0.5 border-t border-border/40">
                                  <Mail className="h-3 w-3 text-primary shrink-0" />
                                  <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.2 text-[11px] font-semibold text-primary max-w-[180px]">
                                    <a
                                      href={`mailto:${emails[0]}`}
                                      onClick={(e) => e.stopPropagation()}
                                      className="hover:underline truncate"
                                      title={emails[0]}
                                    >
                                      {emails[0]}
                                    </a>
                                    <button
                                      type="button"
                                      onClick={(e) => handleCopy(e, emails[0], 'Email')}
                                      className="text-primary hover:text-primary/70 shrink-0 cursor-pointer"
                                      title="Copier cet email"
                                    >
                                      <Copy className="h-2 w-2" />
                                    </button>
                                  </span>
                                  {emails.length > 1 && (
                                    <span
                                      className="text-[10px] font-bold text-primary bg-primary/15 rounded px-1 py-0.2 shrink-0 cursor-pointer"
                                      title={emails.slice(1).join(', ')}
                                    >
                                      +{emails.length - 1}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })()}
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
                        {hasRealKey(c.doubleCle) && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            Double : {c.doubleCle}
                          </p>
                        )}
                      </td>

                      {/* Qualité & Contrôles */}
                      <td className="px-4 py-3">
                        <div className="space-y-1 text-xs">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {c.stars ? (
                              <span className="inline-block rounded-md bg-amber-500/15 px-2 py-0.5 text-xs font-black text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                {c.stars}
                              </span>
                            ) : (
                              <span className="text-xs font-medium text-muted-foreground">Non noté</span>
                            )}
                            <span
                              className={`rounded px-1.5 py-0.2 text-[10px] font-bold border ${
                                c.visites12MoisCount > 0
                                  ? 'bg-primary/10 text-primary border-primary/25'
                                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25'
                              }`}
                              title={
                                c.visites12MoisDates.length > 0
                                  ? `Visites sur les 12 derniers mois :\n${c.visites12MoisDates.map(fmtDate).join('\n')}`
                                  : 'Aucune visite sur 12 mois'
                              }
                            >
                              {c.visites12MoisCount} vis./12m
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-2.5 w-2.5 text-primary shrink-0" />
                            <span>Dernier : {fmtDate(c.dernierControle)}</span>
                          </p>
                          <div className="flex items-center gap-1 text-[10px]">
                            <span
                              className={cn(
                                'rounded px-1 font-bold',
                                c.c1 === 'Globalement bon'
                                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                  : c.c1
                                  ? 'bg-destructive/15 text-destructive'
                                  : 'bg-muted text-muted-foreground'
                              )}
                              title={`C1 : ${c.c1 || 'Non noté'}`}
                            >
                              C1: {c.c1 ? (c.c1 === 'Globalement bon' ? 'Bon' : 'NC') : '—'}
                            </span>
                            <span
                              className={cn(
                                'rounded px-1 font-bold',
                                c.c2 === 'Globalement bon'
                                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                  : c.c2
                                  ? 'bg-destructive/15 text-destructive'
                                  : 'bg-muted text-muted-foreground'
                              )}
                              title={`C2 : ${c.c2 || 'Non noté'}`}
                            >
                              C2: {c.c2 ? (c.c2 === 'Globalement bon' ? 'Bon' : 'NC') : '—'}
                            </span>
                            <span
                              className={cn(
                                'rounded px-1 font-bold',
                                c.c3 === 'Globalement bon'
                                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                  : c.c3
                                  ? 'bg-destructive/15 text-destructive'
                                  : 'bg-muted text-muted-foreground'
                              )}
                              title={`C3 : ${c.c3 || 'Non noté'}`}
                            >
                              C3: {c.c3 ? (c.c3 === 'Globalement bon' ? 'Bon' : 'NC') : '—'}
                            </span>
                          </div>
                        </div>
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
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* VUE CARTES CALIBRÉE & ADAPTATIVE SMART RESPONSIVE */
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 content-start min-h-[580px] md:min-h-[850px] xl:min-h-[1030px]">
            {paginatedChantiers.map((c) => {
              const fullAddr = formatAddress(c);
              const interlocuteurs = splitMulti(c.interlocuteur);
              const phones = splitMulti(c.telephone);
              const emails = splitMulti(c.email);

              return (
                <div
                  key={c.id}
                  onClick={() => handleRowClick(c)}
                  className="rounded-2xl border border-border bg-card p-4 hover:border-primary/50 hover:shadow-md cursor-pointer transition-all flex flex-col justify-between group min-h-[325px] h-full"
                >
                  <div className="space-y-3">
                    {/* Header : Nom + Badges + Etoiles (min-h-[44px] pour alignement parfait) */}
                    <div className="flex items-start justify-between gap-2 min-h-[44px]">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-bold text-foreground group-hover:text-primary transition-colors text-sm break-words leading-snug">
                            {c.name}
                          </h4>
                          {c.sensible && (
                            <span className="rounded bg-destructive/15 px-1.5 py-0.5 text-[10px] font-bold text-destructive shrink-0">
                              Sensible
                            </span>
                          )}
                        </div>
                        {c.code && (
                          <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">
                            Code : <span className="font-semibold text-foreground">{c.code}</span>
                          </p>
                        )}
                      </div>

                      <div className="shrink-0">
                        {c.stars ? (
                          <span className="rounded-lg bg-amber-500/15 px-2.5 py-1 text-xs font-black text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-2xs">
                            {c.stars}
                          </span>
                        ) : (
                          <span className="rounded-lg bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground opacity-60">
                            Non noté
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Adresse complète (min-h-[54px] pour alignement entre 1 et 2 lignes) */}
                    <div className="min-h-[54px] flex items-center">
                      {fullAddr ? (
                        <div className="w-full rounded-lg border border-border/60 bg-muted/30 p-2.5 text-xs flex items-start justify-between gap-2 min-h-[52px]">
                          <div className="flex items-start gap-1.5 min-w-0 flex-1">
                            <MapPin className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                            <span className="text-foreground font-medium text-xs break-words leading-relaxed">
                              {fullAddr}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => handleCopy(e, fullAddr, 'Adresse')}
                              className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                              title="Copier l'adresse complète"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                            <a
                              href={getMapsUrl(fullAddr)}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="rounded p-1 text-primary hover:bg-primary/10 transition-colors"
                              title="Ouvrir dans Google Maps"
                            >
                              <Navigation className="h-3.5 w-3.5" />
                            </a>
                          </div>
                        </div>
                      ) : (
                        <div className="w-full rounded-lg border border-dashed border-border/60 bg-muted/20 p-2.5 text-xs flex items-center gap-1.5 text-muted-foreground/60 italic min-h-[52px]">
                          <MapPin className="h-3.5 w-3.5 shrink-0" />
                          <span>Adresse non renseignée</span>
                        </div>
                      )}
                    </div>

                    {/* Interlocuteurs & Contacts (appariés 1-pour-1, min-h-[96px] pour alignement vertical stable) */}
                    <div className="space-y-1.5 text-xs min-h-[96px] flex flex-col justify-center">
                      {(() => {
                        const mainCount = interlocuteurs.length > 0 ? interlocuteurs.length : Math.max(phones.length, emails.length);
                        const pairedList = [];
                        for (let i = 0; i < mainCount; i++) {
                          pairedList.push({
                            name: interlocuteurs[i] || (mainCount === 1 ? 'Contact principal' : `Contact #${i + 1}`),
                            phone: phones[i] || null,
                          });
                        }

                        if (pairedList.length === 0) {
                          return (
                            <p className="text-muted-foreground flex items-center gap-1.5 text-xs italic">
                              <User className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                              <span>Interlocuteur non renseigné</span>
                            </p>
                          );
                        }

                        return (
                          <div className="space-y-1.5">
                            {/* Jusqu'à 2 contacts appariés affichés directement */}
                            {pairedList.slice(0, 2).map((contact, idx) => (
                              <div key={idx} className="flex items-center justify-between gap-1.5">
                                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                  <User className="h-3 w-3 text-muted-foreground shrink-0" />
                                  <span className="font-bold text-foreground text-xs truncate" title={contact.name}>
                                    {contact.name}
                                  </span>
                                </div>
                                {contact.phone ? (
                                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">
                                    <Phone className="h-2.5 w-2.5 shrink-0" />
                                    <a
                                      href={`tel:${contact.phone.replace(/\s+/g, '')}`}
                                      onClick={(e) => e.stopPropagation()}
                                      className="hover:underline font-mono"
                                      title="Appeler ce numéro"
                                    >
                                      {contact.phone}
                                    </a>
                                    <button
                                      type="button"
                                      onClick={(e) => handleCopy(e, contact.phone!, 'Numéro')}
                                      className="text-emerald-700 dark:text-emerald-300 hover:text-emerald-900 ml-0.5 cursor-pointer"
                                      title="Copier ce numéro"
                                    >
                                      <Copy className="h-2.5 w-2.5" />
                                    </button>
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-muted-foreground/50 italic shrink-0">—</span>
                                )}
                              </div>
                            ))}

                            {/* Indicateur si plus de 2 contacts */}
                            {pairedList.length > 2 && (
                              <p className="text-[10px] font-semibold text-primary/80 pl-4.5 italic">
                                +{pairedList.length - 2} autre contact (voir fiche)
                              </p>
                            )}
                          </div>
                        );
                      })()}

                      {/* Email(s) compacts avec envoi, copie et badge overflow */}
                      {emails.length > 0 && (
                        <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-border/40">
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <Mail className="h-3 w-3 text-primary shrink-0" />
                            <span className="inline-flex items-center gap-1 rounded bg-primary/10 border border-primary/20 px-1.5 py-0.5 text-[11px] font-semibold text-primary max-w-[190px]">
                              <a
                                href={`mailto:${emails[0]}`}
                                onClick={(e) => e.stopPropagation()}
                                className="hover:underline truncate"
                                title={emails[0]}
                              >
                                {emails[0]}
                              </a>
                              <button
                                type="button"
                                onClick={(e) => handleCopy(e, emails[0], 'Email')}
                                className="text-primary hover:text-primary/70 shrink-0 ml-0.5 cursor-pointer"
                                title="Copier cet email"
                              >
                                <Copy className="h-2.5 w-2.5" />
                              </button>
                            </span>
                          </div>
                          {emails.length > 1 && (
                            <span
                              className="text-[10px] font-bold text-primary bg-primary/15 border border-primary/30 rounded px-1.5 py-0.5 shrink-0"
                              title={emails.slice(1).join(', ')}
                            >
                              +{emails.length - 1} autre{emails.length - 1 > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Qualité & Visites sur 12 mois */}
                    <div className="rounded-xl border border-border/70 bg-card p-2.5 text-xs space-y-1.5 min-h-[76px] flex flex-col justify-center">
                      {/* Ligne 1 : Dernier contrôle & Fréquence 12 mois */}
                      <div className="flex items-center justify-between text-[11px] gap-1">
                        <span className="flex items-center gap-1 text-muted-foreground truncate">
                          <Calendar className="h-3 w-3 text-primary shrink-0" />
                          Dernier : <strong className="text-foreground">{fmtDate(c.dernierControle)}</strong>
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-extrabold shrink-0 border ${
                            c.visites12MoisCount > 0
                              ? 'bg-primary/10 text-primary border-primary/25'
                              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25'
                          }`}
                          title={
                            c.visites12MoisDates.length > 0
                              ? `Visites sur les 12 derniers mois :\n${c.visites12MoisDates.map(fmtDate).join('\n')}`
                              : 'Aucune visite répertoriée sur les 12 derniers mois'
                          }
                        >
                          {c.visites12MoisCount} visite{c.visites12MoisCount > 1 ? 's' : ''} / 12 mois
                        </span>
                      </div>

                      {/* Ligne 2 : C1, C2, C3 + mini liste des dates récentes */}
                      <div className="flex items-center justify-between gap-1 text-[10px] pt-0.5 border-t border-border/40">
                        <div className="flex items-center gap-1">
                          <span
                            className={cn(
                              'rounded px-1.5 py-0.2 font-bold',
                              c.c1 === 'Globalement bon'
                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                : c.c1
                                ? 'bg-destructive/15 text-destructive'
                                : 'bg-muted text-muted-foreground'
                            )}
                            title={`C1 : ${c.c1 || 'Non noté'}`}
                          >
                            C1: {c.c1 ? (c.c1 === 'Globalement bon' ? 'Bon' : 'NC') : '—'}
                          </span>
                          <span
                            className={cn(
                              'rounded px-1.5 py-0.2 font-bold',
                              c.c2 === 'Globalement bon'
                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                : c.c2
                                ? 'bg-destructive/15 text-destructive'
                                : 'bg-muted text-muted-foreground'
                            )}
                            title={`C2 : ${c.c2 || 'Non noté'}`}
                          >
                            C2: {c.c2 ? (c.c2 === 'Globalement bon' ? 'Bon' : 'NC') : '—'}
                          </span>
                          <span
                            className={cn(
                              'rounded px-1.5 py-0.2 font-bold',
                              c.c3 === 'Globalement bon'
                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                : c.c3
                                ? 'bg-destructive/15 text-destructive'
                                : 'bg-muted text-muted-foreground'
                            )}
                            title={`C3 : ${c.c3 || 'Non noté'}`}
                          >
                            C3: {c.c3 ? (c.c3 === 'Globalement bon' ? 'Bon' : 'NC') : '—'}
                          </span>
                        </div>

                        {/* Dates récentes sur 12 mois */}
                        {c.visites12MoisDates.length > 0 && (
                          <span
                            className="text-[10px] text-muted-foreground font-medium truncate max-w-[130px] text-right"
                            title={`Passages sur 12 mois : ${c.visites12MoisDates.map(fmtDate).join(', ')}`}
                          >
                            {c.visites12MoisDates.slice(0, 2).map((d) => d.slice(5).replace('-', '/')).join(', ')}
                            {c.visites12MoisDates.length > 2 ? '...' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Pied de carte : Clé & Actions */}
                  <div className="mt-4 pt-3 border-t border-border flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      {hasRealKey(c.cle) ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-xs font-bold text-amber-600 dark:text-amber-400 truncate">
                          <Key className="h-3 w-3 shrink-0" />
                          <span className="truncate">{c.cle}</span>
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground italic truncate block">
                          {c.cle || 'Sans clé'}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRowClick(c);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary hover:bg-primary/20 transition-colors shadow-2xs"
                        title="Consulter et modifier la fiche chantier"
                      >
                        <Pencil className="h-3 w-3" />
                        <span>Fiche</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleOpenMondayCard(e, c.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-border bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground hover:bg-secondary/80 transition-colors shadow-2xs"
                        title="Ouvrir dans Monday.com"
                      >
                        <ExternalLink className="h-3 w-3 text-primary" />
                        <span className="hidden sm:inline">Monday</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
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

