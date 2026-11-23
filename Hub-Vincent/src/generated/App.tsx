import { useEffect, useState } from 'react';
import mondaySdk from 'monday-sdk-js';
import { Toaster, toast } from 'sonner';
import { RotateCw } from 'lucide-react';
import VehiclesCard from '@generated/components/VehiclesCard';
import DirectionCard from '@generated/components/DirectionCard';
import { clearTopCache } from '@generated/components/TopVehicles';
import { clearVehicleDashboardCache } from '@generated/server/vehicleDashboard';
import { clearBoardCache } from '@api/mondayApi';

const monday = mondaySdk();
const LOGO = 'https://files-public.monday.com/euc1/4853404b-84ea-4006-aab2-0e6de2c4dfdb/Facility-logo_couleur01.svg';

export default function App() {
  const [lastSync, setLastSync] = useState(() =>
    new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  );
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    try {
      monday.listen('context', (_res: any) => {});
      monday.execute('valueCreatedForUser');
    } catch {
      // ignore
    }
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      clearBoardCache();
      clearTopCache();
      clearVehicleDashboardCache();
      try {
        localStorage.removeItem('hub_vincent_cost_chargemap');
        localStorage.removeItem('hub_vincent_cost_carburant');
        localStorage.removeItem('hub_vincent_fixed_charges_status_v1');
      } catch {}

      setRefreshKey((k) => k + 1);
      setLastSync(new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
      toast.success('Données Monday.com actualisées en direct !');
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de l’actualisation.');
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rotate-12 rounded-[40%] bg-primary/80" />
      <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-72 w-72 rounded-full border-2 border-[hsl(var(--brand-orange))]/40" />

      <header className="relative border-b border-border bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-sm font-bold text-secondary-foreground">
              VR
            </div>
            <div className="min-w-0 leading-tight">
              <p className="font-[family-name:var(--font-heading)] text-sm font-bold">Vincent Rivière</p>
              <p className="text-xs text-muted-foreground">Hub personnel</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-muted-foreground bg-muted/60 px-3 py-1.5 rounded-full border border-border/60">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>Synchronisé à {lastSync}</span>
              </div>

              <button
                type="button"
                onClick={handleRefresh}
                disabled={refreshing}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3.5 py-1.5 text-xs font-bold text-foreground transition hover:bg-muted shadow-xs disabled:opacity-60 cursor-pointer"
                title="Actualiser les données en direct depuis Monday.com"
              >
                <RotateCw className={`h-3.5 w-3.5 text-primary ${refreshing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Actualiser</span>
              </button>
            </div>

            <img src={LOGO} alt="Groupe Facility" className="h-9 w-auto max-w-[35%] object-contain sm:h-12" />
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-7xl px-4 py-8 pb-28 sm:px-8 sm:py-14">
        <h1 className="text-3xl font-extrabold uppercase tracking-tight sm:text-5xl">Hub de Vincent</h1>
        <div className="mt-3 h-1 w-24 rounded-full bg-[hsl(var(--brand-blue))]" />
        <p className="mt-4 max-w-xl text-base font-semibold italic text-primary">
          Vos informations chantiers, à portée de main.
        </p>

        <section className="mt-12">
          <VehiclesCard key={`veh-${refreshKey}`} />
        </section>

        <section className="mt-14">
          <DirectionCard key={`dir-${refreshKey}`} />
        </section>
      </main>

      <Toaster richColors position="bottom-right" />
    </div>
  );
}
