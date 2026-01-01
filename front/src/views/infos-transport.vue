<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getDetailsVehicule } from '@/services/api'
import BackButton from '@/components/BackButton.vue'
import Loader from '@/components/loader.vue'
import ErrorState from '@/components/ErrorState.vue'
import ThemeToggle from '@/components/ThemeToggle.vue'

defineOptions({ name: 'InfosTransportPage' })

const route = useRoute()
const router = useRouter()
const details = ref(null)
const loading = ref(true)
const error = ref(null)
const abortController = ref(null)

async function loadDetails() {
  loading.value = true
  error.value = null
  
  abortController.value?.abort()
  abortController.value = new AbortController()
  
  try {
    details.value = await getDetailsVehicule(route.params.id, abortController.value.signal)
  } catch (e) {
    if (e?.code !== 'ERR_CANCELED') {
      console.error('Erreur:', e)
      error.value = 'Impossible de charger les informations du véhicule'
    }
  } finally {
    loading.value = false
  }
}

onMounted(loadDetails)

watch(() => route.params.id, loadDetails)

onBeforeUnmount(() => {
  abortController.value?.abort()
})

function goBack() {
  if (window.history.length > 2) {
    router.back()
  } else {
    router.push({ name: 'home' })
  }
}

// Configuration énergie
const ENERGIE_CONFIG = {
  0: { label: "Pas d'info", icon: 'help', color: 'text-gray-500 dark:text-gray-400', bgColor: 'bg-gray-100 dark:bg-gray-800' },
  1: { label: 'Diesel', icon: 'local_gas_station', color: 'text-gray-700 dark:text-gray-300', bgColor: 'bg-gray-100 dark:bg-gray-800' },
  2: { label: 'GNV', icon: 'propane', color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-100 dark:bg-blue-900/20' },
  3: { label: 'Hybride', icon: 'electrical_services', color: 'text-teal-600 dark:text-teal-400', bgColor: 'bg-teal-100 dark:bg-teal-900/20' },
  4: { label: 'Électrique', icon: 'bolt', color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-100 dark:bg-green-900/20' },
  '-1': { label: 'Indisponible', icon: 'help_outline', color: 'text-gray-500 dark:text-gray-400', bgColor: 'bg-gray-100 dark:bg-gray-800' }
}

// Configuration accessibilité
const ACCESSIBILITE_CONFIG = {
  0: { label: 'Non renseigné', icon: 'help', color: 'text-gray-500 dark:text-gray-400' },
  1: { label: 'Accessible PMR', icon: 'accessible', color: 'text-green-600 dark:text-green-400' },
  2: { label: 'Non accessible', icon: 'not_accessible', color: 'text-red-600 dark:text-red-400' },
  '-1': { label: 'Indisponible', icon: 'help_outline', color: 'text-gray-500 dark:text-gray-400' }
}

// Configuration climatisation
const CLIM_CONFIG = {
  0: { label: 'Non renseigné', icon: 'help', color: 'text-gray-500 dark:text-gray-400' },
  1: { label: 'Climatisé', icon: 'ac_unit', color: 'text-blue-600 dark:text-blue-400' },
  2: { label: 'Non climatisé', icon: 'device_thermostat', color: 'text-orange-600 dark:text-orange-400' },
  '-1': { label: 'Indisponible', icon: 'help_outline', color: 'text-gray-500 dark:text-gray-400' }
}

const energieConfig = computed(() => ENERGIE_CONFIG[details.value?.energie] || ENERGIE_CONFIG[0])
const accessibiliteConfig = computed(() => ACCESSIBILITE_CONFIG[details.value?.accessibilite] || ACCESSIBILITE_CONFIG[0])
const climConfig = computed(() => CLIM_CONFIG[details.value?.climatisation] || CLIM_CONFIG[0])
</script>

<template>
  <div class="flex flex-col min-h-full w-full pb-safe">
    <!-- Header sticky -->
    <header class="sticky top-0 z-50 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md px-6 pt-6 pb-4 border-b border-gray-100 dark:border-gray-800 transition-colors duration-300">
      <div class="flex items-center gap-4">
        <BackButton @click="goBack" />
        <div class="flex-grow">
          <h1 class="text-xl font-bold text-gray-900 dark:text-white">Infos véhicule</h1>
          <p v-if="details" class="text-sm text-gray-500 dark:text-gray-400">
            N° {{ details.numParc || route.params.id }}
          </p>
        </div>
        <ThemeToggle />
      </div>
    </header>
    
    <!-- Contenu -->
    <main class="flex-grow px-6 py-6 space-y-6">
      <!-- Loading -->
      <Loader v-if="loading" />
      
      <!-- Erreur -->
      <ErrorState v-else-if="error" :message="error" @retry="loadDetails" />
      
      <!-- Détails du véhicule -->
      <template v-else-if="details">
        <!-- Icône véhicule -->
        <div class="flex justify-center">
          <div class="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary/20 to-primary/5 dark:from-primary/30 dark:to-primary/10 flex items-center justify-center shadow-soft">
            <span class="material-icons-round text-5xl text-primary">directions_bus</span>
          </div>
        </div>
        
        <!-- Numéro du véhicule -->
        <div class="text-center mb-2">
          <h2 class="text-2xl font-bold text-gray-900 dark:text-white">
            Véhicule n°{{ details.numParc }}
          </h2>
          <p v-if="details.constructeur && details.modele" class="text-sm text-gray-500 dark:text-gray-400">
            {{ details.constructeur }} {{ details.modele }}
          </p>
        </div>
        
        <!-- Grille d'informations principales -->
        <div class="grid grid-cols-2 gap-3">
          <!-- Énergie -->
          <div :class="['p-4 rounded-2xl flex flex-col items-center gap-2', energieConfig.bgColor]">
            <span :class="['material-icons-round text-2xl', energieConfig.color]">
              {{ energieConfig.icon }}
            </span>
            <span class="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Énergie</span>
            <span :class="['text-sm font-bold', energieConfig.color]">{{ energieConfig.label }}</span>
          </div>
          
          <!-- Accessibilité -->
          <div class="p-4 rounded-2xl bg-surface-light dark:bg-surface-dark flex flex-col items-center gap-2 shadow-soft">
            <span :class="['material-icons-round text-2xl', accessibiliteConfig.color]">
              {{ accessibiliteConfig.icon }}
            </span>
            <span class="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Accessibilité</span>
            <span :class="['text-sm font-bold', accessibiliteConfig.color]">{{ accessibiliteConfig.label }}</span>
          </div>
          
          <!-- Climatisation -->
          <div class="p-4 rounded-2xl bg-surface-light dark:bg-surface-dark flex flex-col items-center gap-2 shadow-soft">
            <span :class="['material-icons-round text-2xl', climConfig.color]">
              {{ climConfig.icon }}
            </span>
            <span class="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Climatisation</span>
            <span :class="['text-sm font-bold', climConfig.color]">{{ climConfig.label }}</span>
          </div>
          
          <!-- Longueur -->
          <div v-if="details.longueurVehicule" class="p-4 rounded-2xl bg-surface-light dark:bg-surface-dark flex flex-col items-center gap-2 shadow-soft">
            <span class="material-icons-round text-2xl text-gray-600 dark:text-gray-400">straighten</span>
            <span class="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Longueur</span>
            <span class="text-sm font-bold text-gray-800 dark:text-gray-200">{{ details.longueurVehicule }}</span>
          </div>
        </div>
        
        <!-- Informations détaillées -->
        <div class="bg-surface-light dark:bg-surface-dark rounded-2xl shadow-soft overflow-hidden">
          <div class="px-5 py-3 border-b border-gray-100 dark:border-gray-800">
            <h3 class="font-bold text-gray-900 dark:text-white text-sm uppercase tracking-wide">Détails</h3>
          </div>
          <div class="divide-y divide-gray-100 dark:divide-gray-800">
            <!-- Numéro de parc -->
            <div class="flex justify-between items-center px-5 py-3.5">
              <span class="text-sm text-gray-600 dark:text-gray-400">Numéro de parc</span>
              <span class="font-semibold text-gray-900 dark:text-white">{{ details.numParc }}</span>
            </div>
            
            <!-- Constructeur -->
            <div v-if="details.constructeur" class="flex justify-between items-center px-5 py-3.5">
              <span class="text-sm text-gray-600 dark:text-gray-400">Constructeur</span>
              <span class="font-semibold text-gray-900 dark:text-white">{{ details.constructeur }}</span>
            </div>
            
            <!-- Modèle -->
            <div v-if="details.modele" class="flex justify-between items-center px-5 py-3.5">
              <span class="text-sm text-gray-600 dark:text-gray-400">Modèle</span>
              <span class="font-semibold text-gray-900 dark:text-white">{{ details.modele }}</span>
            </div>
            
            <!-- Longueur -->
            <div v-if="details.longueurVehicule" class="flex justify-between items-center px-5 py-3.5">
              <span class="text-sm text-gray-600 dark:text-gray-400">Longueur</span>
              <span class="font-semibold text-gray-900 dark:text-white">{{ details.longueurVehicule }}</span>
            </div>
            
            <!-- Date mise en service -->
            <div v-if="details.dateMiseService" class="flex justify-between items-center px-5 py-3.5">
              <span class="text-sm text-gray-600 dark:text-gray-400">Mise en service</span>
              <span class="font-semibold text-gray-900 dark:text-white">{{ details.dateMiseService }}</span>
            </div>
          </div>
        </div>
        
        <!-- Légende accessibilité -->
        <div v-if="details.accessibilite === 1" class="bg-green-50 dark:bg-green-900/10 rounded-2xl p-4">
          <div class="flex items-start gap-3">
            <span class="material-icons-round text-green-600 dark:text-green-400 text-xl flex-shrink-0">info</span>
            <p class="text-sm text-green-800 dark:text-green-200">
              Ce véhicule est équipé d'une rampe d'accès et d'emplacements réservés aux personnes à mobilité réduite.
            </p>
          </div>
        </div>
      </template>
      
      <!-- Véhicule non trouvé -->
      <div v-else class="text-center py-16">
        <div class="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
          <span class="material-icons-round text-3xl text-gray-400">directions_bus</span>
        </div>
        <p class="text-lg font-semibold text-gray-700 dark:text-gray-300">Véhicule introuvable</p>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Aucune information disponible pour ce véhicule</p>
      </div>
    </main>
  </div>
</template>
