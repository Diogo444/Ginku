# Revue de maintenance du 18 octobre 2026

Cette passe couvre les dépendances, le proxy Ginko, les notifications Web,
les vérifications frontend, la synchronisation Android et les images Docker.
Elle ne constitue pas un audit de sécurité exhaustif.

## Modifications

- Mise à jour des dépendances dans leurs versions majeures existantes : notamment
  Axios 1.20, Express 5.3, Vue 3.5.44 et Capacitor 8.5.3. Les versions résolues sont
  enregistrées dans `pnpm-lock.yaml`.
- Suppression du bloc `pnpm.overrides` de `package.json`, ignoré par pnpm 12.
  Les mises à jour résolvent les alertes de production sans imposer de versions
  majeures arbitraires aux dépendances transitives. Une future dérogation ciblée
  doit être définie dans `pnpm-workspace.yaml` et vérifiée chez ses consommateurs.
- Client Ginko dédié avec délai commun de huit secondes ; les journaux ne
  sérialisent plus les erreurs Axios contenant la configuration et la clé API.
- Validation complète des coordonnées GPS : rejet des chaînes partielles,
  paramètres multiples et valeurs hors des bornes géographiques avec HTTP 400.
- Notifications Web : sélection du prochain passage valide, indépendamment de
  l'ordre reçu ; les entrées nulles ou invalides sont ignorées.
- ESLint ignore les projets natifs et leurs fichiers générés. `pnpm lint` vérifie
  désormais sans modifier les sources ; `pnpm -C front lint:fix` corrige explicitement.
- TypeScript ajouté pour charger `capacitor.config.ts` ; wrapper Gradle exécutable.
- Playwright utilise le canal `chromium` : le test de notification échouait avec
  le headless shell dans cet environnement, puis passe avec Chromium complet.
- Les Dockerfiles utilisent la version pnpm déclarée à la racine. Le backend
  installe uniquement les dépendances de production. Les secrets, données locales
  et projets natifs sont exclus du contexte Docker, avec conservation des deux
  fichiers Vite contenant les URL publiques.

## Vérifications

- Installation avec `pnpm install --frozen-lockfile` : réussie.
- `node --check` sur les sept fichiers JavaScript backend modifiés ou ajoutés : réussi.
- `pnpm -C backend test` : 23 tests réussis, dont démarrage du backend réel et
  routes HTTP des abonnements, authentification et erreurs de validation.
- Test réel Ginko : `/health` en HTTP 200 ; arrêts proches de Besançon en HTTP 200
  avec 28 résultats en environ 0,82 seconde ; latitude invalide en HTTP 400.
- `pnpm -C front exec eslint .` et `pnpm -C front run build` : réussis.
- `pnpm -C front run test:pwa` : 15 tests réussis, dont clavier, focus de modale,
  zones tactiles, persistance, erreurs, navigation hors ligne et push.
- Contrôle visuel de la capture mobile de la modale : aucun débordement observé.
- `pnpm -C front exec cap sync android` : réussi avec les trois plugins officiels.
- `./gradlew assembleDebug` : réussi avec JDK 21 et SDK Android configurés.
  La machine fournissait initialement seulement JDK 25 et aucun `ANDROID_HOME`.
  Le JDK 21 utilisé pour la vérification a été extrait dans `/tmp/ginku-jdk21` ;
  ce chemin temporaire ne doit pas être utilisé comme configuration permanente.
  Ni Gradle ni Android Gradle Plugin n'ont été mis à niveau.
- Construction des deux images Docker et absence du fichier backend `.env`
  dans l'image : vérifiées.

## Points restant à traiter

`pnpm audit --prod` ne signale plus de vulnérabilité, contre 31 avant cette passe.
L'audit complet passe de 83 à 18 alertes : 1 critique, 12 élevées et 5 modérées,
exclusivement dans les dépendances de développement. **`pnpm audit` retourne
encore un code d'échec** : le projet ne peut pas être présenté comme exempt de
vulnérabilités. Les chaînes concernées sont `@capacitor/assets` (tar et sharp),
les outils Xcode de Capacitor (uuid), nodemon (braces) et eslint-plugin-vue
(postcss-selector-parser). Leur remplacement ou leur correction demande une
vérification des API et des fonctions de génération d'assets ; aucune substitution
majeure forcée n'a été appliquée pour masquer ces alertes.

