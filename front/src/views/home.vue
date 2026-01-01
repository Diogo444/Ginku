<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { getArrets, getTempsLieu } from '@/services/api'
import { favorites, removeFavorite } from '@/stores/favorites'
import ThemeToggle from '@/components/ThemeToggle.vue'
import LineBadge from '@/components/LineBadge.vue'
import Loader from '@/components/loader.vue'
import EmptyState from '@/components/EmptyState.vue'

defineOptions({ name: 'HomePage' })

// ========== SEARCH ==========
const arrets = ref([])
const searchTerm = ref('')
const showDropdown = ref(false)
const searchWrapperRef = ref(null)
const searchLoading = ref(true)
const abortController = ref(null)

function handleClickOutside(e) {
  if (searchWrapperRef.value && !searchWrapperRef.value.contains(e.target)) {
    showDropdown.value = false
  }
}

// Charger les arrêts au montage
onMounted(async () => {
  document.addEventListener('click', handleClickOutside)

  abortController.value = new AbortController()
  try {
    const data = await getArrets(abortController.value.signal)
    arrets.value = data.filter((obj) => obj && typeof obj.nom === 'string' && obj.id)
  } catch (error) {
    console.error('Erreur lors de la requête:', error)
    arrets.value = []
  } finally {
    searchLoading.value = false
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
  abortController.value?.abort()
  favoritesRefreshTimer.value && clearInterval(favoritesRefreshTimer.value)
})

// Normalisation pour la recherche
function normalize(str) {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

// Liste filtrée unique
const filteredUniqueNomArrets = computed(() => {
  const term = normalize(searchTerm.value.trim())
  if (!term) return []
  const seen = new Set()
  const uniqueNoms = []

  arrets.value.forEach((arret) => {
    if (!arret || typeof arret.nom !== 'string') return
    const nomOriginal = arret.nom
    const nom = normalize(nomOriginal)
    if (!nom.includes(term) || seen.has(nom)) return
    seen.add(nom)
    uniqueNoms.push(nomOriginal)
  })

  return uniqueNoms.slice(0, 10) // Limite à 10 résultats
})

watch(searchTerm, () => {
  showDropdown.value = searchTerm.value.trim().length > 0 && filteredUniqueNomArrets.value.length > 0
})

// ========== FAVORIS ==========
const favoritesData = ref(new Map()) // { favoriteId: { loading, error, temps } }
const favoritesRefreshTimer = ref(null)

// Charger les temps pour les favoris
const loadFavoritesData = async () => {
  for (const fav of favorites.value) {
    if (!fav.nomArret) continue
    
    // Ne pas écraser si déjà en cours de chargement
    if (favoritesData.value.get(fav.id)?.loading) continue
    
    favoritesData.value.set(fav.id, { 
      ...favoritesData.value.get(fav.id),
      loading: true 
    })
    
    try {
      const data = await getTempsLieu(fav.nomArret)
      if (data?.listeTemps) {
        // Trouver le temps pour cette ligne/destination
        const temps = data.listeTemps.find(t => 
          t.idLigne === fav.idLigne && 
          (t.destination === fav.destination || normalize(t.destination) === normalize(fav.destination))
        )
        
        favoritesData.value.set(fav.id, {
          loading: false,
          error: null,
          temps: temps ? {
            minutes: temps.tempsRestant,
            fiabilite: temps.fiabilite,
            numVehicule: temps.numVehicule
          } : null
        })
      }
    } catch (e) {
      favoritesData.value.set(fav.id, {
        loading: false,
        error: 'Erreur de chargement',
        temps: null
      })
    }
  }
}

// Rafraîchir les favoris périodiquement
onMounted(() => {
  loadFavoritesData()
  favoritesRefreshTimer.value = setInterval(loadFavoritesData, 30000) // 30s
})

// Recharger quand les favoris changent
watch(favorites, loadFavoritesData, { deep: true })

// Formater le temps d'attente
const formatTemps = (minutes) => {
  if (minutes === undefined || minutes === null) return null
  if (minutes <= 0) return { text: 'À l\'approche', isClose: true }
  if (minutes < 60) return { text: `${minutes}`, unit: 'min', isClose: minutes <= 2 }
  return { text: `${Math.floor(minutes / 60)}h${minutes % 60}`, isClose: false }
}
</script>

<template>
  <div class="flex flex-col min-h-full w-full pb-safe">
    <!-- Header sticky -->
    <header class="sticky top-0 z-50 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md px-6 pt-6 pb-2 border-b border-transparent transition-colors duration-300">
      <!-- Titre + Toggle thème -->
      <div class="flex justify-between items-center mb-5">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Bonjour,</h1>
          <p class="text-sm text-gray-500 dark:text-gray-400 font-medium">Où souhaitez-vous aller ?</p>
        </div>
        <ThemeToggle />
      </div>
      
      <!-- Barre de recherche -->
      <div ref="searchWrapperRef" class="relative mb-2" role="search">
        <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-30">
          <span class="material-icons-round text-primary">search</span>
        </div>
        <input
          v-model="searchTerm"
          @focus="showDropdown = filteredUniqueNomArrets.length > 0"
          @keydown.escape="showDropdown = false"
          type="text"
          :placeholder="searchLoading ? 'Chargement...' : 'Rechercher une ligne, un arrêt...'"
          :disabled="searchLoading"
          :class="[
            'relative z-20 w-full py-3.5 pl-12 pr-4 bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 shadow-sm transition-all text-base font-medium focus:outline-none',
            showDropdown && filteredUniqueNomArrets.length > 0
              ? 'rounded-t-2xl rounded-b-none border-b-0 focus:border-gray-200 dark:focus:border-gray-700'
              : 'rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary'
          ]"
          autocomplete="off"
          aria-label="Rechercher un arrêt"
          :aria-expanded="showDropdown"
          aria-controls="search-results"
        />
        
        <!-- Dropdown résultats -->
        <div 
          v-show="showDropdown && filteredUniqueNomArrets.length > 0"
          id="search-results"
          class="absolute top-full left-0 w-full bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 border-t-0 rounded-b-2xl shadow-xl z-10 overflow-hidden"
        >
          <ul>
            <li
              v-for="nom in filteredUniqueNomArrets"
              :key="nom"
              class="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer flex items-center gap-3 border-b border-gray-50 dark:border-gray-800 last:border-0 transition-colors"
            >
              <router-link
                :to="{ name: 'ArretNomView', params: { nom } }"
                class="flex items-center gap-3 w-full"
                @click="showDropdown = false; searchTerm = ''"
              >
                <div class="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
                  <span class="material-icons-round text-gray-500 text-lg">place</span>
                </div>
                <span class="text-sm font-medium text-gray-700 dark:text-gray-200">{{ nom }}</span>
              </router-link>
            </li>
          </ul>
        </div>
      </div>
    </header>
    
    <!-- Contenu principal -->
    <main class="flex-grow px-6 pb-8 space-y-8 pt-4">
      <!-- Section Favoris -->
      <section>
        <div class="flex justify-between items-end mb-4">
          <h2 class="text-lg font-bold text-gray-900 dark:text-gray-100">Mes Favoris</h2>
        </div>
        
        <!-- Liste des favoris -->
        <div v-if="favorites.length > 0" class="space-y-4">
          <router-link
            v-for="fav in favorites"
            :key="fav.id"
            :to="{ name: 'ArretNomView', params: { nom: fav.nomArret } }"
            class="bg-surface-light dark:bg-surface-dark rounded-2xl p-4 shadow-soft border border-gray-100 dark:border-gray-800 flex items-center justify-between group active:scale-[0.98] transition-transform duration-150 cursor-pointer relative overflow-hidden block"
          >
            <!-- Barre de couleur gauche -->
            <div 
              class="absolute top-0 left-0 w-1 h-full"
              :style="{ backgroundColor: '#' + (fav.couleurFond || '666666') }"
            ></div>
            
            <div class="flex items-center gap-4 pl-2">
              <div class="relative">
                <LineBadge 
                  :num="fav.numLigne" 
                  :couleur-fond="fav.couleurFond" 
                  :couleur-texte="fav.couleurTexte"
                  size="lg"
                />
              </div>
              <div class="flex flex-col">
                <span class="font-bold text-gray-900 dark:text-gray-100 text-[15px]">{{ fav.destination }}</span>
                <span class="text-xs text-gray-500 dark:text-gray-400 font-medium flex items-center gap-1 mt-0.5">
                  Arrêt {{ fav.nomArret }}
                </span>
              </div>
            </div>
            
            <!-- Temps d'attente -->
            <div class="flex flex-col items-end pr-1">
              <button 
                @click.stop.prevent="removeFavorite(fav.id)"
                class="text-yellow-500 hover:text-yellow-600 mb-1 transition-colors"
                title="Retirer des favoris"
              >
                <span class="material-icons-round text-xl">star</span>
              </button>
              
              <template v-if="favoritesData.get(fav.id)?.loading">
                <Loader size="sm" :centered="false" />
              </template>
              <template v-else-if="favoritesData.get(fav.id)?.temps">
                <template v-if="formatTemps(favoritesData.get(fav.id).temps.minutes)?.isClose">
                  <span class="flex items-center gap-2 text-base font-bold text-line-green bg-line-green/10 px-3 py-1 rounded-full">
                    <span class="live-dot"></span>
                    {{ formatTemps(favoritesData.get(fav.id).temps.minutes).text }}
                  </span>
                </template>
                <template v-else>
                  <span class="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                    {{ formatTemps(favoritesData.get(fav.id).temps.minutes).text }}
                    <span class="text-sm font-semibold text-gray-400 ml-0.5">
                      {{ formatTemps(favoritesData.get(fav.id).temps.minutes).unit }}
                    </span>
                  </span>
                </template>
              </template>
              <template v-else>
                <span class="text-sm text-gray-400">--</span>
              </template>
            </div>
          </router-link>
        </div>
        
        <!-- État vide -->
        <EmptyState
          v-else
          icon="star_border"
          title="Pas de favoris"
          message="Ajoutez des arrêts à vos favoris pour les retrouver ici"
        >
          <router-link 
            to="/lignes"
            class="mt-4 px-4 py-2 bg-primary text-white rounded-full text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            Parcourir les lignes
          </router-link>
        </EmptyState>
      </section>
    </main>
  </div>
</template>
