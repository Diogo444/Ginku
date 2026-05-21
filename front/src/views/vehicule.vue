<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { getDetailsVehicule, getDetailsVehiculeTempsReel } from '@/services/api'
import BackButton from '@/components/BackButton.vue'
import EmptyState from '@/components/EmptyState.vue'
import ErrorState from '@/components/ErrorState.vue'
import Loader from '@/components/loader.vue'
import ThemeToggle from '@/components/ThemeToggle.vue'

defineOptions({ name: 'VehiculePage' })

const route = useRoute()

const details = ref(null)
const realtimeDetails = ref(null)
const loading = ref(false)
const error = ref(null)
const detailsError = ref(null)
const realtimeError = ref(null)
const abortController = ref(null)

const vehicleNumber = computed(() => String(route.params.num || '').trim())
const isValidNumber = computed(() => /^\d{1,8}$/.test(vehicleNumber.value))

const normalizePayload = (payload) => {
  const value = Array.isArray(payload) ? payload[0] : payload
  if (!value || typeof value !== 'object' || Object.keys(value).length === 0) return null
  return value
}

const normalizedDetails = computed(() => {
  const value = normalizePayload(details.value)
  if (!value) return null

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

const normalizedRealtimeDetails = computed(() => {
  const value = normalizePayload(realtimeDetails.value)
  if (!value) return null

  return {
    num: value.num || vehicleNumber.value,
    affluence: value.affluence ?? -1,
    texteAffluence: value.texteAffluence || '',
    nbPassagersABord: value.nbPassagersABord ?? -1,
    tauxDeCharge: value.tauxDeCharge ?? -1,
    position: value.position || ''
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

const affluenceMap = {
  '-2': { label: 'Accès non autorisé', icon: 'lock', color: 'text-gray-500 dark:text-gray-400' },
  '-1': { label: 'Indisponible', icon: 'help_outline', color: 'text-gray-500 dark:text-gray-400' },
  0: { label: 'Faible', icon: 'groups', color: 'text-green-600 dark:text-green-400' },
  1: { label: 'Modérée', icon: 'groups', color: 'text-yellow-600 dark:text-yellow-400' },
  2: { label: 'Forte', icon: 'groups', color: 'text-red-600 dark:text-red-400' }
}

const getProtectedMetricLabel = (value, suffix = '') => {
  if (value === -2) return 'Accès non autorisé'
  if (value === -1 || value == null) return 'Information indisponible'
  return `${value}${suffix}`
}

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

const realtimeCards = computed(() => {
  const realtime = normalizedRealtimeDetails.value
  if (!realtime) return []

  const affluence = affluenceMap[realtime.affluence] || affluenceMap[-1]

  return [
    {
      label: 'Affluence',
      value: affluence.label,
      description: realtime.texteAffluence || null,
      icon: affluence.icon,
      color: affluence.color
    },
    {
      label: 'Passagers à bord',
      value: getProtectedMetricLabel(realtime.nbPassagersABord),
      description: null,
      icon: 'person',
      color: realtime.nbPassagersABord >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'
    },
    {
      label: 'Taux de charge',
      value: getProtectedMetricLabel(realtime.tauxDeCharge, ' %'),
      description: '100 % correspond à un véhicule complet',
      icon: 'speed',
      color: realtime.tauxDeCharge >= 0 ? 'text-primary' : 'text-gray-500 dark:text-gray-400'
    },
    {
      label: 'Position',
      value: realtime.position || 'Position non disponible',
      description: null,
      icon: 'near_me',
      color: realtime.position ? 'text-teal-600 dark:text-teal-400' : 'text-gray-500 dark:text-gray-400',
      wide: true
    }
  ]
})

const hasVehicleInfo = computed(() => Boolean(normalizedDetails.value || normalizedRealtimeDetails.value))
const summaryVehicleNumber = computed(() => normalizedDetails.value?.num || normalizedRealtimeDetails.value?.num || vehicleNumber.value)
const summaryVehicleType = computed(() => normalizedDetails.value?.typeVehicule || 'Bus ou tramway urbain')

async function loadDetails() {
  details.value = null
  realtimeDetails.value = null
  error.value = null
  detailsError.value = null
  realtimeError.value = null

  if (!isValidNumber.value) return

  loading.value = true
  abortController.value?.abort()
  const controller = new AbortController()
  abortController.value = controller

  const [detailsResult, realtimeResult] = await Promise.allSettled([
    getDetailsVehicule(vehicleNumber.value, controller.signal),
    getDetailsVehiculeTempsReel(vehicleNumber.value, controller.signal)
  ])

  if (abortController.value !== controller) return

  if (detailsResult.status === 'fulfilled') {
    details.value = detailsResult.value
  } else if (detailsResult.reason?.code !== 'ERR_CANCELED') {
    console.error('Erreur chargement infos véhicule:', detailsResult.reason)
    detailsError.value = 'Les équipements du véhicule sont indisponibles pour le moment.'
  }

  if (realtimeResult.status === 'fulfilled') {
    realtimeDetails.value = realtimeResult.value
  } else if (realtimeResult.reason?.code !== 'ERR_CANCELED') {
    console.error('Erreur chargement temps réel véhicule:', realtimeResult.reason)
    realtimeError.value = 'Les informations temps réel du véhicule sont indisponibles pour le moment.'
  }

  const allRequestsFailed = detailsResult.status === 'rejected' && realtimeResult.status === 'rejected'
  const allFailuresAreCanceled = [detailsResult, realtimeResult].every((result) => result.reason?.code === 'ERR_CANCELED')

  if (allRequestsFailed && !allFailuresAreCanceled) {
    error.value = 'Impossible de charger les informations du véhicule'
  }

  loading.value = false
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

      <template v-else-if="hasVehicleInfo">
        <section class="bg-surface-light dark:bg-surface-dark rounded-xl sm:rounded-2xl p-4 sm:p-5 shadow-soft dark:shadow-none border border-gray-100 dark:border-gray-800">
          <div class="flex items-center gap-4">
            <div class="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0" aria-hidden="true">
              <span class="material-icons-round text-3xl">{{ vehicleIcon }}</span>
            </div>
            <div class="min-w-0">
              <p class="text-xs font-semibold uppercase tracking-wide text-primary">Véhicule urbain</p>
              <h2 class="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white">
                Véhicule {{ summaryVehicleNumber }}
              </h2>
              <p class="text-sm text-gray-500 dark:text-gray-400 truncate">{{ summaryVehicleType }}</p>
            </div>
          </div>
        </section>

        <section aria-labelledby="vehicle-realtime-title">
          <div class="flex items-center justify-between gap-3 mb-3">
            <h2 id="vehicle-realtime-title" class="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Temps réel</h2>
            <span
              v-if="normalizedRealtimeDetails"
              class="rounded-full bg-green-100 dark:bg-green-900/30 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-line-green border border-green-200 dark:border-green-800"
            >
              Live
            </span>
            <span
              v-else
              class="rounded-full bg-gray-100 dark:bg-gray-800 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700"
            >
              Indisponible
            </span>
          </div>

          <div v-if="normalizedRealtimeDetails" class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <article
              v-for="card in realtimeCards"
              :key="card.label"
              :class="[
                'bg-surface-light dark:bg-surface-dark rounded-xl sm:rounded-2xl p-3.5 sm:p-4 shadow-soft dark:shadow-none border border-gray-100 dark:border-gray-800',
                card.wide ? 'sm:col-span-2' : ''
              ]"
            >
              <div class="flex items-start gap-3">
                <span :class="['material-icons-round text-xl mt-0.5 shrink-0', card.color]" aria-hidden="true">
                  {{ card.icon }}
                </span>
                <div class="min-w-0">
                  <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ card.label }}</h3>
                  <p class="text-sm sm:text-base font-semibold text-gray-900 dark:text-white leading-snug mt-0.5">{{ card.value }}</p>
                  <p v-if="card.description" class="text-xs sm:text-sm text-gray-500 dark:text-gray-400 leading-snug mt-1">{{ card.description }}</p>
                </div>
              </div>
            </article>
          </div>

          <div v-else class="bg-gray-100 dark:bg-gray-800/60 rounded-xl sm:rounded-2xl p-4 border border-gray-200 dark:border-gray-700" role="status">
            <div class="flex gap-3">
              <span class="material-icons-round text-gray-500 dark:text-gray-400 shrink-0" aria-hidden="true">near_me_disabled</span>
              <p class="text-xs sm:text-sm text-gray-600 dark:text-gray-300">
                {{ realtimeError || 'Les informations temps réel ne sont pas disponibles pour ce véhicule actuellement.' }}
              </p>
            </div>
          </div>
        </section>

        <section v-if="normalizedDetails" aria-labelledby="vehicle-details-title">
          <h2 id="vehicle-details-title" class="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3">Équipements</h2>
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

        <aside v-else class="bg-gray-100 dark:bg-gray-800/60 rounded-xl sm:rounded-2xl p-4 border border-gray-200 dark:border-gray-700" role="note">
          <div class="flex gap-3">
            <span class="material-icons-round text-gray-500 dark:text-gray-400 shrink-0" aria-hidden="true">info</span>
            <p class="text-xs sm:text-sm text-gray-600 dark:text-gray-300">
              {{ detailsError || 'Les informations d’équipement ne sont pas disponibles pour ce véhicule.' }}
            </p>
          </div>
        </aside>

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
