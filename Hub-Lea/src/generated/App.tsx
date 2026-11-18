import ContactsCard from '@generated/components/ContactsCard';

const LOGO = 'https://files-public.monday.com/euc1/4853404b-84ea-4006-aab2-0e6de2c4dfdb/Facility-logo_couleur01.svg';

export default function App() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rotate-12 rounded-[40%] bg-primary/80" />
      <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-72 w-72 rounded-full border-2 border-[hsl(var(--brand-orange))]/40" />

      <header className="relative border-b border-border bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-sm font-bold text-secondary-foreground">LG</div>
            <div className="leading-tight">
              <p className="font-[family-name:var(--font-heading)] text-sm font-bold">Léa Gosselin</p>
              <p className="text-xs text-muted-foreground">Hub personnel</p>
            </div>
          </div>
          <img src={LOGO} alt="Groupe Facility" className="h-12 w-auto max-w-[45%] object-contain sm:h-14" />
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-4 py-10 sm:px-8 sm:py-14">
        <h1 className="text-4xl font-extrabold uppercase tracking-tight sm:text-5xl">Hub de Léa</h1>
        <div className="mt-3 h-1 w-24 rounded-full bg-[hsl(var(--brand-blue))]" />
        <p className="mt-4 max-w-xl text-base font-semibold italic text-primary">
          Vos informations chantiers, à portée de main.
        </p>
        <section className="mt-12">
          <ContactsCard />
        </section>
      </main>
    </div>
  );
}
