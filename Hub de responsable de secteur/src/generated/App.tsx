import { useEffect, useState } from 'react';
import { Building2, ClipboardList, HelpCircle, Package, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Toaster } from '@components/ui/sonner';
import AlertsCenter from '@generated/components/AlertsCenter';
import VisitsSection from '@generated/components/VisitsSection';
import EconomyStats from '@generated/components/EconomyStats';
import InventorySpace from '@generated/components/InventorySpace';
import ChantiersSpace from '@generated/components/ChantiersSpace';
import QuickFormsSection from '@generated/components/QuickFormsSection';
import DevRulesModal from '@generated/components/DevRulesModal';
import { callMondayApi, clearBoardCache, monday } from '@api/BoardSDK';
import { cn } from '@lib/utils';

const PROFILES = {
  Emilie: { fullName: 'Emilie Tobie', initials: 'ET' },
  Ketty: { fullName: 'Ketty Paulin', initials: 'KP' },
  Natacha: { fullName: 'Natacha Thomas', initials: 'NT' },
  Andre: { fullName: 'André Levesque', initials: 'AL' },
} as const;

type ProfileKey = keyof typeof PROFILES;
const LOGO = 'https://files-public.monday.com/euc1/4853404b-84ea-4006-aab2-0e6de2c4dfdb/Facility-logo_couleur01.svg';

