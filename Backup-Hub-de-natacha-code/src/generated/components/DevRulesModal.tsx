import { useState, type ReactNode } from 'react';
import {
  BookOpen,
  Calendar,
  CheckSquare,
  ChevronDown,
  Database,
  FileText,
  Filter,
  Layers,
  LayoutList,
  Sparkles,
  User,
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@components/ui/dialog';
import { cn } from '@lib/utils';

type SectionKey = 'visites' | 'stocks' | 'alertes';

export default function DevRulesModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [section, setSection] = useState<SectionKey>('visites');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[95vw] max-w-4xl flex flex-col p-6 sm:p-7 rounded-2xl border border-border bg-card shadow-2xl">
        <DialogHeader className="space-y-1 text-left pb-3 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-extrabold tracking-tight">
                Filtres &amp; Calculs des Tableaux Monday
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Vue visuelle des filtres de chaque indicateur, exactement comme dans l'interface de Monday.com.
              </DialogDescription>
            </div>
          </div>

          {/* Navigation par onglets */}
          <div className="flex items-center gap-2 pt-3">
            {[
              { id: 'visites', label: 'Visites & Qualité', icon: BookOpen },
              { id: 'stocks', label: 'Stocks & Économies', icon: Layers },
              { id: 'alertes', label: 'Système d\'Alertes', icon: Filter },
            ].map((t) => {
              const Icon = t.icon;
              const active = section === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSection(t.id as SectionKey)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                    active
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t.label}
                </button>
              );
            })}
          </div>
        </DialogHeader>

        <div className="overflow-y-auto space-y-4 py-4 pr-1 text-xs">
          {section === 'visites' && (
            <div className="space-y-4">
              <MondayFilterCard
                title="Visites Clients Année (KPI 344) & Histogramme mensuel"
                board="Visites Clients"
                rules={[
                  { connector: 'Où', icon: 'people', column: 'Animateur', operator: 'Est', value: 'Responsable sélectionné (ex: Emilie TOBIE)' },
                  { connector: 'et', icon: 'date', column: 'Date visite client', operator: 'Est entre', value: '01/01/2026 et 31/12/2026' },
                ]}
                calculation="Somme totale de toutes les visites filtrées. L'histogramme affiche le total mois par mois (1 = Janvier à 12 = Décembre)."
              />

              <MondayFilterCard
                title="Satisfaction des visites (Jauges Total & Mois)"
                board="Visites Clients"
                rules={[
                  { connector: 'Où', icon: 'people', column: 'Animateur', operator: 'Est', value: 'Responsable sélectionné' },
                  { connector: 'et', icon: 'date', column: 'Date visite client', operator: 'Est entre', value: 'Année 2026 (Total) ou Mois en cours (Mois)' },
                  { connector: 'et', icon: 'status', column: 'Qualité de la prestation', operator: 'N\'est pas vide', value: 'Note renseignée' },
                ]}
                calculation="Pourcentage calculé : (Nombre de visites 'Globalement bon' ÷ Total des visites notées) × 100"
              />

              <MondayFilterCard
                title="Niveau des clients (3🌟, 2🌟, 1🌟, 🙁)"
                board="Tableau complet chantier"
                rules={[
                  { connector: 'Où', icon: 'group', column: 'Groupe', operator: 'Est', value: 'Liste des chantiers en cours' },
                  { connector: 'et', icon: 'people', column: 'ANIMATEUR', operator: 'Est', value: 'Responsable sélectionné' },
                ]}
                calculation="Règles appliquées sur les 3 colonnes de contrôle qualité :
• 3🌟 : C1 = 'Globalement bon' ET C2 = 'Globalement bon' ET C3 = 'Globalement bon'
• 2🌟 : C1 = 'Globalement bon' ET C2 = 'Globalement bon'
• 1🌟 : C1 = 'Globalement bon'
• 🙁 : C1 = 'Bases non respectées' ou 'Plan d\'action urgent'"
              />

              <MondayFilterCard
                title="Plans d'actions en cours suite aux visites"
                board="Sous-éléments Visites Clients"
                rules={[
                  { connector: 'Où', icon: 'people', column: 'Animateur chantier', operator: 'Est', value: 'Responsable sélectionné' },
                  { connector: 'et', icon: 'status', column: 'Statut', operator: 'N\'est pas', value: 'Fait , Abandonné' },
                ]}
                calculation="Affiche chaque action en attente regroupée par visite. Les actions marquées 'Abandonné' sont automatiquement exclues."
              />

              <MondayFilterCard
                title="Plans d'actions clôturés dans le mois"
                board="Sous-éléments Visites Clients"
                rules={[
                  { connector: 'Où', icon: 'people', column: 'Animateur chantier', operator: 'Est', value: 'Responsable sélectionné' },
                  { connector: 'et', icon: 'status', column: 'Statut', operator: 'Est', value: 'Fait' },
                  { connector: 'et', icon: 'date', column: 'Date réalisation', operator: 'Est', value: 'Ce mois-ci' },
                ]}
                calculation="Compte toutes les actions validées comme réalisées au cours du mois calendaire actuel."
              />
            </div>
          )}

          {section === 'stocks' && (
            <div className="space-y-4">
              <MondayFilterCard
                title="Tuile 01 : Liste des sites avec hygiène"
                board="Tableau complet chantier"
                rules={[
                  { connector: 'Où', icon: 'group', column: 'Groupe', operator: 'Est', value: 'Liste des chantiers en cours' },
                  { connector: 'et', icon: 'people', column: 'ANIMATEUR', operator: 'Est', value: 'Responsable sélectionné' },
                  { connector: 'et', icon: 'formula', column: 'Contrat consommables', operator: 'Est supérieur à', value: '0' },
                ]}
                calculation="Nombre de chantiers possédant au moins une dotation active de consommables."
              />

              <MondayFilterCard
                title="Tuile 02 : Inventaires à faire"
                board="Inventaires Consommables"
                rules={[
                  { connector: 'Où', icon: 'group', column: 'Groupe', operator: 'Est', value: 'Inventaire des consommables' },
                  { connector: 'et', icon: 'people', column: 'ANIMATEUR', operator: 'Est', value: 'Responsable sélectionné' },
                  { connector: 'et', icon: 'checkbox', column: 'Inventaire Validé OK', operator: 'N\'est pas', value: 'Coché' },
                  { connector: 'et', icon: 'date', column: 'Date inventaire actuel', operator: 'Est antérieur à', value: 'Il y a 182 jours (6 mois)' },
                ]}
                calculation="Sites dont le relevé de stock périodique doit être effectué (revient tous les 182 jours)."
              />

              <MondayFilterCard
                title="Tuile 03 : Actions suite inventaire"
                board="Inventaires Consommables"
                rules={[
                  { connector: 'Où', icon: 'group', column: 'Groupe', operator: 'Est', value: 'inventaires réalisés' },
                  { connector: 'et', icon: 'formula', column: 'À Récupérer', operator: 'Est supérieur à', value: '0' },
                  { connector: 'et', icon: 'checkbox', column: 'Récupération réalisée', operator: 'N\'est pas', value: 'Coché' },
                  { connector: 'ou', icon: 'formula', column: 'Avenant', operator: 'Est supérieur à', value: '0' },
                  { connector: 'et', icon: 'checkbox', column: 'Avenant réalisé', operator: 'N\'est pas', value: 'Coché' },
                ]}
                calculation="Sur la ligne la plus récente de chaque chantier : actions physiques de récupération ou avenants contractuels à concrétiser."
              />

              <MondayFilterCard
                title="Économie Directe & Économie Contrat (12 mois)"
                board="Inventaires Consommables"
                rules={[
                  { connector: 'Où', icon: 'group', column: 'Groupe', operator: 'Est', value: 'inventaires réalisés' },
                  { connector: 'et', icon: 'people', column: 'ANIMATEUR', operator: 'Est', value: 'Responsable sélectionné' },
                ]}
                calculation="Formules de valorisation financière :
• Économie Directe (€) = Somme (Quantité À Récupérer × Prix Unitaire HT de la référence)
• Économie Contrat 12M (€) = Somme (Quantité Avenant × Prix Unitaire HT de la référence)

Règles de calcul des dotations :
• Stock Mini = max(1, arrondi(Contrat Annuel / 12 × 2))
• À Récupérer = max(0, Inventaire Réel - Stock Mini)
• Durée conso = (À Récupérer × 12 / Contrat Annuel) mois
• Avenant = min(À Récupérer, arrondi(Contrat Annuel × 25 %))"
              />
            </div>
          )}

          {section === 'alertes' && (
            <div className="space-y-4">
              <MondayFilterCard
                title="Liste des chantiers non vus depuis 11 mois"
                board="Tableau complet chantier"
                rules={[
                  { connector: 'Où', icon: 'formula', column: 'Alerte 1', operator: 'Est', value: '1' },
                  { connector: 'et', icon: 'date', column: '+ chantiers', operator: 'Est', value: 'Vide' },
                  { connector: 'et', icon: 'group', column: 'Groupe', operator: 'Est', value: 'Liste des chantiers en cours' },
                  { connector: 'et', icon: 'people', column: 'ANIMATEUR', operator: 'Est', value: 'Responsable sélectionné' },
                ]}
                calculation="Chantiers en cours dont le dernier contrôle qualité date de plus de 11 mois sans nouvelle visite."
              />

              <MondayFilterCard
                title="Contrôles insatisfaisants (> 2 mois sans vérification)"
                board="Tableau complet chantier"
                rules={[
                  { connector: 'Où', icon: 'formula', column: 'Alerte 3', operator: 'Est', value: '1' },
                  { connector: 'et', icon: 'group', column: 'Groupe', operator: 'Est', value: 'Liste des chantiers en cours' },
                  { connector: 'et', icon: 'people', column: 'ANIMATEUR', operator: 'Est', value: 'Responsable sélectionné' },
                ]}
                calculation="Chantiers dont le dernier contrôle C1 était insatisfaisant ('Bases non respectées' ou 'Plan d'action urgent') et sans re-contrôle depuis 60 jours."
              />

              <MondayFilterCard
                title="Clients insatisfaits (3 contrôles consécutifs non satisfaisants)"
                board="Tableau complet chantier"
                rules={[
                  { connector: 'Où', icon: 'formula', column: 'Alerte 2', operator: 'Est supérieur à', value: '0' },
                  { connector: 'et', icon: 'group', column: 'Groupe', operator: 'Est', value: 'Liste des chantiers en cours' },
                  { connector: 'et', icon: 'people', column: 'ANIMATEUR', operator: 'Est', value: 'Responsable sélectionné' },
                ]}
                calculation="Alerte stricte : C1 mauvais ET C2 mauvais ET C3 mauvais consécutivement."
              />

              <MondayFilterCard
                title="Visites des 2 mois"
                board="Tableau complet chantier"
                rules={[
                  { connector: 'Où', icon: 'text', column: 'Texte d\'alerte animatrice', operator: 'N\'est pas vide', value: 'Texte renseigné' },
                  { connector: 'et', icon: 'checkbox', column: 'Rdv 2 mois ?', operator: 'N\'est pas', value: 'Coché' },
                  { connector: 'et', icon: 'group', column: 'Groupe', operator: 'Est', value: 'Liste des chantiers en cours' },
                  { connector: 'et', icon: 'people', column: 'ANIMATEUR', operator: 'Est', value: 'Responsable sélectionné' },
                ]}
                calculation="Alerte sur les nouveaux chantiers nécessitant un rendez-vous client à l'échéance des 2 mois."
              />

              <MondayFilterCard
                title="Messages & Rappels (Bandeau À traiter)"
                board="Communication via les animatrices"
                rules={[
                  { connector: 'Où', icon: 'group', column: 'Groupe', operator: 'Est', value: 'Messages en attente' },
                  { connector: 'et', icon: 'people', column: 'Personne concernée', operator: 'Est', value: 'Responsable sélectionné' },
                  { connector: 'et', icon: 'checkbox', column: 'Vu', operator: 'N\'est pas', value: 'Coché' },
                ]}
                calculation="Messages adressés par la direction ou l'équipe, disparaissant dès que la case 'Vu' est cochée."
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MondayFilterCard({
  title,
  board,
  rules,
  calculation,
}: {
  title: string;
  board: string;
  rules: Array<{
    connector?: 'Où' | 'et' | 'ou';
    icon?: 'status' | 'date' | 'formula' | 'people' | 'dropdown' | 'group' | 'text' | 'checkbox';
    column: string;
    operator: string;
    value: string;
  }>;
  calculation: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
      {/* En-tête bleu pastel style Monday */}
      <div className="bg-sky-500/10 border-b border-sky-500/20 px-4 py-2.5 flex items-center justify-between gap-2">
        <h4 className="font-extrabold text-xs sm:text-sm text-foreground tracking-tight">
          {title}
        </h4>
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-bold text-foreground shadow-2xs">
          <LayoutList className="h-3.5 w-3.5 text-primary" />
          {board}
        </span>
      </div>

      {/* Rangées de filtres visuels style Monday.com */}
      <div className="p-4 bg-muted/20 space-y-2 border-b border-border/60">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground pb-0.5">
          Filtres Monday appliqués :
        </p>
        <div className="space-y-1.5">
          {rules.map((r, i) => (
            <div key={i} className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="w-6 text-right font-semibold text-muted-foreground text-[11px] select-none">
                {r.connector || (i === 0 ? 'Où' : 'et')}
              </span>

              {/* Pilule Colonne */}
              <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium shadow-2xs">
                <ColumnIcon type={r.icon} />
                <span className="text-foreground">{r.column}</span>
              </span>

              {/* Pilule Opérateur */}
              <span className="inline-flex items-center gap-1 rounded-md border border-border/80 bg-muted/40 px-2 py-1 text-xs text-muted-foreground font-medium">
                <span>{r.operator}</span>
                <ChevronDown className="h-3 w-3 opacity-50" />
              </span>

              {/* Pilule Valeur */}
              <span className="inline-flex items-center gap-1.5 rounded-md bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30 px-2.5 py-1 text-xs font-bold shadow-2xs">
                <span>{r.value}</span>
                <span className="text-[10px] opacity-50 select-none">×</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Règle & formule en clair */}
      <div className="p-3.5 bg-background text-xs space-y-1">
        <p className="font-bold text-[11px] text-primary uppercase tracking-wide flex items-center gap-1">
          <Sparkles className="h-3 w-3" />
          Règle &amp; Calcul métier :
        </p>
        <p className="text-muted-foreground whitespace-pre-line leading-relaxed font-sans text-xs">
          {calculation}
        </p>
      </div>
    </div>
  );
}

function ColumnIcon({ type }: { type?: string }) {
  if (type === 'formula') {
    return (
      <span className="h-4 w-4 rounded bg-teal-500 text-white font-serif font-bold text-[10px] flex items-center justify-center shadow-2xs">
        fx
      </span>
    );
  }
  if (type === 'date') {
    return (
      <span className="h-4 w-4 rounded bg-purple-500 text-white flex items-center justify-center shadow-2xs">
        <Calendar className="h-2.5 w-2.5" />
      </span>
    );
  }
  if (type === 'people') {
    return (
      <span className="h-4 w-4 rounded bg-sky-500 text-white flex items-center justify-center shadow-2xs">
        <User className="h-2.5 w-2.5" />
      </span>
    );
  }
  if (type === 'checkbox') {
    return (
      <span className="h-4 w-4 rounded bg-indigo-500 text-white flex items-center justify-center shadow-2xs">
        <CheckSquare className="h-2.5 w-2.5" />
      </span>
    );
  }
  if (type === 'status') {
    return (
      <span className="h-4 w-4 rounded bg-emerald-500 text-white flex items-center justify-center shadow-2xs">
        <span className="h-2 w-2 rounded-full bg-white" />
      </span>
    );
  }
  if (type === 'group') {
    return (
      <span className="h-4 w-4 rounded bg-amber-400 text-amber-900 flex items-center justify-center shadow-2xs">
        <span className="h-2 w-2 rounded-full bg-amber-800" />
      </span>
    );
  }
  return <FileText className="h-3.5 w-3.5 text-muted-foreground" />;
}



