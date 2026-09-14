RB&F — CONTENEURS SUIVI V5.3
================================

NOUVEAUTÉ : ONGLET FACTURES
---------------------------
L'onglet « Factures » est disponible :
- dans chaque espace chef de chantier ;
- dans l'espace dépôt ;
- dans la vue administrateur d'un container et du dépôt.

Pour chaque matériel de l'inventaire, il est possible de :
- joindre une facture d'achat ;
- joindre un justificatif ou une facture de réparation ;
- indiquer le prix / montant en euros ;
- indiquer la date, un intitulé et un commentaire ;
- ouvrir ou supprimer une pièce jointe.

Les montants d'achat, de réparation et le total sont calculés
automatiquement. Les données et pièces jointes sont synchronisées par
Supabase sur téléphone et ordinateur.

Formats acceptés : PDF, JPG, PNG et WEBP, jusqu'à 15 Mo par fichier.

ÉTAPE 1 — SUPABASE (OBLIGATOIRE)
--------------------------------
Faire cette étape AVANT de remplacer les fichiers sur GitHub :

1. Ouvrir le projet Supabase.
2. Cliquer sur SQL Editor puis New query.
3. Ouvrir le fichier PATCH_V5_3_FACTURES.sql de ce dossier.
4. Copier tout son contenu dans Supabase.
5. Cliquer sur Run.
6. Vérifier que le résultat affiche :
   PATCH V5.3 OK — factures et réparations activées

Le script crée :
- la table equipment_documents ;
- l'espace privé rbf-documents pour les pièces jointes ;
- les règles d'accès liées aux inventaires déjà visibles dans l'application ;
- la synchronisation en temps réel.

ÉTAPE 2 — GITHUB
----------------
Remplacer les fichiers de l'application par TOUS les fichiers de ce dossier :

- index.html
- app.js
- styles.css
- config.js
- service-worker.js
- manifest.webmanifest
- icon-192.png
- icon-512.png
- rbf-logo.png
- rbf-banner.png

Le fichier PATCH_V5_3_FACTURES.sql peut aussi rester dans GitHub, mais il
n'est pas chargé par l'application.

Après le commit GitHub :
1. attendre le redéploiement du site ;
2. faire Ctrl + F5 sur ordinateur ;
3. sur téléphone, fermer puis rouvrir l'application installée.

IMPORTANT
---------
L'espace dépôt actuel est accessible sans mot de passe. L'onglet Factures du
dépôt est donc lui aussi accessible aux utilisateurs qui ouvrent cet espace.
