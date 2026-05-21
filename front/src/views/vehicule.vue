<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { getDetailsVehicule } from '@/services/api'
import BackButton from '@/components/BackButton.vue'
import EmptyState from '@/components/EmptyState.vue'
import ErrorState from '@/components/ErrorState.vue'
import Loader from '@/components/loader.vue'
import ThemeToggle from '@/components/ThemeToggle.vue'

defineOptions({ name: 'VehiculePage' })

const route = useRoute()

const details = ref(null)
const loading = ref(false)
const error = ref(null)
const abortController = ref(null)

const vehicleNumber = computed(() => String(route.params.num || '').trim())
const isValidNumber = computed(() => /^\d{1,8}$/.test(vehicleNumber.value))

const normalizedDetails = computed(() => {
  const value = Array.isArray(details.value) ? details.value[0] : details.value
  if (!value || typeof value !== 'object' || Object.keys(value).length === 0) return null

  return {
    num: value.num || value.numParc || vehicleNumber.value,
    typeVehicule: value.typeVehicule || 'Information indisponible',
    affichageDynamique: Boolean(value.affichageDynamique),
    annoncesSonores: Boolean(value.annoncesSonores),
    climatisation: Boolean(value.climatisation),
    prisesUSB: Boolean(value.prisesUSB),
    accessibilite: value.accessibilite ?? value.accessiblite ?? 0,
    energie: value.energie ?? 0
  }
})

const accessibiliteMap = {
  0: { label: 'Information indisponible', icon: 'help_outline', color: 'text-gray-500 dark:text-gray-400' },
  1: { label: 'Véhicule accessible', icon: 'accessible', color: 'text-green-600 dark:text-green-400' },
  2: { label: 'Véhicule non accessible', icon: 'not_accessible', color: 'text-red-600 dark:text-red-400' }
}

const energieMap = {
  0: { label: 'Information indisponible', icon: 'help_outline', color: 'text-gray-500 dark:text-gray-400' },
  1: { label: 'Gazole', icon: 'local_gas_station', color: 'text-orange-600 dark:text-orange-400' },
  2: { label: 'Gaz naturel', icon: 'propane_tank', color: 'text-blue-600 dark:text-blue-400' },
  3: { label: 'Hybride électrique + gaz', icon: 'electrical_services', color: 'text-teal-600 dark:text-teal-400' },
  4: { label: 'Électrique', icon: 'bolt', color: 'text-green-600 dark:text-green-400' }
}

const yesNo = (value) => (value ? 'Oui' : 'Non')

const vehicleIcon = computed(() => {
  const type = normalizedDetails.value?.typeVehicule?.toLowerCase() || ''
  return type.includes('tram') ? 'tram' : 'directions_bus'
})

