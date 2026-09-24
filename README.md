# Bivouac Scout

Application statique de préparation des bivouacs sur une trace GPX. Le site se déploie tel quel sur Vercel, sans compilation ni variables d'environnement.

## Déploiement

Relier ce dépôt GitHub au projet Vercel existant `bivouac-scout-free`. Choisir le framework `Other`, le dossier racine du dépôt et aucune commande de build. Les modifications de la branche principale se déploieront ensuite automatiquement.

## Données de relief

Le calcul sur la zone de ±3 km utilise l'API altimétrique IGN lors de la demande de l'utilisateur. Si le service est inaccessible, l'application indique qu'elle utilise uniquement les altitudes du GPX. Ces mesures aident à repérer le relief et ne valident pas à elles seules un emplacement de bivouac.
