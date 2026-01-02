<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { getDetailsVehicule } from '@/services/api'
import Loader from '@/components/loader.vue'

defineOptions({ name: 'VehicleModal' })

const props = defineProps({
  show: Boolean,
  numVehicule: [String, Number]
})

const emit = defineEmits(['close'])

const details = ref(null)
const loading = ref(false)
const error = ref(null)

// Chargement des données véhicule
const loadDetails = async () => {
  if (!props.numVehicule) return
  
  loading.value = true
  error.value = null
  
  try {
    details.value = await getDetailsVehicule(props.numVehicule)
  } catch (e) {
    console.error('Erreur chargement véhicule:', e)
    error.value = 'Impossible de charger les informations'
  } finally {
    loading.value = false
  }
}

watch(() => props.numVehicule, loadDetails, { immediate: true })

// Fermeture avec Escape
const handleKeydown = (e) => {
  if (e.key === 'Escape' && props.show) {
    emit('close')
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeydown)
})

// Helpers pour le texte
const getEnergieInfo = (code) => {
  const map = {
    0: { text: 'Non renseigné', icon: 'help_outline', color: 'text-gray-500' },
    1: { text: 'Gazole', icon: 'local_gas_station', color: 'text-orange-500' },
    2: { text: 'Gaz naturel', icon: 'propane_tank', color: 'text-blue-500' },
    3: { text: 'Hybride', icon: 'bolt', color: 'text-cyan-500' },
    4: { text: 'Électrique', icon: 'flash_on', color: 'text-green-500' },
    '-1': { text: 'Non disponible', icon: 'help_outline', color: 'text-gray-400' }
  }
  return map[code] || map[0]
}

const getAccessibiliteInfo = (code) => {
  const map = {
    0: { text: 'Non renseigné', icon: 'accessible', color: 'text-gray-500' },
    1: { text: 'Accessible fauteuil roulant', icon: 'accessible', color: 'text-blue-500' },
    2: { text: 'Non accessible', icon: 'not_accessible', color: 'text-red-500' },
    '-1': { text: 'Non disponible', icon: 'help_outline', color: 'text-gray-400' }
  }
  return map[code] || map[0]
}

const features = computed(() => {
  if (!details.value) return []
  
  const energieInfo = getEnergieInfo(details.value.energie)
  const accessInfo = getAccessibiliteInfo(details.value.accessiblite)
  
  return [
    {
      label: 'Énergie',
      value: energieInfo.text,
      icon: energieInfo.icon,
      color: energieInfo.color
    },
    {
      label: 'Accessibilité',
      value: accessInfo.text,
      icon: accessInfo.icon,
      color: accessInfo.color
    },
    {
      label: 'Affichage dynamique',
      value: details.value.affichageDynamique ? 'Oui' : 'Non',
      icon: 'tv',
      color: details.value.affichageDynamique ? 'text-orange-500' : 'text-gray-400'
    },
    {
      label: 'Annonces sonores',
      value: details.value.annoncesSonores ? 'Oui' : 'Non',
      icon: 'campaign',
      color: details.value.annoncesSonores ? 'text-purple-500' : 'text-gray-400'
    },
    {
      label: 'Climatisation',
      value: details.value.climatisation ? 'Oui' : 'Non',
      icon: 'ac_unit',
      color: details.value.climatisation ? 'text-cyan-500' : 'text-gray-400'
    },
    {
      label: 'Prises USB',
      value: details.value.prisesUSB ? 'Oui' : 'Non',
      icon: 'usb',
      color: details.value.prisesUSB ? 'text-green-500' : 'text-gray-400'
    }
  ]
})

const vehicleTypeIcon = computed(() => {
  const type = details.value?.typeVehicule?.toLowerCase() || ''
  if (type.includes('tramway')) return 'tram'
  if (type.includes('articulé')) return 'airport_shuttle'
  return 'directions_bus'
})
</script>

