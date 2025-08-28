<script setup>
import { ref, onMounted, computed } from 'vue'

import api from '@/api'
import Loader from './loader.vue'

defineOptions({ name: 'PerturbationView' })

// État réactif
const raw = ref([])
const isLoading = ref(true)
const errorMsg = ref('')

// Constantes pour les états
const ETAT_MESSAGES = {
  0: "pas d'info sur l'état.",
  1: 'La ligne fonctionne normalement (aucune perturbation en cours ni prévue)',
  2: 'Il y a une information concernant la ligne (nouveauté, évolution)',
  3: 'La ligne ne fonctionne pas en ce moment, selon sa période de fonctionnement',
  4: 'Une perturbation est prévue dans le futur',
  5: 'Une perturbation est en cours',
  6: 'La circulation de la ligne est interrompue (totalement)',
}

// Mapping des icônes par état
const ETAT_ICONS = {
  1: { src: '/svg/check.svg', alt: 'Ligne normale' },
  2: { src: '/svg/info.svg', alt: 'Information' },
  3: { src: '/svg/cross 1.svg', alt: 'Hors service' },
  4: { src: '/svg/warning 1.svg', alt: 'Perturbation prévue' },
  5: { src: '/svg/warning 2.svg', alt: 'Perturbation en cours' },
  6: { src: '/svg/cross 2.svg', alt: 'Circulation interrompue' },
}

// Fonction pour obtenir le message d'état
const getEtatMessage = (code) => ETAT_MESSAGES[code] || ETAT_MESSAGES[0]

// Fonction optimisée pour normaliser les couleurs hex
const toHexColor = (value, fallback = '#000000') => {
  if (!value) return fallback

  const cleanValue = String(value).replace('#', '').trim()
  if (!/^[0-9a-fA-F]+$/.test(cleanValue)) return fallback

  const hex =
    cleanValue.length === 3
      ? cleanValue
        .split('')
        .map((char) => char.repeat(2))
        .join('')
      : cleanValue.padEnd(6, '0').slice(0, 6)

  return `#${hex.toUpperCase()}`
}

// Computed pour les items transformés
const processedItems = computed(() => {
  if (!Array.isArray(raw.value)) return []

  return raw.value.map((item, index) => ({
    id: item.idLigne ?? item.id ?? index, // garde pour :key
    idLigne: String(item.idLigne ?? item.id ?? index), // <- param de route
    label: item.numLignePublic ?? '',
    bg: toHexColor(item.couleurFond, '#222222'),
    fg: toHexColor(item.couleurTexte, '#FFFFFF'),
    etat: item.etat ?? null,
    etatMessage: getEtatMessage(item.etat),
    icon: ETAT_ICONS[item.etat] || null,
  }))
})


// Computed pour les états de l'interface
const uiState = computed(() => ({
  showLoading: isLoading.value,
  showError: !isLoading.value && errorMsg.value,
  showEmpty: !isLoading.value && !errorMsg.value && processedItems.value.length === 0,
  showContent: !isLoading.value && !errorMsg.value && processedItems.value.length > 0,
}))

// Fonction pour charger les données
const loadData = async () => {
  try {
    isLoading.value = true
    errorMsg.value = ''

    const { data } = await api.get('/etatLignes')
    raw.value = Array.isArray(data) ? data : []
  } catch (error) {
    console.error('Erreur lors du chargement des perturbations:', error)
    errorMsg.value = 'Impossible de récupérer les perturbations.'
  } finally {
    isLoading.value = false
  }
}

// Lifecycle
onMounted(loadData)
</script>

<template>
  <div class="mx-auto w-full max-w-screen-2xl p-4">
    <h1 class="mb-8 text-center text-2xl sm:text-3xl font-bold text-light-primary dark:text-dark-primary">
      Lignes perturbées
    </h1>

    <!-- États de chargement, erreur et vide -->
    <div v-if="uiState.showLoading" class="text-center opacity-70" role="status" aria-live="polite">
      <Loader />
    </div>

    <div v-else-if="uiState.showEmpty" class="text-center opacity-70">
      Aucune donnée disponible.
    </div>

    <!-- Grille des lignes -->
    <div v-else-if="uiState.showContent" class="flex flex-wrap gap-3 justify-center" role="list"
      aria-label="Liste des lignes perturbées">
      <div v-for="item in processedItems" :key="item.id" class="group relative" role="listitem">
        <router-link :to="{ name: 'MessagePage', params: { idLigne: item.idLigne } }">

          <div
            class="w-14 h-14 sm:w-16 sm:h-16 rounded-full shadow-md hover:shadow-lg flex items-center justify-center cursor-pointer transition-all duration-200 hover:scale-105 border border-white/10"
            :style="{ backgroundColor: item.bg, color: item.fg }" :title="`Ligne ${item.label}: ${item.etatMessage}`"
            :aria-label="`Ligne ${item.label}: ${item.etatMessage}`" role="button" tabindex="0">
            <span class="font-bold text-xs sm:text-sm leading-none text-center">
              {{ item.label }}
            </span>
          </div>

          <!-- Icône d'état -->
          <img v-if="item.icon" :src="item.icon.src" alt="" class="absolute z-10 bottom-0 right-0 w-4 h-4 sm:w-5 sm:h-5"
            loading="lazy" />
        </router-link>
      </div>
    </div>
  </div>
</template>
