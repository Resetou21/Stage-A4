import { useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Toaster } from '@components/ui/sonner';
import AlertsCenter from '@generated/components/AlertsCenter';
import VisitsSection from '@generated/components/VisitsSection';
import EconomyStats from '@generated/components/EconomyStats';
import InventorySpace from '@generated/components/InventorySpace';
import ChantiersSpace from '@generated/components/ChantiersSpace';
import QuickFormsSection from '@generated/components/QuickFormsSection';
import AtelierCommunicationSpace from '@generated/components/AtelierCommunicationSpace';
import AccompagnementWhatsAppSpace from '@generated/components/AccompagnementWhatsAppSpace';
import { callMondayApi, clearBoardCache, monday } from '@api/BoardSDK';
import { clearChantiersListCache } from '@generated/server/chantiers';
import { clearVisitsOverviewCache } from '@generated/server/visits';
import { clearInventoryCaches } from '@generated/server/inventory';
import { cn } from '@lib/utils';

const PROFILES = {
  Emilie: { fullName: 'Emilie Tobie', initials: 'ET' },
  Ketty: { fullName: 'Ketty Paulin', initials: 'KP' },
  Natacha: { fullName: 'Natacha Thomas', initials: 'NT' },
} as const;

type ProfileKey = keyof typeof PROFILES;
const LOGO = 'https://files-public.monday.com/euc1/4853404b-84ea-4006-aab2-0e6de2c4dfdb/Facility-logo_couleur01.svg';

// Mapping direct et infaillible des identifiants Monday
const USER_ID_MAP: Record<string, ProfileKey> = {
  '87318933': 'Emilie',
  '87318941': 'Natacha',
  '76526955': 'Ketty',
};

// Utilisateurs administrateurs / superviseurs autorisés à basculer entre tous les secteurs
const ADMIN_USER_IDS = ['118562356', '76526870']; // Guillaume Daniel, Laurent GUILLOU

// Lecture éventuelle du secteur forcé par le Hub Global (?animatrice=Natacha / ?profile=Ketty)
function getUrlProfile(): ProfileKey | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = (params.get('animatrice') || params.get('profile') || '').trim().toLowerCase();
    if (raw.includes('natacha')) return 'Natacha';
    if (raw.includes('ketty')) return 'Ketty';
    if (raw.includes('emilie') || raw.includes('émilie')) return 'Emilie';
  } catch {}
  return null;
}

