import { Users, ShieldCheck, Building, ArrowRight, Database } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@components/ui/dialog';

interface Props {
  boardId: number;
}

interface BusinessUser {
  name: string;
  role: string;
  email: string;
  hub: string;
  tag: 'Validateur' | 'Gestionnaire' | 'Destinataire' | 'Superviseur';
  initials: string;
  color: string;
}

const BUSINESS_USERS_MAP: Record<number, {
  hubTitle: string;
  boardName: string;
  boardIdDisplay: number;
  purpose: string;
  workflow: string;
  users: BusinessUser[];
}> = {
  // 1. Données facturation véhicules (Board 5092124669)
  5092124669: {
    hubTitle: 'Hub Facturation Véhicules ➔ Hub Suivi Véhicules (Flotte)',
    boardName: 'Data sur véhicule',
    boardIdDisplay: 5092124669,
    purpose: 'Centralisation de toutes les dépenses par véhicule (entretiens, réparations, révisions, pneumatiques, contrôle technique).',
    workflow: 'Christine enregistre les factures et dépenses de chaque véhicule. Ces coûts sont instantanément consolidés et visibles par Vincent pour le suivi du coût de revient kilométrique (TCO) et l’analyse de rentabilité de la flotte.',
    users: [
      {
        name: 'Christine GUILLOU',
        role: 'Saisie des dépenses & Facturation Véhicules',
        email: 'chguillou@groupefacility.fr',
        hub: 'Hub Facturation (Christine)',
        tag: 'Gestionnaire',
        initials: 'CG',
        color: '#0284C7',
      },
      {
        name: 'Vincent',
        role: 'Supervision Flotte & Analyse analytique des coûts',
        email: 'viviere@groupefacility.fr',
        hub: 'Hub Suivi Véhicules',
        tag: 'Superviseur',
        initials: 'VR',
        color: '#00C875',
      },
    ],
  },
  // 2. Factures Chargemap (Board 5092349771)
  5092349771: {
    hubTitle: 'Hub Facturation & Flotte ➔ Hub Vincent (Électrique)',
    boardName: 'Facture chargemap',
    boardIdDisplay: 5092349771,
    purpose: 'Rapprochement et contrôle des consommations électriques effectuées par badge en itinérance extérieure.',
    workflow: 'Christine importe mensuellement le fichier de facturation Chargemap avec filtrage anti-doublons. Vincent valide et effectue le rapprochement nominatif badge / conducteur / véhicule pour l’imputation analytique.',
    users: [
      {
        name: 'Vincent',
        role: 'Validateur Unique Chargemap (Check badges & consommations)',
        email: 'viviere@groupefacility.fr',
        hub: 'Hub Suivi Véhicules & Électrique',
        tag: 'Validateur',
        initials: 'VR',
        color: '#00C875',
      },
      {
        name: 'Christine GUILLOU',
        role: 'Importation mensuelle & Détection des doublons',
        email: 'chguillou@groupefacility.fr',
        hub: 'Hub Facturation (Christine)',
        tag: 'Gestionnaire',
        initials: 'CG',
        color: '#0284C7',
      },
    ],
  },
  // 3. Factures Total (Board 5092674084)
  5092674084: {
    hubTitle: 'Hub Facturation Carburant ➔ Tableau Total Laurent GUILLOU',
    boardName: 'Facture TOTAL',
    boardIdDisplay: 5092674084,
    purpose: 'Suivi bi-mensuel des consommations de carburant (quinzaines du 15 et du 30/fin de mois) et gestion du parc thermique.',
    workflow: 'Christine importe les 2 factures mensuelles Total avec élimination des doublons sur les deux quinzaines. Laurent GUILLOU exploite directement ces données sur son tableau pour la gestion des cartes et l’analyse des pleins.',
    users: [
      {
        name: 'Christine GUILLOU',
        role: 'Importation Factures Bi-mensuelles (15 & 30)',
        email: 'chguillou@groupefacility.fr',
        hub: 'Hub Facturation (Christine)',
        tag: 'Gestionnaire',
        initials: 'CG',
        color: '#0284C7',
      },
      {
        name: 'Laurent GUILLOU',
        role: 'Gestionnaire Cartes Carburant & Parc Total',
        email: 'lguillou@groupefacility.fr',
        hub: 'Tableau Factures TOTAL Laurent GUILLOU',
        tag: 'Destinataire',
        initials: 'LG',
        color: '#F59E0B',
      },
    ],
  },
  // 4. Montant Wellborne (Board 5106822028)
  5106822028: {
    hubTitle: 'Hub Facturation Énergie ➔ Hub Suivi Véhicules (Énergie)',
    boardName: 'Data sur véhicule / Bornes Wellborne',
    boardIdDisplay: 5106822028,
    purpose: 'Suivi de l’énergie délivrée par les bornes de recharge privatives du groupe et mesure des charges réelles.',
    workflow: 'Christine télécharge le fichier Wellborne, le filtre (uniquement les charges postérieures au 15/05/2026) et élimine les doublons parmi les 4000+ sessions existantes. Vincent analyse la consommation électrique globale et l’usage des bornes.',
    users: [
      {
        name: 'Christine GUILLOU',
        role: 'Importateur Données Bornes & Contrôle Doublons',
        email: 'chguillou@groupefacility.fr',
        hub: 'Hub Facturation (Christine)',
        tag: 'Gestionnaire',
        initials: 'CG',
        color: '#0284C7',
      },
      {
        name: 'Vincent',
        role: 'Suivi Énergie & Rapprochement Bornes',
        email: 'viviere@groupefacility.fr',
        hub: 'Hub Suivi Véhicules',
        tag: 'Superviseur',
        initials: 'VR',
        color: '#00C875',
      },
    ],
  },
  // 5. Réparations Matériel (Board 5106693291)
  5106693291: {
    hubTitle: 'Hub Facturation Matériel ➔ Hub ERP Atelier (Christophe)',
    boardName: 'Réparation machines (ERP Atelier)',
    boardIdDisplay: 5106693291,
    purpose: 'Interconnexion instantanée entre la facturation fournisseur et la gestion technique du parc matériel de l’Atelier.',
    workflow: 'Dès que Christine saisit une facture de réparation de machine, un ticket curatif « À traiter » est automatiquement généré pour Christophe à l’Atelier, avec les détails techniques pour affectation immédiate sur la machine.',
    users: [
      {
        name: 'Christophe',
        role: 'Responsable Atelier & Maintenance du Parc Machines',
        email: 'atelier@groupefacility.fr',
        hub: 'Hub ERP Parc Matériel (Atelier)',
        tag: 'Destinataire',
        initials: 'CH',
        color: '#E11D48',
      },
      {
        name: 'Christine GUILLOU',
        role: 'Enregistrement Facture Réparation & Alerte Atelier',
        email: 'chguillou@groupefacility.fr',
        hub: 'Hub Facturation (Christine)',
        tag: 'Gestionnaire',
        initials: 'CG',
        color: '#0284C7',
      },
    ],
  },
};

