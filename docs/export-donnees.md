# Export des données locales

La carte « Exporter mes données », dans « Mon profil » → « Vos données », crée
un fichier JSON contenant les données enregistrées par l’application dans
`localStorage` et Capacitor Preferences. L’export lit les stockages sans les modifier.
La carte « Importer mes données » permet de restaurer ce fichier après confirmation ;
voir [l’import des données](import-donnees.md).

## Utilisation

1. Ouvrir le profil depuis le bouton « Ouvrir mon profil » de l’accueil.
2. Dans « Vos données », choisir « Exporter mes données ».
3. Lire la fenêtre qui présente le contenu du fichier : favoris, nom, réglages et
   autres données enregistrées dans Ginku. Elle rappelle que le fichier permettra
   de retrouver ces données plus tard grâce à « Importer mes données ».
4. Choisir « Exporter » pour créer le fichier, ou « Annuler » pour revenir au profil.
5. Sur le Web, récupérer le fichier téléchargé par le navigateur.
6. Sur Android, choisir un emplacement dans le sélecteur système puis enregistrer.

Aucune donnée n’est lue et aucun fichier n’est créé avant le choix « Exporter ».
La fenêtre reste ouverte en cas d’erreur pour permettre une nouvelle tentative.
Elle se ferme après le téléchargement Web, l’enregistrement ou l’annulation du
sélecteur Android ; le résultat est alors annoncé sous la carte.

Le nom proposé contient la date et l’heure UTC de création, par exemple
`ginku-sauvegarde-2026-10-22T09-00-00-000Z.json`.
Le fichier est du JSON lisible, indenté et encodé en UTF-8.
Il est généré localement, sans envoi à une route backend. Sur Android, l’utilisateur
peut choisir un fournisseur de documents local ou distant dans le sélecteur système.

Le bouton est désactivé pendant la préparation et, sur Android, jusqu’à la fin
du choix et de l’écriture. Un message indique le résultat :

| Situation | Message |
| --- | --- |
| Téléchargement Web lancé | « Le téléchargement de votre sauvegarde JSON a été lancé. » |
| Écriture Android terminée | « Votre sauvegarde JSON a été enregistrée. » |
| Sélecteur Android annulé | « Export annulé. » |
| Erreur de lecture ou d’enregistrement | « Impossible d’exporter vos données. Veuillez réessayer. » |

Sur le Web, le message confirme le lancement du téléchargement ; l’application
ne peut pas confirmer que le navigateur a effectivement conservé le fichier.

## Données incluses et limites

L’export parcourt toutes les clés des deux stockages, sans liste fixe de préférences :

- `storage.localStorage` contient toutes les entrées du stockage Web de l’origine
  courante, y compris dans la WebView Android. Le pseudo y est enregistré.
- `storage.preferences` contient toutes les entrées du groupe Capacitor Preferences
  utilisé par l’application. Les favoris, le thème et le contraste élevé y sont
  conservés lorsqu’ils ont été enregistrés.

Sur le Web, Preferences repose également sur `localStorage`, avec des clés
préfixées `CapacitorStorage.`. Une même préférence peut donc apparaître dans les
deux sections. Sur Android, les deux stockages sont distincts : conserver les deux
sections évite de perdre une valeur ou d’écraser deux clés de même nom.

Les chaînes sont exportées telles quelles, y compris les valeurs vides, les accents,
les emojis et les chaînes contenant du JSON. Une valeur JSON déjà stockée n’est pas
convertie en objet. Les clés conservent leur nom, y compris `__proto__`.
Une valeur disparue entre l’énumération et sa lecture peut être `null`.

L’export ne contient pas les caches réseau ou PWA, IndexedDB, les cookies, les
permissions système, les données serveur ni les préférences internes des services
Android, comme le suivi d’un téléchargement de mise à jour ou la copie des arrêts
surveillés. Ce n’est pas une sauvegarde complète de l’installation Android.
Les réglages de notification enregistrés dans les favoris sont néanmoins inclus.

Le fichier n’est pas chiffré et peut contenir des données personnelles : le conserver
dans un emplacement adapté. La lecture n’est pas une transaction entre les deux
stockages ; éviter de modifier les préférences pendant la préparation de l’export.
Toute erreur de lecture interrompt la création de la sauvegarde. Une erreur
d’écriture Android peut laisser un document vide ou incomplet à l’emplacement choisi.

## Contrat du format JSON — version 1

Exemple simplifié d’un export Android :

```json
{
  "app": "Ginku",
  "version": 1,
  "exportedAt": "2026-10-22T09:00:00.000Z",
  "platform": "android",
  "storage": {
    "localStorage": {
      "ginku-profile-name": "Camille"
    },
    "preferences": {
      "ginku-theme": "dark",
      "ginku-favorites": "[]"
    }
  }
}
```

| Champ | Contrat |
| --- | --- |
| `app` | Identifiant `Ginku` |
| `version` | Version du format de sauvegarde, actuellement `1`, indépendante de la version de l’application |
| `exportedAt` | Date ISO 8601 en UTC |
| `platform` | Plateforme retournée par Capacitor ; parcours validés : `web` et `android` |
| `storage.localStorage` | Objet associant chaque clé Web à sa valeur brute, chaîne ou `null` |
| `storage.preferences` | Objet associant chaque clé Preferences à sa valeur brute, chaîne ou `null` |

Ces sections restent séparées pour distinguer les stockages d’origine.
L’import normalise les préférences entre Web et Android ; sa priorité entre copies,
ses validations et l’exclusion des identifiants Web Push sont décrites dans
[le contrat d’import](import-donnees.md).

