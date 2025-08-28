<script setup>
import Loader from '@/components/loader.vue'
defineOptions({ name: 'InfosTransportPage' })
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import Buttonback from '@/components/buttonback.vue'
import api from '@/api'

const details = ref(null)
const route = useRoute()

onMounted(async () => {
  try {
    const response = await api.get(`/detailsVehicule/${route.params.id}`)
    if (response.data) {
      details.value = response.data
    } else {
      console.error(
        'Erreur lors de la récupération des informations de transport:',
        response.data.message,
      )
    }
  } catch (error) {
    console.error('Erreur lors de la requête:', error)
  }
})

const getEnergieText = (code) => {
  switch (code) {
    case 0:
      return 'pas d\'info'
    case 1:
      return 'Véhicule au gazole'
    case 2:
      return 'Véhicule au gaz naturel'
    case 3:
      return 'Véhicule hybride (électrique + gaz)'
    case 4:
      return 'Véhicule électrique'
    case -1:
      return 'Valeur indisponible'
    default:
      return 'Non disponible'
  }
}
const getAccessibiliteText = (code) => {
  switch (code) {
    case 0:
      return "Aucune information"
    case 1:
      return "Accessible fauteuil roulant (rampe + emplacement PMR)"
    case 2:
      return "Non accessible (déploiement impossible)"
    case -1:
      return "Valeur sentinelle indisponible"
    default:
      return "Non disponible"
  }
}

const infos = computed(() => details.value ? [
  {
    label: "Énergie",
    value: getEnergieText(details.value.energie),
  },
  {
    label: "Affichage dynamique",
    value: details.value.affichageDynamique ? "Oui" : "Non",
  },
  {
    label: "Accessibilité",
    value: getAccessibiliteText(details.value.accessiblite),
  },
  {
    label: "Type de véhicule",
    value: details.value.typeVehicule || "Non disponible",
  },
  {
    label: "Annonces sonores",
    value: details.value.annoncesSonores ? "Oui" : "Non",
  },
  {
    label: "Climatisation",
    value: details.value.climatisation ? "Oui" : "Non",
  },
  {
    label: "Numéro du véhicule",
    value: details.value.num || route.params.id,
  },
  {
    label: "Prises USB",
    value: details.value.prisesUSB ? "oui" : "non",
  },
] : [])
</script>

<template>
  <div
    class="min-h-screen p-4 sm:p-6 lg:p-8 relative">
    <!-- Bouton de retour -->
     <Buttonback />

    <div class="flex flex-col items-center">
      <h1 class="pt-20 text-2xl sm:text-3xl font-bold text-light-primary dark:text-dark-primary mb-6 text-center">
        Informations pour les nerds
      </h1>

      <!-- Bloc infos responsive -->
      <div v-if="details"
        class="bg-white dark:bg-dark-secondary p-4 sm:p-6 rounded-xl shadow-lg w-full max-w-md mx-auto">
        <div class="divide-y divide-gray-300 dark:divide-dark-accent">
          <div v-for="(item, i) in infos" :key="i" class="py-3 flex flex-col sm:flex-row sm:items-center gap-1">
            <span class="font-medium text-base sm:w-1/2 text-left">{{ item.label }}</span>
            <span class="mt-1 sm:mt-0 text-sm sm:text-base sm:w-1/2 break-words text-left font-semibold">
              {{ item.value }}
            </span>
          </div>
        </div>
      </div>

      <!-- Loader centré -->
      <Loader v-else />
    </div>
  </div>
</template>