export default function UsersBadge({ boardId }: Props) {
  const info = BUSINESS_USERS_MAP[boardId];

  if (!info) return null;

  return (
    <Dialog>
      <DialogTrigger
        aria-label="Personnes utilisant ces données"
        className="-mt-2 inline-flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-full bg-muted/60 px-2.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground cursor-pointer shadow-xs"
        title="Qui utilise ces données & sur quel Hub ?"
      >
        <Users className="h-3.5 w-3.5 text-primary" />
        <span className="font-bold text-foreground">{info.users.length}</span>
      </DialogTrigger>

      <DialogContent
        className="w-[94vw] sm:w-[560px] max-w-[560px] p-6 rounded-2xl border border-border bg-card shadow-2xl max-h-[90vh] overflow-y-auto"
        style={{ width: 'min(94vw, 560px)', maxWidth: '560px', boxSizing: 'border-box' }}
      >
        {/* En-tête de la modale */}
        <DialogHeader className="pr-8 space-y-1">
          <DialogTitle className="flex items-center gap-2.5 text-base font-bold text-foreground">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
              <Building className="h-4.5 w-4.5" />
            </div>
            <div>
              <div className="text-sm font-bold text-foreground">Qui utilise ces données &amp; sur quel Hub ?</div>
              <p className="text-[11px] font-normal text-muted-foreground mt-0.5">
                Chaîne de traitement métier &amp; interconnexion inter-Hubs
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Encadré Flux & Contexte métier complet */}
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3 w-full box-border mt-1">
          {/* Flux inter-Hubs */}
          <div className="flex items-start gap-2 text-xs font-bold text-primary">
            <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
            <div className="flex-1 min-w-0">
              <span className="text-[10px] uppercase tracking-wider text-primary/70 font-semibold block">Flux de données</span>
              <span className="text-xs font-bold text-foreground break-words">{info.hubTitle}</span>
            </div>
          </div>

          {/* Tableau Monday */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1.5 border-t border-primary/10">
            <Database className="h-3.5 w-3.5 shrink-0 text-primary/70" />
            <span className="text-[11px]">
              Tableau Monday lié : <strong className="text-foreground">{info.boardName}</strong> <span className="text-muted-foreground/70 text-[10px]">({info.boardIdDisplay || boardId})</span>
            </span>
          </div>

          {/* Finalité métier */}
          <div className="text-xs text-muted-foreground leading-relaxed">
            <strong className="text-foreground font-semibold">Finalité : </strong>
            {info.purpose}
          </div>

          {/* Fonctionnement / Workflow */}
          <div className="text-[11px] bg-background/90 p-2.5 rounded-lg border border-border/80 text-foreground leading-relaxed">
            <span className="font-bold text-primary">👉 Fonctionnement : </span>
            {info.workflow}
          </div>
        </div>

        {/* Liste des acteurs métiers */}
        <div className="space-y-2 w-full pt-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
            <span>Acteurs Métiers Concernés ({info.users.length})</span>
            <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              Accès directs validés
            </span>
          </div>

          <ul className="space-y-2 w-full box-border list-none p-0 m-0">
            {info.users.map((u) => {
              const tagStyle =
                u.tag === 'Validateur'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : u.tag === 'Destinataire'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : u.tag === 'Superviseur'
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : 'bg-primary/10 text-primary border-primary/20';

              return (
                <li key={u.name} className="flex items-start gap-3 p-3 rounded-xl border border-border/80 bg-background hover:bg-muted/30 transition-all w-full box-border">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow-xs mt-0.5"
                    style={{ backgroundColor: u.color }}
                  >
                    {u.initials}
                  </span>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="text-xs font-bold text-foreground">{u.name}</p>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border shrink-0 ${tagStyle}`}>
                        {u.tag}
                      </span>
                    </div>

                    <p className="text-[11px] text-muted-foreground font-medium leading-snug break-words">
                      {u.role}
                    </p>

                    <div className="pt-1 flex items-center gap-1.5 text-[10px] font-semibold text-primary">
                      <ArrowRight className="h-3 w-3 shrink-0" />
                      <span className="break-words font-medium text-foreground/80">{u.hub}</span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
