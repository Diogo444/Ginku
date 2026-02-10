<script setup>
import { useRoute, useRouter } from 'vue-router'
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue'
import { getMessages, getLignes } from '@/services/api'
import BackButton from '@/components/BackButton.vue'
import LineBadge from '@/components/LineBadge.vue'
import Loader from '@/components/loader.vue'
import ErrorState from '@/components/ErrorState.vue'
import ThemeToggle from '@/components/ThemeToggle.vue'

defineOptions({ name: 'MessagePage' })

const messages = ref([])
const ligne = ref(null)
const loading = ref(true)
const error = ref(null)
const route = useRoute()
const router = useRouter()
const abortController = ref(null)

// Configuration des états
const ETAT_CONFIG = {
  1: { label: 'Normal', color: 'green', icon: 'check_circle', bgColor: 'bg-green-50 dark:bg-green-900/10', textColor: 'text-green-600 dark:text-green-400', borderColor: 'border-green-500' },
  2: { label: 'Information', color: 'blue', icon: 'info', bgColor: 'bg-blue-50 dark:bg-blue-900/10', textColor: 'text-blue-600 dark:text-blue-400', borderColor: 'border-blue-500' },
  3: { label: 'Hors service', color: 'gray', icon: 'cancel', bgColor: 'bg-gray-50 dark:bg-gray-900/10', textColor: 'text-gray-600 dark:text-gray-400', borderColor: 'border-gray-500' },
  4: { label: 'Perturbation prévue', color: 'yellow', icon: 'schedule', bgColor: 'bg-yellow-50 dark:bg-yellow-900/20', textColor: 'text-yellow-700 dark:text-yellow-500', borderColor: 'border-yellow-500' },
  5: { label: 'Perturbation en cours', color: 'orange', icon: 'warning', bgColor: 'bg-orange-50 dark:bg-orange-900/20', textColor: 'text-orange-600 dark:text-orange-400', borderColor: 'border-orange-500' },
  6: { label: 'Circulation interrompue', color: 'red', icon: 'construction', bgColor: 'bg-red-50 dark:bg-red-900/20', textColor: 'text-red-600 dark:text-red-400', borderColor: 'border-red-500' }
}

async function loadData() {
  loading.value = true
  error.value = null
  
  abortController.value?.abort()
  abortController.value = new AbortController()
  
  try {
    // Charger messages et info ligne en parallèle
    const [messagesData, lignesData] = await Promise.all([
      getMessages(route.params.idLigne, abortController.value.signal),
      getLignes(abortController.value.signal)
    ])
    
    messages.value = messagesData.map(msg => ({
      ...msg,
      sections: parseMessageContent(msg.texte)
    }))
    
    // Trouver la ligne correspondante
    ligne.value = lignesData.find(l => l.idLigne === route.params.idLigne) || null
  } catch (e) {
    if (e?.code !== 'ERR_CANCELED') {
      console.error('Erreur:', e)
      error.value = 'Impossible de charger les messages'
    }
  } finally {
    loading.value = false
  }
}

onMounted(loadData)

watch(() => route.params.idLigne, loadData)

onBeforeUnmount(() => {
  abortController.value?.abort()
})

// Retour arrière
function goBack() {
  if (window.history.length > 2) {
    router.back()
  } else {
    router.push({ name: 'InfosTrafic' })
  }
}

// Parser le contenu HTML des messages en sections
function parseMessageContent(htmlContent) {
  if (!htmlContent) return []
  
  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = htmlContent
  
  const sections = []
  let currentSection = null
  
  const walker = document.createTreeWalker(tempDiv, NodeFilter.SHOW_ALL, null, false)
  let node = walker.nextNode()
  
  while (node) {
    const text = node.textContent?.trim()
    if (!text) {
      node = walker.nextNode()
      continue
    }
    
    // Détecter les titres de section
    if (node.tagName === 'STRONG' || node.tagName === 'B' ||
        (node.nodeType === Node.TEXT_NODE && text.includes(':') && text.length < 50)) {
      if (currentSection) {
        sections.push(currentSection)
      }
      currentSection = {
        title: text.replace(':', '').trim(),
        items: []
      }
    } else if (node.nodeType === Node.TEXT_NODE && text.length > 10) {
      if (currentSection) {
        const lines = text.split(/\n|<br>/).filter(line => line.trim())
        lines.forEach(line => {
          const cleanLine = line.trim()
          if (cleanLine && cleanLine.length > 5) {
            currentSection.items.push(cleanLine)
          }
        })
      }
    }
    node = walker.nextNode()
  }
  
  if (currentSection && currentSection.items.length > 0) {
    sections.push(currentSection)
  }
  
  return sections
}

// État le plus sévère parmi tous les messages
const maxEtat = computed(() => {
  if (!messages.value.length) return 1
  return Math.max(...messages.value.map(m => m.etat || 1))
})
</script>

