# 🏢 Hub Responsable de Secteur — Groupe Facility

Application Monday.com sur-mesure développée pour les Responsables de Secteur du **Groupe Facility**. Elle centralise en temps réel la gestion opérationnelle des chantiers, les contrôles qualité, le suivi des consommables et économies d'avenants, ainsi qu'un centre d'alertes préventives.

---

## 📋 Sommaire
1. [Fonctionnalités Principales](#-fonctionnalités-principales)
2. [Stack Technique](#-stack-technique)
3. [Démarrage Rapide (Installation & Lancement)](#-démarrage-rapide)
4. [Architecture du Projet](#-architecture-du-projet)
5. [Guide des Modifications Courantes ("Tutoriel Pas-à-Pas")](#-guide-des-modifications-courantes)
   - [Modifier ou ajouter des produits consommables](#1-modifier-ou-ajouter-des-produits-consommables)
   - [Modifier les formules d'économies & seuils de stock](#2-modifier-les-formules-déconomies--stocks-mini)
   - [Modifier les critères des alertes](#3-modifier-les-critères-des-alertes)
   - [Changer une colonne Monday ou adapter le mapping](#4-adapter-le-mapping-des-colonnes-monday)
   - [Modifier l'affichage ou la pagination des chantiers](#5-modifier-les-cartes-de-chantier-ou-la-pagination)
6. [Procédure de Déploiement sur Monday CDN](#-procédure-de-déploiement-sur-monday-cdn)
7. [Règles de Sécurité & Bonnes Pratiques](#-règles-de-sécurité-stricte)

---

## 🌟 Fonctionnalités Principales

1. **Tableau Complet Chantier :**
   - Affichage en cartes interactives (9 par page avec pagination intelligente `1 2 3 ... 18`).
   - Filtres instantanés par étoiles qualité (3🌟, 2🌟, 1🌟, 🙁), clés, animateurs, recherche multi-critères.
   - Fiche détaillée du chantier : coordonnées, accès, codes clés, historique des contrôles.

2. **Stocks, Consommables & Économies :**
   - Calcul automatisé des **stocks mini**, des **surplus à récupérer** et des **avenants préconisés**.
   - Calcul des **Économies directes** et **Économies contrat 12 mois** avec bascule dynamique :
     - *Dernier inventaire (Situation actuelle)*
     - *Cumul Annuel (Total gagné sur l'année en cours)*
   - Saisie rapide des inventaires et historique chronologique avec prévisions.

3. **Visites Clients & Plans d'Action :**
   - Taux de satisfaction globale du secteur (visites notées *Globalement bon*).
   - Suivi des actions correctives issues des contrôles terrain.

4. **Centre d'Alertes Préventives :**
   - Alertes automatiques : 3 contrôles insatisfaisants consécutifs, contrôles > 2 mois sans vérification, chantiers non vus depuis 11 mois, visites des 2 mois, inventaires à renouveler (tous les 182 jours), rappels et messages non lus.

---

## 🛠 Stack Technique

- **Framework :** React 19 + TypeScript + Vite 8
- **Styling :** Tailwind CSS 4 + Radix UI Primitives (Dialog, Popover) + Sonner (Toasts)
- **Graphiques & Données :** Recharts + Lucide React (Icônes)
- **Intégration Monday :** `monday-sdk-js` (SDK officiel exécuté dans une iframe sécurisée)
- **Hébergement :** Monday Code CDN (`@mondaycom/apps-cli`)

---

## 🚀 Démarrage Rapide

### Prérequis
- **Node.js** version 18 ou supérieure
- Gestionnaire de paquets **npm**

### 1. Installation des dépendances
```bash
npm install
```

### 2. Lancement en développement local
```bash
npm run dev
```
L'application démarre sur `http://localhost:5173`.

> 💡 **Tester avec les vraies données Monday en local :**
> Vous pouvez créer un tunnel sécurisé pour lier votre serveur de test à une vue Monday :
> ```bash
> npm run tunnel
> ```

---

## 📂 Architecture du Projet

```text
├── src/
│   ├── api/
│   │   ├── BoardSDK.ts            # Client SDK Monday & requêtes GraphQL (cache, batching)
│   │   └── columnMap.ts           # IDs des tableaux Monday & identifiants de colonnes
│   │
│   ├── generated/
│   │   ├── App.tsx                # Composant racine, navigation par onglets
│   │   ├── components/            # Composants graphiques et interfaces
│   │   │   ├── ChantiersSpace.tsx        # Vue cartes chantier & pagination
│   │   │   ├── ChantierDetailModal.tsx   # Fiche détaillée d'un chantier
│   │   │   ├── InventorySpace.tsx        # Espace Stocks & Inventaires
│   │   │   ├── EconomyStats.tsx          # Tuiles KPI et bascule Dernier relevé / Cumul
│   │   │   ├── SiteHistoryModal.tsx      # Modal historique inventaire & badges
│   │   │   ├── AlertsCenter.tsx          # Centre et pop-up d'alertes
│   │   │   └── VisitsSection.tsx         # Satisfaction & visites clients
│   │   │
│   │   └── server/                # Logique métier et calculs mathématiques
│   │       ├── inventory.ts       # Calcul des économies, surplus, stock mini, avenants
│   │       ├── chantiers.ts       # Récupération & filtrage des chantiers
│   │       ├── visits.ts          # Récupération & calcul des visites
│   │       └── alerts.ts          # Détection des alertes opérationnelles
│   │
│   ├── index.css                  # Styles globaux & animations Radix UI
│   └── main.tsx                   # Point d'entrée de l'application
│
├── AGENTS.md / GEMINI.md          # Directives de sécurité et règles métier complètes
└── package.json                   # Dépendances et scripts de déploiement
```

---

## 📘 Guide des Modifications Courantes

Si un collègue ou un responsable vous demande de modifier quelque chose, voici où intervenir :

### 1. Modifier ou ajouter des produits consommables
- **Fichier :** `src/generated/server/inventory.ts`
- Les colonnes de produits (ex. `🏁PH 300M`, `🏁Savon 400 ML`, etc.) sont définies dans `src/api/columnMap.ts` (`INVENTORY_COLUMNS`).
- Si vous devez adapter les références suivies dans la saisie ou l'historique, mettez à jour la liste des champs dans `INVENTORY_COLUMNS` et la structure `INVENTORY_PRODUCTS` dans `inventory.ts`.

### 2. Modifier les formules d'économies & stocks mini
- **Fichier :** `src/generated/server/inventory.ts`
- **Formules de calcul appliquées :**
  ```text
  Stock Mini            = max(1, Math.round((Contrat / 12) * 2))
  Surplus (À récupérer) = max(0, Inventaire - Stock Mini)
  Avenant préconisé     = min(Surplus, Math.round(Contrat * 0.25))
  ```
- **Économies financières :**
  - **Économie directe :** Valeur financière du surplus à récupérer (`Somme des (À récupérer × Prix Unitaire HT)`).
  - **Économie contrat (12 mois) :** Valeur financière de l'avenant (`Somme des (Avenant × Prix Unitaire HT)`).
  - Le système lit prioritairement les formules réelles Monday `formula_mm8ccrzs` (Directe) et `formula_mm8czcsd` (12 Mois). Si ces colonnes sont recalculées, le total s'ajuste immédiatement.

### 3. Modifier les critères des alertes
- **Fichier :** `src/generated/server/alerts.ts`
- Vous y trouverez les conditions exactes :
  - **Alerte 3 contrôles :** Les 3 derniers contrôles (C1, C2, C3) doivent être insatisfaisants.
  - **Alerte 2 mois :** Dernier contrôle insatisfaisant datant de plus de 60 jours.
  - **Chantiers non vus :** Dernier contrôle datant de 11 mois ou plus sur le groupe `topics`.
  - **Visites des 2 mois :** Texte d'alerte présent et case `rdv2Mois` non cochée.

### 4. Adapter le mapping des colonnes Monday
- **Fichier :** `src/api/columnMap.ts`
- Contient les IDs fixes des tableaux Monday :
  - `TABLEAU_COMPLET_CHANTIER`: `1976599627`
  - `INVENTAIRE_CONSOMMABLES`: `5105902205`
  - `VISITES_CLIENTS`: `1977798116`
  - `COMMUNICATION_ANIMATRICES`: `5044808167`
- Si une colonne change d'identifiant sur Monday, modifiez uniquement son alias dans cet objet.

### 5. Modifier les cartes de chantier ou la pagination
- **Fichier :** `src/generated/components/ChantiersSpace.tsx`
- **Nombre de chantiers par page :** constante `PAGE_SIZE = 9` (ligne 26).
- **Affichage des numéros de page :** calculé dans `paginationItems` (affiche au maximum 7-8 boutons avec `...`).

---

## 🚢 Procédure de Déploiement sur Monday CDN

Pour publier les modifications en production sur Monday.com :

### 1. Se connecter au CLI Monday (à faire 1 seule fois par poste)
```bash
npx @mondaycom/apps-cli auth:login
```
*(ou renseigner le token d'accès dans le terminal).*

### 2. Déployer en 1 commande
```bash
npm run deploy
```
Cette commande compile le TypeScript, génère les fichiers de production avec Vite (`npm run build`) et pousse automatiquement le dossier `dist/` sur le CDN européen de Monday.

### 🎯 Référence des Hubs déployés :

| Hub | Animatrice / Secteur | App ID | Version ID Monday |
| :--- | :--- | :--- | :--- |
| **Hub Emilie** | Emilie TOBIE | `12538620` | `19582956` *(par défaut dans package.json)* |
| **Hub Natacha** | Natacha THOMAS | `12441148` | `19427524` |
| **Hub Ketty** | Ketty PAULIN | `12546485` | `19528952` |

> Pour déployer sur un autre Hub (ex. Natacha), remplacez simplement l'ID `-i 19582956` par `-i 19427524` dans la commande de déploiement.

---

## 🔒 Règles de Sécurité Stricte

1. **Ne JAMAIS supprimer de colonnes ou de groupes** sur les tableaux Monday.com.
2. **Ne JAMAIS pousser de fichiers `.mappsrc` ou `.env`** sur GitHub (déjà configuré dans le `.gitignore`).
3. **Zéro fichier temporaire :** Supprimer tout fichier de test (`.cjs`, `check_*.js`, `dist.zip`) avant de pousser ou de déployer.

---

*Développé pour Groupe Facility — 2026*

