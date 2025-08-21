<script setup>
import Loader from '@/components/loader.vue'
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import Buttonback from '@/components/buttonback.vue'
import api from '@/api'

defineOptions({ name: 'ArretPage' })

const route = useRoute()

const lignes = ref({})
const variantesMap = ref({})

onMounted(async () => {
  try {
    const response = await api.get(`/getTempsLieu/${route.params.nom}`)
    if (response.data) {
      lignes.value = response.data

      // Récupération des variantes desservant l'arrêt
      const idArret = lignes.value.listeTemps?.[0]?.idArret
      if (idArret) {
        try {
          const variantes = await api.get(`/getVariantesDesservantArret/${idArret}`)
          if (variantes.data) {
            const map = {}
            for (const v of variantes.data) {
              if (!map[v.idLigne]) map[v.idLigne] = {}
              if (!map[v.idLigne][v.sensAller]) map[v.idLigne][v.sensAller] = {}
              map[v.idLigne][v.sensAller][v.destination] = v.idVariante
            }
            variantesMap.value = map
          }
        } catch (err) {
          console.error(err)
        }
      }
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
        idLigne: t.idLigne,
        destinations: {},
      }
    }
    // Deuxième niveau : destination
    if (!lignesMap[t.numLignePublic].destinations[t.destination]) {
      lignesMap[t.numLignePublic].destinations[t.destination] = {
        horaires: [],
        sensAller: t.sensAller,
      }
    }
    lignesMap[t.numLignePublic].destinations[t.destination].horaires.push(t)
  }

  // On convertit les destinations en tableaux pour itérer plus facilement
  return Object.values(lignesMap).map((ligne) => ({
    ...ligne,
    destinations: Object.entries(ligne.destinations).map(([destination, data]) => ({
      destination,
      horaires: data.horaires,
      idVariante:
        variantesMap.value?.[ligne.idLigne]?.[data.sensAller]?.[destination],
    })),
  }))
})
</script>

<template>
  <div
    class="min-h-screen bg-light-bg text-light-text dark:bg-dark-bg dark:text-dark-text p-4 sm:p-6 lg:p-8 w-screen relative"
  >
    <Buttonback />

    <div class="max-w-2xl mx-auto">
      <h1
        class="pt-20 text-2xl sm:text-3xl font-bold text-light-primary dark:text-dark-primary mb-6 text-center sm:pt-0"
      >
        Horaires - {{ route.params.nom }}
      </h1>

      <!-- Affichage des horaires -->
      <div v-if="lignes && lignes.listeTemps && lignes.listeTemps.length" class="space-y-6">
<<<<<<< HEAD
        <div
          v-for="ligne in lignesRegroupees"
          :key="ligne.numLignePublic"
          class="bg-white dark:bg-dark-secondary p-4 rounded-lg shadow-md"
        >
          <h2 class="font-bold text-lg mb-3 flex items-center gap-3">
            <span
              class="inline-block px-3 py-1 rounded-full font-bold text-sm"
              :style="{ backgroundColor: '#' + ligne.couleurFond, color: '#' + ligne.couleurTexte }"
            >
              {{ ligne.numLignePublic }}
            </span>
          </h2>
=======
        <div v-for="ligne in lignesRegroupees" :key="ligne.numLignePublic"
          class="bg-white dark:bg-dark-secondary p-4 rounded-lg shadow-md">
>>>>>>> bcbffdfda9eedb3983fc086fcda5ab8298faa1fe
          <div v-for="dest in ligne.destinations" :key="dest.destination" class="mb-3">
            <h2 class="font-bold text-lg mb-3 flex items-center gap-3">
              <router-link :to="{
                name: 'ArretFromLigneView',
                params: {
                  idLigne: ligne.idLigne,
                  idVariante: dest.idVariante,
                  numLigne: ligne.numLignePublic,
                },
              }">
                <span class="inline-block px-3 py-1 rounded-full font-bold text-sm"
                  :style="{ backgroundColor: '#' + ligne.couleurFond, color: '#' + ligne.couleurTexte }">
                  {{ ligne.numLignePublic }}
                </span>
              </router-link>
              <span class="font-bold text-base text-light-text dark:text-dark-text">
                {{ dest.destination }}
              </span>
            </h2>
            <ul class="flex justify-between px-10">
              <li v-for="(horaire, index) in dest.horaires" :key="index">
                <router-link
                  v-if="horaire.numVehicule"
                  :to="{
                    name: 'InfosTransportPage',
                    params: { id: horaire.numVehicule },
                  }"
                >
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
      <div
        v-else-if="lignes && lignes.listeTemps && lignes.listeTemps.length === 0"
        class="text-center py-8"
      >
        <p class="text-light-text dark:text-dark-text text-lg">
          Aucun horaire disponible pour cet arrêt
        </p>
      </div>

      <!-- Loader -->
      <Loader v-else />
    </div>
  </div>
</template>
