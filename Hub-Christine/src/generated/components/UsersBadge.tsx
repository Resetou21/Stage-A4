import { useState } from 'react';
import { Users, ShieldCheck, CheckCircle2, Building, ArrowRight, UserCheck, Info, ChevronDown, ChevronUp } from 'lucide-react';
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
  purpose: string;
  workflow: string;
  users: BusinessUser[];
}> = {
  // 1. Données facturation véhicules (Board 5092124669)
  5092124669: {
    hubTitle: 'Hub Facturation Véhicules ➔ Hub Suivi Véhicules',
    boardName: 'Data sur véhicule',
    purpose: 'Historique complet des coûts d’exploitation par véhicule (révisions, entretiens, pneumatiques, réparations).',
    workflow: 'Christine saisit les factures véhicules avec validation obligatoire de la date et du montant. Vincent exploite ces données pour l’analyse des coûts de flotte.',
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
        role: 'Supervision Flotte & Coûts analytiques',
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
    purpose: 'Rapprochement des consommations des badges de recharge électrique et imputation analytique par véhicule.',
    workflow: 'Seul Vincent effectue le check et le rapprochement des badges Chargemap. Christine gère l’import du fichier avec contrôle strict anti-doublons.',
    users: [
      {
        name: 'Vincent',
        role: 'Validateur Unique Chargemap (Check badges & conso)',
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
    purpose: 'Suivi bi-mensuel des consommations carburant (quinzaines du 15 et du 30/fin de mois) et suivi du parc thermique.',
    workflow: 'Christine importe les 2 factures mensuelles avec gestion des doublons sur les dates du 15 et du 30. Laurent GUILLOU gère les cartes Total.',
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
    hubTitle: 'Hub Facturation Énergie ➔ Hub Véhicules & Énergie',
    boardName: 'Data Wellborne (Bornes)',
    purpose: 'Téléchargement et intégration des charges des bornes privatives (filtre strict > 15-05 et compteur mensuel).',
    workflow: 'Christine télécharge le fichier Wellborne, élimine les doublons déjà présents sur Monday (+4000 lignes) et Vincent suit les kWh délivrés.',
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
    boardName: 'Réparation machines (ERP)',
    purpose: 'Notification instantanée vers l’Atelier lors de la réception d’une facture de réparation matériel.',
    workflow: 'Quand Christine saisit une facture réparation, un ticket curatif « À traiter » est créé pour Christophe avec le détail de l’intervention pour qu’il l’affecte à la machine.',
    users: [
      {
        name: 'Christophe',
        role: 'Responsable Atelier & Parc Machines (Affectation machine)',
        email: 'atelier@groupefacility.fr',
        hub: 'Hub ERP Parc Matériel (Atelier)',
        tag: 'Destinataire',
        initials: 'CH',
        color: '#E11D48',
      },
      {
        name: 'Christine GUILLOU',
        role: 'Enregistrement Facture Réparation & Alerte',
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
  const [expanded, setExpanded] = useState(false);

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

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between text-base font-bold pr-6">
            <div className="flex items-center gap-2">
              <Building className="h-4 w-4 text-primary" />
              <span>Qui utilise ces données &amp; sur quel Hub ?</span>
            </div>
            {/* Bouton petit (i) pour agrandir / réduire */}
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className={`inline-flex h-7 w-7 items-center justify-center rounded-full transition-all cursor-pointer ${
                expanded
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
              }`}
              title={expanded ? "Réduire l'explication" : "Agrandir l'explication (i)"}
              aria-label="Agrandir ou réduire les informations"
            >
              <Info className="h-4 w-4" />
            </button>
          </DialogTitle>
        </DialogHeader>

        {/* Encadré Hub & Finalité métier - Collapsible avec le bouton (i) */}
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2 transition-all">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold text-primary min-w-0">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              <span className="truncate">Flux : {info.hubTitle}</span>
            </div>
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline cursor-pointer shrink-0 ml-2"
            >
              <Info className="h-3 w-3" />
              <span>{expanded ? 'Réduire' : 'Agrandir (i)'}</span>
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          </div>

          {expanded && (
            <div className="space-y-2 pt-2 border-t border-primary/10 animate-in fade-in-0 duration-150">
              <div className="text-xs text-foreground font-semibold">
                Tableau Monday : <span className="font-bold text-primary">{info.boardName}</span>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                <strong>Finalité métier :</strong> {info.purpose}
              </p>

              <div className="text-[11px] bg-background/80 p-2 rounded-lg border border-border text-foreground">
                👉 <strong>Fonctionnement :</strong> {info.workflow}
              </div>
            </div>
          )}
        </div>

        {/* Liste des vrais acteurs métiers */}
        <div className="mt-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center justify-between">
            <span>Utilisateurs Métiers Réels ({info.users.length})</span>
            <span className="text-[10px] lowercase font-normal">aucun compte technique</span>
          </p>

          <ul className="divide-y divide-border rounded-xl border border-border bg-card p-2 space-y-1">
            {info.users.map((u) => {
              const tagBg =
                u.tag === 'Validateur'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : u.tag === 'Destinataire'
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : u.tag === 'Superviseur'
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : 'bg-primary/10 text-primary border-primary/20';

              return (
                <li key={u.name} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/40 transition-colors">
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow-xs"
                    style={{ backgroundColor: u.color }}
                  >
                    {u.initials}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-xs font-bold text-foreground">{u.name}</p>
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold border ${tagBg}`}>
                        {u.tag}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground font-medium leading-tight mt-0.5">{u.role}</p>
                    <p className="text-[10px] text-primary/80 font-semibold mt-0.5 flex items-center gap-1">
                      <ArrowRight className="h-2.5 w-2.5" /> {u.hub}
                    </p>
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
