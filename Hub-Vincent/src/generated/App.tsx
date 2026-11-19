import { useEffect } from 'react';
import mondaySdk from 'monday-sdk-js';
import { Toaster } from 'sonner';
import VehiclesCard from '@generated/components/VehiclesCard';
import DirectionCard from '@generated/components/DirectionCard';
import { loadCost } from '@generated/components/ChargemapCost';
import { getFleetStats } from '@generated/server/fleet';

const monday = mondaySdk();
const LOGO = 'https://files-public.monday.com/euc1/4853404b-84ea-4006-aab2-0e6de2c4dfdb/Facility-logo_couleur01.svg';

export default function App() {
  useEffect(() => {
    try {
      monday.listen('context', (_res: any) => {});
      monday.execute('valueCreatedForUser');
    } catch {
      // ignore
    }
    // Pré-chargement silencieux en arrière-plan dès l'ouverture du Hub
    getFleetStats({}).catch(() => {});
    loadCost('carburant').catch(() => {});
    loadCost('chargemap').catch(() => {});
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rotate-12 rounded-[40%] bg-primary/80" />
      <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-72 w-72 rounded-full border-2 border-[hsl(var(--brand-orange))]/40" />

      <header className="relative border-b border-border bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-sm font-bold text-secondary-foreground">VR</div>
            <div className="min-w-0 leading-tight">
              <p className="font-[family-name:var(--font-heading)] text-sm font-bold">Vincent Rivière</p>
              <p className="text-xs text-muted-foreground">Hub personnel</p>
            </div>
          </div>
          <img src={LOGO} alt="Groupe Facility" className="h-12 w-auto max-w-[40%] object-contain sm:h-14" />
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-4 py-10 sm:px-8 sm:py-14">
        <h1 className="text-4xl font-extrabold uppercase tracking-tight sm:text-5xl">Hub de Vincent</h1>
        <div className="mt-3 h-1 w-24 rounded-full bg-[hsl(var(--brand-blue))]" />
        <p className="mt-4 max-w-xl text-base font-semibold italic text-primary">
          Vos informations chantiers, à portée de main.
        </p>
        <section className="mt-12">
          <VehiclesCard />
        </section>
        <section className="mt-14">
          <DirectionCard />
        </section>
      </main>
      <Toaster richColors position="bottom-right" />
    </div>
  );
}
