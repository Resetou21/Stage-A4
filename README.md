# 🎓 Stage A4 — Projets & Applications Groupe Facility

Dépôt centralisant les applications et développements réalisés dans le cadre du stage A4 au sein du **Groupe Facility**.

---

## 📁 Projets Inclus

### 🏢 [Hub Responsable de Secteur](./Hub%20de%20responsable%20de%20secteur)
Application sur-mesure déployée sur **Monday Code CDN** pour les Responsables de Secteur :
* **Gestion des chantiers & contrôles qualité** (notation par étoiles, codes d'accès, historique).
* **Stocks, consommables & économies** (calcul des stocks mini, surplus, avenants préconisés, économies directes et annuelles).
* **Visites clients & plans d'action**.
* **Centre d'alertes préventives automatisées**.

👉 *Consultez le [README détaillé du Hub](./Hub%20de%20responsable%20de%20secteur/README.md) pour le guide d'installation, l'architecture du code, les explications pas-à-pas pour modifier l'application et les procédures de déploiement.*

---

### 🔧 [ERP Parc Matériel (`ERP-Monday`)](./ERP-Monday)
Application Monday.com de gestion du parc machines, maintenance préventive/curative et stocks de pièces détachées :
* **Contrôle Technique Terrain & Sous-éléments** : Saisie conforme / moyen / non conforme par machine, suivi compteur d'heures et création automatique des sous-éléments de contrôle dans Monday.
* **Maintenance Préventive (Matrice 12 mois) & Agenda** : Planification annuelle par fréquence, calendrier interactif FullCalendar et suivi du parc (`En service`, `En réparation`, `À vérifier / Sortie`).
* **Réparations Curatives & Import Bon Fournisseur (PDF)** : Parsing automatique de bons d'intervention PDF (`pdfjs-dist`), rattachement automatique aux machines/tickets ouverts et synchronisation des statuts.
* **Stocks Pièces & Consommables** : Gestion en temps réel des seuils mini et mouvements de stock synchronisés sur Monday.

👉 *Consultez le [README de l'ERP Parc Matériel](./ERP-Monday/README.md) pour l'architecture, les tableaux Monday associés et la procédure de build/déploiement.*
