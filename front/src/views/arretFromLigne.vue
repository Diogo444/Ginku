<script setup>
import { ref, onBeforeUnmount, watch, computed } from 'vue'
import { getLignes, getArretsFromLigne } from '@/services/api'
import ThemeToggle from '@/components/ThemeToggle.vue'
import BackButton from '@/components/BackButton.vue'
import LineBadge from '@/components/LineBadge.vue'
import Loader from '@/components/loader.vue'
import ErrorState from '@/components/ErrorState.vue'

defineOptions({ name: 'ArretFromLigneView' })

const props = defineProps({
  idLigne: { type: [String, Number], required: true },
  idVariante: { type: [String, Number], required: true },
  numLigne: { type: [String, Number], required: true },
})

const arrets = ref([])
const variantes = ref([])
const ligneInfo = ref(null)
const currentVarianteId = ref(props.idVariante)
const loading = ref(true)
const error = ref(null)
const abortController = ref(null)

// Charger les variantes de la ligne
async function loadVariantes() {
  try {
    const lignes = await getLignes()
    const ligne = Array.isArray(lignes)
      ? lignes.find((l) => String(l.id) === String(props.idLigne))
      : null
    
    if (ligne) {
      ligneInfo.value = ligne
      variantes.value = Array.isArray(ligne?.variantes) ? ligne.variantes : []
      
      // Si l'idVariante courant n'est pas dans la liste, prendre la première disponible
      if (!variantes.value.some((v) => String(v.id) === String(currentVarianteId.value))) {
        currentVarianteId.value = variantes.value[0]?.id ?? props.idVariante
      }
    }
  } catch (e) {
    console.error('Erreur lors du chargement des variantes:', e)
  }
}

// Charger les arrêts de la variante
async function loadArrets() {
  loading.value = true
  error.value = null
  
  if (!props.idLigne || !currentVarianteId.value) {
    arrets.value = []
    loading.value = false
    return
  }
  
  abortController.value?.abort()
  abortController.value = new AbortController()
  
  try {
    arrets.value = await getArretsFromLigne(props.idLigne, currentVarianteId.value, abortController.value.signal)
  } catch (e) {
    if (e?.code !== 'ERR_CANCELED') {
      console.error('Erreur lors de la requête API:', e)
      error.value = 'Impossible de charger les arrêts'
    }
  } finally {
    loading.value = false
  }
}

// Inverser le sens de la ligne
async function toggleDirection() {
  if (!variantes.value.length) return

  const current = variantes.value.find((v) => String(v.id) === String(currentVarianteId.value))
  let targetVariante = null

  if (current && typeof current.sensAller === 'boolean') {
    targetVariante = variantes.value.find((v) => v && typeof v.sensAller === 'boolean' && v.sensAller !== current.sensAller)
  }

  if (!targetVariante) {
    const idx = variantes.value.findIndex((v) => String(v.id) === String(currentVarianteId.value))
    const nextIdx = idx >= 0 ? (idx + 1) % variantes.value.length : 0
    targetVariante = variantes.value[nextIdx]
  }

  if (targetVariante) {
    currentVarianteId.value = targetVariante.id
    await loadArrets()
  }
}

// Destination actuelle
const currentDestination = computed(() => {
  const v = variantes.value.find((vv) => String(vv.id) === String(currentVarianteId.value))
  return v?.destination || ''
})

// Origine (premier arrêt)
const origin = computed(() => arrets.value[0]?.nom || '')

// Initialisation
const refreshData = async () => {
  await loadVariantes()
  await loadArrets()
}

watch(
  () => [props.idLigne, props.idVariante],
  async ([, newVariante]) => {
    currentVarianteId.value = newVariante
    await refreshData()
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  abortController.value?.abort()
})
</script>

