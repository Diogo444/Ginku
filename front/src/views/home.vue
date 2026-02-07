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

// Normalisation pour comparaison
const normalizeText = (str) => {
  if (!str) return ''
  return str
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

// Charger les temps pour les favoris
const loadFavoritesData = async () => {
  // Copier la liste actuelle des favoris pour éviter les problèmes de réactivité
  const currentFavorites = [...favorites.value]
  
  for (const fav of currentFavorites) {
    if (!fav.nomArret) continue
    
    // Vérifier que le favori existe toujours
    if (!favorites.value.some(f => f.id === fav.id)) continue
    
    // Ne pas écraser si déjà en cours de chargement
    const existing = favoritesData.value.get(fav.id)
    if (existing?.loading) continue
    
    // Marquer comme loading
    favoritesData.value.set(fav.id, { 
      ...existing,
      loading: true 
    })
    
    try {
      const data = await getTempsLieu(fav.nomArret)
      
      // Re-vérifier que le favori existe toujours après l'appel API
      if (!favorites.value.some(f => f.id === fav.id)) {
        favoritesData.value.delete(fav.id)
        continue
      }
      
      if (data?.listeTemps) {
        // Trouver tous les temps pour cette ligne/destination (comparaison plus souple)
        const tempsListe = data.listeTemps.filter(t => {
          if (t.idLigne !== fav.idLigne) return false
          // Comparaison souple des destinations
          const destNorm = normalizeText(t.destination)
          const favDestNorm = normalizeText(fav.destination)
          return destNorm === favDestNorm || 
                 destNorm.includes(favDestNorm) || 
                 favDestNorm.includes(destNorm)
        }).slice(0, 3) // Prendre les 3 prochains
        
        favoritesData.value.set(fav.id, {
          loading: false,
          error: null,
          horaires: tempsListe.map(temps => ({
            minutes: temps.tempsEnSeconde != null ? Math.round(temps.tempsEnSeconde / 60) : null,
            fiable: temps.fiable,
            numVehicule: temps.numVehicule,
            tempsTexte: temps.temps,
            tempsRestant: temps.tempsRestant
          }))
        })
      } else {
        favoritesData.value.set(fav.id, {
          loading: false,
          error: null,
          horaires: []
        })
      }
    } catch (e) {
      if (e?.code !== 'ERR_CANCELED') {
        favoritesData.value.set(fav.id, {
          loading: false,
          error: 'Erreur',
          horaires: []
        })
      }
    }
  }
  
  // Nettoyer les entrées pour les favoris supprimés
  const currentIds = new Set(favorites.value.map(f => f.id))
  for (const [id] of favoritesData.value) {
    if (!currentIds.has(id)) {
      favoritesData.value.delete(id)
    }
  }
}

// Rafraîchir les favoris périodiquement
onMounted(() => {
  loadFavoritesData()
  favoritesRefreshTimer.value = setInterval(loadFavoritesData, 30000) // 30s
})

// Recharger quand les favoris changent (avec debounce implicite)
watch(favorites, () => {
  // Petit délai pour éviter les appels multiples lors de modifications rapides
  setTimeout(loadFavoritesData, 100)
}, { deep: true })

// Formater le temps d'attente pour les horaires multiples
const formatTempsHoraire = (horaire) => {
  if (!horaire) return null
  
  // Utiliser tempsRestant si disponible (comme dans arret.vue)
  const tempsRestant = horaire.tempsRestant ?? horaire.minutes
  
  if (tempsRestant === undefined || tempsRestant === null) {
    // Fallback sur le texte de l'API
    if (horaire.tempsTexte) {
      return { text: horaire.tempsTexte, isClose: false }
    }
    return null
  }
  
  if (tempsRestant <= 0) return { text: 'À l\'approche', isClose: true }
  if (tempsRestant < 60) return { text: `${tempsRestant} min`, isClose: tempsRestant <= 2 }
  return { text: `${Math.floor(tempsRestant / 60)}h${tempsRestant % 60}`, isClose: false }
}
</script>

<template>
  <div class="flex flex-col min-h-full w-full pb-safe">
    <!-- Header sticky -->
    <header class="sticky top-0 z-50 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md px-4 sm:px-6 pt-4 sm:pt-6 pb-2 border-b border-transparent transition-colors duration-300">
      <!-- Titre + Toggle thème -->
      <div class="flex justify-between items-center mb-4 sm:mb-5">
        <div>
          <h1 class="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white">Bonjour,</h1>
          <p class="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Où souhaitez-vous aller ?</p>
        </div>
        <ThemeToggle />
      </div>
      
      <!-- Barre de recherche -->
      <div ref="searchWrapperRef" class="relative mb-2" role="search">
        <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-30" aria-hidden="true">
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
            'relative z-20 w-full py-3 sm:py-3.5 pl-11 sm:pl-12 pr-4 bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 shadow-sm transition-all text-sm sm:text-base font-normal focus:outline-none',
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
          <ul role="listbox">
            <li
              v-for="nom in filteredUniqueNomArrets"
              :key="nom"
              class="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer flex items-center gap-3 border-b border-gray-50 dark:border-gray-800 last:border-0 transition-colors"
              role="option"
            >
              <router-link
                :to="{ name: 'ArretNomView', params: { nom } }"
                class="flex items-center gap-3 w-full"
                @click="showDropdown = false; searchTerm = ''"
                :aria-label="'Aller à l\'arrêt ' + nom"
              >
                <div class="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0" aria-hidden="true">
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
    <main class="flex-grow px-4 sm:px-6 pb-8 space-y-6 sm:space-y-8 pt-3 sm:pt-4">
      <!-- Section Favoris -->
      <section>
        <div class="flex justify-between items-end mb-3 sm:mb-4">
          <h2 class="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">Mes Favoris</h2>
        </div>
        
        <!-- Liste des favoris -->
        <div v-if="favorites.length > 0" class="space-y-3 sm:space-y-4">
          <router-link
            v-for="fav in favorites"
            :key="fav.id"
            :to="{ name: 'ArretNomView', params: { nom: fav.nomArret } }"
            class="bg-surface-light dark:bg-surface-dark rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-soft border border-gray-100 dark:border-gray-800 flex items-center justify-between group active:scale-[0.98] transition-transform duration-150 cursor-pointer relative overflow-hidden block"
          >
            <!-- Barre de couleur gauche -->
            <div 
              class="absolute top-0 left-0 w-1 h-full"
              :style="{ backgroundColor: '#' + (fav.couleurFond || '666666') }"
            ></div>
            
            <div class="flex items-center gap-3 sm:gap-4 pl-2 min-w-0 flex-1">
              <div class="relative flex-shrink-0">
                <LineBadge 
                  :num="fav.numLigne" 
                  :couleur-fond="fav.couleurFond" 
                  :couleur-texte="fav.couleurTexte"
                  size="md"
                />
              </div>
              <div class="flex flex-col min-w-0">
                <span class="font-semibold text-gray-900 dark:text-gray-100 text-sm sm:text-[15px] truncate">{{ fav.destination }}</span>
                <span class="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5 truncate">
                  {{ fav.nomArret }}
                </span>
              </div>
            </div>
            
            <!-- Temps d'attente -->
            <div class="flex flex-col items-end gap-1.5 pr-1">
              <button 
                @click.stop.prevent="removeFavorite(fav.id)"
                class="text-yellow-500 hover:text-yellow-600 transition-colors"
                title="Retirer des favoris"
                :aria-label="'Retirer ' + fav.destination + ' des favoris'"
                aria-pressed="true"
              >
                <span class="material-icons-round text-xl" aria-hidden="true">star</span>
              </button>
              
              <template v-if="favoritesData.get(fav.id)?.loading">
                <Loader size="sm" :centered="false" />
              </template>
              <template v-else-if="favoritesData.get(fav.id)?.horaires?.length > 0">
                <div class="flex flex-wrap justify-end gap-1.5">
                  <span
                    v-for="(horaire, idx) in favoritesData.get(fav.id).horaires"
                    :key="idx"
                    :class="[
                      'px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg font-semibold text-xs sm:text-sm',
                      formatTempsHoraire(horaire)?.isClose 
                        ? 'bg-green-100 dark:bg-green-900/30 text-line-green border border-green-200 dark:border-green-800' 
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700'
                    ]"
                  >
                    <span class="flex items-center gap-1">
                      <span v-if="formatTempsHoraire(horaire)?.isClose" class="live-dot"></span>
                      {{ formatTempsHoraire(horaire)?.text || horaire.tempsTexte }}
                    </span>
                  </span>
                </div>
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
