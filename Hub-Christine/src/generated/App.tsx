import { useState } from "react";
import BornesCard from "@generated/components/BornesCard";
import ChargemapCard from "@generated/components/ChargemapCard";
import SaisieVehiculeButton from "@generated/components/SaisieVehiculeButton";
import ReparationsCard from "@generated/components/ReparationsCard";
import { Toaster } from "@components/ui/sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@components/ui/dialog";
import {
  ShieldCheck,
  Zap,
  Fuel,
  Wrench,
  Sparkles,
  Eye,
  CheckCircle2,
  Database,
  Calendar,
  Layers,
  ArrowRight
} from "lucide-react";

const LOGO = 'https://files-public.monday.com/euc1/4853404b-84ea-4006-aab2-0e6de2c4dfdb/Facility-logo_couleur01.svg';

export default function App() {
  const [antiDoublonOpen, setAntiDoublonOpen] = useState(false);

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground font-[family-name:var(--font-body)]">
      {/* Motifs décoratifs Facility */}
      <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rotate-12 rounded-[40%] bg-primary/20 blur-2xl" />
      <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-72 w-72 rounded-full border-2 border-[hsl(var(--brand-orange))]/30" />

      {/* Barre d'en-tête */}
      <header className="relative border-b border-border bg-card/90 backdrop-blur sticky top-0 z-20">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-3.5 py-3 sm:px-6 sm:py-3.5 lg:px-8">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-primary text-xs sm:text-sm font-extrabold text-primary-foreground shadow-sm">
              C
            </div>
            <div className="leading-tight">
              <p className="font-[family-name:var(--font-heading)] text-xs sm:text-sm font-bold text-foreground">
                Christine
              </p>
              <p className="text-[11px] sm:text-xs text-muted-foreground font-medium">
                Hub Facturation & Flotte Véhicules
              </p>
            </div>
          </div>
          <img
            src={LOGO}
            alt="Groupe Facility"
            className="h-8 w-auto max-w-[40%] object-contain sm:h-10 lg:h-12"
          />
        </div>
      </header>

      {/* Contenu principal */}
      <main className="relative mx-auto max-w-7xl px-3.5 py-5 sm:px-6 sm:py-8 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 sm:px-3 sm:py-1 text-[11px] sm:text-xs font-bold text-primary mb-1.5">
              <Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> Espace Administratif & Suivi des Dépenses
            </div>
            <h1 className="text-2xl font-extrabold uppercase tracking-tight sm:text-3xl lg:text-4xl text-foreground font-[family-name:var(--font-heading)]">
              Hub de Christine
            </h1>
            <div className="mt-1.5 sm:mt-2 h-1 w-16 sm:w-20 rounded-full bg-[hsl(var(--brand-blue))]" />
            <p className="mt-2 max-w-2xl text-xs sm:text-sm font-medium text-muted-foreground leading-relaxed">
              Saisie des factures véhicules, gestion des flux carburant & bornes et synchronisation avec les Hubs de Vincent et Christophe.
            </p>
          </div>

          {/* Pastille discrète Anti-doublons (accessible en 1 clic sans encombrer la vue) */}
          <Dialog open={antiDoublonOpen} onOpenChange={setAntiDoublonOpen}>
            <DialogTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-2 self-start sm:self-auto rounded-full border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 px-3.5 py-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300 transition-all cursor-pointer shadow-xs shrink-0"
                title="Cliquer pour voir le détail de l'anti-doublons et de la synchronisation Monday"
              >
                <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>Anti-doublons 100% actif</span>
                <span className="text-[10px] bg-emerald-500/25 px-1.5 py-0.2 rounded-full font-bold">Info</span>
              </button>
            </DialogTrigger>

            <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                  <ShieldCheck className="h-6 w-6 text-primary" />
                  Audit Anti-Doublons & Synchronisation Monday.com
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 mt-2 text-sm leading-relaxed">
                {/* 1. Fin du blocage 500 lignes */}
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-primary">
                    <Database className="h-4 w-4" />
                    <span>Dépassement de la limite Monday des 500 lignes</span>
                  </div>
                  <p className="text-xs text-foreground/90">
                    Par défaut, l'API Monday.com plafonne chaque requête à 500 lignes max. Sur ce Hub, le moteur utilise la <strong>pagination par curseur dynamique</strong> (<code>next_items_page(limit: 500, cursor)</code>).
                  </p>
                  <div className="text-xs text-emerald-800 bg-emerald-50 rounded-lg p-2.5 border border-emerald-200 font-medium">
                    ✅ <strong>Garantie 100% :</strong> Les 4000+ lignes de Wellborne et les historiques Total/Chargemap sont intégralement inspectés en mémoire avant chaque import.
                  </div>
                </div>

                {/* 2. Détail par flux métier */}
                <div className="grid gap-3 sm:grid-cols-2">
                  {/* TotalEnergies */}
                  <div className="rounded-xl border border-border bg-card p-3.5 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                      <Fuel className="h-4 w-4 text-amber-500" />
                      <span>TotalEnergies Bi-mensuel (15 & 30)</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Deux factures par mois (quinzaine du 1 au 15, puis du 16 au 30/31). Détection des doublons sur chaque quinzaine et renommage automatique en <code>TOTAL_AAAA-MM_15.xlsx</code>.
                    </p>
                    <div className="text-[10px] text-primary font-semibold flex items-center gap-1">
                      <ArrowRight className="h-3 w-3" /> Destinataire : Laurent GUILLOU
                    </div>
                  </div>

                  {/* Chargemap */}
                  <div className="rounded-xl border border-border bg-card p-3.5 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                      <Zap className="h-4 w-4 text-blue-500" />
                      <span>Chargemap 2026 (Validation Vincent)</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Vérification et rapprochement exclusif des badges par Vincent. Détection anti-doublons par identifiant de transaction pour éviter toute double facturation de kWh.
                    </p>
                    <div className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
                      <ArrowRight className="h-3 w-3" /> Validateur Unique : Vincent
                    </div>
                  </div>

                  {/* Wellborne */}
                  <div className="rounded-xl border border-border bg-card p-3.5 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                      <Layers className="h-4 w-4 text-emerald-600" />
                      <span>Bornes Wellborne (&gt; 15-05 & Pause 1s)</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Toutes les charges antérieures au 15 mai sont automatiquement écartées. Import cadencé par lots de 50 avec 1 seconde de pause pour garantir la stabilité de l'API Monday.
                    </p>
                    <div className="text-[10px] text-foreground font-semibold flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Compteurs réels par mois affichés
                    </div>
                  </div>

                  {/* Réparations Atelier */}
                  <div className="rounded-xl border border-border bg-card p-3.5 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                      <Wrench className="h-4 w-4 text-rose-500" />
                      <span>Réparations Matériel ➔ Christophe</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Toute facture réparation saisie ici crée automatiquement un ticket curatif « À traiter » pour Christophe dans l'Atelier, afin qu'il affecte l'intervention à la bonne machine.
                    </p>
                    <div className="text-[10px] text-rose-700 font-semibold flex items-center gap-1">
                      <ArrowRight className="h-3 w-3" /> Hub ERP Atelier (Christophe)
                    </div>
                  </div>
                </div>

                {/* Résumé des 3 dernières factures scannées */}
                <div className="rounded-xl border border-border/80 bg-muted/30 p-3 text-xs">
                  <div className="font-bold text-foreground mb-1">
                    📋 Historique des scans & renommage automatique
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Chaque fichier déposé (même nommé à l'identique comme <em>Enregistrement de charge.xlsx</em>) est analysé, renommé de façon normée et archivé dans l'historique sous sa carte respective.
                  </p>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Section principale : Cartes métiers */}
        <section className="mt-6 sm:mt-8">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h2 className="text-base sm:text-lg font-bold text-foreground font-[family-name:var(--font-heading)] flex items-center gap-2">
              <span>Gestion des Factures & Données Monday</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 items-stretch">
            {/* 1. Saisie véhicule (avec tri naturel et champs obligatoires) */}
            <div className="flex w-full">
              <SaisieVehiculeButton />
            </div>

            {/* 2. Factures Chargemap (validation Vincent) */}
            <div className="flex w-full">
              <ChargemapCard variant="chargemap" />
            </div>

            {/* 3. Factures Total (2 quinzaines par mois : 15 et 30) */}
            <div className="flex w-full">
              <ChargemapCard variant="total" />
            </div>

            {/* 4. Montant Wellborne (filtre < 15-05, compteur mensuel et 4000+ lignes) */}
            <div className="flex w-full">
              <BornesCard />
            </div>

            {/* 5. Nouvel onglet Réparations Matériel (alerte Hub de Christophe) */}
            <div className="flex w-full md:col-span-2 lg:col-span-2">
              <ReparationsCard />
            </div>
          </div>
        </section>
      </main>

      <Toaster position="top-right" />
    </div>
  );
}
