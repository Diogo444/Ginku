# Import des données locales

La carte « Importer mes données » se trouve dans « Mon profil » → « Vos données »,
sous l’export. Elle accepte les [sauvegardes JSON Ginku de version 1](export-donnees.md),
jusqu’à **5 Mio**, et permet leur transfert entre Web et Android.

## Utilisation

1. Choisir « Importer mes données » et sélectionner le fichier JSON.
2. Vérifier la date de sauvegarde dans la fenêtre de confirmation. Le texte explique
   que les favoris, le nom et les réglages sauvegardés remplacent ceux déjà présents.
3. Choisir « Importer », ou « Annuler » pour conserver l’état actuel.
4. Après le succès, choisir « Continuer » : l’application se recharge pour appliquer les données
   dans le profil, les favoris, le thème et le contraste élevé.

Le fichier est lu localement, sans envoi à une route backend. Sur Android, le
sélecteur système utilise `ACTION_OPEN_DOCUMENT` et peut proposer des fournisseurs
locaux ou distants. Aucune permission de stockage supplémentaire n’est nécessaire.
Le contenu est validé avant l’ouverture de la confirmation et avant toute écriture.
La sélection d’un fichier ne modifie donc aucune donnée.

## Règles de restauration

- Les clés présentes remplacent les valeurs correspondantes. Les clés absentes
  sont conservées ; aucun stockage n’est vidé.
- Les favoris sont restaurés comme une liste complète, sans fusion avec la liste
  actuelle lorsque `ginku-favorites` figure dans le fichier.
- Les valeurs restent des chaînes brutes. Une valeur `null` supprime la clé correspondante.
- Les préférences de `storage.preferences` ont priorité sur leurs copies Web
  `CapacitorStorage.*`, puis sur les anciennes clés locales `ginku-theme`,
  `ginku-favorites` et `ginku-high-contrast`.
- Les copies Web préfixées sont converties en appels à Capacitor Preferences.
  Les anciennes clés locales des préférences restaurées sont retirées pour éviter
  qu’elles soient remigrées au rechargement, notamment après l’import d’un `null`.
- Les clés particulières comme `__proto__` sont traitées comme des données,
  sans fusion dans le prototype d’un objet.
- `ginku-web-push` n’est pas importé depuis le stockage Web. L’identifiant et le jeton
  d’abonnement appartiennent au navigateur courant : sa valeur actuelle est conservée.
  Les permissions système et l’abonnement Push du navigateur ne sont pas transférés.

Au rechargement, les services habituels relisent les préférences et synchronisent
les arrêts surveillés. Les notifications restent soumises aux permissions et aux
capacités de l’appareil ; l’import ne demande pas automatiquement de permission.

## Validation et erreurs

Le fichier doit contenir `app: "Ginku"`, `version: 1`, une date `exportedAt`
interprétable et une plateforme `web`, `android` ou `ios`. Les deux sections de
stockage doivent être des objets dont les valeurs sont des chaînes ou `null`.
Les parcours pris en charge et testés sont Web et Android.

Les préférences connues sont vérifiées : thème `light`/`dark`, contraste
`true`/`false`, favoris sous forme de tableau JSON avec les identifiants et textes
requis. Les champs de notification, lorsqu’ils existent, doivent avoir les types
attendus et des délais entiers entre 1 et 60 minutes. Les anciens favoris sans
ces champs restent acceptés ; le store applique ses valeurs par défaut au démarrage.
Les clés inconnues restent acceptées pour conserver les autres données exportées.

Un fichier invalide ou trop volumineux est refusé. En cas d’erreur de lecture,
aucune écriture n’est effectuée. Avant l’import, le service attend les écritures
en cours du thème et des favoris et lit les anciennes valeurs des clés à modifier.
L’ouverture de l’import est désactivée pendant un enregistrement du contraste.

Chaque écriture tentée est journalisée. Si elle échoue, les anciennes valeurs sont
restaurées dans l’ordre inverse, y compris pour une écriture qui aurait rejeté après
avoir modifié son stockage. Si cette restauration échoue elle aussi, un message
précise que certaines données ont pu changer et demande de conserver la sauvegarde.
Le stockage Web et Preferences ne forment pas une transaction atomique : une
interruption du processus ou de l’appareil pendant les écritures reste une limite.

## Interface et accessibilité

La carte est un bouton nommé explicitement, utilisable au clavier, avec focus visible
et hauteur minimale de 44 px. Le dialogue HTML natif rend le reste de la page inerte.
Le focus arrive sur « Annuler » ; Tab/Maj+Tab restent dans le dialogue. Échap annule
avant la restauration et le focus revient à la carte.

Pendant les écritures, les boutons sont désactivés et Échap ne ferme pas le dialogue.
Après le succès, seul le rechargement est proposé pour éviter de continuer à modifier
des stores Vue qui contiennent encore l’ancien état. Les états importants utilisent
`role="status"`, les erreurs `role="alert"`. Aucune animation n’est ajoutée.

## Fichiers et vérification

| Responsabilité | Fichier |
| --- | --- |
| Carte, sélection Web et confirmation | `front/src/components/DataImport.vue` |
| Validation, normalisation, écritures et restauration après erreur | `front/src/services/dataImport.js` |
| Sélection et lecture Android, limite de taille pendant la lecture | `front/android/app/src/main/java/org/diogoandrade/ginku/GinkuDataImportPlugin.java` |
| Enregistrement du plugin | `front/android/app/src/main/java/org/diogoandrade/ginku/MainActivity.java` |
| Tests navigateur et pont Android simulé | `front/tests/data-import.spec.js` |

Depuis la racine :

```sh
pnpm -C front exec eslint src/services/dataImport.js src/components/DataImport.vue src/views/profil.vue src/stores/theme.js src/stores/favorites.js tests/data-import.spec.js playwright.dev.config.js
pnpm -C front run test:dev
pnpm -C front run build
pnpm -C front exec cap sync android
```

Depuis `front/android`, avec un JDK 21 et un SDK Android configuré :

```sh
./gradlew assembleDebug
```

Les tests ciblés couvrent la confirmation, l’annulation au clavier, le refus des
fichiers invalides, l’import Android vers Web et l’application des valeurs après
rechargement. Ils vérifient aussi une erreur d’écriture après effet de bord, le
retour aux anciennes valeurs, une nouvelle tentative et la taille maximale.
Le pont Android simulé couvre le sélecteur, Web vers Android, la priorité des
préférences natives, l’annulation et l’erreur de lecture.

### Résultats du 22 octobre 2026

Lint ciblé, suite de développement (23 tests au premier passage), puis six tests
d’import après les derniers ajustements : réussis. Build Web, synchronisation
Capacitor et build Android avec JDK 21 : réussis.

Sur un HONOR BKQ-N49 connecté via ADB, une copie séparée de l’application
(`org.diogoandrade.ginku.exporttest`) a permis de vérifier le sélecteur natif,
le refus d’un fichier invalide sans changement du profil et l’annulation.
Une sauvegarde Web valide a ensuite été importée après confirmation : les valeurs
Preferences ont été comparées au fichier, la copie Web préfixée a été normalisée
et une donnée existante absente du fichier a été conservée. Après rechargement,
le pseudo avec emoji, les favoris, le thème sombre et le contraste élevé ont été
vérifiés. Aucun crash natif n’a été détecté dans les journaux du processus de test.

La copie et les fichiers d’essai ont été retirés ; l’application habituelle et ses
données ont été conservées. Les fournisseurs cloud, une erreur d’écriture native
réelle, un parcours TalkBack complet et iOS n’ont pas été testés sur appareil.
