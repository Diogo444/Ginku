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
import AdBanner from '@/components/AdBanner.vue'

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

// Regrouper les horaires par ligne + destination
const groupedHoraires = computed(() => {
  const src = horaires.value?.listeTemps || []
  const groupMap = {}

  for (const t of src) {
    // Clé unique: ligne + destination + précision
    const destKey = `${t.numLignePublic}_${t.destination}_${t.precisionDestination || ''}`
    
    if (!groupMap[destKey]) {
      groupMap[destKey] = {
        numLignePublic: t.numLignePublic,
        couleurFond: t.couleurFond,
        couleurTexte: t.couleurTexte,
        idLigne: t.idLigne,
        destination: t.destination,
        precisionDestination: t.precisionDestination,
        modeTransport: t.modeTransport,
        idArret: t.idArret,
        horaires: []
      }
    }

    // Ajouter l'horaire avec ses infos véhicule
    groupMap[destKey].horaires.push({
      tempsRestant: t.tempsRestant,
      temps: t.temps,
      numVehicule: t.numVehicule
    })
  }

  return Object.values(groupMap)
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
const handleToggleFavorite = (groupe) => {
  const favId = generateFavoriteId(route.params.nom, groupe.idLigne, groupe.destination)
  toggleFavorite({
    id: favId,
    type: 'arret',
    nomArret: route.params.nom,
    idLigne: groupe.idLigne,
    numLigne: groupe.numLignePublic,
    destination: groupe.destination,
    couleurFond: groupe.couleurFond,
    couleurTexte: groupe.couleurTexte
  })
}

// Vérifier si favori
const checkIsFavorite = (groupe) => {
  const favId = generateFavoriteId(route.params.nom, groupe.idLigne, groupe.destination)
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
  <div class="flex flex-col min-h-full w-full">
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
          <span class="material-icons-round text-xs sm:text-sm" aria-hidden="true">place</span>
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
          :key="`${groupe.numLignePublic}_${groupe.destination}`"
          class="bg-surface-light dark:bg-surface-dark rounded-xl sm:rounded-2xl shadow-soft dark:shadow-none border border-gray-100 dark:border-gray-800 overflow-hidden p-3 sm:p-4"
        >
          <!-- En-tête: Ligne + Destination + Favori -->
          <div class="flex items-center gap-3 sm:gap-4 mb-3">
            <!-- Badge ligne -->
            <LineBadge 
              :num="groupe.numLignePublic" 
              :couleur-fond="groupe.couleurFond" 
              :couleur-texte="groupe.couleurTexte"
              size="md"
              class="rounded-[1rem] flex-shrink-0"
            />
            
            <!-- Destination -->
            <div class="flex-grow min-w-0 flex flex-col justify-center">
              <span class="text-sm sm:text-base font-semibold text-gray-900 dark:text-white truncate">
                {{ groupe.destination }}
                <span v-if="groupe.precisionDestination" class="font-normal text-gray-500 text-xs sm:text-sm">
                  {{ groupe.precisionDestination }}
                </span>
              </span>
              <span v-if="groupe.modeTransport === 1" class="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">Tramway</span>
              <span v-else class="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">Bus</span>
            </div>
            
            <!-- Bouton favori unique -->
            <button 
              @click="handleToggleFavorite(groupe)"
              :class="[
                'transition-colors flex-shrink-0',
                checkIsFavorite(groupe) 
                  ? 'text-yellow-500 hover:text-yellow-600' 
                  : 'text-gray-400 dark:text-gray-500 hover:text-yellow-500'
              ]"
              :title="checkIsFavorite(groupe) ? 'Retirer des favoris' : 'Ajouter aux favoris'"
              :aria-label="checkIsFavorite(groupe) ? 'Retirer ' + groupe.destination + ' des favoris' : 'Ajouter ' + groupe.destination + ' aux favoris'"
              :aria-pressed="checkIsFavorite(groupe)"
            >
              <span class="material-icons-round text-xl sm:text-2xl" aria-hidden="true">
                {{ checkIsFavorite(groupe) ? 'star' : 'star_border' }}
              </span>
            </button>
          </div>
          
          <!-- Horaires horizontaux -->
          <div class="flex flex-wrap gap-2 sm:gap-3">
            <button
              v-for="(horaire, idx) in groupe.horaires"
              :key="idx"
              @click="horaire.numVehicule && openVehicleModal(horaire.numVehicule)"
              :class="[
                'px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg sm:rounded-xl font-semibold text-sm sm:text-base transition-all',
                horaire.numVehicule ? 'cursor-pointer hover:scale-105 active:scale-95' : 'cursor-default',
                formatTemps(horaire.tempsRestant)?.isClose 
                  ? 'bg-green-100 dark:bg-green-900/30 text-line-green border border-green-200 dark:border-green-800' 
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700'
              ]"
              :title="horaire.numVehicule ? 'Voir les infos du véhicule' : ''"
            >
              <div class="flex items-center gap-1.5">
                <span v-if="formatTemps(horaire.tempsRestant)?.isClose" class="live-dot"></span>
                <span>{{ formatTemps(horaire.tempsRestant)?.text || horaire.temps }}</span>
              </div>
            </button>
          </div>
        </div>
      </template>
      
      <!-- Aucun horaire -->
      <div v-else class="text-center py-12" role="status">
        <div class="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4" aria-hidden="true">
          <span class="material-icons-round text-3xl text-gray-400">schedule</span>
        </div>
        <p class="text-lg font-semibold text-gray-700 dark:text-gray-300">Aucun passage prévu</p>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Pas de véhicule prévu prochainement à cet arrêt</p>
      </div>

      <!-- Publicité discrète en bas -->
      <section v-if="!loading" class="mt-4 opacity-90">
        <AdBanner ad-slot="5527627294" />
      </section>
    </main>
    
    <!-- Modal Véhicule -->
    <VehicleModal 
      :show="showVehicleModal"
      :num-vehicule="selectedVehicle"
      @close="showVehicleModal = false"
    />
  </div>
</template>