<template>
  <Teleport to="body">
    <!-- Backdrop -->
    <Transition name="backdrop">
      <div 
        v-if="show"
        class="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
        @click="emit('close')"
      ></div>
    </Transition>
    
    <!-- Modal -->
    <Transition name="modal">
      <div 
        v-if="show"
        class="fixed inset-x-0 bottom-0 z-[101] flex items-end justify-center sm:items-center sm:inset-0 p-0 sm:p-4"
      >
        <div 
          class="relative w-full sm:w-[24rem] bg-surface-light dark:bg-surface-dark rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] border-t border-white/10"
          @click.stop
          role="dialog"
          aria-modal="true"
          aria-labelledby="vehicle-modal-title"
        >
          <!-- Drag handle -->
          <div class="w-full flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing sm:hidden">
            <div class="w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
          </div>
          
          <!-- Header -->
          <div class="px-6 pb-2 pt-1 flex items-start justify-between">
            <div>
              <p class="text-xs font-bold text-primary uppercase tracking-widest mb-1" aria-hidden="true">Détails</p>
              <h2 id="vehicle-modal-title" class="text-2xl font-bold text-gray-900 dark:text-white">
                Véhicule n° {{ numVehicule }}
              </h2>
            </div>
            <button 
              @click="emit('close')"
              class="w-8 h-8 -mr-2 flex items-center justify-center rounded-full text-gray-400 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Fermer la fenêtre de détails du véhicule"
            >
              <span class="material-icons-round text-2xl" aria-hidden="true">close</span>
            </button>
          </div>
          
          <!-- Content -->
          <div class="px-6 py-6 overflow-y-auto no-scrollbar pb-10">
            <!-- Loading -->
            <Loader v-if="loading" :centered="true" />
            
            <!-- Error -->
            <div v-else-if="error" class="text-center text-red-500 py-8">
              {{ error }}
            </div>
            
            <!-- Details -->
            <template v-else-if="details">
              <!-- Type de véhicule -->
              <div class="mb-6 p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/50 flex items-center gap-4 border border-gray-100 dark:border-gray-700/50">
                <div class="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-300 shrink-0" aria-hidden="true">
                  <span class="material-icons-round text-2xl">{{ vehicleTypeIcon }}</span>
                </div>
                <div>
                  <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Type de véhicule</p>
                  <p class="text-base font-bold text-gray-900 dark:text-white mt-0.5">
                    {{ details.typeVehicule || 'Non renseigné' }}
                  </p>
                </div>
              </div>
              
              <!-- Features grid -->
              <div class="grid grid-cols-2 gap-3">
                <div 
                  v-for="feature in features" 
                  :key="feature.label"
                  class="p-3.5 rounded-2xl border border-gray-100 dark:border-gray-700/50 bg-white dark:bg-surface-dark hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors shadow-sm dark:shadow-none"
                  :class="{ 'opacity-60': feature.value === 'Non' || feature.value.includes('Non') }"
                >
                  <div class="flex items-center gap-2 mb-2">
                    <span :class="['material-icons-round text-lg', feature.color]" aria-hidden="true">{{ feature.icon }}</span>
                    <span class="text-xs font-bold text-gray-400 dark:text-gray-500">{{ feature.label }}</span>
                  </div>
                  <p class="text-sm font-bold text-gray-900 dark:text-white leading-tight">{{ feature.value }}</p>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* Animation de la modale (bas vers haut) */
.modal-enter-active {
  animation: slideUp 0.3s ease-out;
}
.modal-leave-active {
  animation: slideDown 0.2s ease-in;
}

@keyframes slideUp {
  from {
    transform: translateY(100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

@keyframes slideDown {
  from {
    transform: translateY(0);
    opacity: 1;
  }
  to {
    transform: translateY(100%);
    opacity: 0;
  }
}

/* Backdrop fade */
.backdrop-enter-active,
.backdrop-leave-active {
  transition: opacity 0.3s ease;
}
.backdrop-enter-from,
.backdrop-leave-to {
  opacity: 0;
}
</style>
