RB&F — SUIVI CONTAINERS V5.1
=============================

NOUVEAUTÉS V5.1
----------------
1. DÉPÔT ACCESSIBLE À TOUS SANS MOT DE PASSE APPLICATIF.
   - bouton « Dépôt — accès libre sans mot de passe » sur l'écran d'accueil ;
   - ajout, comptage, réparation, numéros de série et modification du matériel du dépôt ;
   - transfert du dépôt vers le container du chef choisi.

2. NOUVEL ONGLET « TRANSFÉRER » DANS L'ESPACE PRIVÉ DE CHAQUE CHEF.
   - « Transférer au dépôt » : matériel de son container -> dépôt ;
   - « Transférer sur mon chantier » : matériel du dépôt -> son propre container ;
   - un chef ne peut pas transférer du matériel vers le container d'un autre chef.

3. Les transferts déplacent automatiquement les quantités et, pour le matériel sérialisé,
   les numéros de série et dates de contrôle associés.

4. L'onglet ADMIN > MODIFIER reste EXCLUSIVEMENT dans l'espace administrateur.

ACCÈS
-----
Dépôt : aucun mot de passe applicatif.
Administrateur : RBF2026

RIBEIRO PEREIRA Mario : RBFMario
DOMINGUES COSTA Victor : RBFVictor
COSTA Zéférino : RBFZéférino
VANNEREUX Teddy : RBFTeddy
BESA SOUSA Ricardo : RBFRicardo
SILVA DOS SANTOS José : RBFJosé

IMPORTANT : « sans mot de passe » signifie sans mot de passe RB&F. L'application utilise toujours
une session anonyme Supabase en arrière-plan. L'option Anonymous Sign-Ins doit donc rester activée.

SI TON SUPABASE V5 EST DÉJÀ CRÉÉ
--------------------------------
NE recolle PAS tout supabase_schema.sql.

1. Va dans Supabase > SQL Editor > New query.
2. Ouvre PATCH_V5_1.sql.
3. Copie TOUT le contenu du patch.
4. Colle-le dans Supabase puis clique sur Run.
5. Le résultat final doit afficher : PATCH V5.1 OK.

Le patch conserve les inventaires et l'historique déjà présents.

SI TU RECRÉES UNE BASE SUPABASE NEUVE
-------------------------------------
1. Créer le projet Supabase.
2. Authentication > Sign In / Providers > activer « Allow anonymous sign-ins ».
3. SQL Editor > New query.
4. Copier TOUT le contenu de supabase_schema.sql.
5. Cliquer sur Run.

GITHUB — FICHIERS À METTRE À JOUR
---------------------------------
À la racine du dépôt :

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

Le fichier config.js de cette archive contient déjà :
- l'URL du projet : https://uwqhwwjfroalbqctnyyf.supabase.co
- la clé Supabase PUBLIABLE fournie pour ce projet.

Ne jamais mettre une clé sb_secret_ / service_role dans GitHub.

APRÈS LE COMMIT GITHUB
----------------------
1. Attendre le redéploiement GitHub Pages.
2. Ouvrir l'application et faire Ctrl + F5.
3. Si l'application a été installée sur téléphone, la fermer/réouvrir si nécessaire.

TEST RAPIDE
-----------
1. Sur l'accueil, cliquer « Dépôt — accès libre sans mot de passe ».
2. Ajouter ou sélectionner un matériel au dépôt et le transférer vers Ricardo.
3. Se déconnecter.
4. Se connecter comme Ricardo avec RBFRicardo.
5. Ouvrir l'onglet « Transférer ».
6. Vérifier les deux zones :
   - Transférer au dépôt ;
   - Transférer sur mon chantier.
7. Vérifier que Ricardo ne peut envoyer/reprendre que vers/depuis son propre container.
8. Se connecter en admin avec RBF2026 et vérifier que l'onglet « Modifier » est toujours uniquement côté admin.
