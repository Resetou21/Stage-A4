import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  Calculator,
  ExternalLink,
  Filter,
  Search,
  Shield,
  Table2,
  X,
} from 'lucide-react';

interface DataRulesAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type AuditCategory =
  | 'all'
  | 'global'
  | 'commercial'
  | 'secteurs'
  | 'atelier'
  | 'vehicules'
  | 'facturation'
  | 'contacts';

interface FilterRow {
  connector: 'Où' | 'et' | 'ou';
  column: string;
  operator: string;
  values: Array<{ label: string; color?: string }>;
}

interface WidgetRuleCard {
  id: string;
  hub: Exclude<AuditCategory, 'all'>;
  hubLabel: string;
  accentColor: string;
  widgetTitle: string;
  boardName: string;
  boardId: string;
  filters: FilterRow[];
  formulaNote?: string;
}

const WIDGET_RULES: WidgetRuleCard[] = [
  // ==================== HUB GLOBAL ====================
  {
    id: 'global-chantiers-actifs',
    hub: 'global',
    hubLabel: 'Hub Global',
    accentColor: '#1B4565',
    widgetTitle: 'Chantiers actifs & Répartition par secteur (Accueil)',
    boardName: 'Tableau complet chantier',
    boardId: '1976599627',
    filters: [
      {
        connector: 'Où',
        column: 'Groupe',
        operator: 'Est',
        values: [{ label: 'Liste des chantiers en cours', color: '#00C875' }],
      },
      {
        connector: 'et',
        column: 'Animateur',
        operator: 'Regroupé par',
        values: [
          { label: 'Natacha THOMAS', color: '#3989B7' },
          { label: 'Ketty PAULIN', color: '#39A9DC' },
          { label: 'Emilie TOBIE', color: '#D66927' },
        ],
      },
    ],
  },
  {
    id: 'global-satisfaction',
    hub: 'global',
    hubLabel: 'Hub Global',
    accentColor: '#0E7042',
    widgetTitle: 'Taux de satisfaction client (Année en cours)',
    boardName: 'Visites clients',
    boardId: '1977798116',
    filters: [
      {
        connector: 'Où',
        column: 'Date de visite',
        operator: 'Est supérieure ou égale à',
        values: [{ label: '1er janvier de l’année en cours', color: '#3989B7' }],
      },
      {
        connector: 'et',
        column: 'Qualité de la prestation',
        operator: 'N’est pas',
        values: [{ label: 'Vide', color: '#64748B' }],
      },
    ],
    formulaNote: 'Satisfaction (%) = Nombre de visites « Globalement bon » ÷ Nombre total de visites notées × 100.',
  },
  {
    id: 'global-permissions',
    hub: 'global',
    hubLabel: 'Hub Global',
    accentColor: '#1B4565',
    widgetTitle: 'Affichage des Hubs par collaborateur (Oui / Non)',
    boardName: '🔐 Autorisations Hubs',
    boardId: '5108553085',
    filters: [
      {
        connector: 'Où',
        column: 'Adresse e-mail (ou Nom)',
        operator: 'Correspond à',
        values: [{ label: 'L’utilisateur connecté sur Monday', color: '#1B4565' }],
      },
      {
        connector: 'et',
        column: 'Case du Hub concerné',
        operator: 'Est',
        values: [{ label: 'Cochée (Oui)', color: '#00C875' }],
      },
    ],
    formulaNote: 'Masque ou affiche les tuiles dans le Hub Global. Les vrais droits lecture/écriture (Membre vs Observateur) restent protégés par Monday.',
  },

  // ==================== HUB COMMERCIAL ====================
  {
    id: 'comm-gains-pertes',
    hub: 'commercial',
    hubLabel: 'Hub Commercial',
    accentColor: '#B87414',
    widgetTitle: 'Gains & Pertes de chantiers (par année)',
    boardName: 'Tableau complet chantier',
    boardId: '1976599627',
    filters: [
      {
        connector: 'Où',
        column: 'Groupe',
        operator: 'Inclut',
        values: [
          { label: 'Chantiers en cours', color: '#00C875' },
          { label: 'Chantiers arrêtés', color: '#E2445C' },
        ],
      },
      {
        connector: 'et',
        column: 'Date « + chantiers » (Gain)',
        operator: 'Est dans',
        values: [{ label: 'L’année sélectionnée', color: '#00C875' }],
      },
      {
        connector: 'ou',
        column: 'Date « - chantiers » (Perte)',
        operator: 'Est dans',
        values: [{ label: 'L’année sélectionnée', color: '#E2445C' }],
      },
    ],
    formulaNote: 'Ventilation croisée par Tranche de CA annuel, Volume d’heures / mois, Provenance, Activité et Secteur (y compris « Non assigné »).',
  },

  // ==================== HUB ANIMATRICES / SECTEURS ====================
  {
    id: 'secteurs-alerte-3-insatisfaits',
    hub: 'secteurs',
    hubLabel: 'Animatrices',
    accentColor: '#E2445C',
    widgetTitle: 'Alerte — Clients insatisfaits (3 contrôles de suite)',
    boardName: 'Tableau complet chantier',
    boardId: '1976599627',
    filters: [
      {
        connector: 'Où',
        column: 'Groupe',
        operator: 'Est',
        values: [{ label: 'Liste des chantiers en cours', color: '#00C875' }],
      },
      {
        connector: 'et',
        column: 'Animateur',
        operator: 'Est',
        values: [{ label: 'L’animatrice sélectionnée', color: '#3989B7' }],
      },
      {
        connector: 'et',
        column: 'Dernier contrôle (C1)',
        operator: 'Est',
        values: [
          { label: 'Bases non respectées', color: '#FDAB3D' },
          { label: 'Plan d’action urgent', color: '#E2445C' },
        ],
      },
      {
        connector: 'et',
        column: 'Avant-dernier contrôle (C2)',
        operator: 'Est',
        values: [
          { label: 'Bases non respectées', color: '#FDAB3D' },
          { label: 'Plan d’action urgent', color: '#E2445C' },
        ],
      },
      {
        connector: 'et',
        column: '3e contrôle avant (C3)',
        operator: 'Est',
        values: [
          { label: 'Bases non respectées', color: '#FDAB3D' },
          { label: 'Plan d’action urgent', color: '#E2445C' },
        ],
      },
    ],
    formulaNote: 'Aussi déclenché si la colonne « Alerte 2 » est supérieure à 0. Jamais compté si un seul contrôle est mauvais.',
  },
  {
    id: 'secteurs-alerte-2mois-insatisfait',
    hub: 'secteurs',
    hubLabel: 'Animatrices',
    accentColor: '#D66927',
    widgetTitle: 'Alerte — Contrôle insatisfaisant sans vérification (> 2 mois)',
    boardName: 'Tableau complet chantier',
    boardId: '1976599627',
    filters: [
      {
        connector: 'Où',
        column: 'Groupe',
        operator: 'Est',
        values: [{ label: 'Liste des chantiers en cours', color: '#00C875' }],
      },
      {
        connector: 'et',
        column: 'Dernier contrôle (C1)',
        operator: 'Est',
        values: [
          { label: 'Bases non respectées', color: '#FDAB3D' },
          { label: 'Plan d’action urgent', color: '#E2445C' },
        ],
      },
      {
        connector: 'et',
        column: 'Date du dernier contrôle',
        operator: 'Est antérieure à',
        values: [{ label: 'Il y a 2 mois', color: '#D66927' }],
      },
    ],
    formulaNote: 'Également inclus si la colonne « Alerte 3 » vaut 1.',
  },
  {
    id: 'secteurs-alerte-11mois',
    hub: 'secteurs',
    hubLabel: 'Animatrices',
    accentColor: '#F7AC37',
    widgetTitle: 'Alerte — Chantiers non vus depuis 11 mois',
    boardName: 'Tableau complet chantier',
    boardId: '1976599627',
    filters: [
      {
        connector: 'Où',
        column: 'Groupe',
        operator: 'Est',
        values: [{ label: 'Liste des chantiers en cours', color: '#00C875' }],
      },
      {
        connector: 'et',
        column: 'Animateur',
        operator: 'Est',
        values: [{ label: 'L’animatrice sélectionnée', color: '#3989B7' }],
      },
      {
        connector: 'et',
        column: 'Date du dernier contrôle',
        operator: 'Est antérieure ou égale à',
        values: [{ label: 'Il y a 11 mois', color: '#F7AC37' }],
      },
    ],
  },
  {
    id: 'secteurs-visites-2mois',
    hub: 'secteurs',
    hubLabel: 'Animatrices',
    accentColor: '#3989B7',
    widgetTitle: 'Alerte — Visites des 2 mois (nouveaux chantiers)',
    boardName: 'Tableau complet chantier',
    boardId: '1976599627',
    filters: [
      {
        connector: 'Où',
        column: 'Groupe',
        operator: 'Est',
        values: [{ label: 'Liste des chantiers en cours', color: '#00C875' }],
      },
      {
        connector: 'et',
        column: 'Texte d’alerte animatrice',
        operator: 'N’est pas',
        values: [{ label: 'Vide', color: '#64748B' }],
      },
      {
        connector: 'et',
        column: 'Case « RDV 2 mois »',
        operator: 'Est',
        values: [{ label: 'Non cochée', color: '#D66927' }],
      },
    ],
  },
  {
    id: 'secteurs-etoiles',
    hub: 'secteurs',
    hubLabel: 'Animatrices',
    accentColor: '#00C875',
    widgetTitle: 'Jauges Étoiles (3🌟 · 2🌟 · 1🌟 · 🙁)',
    boardName: 'Tableau complet chantier',
    boardId: '1976599627',
    filters: [
      {
        connector: 'Où',
        column: '3 Étoiles 🌟🌟🌟',
        operator: 'Lorsque',
        values: [{ label: 'C1 + C2 + C3 = Globalement bon', color: '#00C875' }],
      },
      {
        connector: 'ou',
        column: '2 Étoiles 🌟🌟',
        operator: 'Lorsque',
        values: [{ label: 'C1 + C2 = Globalement bon (pas C3)', color: '#39A9DC' }],
      },
      {
        connector: 'ou',
        column: '1 Étoile 🌟',
        operator: 'Lorsque',
        values: [{ label: 'C1 = Globalement bon (pas C2)', color: '#F7AC37' }],
      },
      {
        connector: 'ou',
        column: 'Insatisfait 🙁',
        operator: 'Lorsque',
        values: [{ label: 'C1 = Bases non respectées ou Plan d’action urgent', color: '#E2445C' }],
      },
    ],
  },
  {
    id: 'secteurs-inventaires',
    hub: 'secteurs',
    hubLabel: 'Animatrices',
    accentColor: '#3989B7',
    widgetTitle: 'Inventaires consommables à faire & Actions à mener',
    boardName: 'Inventaires consommables',
    boardId: '5105902205',
    filters: [
      {
        connector: 'Où',
        column: 'À faire — Groupe',
        operator: 'Est',
        values: [{ label: 'Inventaire des consommables', color: '#3989B7' }],
      },
      {
        connector: 'et',
        column: 'Inventaire validé OK',
        operator: 'Est',
        values: [{ label: 'Non coché', color: '#D66927' }],
      },
      {
        connector: 'et',
        column: 'Date du dernier inventaire',
        operator: 'Dépasse',
        values: [{ label: '182 jours (6 mois) ou jamais fait', color: '#F7AC37' }],
      },
      {
        connector: 'ou',
        column: 'Actions suite inventaire — Groupe',
        operator: 'Est',
        values: [{ label: 'Inventaires réalisés (ligne la plus récente par chantier)', color: '#00C875' }],
      },
      {
        connector: 'et',
        column: 'Récupération ou Avenant',
        operator: 'Est',
        values: [{ label: 'Quantité > 0 et case non cochée', color: '#D66927' }],
      },
    ],
    formulaNote:
      'Stock Mini = (Contrat ÷ 12) × 2 (minimum 1) · À Récupérer = Inventaire − Stock Mini · Avenant = minimum entre À Récupérer et 25 % du Contrat · Économies = Quantité × Prix Unitaire HT.',
  },
  {
    id: 'secteurs-messages-whatsapp',
    hub: 'secteurs',
    hubLabel: 'Animatrices',
    accentColor: '#0E7042',
    widgetTitle: 'Rappels Communication & Accompagnement WhatsApp',
    boardName: 'Communication animatrices / Liste des Salariés (Pole RH)',
    boardId: '5044808167',
    filters: [
      {
        connector: 'Où',
        column: 'Messages — Personne concernée',
        operator: 'Est',
        values: [{ label: 'L’animatrice sélectionnée', color: '#3989B7' }],
      },
      {
        connector: 'et',
        column: 'Case « Vu »',
        operator: 'Est',
        values: [{ label: 'Non cochée', color: '#D66927' }],
      },
      {
        connector: 'et',
        column: 'Annuaire WhatsApp — Statut RH',
        operator: 'N’est pas',
        values: [{ label: 'Sorti', color: '#E2445C' }],
      },
    ],
    formulaNote: 'Modèles partagés enregistrés avec le statut « Modèle ». Traduction automatique déclenchée dès que la langue RH du salarié est différente de « Français ».',
  },

  // ==================== ERP ATELIER ====================
  {
    id: 'atelier-controle-reparation',
    hub: 'atelier',
    hubLabel: 'ERP Atelier',
    accentColor: '#39A9DC',
    widgetTitle: 'Contrôles techniques & Bascule automatique en Réparation',
    boardName: 'Fiche de Contrôle ➔ Réparation machines',
    boardId: '5106693291',
    filters: [
      {
        connector: 'Où',
        column: 'Point de contrôle machine',
        operator: 'Est noté',
        values: [{ label: 'Non Conforme (NC)', color: '#E2445C' }],
      },
      {
        connector: 'et',
        column: 'Action automatique à la validation',
        operator: 'Crée',
        values: [{ label: 'Un ticket Curatif « À traiter » + compte-rendu détaillé', color: '#39A9DC' }],
      },
      {
        connector: 'et',
        column: 'Checklist de réparation',
        operator: 'Lorsque',
        values: [{ label: 'Tous les points défaillants sont cochés ➔ Passe en « Réparée / Conforme »', color: '#00C875' }],
      },
    ],
    formulaNote: 'Les heures compteur saisies dans la fiche mettent aussi à jour automatiquement la fiche machine dans « Liste des machines ».',
  },

  // ==================== HUB VÉHICULES & GPS ====================
  {
    id: 'vehicules-parc',
    hub: 'vehicules',
    hubLabel: 'Hub Véhicules',
    accentColor: '#1B4565',
    widgetTitle: 'Parc actif, Coûts fixes mensuels & Top consommations (6 mois)',
    boardName: '❎Suivi du parc véhicules / Data sur véhicule',
    boardId: '5092005027',
    filters: [
      {
        connector: 'Où',
        column: 'Statut du véhicule — Groupe',
        operator: 'Est',
        values: [{ label: 'Véhicules en service', color: '#00C875' }],
      },
      {
        connector: 'et',
        column: 'Liaison des factures & contrôles',
        operator: 'Toujours par',
        values: [{ label: 'Plaque d’immatriculation officielle (AA-123-AA)', color: '#1B4565' }],
      },
      {
        connector: 'et',
        column: 'Top consommations',
        operator: 'Période',
        values: [{ label: '6 derniers mois glissants (Carburant + Chargemap + Wellborne)', color: '#3989B7' }],
      },
    ],
    formulaNote: 'Coûts fixes mensuels : recopiés chaque nouveau mois uniquement pour les véhicules encore en service (arrêt automatique dès qu’un véhicule est restitué).',
  },
  {
    id: 'vehicules-geoloc-exclusions',
    hub: 'vehicules',
    hubLabel: 'Hub Véhicules (GPS)',
    accentColor: '#D66927',
    widgetTitle: 'Géolocalisation — Alertes, Exclusions Domicile ↔ Travail & Pointage',
    boardName: '🗂️ Pointage & Détails Journaliers GPS',
    boardId: '5108589918',
    filters: [
      {
        connector: 'Où',
        column: 'Alerte « Hors horaires »',
        operator: 'Déclenchée si',
        values: [{ label: 'Trajet avant 04h30 ou après 19h30', color: '#D66927' }],
      },
      {
        connector: 'ou',
        column: 'Alerte « Week-end »',
        operator: 'Déclenchée si',
        values: [{ label: 'Trajet le Samedi ou le Dimanche', color: '#9333EA' }],
      },
      {
        connector: 'et',
        column: 'Case « Exclure Domicile ↔ Travail »',
        operator: 'Si cochée',
        values: [
          { label: '1er trajet exclu ➔ début utile = arrivée 1er site', color: '#00C875' },
          { label: 'Dernier trajet exclu ➔ fin utile = départ dernier site', color: '#00C875' },
        ],
      },
      {
        connector: 'et',
        column: 'Sélecteur Salariés (Pointage)',
        operator: 'Alimenté par',
        values: [{ label: 'Liste des Salariés (Pole RH) — hors statut « Sorti »', color: '#3989B7' }],
      },
      {
        connector: 'et',
        column: 'Archivage automatique (> 6 mois)',
        operator: 'Cible',
        values: [{ label: 'Les semaines de plus de 180 jours (archives illimitées Monday)', color: '#F7AC37' }],
      },
    ],
    formulaNote: '1 ligne = 1 véhicule × 1 journée (~175 lignes/semaine, tous les trajets conservés) · Écart horaire signé (+15/+30/+60 min en plus ou −15/−30/−60 min en moins).',
  },

  // ==================== FACTURATION CHRISTINE ====================
  {
    id: 'facturation-imports',
    hub: 'facturation',
    hubLabel: 'Facturation (Christine)',
    accentColor: '#1B4565',
    widgetTitle: 'Imports factures Énergie (Total, Chargemap, Wellborne)',
    boardName: 'Data sur véhicule / Data wellborne',
    boardId: '5092124669',
    filters: [
      {
        connector: 'Où',
        column: 'Import Chargemap',
        operator: 'Applique',
        values: [{ label: 'Dédoublonnage strict avant création des lignes', color: '#00C875' }],
      },
      {
        connector: 'et',
        column: 'Import TotalEnergies',
        operator: 'Gère',
        values: [{ label: '2 factures par mois (quinzaines du 15 et du 30)', color: '#3989B7' }],
      },
      {
        connector: 'et',
        column: 'Import Wellborne — Date',
        operator: 'Est postérieure au',
        values: [{ label: '15 mai (lignes antérieures ignorées automatiquement)', color: '#D66927' }],
      },
    ],
    formulaNote: 'Saisie manuelle factures véhicules : liste des véhicules triée par ordre alphabétique, Date et Montant HT obligatoires.',
  },

  // ==================== CONTACTS LÉA ====================
  {
    id: 'contacts-lea',
    hub: 'contacts',
    hubLabel: 'Contacts (Léa)',
    accentColor: '#D66927',
    widgetTitle: 'Annuaire Interlocuteurs & Exports Excel',
    boardName: 'Tableau complet chantier',
    boardId: '1976599627',
    filters: [
      {
        connector: 'Où',
        column: 'Groupe',
        operator: 'Est',
        values: [{ label: 'Liste des chantiers en cours', color: '#00C875' }],
      },
      {
        connector: 'et',
        column: 'Mode d’accès',
        operator: 'Est',
        values: [{ label: 'Lecture seule (aucune modification sur Monday)', color: '#3989B7' }],
      },
    ],
    formulaNote: 'Regroupe Interlocuteur, Téléphone, E-mail, Ville, Code postal et Animateur avec export Excel aux couleurs Groupe Facility.',
  },
];

