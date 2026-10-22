# Cache et mises à jour Web

Le déploiement existant reconstruit l'image du frontend et remplace le conteneur.
La correction sera appliquée après le merge et le déploiement habituels, sans
modification du workflow GitHub Actions.

## Cache HTTP

`front/Caddyfile` réserve `public, max-age=31536000, immutable` aux fichiers
existants de `/assets/`, dont Vite change le nom lorsque leur contenu change.
Un chunk supprimé retourne 404 au lieu de retourner le HTML de l'application.

Le HTML (y compris les routes Vue comme `/lignes`), `/sw.js`, le manifeste et
les fichiers publics sans empreinte utilisent `Cache-Control: no-cache`.
Cela autorise leur stockage, mais impose une revalidation avant réutilisation
par le cache HTTP. Les réponses 304 restent possibles.

## Cycle de la PWA

Le service worker conserve le précache Workbox pour le mode hors ligne.
Une nouvelle version s'active dès que son installation et son précache ont
réussi (`skipWaiting`), puis prend le contrôle des pages (`clients.claim`).
Le client recharge chaque onglet une seule fois lors du changement de worker,
en conservant son URL. La première prise de contrôle après installation ne
déclenche pas de rechargement. Les favoris et préférences ne sont pas effacés.
Un rechargement peut fermer une modale et perdre une saisie non enregistrée.

En production Web, une vérification est faite au démarrage, au retour sur un
onglet visible, au retour du réseau et toutes les cinq minutes lorsque la page
est visible et le navigateur en ligne. L'enregistrement utilise déjà
`updateViaCache: 'none'`, indépendamment des anciens en-têtes de `/sw.js`.
Ces mécanismes sont désactivés dans l'application native Capacitor et en
développement. L'installation d'une mise à jour en échec laisse la version
active utilisable ; les horaires restent exclusivement réseau.

### Transition depuis une ancienne version

Un onglet exécutant l'ancien JavaScript ne possède pas encore l'écouteur de
rechargement automatique. Le nouveau worker peut néanmoins s'activer sans
attendre sa fermeture. Une fois celui-ci installé, une nouvelle navigation ou
un rechargement normal permet de récupérer la nouvelle interface, sans vider
le stockage du site. Les mises à jour suivantes rechargent automatiquement les
onglets qui exécutent le client corrigé. Aucune mise à jour ne peut être
récupérée tant que le navigateur est hors ligne.

## Vérifications

- `pnpm -C front run build`
- `pnpm -C front run test:pwa` : inclut une ancienne PWA, deux onglets ouverts,
  un changement réel de worker et de HTML, la conservation du stockage, un
  serveur de mise à jour en erreur et le fonctionnement hors ligne.
- En production, vérifier avec `curl -I` les en-têtes de `/`, `/lignes`,
  `/sw.js`, `/manifest.json`, d'un fichier `/assets/` existant et d'un chunk absent.
  `vite preview` ne charge pas le Caddyfile et ne valide pas les en-têtes de production.

Références : [cycle de vie du service worker](https://web.dev/articles/service-worker-lifecycle),
[mise à jour automatique avec injectManifest](https://vite-pwa-org.netlify.app/guide/inject-manifest),
[configuration SPA de Caddy](https://caddyserver.com/docs/caddyfile/patterns#single-page-apps-spas).
