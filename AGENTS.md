# Consignes de développement pour Ginku

## Portée

Ces règles s’appliquent à toutes les modifications du dépôt. Les règles concernant l’interface s’appliquent en priorité au dossier `front/` et à l’application Android générée avec Capacitor.

## Qualité du frontend

- Pour chaque fonctionnalité ajoutée ou modifiée dans `front/`, préserver l’accessibilité.
- Utiliser du HTML sémantique, des libellés explicites et un ordre de navigation logique.
- Vérifier l’utilisation au clavier, la visibilité du focus, les contrastes, les tailles des zones tactiles et les états de chargement, d’erreur et de succès.
- Utiliser ARIA seulement lorsque le HTML natif ne suffit pas. Les contenus dynamiques importants doivent être annoncés correctement aux technologies d’assistance.
- Ne pas transmettre une information uniquement par la couleur, une icône ou une animation.
- Respecter `prefers-reduced-motion` pour les animations non essentielles.
- Garder les composants Vue, composables et services petits, cohérents et faciles à relire.
- Appliquer systématiquement les bonnes pratiques recommandées par Vue.js pour la Composition API, la réactivité, les propriétés, les événements, les composables et le cycle de vie des composants.
- Avant d’introduire une nouvelle API Vue, un nouveau pattern ou une décision d’architecture, consulter la documentation officielle Vue.js (`https://vuejs.org/guide/`) et vérifier que la solution correspond à la version de Vue déclarée dans `front/package.json`.
- Préférer les approches documentées et actuelles de Vue.js. Éviter les API obsolètes, les contournements non documentés et les implémentations fondées uniquement sur des habitudes ou des souvenirs.
- Choisir des noms explicites, éviter la duplication et extraire la logique réutilisable au bon niveau.
- Ajouter des commentaires utiles pour expliquer les décisions, cas limites, contraintes métier ou différences entre Web et Capacitor. Ne pas ajouter de commentaires qui répètent simplement le code.
- Conserver le style et les conventions déjà présents dans les fichiers touchés. Ne pas reformater inutilement des fichiers entiers.

## Qualité du backend

- Pour chaque nouvelle fonctionnalité dans `backend/`, appliquer systématiquement les bonnes pratiques actuelles de Node.js, Express et des bibliothèques concernées.
- Avant l’implémentation, rechercher sur Internet comment réaliser correctement la fonctionnalité. Privilégier la documentation officielle, les spécifications et les sources primaires, puis vérifier que les recommandations correspondent aux versions déclarées dans `backend/package.json`.
- Ne pas copier aveuglément un exemple trouvé en ligne. Le comprendre, l’adapter à l’architecture de Ginku et vérifier sa sécurité, sa gestion des erreurs et ses limites.
- Séparer les responsabilités : les routes HTTP doivent rester fines, la validation et la transformation des entrées doivent être explicites, la logique métier doit vivre dans des services, les appels aux API externes dans des clients dédiés et les fonctions génériques dans des utilitaires.
- Ne pas continuer à concentrer les nouvelles fonctionnalités dans un unique fichier volumineux. Créer des modules cohérents lorsque cela améliore la lisibilité, la réutilisation et la testabilité, sans lancer une refonte sans rapport avec la tâche.
- Une fonction ou un module doit avoir une responsabilité claire, des noms explicites, des dépendances visibles et un comportement prévisible.
- Documenter les contrats importants : paramètres, valeurs retournées, erreurs possibles, variables d’environnement, formats des données et décisions d’architecture non évidentes. Ajouter des commentaires sur le pourquoi, pas une répétition du code.
- Valider toutes les entrées externes, gérer les délais et erreurs réseau, ne jamais exposer de secret dans le code ou les journaux et retourner des erreurs HTTP cohérentes sans divulguer de détails internes.
- Éviter la duplication, les effets de bord cachés, les fonctions trop longues et les blocs `try/catch` qui masquent silencieusement les erreurs.

## Capacitor et Android

- Avant d’utiliser directement une API réservée au navigateur, vérifier dans la documentation officielle Capacitor s’il existe une API native ou un plugin officiel adapté.
- Préférer le plugin Capacitor officiel lorsqu’il apporte une meilleure intégration native, notamment pour les permissions, le stockage, la géolocalisation, la caméra, le réseau et le cycle de vie de l’application.
- Conserver un comportement Web fonctionnel lorsque le projet doit également rester utilisable dans un navigateur.
- Lors de l’ajout ou de la mise à jour d’un plugin, vérifier les permissions Android, la configuration native, les versions compatibles et exécuter une synchronisation Capacitor.
- Ne pas accepter automatiquement une mise à niveau d’Android Gradle Plugin, de Gradle ou du JDK. Vérifier d’abord sa compatibilité avec la version de Capacitor et les plugins installés.
- Les appels API embarqués dans l’application Android doivent utiliser une URL HTTPS complète, jamais une URL relative dépendant de l’origine de la WebView.

## Vérifications obligatoires

Après toute modification fonctionnelle du frontend :

1. Exécuter le lint sur les fichiers modifiés, sans reformater les fichiers sans rapport avec la tâche.
2. Construire le frontend avec `pnpm -C front run build`.
3. Synchroniser Android avec `pnpm -C front exec cap sync android`.
4. Vérifier que le build Android passe depuis `front/android` avec `./gradlew assembleDebug` sur macOS/Linux ou `.\gradlew.bat assembleDebug` sur Windows.
5. Lorsque cela est pertinent et qu’un appareil est disponible, lancer l’application et vérifier la fonctionnalité sur Android ainsi que l’absence de crash évident dans les journaux.

Après toute modification fonctionnelle du backend :

1. Vérifier la syntaxe de chaque fichier JavaScript modifié avec `node --check` tant qu’aucun véritable lint backend n’est configuré.
2. Exécuter les tests disponibles et ajouter des tests ciblés pour la logique métier nouvelle ou corrigée lorsque l’infrastructure du projet le permet.
3. Démarrer le backend et effectuer un test de fonctionnement des routes concernées, y compris au moins un cas d’erreur pertinent.
4. Vérifier que les réponses, codes HTTP, délais, journaux et appels aux services externes correspondent au comportement attendu.

Ne jamais annoncer qu’une modification est terminée si un contrôle requis échoue. Indiquer clairement la commande en échec, la cause connue et ce qui reste à vérifier.
