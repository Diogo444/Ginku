<script setup>
import BackButton from '@/components/BackButton.vue'

defineOptions({ name: 'PolitiqueConfidentialiteView' })
</script>

<template>
  <div class="w-full max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
    <header class="mb-8">
      <BackButton />
      <p class="mt-8 text-sm font-semibold text-primary">Vie privée</p>
      <h1 class="mt-2 text-3xl sm:text-4xl font-bold tracking-tight">
        Politique de confidentialité
      </h1>
      <p class="mt-3 text-sm text-gray-500 dark:text-gray-400">
        Dernière mise à jour : 6 octobre 2026
      </p>
    </header>

    <article class="space-y-8 text-[15px] sm:text-base leading-7 text-gray-700 dark:text-gray-300">
      <section class="rounded-2xl border border-primary/20 bg-primary-soft dark:bg-primary/10 p-5">
        <h2 class="text-lg font-bold text-gray-900 dark:text-white">En bref</h2>
        <p class="mt-2">
          Ginku ne demande aucun compte. Vos favoris et votre thème sont conservés sur
          votre appareil. Si vous activez les notifications Web, les favoris surveillés
          et les informations nécessaires à l’envoi des alertes sont aussi enregistrés
          sur le serveur.
        </p>
      </section>

      <section>
        <h2 class="text-xl font-bold text-gray-900 dark:text-white">1. Responsable du service</h2>
        <p class="mt-3">
          Ginku est édité à titre personnel par Diogo Andrade. Une question sur cette
          politique peut être envoyée depuis
          <a
            href="https://diogo-andrade.org"
            target="_blank"
            rel="noopener"
            class="font-semibold text-primary underline underline-offset-4"
          >diogo-andrade.org</a>.
        </p>
      </section>

      <section>
        <h2 class="text-xl font-bold text-gray-900 dark:text-white">2. Données enregistrées sur votre appareil</h2>
        <p class="mt-3">
          Ginku utilise le stockage local de votre navigateur uniquement pour mémoriser :
        </p>
        <ul class="mt-3 list-disc pl-6 space-y-2">
          <li>vos arrêts ou lignes ajoutés aux favoris ;</li>
          <li>votre choix de thème clair ou sombre.</li>
          <li>vos préférences de notification et un jeton permettant de gérer votre abonnement Web.</li>
        </ul>
        <p class="mt-3">
          Les favoris dont les notifications Web sont activées sont transmis au serveur
          pour surveiller les prochains passages. Les autres favoris et votre thème
          restent sur votre appareil. Vous pouvez les supprimer en retirant vos favoris
          ou en effaçant les données du site dans les réglages de votre navigateur.
        </p>
      </section>

      <section>
        <h2 class="text-xl font-bold text-gray-900 dark:text-white">3. Notifications Web</h2>
        <p class="mt-3">
          Après votre autorisation, Ginku enregistre sur son serveur l’abonnement push de
          votre navigateur, ses clés techniques, un jeton de gestion et les arrêts, lignes
          et destinations que vous avez choisi de surveiller. Ces informations servent à
          envoyer les alertes d’arrivée, même lorsque l’application Web est fermée.
          Le fournisseur push de votre navigateur reçoit l’abonnement et transporte les
          notifications chiffrées.
        </p>
        <p class="mt-3">
          Désactiver toutes les cloches supprime cet enregistrement sur le serveur dès que
          la synchronisation réussit. Les abonnements expirés sont supprimés, ainsi que les
          abonnements sans synchronisation depuis 30 jours. Effacer les données du site
          ne supprime pas immédiatement la copie serveur ; désactivez les cloches avant
          de le faire. Les notifications Android utilisent le service natif sur l’appareil.
        </p>
      </section>

      <section>
        <h2 class="text-xl font-bold text-gray-900 dark:text-white">4. Géolocalisation</h2>
        <p class="mt-3">
          La page « Proches » peut demander votre position, uniquement après l’autorisation
          de votre navigateur. Elle sert à rechercher et classer les arrêts situés autour
          de vous.
        </p>
        <p class="mt-3">
          Vos coordonnées sont transmises temporairement au serveur de Ginku puis à l’API
          Ginko pour effectuer cette recherche. Elles ne sont pas associées à une identité
          ni enregistrées dans une base de données. Un cache technique, arrondi et conservé
          en mémoire pendant environ 30 secondes, limite les demandes répétées.
        </p>
        <p class="mt-3">
          Vous pouvez refuser ou retirer cette autorisation à tout moment dans les réglages
          de votre navigateur. Le reste de l’application demeure utilisable.
        </p>
      </section>

      <section>
        <h2 class="text-xl font-bold text-gray-900 dark:text-white">5. Cookies et mesure d’audience</h2>
        <p class="mt-3">
          Ginku ne dépose pas de cookie publicitaire et n’utilise aucun outil de mesure
          d’audience ou de suivi comportemental.
        </p>
      </section>

      <section>
        <h2 class="text-xl font-bold text-gray-900 dark:text-white">6. Données techniques</h2>
        <p class="mt-3">
          Comme pour tout site internet, l’hébergeur peut traiter temporairement des
          informations techniques nécessaires à la sécurité et au fonctionnement du
          service, comme l’adresse IP, la date de connexion ou le navigateur utilisé.
          Ces éventuels journaux techniques dépendent de l’infrastructure d’hébergement
          et ne servent pas à établir un profil utilisateur.
        </p>
      </section>

      <section>
        <h2 class="text-xl font-bold text-gray-900 dark:text-white">7. Services externes</h2>
        <p class="mt-3">
          Les informations de transport sont obtenues auprès de l’API Ginko. Si vous
          choisissez d’ouvrir un itinéraire dans Google Maps ou un autre lien externe,
          la politique de confidentialité du service concerné s’applique.
        </p>
      </section>

      <section>
        <h2 class="text-xl font-bold text-gray-900 dark:text-white">8. Vos droits</h2>
        <p class="mt-3">
          Ginku ne dispose pas de compte utilisateur. Vous pouvez gérer vos favoris et
          désactiver vos notifications dans l’application, ou prendre contact pour toute
          question relative aux données conservées et à votre vie privée.
        </p>
      </section>

      <section>
        <h2 class="text-xl font-bold text-gray-900 dark:text-white">9. Modification de cette politique</h2>
        <p class="mt-3">
          Cette politique pourra évoluer si les fonctions de Ginku changent. La date
          indiquée en haut de la page permettra d’identifier la dernière version.
        </p>
      </section>
    </article>
  </div>
</template>