const featureCards = computed(() => {
  const vehicle = normalizedDetails.value
  if (!vehicle) return []

  const accessibilite = accessibiliteMap[vehicle.accessibilite] || accessibiliteMap[0]
  const energie = energieMap[vehicle.energie] || energieMap[0]

  return [
    { label: 'Numéro du véhicule', value: vehicle.num, icon: 'tag', color: 'text-primary' },
    { label: 'Type de véhicule', value: vehicle.typeVehicule, icon: vehicleIcon.value, color: 'text-blue-600 dark:text-blue-400' },
    { label: 'Affichage dynamique', value: yesNo(vehicle.affichageDynamique), icon: 'tv', color: vehicle.affichageDynamique ? 'text-orange-600 dark:text-orange-400' : 'text-gray-500 dark:text-gray-400' },
    { label: 'Annonces sonores', value: yesNo(vehicle.annoncesSonores), icon: 'campaign', color: vehicle.annoncesSonores ? 'text-purple-600 dark:text-purple-400' : 'text-gray-500 dark:text-gray-400' },
    { label: 'Climatisation', value: yesNo(vehicle.climatisation), icon: 'ac_unit', color: vehicle.climatisation ? 'text-cyan-600 dark:text-cyan-400' : 'text-gray-500 dark:text-gray-400' },
    { label: 'Prises USB', value: yesNo(vehicle.prisesUSB), icon: 'usb', color: vehicle.prisesUSB ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400' },
    { label: 'Accessibilité PMR', value: accessibilite.label, icon: accessibilite.icon, color: accessibilite.color },
    { label: 'Énergie utilisée', value: energie.label, icon: energie.icon, color: energie.color }
  ]
})

async function loadDetails() {
  details.value = null
  error.value = null

  if (!isValidNumber.value) return

  loading.value = true
  abortController.value?.abort()
  abortController.value = new AbortController()

  try {
    details.value = await getDetailsVehicule(vehicleNumber.value, abortController.value.signal)
  } catch (e) {
    if (e?.code !== 'ERR_CANCELED') {
      console.error('Erreur chargement véhicule:', e)
      error.value = 'Impossible de charger les informations du véhicule'
    }
  } finally {
    loading.value = false
  }
}

onMounted(loadDetails)
watch(() => route.params.num, loadDetails)

onBeforeUnmount(() => {
  abortController.value?.abort()
})
</script>

<template>
  <div class="flex flex-col min-h-full w-full">
    <header class="sticky top-0 z-50 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 border-b border-gray-100 dark:border-gray-800 transition-colors duration-300">
      <div class="flex items-center gap-3 sm:gap-4">
        <BackButton />
        <div class="flex-grow min-w-0">
          <h1 class="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">Infos véhicule</h1>
          <p class="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">
            Véhicule {{ vehicleNumber || 'inconnu' }}
          </p>
        </div>
        <ThemeToggle />
      </div>
    </header>

    <main class="flex-grow px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6" aria-live="polite">
      <EmptyState
        v-if="!isValidNumber"
        icon="error_outline"
        title="Numéro invalide"
        message="Saisissez uniquement les chiffres du numéro de véhicule."
      >
        <router-link
          :to="{ name: 'home' }"
          class="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-full text-sm font-semibold hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors"
        >
          <span class="material-icons-round text-lg" aria-hidden="true">home</span>
          Retour à l'accueil
        </router-link>
      </EmptyState>

      <Loader v-else-if="loading" />

      <ErrorState v-else-if="error" title="Erreur API" :message="error" @retry="loadDetails" />

      <template v-else-if="normalizedDetails">
        <section class="bg-surface-light dark:bg-surface-dark rounded-xl sm:rounded-2xl p-4 sm:p-5 shadow-soft dark:shadow-none border border-gray-100 dark:border-gray-800">
          <div class="flex items-center gap-4">
            <div class="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0" aria-hidden="true">
              <span class="material-icons-round text-3xl">{{ vehicleIcon }}</span>
            </div>
            <div class="min-w-0">
              <p class="text-xs font-semibold uppercase tracking-wide text-primary">Véhicule urbain</p>
              <h2 class="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white">
                Véhicule {{ normalizedDetails.num }}
              </h2>
              <p class="text-sm text-gray-500 dark:text-gray-400 truncate">{{ normalizedDetails.typeVehicule }}</p>
            </div>
          </div>
        </section>

        <section aria-labelledby="vehicle-details-title">
          <h2 id="vehicle-details-title" class="sr-only">Détails du véhicule</h2>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <article
              v-for="card in featureCards"
              :key="card.label"
              class="bg-surface-light dark:bg-surface-dark rounded-xl sm:rounded-2xl p-3.5 sm:p-4 shadow-soft dark:shadow-none border border-gray-100 dark:border-gray-800"
            >
              <div class="flex items-start gap-3">
                <span :class="['material-icons-round text-xl mt-0.5 shrink-0', card.color]" aria-hidden="true">
                  {{ card.icon }}
                </span>
                <div class="min-w-0">
                  <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ card.label }}</h3>
                  <p class="text-sm sm:text-base font-semibold text-gray-900 dark:text-white leading-snug mt-0.5">{{ card.value }}</p>
                </div>
              </div>
            </article>
          </div>
        </section>

        <aside class="bg-gray-100 dark:bg-gray-800/60 rounded-xl sm:rounded-2xl p-4 border border-gray-200 dark:border-gray-700" role="note">
          <div class="flex gap-3">
            <span class="material-icons-round text-gray-500 dark:text-gray-400 shrink-0" aria-hidden="true">info</span>
            <p class="text-xs sm:text-sm text-gray-600 dark:text-gray-300">
              Ces informations concernent les véhicules urbains du réseau, bus et tramways. Les autocars périurbains ne sont pas compatibles avec cette recherche.
            </p>
          </div>
        </aside>

        <router-link
          :to="{ name: 'home' }"
          class="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-2.5 bg-primary text-white rounded-full text-sm font-semibold hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors"
        >
          <span class="material-icons-round text-lg" aria-hidden="true">home</span>
          Retour à l'accueil
        </router-link>
      </template>

      <EmptyState
        v-else
        icon="directions_bus"
        title="Véhicule introuvable"
        message="Aucune information n'est disponible pour ce numéro. Il peut s'agir d'un véhicule non urbain ou non compatible."
      >
        <router-link
          :to="{ name: 'home' }"
          class="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-full text-sm font-semibold hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors"
        >
          <span class="material-icons-round text-lg" aria-hidden="true">home</span>
          Retour à l'accueil
        </router-link>
      </EmptyState>
    </main>
  </div>
</template>
