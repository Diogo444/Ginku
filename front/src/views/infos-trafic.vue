<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { getEtatLignes, getMessages } from '@/services/api'
import ThemeToggle from '@/components/ThemeToggle.vue'
import LineBadge from '@/components/LineBadge.vue'
import Loader from '@/components/loader.vue'
import ErrorState from '@/components/ErrorState.vue'

defineOptions({ name: 'InfosTraficView' })

const etatLignes = ref([])
const messages = ref([])
const loading = ref(true)
const error = ref(null)
const searchTerm = ref('')
const abortController = ref(null)

// États des lignes avec leurs significations
const ETAT_CONFIG = {
  1: { label: 'Normal', color: 'green', icon: 'check_circle', bgColor: 'bg-green-50 dark:bg-green-900/10', textColor: 'text-green-600 dark:text-green-400', borderColor: 'border-green-500' },
  2: { label: 'Information', color: 'blue', icon: 'info', bgColor: 'bg-blue-50 dark:bg-blue-900/10', textColor: 'text-blue-600 dark:text-blue-400', borderColor: 'border-blue-500' },
  3: { label: 'Hors service', color: 'gray', icon: 'cancel', bgColor: 'bg-gray-50 dark:bg-gray-900/10', textColor: 'text-gray-600 dark:text-gray-400', borderColor: 'border-gray-500' },
  4: { label: 'Perturbation prévue', color: 'yellow', icon: 'schedule', bgColor: 'bg-yellow-50 dark:bg-yellow-900/20', textColor: 'text-yellow-700 dark:text-yellow-500', borderColor: 'border-yellow-500' },
  5: { label: 'Perturbation en cours', color: 'orange', icon: 'warning', bgColor: 'bg-orange-50 dark:bg-orange-900/20', textColor: 'text-orange-600 dark:text-orange-400', borderColor: 'border-orange-500' },
  6: { label: 'Circulation interrompue', color: 'red', icon: 'construction', bgColor: 'bg-red-50 dark:bg-red-900/20', textColor: 'text-red-600 dark:text-red-400', borderColor: 'border-red-500' }
}

// Charger les données
async function loadData() {
  loading.value = true
  error.value = null
  
  abortController.value?.abort()
  abortController.value = new AbortController()
  
  try {
    // Charger l'état des lignes
    etatLignes.value = await getEtatLignes(abortController.value.signal)
    
    // Charger les messages pour les lignes perturbées
    const perturbedLines = etatLignes.value.filter(l => l.etat > 1)
    const messagesPromises = perturbedLines.map(async (ligne) => {
      try {
        const msgs = await getMessages(ligne.idLigne)
        return msgs.map(m => ({ ...m, ligne }))
      } catch {
        return []
      }
    })
    
    const allMessages = await Promise.all(messagesPromises)
    messages.value = allMessages.flat()
  } catch (e) {
    if (e?.code !== 'ERR_CANCELED') {
      console.error('Erreur:', e)
      error.value = 'Impossible de charger les informations trafic'
    }
  } finally {
    loading.value = false
  }
}

onMounted(loadData)

onBeforeUnmount(() => {
  abortController.value?.abort()
})

// Filtrer par recherche
const filteredMessages = computed(() => {
  if (!searchTerm.value.trim()) return messages.value
  
  const term = searchTerm.value.toLowerCase()
  return messages.value.filter(m => 
    m.titre?.toLowerCase().includes(term) ||
    m.texte?.toLowerCase().includes(term) ||
    m.ligne?.numLignePublic?.toLowerCase().includes(term)
  )
})

