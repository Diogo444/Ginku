<script setup>
import { ref, onMounted } from 'vue'
import api from '@/api'
import Loader from '@/components/loader.vue'
import Buttonback from '@/components/buttonback.vue'

defineOptions({
  name: 'LignesView',
})

const lignes = ref([])
const loading = ref(true)

onMounted(async () => {
  try {
    const response = await api.get('/getLingnes')
    if (response.data) {
      lignes.value = response.data
    } else {
      console.error('Erreur: données manquantes ou incorrectes dans la réponse API')
    }
  } catch (error) {
    console.error('Erreur lors de la requête API:', error)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="lignes-view p-4">
    <!-- Bouton de retour -->
    <Buttonback />

    <div class="max-w-2xl mx-auto pt-20 sm:pt-24">
      <h1
        class="text-2xl sm:text-3xl font-bold text-light-primary dark:text-dark-primary mb-6 text-center"
      >
        Lignes
      </h1>

      <!-- Loader -->
      <Loader v-if="loading" />

      <!-- Liste des lignes -->
      <div v-else-if="lignes.length" class="space-y-6">
        <div
          v-for="ligne in lignes"
          :key="ligne.id"
          class="bg-white dark:bg-dark-secondary p-4 rounded-lg shadow-md"
        >
          <router-link
            :to="{
              name: 'ArretFromLigneView',
              params: {
                idLigne: ligne.id,
                idVariante: ligne.variantes?.[0]?.id,
                numLigne: ligne.numLignePublic,
              },
            }"
            class="block"
          >
            <h2
              class="font-bold text-lg mb-3 flex flex-wrap items-start gap-3"
            >
              <span
                class="flex-shrink-0 inline-block px-3 py-1 rounded-full font-bold text-sm whitespace-nowrap"
                :style="{
                  backgroundColor: '#' + ligne.couleurFond,
                  color: '#' + ligne.couleurTexte,
                }"
              >
                {{ ligne.numLignePublic }}
              </span>
              <span class="flex-1 min-w-0 break-words"
                >{{ ligne.libellePublic }}</span
              >
            </h2>
          </router-link>
        </div>
      </div>

      <!-- Aucun résultat -->
      <div v-else class="text-center text-gray-500 dark:text-gray-400 mt-10">
        Aucune ligne trouvée.
      </div>
    </div>
  </div>
</template>
