<script setup>
import api from '@/api'
import { useRoute } from 'vue-router'
import { ref, onMounted } from 'vue'
import Buttonback from '@/components/buttonback.vue'
import Loader from '@/components/loader.vue'

defineOptions({ name: 'MessagePage' })
const message = ref([])
const isLoading = ref(true)
const route = useRoute()

onMounted(async () => {
  try {
    const { data } = await api.get(`/messages/${route.params.idLigne}`)
    message.value = Array.isArray(data)
      ? data.map((msg) => ({
          ...msg,
          sections: parseMessageContent(msg.texte),
        }))
      : []
  } catch (error) {
    console.error('Error fetching messages:', error)
    message.value = []
  } finally {
    isLoading.value = false
  }
})

const getStatusColor = (etat) => {
  switch (etat) {
    case 1:
      return 'bg-green-500'
    case 2:
      return 'bg-blue-500'
    case 4:
      return 'bg-yellow-500'
    case 5:
      return 'bg-orange-500'
    case 6:
      return 'bg-red-500'
    default:
      return 'bg-gray-500'
  }
}

const getStatusText = (etat) => {
  switch (etat) {
    case 1:
      return 'Aucune perturbation'
    case 2:
      return 'Information'
    case 4:
      return 'Perturbation prévue'
    case 5:
      return 'Perturbation en cours'
    case 6:
      return 'Circulation interrompue'
    default:
      return 'État inconnu'
  }
}

// Fonction pour parser et structurer le contenu HTML des messages
const parseMessageContent = (htmlContent) => {
  // Créer un élément DOM temporaire pour parser le HTML
  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = htmlContent

  const sections = []
  let currentSection = null

  // Parcourir tous les éléments
  const walker = document.createTreeWalker(
    tempDiv,
    NodeFilter.SHOW_ALL,
    null,
    false
  )

  let node = walker.nextNode()
  while (node) {
    const text = node.textContent?.trim()
    if (!text) {
      node = walker.nextNode()
      continue
    }

    // Détecter les titres de section (mots en gras ou en début de ligne)
    if (node.tagName === 'STRONG' || node.tagName === 'B' ||
        (node.nodeType === Node.TEXT_NODE && text.includes(':') && text.length < 50)) {

      if (currentSection) {
        sections.push(currentSection)
      }

      currentSection = {
        title: text.replace(':', '').trim(),
        items: []
      }
    }
    // Contenu d'information
    else if (node.nodeType === Node.TEXT_NODE && text.length > 10) {
      if (currentSection) {
        // Diviser les lignes multiples
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
</script>

<template>
  <div class="min-h-screen p-4 sm:p-6 lg:p-8 relative">
    <!-- Bouton de retour -->
    <Buttonback />

    <div class="flex flex-col items-center">
      <h1
        class="pt-20 text-2xl sm:text-3xl font-bold text-light-primary dark:text-dark-primary mb-6 text-center"
      >
        Messages d'information
      </h1>

      <!-- Loader -->
      <Loader v-if="isLoading" />

      <!-- Messages -->
      <div v-else-if="message.length" class="w-full max-w-3xl mx-auto space-y-4">
        <div
          v-for="msg in message"
          :key="msg.id"
          class="bg-white dark:bg-dark-secondary rounded-lg shadow-md overflow-hidden"
        >
          <!-- En-tête du message -->
          <div class="p-4 border-b border-light-accent dark:border-dark-accent">
            <div class="flex items-center justify-between mb-4">
              <h2
                class="text-xl font-semibold text-light-primary dark:text-dark-primary"
                v-html="msg.titre"
              ></h2>
              <span
                :class="[
                  getStatusColor(msg.etat),
                  'px-3 py-1 rounded-full text-white text-sm font-medium',
                ]"
              >
                {{ getStatusText(msg.etat) }}
              </span>
            </div>

            <!-- Lignes concernées -->
            <div class="space-y-2">
              <p class="text-sm text-light-text dark:text-dark-text font-medium">Lignes concernées :</p>
              <div class="flex flex-wrap gap-2">
                <span
                  v-for="ligne in msg.lignes"
                  :key="ligne"
                  class="px-2 py-1 text-sm bg-light-accent dark:bg-dark-accent text-light-text dark:text-dark-text rounded"
                >
                  Ligne {{ ligne }}
                </span>
              </div>
            </div>
          </div>

          <!-- Corps du message restructuré -->
          <div class="p-6 space-y-6">
            <!-- Sections parsées -->
            <template v-if="msg.sections.length">
              <div v-for="(section, index) in msg.sections" :key="index" class="space-y-4">

                <!-- Titre de section -->
                <div class="border-l-4 border-blue-500 pl-4 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-r-lg">
                  <h3 class="text-lg font-bold text-light-primary dark:text-dark-primary">
                    {{ section.title }}
                  </h3>
                </div>

                <!-- Items de la section -->
                <div class="space-y-3 ml-2">
                  <div
                    v-for="(item, itemIndex) in section.items"
                    :key="itemIndex"
                    class="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                  >
                    <div class="text-gray-700 dark:text-gray-300 leading-relaxed">
                      {{ item }}
                    </div>
                  </div>
                </div>
              </div>
            </template>

            <!-- Fallback si le parsing ne fonctionne pas -->
            <div v-else class="space-y-4">
              <div class="border-l-4 border-gray-400 pl-4 py-2">
                <h3 class="text-lg font-semibold text-light-primary dark:text-dark-primary mb-4">
                  Informations
                </h3>
              </div>
              <div class="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <div
                  class="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 leading-relaxed"
                  v-html="msg.texte"
                ></div>
              </div>
            </div>

            <!-- Lien vers plus d'informations -->
            <div v-if="msg.url" class="pt-4 border-t border-gray-200 dark:border-gray-700">
              <a
                :href="msg.url"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
              >
                <span>Plus d'informations</span>
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>

      <!-- Aucun message -->
      <div v-else class="text-center text-gray-500 dark:text-gray-400 mt-10">
        Aucun message disponible.
      </div>
    </div>
  </div>
</template>
