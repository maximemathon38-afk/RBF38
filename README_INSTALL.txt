RB&F — CONTENEURS SUIVI V5.2
==============================

NOUVEAUTÉS V5.2
----------------
1. Dans chaque espace chef et dans le dépôt :
   - bouton + Matériel
   - bouton 🚜 Engin
   - bouton 🪝 Élingue

2. Engins de chantier :
   - type / nom de l'engin
   - marque
   - modèle
   - description
   - quantité
   - n° de série / identification

3. Élingues de grue :
   - nom / référence
   - marque
   - modèle / référence
   - description (CMU, longueur, nombre de brins, etc.)
   - quantité
   - une fiche par exemplaire avec :
       • n° d'identification / série
       • date du dernier contrôle
       • date du prochain contrôle

4. Les informations suivent automatiquement l'engin ou l'élingue lors
   d'un transfert entre le dépôt et un chantier.

MISE À JOUR D'UN SUPABASE V5.1 EXISTANT
---------------------------------------
Dans Supabase > SQL Editor > New query :
1. ouvrir PATCH_V5_2.sql
2. copier tout le fichier
3. coller puis cliquer Run
4. vérifier : PATCH V5.2 OK — engins et élingues activés

GITHUB
------
Remplacer les fichiers de l'application par ceux de ce dossier, notamment :
- index.html
- app.js
- styles.css
- service-worker.js
- manifest.webmanifest

Le config.js fourni conserve la configuration Supabase de la V5.1.
Après le commit GitHub, faire Ctrl+F5 dans le navigateur.
