<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { getLignes } from '@/services/api'
import ThemeToggle from '@/components/ThemeToggle.vue'
import LineBadge from '@/components/LineBadge.vue'
import Loader from '@/components/loader.vue'
import ErrorState from '@/components/ErrorState.vue'

defineOptions({ name: 'LignesView' })

const lignes = ref([])
const loading = ref(true)
const error = ref(null)
const searchTerm = ref('')
const abortController = ref(null)

const loadLignes = async () => {
  loading.value = true
  error.value = null
  
  abortController.value?.abort()
  abortController.value = new AbortController()
  
  try {
    lignes.value = await getLignes(abortController.value.signal)
  } catch (e) {
    if (e?.code !== 'ERR_CANCELED') {
      console.error('Erreur lors de la requête API:', e)
      error.value = 'Impossible de charger les lignes'
    }
  } finally {
    loading.value = false
  }
}

onMounted(loadLignes)

onBeforeUnmount(() => {
  abortController.value?.abort()
})

// Normalisation pour la recherche
const normalize = (str) => {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

// Filtrer les lignes par recherche
const filteredLignes = computed(() => {
  if (!searchTerm.value.trim()) return lignes.value
  const term = normalize(searchTerm.value.trim())
  return lignes.value.filter(ligne => 
    normalize(ligne.numLignePublic).includes(term) ||
    normalize(ligne.libellePublic || '').includes(term)
  )
})

// Regrouper les lignes par catégorie (typologie)
const groupedLignes = computed(() => {
  const groups = {
    tramway: { title: 'Tramway', icon: 'tram', iconColor: 'text-line-teal', lignes: [] },
    lianes: { title: 'Lianes', icon: 'directions_bus', iconColor: 'text-line-red', lignes: [] },
    urbaines: { title: 'Lignes Urbaines', icon: 'directions_bus_filled', iconColor: 'text-gray-500', lignes: [] },
    periurbaines: { title: 'Lignes Périurbaines', icon: 'airport_shuttle', iconColor: 'text-line-brown', lignes: [] },
    scolaires: { title: 'Lignes Scolaires', icon: 'school', iconColor: 'text-line-yellow', lignes: [] },
    autres: { title: 'Autres lignes', icon: 'more_horiz', iconColor: 'text-gray-400', lignes: [] }
  }
  
  filteredLignes.value.forEach(ligne => {
    // Détection du type basée sur le numéro public ou la typologie
    const num = (ligne.numLignePublic || '').toUpperCase()
    
    if (num.startsWith('T') || ligne.modeTransport === 0) {
      groups.tramway.lignes.push(ligne)
    } else if (num.startsWith('L') || ligne.typologie === 20) {
      groups.lianes.lignes.push(ligne)
    } else if (ligne.periurbain) {
      groups.periurbaines.lignes.push(ligne)
    } else if (ligne.scolaire) {
      groups.scolaires.lignes.push(ligne)
    } else if (ligne.typologie >= 30 && ligne.typologie < 50) {
      groups.urbaines.lignes.push(ligne)
    } else {
      groups.autres.lignes.push(ligne)
    }
  })
  
  // Retourner seulement les groupes non vides
  return Object.values(groups).filter(g => g.lignes.length > 0)
})
</script>

<template>
  <div class="flex flex-col min-h-full w-full pb-safe">
    <!-- Header sticky -->
    <header class="sticky top-0 z-50 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md px-4 sm:px-6 pt-4 sm:pt-6 pb-2 border-b border-transparent transition-colors duration-300">
      <!-- Titre + Toggle thème -->
      <div class="flex justify-between items-center mb-4 sm:mb-5">
        <div>
          <h1 class="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white">Le Réseau</h1>
          <p class="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Explorez toutes les lignes</p>
        </div>
        <ThemeToggle />
      </div>
      
      <!-- Barre de recherche -->
      <div class="relative mb-2">
        <div class="absolute inset-y-0 left-0 pl-3 sm:pl-4 flex items-center pointer-events-none">
          <span class="material-icons-round text-primary/70 text-xl">search</span>
        </div>
        <input
          v-model="searchTerm"
          type="text"
          placeholder="Chercher une ligne..."
          class="w-full py-3 sm:py-3.5 pl-10 sm:pl-12 pr-4 bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 rounded-xl sm:rounded-2xl text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none shadow-sm transition-all text-sm sm:text-base"
        />
      </div>
    </header>
    
    <!-- Contenu -->
    <main class="flex-grow px-4 sm:px-6 pb-8 space-y-5 sm:space-y-6 pt-3 sm:pt-4">
      <!-- Loading -->
      <Loader v-if="loading" />
      
      <!-- Erreur -->
      <ErrorState v-else-if="error" :message="error" @retry="loadLignes" />
      
      <!-- Liste des lignes groupées -->
      <template v-else-if="groupedLignes.length > 0">
        <section v-for="group in groupedLignes" :key="group.title">
          <!-- Header de section -->
          <div class="flex items-center gap-2 mb-2 sm:mb-3 px-1 pt-2">
            <span :class="['material-icons-round text-base sm:text-lg', group.iconColor]">{{ group.icon }}</span>
            <h2 class="text-xs sm:text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{{ group.title }}</h2>
          </div>
          
          <!-- Lignes du groupe -->
          <div class="space-y-2.5 sm:space-y-3">
            <router-link
              v-for="ligne in group.lignes"
              :key="ligne.id"
              :to="{
                name: 'ArretFromLigneView',
                params: {
                  idLigne: ligne.id,
                  idVariante: ligne.variantes?.[0]?.id,
                  numLigne: ligne.numLignePublic,
                },
              }"
              class="bg-surface-light dark:bg-surface-dark rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-soft border border-gray-100 dark:border-gray-800 flex items-center justify-between group active:scale-[0.98] transition-transform duration-150 cursor-pointer block"
            >
              <div class="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                <LineBadge 
                  :num="ligne.numLignePublic" 
                  :couleur-fond="ligne.couleurFond" 
                  :couleur-texte="ligne.couleurTexte"
                  size="md"
                />
                <div class="flex flex-col min-w-0">
                  <span class="font-semibold text-gray-900 dark:text-gray-100 text-sm sm:text-[15px] truncate">
                    {{ ligne.libellePublic?.split('<>')[0]?.trim() || ligne.libellePublic }}
                  </span>
                  <span class="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 truncate">
                    {{ ligne.libellePublic?.split('<>')[1]?.trim() || '' }}
                  </span>
                </div>
              </div>
              <span class="material-icons-round text-gray-400 dark:text-gray-600 group-hover:text-primary transition-colors flex-shrink-0 ml-2">chevron_right</span>
            </router-link>
          </div>
        </section>
      </template>
      
      <!-- Aucun résultat -->
      <div v-else class="text-center text-gray-500 dark:text-gray-400 mt-10">
        Aucune ligne trouvée.
      </div>
    </main>
  </div>
</template>