<template>
  <div class="flex flex-col min-h-full w-full pb-safe">
    <!-- Header sticky -->
    <header class="sticky top-0 z-50 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 border-b border-gray-200 dark:border-gray-800 transition-colors duration-300">
      <!-- Navigation -->
      <div class="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-4">
        <BackButton />
        <div class="flex-1 text-center pr-8">
          <span class="text-[10px] sm:text-xs uppercase tracking-wider font-medium text-gray-500 dark:text-gray-400">Détails de la ligne</span>
        </div>
      </div>
      
      <!-- Badge ligne + destination -->
      <div class="flex flex-col items-center justify-center space-y-1.5 sm:space-y-2 pb-1 sm:pb-2">
        <LineBadge 
          v-if="ligneInfo"
          :num="numLigne" 
          :couleur-fond="ligneInfo.couleurFond" 
          :couleur-texte="ligneInfo.couleurTexte"
          size="lg"
          class="shadow-glow mb-0.5 sm:mb-1"
        />
        <div v-else class="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gray-300 dark:bg-gray-700 mb-0.5 sm:mb-1"></div>
        
        <div v-if="currentDestination" class="text-center min-w-0 max-w-full px-2">
          <h1 class="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white leading-tight truncate">{{ origin }}</h1>
          <div v-if="currentDestination" class="flex items-center justify-center gap-1.5 sm:gap-2 mt-0.5 sm:mt-1 text-gray-500 dark:text-gray-400">
            <span class="material-icons-round text-xs sm:text-sm" aria-hidden="true">arrow_forward</span>
            <span class="text-xs sm:text-sm truncate max-w-[200px]">{{ currentDestination }}</span>
          </div>
        </div>
      </div>
      
      <!-- Toggle thème en haut à droite -->
      <div class="absolute right-4 sm:right-6 top-4 sm:top-6">
        <ThemeToggle />
      </div>
    </header>
    
    <!-- Contenu -->
    <main class="flex-grow px-4 sm:px-6 pb-8 pt-4 sm:pt-6">
      <!-- Header avec compteur et bouton inverser -->
      <div class="flex justify-between items-center mb-4 sm:mb-6">
        <h2 class="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
          Arrêts <span v-if="arrets.length > 0">({{ arrets.length }})</span>
        </h2>
        <button 
          @click="toggleDirection"
          :disabled="!variantes.length || loading"
          class="text-primary text-xs sm:text-sm font-medium flex items-center gap-1 hover:text-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Inverser le sens de la ligne"
        >
          <span class="material-icons-round text-base sm:text-lg" aria-hidden="true">swap_vert</span>
          Inverser
        </button>
      </div>
      
      <!-- Loading -->
      <Loader v-if="loading" />
      
      <!-- Erreur -->
      <ErrorState v-else-if="error" :message="error" @retry="loadArrets" />
      
      <!-- Timeline des arrêts -->
      <div v-else-if="arrets.length > 0" class="relative space-y-0">
        <router-link
          v-for="(arret, index) in arrets"
          :key="arret.id"
          :to="{ name: 'ArretNomView', params: { nom: arret.nom } }"
          class="timeline-item relative flex items-start gap-3 sm:gap-4 pb-4 sm:pb-6 group cursor-pointer"
        >
          <!-- Connector -->
          <div v-if="index < arrets.length - 1" class="timeline-connector"></div>
          
          <!-- Point de la timeline -->
          <div class="relative z-10 flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center">
            <!-- Premier / dernier arrêt (plus gros) -->
            <div 
              v-if="index === 0 || index === arrets.length - 1"
              class="w-3.5 h-3.5 sm:w-4 sm:h-4 bg-white dark:bg-surface-dark border-[2.5px] sm:border-[3px] rounded-full shadow-sm group-hover:scale-125 transition-transform duration-200"
              :style="{ borderColor: '#' + (ligneInfo?.couleurFond || '888888') }"
            ></div>
            <!-- Arrêts intermédiaires -->
            <div 
              v-else
              class="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-gray-300 dark:bg-gray-600 rounded-full group-hover:scale-125 transition-colors duration-200"
              :class="{ 'group-hover:bg-primary': true }"
            ></div>
          </div>
          
          <!-- Nom de l'arrêt -->
          <div :class="['flex-grow pb-1.5 sm:pb-2 border-b border-gray-100 dark:border-gray-800 min-w-0', index === 0 || index === arrets.length - 1 ? 'pt-2 sm:pt-2.5' : 'pt-2.5 sm:pt-3']">
            <div class="flex justify-between items-center gap-2">
              <span 
                :class="[
                  'text-sm sm:text-base transition-colors truncate',
                  index === 0 || index === arrets.length - 1
                    ? 'font-semibold text-gray-900 dark:text-gray-100 group-hover:text-primary'
                    : 'font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white'
                ]"
              >
                {{ arret.nom }}
              </span>
              <span class="material-icons-round text-gray-300 dark:text-gray-600 text-base sm:text-lg group-hover:text-primary transition-colors flex-shrink-0" aria-hidden="true">chevron_right</span>
            </div>
          </div>
        </router-link>
      </div>
      
      <!-- Aucun résultat -->
      <div v-else class="text-center text-gray-500 dark:text-gray-400 mt-10">
        Aucun arrêt trouvé pour {{ numLigne }}.
      </div>
    </main>
  </div>
</template>
