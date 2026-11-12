# 🔧 ERP Parc Matériel (`ERP-Monday`) — Groupe Facility

Application Monday.com sur-mesure dédiée à la **gestion du parc matériel de nettoyage**, aux **contrôles techniques terrain**, à la **maintenance préventive & curative**, à l'**intégration de bons d'intervention fournisseurs (PDF)** et au **suivi des stocks de pièces détachées**.

---

## 🌟 Fonctionnalités Principales

1. **Parc de Machines & Statuts en Temps Réel** (`Liste des machines`)
   * Vue synthétique du parc réel de nettoyage (`Total`, `En service`, `En réparation`, `À vérifier / Sortie`).
   * Modification en direct du statut d'une machine (`Remettre en service`, sélecteur de statut) et synchronisation automatique avec les tickets curatifs ouverts.
2. **Fiche de Contrôle Technique Terrain** (`InspectionForm`)
   * Sélection de machine active et chargement dynamique des points de contrôle du `Référentiel - Points de contrôle` selon le type de machine.
   * Création automatique de la fiche dans Monday (`Fiche de Contrôle`), génération des **sous-éléments détaillés par point contrôlé** (`Résultat`, `Catégorie`, `Action / Remarque`), mise à jour du relevé horaire sur la machine et création automatique d'un ticket curatif si un point est Non Conforme (NC).
3. **Maintenance Préventive 12 Mois & Agenda** (`MaintenanceMatrix` & `FullCalendar`)
   * Matrice annuelle des passages programmés par fréquence et calendrier mensuel interactif des contrôles et réservations.
4. **Indicateurs, Plan d'Action Curatif & Import PDF Fournisseur** (`IndicatorsActionPlan` & `SupplierImportModal`)
   * Suivi des tickets ouverts (`À traiter`), historique (`Réparées`) dans le groupe Monday `Machine Réparé` et synchronisation automatique du statut de la machine.
   * Import de bons d'intervention fournisseur au format PDF via `pdfjs-dist` avec détection automatique de la machine et pré-sélection du ticket ouvert correspondant.
5. **Gestion des Stocks Pièces & Consommables** (`StockManagement`)
   * Suivi des quantités, seuils d'alerte minimum et synchronisation en temps réel avec Monday.com.

---

## 🛠 Stack Technique

* **Frontend :** React 19 (`^19.3.1`), TypeScript (`~7.0.2`), Vite 8 (`^8.3.5`)
* **SDK & API :** `monday-sdk-js` (`0.5.9`) — API GraphQL Monday.com
* **Calendrier & PDF :** `@fullcalendar/react` (`^6.1.22`), `pdfjs-dist` (`^6.5.438`)
* **Icônes :** `lucide-react`

---

## 📁 Architecture du Code (`src/`)

* `src/App.tsx` : Shell principal, navigation par onglets, KPI du parc et calendrier FullCalendar.
* `src/components/InspectionForm.tsx` : Formulaire de contrôle technique terrain.
* `src/components/MaintenanceMatrix.tsx` : Matrice de planification préventive sur 12 mois.
* `src/components/IndicatorsActionPlan.tsx` : Tableaux de bord, taux de conformité et suivi des réparations curatives.
* `src/components/SupplierImportModal.tsx` : Modale d'import et de rattachement des bons d'intervention PDF.
* `src/components/MachineSelect.tsx` : Sélecteur et filtrage du matériel réel de nettoyage.
* `src/components/StockManagement.tsx` : Interface de gestion des stocks de pièces détachées.
* `src/services/maintenanceApi.ts` : Appels GraphQL Monday.com (machines, référentiel, fiches, sous-éléments, réparations).
* `src/services/stockApi.ts` : API Monday.com dédiée au tableau des stocks.
* `src/services/supplierPdfParser.ts` : Extraction et parsing des bons PDF fournisseurs.
* `src/services/monday.ts` : Initialisation du SDK Monday.

---

## 📊 Tableaux Monday.com Associés

| Rôle | Nom du Tableau | Board ID |
| :--- | :--- | :--- |
| Parc matériel | Liste des machines | `5106585240` |
| Référentiel | Référentiel - Points de contrôle | `5107261391` |
| Contrôles | Fiche de Contrôle | `5107262948` |
| Réparations | Réparation machines | `5106693291` |
| Planning | Agenda / Planning | `5106585296` |

---

## 🚀 Installation, Build & Déploiement

```bash
npm install
npm run dev       # Développement local
npm run build     # Build de production dans dist/
npm run deploy    # Build et push vers Monday Code CDN (App ID 12514584, Version v6)
```

> ⚠️ Le fichier d'authentification Monday CLI (`.mappsrc`), `node_modules/` et `dist/` sont volontairement exclus via `.gitignore` pour ne jamais exposer de jeton d'accès dans ce dépôt public.
