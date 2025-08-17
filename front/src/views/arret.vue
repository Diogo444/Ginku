<script setup>
import Loader from '@/components/loader.vue'
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import Buttonback from '@/components/buttonback.vue'
import api from '@/api'

defineOptions({ name: 'ArretPage' })

const route = useRoute()

const lignes = ref({})

onMounted(async () => {
  try {
    const response = await api.get(`/getTempsLieu/${route.params.nom}`)
    if (response.data) {
      lignes.value = response.data
    }
  } catch (error) {
    console.error(error)
  }
})

// Regroupement par numéro de ligne, puis par destination
const lignesRegroupees = computed(() => {
  if (!lignes.value || !lignes.value.listeTemps) return []

  const lignesMap = {}

  for (const t of lignes.value.listeTemps) {
    // Premier niveau : numLignePublic
    if (!lignesMap[t.numLignePublic]) {
      lignesMap[t.numLignePublic] = {
        numLignePublic: t.numLignePublic,
        couleurFond: t.couleurFond,
        couleurTexte: t.couleurTexte,
        destinations: {},
      }
    }
    // Deuxième niveau : destination
    if (!lignesMap[t.numLignePublic].destinations[t.destination]) {
      lignesMap[t.numLignePublic].destinations[t.destination] = []
    }
    lignesMap[t.numLignePublic].destinations[t.destination].push(t)
  }

  // On convertit les destinations en tableaux pour itérer plus facilement
  return Object.values(lignesMap).map((ligne) => ({
    ...ligne,
    destinations: Object.entries(ligne.destinations).map(([destination, horaires]) => ({
      destination,
      horaires,
    })),
  }))
})
</script>

<template>
  <div
    class="min-h-screen bg-light-bg text-light-text dark:bg-dark-bg dark:text-dark-text p-4 sm:p-6 lg:p-8 w-screen relative">
    <Buttonback />

    <div class="max-w-2xl mx-auto">
      <h1
        class="pt-20 text-2xl sm:text-3xl font-bold text-light-primary dark:text-dark-primary mb-6 text-center sm:pt-0">
        Horaires - {{ route.params.nom }}
      </h1>

      <!-- Affichage des horaires -->
      <div v-if="lignes && lignes.listeTemps && lignes.listeTemps.length" class="space-y-6">
        <div v-for="ligne in lignesRegroupees" :key="ligne.numLignePublic"
          class="bg-white dark:bg-dark-secondary p-4 rounded-lg shadow-md">
          <h2 class="font-bold text-lg mb-3 flex items-center gap-3">
            <span class="inline-block px-3 py-1 rounded-full font-bold text-sm"
              :style="{ backgroundColor: '#' + ligne.couleurFond, color: '#' + ligne.couleurTexte }">
              {{ ligne.numLignePublic }}
            </span>
          </h2>
          <div v-for="dest in ligne.destinations" :key="dest.destination" class="mb-3">
            <h3 class="font-bold text-base mb-1 text-light-text dark:text-dark-text">
              {{ dest.destination }}
            </h3>
            <ul class="flex justify-between px-10">
              <li v-for="(horaire, index) in dest.horaires" :key="index">
                <router-link v-if="horaire.numVehicule" :to="{
                  name: 'InfosTransportPage',
                  params: { id: horaire.numVehicule },
                }">
                  <span class="font-semibold text-light-primary dark:text-dark-text">
                    {{ horaire.temps }}
                  </span>
                </router-link>
                <span v-else class="font-semibold text-light-primary dark:text-dark-text">
                  {{ horaire.temps }}
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Aucun horaire -->
      <div v-else-if="lignes && lignes.listeTemps && lignes.listeTemps.length === 0" class="text-center py-8">
        <p class="text-light-text dark:text-dark-text text-lg">
          Aucun horaire disponible pour cet arrêt
        </p>
      </div>

      <!-- Loader -->
      <Loader v-else />
    </div>
  </div>
</template>
