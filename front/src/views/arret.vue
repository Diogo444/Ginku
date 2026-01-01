<script setup>
import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { getTempsLieu, getVariantesDesservantArret } from '@/services/api'
import { generateFavoriteId, isFavorite, toggleFavorite } from '@/stores/favorites'
import ThemeToggle from '@/components/ThemeToggle.vue'
import BackButton from '@/components/BackButton.vue'
import LineBadge from '@/components/LineBadge.vue'
import Loader from '@/components/loader.vue'
import ErrorState from '@/components/ErrorState.vue'
import VehicleModal from '@/components/VehicleModal.vue'

defineOptions({ name: 'ArretPage' })

const route = useRoute()

const horaires = ref(null)
const variantesMap = ref({})
const loading = ref(true)
const error = ref(null)
const refreshTimer = ref(null)
const abortController = ref(null)

// Modal véhicule
const showVehicleModal = ref(false)
const selectedVehicle = ref(null)

// Normalisation
const normalize = (s = '') =>
  s.toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

// Charger les horaires
async function fetchHoraires() {
  if (!route.params.nom) return
  
  // Ne pas afficher loading si on a déjà des données (refresh)
  if (!horaires.value) loading.value = true
  error.value = null
  
  abortController.value?.abort()
  abortController.value = new AbortController()
  
  try {
    const data = await getTempsLieu(route.params.nom, abortController.value.signal)
    
    if (!data) {
      error.value = 'Arrêt introuvable'
      return
    }
    
    horaires.value = data
    
    // Charger les variantes pour les liens
    const idArrets = [...new Set((data.listeTemps || []).map((t) => t.idArret).filter(Boolean))]
    if (idArrets.length) {
      await loadVariantes(idArrets)
    }
  } catch (e) {
    if (e?.code !== 'ERR_CANCELED') {
      console.error('Erreur:', e)
      error.value = 'Impossible de charger les horaires'
    }
  } finally {
    loading.value = false
  }
}

// Charger les variantes pour les liens
async function loadVariantes(idArrets) {
  const map = {}
  
  await Promise.all(
    idArrets.map(async (idArret) => {
      try {
        const lignes = await getVariantesDesservantArret(idArret)
        if (!lignes) return

        for (const ligne of lignes) {
          if (!map[ligne.id]) map[ligne.id] = {}
          for (const variante of ligne.variantes || []) {
            const fullDest = variante.precisionDestination
              ? `${variante.destination} ${variante.precisionDestination}`
              : variante.destination
            const destNorm = normalize(fullDest)
            if (!map[ligne.id][variante.sensAller]) map[ligne.id][variante.sensAller] = {}
            map[ligne.id][variante.sensAller][destNorm] = variante.id
          }
        }
      } catch (err) {
        console.error('Erreur variantes:', err)
      }
    })
  )
  
  variantesMap.value = map
}

// Regrouper les horaires par ligne puis destination
const groupedHoraires = computed(() => {
  const src = horaires.value?.listeTemps || []
  const lignesMap = {}

  for (const t of src) {
    const key = t.numLignePublic
    if (!lignesMap[key]) {
      lignesMap[key] = {
        numLignePublic: t.numLignePublic,
        couleurFond: t.couleurFond,
        couleurTexte: t.couleurTexte,
        idLigne: t.idLigne,
        items: []
      }
    }

    lignesMap[key].items.push(t)
  }

  return Object.values(lignesMap)
})

// Formater le temps d'attente
const formatTemps = (tempsRestant) => {
  if (tempsRestant === undefined || tempsRestant === null) return null
  if (tempsRestant <= 0) return { text: 'À l\'approche', isClose: true }
  if (tempsRestant < 60) return { text: `${tempsRestant} min`, isClose: tempsRestant <= 2 }
  return { text: `${Math.floor(tempsRestant / 60)}h${tempsRestant % 60}`, isClose: false }
}

// Ouvrir la modale véhicule
const openVehicleModal = (numVehicule) => {
  if (!numVehicule) return
  selectedVehicle.value = numVehicule
  showVehicleModal.value = true
}

// Toggle favori
const handleToggleFavorite = (horaire) => {
  const favId = generateFavoriteId(route.params.nom, horaire.idLigne, horaire.destination)
  toggleFavorite({
    id: favId,
    type: 'arret',
    nomArret: route.params.nom,
    idLigne: horaire.idLigne,
    numLigne: horaire.numLignePublic,
    destination: horaire.destination,
    couleurFond: horaire.couleurFond,
    couleurTexte: horaire.couleurTexte
  })
}

// Vérifier si favori
const checkIsFavorite = (horaire) => {
  const favId = generateFavoriteId(route.params.nom, horaire.idLigne, horaire.destination)
  return isFavorite(favId)
}

// Lifecycle
onMounted(async () => {
  await fetchHoraires()
  refreshTimer.value = setInterval(fetchHoraires, 30000) // Refresh toutes les 30s
})

watch(() => route.params.nom, fetchHoraires)

onBeforeUnmount(() => {
  refreshTimer.value && clearInterval(refreshTimer.value)
  abortController.value?.abort()
})
</script>