// Résumé de l'état du réseau
const networkSummary = computed(() => {
  const total = etatLignes.value.length
  const perturbations = etatLignes.value.filter(l => l.etat > 1).length
  const interrupted = etatLignes.value.filter(l => l.etat === 6).length
  
  if (interrupted > 0) {
    return { 
      status: 'error', 
      title: `${interrupted} ligne${interrupted > 1 ? 's' : ''} interrompue${interrupted > 1 ? 's' : ''}`,
      subtitle: `${perturbations} perturbation${perturbations > 1 ? 's' : ''} au total`,
      icon: 'error',
      bgClass: 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/20',
      iconClass: 'bg-red-100 dark:bg-red-800 text-red-600 dark:text-red-300'
    }
  }
  
  if (perturbations > 0) {
    return { 
      status: 'warning', 
      title: `${perturbations} perturbation${perturbations > 1 ? 's' : ''} en cours`,
      subtitle: `sur ${total} ligne${total > 1 ? 's' : ''}`,
      icon: 'warning',
      bgClass: 'bg-yellow-50 dark:bg-yellow-900/10 border-yellow-100 dark:border-yellow-900/20',
      iconClass: 'bg-yellow-100 dark:bg-yellow-800 text-yellow-600 dark:text-yellow-300'
    }
  }
  
  return { 
    status: 'ok', 
    title: 'Réseau globalement fluide',
    subtitle: `${total} ligne${total > 1 ? 's' : ''} en service`,
    icon: 'check_circle',
    bgClass: 'bg-green-50 dark:bg-green-900/10 border-green-100 dark:border-green-900/20',
    iconClass: 'bg-green-100 dark:bg-green-800 text-green-600 dark:text-green-300'
  }
})

// Lignes perturbées groupées par état
const perturbedLignes = computed(() => {
  return etatLignes.value
    .filter(l => l.etat > 1)
    .sort((a, b) => b.etat - a.etat) // Plus grave en premier
})

// Extraire le texte brut du HTML
const stripHtml = (html) => {
  if (!html) return ''
  const div = document.createElement('div')
  div.innerHTML = html
  return div.textContent || div.innerText || ''
}
</script>