## Implémentation et accessibilité

| Responsabilité | Fichier |
| --- | --- |
| Carte, état occupé et messages | `front/src/components/DataExport.vue` |
| Intégration au profil | `front/src/views/profil.vue` |
| Lecture des stockages, format et téléchargement Web | `front/src/services/dataExport.js` |
| Sélecteur de destination et écriture Android | `front/android/app/src/main/java/org/diogoandrade/ginku/GinkuDataExportPlugin.java` |
| Enregistrement du plugin local | `front/android/app/src/main/java/org/diogoandrade/ginku/MainActivity.java` |
| Tests automatisés | `front/tests/dev.spec.js` |

`createDataBackup()` retourne l’objet de sauvegarde et propage les erreurs de lecture.
`exportUserData()` le sérialise et retourne `downloaded`, `saved` ou `cancelled` ;
les erreurs sont présentées par le composant avec un message permettant de réessayer.

Sur Android, `GinkuDataExport.save({ filename, data })` utilise
`Intent.ACTION_CREATE_DOCUMENT` avec le type `application/json`. Il retourne
`{ cancelled: true }` après annulation, ou `{ cancelled: false }` une fois le flux
écrit et fermé. L’écriture est exécutée hors du thread d’interface.
Ce parcours ne demande aucune permission de stockage supplémentaire et n’ajoute
aucune dépendance Capacitor. Les erreurs natives portent les codes `INVALID_EXPORT`,
`PICKER_UNAVAILABLE`, `INVALID_DESTINATION` ou `EXPORT_WRITE_FAILED`.

La carte est un bouton HTML utilisable au clavier, avec un focus visible et une
hauteur minimale de 44 px. Son libellé accessible est explicite via `aria-label` :
le test sur WebView Android a montré qu’un `aria-labelledby` pointant vers le texte
interne ne remontait pas correctement son nom. `aria-describedby` fournit la
description et `aria-busy` indique l’opération en cours. La fenêtre de confirmation
est un dialogue HTML natif : le focus arrive sur « Annuler », Tab/Maj+Tab restent
dans la fenêtre et Échap permet d’annuler avant le début de l’export. Pendant
l’export, les boutons sont désactivés et Échap ne ferme pas la fenêtre.
À la fermeture, le focus revient à la carte ; après une erreur, il revient sur
« Exporter » pour réessayer. Les messages sont annoncés
par `role="status"`, les erreurs par `role="alert"`. Aucune animation n’est ajoutée.

## Vérifications réalisées — 22 octobre 2026

Depuis la racine du dépôt :

```sh
pnpm -C front exec eslint src/services/dataExport.js src/components/DataExport.vue src/views/profil.vue tests/dev.spec.js
pnpm -C front run test:dev --grep 'profil : export JSON|profil : erreur de lecture|export Android'
pnpm -C front run build
pnpm -C front exec cap sync android
```

Depuis `front/android`, avec un JDK 21 et un SDK Android configuré :

```sh
./gradlew assembleDebug
```

Résultats : lint ciblé, trois tests automatisés, build Web, synchronisation Capacitor
et build Android réussis. Java 25 seul ne satisfaisait pas la toolchain Java 21 du
projet ; le build a été exécuté avec un JDK 21 temporaire, sans modifier les versions
de Gradle ou d’Android Gradle Plugin.

Les tests automatisés couvrent le téléchargement au clavier, le format JSON, la
conservation des valeurs et des stockages, une erreur de lecture puis une nouvelle
tentative. Le test du pont Android simulé couvre les préférences natives distinctes
du stockage Web, le succès, l’annulation et une erreur d’écriture.

Le parcours réel a aussi été vérifié via ADB sur un HONOR BKQ-N49 :

- Affichage de la carte et libellé du bouton remonté dans l’arbre d’accessibilité Android.
- Ouverture du sélecteur système et enregistrement dans Téléchargements.
- Lecture du fichier produit et comparaison exacte avec les données de test Web et natives,
  comprenant des accents, un emoji et une chaîne vide.
- Annulation, message correspondant, bouton réactivé et stockages inchangés.
- Nouvel export réussi après annulation, sans crash ni erreur native d’export détectés dans les journaux du test.

La signature de l’application déjà installée étant différente, ces essais ont utilisé
une copie séparée sous `org.diogoandrade.ginku.exporttest`, avec des données de test.
La copie et les fichiers d’essai ont été retirés ensuite ; l’application habituelle
et ses données ont été conservées. Les fournisseurs de documents cloud, une erreur
d’écriture réelle et un parcours TalkBack complet n’ont pas été testés sur appareil.

### Ajout de la fenêtre explicative — 22 octobre 2026

Cinq tests ciblés passent : export confirmé au clavier, annulation sans lecture
ni téléchargement, erreur puis nouvelle tentative, maintien de la fenêtre pendant
l’enregistrement Android et pont natif simulé. Le lint ciblé, le build Web, la
synchronisation Capacitor et le build Android passent également.

Sur le même téléphone, la fenêtre et ses boutons ont été vérifiés visuellement
et dans l’arbre d’accessibilité Android. « Annuler » revient au profil ; après une
nouvelle ouverture, « Exporter » ouvre bien le sélecteur système. Son annulation
ferme la fenêtre et affiche le résultat sous la carte. Aucun crash natif n’a été
détecté. La copie de test a été retirée sans modifier l’application habituelle.