<template>
  <div class="flex flex-col min-h-full w-full pb-safe">
    <!-- Header sticky -->
    <header class="sticky top-0 z-50 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 border-b border-gray-200 dark:border-gray-800 transition-colors duration-300">
      <!-- Navigation -->
      <div class="flex items-center gap-3 sm:gap-4 mb-2">
        <BackButton />
        <div class="flex-1 text-center pr-8">
          <span class="text-[10px] sm:text-xs uppercase tracking-wider font-medium text-gray-500 dark:text-gray-400">Horaires en temps réel</span>
        </div>
      </div>
      
      <!-- Nom de l'arrêt -->
      <div class="flex flex-col items-center justify-center space-y-1 pb-1 sm:pb-2">
        <h1 class="text-lg sm:text-2xl font-semibold text-gray-900 dark:text-white leading-tight text-center">{{ route.params.nom }}</h1>
        <div v-if="horaires?.nomExact && horaires.nomExact !== route.params.nom" class="flex items-center justify-center gap-1.5 text-gray-500 dark:text-gray-400">
          <span class="material-icons-round text-xs sm:text-sm">place</span>
          <span class="text-xs sm:text-sm">{{ horaires.nomExact }}</span>
        </div>
      </div>
      
      <!-- Toggle thème -->
      <div class="absolute right-4 sm:right-6 top-4 sm:top-6">
        <ThemeToggle />
      </div>
    </header>
    
    <!-- Contenu -->
    <main class="flex-grow px-3 sm:px-4 pb-8 pt-4 sm:pt-6 space-y-4 sm:space-y-6">
      <!-- Loading -->
      <Loader v-if="loading" />
      
      <!-- Erreur -->
      <ErrorState v-else-if="error" :message="error" @retry="fetchHoraires" />
      
      <!-- Liste des horaires -->
      <template v-else-if="groupedHoraires.length > 0">
        <div 
          v-for="groupe in groupedHoraires" 
          :key="groupe.numLignePublic"
          class="bg-surface-light dark:bg-surface-dark rounded-xl sm:rounded-2xl shadow-soft dark:shadow-none border border-gray-100 dark:border-gray-800 overflow-hidden divide-y divide-gray-100 dark:divide-gray-800"
        >
          <div 
            v-for="(horaire, index) in groupe.items" 
            :key="index"
            @click="horaire.numVehicule && openVehicleModal(horaire.numVehicule)"
            :class="[
              'p-3 sm:p-4 flex items-center gap-3 sm:gap-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group',
              horaire.numVehicule ? 'cursor-pointer' : ''
            ]"
          >
            <!-- Badge ligne -->
            <LineBadge 
              :num="horaire.numLignePublic" 
              :couleur-fond="horaire.couleurFond" 
              :couleur-texte="horaire.couleurTexte"
              size="md"
              class="group-hover:scale-105 transition-transform rounded-[1rem] flex-shrink-0"
            />
            
            <!-- Destination -->
            <div class="flex-grow min-w-0 flex flex-col justify-center">
              <span class="text-sm sm:text-base font-semibold text-gray-900 dark:text-white truncate">
                {{ horaire.destination }}
                <span v-if="horaire.precisionDestination" class="font-normal text-gray-500 text-xs sm:text-sm">
                  {{ horaire.precisionDestination }}
                </span>
              </span>
              <span v-if="horaire.modeTransport === 0" class="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">Tramway</span>
              <span v-else class="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">Bus</span>
            </div>
            
            <!-- Temps + Favori -->
            <div class="flex flex-col items-end justify-center min-w-[60px] sm:min-w-[70px]">
              <!-- Bouton favori -->
              <button 
                @click.stop="handleToggleFavorite(horaire)"
                :class="[
                  'mb-0.5 sm:mb-1 transition-colors',
                  checkIsFavorite(horaire) 
                    ? 'text-yellow-500 hover:text-yellow-600' 
                    : 'text-gray-400 dark:text-gray-500 hover:text-yellow-500'
                ]"
                :title="checkIsFavorite(horaire) ? 'Retirer des favoris' : 'Ajouter aux favoris'"
              >
                <span class="material-icons-round text-xl sm:text-2xl">
                  {{ checkIsFavorite(horaire) ? 'star' : 'star_border' }}
                </span>
              </button>
              
              <!-- Temps d'attente -->
              <template v-if="formatTemps(horaire.tempsRestant)?.isClose">
                <div class="flex items-center gap-1 sm:gap-1.5">
                  <span class="live-dot"></span>
                  <span class="text-base sm:text-lg font-semibold text-line-green whitespace-nowrap">
                    {{ formatTemps(horaire.tempsRestant).text }}
                  </span>
                </div>
              </template>
              <template v-else-if="formatTemps(horaire.tempsRestant)">
                <span class="text-base sm:text-lg font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                  {{ formatTemps(horaire.tempsRestant).text }}
                </span>
              </template>
              <template v-else>
                <span class="text-base font-medium text-gray-500">{{ horaire.temps }}</span>
              </template>
            </div>
          </div>
        </div>
      </template>
      
      <!-- Aucun horaire -->
      <div v-else class="text-center py-12">
        <div class="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
          <span class="material-icons-round text-3xl text-gray-400">schedule</span>
        </div>
        <p class="text-lg font-semibold text-gray-700 dark:text-gray-300">Aucun passage prévu</p>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Pas de véhicule prévu prochainement à cet arrêt</p>
      </div>
    </main>
    
    <!-- Modal Véhicule -->
    <VehicleModal 
      :show="showVehicleModal"
      :num-vehicule="selectedVehicle"
      @close="showVehicleModal = false"
    />
  </div>
</template>
