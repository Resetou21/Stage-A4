import { 
  ClipboardCheck, 
  FileSpreadsheet, 
  CalendarCheck, 
  Users, 
  ExternalLink,
  Sparkles
} from 'lucide-react';

interface QuickFormItem {
  id: string;
  title: string;
  badge: string;
  badgeTone: string;
  description: string;
  icon: typeof ClipboardCheck;
  iconBg: string;
  iconColor: string;
  borderHover: string;
  buttonTone: string;
  url: string;
  actionLabel?: string;
}

const FORMS: QuickFormItem[] = [
  {
    id: 'visite-client',
    title: 'Action Visite Client',
    badge: 'Contrôle Terrain',
    badgeTone: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    description: 'Enregistrer une visite de contrôle, évaluer la qualité et créer des plans d’actions sur site.',
    icon: ClipboardCheck,
    iconBg: 'bg-emerald-500/15',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    borderHover: 'hover:border-emerald-500/50 hover:shadow-emerald-500/5',
    buttonTone: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    url: 'https://groupefacility.monday.com/boards/1977798116/views/30506259',
    actionLabel: 'Remplir',
  },
  {
    id: 'devis-complementaire',
    title: 'Devis Complémentaire (TE)',
    badge: 'Chiffrage & Avenant',
    badgeTone: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    description: 'Demander un devis de travaux exceptionnels (TE) ou un avenant de contrat pour un client.',
    icon: FileSpreadsheet,
    iconBg: 'bg-blue-500/15',
    iconColor: 'text-blue-600 dark:text-blue-400',
    borderHover: 'hover:border-blue-500/50 hover:shadow-blue-500/5',
    buttonTone: 'bg-blue-600 hover:bg-blue-700 text-white',
    url: 'https://groupefacility.monday.com/boards/2124660930/views/34900045',
    actionLabel: 'Remplir',
  },
  {
    id: 'visite-2-mois',
    title: 'Visite des 2 Mois',
    badge: 'Bilan d’Intégration',
    badgeTone: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    description: 'Compléter le bilan qualité à 60 jours pour mesurer la satisfaction globale du client.',
    icon: CalendarCheck,
    iconBg: 'bg-amber-500/15',
    iconColor: 'text-amber-600 dark:text-amber-400',
    borderHover: 'hover:border-amber-500/50 hover:shadow-amber-500/5',
    buttonTone: 'bg-amber-600 hover:bg-amber-700 text-white',
    url: 'https://groupefacility.monday.com/boards/5089630900/views/41080727',
    actionLabel: 'Remplir',
  },
  {
    id: 'point-hebdo',
    title: 'Point Hebdo Animatrices',
    badge: 'Espace d’Équipe',
    badgeTone: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    description: 'Consulter, animer et consigner les arbitrages de la réunion hebdomadaire du secteur.',
    icon: Users,
    iconBg: 'bg-purple-500/15',
    iconColor: 'text-purple-600 dark:text-purple-400',
    borderHover: 'hover:border-purple-500/50 hover:shadow-purple-500/5',
    buttonTone: 'bg-purple-600 hover:bg-purple-700 text-white',
    url: 'https://groupefacility.monday.com/boards/5092223610',
    actionLabel: 'Accéder',
  },
];

export default function QuickFormsSection() {
  const handleOpenForm = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <section id="formulaires" className="scroll-mt-20">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
        <div>
          <h2 className="text-xl font-extrabold uppercase tracking-tight sm:text-2xl text-foreground flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[hsl(var(--brand-orange))]" />
            Actions &amp; Formulaires Rapides
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Accès direct aux 4 formulaires clés pour enregistrer vos saisies en tournée et en réunion.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {FORMS.map((form) => {
          const Icon = form.icon;
          return (
            <div
              key={form.id}
              onClick={() => handleOpenForm(form.url)}
              className={`rounded-2xl border border-border bg-card p-5 shadow-xs transition-all duration-200 cursor-pointer flex flex-col justify-between group hover:-translate-y-1 hover:shadow-md ${form.borderHover}`}
            >
              <div>
                {/* En-tête : Icône + Badge thématique */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${form.iconBg} ${form.iconColor} transition-transform group-hover:scale-105`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${form.badgeTone}`}>
                    {form.badge}
                  </span>
                </div>

                {/* Titre & Description */}
                <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors">
                  {form.title}
                </h3>
                <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                  {form.description}
                </p>
              </div>

              {/* Bouton d'action en bas */}
              <div className="mt-5 pt-3 border-t border-border flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground group-hover:text-foreground transition-colors">
                  Ouvrir Monday
                </span>
                <span className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition-all shadow-2xs ${form.buttonTone}`}>
                  <span>{form.actionLabel || 'Remplir'}</span>
                  <ExternalLink className="h-3 w-3" />
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