const TABS: Array<{ id: AuditCategory; label: string }> = [
  { id: 'all', label: 'Tous les Hubs' },
  { id: 'global', label: 'Hub Global' },
  { id: 'commercial', label: 'Commercial' },
  { id: 'secteurs', label: 'Animatrices' },
  { id: 'atelier', label: 'ERP Atelier' },
  { id: 'vehicules', label: 'Véhicules & GPS' },
  { id: 'facturation', label: 'Facturation' },
  { id: 'contacts', label: 'Contacts' },
];

export default function DataRulesAuditModal({ isOpen, onClose }: DataRulesAuditModalProps) {
  const [activeTab, setActiveTab] = useState<AuditCategory>('all');
  const [search, setSearch] = useState('');

  const filteredRules = useMemo(() => {
    const q = search.trim().toLowerCase();
    return WIDGET_RULES.filter((r) => {
      if (activeTab !== 'all' && r.hub !== activeTab) return false;
      if (!q) return true;
      const hay = [
        r.hubLabel,
        r.widgetTitle,
        r.boardName,
        r.formulaNote || '',
        ...r.filters.map((f) => `${f.column} ${f.operator} ${f.values.map((v) => v.label).join(' ')}`),
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [activeTab, search]);

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="modal-backdrop-in facility-modal-overlay"
      style={{
        backgroundColor: 'rgba(15, 23, 42, 0.62)',
        backdropFilter: 'blur(6px)',
        zIndex: 270,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="modal-spring-in"
        style={{
          width: '1040px',
          maxWidth: '100%',
          maxHeight: '100%',
          backgroundColor: '#FFFFFF',
          borderRadius: '20px',
          border: '1px solid #D7EAF5',
          boxShadow: '0 24px 60px rgba(27, 69, 101, 0.30)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header Admin */}
        <div
          style={{
            padding: '16px 22px',
            backgroundColor: '#1B4565',
            backgroundImage: 'linear-gradient(135deg, #1B4565 0%, #2B658E 60%, #3989B7 100%)',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                backgroundColor: 'rgba(57, 169, 220, 0.25)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <BookOpen size={19} color="#FFFFFF" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontFamily: "'Ruda', sans-serif", fontSize: '16.5px', fontWeight: 900, color: '#FFFFFF' }}>
                  Filtres &amp; Règles Appliquées sur tous les Hubs
                </h2>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '2px 8px',
                    borderRadius: '999px',
                    backgroundColor: 'rgba(247, 172, 55, 0.24)',
                    border: '1px solid rgba(247, 172, 55, 0.6)',
                    color: '#FEF6E7',
                    fontSize: '10px',
                    fontWeight: 800,
                  }}
                >
                  <Shield size={10} />
                  ADMIN UNIQUEMENT
                </span>
              </div>
              <p style={{ margin: '2px 0 0 0', fontSize: '11.5px', color: 'rgba(255,255,255,0.84)' }}>
                Visualisez clairement quels tableaux et quels filtres sont appliqués pour obtenir chaque chiffre, alerte et tableau dans vos Hubs.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: 'rgba(255,255,255,0.14)',
              color: '#FFFFFF',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Barre recherche + onglets Hub */}
        <div
          style={{
            padding: '12px 22px',
            backgroundColor: '#F4F9FC',
            borderBottom: '1px solid #D7EAF5',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '220px', maxWidth: '420px' }}>
              <Search size={14} color="#64748B" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un indicateur ou filtre (ex : 11 mois, étoiles, Domicile, Wellborne...)"
                style={{
                  width: '100%',
                  padding: '7px 10px 7px 32px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '12px',
                  backgroundColor: '#FFFFFF',
                  color: '#1B4565',
                  outline: 'none',
                }}
              />
            </div>

            <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#3989B7', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
              <Filter size={12} />
              {filteredRules.length} vue{filteredRules.length > 1 ? 's' : ''} filtrée{filteredRules.length > 1 ? 's' : ''}
            </span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {TABS.map((t) => {
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id)}
                  style={{
                    padding: '5px 11px',
                    borderRadius: '999px',
                    border: active ? '1px solid #1B4565' : '1px solid #CBD5E1',
                    backgroundColor: active ? '#1B4565' : '#FFFFFF',
                    color: active ? '#FFFFFF' : '#475569',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Cartes de filtres visuels façon Dashboard Monday */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 22px', backgroundColor: '#FAFCFE' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {filteredRules.map((card) => (
            <div
              key={card.id}
              style={{
                flexShrink: 0,
                borderRadius: '14px',
                border: '1px solid #D7EAF5',
                backgroundColor: '#FFFFFF',
                overflow: 'hidden',
                boxShadow: '0 2px 10px rgba(27, 69, 101, 0.05)',
              }}
            >
              {/* Bandeau titre du widget (style tableau de bord) */}
              <div
                style={{
                  padding: '11px 16px',
                  backgroundColor: '#F4F9FC',
                  borderBottom: '1px solid #E2EFF7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      padding: '2px 9px',
                      borderRadius: '999px',
                      backgroundColor: `${card.accentColor}16`,
                      color: card.accentColor,
                      border: `1px solid ${card.accentColor}38`,
                      fontSize: '10.5px',
                      fontWeight: 800,
                    }}
                  >
                    {card.hubLabel}
                  </span>
                  <h3 style={{ margin: 0, fontFamily: "'Ruda', sans-serif", fontSize: '14px', fontWeight: 800, color: '#1B4565' }}>
                    {card.widgetTitle}
                  </h3>
                </div>

                {/* Pilule Tableau source (style sélecteur Tableau Monday) */}
                <a
                  href={`https://groupefacility.monday.com/boards/${card.boardId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Ouvrir ce tableau sur Monday"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 10px',
                    borderRadius: '8px',
                    border: '1.5px solid #39A9DC',
                    backgroundColor: '#FFFFFF',
                    color: '#1B4565',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    textDecoration: 'none',
                  }}
                >
                  <Table2 size={13} color="#39A9DC" />
                  <span>{card.boardName}</span>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: '18px',
                      height: '18px',
                      padding: '0 5px',
                      borderRadius: '999px',
                      backgroundColor: '#39A9DC',
                      color: '#FFFFFF',
                      fontSize: '10px',
                      fontWeight: 800,
                    }}
                  >
                    {card.filters.length}
                  </span>
                  <ExternalLink size={11} color="#64748B" />
                </a>
              </div>

              {/* Corps : Lignes de filtres visuels façon "Où / et / ou" de Monday */}
              <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {card.filters.map((f, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      flexWrap: 'wrap',
                    }}
                  >
                    {/* Connecteur Où / et / ou */}
                    <span
                      style={{
                        width: '36px',
                        textAlign: 'right',
                        fontSize: '11.5px',
                        fontWeight: 800,
                        color: f.connector === 'ou' ? '#D66927' : '#64748B',
                        flexShrink: 0,
                      }}
                    >
                      {f.connector}
                    </span>

                    {/* Boîte Colonne */}
                    <span
                      style={{
                        padding: '5px 11px',
                        borderRadius: '7px',
                        border: '1px solid #CBD5E1',
                        backgroundColor: '#FFFFFF',
                        color: '#1B4565',
                        fontSize: '12px',
                        fontWeight: 700,
                        minWidth: '170px',
                      }}
                    >
                      {f.column}
                    </span>

                    {/* Boîte Opérateur */}
                    <span
                      style={{
                        padding: '5px 10px',
                        borderRadius: '7px',
                        border: '1px solid #E2E8F0',
                        backgroundColor: '#F8FAFC',
                        color: '#475569',
                        fontSize: '11.5px',
                        fontWeight: 600,
                      }}
                    >
                      {f.operator}
                    </span>

                    {/* Boîte Valeur(s) en pilules colorées */}
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '5px',
                        padding: '4px 8px',
                        borderRadius: '7px',
                        border: '1px solid #CBD5E1',
                        backgroundColor: '#FFFFFF',
                        flex: 1,
                        minWidth: '180px',
                      }}
                    >
                      {f.values.map((val, vIdx) => {
                        const dotColor = val.color || '#3989B7';
                        return (
                          <span
                            key={vIdx}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '2px 9px',
                              borderRadius: '6px',
                              backgroundColor: '#EBF6FC',
                              color: '#1B4565',
                              fontSize: '11.5px',
                              fontWeight: 700,
                            }}
                          >
                            <span
                              style={{
                                width: '7px',
                                height: '7px',
                                borderRadius: '999px',
                                backgroundColor: dotColor,
                                flexShrink: 0,
                              }}
                            />
                            <span>{val.label}</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* Note de calcul / règle métier en français simple */}
                {card.formulaNote && (
                  <div
                    style={{
                      marginTop: '6px',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      backgroundColor: '#FEF9EE',
                      border: '1px solid #FDE68A',
                      color: '#92400E',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '7px',
                      lineHeight: 1.45,
                    }}
                  >
                    <Calculator size={14} color="#D66927" style={{ marginTop: '2px', flexShrink: 0 }} />
                    <span>{card.formulaNote}</span>
                  </div>
                )}
              </div>
            </div>
          ))}

          {filteredRules.length === 0 && (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#64748B', fontSize: '13px' }}>
              Aucun filtre trouvé pour « {search} ».
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