export default function App() {
  const [currentUser, setCurrentUser] = useState<ProfileKey>('Emilie');
  const [ecoKey, setEcoKey] = useState(0);
  const [globalKey, setGlobalKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [loadBottom, setLoadBottom] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);

  useEffect(() => {
    // Détection automatique de l'utilisateur connecté via monday SDK context ou Query.me
    monday.get('context').then((res: any) => {
      const user = res?.data?.user;
      if (user?.name) {
        const norm = String(user.name).toLowerCase();
        if (norm.includes('ketty')) setCurrentUser('Ketty');
        else if (norm.includes('emilie') || norm.includes('émilie')) setCurrentUser('Emilie');
        else if (norm.includes('natacha')) setCurrentUser('Natacha');
        else if (norm.includes('andre') || norm.includes('andré')) setCurrentUser('Andre');
        return;
      }
      callMondayApi('query { me { name email } }')
        .then((apiRes) => {
          const name = (apiRes?.data?.me?.name || apiRes?.me?.name || '').trim();
          const norm = name.toLowerCase();
          if (norm.includes('ketty')) setCurrentUser('Ketty');
          else if (norm.includes('emilie') || norm.includes('émilie')) setCurrentUser('Emilie');
          else if (norm.includes('natacha')) setCurrentUser('Natacha');
          else if (norm.includes('andre') || norm.includes('andré')) setCurrentUser('Andre');
        })
        .catch(() => {});
    }).catch(() => {});
  }, []);

  useEffect(() => {
    // Priorité absolue au haut de l'écran : les alertes, graphiques et visites se chargent d'abord
    setLoadBottom(false);
    const timer = setTimeout(() => {
      setLoadBottom(true);
    }, 350);
    return () => clearTimeout(timer);
  }, [currentUser, globalKey]);

  const handleManualRefresh = () => {
    setRefreshing(true);
    clearBoardCache();
    setGlobalKey((k) => k + 1);
    setEcoKey((k) => k + 1);
    toast.success('Données rafraîchies');
    setTimeout(() => setRefreshing(false), 600);
  };

  const hubName = currentUser;
  const fullName = PROFILES[currentUser].fullName;
  const initials = PROFILES[currentUser].initials;

  return (
    <div key={globalKey} className="relative min-h-screen overflow-x-clip bg-background text-foreground">
      <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rotate-12 rounded-[40%] bg-primary/80" />
      <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-72 w-72 rounded-full border-2 border-[hsl(var(--brand-orange))]/40" />

      <header className="relative border-b border-border bg-card/90 backdrop-blur sticky top-0 z-20">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-sm font-bold text-secondary-foreground shadow-sm">
              {initials}
            </div>
            <div className="leading-tight">
              <p className="font-[family-name:var(--font-heading)] text-sm font-bold">{fullName}</p>
              <p className="text-xs font-semibold text-primary/80">Hub Responsable de secteur</p>
            </div>

            {/* Sélecteur de profil rapide pour tester ou pour l'administrateur */}
            <div className="hidden sm:flex items-center gap-1 ml-4 border-l border-border pl-4">
              {(['Natacha', 'Emilie', 'Ketty'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setCurrentUser(p)}
                  className={cn(
                    'rounded-full px-2.5 py-0.5 text-xs font-semibold transition-all',
                    currentUser === p
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                  title={`Voir la vue de ${p}`}
                >
                  {p}
                </button>
              ))}

              {/* Bouton Règles & Filtres pour le développeur / admin */}
              <button
                type="button"
                onClick={() => setRulesOpen(true)}
                className="ml-2 inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-0.5 text-xs font-semibold text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                title="Détail technique des filtres et calculs Monday"
              >
                <HelpCircle className="h-3 w-3" />
                <span>Règles &amp; Filtres</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold hover:bg-muted transition-colors disabled:opacity-50"
              title="Forcer la mise à jour des données depuis Monday"
            >
              <RotateCcw className={cn('h-3.5 w-3.5 text-primary', refreshing && 'animate-spin')} />
              <span className="hidden sm:inline">Actualiser</span>
            </button>
            <img src={LOGO} alt="Groupe Facility" className="h-10 w-auto max-w-[40%] object-contain sm:h-12" />
          </div>
        </div>
      </header>
      <AlertsCenter firstName={hubName} />

      <main className="relative mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
        <h1 className="text-4xl font-extrabold uppercase tracking-tight sm:text-5xl">Hub de {hubName}</h1>
        <div className="mt-3 h-1 w-24 rounded-full bg-[hsl(var(--brand-blue))]" />
        <p className="mt-4 max-w-xl text-base font-semibold italic text-primary">
          Vos informations chantiers, à portée de main.
        </p>

        {/* Section 0 : Actions & Formulaires Rapides */}
        <div className="mt-8">
          <QuickFormsSection />
        </div>

        {/* Section 1 : Suivi des visites & Qualité */}
        <div className="mt-14">
          <VisitsSection firstName={hubName} />
        </div>

        {/* Section 2 : Tableau complet chantier (Nouvel espace complet) */}
        <section id="chantiers" className="mt-16 scroll-mt-20">
          <h2 className="text-2xl font-extrabold uppercase tracking-tight sm:text-3xl">Tableau complet chantier</h2>
          <div className="mt-2 h-1 w-16 rounded-full bg-[hsl(var(--brand-orange))]" />
          <div className="mt-6">
            <ChantiersSpace firstName={hubName} />
          </div>
        </section>

        {/* Section 3 : Stocks, économies & Inventaires */}
        <section id="inventaire" className="mt-16 scroll-mt-20">
          <h2 className="text-2xl font-extrabold uppercase tracking-tight sm:text-3xl">Stocks, économies &amp; inventaires</h2>
          <div className="mt-2 h-1 w-16 rounded-full bg-[hsl(var(--brand-blue))]" />
          {loadBottom ? (
            <EconomyStats firstName={hubName} refreshKey={ecoKey} />
          ) : (
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="h-32 animate-pulse rounded-[var(--radius-md)] bg-card border border-border" />
              <div className="h-32 animate-pulse rounded-[var(--radius-md)] bg-card border border-border" />
            </div>
          )}
        </section>

        <section className="mt-12">
          {loadBottom ? (
            <InventorySpace firstName={hubName} onInventoryValidated={() => setEcoKey((k) => k + 1)} />
          ) : (
            <div className="h-48 animate-pulse rounded-[var(--radius-md)] bg-card border border-border" />
          )}
        </section>
      </main>
      <DevRulesModal open={rulesOpen} onOpenChange={setRulesOpen} />
      <Toaster />
    </div>
  );
}