<template>
  <div class="flex flex-col min-h-full w-full">
    <!-- Header sticky -->
    <header class="sticky top-0 z-50 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 border-b border-gray-100 dark:border-gray-800 transition-colors duration-300">
      <div class="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-4">
        <BackButton @click="goBack" />
        <div class="flex-grow min-w-0">
          <h1 class="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">Messages</h1>
          <p v-if="ligne" class="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            Ligne {{ ligne.numLignePublic }}
          </p>
        </div>
        <ThemeToggle />
      </div>
      
      <!-- Badge de ligne -->
      <div v-if="ligne && !loading" class="flex items-center gap-2.5 sm:gap-3">
        <LineBadge 
          :num="ligne.numLignePublic"
          :couleur-fond="ligne.couleurFond"
          :couleur-texte="ligne.couleurTexte"
          size="md"
        />
        <div>
          <span 
            :class="[
              'px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md text-[10px] sm:text-xs font-semibold uppercase tracking-wide flex items-center gap-1',
              ETAT_CONFIG[maxEtat]?.bgColor,
              ETAT_CONFIG[maxEtat]?.textColor
            ]"
          >
            <span class="material-icons-round text-xs sm:text-sm" aria-hidden="true">{{ ETAT_CONFIG[maxEtat]?.icon }}</span>
            {{ ETAT_CONFIG[maxEtat]?.label }}
          </span>
        </div>
      </div>
    </header>
    
    <!-- Contenu -->
    <main class="flex-grow px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
      <!-- Loading -->
      <Loader v-if="loading" />
      
      <!-- Erreur -->
      <ErrorState v-else-if="error" :message="error" @retry="loadData" />
      
      <!-- Messages -->
      <template v-else-if="messages.length">
        <div 
          v-for="msg in messages"
          :key="msg.id"
          :class="[
            'bg-surface-light dark:bg-surface-dark rounded-xl sm:rounded-2xl overflow-hidden shadow-soft border-l-4',
            ETAT_CONFIG[msg.etat]?.borderColor || 'border-gray-300'
          ]"
        >
          <!-- En-tête du message -->
          <div class="px-3 sm:px-5 py-3 sm:py-4 border-b border-gray-100 dark:border-gray-800">
            <div class="flex items-start justify-between gap-2 sm:gap-3">
              <h2 class="text-base sm:text-lg font-semibold text-gray-900 dark:text-white flex-grow min-w-0" v-html="msg.titre"></h2>
              <span 
                :class="[
                  'px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md text-[9px] sm:text-[10px] font-semibold uppercase tracking-wide flex items-center gap-1 flex-shrink-0',
                  ETAT_CONFIG[msg.etat]?.bgColor,
                  ETAT_CONFIG[msg.etat]?.textColor
                ]"
              >
                <span class="material-icons-round text-xs sm:text-sm" aria-hidden="true">{{ ETAT_CONFIG[msg.etat]?.icon }}</span>
                {{ ETAT_CONFIG[msg.etat]?.label }}
              </span>
            </div>
          </div>
          
          <!-- Corps du message -->
          <div class="px-3 sm:px-5 py-3 sm:py-4 space-y-4 sm:space-y-5">
            <!-- Sections parsées -->
            <template v-if="msg.sections.length">
              <div v-for="(section, index) in msg.sections" :key="index" class="space-y-2.5 sm:space-y-3">
                <!-- Titre de section -->
                <div class="flex items-center gap-1.5 sm:gap-2">
                  <span class="material-icons-round text-primary text-base sm:text-lg" aria-hidden="true">subdirectory_arrow_right</span>
                  <h3 class="text-xs sm:text-sm font-semibold text-gray-800 dark:text-gray-200 uppercase tracking-wide">
                    {{ section.title }}
                  </h3>
                </div>
                
                <!-- Items -->
                <div class="space-y-1.5 sm:space-y-2 ml-5 sm:ml-7">
                  <div 
                    v-for="(item, itemIndex) in section.items"
                    :key="itemIndex"
                    class="p-2.5 sm:p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg sm:rounded-xl text-xs sm:text-sm text-gray-700 dark:text-gray-300 leading-relaxed"
                  >
                    {{ item }}
                  </div>
                </div>
              </div>
            </template>
            
            <!-- Fallback si le parsing ne fonctionne pas -->
            <div v-else class="prose dark:prose-invert max-w-none text-xs sm:text-sm">
              <div v-html="msg.texte"></div>
            </div>
            
            <!-- Lien vers plus d'informations -->
            <a
              v-if="msg.url"
              :href="msg.url"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg sm:rounded-xl transition-colors font-medium text-xs sm:text-sm mt-3 sm:mt-4"
              aria-label="Plus d'informations (s'ouvre dans un nouvel onglet)"
            >
              <span>Plus d'informations</span>
              <span class="material-icons-round text-base sm:text-lg" aria-hidden="true">open_in_new</span>
            </a>
          </div>
        </div>
      </template>
      
      <!-- Aucun message -->
      <div v-else class="text-center py-12 sm:py-16" role="status">
        <div class="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center mx-auto mb-3 sm:mb-4" aria-hidden="true">
          <span class="material-icons-round text-2xl sm:text-3xl text-green-500">check_circle</span>
        </div>
        <p class="text-base sm:text-lg font-semibold text-gray-700 dark:text-gray-300">Aucune perturbation</p>
        <p class="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">Cette ligne fonctionne normalement</p>
      </div>
    </main>
  </div>
</template>

