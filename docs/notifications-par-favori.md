# Notifications d’arrivée : délais par favori

Chaque favori possède ses propres délais de notification pour une ligne, un arrêt
et une destination. Le réglage s’applique à la PWA Web et à l’application Android.
La cloche reste le contrôle qui active ou désactive la surveillance.

## Utilisation

1. Ajouter un arrêt et sa direction aux favoris depuis l’application.
2. Dans « Mes Favoris », ouvrir le bouton « Délais : … / … min ».
3. Dans la modale, renseigner « Prévenir avant (min) » et « Intervalle de rappel (min) ».
4. Vérifier l’aperçu des minutes restantes, puis choisir « Enregistrer ».
5. Activer la cloche du favori et accorder la permission de notification si nécessaire.

Les deux champs acceptent des **minutes entières de 1 à 60**. Les réglages peuvent
être sauvegardés avant d’activer la cloche ; ils ne déclenchent alors aucune
surveillance. Les favoris existants et les nouveaux favoris utilisent par défaut
2 minutes pour la première alerte et 1 minute pour l’intervalle.

« Annuler » ou Échap abandonne la saisie. Après une sauvegarde réussie, la modale
se ferme et le bouton affiche les valeurs enregistrées. Une erreur de
synchronisation laisse la modale ouverte et conserve la saisie pour réessayer ;
les valeurs précédemment enregistrées sont restaurées dans le favori.

## Déclenchement des alertes

L’intervalle sépare des **seuils de temps restant avant l’arrivée**. Il ne s’agit
pas d’un minuteur indépendant répétant une notification toutes les N minutes.
Si l’estimation d’arrivée change, le moment réel des rappels change aussi.

| Prévenir avant | Intervalle | Seuils de notification |
| --- | --- | --- |
| 8 min | 3 min | 8, 5, 2 min restantes |
| 10 min | 2 min | 10, 8, 6, 4, 2 min restantes |
| 2 min | 1 min | 2, 1 min restantes (défaut) |
| 5 min | 8 min | 5 min restantes, sans rappel supplémentaire |

Les seuils suivent la formule `délai initial − k × intervalle`, pour `k ≥ 0`,
en conservant uniquement les valeurs strictement positives. Aucun seuil à zéro
n’est ajouté. Une observation tardive peut néanmoins produire un message
« arrive maintenant » si un seuil positif n’avait pas encore été notifié.

Les secondes fournies par le réseau de transport sont arrondies à la minute.
Les services consultent les horaires environ toutes les 15 secondes ; les délais
réseau et les restrictions du système peuvent retarder une alerte.

Pour le passage surveillé, chaque seuil est notifié une seule fois. Si plusieurs
seuils sont déjà dépassés lors d’une observation, une seule notification regroupe
ces seuils. Par exemple, une première observation à 4 minutes avec le réglage
8 / 3 produit une seule alerte, puis un rappel à 2 minutes.

Un nouveau véhicule réinitialise les seuils. Sans numéro de véhicule, une différence
d’au moins 90 secondes entre les heures d’arrivée estimées distingue un nouveau
passage. Une modification des délais réinitialise également les seuils du passage
courant et peut provoquer une nouvelle alerte dès le prochain cycle.

## Accessibilité de la modale

- Le bouton d’ouverture nomme la ligne, l’arrêt et la destination aux technologies d’assistance.
- La modale possède un titre accessible et rappelle le favori concerné.
- Le premier champ reçoit le focus à l’ouverture ; Tab et Maj+Tab bouclent entre les contrôles.
- Le reste de la page est inerte et son défilement est bloqué pendant l’ouverture.
- Échap et « Annuler » ferment la modale ; le focus revient au bouton d’ouverture.
- Les champs ont des libellés visibles et une validation native des bornes et des entiers.
- Les contrôles ont une hauteur minimale de 44 px et un indicateur de focus visible.
- Le chargement et le succès sont annoncés avec `role="status"`, les erreurs avec `role="alert"`.
- Pendant l’enregistrement, les contrôles sont désactivés et Échap ne ferme pas la modale.
- Aucun effet animé n’est ajouté ; l’information est transmise par du texte.

Le rendu utilise `<dialog>.showModal()` et un `Teleport` vers `body`. Le formulaire
est monté avant l’ouverture pour que le focus initial fonctionne, puis retiré à
la fermeture. Une gestion locale des touches Tab complète le comportement natif.

## Données et synchronisation

| Champ du favori / de l’arrêt surveillé | Type | Défaut | Contraintes |
| --- | --- | --- | --- |
| `notifyEnabled` (favori uniquement) | booléen | `false` | Activation de la cloche |
| `notifyBeforeMinutes` | nombre entier | `2` | 1 à 60 inclus |
| `notifyIntervalMinutes` | nombre entier | `1` | 1 à 60 inclus |

