<script setup>
import BackButton from '@/components/BackButton.vue'

defineOptions({ name: 'ConditionsUtilisationView' })
</script>

<template>
  <div class="w-full max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
    <header class="mb-8">
      <BackButton />
      <p class="mt-8 text-sm font-semibold text-primary">Informations légales</p>
      <h1 class="mt-2 text-3xl sm:text-4xl font-bold tracking-tight">
        Conditions d’utilisation
      </h1>
      <p class="mt-3 text-sm text-gray-500 dark:text-gray-400">
        Dernière mise à jour : 5 juillet 2026
      </p>
    </header>

    <article class="space-y-8 text-[15px] sm:text-base leading-7 text-gray-700 dark:text-gray-300">
      <section>
        <h2 class="text-xl font-bold text-gray-900 dark:text-white">1. À propos de Ginku</h2>
        <p class="mt-3">
          Ginku est un service indépendant qui facilite la consultation des horaires, des
          lignes, des arrêts et des informations trafic du réseau Ginko à Besançon.
          Il est proposé gratuitement par Diogo Andrade.
        </p>
        <p class="mt-3">
          Ginku n’est ni affilié, ni édité, ni géré par Ginko ou Grand Besançon Métropole.
        </p>
      </section>

      <section>
        <h2 class="text-xl font-bold text-gray-900 dark:text-white">2. Acceptation</h2>
        <p class="mt-3">
          En utilisant Ginku, vous acceptez les présentes conditions. Si vous ne les
          acceptez pas, vous pouvez simplement cesser d’utiliser le service.
        </p>
      </section>

      <section>
        <h2 class="text-xl font-bold text-gray-900 dark:text-white">3. Informations affichées</h2>
        <p class="mt-3">
          Les données de transport proviennent de l’API publique Ginko. Malgré le soin
          apporté au service, leur exactitude, leur disponibilité et leur mise à jour ne
          peuvent pas être garanties.
        </p>
        <p class="mt-3">
          Avant un déplacement important, vérifiez les informations sur les canaux
          officiels du réseau Ginko. Ginku ne doit pas être utilisé comme unique source
          d’information en cas d’urgence ou de perturbation majeure.
        </p>
      </section>

      <section>
        <h2 class="text-xl font-bold text-gray-900 dark:text-white">4. Utilisation du service</h2>
        <p class="mt-3">
          Vous vous engagez à utiliser Ginku de manière normale et licite. Toute tentative
          visant à perturber, surcharger, contourner la sécurité ou exploiter abusivement
          le service est interdite.
        </p>
      </section>

      <section>
        <h2 class="text-xl font-bold text-gray-900 dark:text-white">5. Disponibilité</h2>
        <p class="mt-3">
          Le service peut être modifié, suspendu ou interrompu, notamment pour maintenance,
          évolution technique ou indisponibilité d’un service tiers. Aucune disponibilité
          permanente n’est garantie.
        </p>
      </section>

      <section>
        <h2 class="text-xl font-bold text-gray-900 dark:text-white">6. Responsabilité</h2>
        <p class="mt-3">
          Ginku est un outil d’information. Son éditeur ne pourra pas être tenu responsable
          d’un retard, d’un trajet manqué, d’une information inexacte ou d’un dommage lié à
          l’utilisation du service, dans les limites prévues par la loi.
        </p>
      </section>

      <section>
        <h2 class="text-xl font-bold text-gray-900 dark:text-white">7. Liens et services tiers</h2>
        <p class="mt-3">
          Ginku peut contenir des liens vers des services externes, notamment Ginko,
          Grand Besançon Métropole ou Google Maps. Ces services appliquent leurs propres
          conditions et politiques de confidentialité.
        </p>
      </section>

      <section>
        <h2 class="text-xl font-bold text-gray-900 dark:text-white">8. Évolution des conditions</h2>
        <p class="mt-3">
          Ces conditions peuvent être mises à jour pour suivre l’évolution du service.
          La date affichée en haut de cette page indique la dernière version.
        </p>
      </section>

      <section>
        <h2 class="text-xl font-bold text-gray-900 dark:text-white">9. Contact</h2>
        <p class="mt-3">
          Pour toute question, vous pouvez contacter l’éditeur depuis
          <a
            href="https://diogo-andrade.org"
            target="_blank"
            rel="noopener"
            class="font-semibold text-primary underline underline-offset-4"
          >diogo-andrade.org</a>.
        </p>
      </section>
    </article>
  </div>
</template>
