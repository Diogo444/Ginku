# PWA et notifications Web

## Fonctionnement

Le Web utilise un service worker pour mettre en cache l'interface et recevoir les
notifications push. Il ne peut pas maintenir une boucle de consultation toutes les
15 secondes lorsque l'application est fermée. Le backend surveille donc les favoris
activés, mutualise les demandes d'horaires par nom d'arrêt et envoie les alertes aux
seuils configurés par favori (2 puis 1 minute par défaut), avec le même arrondi que le service Android.

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

## Délais par favori

Voir le [guide complet des délais par favori](notifications-par-favori.md) pour
le parcours utilisateur, la modale accessible, les règles de déclenchement,
le contrat des données et les fichiers à maintenir.

Le bouton « Délais » de chaque favori ouvre une boîte modale permettant de régler `notifyBeforeMinutes`
(première alerte) et `notifyIntervalMinutes` (intervalle entre les seuils),
deux entiers de 1 à 60 minutes transmis dans chaque entrée de `stops`.
Les anciennes entrées utilisent 2 et 1. Exemple : 8 / 3 alerte à 8, 5 puis
2 minutes restantes, sur Android et Web. Aucun seuil supplémentaire à zéro.
Une observation tardive regroupe les seuils dépassés en une seule alerte.
Les horaires sont arrondis à la minute et vérifiés environ toutes les 15 secondes ;
les alertes suivent les estimations du réseau de transport. Modifier les délais
réinitialise les seuils du passage courant et peut donc déclencher une nouvelle alerte.

### Vérification des délais — 10 octobre 2026

- Lint frontend ciblé, syntaxe backend, build Web et synchronisation Android : OK.
- 18 tests backend : OK, avec démarrage réel du serveur et validation HTTP des délais.
- 8 tests navigateur sur 9 : OK, dont réglage au clavier, transmission, sauvegarde
  après rechargement et absence de débordement sur écran de 390 px.
- `pnpm -C front run test:pwa` échoue sur la réception push après fermeture :
  `getNotifications()` reste vide sous Chromium ; cause non déterminée.
- `bash ./gradlew assembleDebug` échoue : l'installation Java 25 disponible
  n'offre pas `JAVA_COMPILER`. Il reste à compiler avec un JDK complet compatible
  puis à vérifier les rappels sur Android et la réception push réelle.

### Intégration modale et accessibilité

La modale utilise un dialogue HTML natif : arrière-plan inerte, champs libellés,
focus initial sur le premier champ, boucle Tab/Maj+Tab, fermeture avec Échap ou
Annuler et retour du focus au bouton. Les changements ne sont enregistrés qu'après
validation ; une erreur laisse la saisie disponible pour réessayer. Les états de
sauvegarde et les erreurs sont annoncés. Aucun effet animé n'est ajouté.
Le formulaire est monté à l'ouverture et les délais des favoris désactivés restent
locaux. Une sauvegarde identique n'écrit ni ne synchronise ; une sauvegarde explicite
annule la synchronisation différée pour éviter les envois en double.
Les quatre tests ciblés de modale passent, ainsi que le lint, le build Web et la
synchronisation Capacitor. Le build Android reste bloqué par l'absence de
`JAVA_COMPILER` dans Java 25 ; le test push après fermeture reste en échec.
