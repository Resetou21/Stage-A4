import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  Database,
  ExternalLink,
  Filter,
  Search,
  Shield,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';

interface DataRulesAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type AuditCategory =
  | 'all'
  | 'global'
  | 'secteurs'
  | 'atelier'
  | 'vehicules'
  | 'facturation'
  | 'contacts'
  | 'api';

interface RuleEntry {
  id: string;
  hub: Exclude<AuditCategory, 'all'>;
  hubLabel: string;
  accentColor: string;
  title: string;
  boards: Array<{ name: string; id: string; group?: string }>;
  filters: string[];
  columnsOrFormulas: string[];
  cacheOrApiNote: string;
}

const AUDIT_RULES: RuleEntry[] = [
  // ==================== HUB GLOBAL & COMMERCIAL ====================
  {
    id: 'global-kpis',
    hub: 'global',
    hubLabel: 'Hub Global',
    accentColor: '#1B4565',
    title: 'KPIs Accueil & Supervision Globale',
    boards: [
      { name: 'Tableau Complet Chantier', id: '1976599627', group: 'topics (en cours)' },
      { name: 'Visites Clients', id: '1977798116', group: 'Année en cours (>= 01/01)' },
    ],
    filters: [
      'Chantiers filtrés uniquement sur le groupe « topics » (chantiers actifs).',
      'Visites filtrées côté API Monday via query_params : date_mkrcgy18 >= année en cours.',
      'Comptage des étoiles (3🌟/2🌟/1🌟/🙁) et 4 alertes recalculé en direct avec les mêmes règles strictes que le Hub Secteurs.',
    ],
    columnsOrFormulas: [
      'color_mkrbk3jy (Animateur)',
      'color_mkzyz3ay / x621 / cd34 (C1/C2/C3)',
      'date_mkzy6s01 (Dernier contrôle)',
      'boolean_mkzad1h + text_mkzbnbe9 (RDV 2 mois)',
      'status = "Globalement bon" (Satisfaction %)',
    ],
    cacheOrApiNote: 'Cache localStorage 15 min · Iframes Keep-Alive (0 appel au changement de Hub)',
  },
  {
    id: 'global-commercial',
    hub: 'global',
    hubLabel: 'Hub Commercial',
    accentColor: '#B87414',
    title: 'Hub Commercial & Portefeuille Chantiers',
    boards: [{ name: 'Tableau Complet Chantier', id: '1976599627', group: 'Tous les groupes (actifs + arrêtés)' }],
    filters: [
      'Gains année N : colonne « ➕ chantiers » (date_mkx4mzcy) dans l’année sélectionnée.',
      'Pertes année N : colonne « ➖ chantiers » (date_mkx4kna3) dans l’année sélectionnée.',
      'Filtre Secteur inclut « Non assigné » pour les lignes sans animateur renseigné.',
      'Lecture légère : id + text uniquement (sans blobs JSON value) sur 14 colonnes filtrées.',
    ],
    columnsOrFormulas: [
      'color_mkx443a0 (💶 CA annuel)',
      'numeric_mkxwwma1 (Heures/mois)',
      'color_mm0y5esk (Provenance)',
      'color_mm0v1k6a / dropdown_mkx4e64m (Activité)',
      'dropdown_mkx4bmvr (Raison arrêt)',
    ],
    cacheOrApiNote: 'Préchargement silencieux + Cache localStorage 15 min + dédoublonnage in-flight',
  },
  {
    id: 'global-perms-roadmap',
    hub: 'global',
    hubLabel: 'Hub Global',
    accentColor: '#1B4565',
    title: 'Autorisations Hubs (Oui/Non) & Boîte à Idées',
    boards: [
      { name: '🔐 Autorisations Hubs', id: '5108553085' },
      { name: 'Boîte à Idées / Roadmap', id: '5105479748', group: 'group_mm7y1vv8 (Livrées)' },
    ],
    filters: [
      'Autorisations : correspondance par e-mail (prioritaire) puis par nom ; les cases décochées masquent les tuiles dans le Hub Global (la vraie sécurité lecture/écriture reste gérée par Monday).',
      'Boîte à Idées : requête filtrée sur 8 colonnes exactes + 5 derniers commentaires (updates).',
      'Carrousel Actualités : lit les 8 dernières idées livrées (group_mm7y1vv8) avec garde cache 10 min.',
    ],
    columnsOrFormulas: [
      'text_mm9ec0yk (E-mail) + 7 colonnes boolean_mm9e*',
      'file_mm7wtnz1, dropdown_mm978xpa, short_text2v8w5gvp',
      'color_mm7yntfh, status, multi_selectp70jvoio, date_mm7yphvc',
    ],
    cacheOrApiNote: 'Permissions cache 5 min · News cache 10 min · Roadmap cache 2 min',
  },

  // ==================== HUB ANIMATRICES / SECTEURS ====================
  {
    id: 'secteurs-alertes',
    hub: 'secteurs',
    hubLabel: 'Animatrices',
    accentColor: '#3989B7',
    title: 'Centre d’Alertes & Contrôles Qualité (Règles Vibe strictes)',
    boards: [
      { name: 'Tableau Complet Chantier', id: '1976599627', group: 'topics (en cours)' },
      { name: 'Visites Clients', id: '1977798116' },
      { name: 'Sous-éléments Plans d’Action', id: '1978388826' },
    ],
    filters: [
      'Filtré par profil animatrice (Natacha THOMAS, Ketty PAULIN, Emilie TOBIE) via color_mkrbk3jy.',
      'Alerte Clients insatisfaits (3× suite) : Alerte 2 > 0 OU (isBad(C1) ET isBad(C2) ET isBad(C3)) — JAMAIS sur C1 seul !',
      'Alerte Contrôle > 2 mois : Alerte 3 = 1 OU (isBad(C1) ET date contrôle > 2 mois).',
      'Alerte Non vus > 11 mois : dernierContrle <= 11 mois sur groupe topics.',
      'Alerte Visites 2 mois : text_mkzbnbe9 non vide ET boolean_mkzad1h !== true.',
    ],
    columnsOrFormulas: [
      'isBad(x) = "Bases non respectées" || "Plan d’action urgent"',
      '3🌟 = C1+C2+C3 "Globalement bon" | 2🌟 = C1+C2 | 1🌟 = C1',
      'Satisfaction % = (Visites "Globalement bon" / Total notées) × 100',
    ],
    cacheOrApiNote: 'Pagination next_items_page · 100 % colonnes filtrées · Cache 5 min + sessionStorage',
  },
  {
    id: 'secteurs-inventaires',
    hub: 'secteurs',
    hubLabel: 'Animatrices',
    accentColor: '#3989B7',
    title: 'Inventaires Consommables, Stocks à Récupérer & Économies',
    boards: [
      { name: 'Inventaires Consommables', id: '5105902205', group: 'topics (à faire) / group_mm8adwxm (réalisés)' },
    ],
    filters: [
      'Inventaires à faire : chantiers avec contrat consommables, boolean_mm84z0a4 !== true et date > 182 jours (ou jamais fait).',
      'Actions suite inventaire (group_mm8adwxm) : dédupliqué par chantier (ligne la plus récente uniquement). Affiché si À Récupérer > 0 (rcuprationRalise !== true) OU Avenant > 0 (avenantRalis !== true).',
      'Validation : crée la ligne d’historique dans group_mm8adwxm et archive l’ancienne ligne « à faire ».',
    ],
    columnsOrFormulas: [
      'Stock Mini = max(1, arrondi((Contrat / 12) × 2))',
      'À Récupérer = max(0, Inventaire − Stock Mini)',
      'Avenant = min(À Récupérer, arrondi(Contrat × 0,25))',
      'Éco Directe = Σ(À Récupérer × PU HT) | Éco 12m = Σ(Avenant × PU HT)',
    ],
    cacheOrApiNote: 'Formules recalculées en dur en secours des colonnes formula_* Monday',
  },
  {
    id: 'secteurs-whatsapp-comm',
    hub: 'secteurs',
    hubLabel: 'Animatrices',
    accentColor: '#0E7042',
    title: 'Accompagnement Salariés WhatsApp & Communication Interne',
    boards: [
      { name: '👥 Liste des Salariés (Pole RH)', id: '5108574616' },
      { name: '📚 Accompagnements & Messages WhatsApp', id: '5108574626' },
      { name: 'Communication Animatrices', id: '5044808167', group: 'group_mkzb19j1' },
    ],
    filters: [
      'Annuaire RH : exclut automatiquement les salariés dont Statut RH = "Sorti" (color_mm9ea1d9).',
      'Import Excel mensuel RH : filtre RGPD strict (garde uniquement Nom, Téléphone, Langue, Secteur, Chantier, Statut).',
      'Modèles partagés stockés dans 5108574626 avec Statut envoi = "Modèle" ; traduction auto MyMemory si langue ≠ Français.',
      'Rappels Communication : messages attribués à l’animatrice avec boolean_mkwrnzkb (Vu) !== true.',
    ],
    columnsOrFormulas: [
      'text_mm9esavp (Tél), color_mm9enz2j (Langue), color_mm9ea1d9 (Statut RH)',
      'long_text_mm9efr78 (Synthèse FR), long_text_mm9er6mr (Traduit)',
      'color_mkzat86a (Personne concernée), boolean_mkwrnzkb (Vu)',
    ],
    cacheOrApiNote: 'Mini-cache 45 s sur Communication Animatrices (invalidé instantanément au clic Vu)',
  },

  // ==================== ERP ATELIER ====================
  {
    id: 'atelier-erp',
    hub: 'atelier',
    hubLabel: 'ERP Atelier',
    accentColor: '#39A9DC',
    title: 'Parc Machines, Fiches de Contrôle & Réparations Curatives',
    boards: [
      { name: 'Liste des machines', id: '5106585240' },
      { name: 'Référentiel - Points de contrôle', id: '5107261391' },
      { name: 'Fiche de Contrôle', id: '5107262948' },
      { name: 'Réparation machines', id: '5106693291' },
    ],
    filters: [
      'Référentiel groupé par type machine (Autolaveuse, Monobrosse, Aspirateur, Haute pression, Chariot).',
      'Flux Contrôle ➔ Réparation : si ≥ 1 point est Non Conforme (NC), création auto d’un ticket curatif « À traiter » dans 5106693291 + compte-rendu HTML en update.',
      'Checklist Réparation : dès que tous les sous-points défaillants sont cochés, bascule auto en « Réparée / Conforme ».',
      'Heures compteur : synchronisées simultanément sur la fiche (numeric_mm8v3mw) et sur la machine (numeric_mm8v97ja).',
    ],
    columnsOrFormulas: [
      'boolean_mm8tv8zy (Préventive) + 12 mois boolean_mm8tw6vh..4bz2',
      'color_mm8tmqfc (État Vert/Orange/Rouge), color_mm8vp2nd (Statut suivi)',
      'board_relation_mm8gc4mh (Lien machine), text_mm8vhwst (Description panne)',
    ],
    cacheOrApiNote: 'Moteur unifié monday.ts : cache 3 min mémoire + sessionStorage, queue 5, retry auto, invalidation à chaque mutation',
  },

  // ==================== HUB VÉHICULES & GPS ====================
  {
    id: 'vehicules-parc-couts',
    hub: 'vehicules',
    hubLabel: 'Hub Véhicules',
    accentColor: '#1B4565',
    title: 'Parc Véhicules, Coûts Flotte, Charges Fixes & Contrôles Visuels',
    boards: [
      { name: '❎Suivi du parc véhicules', id: '5092005027', group: 'topics (En service)' },
      { name: 'Data sur véhicule', id: '5092124669', group: 'Fixe / Chargemap / Carburant / Interventions' },
      { name: 'Data wellborne', id: '5106822028' },
      { name: 'Contrôle visuel véhicule', id: '5093072539' },
    ],
    filters: [
      'Harmonisation stricte de toutes les dépenses et contrôles sur la plaque officielle AA-123-AA (text_mm839fsd) — jamais sur un simple numéro interne.',
      'Véhicules en service : groupe « topics » uniquement ; arrêt automatique des coûts fixes mensuels dès restitution.',
      'Top consommations : agrégé sur les 6 derniers mois glissants (Carburant + Chargemap + Wellborne).',
    ],
    columnsOrFormulas: [
      'parcCache.ts : 1 seule requête mutualisée (au lieu de 4) pour 5092005027',
      'numeric_mm0r8ag0 (Montant HT), date4 (Date)',
      'Catégories auto : Camion (FUSO/CANTER/MAXITY), Électrique (ELECT), Thermique',
    ],
    cacheOrApiNote: 'Cache localStorage 30 min (Overview/Finance) + cache API 10 min sessionStorage',
  },
  {
    id: 'vehicules-geoloc',
    hub: 'vehicules',
    hubLabel: 'Hub Véhicules (GPS)',
    accentColor: '#D66927',
    title: 'Géolocalisation GPS, Exclusions Domicile ↔ Travail & Pointage Salariés',
    boards: [
      { name: '📍 Synthèse Géolocalisation', id: '5108497111', group: '1 groupe / semaine (~39 lignes)' },
      { name: '🗂️ Pointage & Détails Journaliers GPS', id: '5108589918', group: '1 groupe / semaine (~175 lignes)' },
      { name: '👥 Liste des Salariés (Pole RH)', id: '5108574616' },
    ],
    filters: [
      'Alertes GPS : Hors horaires (< 04h30 ou > 19h30), Week-end (Sam/Dim), Vie privée (adresse contenant "vie privée"), Inactif (0 trajet / 0 km).',
      'Règle Exclure (Domicile ↔ Travail) : si le 1er trajet est exclu → début utile = heure d’ARRIVÉE sur le 1er site ; si le dernier trajet est exclu → fin utile = heure de DÉPART du dernier site ; km & conduite retirés.',
      'Pointage multi-salariés : alimenté par Pole RH (5108574616, hors Sorti) + conducteurs GPS ; écart horaire signé (±15, ±30, ±60… min).',
      'Compression Trajets JSON : auto-adaptée sous 1 940 car. (limite Monday = 2 000 car.) ; bouton « Archiver > 6 mois » libère le quota actif (100 000 items) sans rien perdre.',
    ],
    columnsOrFormulas: [
      'Anti-doublon Synthèse : Semaine + Plaque normalisée + lien auto board_relation_mm9dnt7z',
      'Anti-doublon Détails : Plaque + Date (1 ligne = 1 véhicule × 1 jour)',
      'Statut Pointage : Non pointé | Conforme | Écart horaire (Écart total signé)',
    ],
    cacheOrApiNote: 'Batching GraphQL ×10 (Synthèse 39→4 appels · Détails 175→~18 appels, 10× plus rapide)',
  },

  // ==================== FACTURATION CHRISTINE ====================
  {
    id: 'facturation-christine',
    hub: 'facturation',
    hubLabel: 'Facturation (Christine)',
    accentColor: '#1B4565',
    title: 'Imports Factures Énergie (Total, Chargemap, Wellborne) & Saisie Véhicules',
    boards: [
      { name: 'Data sur véhicule', id: '5092124669' },
      { name: 'Data wellborne', id: '5106822028' },
      { name: 'Facture TOTAL / Chargemap', id: '5092674084' },
    ],
    filters: [
      'Chargemap : dédoublonnage strict multi-critères avec prévisualisation avant écriture.',
      'TotalEnergies : gestion des 2 factures mensuelles (quinzaines du 15 et du 30).',
      'Wellborne : ignore automatiquement les lignes antérieures au 15/05 ; envoi groupé jusqu’à 50 lignes par requête GraphQL.',
      'Saisie manuelle : véhicules triés alphabétiquement, Date & Montant HT obligatoires, création de tags à la volée.',
    ],
    columnsOrFormulas: [
      '64/64 requêtes filtrées par column_values(ids: [...])',
      'Batching GraphQL Wellborne : 50 create_item / appel',
      'Traçabilité des 3 dernières factures scannées + UsersBadge',
    ],
    cacheOrApiNote: 'Cache 10 min mémoire + sessionStorage · File d’attente MAX_CONCURRENT = 5',
  },

  // ==================== CONTACTS LÉA ====================
  {
    id: 'contacts-lea',
    hub: 'contacts',
    hubLabel: 'Contacts (Léa)',
    accentColor: '#D66927',
    title: 'Annuaire Interlocuteurs Clients & Exports Excel Chartés',
    boards: [{ name: 'Tableau Complet Chantier', id: '1976599627', group: 'topics (en cours)' }],
    filters: [
      'Lecture seule uniquement (0 mutation) sur les chantiers actifs.',
      'Extraction propre des interlocuteurs, téléphones, e-mails, villes, codes postaux et secteurs.',
      'Export ExcelJS aux couleurs officielles Groupe Facility (#39A9DC / #3989B7) avec filtres automatiques.',
    ],
    columnsOrFormulas: [
      'dropdown_mkrb9ma (Interlocuteur), dropdown_mkrbfhrg (Tél), dropdown_mkrbwbya (E-mail)',
      'color_mkrbk3jy (Animateur), color_mkrb1yqe (Ville), numeric_mkrba3xc (CP)',
    ],
    cacheOrApiNote: 'Ultra léger : 3 points d’appel API · Cache 10 min mémoire + sessionStorage',
  },

  // ==================== ARCHITECTURE & QUOTAS API ====================
  {
    id: 'api-architecture',
    hub: 'api',
    hubLabel: 'Perf & API',
    accentColor: '#0E7042',
    title: 'Architecture Multi-Hubs, Quotas Monday Enterprise & Optimisations Actives',
    boards: [
      { name: 'Hub Global (App 12725463)', id: '5108553085' },
      { name: 'Pointage & Détails GPS', id: '5108589918' },
    ],
    filters: [
      'Quota API Monday Enterprise : 25 000 appels / jour (usage normal équipe estimé à 150–500 appels/jour, soit < 2 %).',
      'Quota Tableau Monday Enterprise : 100 000 éléments actifs / tableau (archives illimitées, ne comptent pas dans les 100 000).',
      'Sécurité : toutes les requêtes s’exécutent avec le compte Monday connecté (Observateur = lecture seule garantie par Monday).',
    ],
    columnsOrFormulas: [
      'Keep-Alive iframes Hub Global : 0 appel API au changement d’onglet',
      'Batching GraphQL : ×10 GPS (Hub Véhicules), ×50 Wellborne (Christine)',
      'Cache 2 niveaux (mémoire + sessionStorage/localStorage) sur les 6 Hubs',
      'Retry automatique avec backoff sur erreurs complexité / rate-limit',
    ],
    cacheOrApiNote: '100 % des 6 Hubs sauvegardés sur GitHub (Resetou21/Stage-A4 · main)',
  },
];