<template>
  <div class="flex flex-col min-h-full w-full pb-safe">
    <!-- Header sticky -->
    <header class="sticky top-0 z-50 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md px-4 sm:px-6 pt-4 sm:pt-6 pb-2 border-b border-transparent transition-colors duration-300">
      <!-- Titre + Toggle thème -->
      <div class="flex justify-between items-center mb-4 sm:mb-5">
        <div>
          <h1 class="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white">Infos Trafic</h1>
          <p class="text-xs sm:text-sm text-gray-500 dark:text-gray-400">État du réseau en temps réel</p>
        </div>
        <ThemeToggle />
      </div>
      
      <!-- Barre de recherche -->
      <div class="relative mb-2">
        <div class="absolute inset-y-0 left-0 pl-3 sm:pl-4 flex items-center pointer-events-none" aria-hidden="true">
          <span class="material-icons-round text-primary/70 text-xl">filter_list</span>
        </div>
        <input
          v-model="searchTerm"
          type="text"
          placeholder="Filtrer par ligne..."
          class="w-full py-3 sm:py-3.5 pl-10 sm:pl-12 pr-4 bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 rounded-xl sm:rounded-2xl text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none shadow-sm transition-all text-sm sm:text-base"
          aria-label="Filtrer les informations par ligne"
        />
      </div>
    </header>
    
    <!-- Contenu -->
    <main class="flex-grow px-4 sm:px-6 pb-8 space-y-4 sm:space-y-6 pt-3 sm:pt-4">
      <!-- Loading -->
      <Loader v-if="loading" />
      
      <!-- Erreur -->
      <ErrorState v-else-if="error" :message="error" @retry="loadData" />
      
      <template v-else>
        <!-- Résumé de l'état du réseau -->
        <div :class="['flex items-center gap-2.5 sm:gap-3 p-3 sm:p-4 rounded-xl sm:rounded-2xl border', networkSummary.bgClass]" role="status" aria-live="polite">
          <div :class="['w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0', networkSummary.iconClass]" aria-hidden="true">
            <span class="material-icons-round text-xl sm:text-2xl">{{ networkSummary.icon }}</span>
          </div>
          <div>
            <h3 class="font-semibold text-xs sm:text-sm" :class="networkSummary.status === 'ok' ? 'text-green-800 dark:text-green-200' : networkSummary.status === 'warning' ? 'text-yellow-800 dark:text-yellow-200' : 'text-red-800 dark:text-red-200'">
              {{ networkSummary.title }}
            </h3>
            <p class="text-[10px] sm:text-xs" :class="networkSummary.status === 'ok' ? 'text-green-700 dark:text-green-300/80' : networkSummary.status === 'warning' ? 'text-yellow-700 dark:text-yellow-300/80' : 'text-red-700 dark:text-red-300/80'">
              {{ networkSummary.subtitle }}
            </p>
          </div>
        </div>
        
        <!-- Messages de perturbation -->
        <div v-if="filteredMessages.length > 0" class="space-y-3 sm:space-y-4">
          <router-link
            v-for="msg in filteredMessages"
            :key="msg.id"
            :to="{ name: 'MessagePage', params: { idLigne: msg.ligne?.idLigne || msg.lignes?.[0] } }"
            :class="[
              'bg-surface-light dark:bg-surface-dark rounded-xl sm:rounded-2xl p-3 sm:p-5 shadow-soft border-l-4 flex flex-col gap-2.5 sm:gap-3 group active:scale-[0.99] transition-transform duration-150 block',
              ETAT_CONFIG[msg.ligne?.etat || msg.etat]?.borderColor || 'border-gray-300'
            ]"
          >
            <!-- Header du message -->
            <div class="flex justify-between items-start">
              <div class="flex items-center gap-2">
                <span 
                  :class="[
                    'px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md text-[9px] sm:text-[10px] font-semibold uppercase tracking-wide flex items-center gap-1',
                    ETAT_CONFIG[msg.ligne?.etat || msg.etat]?.bgColor,
                    ETAT_CONFIG[msg.ligne?.etat || msg.etat]?.textColor
                  ]"
                >
                  <span class="material-icons-round text-xs sm:text-sm" aria-hidden="true">
                    {{ ETAT_CONFIG[msg.ligne?.etat || msg.etat]?.icon || 'info' }}
                  </span>
                  {{ ETAT_CONFIG[msg.ligne?.etat || msg.etat]?.label || 'Info' }}
                </span>
              </div>
            </div>
            
            <!-- Contenu -->
            <div class="min-w-0">
              <h3 class="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 mb-0.5 sm:mb-1 truncate">{{ msg.titre }}</h3>
              <p class="text-xs sm:text-sm text-gray-600 dark:text-gray-400 leading-relaxed line-clamp-3">
                {{ stripHtml(msg.texte) }}
              </p>
            </div>
            
            <!-- Lignes impactées -->
            <div v-if="msg.ligne || msg.lignes?.length" class="flex items-center gap-2 mt-0.5 sm:mt-1 pt-2.5 sm:pt-3 border-t border-gray-100 dark:border-gray-800">
              <span class="text-[10px] sm:text-xs text-gray-500">Ligne impactée :</span>
              <div class="flex -space-x-2">
                <LineBadge 
                  v-if="msg.ligne"
                  :num="msg.ligne.numLignePublic"
                  :couleur-fond="msg.ligne.couleurFond"
                  :couleur-texte="msg.ligne.couleurTexte"
                  size="xs"
                />
              </div>
            </div>
          </router-link>
        </div>
        
        <!-- Lignes perturbées sans messages détaillés -->
        <div v-else-if="perturbedLignes.length > 0" class="space-y-3 sm:space-y-4">
          <div 
            v-for="ligne in perturbedLignes"
            :key="ligne.idLigne"
            :class="[
              'bg-surface-light dark:bg-surface-dark rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-soft border-l-4 flex items-center gap-3 sm:gap-4',
              ETAT_CONFIG[ligne.etat]?.borderColor || 'border-gray-300'
            ]"
          >
            <LineBadge 
              :num="ligne.numLignePublic"
              :couleur-fond="ligne.couleurFond"
              :couleur-texte="ligne.couleurTexte"
              size="sm"
            />
            <div class="flex-grow min-w-0">
              <span class="font-semibold text-sm sm:text-base text-gray-900 dark:text-gray-100">Ligne {{ ligne.numLignePublic }}</span>
              <p :class="['text-xs sm:text-sm', ETAT_CONFIG[ligne.etat]?.textColor]">
                {{ ETAT_CONFIG[ligne.etat]?.label || 'Information' }}
              </p>
            </div>
            <span :class="['material-icons-round', ETAT_CONFIG[ligne.etat]?.textColor]" aria-hidden="true">
              {{ ETAT_CONFIG[ligne.etat]?.icon || 'info' }}
            </span>
          </div>
        </div>
        
        <!-- Aucune perturbation -->
        <div v-else class="text-center py-12" role="status">
          <div class="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center mx-auto mb-4" aria-hidden="true">
            <span class="material-icons-round text-3xl text-green-500">check_circle</span>
          </div>
          <p class="text-lg font-semibold text-gray-700 dark:text-gray-300">Tout roule !</p>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Aucune perturbation signalée sur le réseau</p>
        </div>
      </template>
    </main>
  </div>
</template>
