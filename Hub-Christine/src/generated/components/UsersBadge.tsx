import { Users, ArrowRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@components/ui/dialog';

interface Props {
  boardId: number;
}

interface BusinessUser {
  name: string;
  role: string;
  hub: string;
  tag: 'Validateur' | 'Gestionnaire' | 'Destinataire' | 'Superviseur';
  initials: string;
  color: string;
}

const BUSINESS_USERS_MAP: Record<number, BusinessUser[]> = {
  // 1. Données facturation véhicules (Board 5092124669)
  5092124669: [
    {
      name: 'Christine GUILLOU',
      role: 'Saisie des dépenses & Facturation Véhicules',
      hub: 'Hub Facturation (Christine)',
      tag: 'Gestionnaire',
      initials: 'CG',
      color: '#3989B7',
    },
    {
      name: 'Vincent',
      role: 'Supervision Flotte & Analyse analytique des coûts',
      hub: 'Hub Suivi Véhicules',
      tag: 'Superviseur',
      initials: 'VR',
      color: '#00C875',
    },
  ],
  // 2. Factures Chargemap (Board 5092349771)
  5092349771: [
    {
      name: 'Vincent',
      role: 'Validateur Unique Chargemap',
      hub: 'Hub Suivi Véhicules & Électrique',
      tag: 'Validateur',
      initials: 'VR',
      color: '#00C875',
    },
    {
      name: 'Christine GUILLOU',
      role: 'Importation mensuelle & Détection des doublons',
      hub: 'Hub Facturation (Christine)',
      tag: 'Gestionnaire',
      initials: 'CG',
      color: '#3989B7',
    },
  ],
  // 3. Factures Total (Board 5092674084)
  5092674084: [
    {
      name: 'Christine GUILLOU',
      role: 'Importation Factures Bi-mensuelles (15 & 30)',
      hub: 'Hub Facturation (Christine)',
      tag: 'Gestionnaire',
      initials: 'CG',
      color: '#3989B7',
    },
    {
      name: 'Laurent GUILLOU',
      role: 'Gestionnaire Cartes Carburant & Parc Total',
      hub: 'Tableau Factures TOTAL Laurent GUILLOU',
      tag: 'Destinataire',
      initials: 'LG',
      color: '#F7AC37',
    },
  ],
  // 4. Montant Wellborne (Board 5106822028)
  5106822028: [
    {
      name: 'Christine GUILLOU',
      role: 'Importateur Données Bornes & Contrôle Doublons',
      hub: 'Hub Facturation (Christine)',
      tag: 'Gestionnaire',
      initials: 'CG',
      color: '#3989B7',
    },
    {
      name: 'Vincent',
      role: 'Suivi Énergie & Rapprochement Bornes',
      hub: 'Hub Suivi Véhicules',
      tag: 'Superviseur',
      initials: 'VR',
      color: '#00C875',
    },
  ],
  // 5. Réparations Matériel (Board 5106693291)
  5106693291: [
    {
      name: 'Christophe',
      role: 'Responsable Atelier & Maintenance du Parc Machines',
      hub: 'Hub Parc Matériel & Atelier',
      tag: 'Destinataire',
      initials: 'CH',
      color: '#D66927',
    },
    {
      name: 'Christine GUILLOU',
      role: 'Enregistrement Facture Réparation & Alerte Atelier',
      hub: 'Hub Facturation (Christine)',
      tag: 'Gestionnaire',
      initials: 'CG',
      color: '#3989B7',
    },
  ],
};

export default function UsersBadge({ boardId }: Props) {
  const users = BUSINESS_USERS_MAP[boardId];

  if (!users || users.length === 0) return null;

  return (
    <Dialog>
      <DialogTrigger
        aria-label="Personnes concernées"
        className="-mt-2 inline-flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-full bg-muted/60 px-2.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground cursor-pointer shadow-xs"
        title="Personnes concernées"
      >
        <Users className="h-3.5 w-3.5 text-primary" />
        <span className="font-bold text-foreground">{users.length}</span>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[420px] rounded-2xl border border-border bg-card shadow-2xl">
        <DialogHeader className="pr-8">
          <DialogTitle className="flex items-center gap-2 text-sm font-bold text-foreground">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
              <Users className="h-4 w-4" />
            </span>
            <span>Personnes concernées ({users.length})</span>
          </DialogTitle>
        </DialogHeader>

        <ul className="space-y-2 w-full box-border list-none p-0 m-0 pt-1">
          {users.map((u) => {
            const tagStyle =
              u.tag === 'Validateur'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : u.tag === 'Destinataire'
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : u.tag === 'Superviseur'
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : 'bg-primary/10 text-primary border-primary/20';

            return (
              <li
                key={u.name}
                className="flex items-start gap-3 p-3 rounded-xl border border-border/80 bg-background hover:bg-muted/30 transition-all w-full box-border"
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow-xs mt-0.5"
                  style={{ backgroundColor: u.color }}
                >
                  {u.initials}
                </span>

                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-xs font-bold text-foreground">{u.name}</p>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border shrink-0 ${tagStyle}`}>
                      {u.tag}
                    </span>
                  </div>

                  <p className="text-[11px] text-muted-foreground font-medium leading-snug break-words">
                    {u.role}
                  </p>

                  <div className="pt-0.5 flex items-center gap-1.5 text-[10px] font-semibold text-primary">
                    <ArrowRight className="h-3 w-3 shrink-0" />
                    <span className="break-words font-medium text-foreground/80">{u.hub}</span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