const TABS: Array<{ id: AuditCategory; label: string }> = [
  { id: 'all', label: 'Tous les Hubs' },
  { id: 'global', label: 'Global & Comm.' },
  { id: 'secteurs', label: 'Animatrices' },
  { id: 'atelier', label: 'ERP Atelier' },
  { id: 'vehicules', label: 'Véhicules & GPS' },
  { id: 'facturation', label: 'Facturation' },
  { id: 'contacts', label: 'Contacts' },
  { id: 'api', label: 'Perf & Quotas' },
];

export default function DataRulesAuditModal({ isOpen, onClose }: DataRulesAuditModalProps) {
  const [activeTab, setActiveTab] = useState<AuditCategory>('all');
  const [search, setSearch] = useState('');

  const filteredRules = useMemo(() => {
    const q = search.trim().toLowerCase();
    return AUDIT_RULES.filter((r) => {
      if (activeTab !== 'all' && r.hub !== activeTab) return false;
      if (!q) return true;
      const hay = [
        r.hubLabel,
        r.title,
        ...r.boards.map((b) => `${b.name} ${b.id} ${b.group || ''}`),
        ...r.filters,
        ...r.columnsOrFormulas,
        r.cacheOrApiNote,
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
          width: '1080px',
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
                  Référentiel Filtres, Tableaux &amp; Règles de Calcul
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
                    letterSpacing: '0.03em',
                  }}
                >
                  <Shield size={10} />
                  ADMIN UNIQUEMENT
                </span>
              </div>
              <p style={{ margin: '2px 0 0 0', fontSize: '11.5px', color: 'rgba(255,255,255,0.82)' }}>
                Transparence complète sur les sources Monday, filtres appliqués, formules métier et optimisations API des 6 Hubs (0 appel API).
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

        {/* Barre filtres + onglets Hub */}
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
                placeholder="Rechercher un tableau, ID, formule, filtre (ex: Alerte 2, 5108589918, Wellborne)..."
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

            <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#3989B7' }}>
              {filteredRules.length} bloc{filteredRules.length > 1 ? 's' : ''} documenté{filteredRules.length > 1 ? 's' : ''}
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

        {/* Liste des règles */}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {filteredRules.map((rule) => (
            <div
              key={rule.id}
              style={{
                borderRadius: '14px',
                border: '1px solid #D7EAF5',
                borderLeft: `4px solid ${rule.accentColor}`,
                backgroundColor: '#FFFFFF',
                padding: '14px 16px',
                boxShadow: '0 2px 8px rgba(27, 69, 101, 0.04)',
              }}
            >
              {/* En-tête carte */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      padding: '2px 9px',
                      borderRadius: '999px',
                      backgroundColor: `${rule.accentColor}15`,
                      color: rule.accentColor,
                      border: `1px solid ${rule.accentColor}35`,
                      fontSize: '10.5px',
                      fontWeight: 800,
                    }}
                  >
                    {rule.hubLabel}
                  </span>
                  <h3 style={{ margin: 0, fontFamily: "'Ruda', sans-serif", fontSize: '14px', fontWeight: 800, color: '#1B4565' }}>
                    {rule.title}
                  </h3>
                </div>

                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '3px 9px',
                    borderRadius: '999px',
                    backgroundColor: '#E6F9F1',
                    color: '#0E7042',
                    border: '1px solid #A7F3D0',
                    fontSize: '10.5px',
                    fontWeight: 700,
                  }}
                >
                  <Zap size={11} />
                  {rule.cacheOrApiNote}
                </span>
              </div>

              {/* Tableaux Monday sources cliquables */}
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748B', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Database size={12} color="#3989B7" /> Sources :
                </span>
                {rule.boards.map((b) => (
                  <a
                    key={`${rule.id}-${b.id}-${b.name}`}
                    href={`https://groupefacility.monday.com/boards/${b.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '3px 9px',
                      borderRadius: '7px',
                      backgroundColor: '#F4F9FC',
                      border: '1px solid #D7EAF5',
                      color: '#1B4565',
                      fontSize: '11px',
                      fontWeight: 700,
                      textDecoration: 'none',
                    }}
                  >
                    <span>{b.name}</span>
                    <code style={{ fontSize: '10px', color: '#3989B7', fontWeight: 800 }}>#{b.id}</code>
                    {b.group && (
                      <span style={{ fontSize: '10px', color: '#64748B', fontWeight: 600 }}>({b.group})</span>
                    )}
                    <ExternalLink size={10} color="#64748B" />
                  </a>
                ))}
              </div>

              {/* Filtres & règles métier */}
              <div
                style={{
                  backgroundColor: '#F8FBFD',
                  borderRadius: '10px',
                  border: '1px solid #E6F2F8',
                  padding: '10px 12px',
                  marginBottom: '10px',
                }}
              >
                <div style={{ fontSize: '10.5px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#3989B7', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Filter size={11} /> Filtres &amp; conditions appliquées
                </div>
                <ul style={{ margin: 0, paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: '#1E293B', lineHeight: 1.45 }}>
                  {rule.filters.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </div>

              {/* Colonnes clés & formules */}
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#64748B', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Sparkles size={11} color="#D66927" /> Colonnes / Formules :
                </span>
                {rule.columnsOrFormulas.map((cf, i) => (
                  <code
                    key={i}
                    style={{
                      padding: '2px 7px',
                      borderRadius: '6px',
                      backgroundColor: '#F1F5F9',
                      border: '1px solid #E2E8F0',
                      color: '#334155',
                      fontSize: '10.5px',
                      fontWeight: 600,
                    }}
                  >
                    {cf}
                  </code>
                ))}
              </div>
            </div>
          ))}

          {filteredRules.length === 0 && (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#64748B', fontSize: '13px' }}>
              Aucune règle ne correspond à « {search} ».
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