Les favoris sont conservés avec Capacitor Preferences sous `ginku-favorites`.
Au chargement, les valeurs absentes ou invalides des délais sont remplacées par
les valeurs par défaut. Le store et les services valident les nouveaux réglages.

Sur le Web, les arrêts activés sont transmis dans `stops` à
`PUT /api/notifications/subscriptions`. Exemple d’entrée :

```json
{
  "id": "gare-t1",
  "nomArret": "Gare Viotte",
  "idLigne": "1",
  "numLigne": "T1",
  "destination": "Hauts du Chazal",
  "notifyBeforeMinutes": 8,
  "notifyIntervalMinutes": 3
}
```

Les deux délais peuvent être omis par un ancien client : le backend applique 2 / 1.
Une valeur explicitement invalide, y compris une chaîne comme `"3"`, est refusée
avec HTTP 400. La configuration VAPID, l’authentification des abonnements et les
limites du service sont décrites dans [Notifications Web](web-pwa-notifications.md).

Sur Android, le plugin `GinkuStopWatcher` valide et conserve ces valeurs dans la
liste d’arrêts du service natif. Celui-ci surveille les horaires indépendamment du
frontend et utilise les mêmes seuils que le backend Web.

Les optimisations de synchronisation sont les suivantes :

- Une sauvegarde identique n’écrit pas les favoris et n’envoie aucune synchronisation.
- Modifier les délais d’un favori désactivé reste local.
- Le watcher Vue observe uniquement les données réellement transmises des favoris activés.
- Les changements automatiques sont regroupés avec un délai de 300 ms.
- Une synchronisation explicite annule celle en attente pour éviter un envoi en double.

## Fichiers à consulter

| Responsabilité | Fichier |
| --- | --- |
| Modale, saisie, aperçu et focus | `front/src/components/NotificationTiming.vue` |
| Activation de la cloche | `front/src/components/NotificationToggle.vue` |
| Intégration dans les favoris | `front/src/views/home.vue` |
| Valeurs par défaut, validation et persistance locale | `front/src/stores/favorites.js` |
| Synchronisation, optimisation et restauration après erreur | `front/src/composables/useStopNotifications.js` |
| Transport Web Push | `front/src/services/webStopNotifications.js` |
| Validation des délais côté serveur | `backend/notifications/validation.js` |
| Évaluation des seuils Web | `backend/notifications/arrivals.js` |
| Validation native | `front/android/app/src/main/java/org/diogoandrade/ginku/GinkuStopWatcherPlugin.java` |
| Surveillance et seuils Android | `front/android/app/src/main/java/org/diogoandrade/ginku/GinkuStopWatcherService.java` |

## Vérification et limites connues — 10 octobre 2026

Les tests backend de `backend/notifications/notifications.test.js` couvrent les
seuils personnalisés, les doublons, les valeurs invalides, le changement de délais
et les réponses HTTP. Les tests navigateur de `front/tests/pwa.spec.js` couvrent
la sauvegarde et le rechargement, le focus, l’annulation, les sauvegardes sans
changement, les favoris désactivés, les erreurs et la nouvelle tentative.

Depuis la racine :

```sh
pnpm -C backend test
pnpm -C front run test:pwa --grep 'délais|modale'
pnpm -C front run build
pnpm -C front exec cap sync android
```

Depuis `front/android` : `./gradlew assembleDebug` sur Linux/macOS, ou
`.\gradlew.bat assembleDebug` sur Windows. Si le wrapper Linux n’est pas exécutable,
`bash ./gradlew assembleDebug` permet de le lancer.

Résultats observés : 18 tests backend et 4 tests ciblés de modale passent, ainsi
que le lint ciblé, le build Web et la synchronisation Capacitor. Le rendu mobile
a été inspecté sur une largeur de 390 px.

La validation complète reste ouverte :

- Le build Android échoue car `/usr/lib/jvm/java-25-openjdk` ne fournit pas
  `JAVA_COMPILER`. Il faut un JDK complet compatible avant de compiler et de
  tester les rappels sur appareil.
- La suite complète `pnpm -C front run test:pwa` a échoué sur le test de réception
  push après fermeture de la page : `getNotifications()` reste vide sous Chromium.
  La cause n’est pas déterminée ; les quatre tests ciblés ne valident pas ce parcours.
- La réception avec un véritable fournisseur push et les réglages système sur
  appareil reste à vérifier. Les horaires en temps réel nécessitent une connexion.