Aucun appareil Android n'était connecté : lancement, permissions et notifications
sur appareil restent à vérifier. iOS n'a pas été compilé dans cet environnement Linux.

La revue a aussi identifié des sujets distincts pour une prochaine passe :

- assainir le HTML externe affiché avec `v-html` dans `message.vue` ;
- borner les caches mémoire du proxy et harmoniser les erreurs API côté frontend ;
- automatiser les contrôles backend, PWA et Android avant le déploiement.

## Documentation consultée

- [Configuration des requêtes Axios](https://axios-http.com/docs/req_config)
- [API Express 5](https://expressjs.com/en/5x/api.html)
- [Exclusions ESLint](https://eslint.org/docs/latest/use/configure/ignore)
- [Configuration pnpm](https://pnpm.io/settings)
- [Capacitor 8](https://capacitorjs.com/docs/updating/8-0)
- [Correctif de sécurité Capacitor](https://github.com/ionic-team/capacitor/security/advisories/GHSA-rvm3-566m-v7fv)
- [Chromium complet dans Playwright](https://playwright.dev/docs/browsers#chromium-new-headless-mode)

## Correctif après vérification du démarrage en développement

La première passe avait vérifié le frontend compilé, sans tester `pnpm dev`.
Une capture de la console a révélé deux défauts encore présents :

- En développement, `/sw.js` retournait le fallback HTML de Vite : l'enregistrement
  du service worker échouait avec un type MIME `text/html`, puis la synchronisation
  des notifications échouait également. Le mode développement de Vite PWA est
  désormais activé, avec `/dev-sw.js?dev-sw` et un worker de type module.
  La production conserve `/sw.js` et un worker classique. La navigation du worker
  de développement est limitée à la racine pour laisser Vite servir les autres URL.
- En quittant l'accueil, les annulations normales étaient journalisées comme
  des erreurs et le client API pouvait transmettre la même promesse annulée à un
  autre écran. L'accueil ignore ses résultats après annulation ; les appels munis
  de signaux indépendants ne partagent plus leur promesse. Le cache de réponses
  et la mutualisation des appels sans signal sont conservés.

`pnpm -C front run test:dev` lance une suite dédiée sur le véritable serveur Vite,
avec simulation des réponses API. Ses trois cas couvrent l'enregistrement et le
type MIME du worker, une navigation rapide et l'isolation des annulations.
Ils échouaient avant correction et passent après correction. La console du
navigateur est contrôlée au démarrage et pendant la navigation.

Référence : [mode développement de Vite PWA et enregistrement manuel](https://vite-pwa-org.netlify.app/guide/development.html).

## Rétablissement des lignes et du trafic en local

Le backend précédemment lancé sur le port 3000 était suspendu (état système `T`)
et ne répondait même plus à `/health`. La nouvelle instance ne pouvait pas prendre
ce port. Le serveur actif a été relancé via nodemon après libération du port.
La vérification réelle confirme HTTP 200 avec 156 lignes et 156 états de lignes ;
la navigation dans Chromium sur `http://localhost:5174` affiche les 156 lignes et
les liens de trafic, sans alerte utilisateur.

Le client frontend transformait également les erreurs HTTP/réseau en réponses
`data: null`, puis les méthodes métier les convertissaient en listes vides.
Il propage désormais les échecs aux écrans pour activer leurs messages accessibles
et leur bouton Réessayer. Les annulations gardent leur traitement distinct.
Trois cas supplémentaires couvrent l'affichage des données, les pannes des lignes
et du trafic, ainsi que le rétablissement après une nouvelle tentative.
Les deux suites Playwright utilisent des sous-dossiers de résultats distincts
pour éviter qu'une exécution efface les traces de l'autre.
