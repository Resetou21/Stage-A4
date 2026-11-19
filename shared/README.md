# 📦 Boîte à Outils Partagée — Hubs Groupe Facility

Ce dossier regroupe les composants et utilitaires mutualisés de référence pour les applications Monday du Groupe Facility.

> **Principe d'isolation strict** :  
> Chaque Hub existant (`Backup-Hub-de-natacha-code`, `ERP-Monday`, `Hub-Christine`, `Hub-Lea`, `Hub-Vincent`, `Hub-Global-Facility`) reste 100 % autonome et indépendant avec ses propres fichiers locaux.  
> Ce dossier `shared/` sert de **socle de référence prêt à l'emploi** pour tout nouveau Hub à venir (Commercial, RH, etc.), permettant de démarrer un nouveau projet en 2 minutes chrono avec la charte graphique et les briques éprouvées.

---

## 🗂️ Contenu de la bibliothèque

### 1. Composants UI (`shared/components/`)
* **`SearchableSelect.tsx`** : Menu déroulant avec recherche en temps réel, tri intelligent, support des sous-groupes, badges de couleurs et création/suppression de tags dynamiques.
* **`UsersBadge.tsx`** : Badge d'information métier affichant automatiquement les utilisateurs Monday associés au tableau (rôles, initiales colorées, workflows et finalité métier).
* **`Dialog.tsx`** : Fenêtres modales et dialogues d'alerte Radix UI avec fermeture par touche Échap, clic extérieur et animations fluides accélérées GPU.

### 2. Moteur GraphQL Monday (`shared/api/`)
* **`mondayApi.ts`** :
  * File d'attente anti-saturation Monday (`MAX_CONCURRENT = 5`).
  * Déduplication automatique des requêtes identiques en vol (`inFlightRequests`).
  * Cache mémoire transparent avec TTL pour éliminer les requêtes redondantes.
  * Gestion propre des erreurs et notifications toasts.

### 3. Outils Métiers (`shared/skills/`)
* **`xlsx-export.ts`** : Moteur d'export Excel haute fidélité basé sur ExcelJS :
  * En-tête bleu Facility (`#39A9DC`) avec texte blanc en gras.
  * Lignes alternées zébrées (`#E1F2FA`) pour une lisibilité parfaite.
  * Volet supérieur figé (`frozen row 1`).
  * Filtres automatiques sur toutes les colonnes.
  * Ajustement automatique des largeurs de colonnes.

### 4. Charte Graphique (`shared/styles/`)
* **`theme-tokens.css`** : Variables CSS et tokens de design aux couleurs officielles du Groupe Facility :
  * Bleu Facility : `#39A9DC`
  * Orange Facility : `#FDAB3D`
  * Typographies : `Ruda`, `Plus Jakarta Sans`
  * Rayons d'arrondis et ombres douces.

---

## 🚀 Démarrage d'un nouveau Hub
Lors de la création d'un nouveau Hub :
1. Initialiser le projet Vite + React + TypeScript + Tailwind.
2. Copier les briques nécessaires depuis `shared/` vers `src/`.
3. Le nouveau Hub dispose immédiatement de l'export Excel, des modales, du sélecteur à recherche et de la connexion optimisée à Monday !
