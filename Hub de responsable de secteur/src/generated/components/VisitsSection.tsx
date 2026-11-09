import { useEffect, useState, type ReactNode } from 'react';
import { ClipboardList, Frown, Sun } from 'lucide-react';
import { getChantierQuality, getVisitsOverview, getVisitsPlans } from '@generated/server/visits';
import { Gauge, MonthlyChart } from '@generated/components/VisitsCharts';
import VisitsTable, { PlansTable } from '@generated/components/VisitsTables';
import InfoTip from '@generated/components/InfoTip';

type Overview = Awaited<ReturnType<typeof getVisitsOverview>>;
type Plans = Awaited<ReturnType<typeof getVisitsPlans>>;
type Quality = Awaited<ReturnType<typeof getChantierQuality>>;

const Panel = ({ title, children, className = '' }: { title: ReactNode; children: ReactNode; className?: string }) => (
  <div className={`min-w-0 rounded-[var(--radius-md)] border border-border bg-card p-5 ${className}`}>
    <h3 className="mb-4 text-base font-bold">{title}</h3>
    {children}
  </div>
);

export default function VisitsSection({ firstName }: { firstName: string }) {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [plans, setPlans] = useState<Plans | null>(null);
  const [quality, setQuality] = useState<Quality | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    // 1. Visites clients (KPI 279, graphique et jauges en mode éclair)
    getVisitsOverview({ data: { firstName } })
      .then((r) => { if (active) setOverview(r ?? null); })
      .catch((e) => { console.error(e); if (active) setError('Impossible de charger les visites clients.'); });

    // 2. Qualité des chantiers (étoiles)
    getChantierQuality({ data: { firstName } })
      .then((r) => { if (active) setQuality(r ?? null); })
      .catch((e) => console.error(e));

    // 3. Plans d'actions (22 chantiers en parallèle)
    getVisitsPlans({ data: { firstName } })
      .then((r) => { if (active) setPlans(r ?? null); })
      .catch((e) => console.error(e));

    return () => { active = false; };
  }, [firstName]);

  const sk = <span className="inline-block h-8 w-16 animate-pulse rounded bg-muted align-middle" />;
  const stars = [
    {
      label: 'Client 3',
      icon: 3,
      value: quality?.stars.s3,
      tipLabel: 'Client 3 étoiles',
      tipText: 'Les 3 derniers contrôles consécutifs sont satisfaisants (C1, C2 et C3 = Globalement bon).',
    },
    {
      label: 'Client 2',
      icon: 2,
      value: quality?.stars.s2,
      tipLabel: 'Client 2 étoiles',
      tipText: 'Les 2 derniers contrôles sont satisfaisants (C1 et C2 = Globalement bon).',
    },
    {
      label: 'Client 1',
      icon: 1,
      value: quality?.stars.s1,
      tipLabel: 'Client 1 étoile',
      tipText: 'Le dernier contrôle est satisfaisant (C1 = Globalement bon).',
    },
    {
      label: 'Client',
      icon: 0,
      value: quality?.stars.s0,
      tipLabel: 'Client insatisfait',
      tipText: 'Le dernier contrôle est insatisfaisant (C1 = Bases non respectées ou Plan d\'action urgent).',
    },
  ];

  return (
    <section id="visites" className="scroll-mt-20">
      <h2 className="text-2xl font-extrabold uppercase tracking-tight sm:text-3xl">Suivi des visites clients &amp; plans d'actions</h2>
      <div className="mt-2 h-1 w-16 rounded-full bg-[hsl(var(--brand-orange))]" />
      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title={`Nombre de visites clients par mois — ${overview?.year ?? ''}`} className="lg:col-span-2">
          {overview ? <MonthlyChart monthly={overview.monthly} /> : <div className="h-64 animate-pulse rounded bg-muted" />}
        </Panel>
        <div className="flex flex-col items-center justify-center rounded-[var(--radius-md)] bg-primary p-6 text-primary-foreground">
          <p className="text-xs font-semibold uppercase tracking-widest opacity-80">Visites clients année</p>
          <p className="mt-2 text-7xl font-extrabold tabular-nums">{overview ? overview.yearCount : '…'}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Panel title="Satisfaction des visites">
          <div className="grid grid-cols-2 gap-4">
            <Gauge value={overview?.satTotal ?? null} label="Total" />
            <Gauge value={overview?.satMonth ?? null} label="Mois" />
          </div>
        </Panel>
        <Panel
          title={
            <div className="flex items-center gap-1.5">
              <span>Niveau des clients (3 derniers contrôles)</span>
              <InfoTip
                label="Niveau de qualité des chantiers"
                text="Évaluation de la qualité sur les 3 derniers contrôles réalisés sur les chantiers en cours. Survolez chaque carte pour voir la règle précise."
              />
            </div>
          }
        >
          <div className="grid grid-cols-2 gap-3">
            {stars.map((s) => (
              <div key={s.label + s.icon} className="rounded-[var(--radius-md)] border border-border p-3">
                <div className="flex items-center justify-between">
                  <p className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                    {s.label}
                    {s.icon > 0 ? Array.from({ length: s.icon }).map((_, i) => <Sun key={i} className="h-3.5 w-3.5 text-[hsl(var(--brand-orange))]" />) : <Frown className="h-3.5 w-3.5 text-destructive" />}
                  </p>
                  <InfoTip label={s.tipLabel} text={s.tipText} />
                </div>
                <p className="mt-1 text-3xl font-extrabold tabular-nums text-primary">{s.value ?? sk}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="rounded-[var(--radius-md)] border border-border bg-card p-5">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><ClipboardList className="h-4 w-4" /> Plans d'actions en cours</p>
          <div className="flex items-baseline gap-2">
            <p className="mt-1 text-4xl font-extrabold tabular-nums text-[hsl(var(--brand-orange))]">{plans ? plans.plansOpen.length : sk}</p>
            {plans && (
              <span className="text-xs text-muted-foreground font-medium">
                chantiers ({plans.plansOpen.reduce((sum, p) => sum + (p.actions?.length || 1), 0)} actions)
              </span>
            )}
          </div>
        </div>
        <div className="rounded-[var(--radius-md)] border border-border bg-card p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Plans d'actions clôturés dans le mois</p>
          <p className="mt-1 text-4xl font-extrabold tabular-nums text-primary">{plans ? plans.plansClosedYear : sk}</p>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {(!plans || plans.plansOpen.length > 0) && (
          <Panel title="Liste des plans d'actions en cours suite aux visites">
            <PlansTable plans={plans ? plans.plansOpen : null} />
          </Panel>
        )}
        <div className="space-y-4">
          {(!overview || overview.recent.length > 0) && (
            <Panel title="Visites clients des 2 dernières semaines">
              <VisitsTable visits={overview?.recent ?? null} />
            </Panel>
          )}
          {quality && quality.controle2Mois && quality.controle2Mois.length > 0 && (
            <Panel title="Contrôles insatisfaisants (> 2 mois sans vérification)">
              <VisitsTable
                visits={quality.controle2Mois.map((q) => ({ id: q.id, chantier: q.chantier, date: q.date, qualite: q.resultat }))}
                dateLabel="Dernier contrôle"
                qualLabel="Résultat"
              />
            </Panel>
          )}
        </div>
      </div>
    </section>
  );
}
