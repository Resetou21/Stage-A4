# Directives & Règles Projet - Hub Monday.com Groupe Facility

Ce document définit les règles de sécurité, les droits stricts, l'architecture des tableaux et la mémoire métier exhaustive du projet.
Il est chargé automatiquement à chaque session et pour chaque agent intervenant sur ce code.

---

## 1. Règles Strictes de Sécurité & Droits Accordés

### 🚫 ACTIONS STRICTEMENT INTERDITES
1. **INTERDICTION TOTALE DE SUPPRIMER DES COLONNES** sur les tableaux monday.com.
2. **INTERDICTION DE SUPPRIMER DES TABLEAUX OU DES GROUPES** sur monday.com.
3. **INTERDICTION DE SUPPRIMER LE PROJET** ou de vider des répertoires locaux.
4. **AUCUNE MODIFICATION DE STRUCTURE** sur monday.com sans demande écrite explicite de l'utilisateur.

### ✅ ACTIONS AUTORISÉES
1. Lecture des tableaux et données via l'API monday.com GraphQL.
2. Création et archivage d'éléments d'inventaire nécessaires au fonctionnement du Hub (ex : validation d'un inventaire créant l'historique dans « inventaires réalisés » et archivant l'ancienne ligne « à faire »).
3. Mise à jour des valeurs de cellules nécessaires (quantités inventoriées, cases à cocher de réalisation d'action).
4. Compilation (`npm run build`) et déploiement du code client sur Monday Code CDN (`npm run deploy` / `apps-cli code:push`).
5. Édition et optimisation du code source local du projet (`src/`).

---

## 2. Cartographie & Architecture des Applications Déployées

| Hub | Dossier Local | App ID Monday | Version ID CDN | URL de Production Live |
| :--- | :--- | :--- | :--- | :--- |
| **Hub Natacha** | `Backup-Hub-de-natacha-code` | `12441148` | `19427524` | `https://v...monday.app` |
| **Hub Emilie** | `Backup-Hub-de-natacha-code` | `12538620` | `19760498` | `https://v...monday.app` |
| **Hub Ketty** | `Hub-de-ketty-code` | `12546485` | `19528952` | `https://v052f360b49faafe8845d5464a0539108.cdn2.monday.app` |

*Note déploiement : Sur Windows, toujours exécuter `npm run deploy` avec `BypassSandbox: true` pour accéder au réseau et aux serveurs Monday CDN.*
*Règle d'or Espaces de travail : Dans Monday Administration -> Gestion des applications -> [Nom du Hub] -> Gestion des applications, TOUJOURS cocher « Tous les espaces de travail ». Si l'app est restreinte à un espace spécifique (ex: Animatrices), Monday bloque silencieusement les requêtes cross-workspaces (ex: Enchantement client) pour tous les utilisateurs autres que le développeur créateur.*

---

## 3. Architecture des Tableaux Monday.com & Colonnes Clés

### A. Tableau Complet Chantier (`1976599627`)
* **Animateur** : `color_mkrbk3jy` (`Natacha THOMAS`, `Ketty PAULIN`, `Emilie TOBIE`, `Andre LEVESQUE`).
* **Groupe chantiers en cours** : `topics`.
* **Contrôles qualité** :
  * `c1` : `color_mkzyz3ay` (Dernier contrôle)
  * `c2` : `color_mkzyx621` (Avant-dernier contrôle)
  * `c3` : `color_mkzycd34` (3e contrôle avant)
  * `rsultatDernierContrle` : `color_mkzyheka`
  * `dernierContrle` : `date_mkzy6s01` / `dernierContrle1` : `date_mkzy5nw9`
* **Formules d'alertes & étoiles** :
  * `alerte2` : `formula_mkzzfvq1` (Alerte 2 : 3 contrôles consécutifs non satisfaisants)
  * `alerte3` : `formula_mkzzqbf3` (Alerte 3 : Contrôle insatisfaisant > 2 mois sans nouvelle vérification)
  * `column3` : `formula_mkzzabga` (3🌟)
  * `column2` : `formula_mkzzk0qv` (2🌟)
  * `column1` : `formula_mkzzxqe8` (1🌟)
  * `column` : `formula_mkzzevbg` (🙁)
* **Visites des 2 mois** :
  * `texteDalerteAnimatrice1` : `text_mkzbnbe9`
  * `datePrvRdvDes2Mois` : `date_mkzbpth5`
  * `rdv2Mois` : `boolean_mkzad1h`
* **Coordonnées, Accès & Exploitation** :
  * `codeChantier` : `text_mm2kscgb`
  * `adresse` : `text_mm3k9x1n` / `codePostal` : `numeric_mkrba3xc` / `ville` : `color_mkrb1yqe`
  * `interlocuteur` : `dropdown_mkrb9ma` / `telephone` : `dropdown_mkrbfhrg` / `email` : `dropdown_mkrbwbya`
  * `cle` : `text_mkrb5wn0` / `doubleCle` : `text_mkrbmf98` / `keycafe` : `text_mkwpfnx6` / `cahierLiaison` : `text_mkrb280x`
  * `heuresMois` : `numeric_mkxwwma1` / `activite` : `color_mm0v1k6a` / `sensible` : `boolean_mm0v3fg`

### B. Inventaires Consommables (`5105902205`)
* **Groupes** :
  * `topics` : « Inventaire des consommables » (inventaires à faire, tous les 182 jours).
  * `group_mm8adwxm` : « inventaires réalisés » (historique des inventaires validés).
* **Liaison chantier** : `board_relation_mm82mpb7` (*Tableau complet chantier*).
* **Champs de suivi** :
  * `dateInventaireActuel` : `date_mm843j0k`
  * `inventaireValidOk` : `boolean_mm84z0a4`
  * `rcuprationRalise` : `boolean_mm8cddz6`
  * `avenantRalis` : `boolean_mm8capb3`
  * `economieDirecte` : `formula_mm8ccrzs`
  * `economie12Mois` : `formula_mm8czcsd`

### C. Visites Clients (`1977798116`) & Sous-éléments (`1978388826`)
* `qualitDeLaPrestation` : `status` ('Globalement bon' pour la satisfaction client)
* `nomChantier` : `board_relation_mktd1vha`
* `animateur` : `lookup_mkvgpaca` (Miroir de l'animateur chantier)
* **Sous-éléments (plans d'action)** :
  * `actionMener` : `text_mkrhcpzc`
  * `statut` : `color_mkv1tk6f` ('En cours', 'Fait', etc.)
  * `dateRalisation` : `date_mkwrr950`
  * `catgorie` : `dropdown_mkv1j4z1`

### D. Communication Animatrices (`5044808167`)
* `personneConcerne` : `color_mkzat86a`
* `clientConcern` : `board_relation_mkwrnhwg`
* `date` : `date_mkwrkqy5`
* `vu` : `boolean_mkwrnzkb`
* `group_mkzb19j1` : Groupe des messages en attente.

---

## 4. Logique Métier & Conditions Strictes des Alertes (Identiques à Vibe)

### A. Pop-up & Centre d'Alertes
1. **Clients insatisfaits (3 contrôles de suite)** :
   * Condition : `Alerte 2 > 0` OU (`isBad(C1)` **ET** `isBad(C2)` **ET** `isBad(C3)`)
   * *Où `isBad(x)` = `x === 'Bases non respectées' || x === "Plan d'action urgent"`.*
   * **ATTENTION** : Ne JAMAIS compter un client si seulement C1 est mauvais ! Les 3 contrôles doivent impérativement être mauvais.
2. **Contrôle insatisfaisant (> 2 mois sans vérification)** :
   * Condition : `Alerte 3 = 1` OU (`isBad(C1)` **ET** `date du contrôle > 2 mois`).
3. **Chantiers non vus depuis 11 mois** :
   * Condition : `date du dernier contrôle <= 11 mois` sur les chantiers en cours du groupe `topics`.
4. **Visites des 2 mois** :
   * Condition : `texte d'alerte non vide` **ET** `Rdv 2 mois non coché`.
5. **Inventaires à faire** :
   * Condition : Chantiers avec contrat consommables, `inventaireValidOk !== true`, et `date du dernier inventaire > 182 jours` (ou jamais fait).
6. **Actions suite inventaire (Stocks à récupérer & Avenants)** :
   * Sur le groupe `group_mm8adwxm`, dédupliqué par chantier (ne garder que la ligne la plus récente).
   * Ligne affichée si `À Récupérer > 0` et `rcuprationRalise !== true`, ou `Avenant > 0` et `avenantRalis !== true`.
7. **Rappels & Messages** :
   * Messages du tableau `Communication animatrices` attribués à l'animatrice avec `vu !== true`.

### B. Formules Consommables & Économies (Calcul Direct en Dur)
*Règle d'or : Ne jamais dépendre uniquement du retour API des colonnes formules `formula_*` de Monday (souvent vides). Toujours recalculer en fallback avec les données réelles de contrat et d'inventaire :*
1. **Stock Mini** :
   $$\text{Stock Mini} = \max\left(1, \operatorname{arrondi}\left(\frac{\text{Contrat}}{12} \times 2\right)\right)$$
2. **À Récupérer** :
   $$\text{À Récupérer} = \max(0, \text{Inventaire} - \text{Stock Mini})$$
3. **Durée de consommation** :
   $$\text{Mois} = \frac{\text{À Récupérer} \times 12}{\text{Contrat}} \quad \text{(affiché : « X (Y mois) »)}$$
4. **Avenant calculé** :
   $$\text{Avenant} = \min(\text{À Récupérer}, \operatorname{arrondi}(\text{Contrat} \times 0{,}25))$$
5. **Économie Directe** :
   $$\text{Économie Directe} = \sum (\text{À Récupérer} \times \text{PU HT})$$
6. **Économie Contrat (12 mois)** :
   $$\text{Économie 12 Mois} = \sum (\text{Avenant} \times \text{PU HT})$$

### C. Jauges Étoiles & Satisfaction
* **3🌟** : C1, C2 et C3 = `Globalement bon`
* **2🌟** : C1 et C2 = `Globalement bon` (et pas 3)
* **1🌟** : C1 = `Globalement bon` (et pas 2 ni 3)
* **🙁** : C1 = `Bases non respectées` ou `Plan d'action urgent`
* **Satisfaction globale (%)** : `(Total Visites 'Globalement bon' / Total Visites notées) * 100`

---

## 5. UI, Animations & Bonnes Pratiques
* **Animations Dialog (Radix UI)** : Les animations d'ouverture (ressort doux `scale: 0.94 → 1`, `translate: -50% -48% → -50% -50%`, `opacity: 0 → 1`) et de fermeture (`scale: 1 → 0.94`, `opacity: 1 → 0`) sont accélérées GPU (`will-change: transform, opacity`) dans `src/index.css`.
* **Centrage CSS** : Ne pas ajouter `translate-x-[-50%] translate-y-[-50%]` dans les classes Tailwind du dialog, car le centrage et la translation sont gérés par les keyframes CSS pour éviter les conflits de transformation.
* **Affichage de la modale d'alerte** : S'ouvre automatiquement à la première visite de chaque journée/session, et reste toujours accessible en 1 clic via le bouton orange en haut à droite.

---

## 6. Procédure pour un Nouveau Hub (Repartir de Zéro ou Besoins Différents)

Si l'utilisateur indique vouloir créer un **nouveau hub complètement différent** ou **repartir de zéro** sur un nouveau sujet :

### 1. Ce qu'on conserve impérativement (Le Socle Technique & Sécurité)
* **La Section 1 (Sécurité & Droits)** : Elle s'applique universellement à tous les projets. Interdiction stricte de supprimer des colonnes, des groupes ou des tableaux Monday.
* **Le socle technique prêt à l'emploi** : Vite + React 18 + TypeScript + Tailwind CSS + SDK Monday (`mondayApi.ts`) + authentification CLI (`.mappsrc`). Ne pas réinventer la roue technique.

### 2. Les étapes de réinitialisation automatique par l'agent
1. **Zéro pollution** : Aucun fichier de sondage ou script temporaire (`*.cjs`, `check_*.js`, `dist.zip`) ne doit être conservé.
2. **Réinitialisation du code métier (`src/`)** :
   * Supprimer les fichiers métiers obsolètes de l'ancien domaine (ex : `visits.ts`, `inventory.ts`, jauges étoiles...).
   * Conserver la plomberie Monday (`mondayApi.ts`) et les primitives UI utiles.
   * Remettre `App.tsx` sous forme d'une interface d'accueil propre et moderne, prête pour les nouveaux écrans.
3. **Mise à jour de la mémoire du projet (`AGENTS.md` / `GEMINI.md`)** :
   * Conserver la Section 1 (Sécurité) et la Section 6.
   * Remplacer les Sections 2, 3 et 4 par la cartographie des nouveaux tableaux, nouveaux champs et nouvelles règles métiers demandées par l'utilisateur.

---

## 7. Cartographie & Architecture Maintenance & Parc Machines (ERP-Monday)

| Composant | Tableau Monday | Board ID | Colonnes Clés & Nouveautés |
| :--- | :--- | :--- | :--- |
| **Tableau 1** | **Liste des machines** | `5106585240` | `boolean_mm8tv8zy` (Maintenance préventive), `color_mm8t3v6z` (Fréquence), 12 mois (`boolean_mm8tw6vh` à `boolean_mm8t4bz2`), `numeric_mm8v97ja` (Heures compteur dernier relevé) |
| **Tableau 2** | **Référentiel - Points de contrôle** | `5107261391` | Groupes par type : `group_mm8td794` (Autolaveuse), `group_mm8tcssq` (Monobrosse), `group_mm8t56kz` (Aspirateur), `group_mm8tket6` (Haute pression), `group_mm8tkaq1` (Chariot/Manutention) |
| **Tableau 3** | **Fiche de Contrôle** | `5107262948` | `date_mm8txw52` (Date), `color_mm8tmqfc` (État général : Vert/Orange/Rouge), `dropdown_mm8ty165` (Catégorie intervention), `color_mm8thp7f` (Propreté : Propre/Sale), `color_mm8t1swv` (Entretien : Entretenue/Négligée), `color_mm8tqegk` (Fiche site : Oui/Non), `numeric_mm8tg9cz` (Temps passé), `numeric_mm8v3mw` (Heures compteur), `color_mm8tnjtd` (Bavettes/Suceurs), `color_mm8t6n09` (Brosses), `color_mm8tkhav` (Filtres/Cuves), `color_mm8tbmpe` (Batteries/Câbles), `color_mm8vmnff` (Roues & Roulettes), `color_mm8v31da` (Flexibles/Lances/Buses), `color_mm8vkxty` (Commandes & Mécanique), `long_text_mm8tjqkm` (Détail anomalies) |
| **Tableau 4** | **Réparation machines** | `5106693291` | `board_relation_mm8gc4mh` (Lien machine), `color_mm8gs7c7` (Type: Curative), `date_mm8g4vq6` (Date), `color_mm8vp2nd` (Statut de suivi : 'À traiter', 'En attente de devis', 'En cours de réparation', 'Réparée'), `text_mm8vhwst` (Description panne / Action) |

### Flux d'Automatisation Contrôle Technique ➔ Réparations
Lors de la validation d'une fiche de contrôle dans le Hub :
1. Si un ou plusieurs points sont **Non Conformes (NC)** :
   * Création automatique d'un ticket d'intervention curative dans le **Tableau 4 (Réparations machines)**.
   * `Statut de suivi` initialisé à **« À traiter »**.
   * Insertion de la description détaillée et des actions à mener saisies par le technicien dans `Description panne / Action` (`text_mm8vhwst`).
   * Publication automatique d'un compte-rendu HTML formaté dans le fil d'activité / discussion de l'élément Monday.
2. Si le cadran horaire est renseigné : mise à jour simultanée des heures dans la fiche de contrôle ET dans la colonne `Heures compteur (dernier relevé)` de la machine.


