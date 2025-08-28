<script setup>
const { idLigne, idVariante, numLigne } = defineProps(['idLigne', 'idVariante', 'numLigne'])

import { ref, onMounted } from 'vue'
import Loader from '@/components/loader.vue'
import Buttonback from '@/components/buttonback.vue'
import api from '@/api'

const arret = ref([])

onMounted(async () => {
  try {
    const response = await api.get(`/getArretFromLigne/${idLigne}/${idVariante}`)
    if (response.data) {
      arret.value = response.data
    } else {
      console.error('Erreur: données manquantes ou incorrectes dans la réponse API')
    }
  } catch (error) {
    console.error('Erreur lors de la requête API:', error)
  }
})
</script>

<template>
  <div class="lignes-view p-4">
    <!-- Bouton de retour -->
    <Buttonback />

    <div class="w-full mx-auto pt-20 sm:pt-24 sm:w-2xl">
      <h1
        class="text- sm:text-3xl font-bold text-light-primary dark:text-dark-primary mb-6 text-center"
      >
        Arrêts de la ligne {{ numLigne }}
      </h1>

      <!-- Loader -->
      <Loader v-if="!arret.length" />

      <!-- Liste des lignes -->
      <div v-else-if="arret.length" class="space-y-6">
        <div
          v-for="arrets in arret"
          :key="arrets.id"
          class="bg-white dark:bg-dark-secondary p-4 rounded-lg shadow-md"
        >
          <RouterLink :to="`/arret/${arrets.nom}`" class="block">
            <h2 class="font-bold text-lg mb-3 flex items-center gap-3">
              {{ arrets.nom }}
            </h2>
          </RouterLink>
        </div>
      </div>

      <!-- Aucun résultat -->
      <div v-else class="text-center text-gray-500 dark:text-gray-400 mt-10">
        Aucun arrêt trouvé pour {{ numLigne }}.
      </div>
    </div>
  </div>
</template>
