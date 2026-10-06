# PWA et notifications Web

## Fonctionnement

Le Web utilise un service worker pour mettre en cache l'interface et recevoir les
notifications push. Il ne peut pas maintenir une boucle de consultation toutes les
15 secondes lorsque l'application est fermée. Le backend surveille donc les favoris
activés, mutualise les demandes d'horaires par nom d'arrêt et envoie les alertes aux
seuils de 2 puis 1 minute, avec le même arrondi que le service Android.

Les horaires et les réponses API ne sont jamais mis en cache par le service worker.
L'interface et les favoris restent accessibles hors ligne ; les horaires nécessitent
une connexion. Le service worker mis à jour s'active après fermeture des anciennes
fenêtres de la PWA, afin de conserver une interface cohérente avec son cache.

Android Capacitor continue d'utiliser son service natif et le plugin officiel de
notifications. Aucun service worker n'est enregistré dans la WebView native.

## Configuration du serveur

Générer une paire de clés une seule fois, sur une machine de confiance :

```sh
pnpm -C backend exec web-push generate-vapid-keys --json
```

Configurer les variables suivantes dans `backend/.env` pour un lancement local
avec `pnpm -C backend start`, ou dans le `.env` racine pour Docker Compose :

```dotenv
VAPID_PUBLIC_KEY=<publicKey>
VAPID_PRIVATE_KEY=<privateKey>
VAPID_SUBJECT=mailto:<adresse-de-contact>
WEB_PUSH_ORIGINS=https://ginku.diogo-andrade.org,http://localhost:5173
WEB_PUSH_STORE_PATH=data/web-push-subscriptions.json
```

La clé privée reste sur le serveur. La clé publique est fournie au navigateur par
`GET /api/notifications/config` ; elle n'est pas intégrée au build frontend.
Sans les trois variables VAPID, la PWA reste utilisable et l'activation d'une cloche
affiche une erreur de configuration. Des clés invalides ou un fichier de stockage
corrompu font échouer le démarrage plutôt que de perdre les abonnements.

Avec Docker Compose, un volume nommé `web_push_data` conserve les abonnements après
recréation du conteneur. Conserver les mêmes clés lors des redéploiements. Si les clés
VAPID changent, les utilisateurs doivent désactiver puis réactiver leurs notifications.

Cette première version utilise un fichier JSON avec écritures atomiques et exige
**un seul processus backend**. Pour plusieurs réplicas, remplacer ce stockage et
l'ordonnanceur par un service partagé. Maximum : 1 000 navigateurs, 20 favoris par
navigateur. Les abonnements sont supprimés après 30 jours sans synchronisation ;
une nouvelle visite renouvelle cette durée. Les réponses push 404/410 suppriment
les abonnements expirés. Les autres erreurs sont réessayées au prochain cycle.

Les endpoints push acceptés sont ceux de Google/Chromium, Mozilla, Apple et Windows.
Un fournisseur supplémentaire doit être explicitement ajouté dans `validation.js`.
Les endpoints libres ou privés sont refusés pour éviter les requêtes vers un réseau
interne. Les créations et modifications exigent une origine autorisée, une entrée
validée et une limite de 60 demandes par minute et IP. Derrière un proxy, cette limite
porte sur l'IP du proxy : aucun en-tête `X-Forwarded-For` n'est approuvé implicitement.

## Contrat HTTP

- `GET /api/notifications/config` : `{ enabled, publicKey }`, réponse non cachable.
- `PUT /api/notifications/subscriptions` : `{ subscription, stops, id? }`.
  À la création, retourne `{ id, token }`. Pour les modifications, fournir `id`
  et `Authorization: Bearer <token>`. Le jeton secret reste dans le stockage local.
- `DELETE /api/notifications/subscriptions/:id` : même autorisation, réponse 204.
- Erreurs JSON : 400 entrée invalide, 401 capacité inconnue/invalide, 403 origine
  refusée, 409 endpoint déjà enregistré, 413 corps trop grand, 429 limite atteinte,
  503 configuration absente ou capacité atteinte, 500 échec de sauvegarde.

Seuls les favoris avec la cloche activée sont envoyés au serveur. La désactivation
de toutes les cloches supprime l'enregistrement serveur puis l'abonnement navigateur.
Les envois ont un délai réseau maximal de 8 secondes et une durée de vie de 30
secondes chez le fournisseur pour limiter les alertes devenues périmées. La cadence
est de 15 secondes **après** chaque cycle ; un cycle lent augmente donc l'intervalle.

## Essai local

```sh
pnpm -C backend start
pnpm -C front run build --mode development
pnpm -C front run preview --host localhost --port 5173
```

Ouvrir `http://localhost:5173`, installer Ginku depuis le menu du navigateur,
ajouter un favori puis activer sa cloche. L'autorisation est demandée uniquement
après un clic. Sur iPhone/iPad compatibles, ajouter la PWA à l'écran d'accueil
avant d'activer les notifications. En production, HTTPS est obligatoire.

L'installation et la réception dépendent du navigateur et de ses réglages. Une
fermeture forcée du navigateur, un appareil hors réseau ou les restrictions du
système peuvent empêcher ou retarder une alerte. Le Web n'offre pas de notification
permanente avec un compteur mis à jour comme le foreground service Android.

## Vérifications

```sh
pnpm -C backend test
pnpm -C front exec playwright install chromium
pnpm -C front run build
pnpm -C front run test:pwa
pnpm -C front exec cap sync android
```

Sous PowerShell, un navigateur Edge déjà installé peut être utilisé sans télécharger
Chromium : `$env:PLAYWRIGHT_CHANNEL='msedge'` avant `test:pwa`.

Les tests backend couvrent les seuils, les doublons, le stockage, les permissions
HTTP, les erreurs réseau et la suppression des abonnements. Les tests navigateur
utilisent le véritable service worker avec un transport push simulé : installation,
mode hors ligne, clavier, refus de permission, rollback et réception d'un push via
DevTools après départ de la page. Ils ne remplacent pas un essai sur appareil avec
les clés VAPID du serveur et un véritable fournisseur push.

### Vérification de la migration — 6 octobre 2026

- Lint des fichiers frontend modifiés et `node --check` des fichiers backend : OK.
- Build frontend et synchronisation Capacitor Android : OK.
- 15 tests backend et 8 tests navigateur sous Edge : OK.
- Backend démarré : `/health` et configuration push répondent 200 ; activation sans
  VAPID répond 503 ; récupération réelle des horaires de Gare Viotte répond 200.
- `front/android/.\gradlew.bat assembleDebug` : **échec**, `SDK location not found`.
  Un JDK existant permet de démarrer Gradle, mais il reste à configurer le SDK
  Android (`ANDROID_HOME` ou `sdk.dir` dans `local.properties`), compiler et tester
  sur un appareil. Aucune version de Gradle, AGP ou JDK n'a été mise à niveau.
- L'envoi avec le fournisseur push réel et les clés de production reste à vérifier.

## Références

- [Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [Service workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Vite PWA injectManifest](https://vite-pwa-org.netlify.app/guide/inject-manifest)
- [Workbox precaching](https://developer.chrome.com/docs/workbox/modules/workbox-precaching)
- [web-push 3.x](https://github.com/web-push-libs/web-push)
- [Web Push sur iOS/iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