export default function App() {
  const urlProfile = getUrlProfile();
  const [currentUser, setCurrentUser] = useState<ProfileKey>(urlProfile ?? 'Emilie');
  const [userDetected, setUserDetected] = useState<boolean>(Boolean(urlProfile));
  const [ecoKey, setEcoKey] = useState(0);
  const [globalKey, setGlobalKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [loadBottom, setLoadBottom] = useState(false);

  useEffect(() => {
    // Si le Hub Global a déjà transmis ?animatrice=..., on respecte directement ce secteur sans écraser par le profil admin
    if (urlProfile) {
      setCurrentUser(urlProfile);
      setUserDetected(true);
      return;
    }

    let resolved = false;

    const identifyUser = (uid: string, name: string, email: string) => {
      if (resolved && !uid && !name && !email) return;

      const normName = name.toLowerCase().trim();
      const normEmail = email.toLowerCase().trim();

      // 1. Détection Administrateur / Superviseur
      if (
        ADMIN_USER_IDS.includes(uid) ||
        normEmail.includes('guillaume') ||
        normName.includes('guillaume') ||
        normEmail.includes('lguillou') ||
        normName.includes('laurent guillou') ||
        normName.includes('laurent') ||
        normName.includes('admin')
      ) {
        setUserDetected(true);
        resolved = true;
        return;
      }

      // 2. Détection par ID Monday
      if (uid && USER_ID_MAP[uid]) {
        setCurrentUser(USER_ID_MAP[uid]);
        setUserDetected(true);
        resolved = true;
        return;
      }

      // 3. Détection par Email officiel
      if (normEmail.includes('kpaulin')) {
        setCurrentUser('Ketty');
        setUserDetected(true);
        resolved = true;
        return;
      }
      if (normEmail.includes('etobie')) {
        setCurrentUser('Emilie');
        setUserDetected(true);
        resolved = true;
        return;
      }
      if (normEmail.includes('nthomas')) {
        setCurrentUser('Natacha');
        setUserDetected(true);
        resolved = true;
        return;
      }

      // 4. Détection par Prénom / Nom dans Monday
      if (normName.includes('ketty')) {
        setCurrentUser('Ketty');
        setUserDetected(true);
        resolved = true;
        return;
      }
      if (normName.includes('emilie') || normName.includes('émilie')) {
        setCurrentUser('Emilie');
        setUserDetected(true);
        resolved = true;
        return;
      }
      if (normName.includes('natacha')) {
        setCurrentUser('Natacha');
        setUserDetected(true);
        resolved = true;
        return;
      }

      // Par défaut
      setUserDetected(true);
    };

    // Écoute temps-réel du contexte Monday SDK
    const unsubscribe = monday.listen('context', (res: any) => {
      const user = res?.data?.user;
      const uid = String(user?.id || res?.data?.userId || '');
      if (uid) {
        identifyUser(uid, user?.name || '', user?.email || '');
      }
    });

    // Requête contextuelle immédiate ; requête GraphQL `me` uniquement en secours si le contexte SDK ne suffit pas
    let meRequested = false;
    const runMeFallback = () => {
      if (resolved || meRequested) return;
      meRequested = true;
      callMondayApi('query { me { id name email } }')
        .then((apiRes) => {
          const me = apiRes?.data?.me || apiRes?.me;
          if (me) {
            identifyUser(String(me.id || ''), me.name || '', me.email || '');
          } else {
            setUserDetected(true);
          }
        })
        .catch((err) => {
          console.warn('[App] Erreur me query fallback:', err);
          setUserDetected(true);
        });
    };

    monday.get('context').then((res: any) => {
      const user = res?.data?.user;
      const uid = String(user?.id || res?.data?.userId || '');
      if (uid) {
        identifyUser(uid, user?.name || '', user?.email || '');
      }
      if (!resolved) {
        runMeFallback();
      }
    }).catch(() => {
      runMeFallback();
    });

    // Sécurité si le contexte SDK tarde dans une iframe imbriquée : déclenche `me` à 500ms avant le timeout de 1.5s
    const meTimer = setTimeout(runMeFallback, 500);

    // Sécurité anti-blocage immédiate : si après 1.5s le profil n'a pas répondu (ex: iframe imbriquée ou latence)
    const fallbackTimer = setTimeout(() => {
      if (!resolved) {
        console.warn('[App] Timeout détection utilisateur (1.5s) -> passage en mode actif');
        setUserDetected(true);
      }
    }, 1500);

    return () => {
      clearTimeout(fallbackTimer);
      clearTimeout(meTimer);
      if (typeof unsubscribe === 'function') {
        try { (unsubscribe as any)(); } catch {}
      }
    };
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
    clearChantiersListCache();
    clearVisitsOverviewCache();
    clearInventoryCaches();
    setGlobalKey((k) => k + 1);
    setEcoKey((k) => k + 1);
    toast.success('Données rafraîchies');
    setTimeout(() => setRefreshing(false), 600);
  };

  const hubName = currentUser;
  const fullName = PROFILES[currentUser].fullName;
  const initials = PROFILES[currentUser].initials;

  if (!userDetected) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <RotateCcw className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-semibold text-muted-foreground">Identification de votre profil...</p>
        </div>
      </div>
    );
  }

  return (
    <div key={globalKey} className="relative min-h-screen overflow-x-clip bg-background text-foreground">
      <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rotate-12 rounded-[40%] bg-primary/80" />
      <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-72 w-72 rounded-full border-2 border-[hsl(var(--brand-orange))]/40" />

      <header className="relative border-b border-border bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-3 py-2.5 sm:px-8 sm:py-3">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-bold text-secondary-foreground shadow-sm">
              {initials}
            </div>
            <div className="leading-tight min-w-0">
              <p className="font-[family-name:var(--font-heading)] text-sm font-bold truncate">{fullName}</p>
              <p className="text-xs font-semibold text-primary/80 truncate">Hub Responsable de secteur</p>
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

      <main className="relative mx-auto max-w-6xl px-3 py-6 pb-28 sm:px-8 sm:py-12">
        <h1 className="text-2xl sm:text-4xl font-extrabold uppercase tracking-tight">Hub de {hubName}</h1>
        <div className="mt-2 h-1 w-20 rounded-full bg-[hsl(var(--brand-blue))]" />
        <p className="mt-2 sm:mt-4 max-w-xl text-sm sm:text-base font-semibold italic text-primary">
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

        {/* Section 4 : Matériel & Atelier (Communication Christophe) */}
        <section id="atelier" className="mt-16 scroll-mt-20">
          <h2 className="text-2xl font-extrabold uppercase tracking-tight sm:text-3xl">Matériel &amp; Atelier</h2>
          <div className="mt-2 h-1 w-16 rounded-full bg-[hsl(var(--brand-orange))]" />
          <div className="mt-6">
            <AtelierCommunicationSpace firstName={hubName} />
          </div>
        </section>

        {/* Section 5 : Accompagnement Salariés & WhatsApp (Pole RH) */}
        <section id="accompagnement" className="mt-16 scroll-mt-20">
          <h2 className="text-2xl font-extrabold uppercase tracking-tight sm:text-3xl">Accompagnement Salariés &amp; WhatsApp</h2>
          <div className="mt-2 h-1 w-16 rounded-full bg-emerald-500" />
          <div className="mt-6">
            <AccompagnementWhatsAppSpace firstName={hubName} />
          </div>
        </section>
      </main>
      <Toaster />
    </div>
  );
}
