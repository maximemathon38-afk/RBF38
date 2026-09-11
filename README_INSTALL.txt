RB&F — SUIVI CONTAINERS V5
===========================

Cette version est prévue pour repartir sur un NOUVEAU projet Supabase et un nouveau dépôt GitHub.

NOUVEAUTÉS
-----------
1. Accès privé par chef de chantier.
   Mot de passe = RBF + prénom.
2. Onglet ADMIN > DÉPÔT.
   - ajouter du matériel directement au dépôt ;
   - modifier / compter / suivre les numéros de série ;
   - transférer du dépôt vers un chef ;
   - depuis le container d'un chef, transférer du matériel vers le dépôt.
3. Le transfert met automatiquement à jour les deux inventaires.
4. Pour le matériel avec numéro de série, on choisit les exemplaires à transférer et leur fiche suit le matériel.
5. Onglet ADMIN > MODIFIER pour modifier le nom et le prénom des chefs.
6. Si le prénom d'un chef est modifié, son mot de passe est automatiquement recalculé : RBF + nouveau prénom.

MOTS DE PASSE INITIAUX
----------------------
Administrateur : RBF2026

RIBEIRO PEREIRA Mario : RBFMario
DOMINGUES COSTA Victor : RBFVictor
COSTA Zéférino : RBFZéférino
VANNEREUX Teddy : RBFTeddy
BESA SOUSA Ricardo : RBFRicardo
SILVA DOS SANTOS José : RBFJosé

IMPORTANT : ces mots de passe sont volontairement simples car ils suivent la règle demandée. Pour une application exposée publiquement, il est recommandé de choisir des mots de passe plus forts.

INSTALLATION SUPABASE
---------------------
1. Créer un nouveau projet Supabase.
2. Dans Authentication, activer les connexions anonymes / Anonymous Sign-Ins.
   Le nom exact du menu peut varier légèrement dans l'interface Supabase.
3. Ouvrir SQL Editor > New query.
4. Copier TOUT le contenu de supabase_schema.sql.
5. Cliquer sur Run une seule fois sur la base neuve.
6. Vérifier que la fin du script affiche les 6 chefs et les containers + le dépôt.
7. Récupérer dans les réglages API du projet :
   - Project URL
   - clé PUBLIABLE / ANON (jamais une clé secrète/service_role)
8. Ouvrir config.js et remplacer :
   SUPABASE_URL
   SUPABASE_PUBLISHABLE_KEY

INSTALLATION GITHUB
-------------------
Mettre ces fichiers à la racine du dépôt :

- index.html
- app.js
- styles.css
- config.js
- manifest.webmanifest
- service-worker.js
- icon-192.png
- icon-512.png
- rbf-logo.png
- rbf-banner.png

Le fichier supabase_schema.sql peut aussi être conservé dans GitHub pour archivage, mais il n'est pas exécuté par le site.

Ensuite activer GitHub Pages sur la branche principale, dossier racine /.

TEST CONSEILLÉ
--------------
1. Ouvrir l'application en navigation privée.
2. Tester Mario avec RBFMario.
3. Vérifier qu'il ne voit que son container.
4. Se déconnecter puis tester l'admin avec RBF2026.
5. Aller dans Dépôt > ajouter un Piqueur.
6. Cliquer sur Transférer > choisir Ricardo.
7. Vérifier que le Piqueur disparaît/diminue au dépôt et apparaît automatiquement dans le container de Ricardo.
8. Aller dans Modifier > changer un prénom, se déconnecter, puis tester le nouveau mot de passe RBF + nouveau prénom.

NOTE
----
Ne pas relancer tout le fichier supabase_schema.sql sur une base déjà utilisée après avoir renommé les chefs ou saisi des données réelles. Ce fichier est conçu avant tout pour l'installation initiale d'une base neuve.
