# Groupe Facility — Projets Monday.com (Stage A4)

Ce dépôt regroupe l'ensemble des applications et extensions développées pour l'infrastructure **monday.com** du **Groupe Facility**.

---

## 📁 Architecture du Dépôt

```text
Stage-A4/
│
├── 📁 ERP-Monday/                     👉 Application 1 : Gestion du Parc Matériel & Maintenance Atelier
│   ├── 📁 src/
│   ├── 📁 public/
│   ├── package.json
│   └── vite.config.ts
│
├── 📁 Hub de responsable de secteur/   👉 Application 2 : Hub d'Exploitation & Suivi des Chantiers
│   ├── 📁 src/
│   ├── 📁 manifest-natacha/
│   ├── package.json
│   └── vite.config.ts
│
└── 📄 README.md                       👉 Documentation générale
```

---

## 🛠️ Présentation des Applications

### 1. ERP Parc Matériel & Atelier (`/ERP-Monday`)
Application d'exploitation dédiée à l'atelier et aux techniciens de maintenance pour le suivi de l'ensemble du parc machines (+130 matériels de nettoyage : autolaveuses, monobrosses, injecteurs, aspirateurs...) :
* **Fiche de Contrôle Technique Terrain** : Évaluation dynamique des points de contrôle, notation sur 10, pastille Facility, état général (Conforme / Usure / NC) et horodatage compteur horaire.
* **Génération automatique des tickets curatifs** : Détection immédiate des points non conformes et création de tickets de réparation avec compte-rendu d'intervention HTML dans Monday.
* **Matrice Préventive 12 Mois** : Suivi des fréquences de révision, coches interactives en temps réel (UI optimiste 0ms), clôture annuelle automatique et conservation des archives.
* **Historique & Agenda interactif** : Planning des passages, réservations et historique des contrôles par machine.
* **Indicateurs KPI & Factures Fournisseurs** : Taux de conformité, délais d'immobilisation, coûts cumulés et import automatique de factures/bons fournisseurs via analyseur PDF intégré (`pdfjs-dist`).

| Paramètre | Valeur |
| :--- | :--- |
| **App ID Monday** | `12514584` |
| **Version CDN** | `20004306` |
| **URL de Production Live** | [ERP Parc Matériel](https://vb0e51dbd8fbf57664b5ec275468cb683.cdn2.monday.app) |

---

### 2. Hub Responsable de Secteur (`/Hub de responsable de secteur`)
Plateforme d'exploitation unifiée pour les Responsables de Secteur (Animatrices) permettant le pilotage centralisé des chantiers clients :
* **Pilotage des Chantiers en cours** : Cartographie, accès, codes clés, interlocuteurs et fiches chantiers.
* **Contrôles Qualité & Jauges Étoiles** : Notation des visites clients, plans d'actions correctifs et indice de satisfaction globale.
* **Gestion des Inventaires Consommables** : Alertes des inventaires à réaliser (cycle 182 jours), validation terrain, calcul automatique des stocks mini, des reliquats à récupérer et des avenants contractuels (économies directes et annuelles chiffrées).
* **Centre d'Alertes & Notifications** : Détection des clients insatisfaits (3 contrôles consécutifs défavorables), contrôles sans vérification depuis > 2 mois, chantiers non vus depuis 11 mois et visites des 2 mois.
* **Communication Bidirectionnelle** : Échange direct d'alertes et de consignes entre l'atelier matériel et les animatrices terrain.

| Paramètre | Valeur |
| :--- | :--- |
| **App ID Monday** | `12538620` |
| **Version CDN** | `19760498` |
| **URL de Production Live** | [Hub Responsable de Secteur](https://v4f02898b5089caaa1aab8b5114da62ee.cdn2.monday.app) |

---

## 🚀 Technologies & Stack Technique
* **Frontend** : React 18/19, TypeScript, Vite, Tailwind CSS.
* **Composants & UI** : Lucide React, FullCalendar, Radix UI.
* **Intégration Monday** : SDK Officiel `monday-sdk-js`, GraphQL Monday API v2.
* **Déploiement** : Monday Apps CDN (`@mondaycom/apps-cli`).
