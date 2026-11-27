export type HubKey =
  | 'secteurs'
  | 'atelier'
  | 'facturation'
  | 'fournisseurs'
  | 'communication'
  | 'direction'
  | 'commercial';

export type ViewId =
  | 'home'
  | 'favorites'
  | 'secteur_global'
  | 'secteur_natacha'
  | 'secteur_ketty'
  | 'secteur_emilie'
  | 'atelier_erp'
  | 'atelier_vehicules'
  | 'atelier_fournisseurs'
  | 'comm_lea'
  | 'comm_alertes'
  | 'direction_vincent'
  | 'commercial_contrats'
  | 'salaries_rh';

export const PERMISSIONS_BOARD_ID = 5108553085;
export const PERMISSIONS_BOARD_URL = `https://groupefacility.monday.com/boards/${PERMISSIONS_BOARD_ID}`;

// Feature flag : activé pour afficher l'espace Enchantement Salarié dans le Hub Global
export const ENABLE_SALARIES_RH_HUB = true;
// Aperçu privé uniquement pour le compte Guillaume Daniel (si ENABLE_SALARIES_RH_HUB est false)
export const ENABLE_SALARIES_RH_PREVIEW_GUILLAUME = true;

export const PERMISSIONS_COLUMN_IDS = {
  email: 'text_mm9ec0yk',
  secteurs: 'boolean_mm9e8xy4',
  atelier: 'boolean_mm9e38ch',
  facturation: 'boolean_mm9ewccg',
  fournisseurs: 'boolean_mm9eqwn6',
  communication: 'boolean_mm9ex2fe',
  direction: 'boolean_mm9e4xk6',
  commercial: 'boolean_mm9ex175',
} as const;

export const HUB_DEFINITIONS: Array<{
  key: HubKey;
  label: string;
  shortLabel: string;
  columnId: string;
  image: string;
  accentColor: string;
  bgLight: string;
  description: string;
  defaultView: ViewId;
}> = [
  {
    key: 'secteurs',
    label: 'Responsables de Secteur',
    shortLabel: 'Animatrices',
    columnId: PERMISSIONS_COLUMN_IDS.secteurs,
    image: './images/hub-secteurs.jpg',
    accentColor: '#3989B7',
    bgLight: '#EBF6FC',
    description: 'Pilotage des chantiers, contrôles qualité et tournées animatrices',
    defaultView: 'secteur_global',
  },
  {
    key: 'atelier',
    label: 'Atelier & Parc Matériel',
    shortLabel: 'Atelier',
    columnId: PERMISSIONS_COLUMN_IDS.atelier,
    image: './images/hub-atelier.jpg',
    accentColor: '#39A9DC',
    bgLight: '#EBF6FC',
    description: 'Parc machines, fiches de contrôle technique et réparations curatives',
    defaultView: 'atelier_erp',
  },
  {
    key: 'facturation',
    label: 'Facturation & Énergie (Christine)',
    shortLabel: 'Facturation',
    columnId: PERMISSIONS_COLUMN_IDS.facturation,
    image: './images/hub-facturation.jpg',
    accentColor: '#1B4565',
    bgLight: '#EBF6FC',
    description: 'Saisie factures véhicules, TotalEnergies, Chargemap & Bornes Wellborne',
    defaultView: 'atelier_vehicules',
  },
  {
    key: 'fournisseurs',
    label: 'Fournisseurs & SAV',
    shortLabel: 'Fournisseurs',
    columnId: PERMISSIONS_COLUMN_IDS.fournisseurs,
    image: './images/hub-commercial.jpg',
    accentColor: '#3989B7',
    bgLight: '#EBF6FC',
    description: 'Répertoire partenaires consommables, constructeurs et pièces SAV',
    defaultView: 'atelier_fournisseurs',
  },
  {
    key: 'communication',
    label: 'Communication & Contacts (Léa)',
    shortLabel: 'Contacts',
    columnId: PERMISSIONS_COLUMN_IDS.communication,
    image: './images/hub-communication.jpg',
    accentColor: '#D66927',
    bgLight: '#FFF4EB',
    description: 'Annuaire clients et exports contacts chantiers',
    defaultView: 'comm_lea',
  },
  {
    key: 'direction',
    label: 'Hub Véhicules & Flotte',
    shortLabel: 'Véhicules',
    columnId: PERMISSIONS_COLUMN_IDS.direction,
    image: './images/hub-direction.jpg',
    accentColor: '#1B4565',
    bgLight: '#EBF6FC',
    description: 'Parc véhicules, coûts carburant/bornes, géolocalisation GPS & pointages',
    defaultView: 'direction_vincent',
  },
  {
    key: 'commercial',
    label: 'Commercial & Portefeuille',
    shortLabel: 'Commercial',
    columnId: PERMISSIONS_COLUMN_IDS.commercial,
    image: './images/hub-commercial.jpg',
    accentColor: '#B87414',
    bgLight: '#FEF6E7',
    description: 'Indicateurs commerciaux, portefeuille chantiers, gains/pertes, CA & provenance',
    defaultView: 'commercial_contrats',
  },
];

export const ALL_HUB_KEYS: HubKey[] = HUB_DEFINITIONS.map((h) => h.key);

export const VIEW_TO_HUB_KEY: Record<ViewId, HubKey | null> = {
  home: null,
  favorites: null,
  secteur_global: 'secteurs',
  secteur_natacha: 'secteurs',
  secteur_ketty: 'secteurs',
  secteur_emilie: 'secteurs',
  atelier_erp: 'atelier',
  atelier_vehicules: 'facturation',
  atelier_fournisseurs: 'fournisseurs',
  comm_lea: 'communication',
  comm_alertes: 'communication',
  direction_vincent: 'direction',
  commercial_contrats: 'commercial',
  salaries_rh: 'direction',
};
