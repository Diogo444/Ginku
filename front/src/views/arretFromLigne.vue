<script setup>
const { idLigne, idVariante, numLigne } = defineProps([
  'idLigne',
  'idVariante',
  'numLigne',
])

import { ref, onMounted, computed } from 'vue'
import Loader from '@/components/loader.vue'
import Buttonback from '@/components/buttonback.vue'
import api from '@/api'

const arret = ref([])
const variantes = ref([])
const currentVarianteId = ref(idVariante)
const loading = ref(true)

async function loadVariantes() {
  try {
    const { data: lignes } = await api.get('/getLingnes')
    const ligne = Array.isArray(lignes)
      ? lignes.find((l) => String(l.id) === String(idLigne))
      : null
    variantes.value = Array.isArray(ligne?.variantes) ? ligne.variantes : []

    // Si l'idVariante courant n'est pas dans la liste, prendre la première disponible
    if (!variantes.value.some((v) => String(v.id) === String(currentVarianteId.value))) {
      currentVarianteId.value = variantes.value[0]?.id ?? idVariante
    }
  } catch (error) {
    console.error('Erreur lors du chargement des variantes:', error)
  }
}

async function loadArrets() {
  try {
    loading.value = true
    const response = await api.get(
      `/getArretFromLigne/${idLigne}/${currentVarianteId.value}`,
    )
    if (response.data) {
      arret.value = response.data
    } else {
      console.error(
        'Erreur: données manquantes ou incorrectes dans la réponse API',
      )
    }
  } catch (error) {
    console.error('Erreur lors de la requête API:', error)
  } finally {
    loading.value = false
  }
}

async function toggleDirection() {
  if (!variantes.value.length) return

  // Variante courante
  const current = variantes.value.find(
    (v) => String(v.id) === String(currentVarianteId.value),
  )

  let targetVariante = null

  if (current && typeof current.sensAller === 'boolean') {
    // Cherche une variante avec le sens opposé
    targetVariante = variantes.value.find(
      (v) => v && typeof v.sensAller === 'boolean' && v.sensAller !== current.sensAller,
    )
  }

  // Fallback: si pas trouvé, alterner simplement avec la suivante
  if (!targetVariante) {
    const idx = variantes.value.findIndex(
      (v) => String(v.id) === String(currentVarianteId.value),
    )
    const nextIdx = idx >= 0 ? (idx + 1) % variantes.value.length : 0
    targetVariante = variantes.value[nextIdx]
  }

  if (targetVariante) {
    currentVarianteId.value = targetVariante.id
    await loadArrets()
  }
}

const currentDirectionLabel = computed(() => {
  const v = variantes.value.find(
    (vv) => String(vv.id) === String(currentVarianteId.value),
  )
  if (!v) return ''
  const sens = v.sensAller ? 'Aller' : 'Retour'
  return `${sens} → ${v.destination || ''}`.trim()
})

onMounted(async () => {
  // Charger les variantes de la ligne pour pouvoir basculer de sens
  await loadVariantes()
  // Charger les arrêts pour la variante courante
  await loadArrets()
})
</script>

<template>
  <div class="lignes-view p-4">
    <!-- Bouton de retour -->
    <Buttonback />

    <div class="w-full mx-auto pt-20 sm:pt-24 sm:w-2xl">
      <!-- En-tête avec titre centré et bouton à droite -->
      <div class="relative flex items-center justify-center mb-3">
        <h1 class="text-2xl sm:text-3xl font-bold text-light-primary dark:text-dark-primary text-center">
          Arrêts de la ligne {{ numLigne }}
        </h1>

        <button
          type="button"
          @click="toggleDirection"
          :disabled="!variantes.length || loading"
          :title="`Inverser le sens (${currentDirectionLabel || 'sens inconnu'})`"
          aria-label="Inverser le sens de la ligne"
          class="absolute right-0 bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 p-2 rounded-full transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <img
            src="/svg/swap.svg"
            alt=""
            class="w-6 h-6 transition-transform hover:rotate-180 filter dark:invert"
            aria-hidden="true"
          />
        </button>
      </div>


      <!-- Loader -->
      <Loader v-if="loading" />

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
