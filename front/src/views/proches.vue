<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { getArretsProches, getTempsArret } from '@/services/api'
import ThemeToggle from '@/components/ThemeToggle.vue'
import LineBadge from '@/components/LineBadge.vue'
import Loader from '@/components/loader.vue'
import ErrorState from '@/components/ErrorState.vue'
import AdBanner from '@/components/AdBanner.vue'

defineOptions({ name: 'NearbyStopsPage' })

const MAX_VISIBLE_STOPS = 5
const MAX_GROUPS_PER_STOP = 3
const MAX_PASSAGES_PER_GROUP = 2
const REFRESH_INTERVAL_MS = 20 * 1000
const MOVEMENT_THRESHOLD_METERS = 75

const loading = ref(true)
const refreshingStops = ref(false)
const error = ref(null)
const nearbyStops = ref([])
const userPosition = ref(null)
const permissionState = ref('pending')
const statusMessage = ref('Recherche de votre position…')
const liveAnnouncement = ref('Recherche de votre position…')
const isPageVisible = ref(typeof document === 'undefined' ? true : document.visibilityState === 'visible')
const lastUpdatedAt = ref(null)

const geolocationWatchId = ref(null)
const nearbyAbortController = ref(null)
let timesBatchId = 0
let refreshTimerId = null
let announcementTimerId = null
const activeTimesControllers = new Set()

const timeFormatter = new Intl.DateTimeFormat('fr-FR', {
  hour: '2-digit',
  minute: '2-digit',
})

function announce(message) {
  if (announcementTimerId) {
    clearTimeout(announcementTimerId)
  }

  liveAnnouncement.value = ''
  announcementTimerId = window.setTimeout(() => {
    liveAnnouncement.value = message
  }, 40)
}

function toRadians(value) {
  return (value * Math.PI) / 180
}

function calculateDistanceMeters(fromLat, fromLon, toLat, toLon) {
  const earthRadius = 6371e3
  const deltaLat = toRadians(toLat - fromLat)
  const deltaLon = toRadians(toLon - fromLon)
  const lat1 = toRadians(fromLat)
  const lat2 = toRadians(toLat)

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2)

  return Math.round(earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))
}

function formatDistance(distanceMeters) {
  if (!Number.isFinite(distanceMeters)) return null
  if (distanceMeters < 1000) return `${distanceMeters} m`
  return `${(distanceMeters / 1000).toFixed(1).replace('.', ',')} km`
}

function formatLastUpdated(date) {
  return date ? timeFormatter.format(date) : null
}

function stopLocationTracking() {
  if (geolocationWatchId.value != null && navigator.geolocation) {
    navigator.geolocation.clearWatch(geolocationWatchId.value)
    geolocationWatchId.value = null
  }
}

function stopRefreshTimer() {
  if (refreshTimerId) {
    clearInterval(refreshTimerId)
    refreshTimerId = null
  }
}

function abortTimesRequests() {
  for (const controller of activeTimesControllers) {
    controller.abort()
  }
  activeTimesControllers.clear()
}

function cleanupPendingRequests() {
  nearbyAbortController.value?.abort()
  nearbyAbortController.value = null
  abortTimesRequests()
}

function createTimesController() {
  const controller = new AbortController()
  activeTimesControllers.add(controller)
  controller.signal.addEventListener(
    'abort',
    () => {
      activeTimesControllers.delete(controller)
    },
    { once: true },
  )
  return controller
}

function startRefreshTimer() {
  if (refreshTimerId || !isPageVisible.value) return

  refreshTimerId = window.setInterval(() => {
    refreshStopTimes({ silent: true })
  }, REFRESH_INTERVAL_MS)
}

function buildMapsUrl(stop) {
  if (!Number.isFinite(stop.latitude) || !Number.isFinite(stop.longitude)) return '#'
  return `https://www.google.com/maps/dir/?api=1&destination=${stop.latitude},${stop.longitude}`
}

function formatPassage(passage) {
  if (!passage) return { text: '--', isClose: false }

  if (passage.typeDeTemps === 0 && Number.isFinite(passage.tempsEnSeconde)) {
    if (passage.tempsEnSeconde <= 60) {
      return { text: 'À l’approche', isClose: true }
    }

    if (passage.tempsEnSeconde <= 120) {
      return { text: passage.temps || '2 min', isClose: true }
    }
  }

  return {
    text: passage.temps || '--',
    isClose: false,
  }
}

function groupStopTimes(payload) {
  const source = Array.isArray(payload?.listeTemps) ? payload.listeTemps : []
  const groups = new Map()

  for (const item of source) {
    const key = [
      item.idLigne,
      item.destination,
      item.precisionDestination || '',
      item.sensAller ? '1' : '0',
    ].join('|')

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        idLigne: item.idLigne,
        numLignePublic: item.numLignePublic,
        couleurFond: item.couleurFond,
        couleurTexte: item.couleurTexte,
        destination: item.destination,
        precisionDestination: item.precisionDestination,
        modeTransport: item.modeTransport,
        passages: [],
        hasTheoreticalPassage: false,
      })
    }

    const group = groups.get(key)
    group.hasTheoreticalPassage = group.hasTheoreticalPassage || item.fiable === false

    if (group.passages.length < MAX_PASSAGES_PER_GROUP) {
      group.passages.push({
        key: `${key}-${group.passages.length}`,
        ...formatPassage(item),
        isTheoretical: item.fiable === false,
      })
    }
  }

  return Array.from(groups.values()).slice(0, MAX_GROUPS_PER_STOP)
}

async function runWithConcurrency(items, limit, worker) {
  const queue = [...items]
  const runners = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length) {
      const nextItem = queue.shift()
      if (!nextItem) return
      await worker(nextItem)
    }
  })

  await Promise.all(runners)
}

function syncStopDistances(position) {
  nearbyStops.value = nearbyStops.value.map((stop) => ({
    ...stop,
    distanceMeters: Number.isFinite(stop.latitude) && Number.isFinite(stop.longitude)
      ? calculateDistanceMeters(position.latitude, position.longitude, stop.latitude, stop.longitude)
      : null,
  }))
}

async function refreshStopTimes({ silent = false } = {}) {
  if (!nearbyStops.value.length) return

  const currentBatchId = ++timesBatchId
  abortTimesRequests()

  const stopIds = new Set(nearbyStops.value.map((stop) => stop.id))
  nearbyStops.value = nearbyStops.value.map((stop) => ({
    ...stop,
    timesLoading: !stop.groups?.length,
    timesRefreshing: Boolean(stop.groups?.length),
    timesError: null,
  }))

  const updates = new Map()

  await runWithConcurrency(nearbyStops.value, 3, async (stop) => {
    const controller = createTimesController()

    try {
      const data = await getTempsArret(stop.id, controller.signal)
      updates.set(stop.id, {
        groups: groupStopTimes(data),
        exactName: data?.nomExact || stop.exactName || stop.nom,
        timesError: null,
      })
    } catch (requestError) {
      if (requestError?.code === 'ERR_CANCELED') return

      updates.set(stop.id, {
        groups: stop.groups || [],
        exactName: stop.exactName || stop.nom,
        timesError: 'Impossible de charger les horaires en direct.',
      })
    } finally {
      activeTimesControllers.delete(controller)
    }
  })

  if (currentBatchId !== timesBatchId) return

  nearbyStops.value = nearbyStops.value.map((stop) => {
    if (!stopIds.has(stop.id)) return stop

    const next = updates.get(stop.id)
    return {
      ...stop,
      groups: next?.groups ?? stop.groups ?? [],
      exactName: next?.exactName ?? stop.exactName ?? stop.nom,
      timesError: next?.timesError ?? null,
      timesLoading: false,
      timesRefreshing: false,
    }
  })

  lastUpdatedAt.value = new Date()

  if (!silent) {
    announce('Horaires des arrêts proches actualisés.')
  }
}

function buildStopsList(rawStops, position) {
  const previousStops = new Map(nearbyStops.value.map((stop) => [stop.id, stop]))

  return rawStops.slice(0, MAX_VISIBLE_STOPS).map((stop) => {
    const previous = previousStops.get(stop.id)

    return {
      ...stop,
      exactName: previous?.exactName || stop.nom,
      distanceMeters: Number.isFinite(stop.latitude) && Number.isFinite(stop.longitude)
        ? calculateDistanceMeters(position.latitude, position.longitude, stop.latitude, stop.longitude)
        : null,
      groups: previous?.groups || [],
      timesError: previous?.timesError || null,
      timesLoading: previous?.timesLoading || false,
      timesRefreshing: false,
    }
  })
}

async function fetchNearbyStops(position, { silent = false } = {}) {
  if (!position) return

  nearbyAbortController.value?.abort()
  abortTimesRequests()

  const controller = new AbortController()
  nearbyAbortController.value = controller

  if (!nearbyStops.value.length) {
    loading.value = true
  } else {
    refreshingStops.value = true
  }

  error.value = null
  statusMessage.value = 'Recherche des arrêts proches…'

  try {
    const data = await getArretsProches(position.latitude, position.longitude, controller.signal)
    const nextStops = buildStopsList(Array.isArray(data) ? data : [], position)

    nearbyStops.value = nextStops
    statusMessage.value = nextStops.length
      ? `${nextStops.length} arrêt${nextStops.length > 1 ? 's' : ''} proche${nextStops.length > 1 ? 's' : ''} trouvé${nextStops.length > 1 ? 's' : ''}`
      : 'Aucun arrêt trouvé dans un rayon proche'

    if (!silent) {
      announce(statusMessage.value)
    }

    await refreshStopTimes({ silent: true })
  } catch (requestError) {
    if (requestError?.code === 'ERR_CANCELED') return

    console.error('Erreur arrêts proches:', requestError)
    error.value = 'Impossible de récupérer les arrêts proches pour le moment.'
    statusMessage.value = error.value
    announce(error.value)
  } finally {
    if (nearbyAbortController.value === controller) {
      nearbyAbortController.value = null
    }

    loading.value = false
    refreshingStops.value = false
  }
}

function handlePositionSuccess(position) {
  const nextPosition = {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy,
  }

  const previousPosition = userPosition.value
  userPosition.value = nextPosition
  permissionState.value = 'ready'

  if (previousPosition) {
    syncStopDistances(nextPosition)
  }

  const movedEnough =
    !previousPosition ||
    calculateDistanceMeters(
      previousPosition.latitude,
      previousPosition.longitude,
      nextPosition.latitude,
      nextPosition.longitude,
    ) >= MOVEMENT_THRESHOLD_METERS

  if (movedEnough || !nearbyStops.value.length) {
    fetchNearbyStops(nextPosition, { silent: Boolean(previousPosition) })
  }
}

function handlePositionError(geoError) {
  loading.value = false
  stopLocationTracking()
  stopRefreshTimer()

  if (geoError?.code === 1) {
    permissionState.value = 'denied'
    error.value = null
    statusMessage.value = 'Accès à la géolocalisation refusé'
    announce(statusMessage.value)
    return
  }

  permissionState.value = 'error'
  error.value = 'Impossible de récupérer votre position.'
  statusMessage.value = error.value
  announce(error.value)
}

function startLocationTracking() {
  if (!navigator.geolocation || geolocationWatchId.value != null) return

  if (!userPosition.value) {
    permissionState.value = 'pending'
    statusMessage.value = 'Recherche de votre position…'
  }

  geolocationWatchId.value = navigator.geolocation.watchPosition(
    handlePositionSuccess,
    handlePositionError,
    {
      enableHighAccuracy: false,
      maximumAge: 30 * 1000,
      timeout: 10 * 1000,
    },
  )
}

function requestCurrentPosition() {
  if (!navigator.geolocation) return

  navigator.geolocation.getCurrentPosition(handlePositionSuccess, handlePositionError, {
    enableHighAccuracy: false,
    maximumAge: 15 * 1000,
    timeout: 10 * 1000,
  })
}

function syncLiveProcesses() {
  if (isPageVisible.value) {
    startLocationTracking()
    startRefreshTimer()
    return
  }

  stopLocationTracking()
  stopRefreshTimer()
}

function handleManualRefresh() {
  if (userPosition.value) {
    fetchNearbyStops(userPosition.value)
    return
  }

  loading.value = true
  error.value = null
  permissionState.value = 'pending'
  statusMessage.value = 'Recherche de votre position…'
  requestCurrentPosition()
  syncLiveProcesses()
}

function handleVisibilityChange() {
  isPageVisible.value = document.visibilityState === 'visible'
}

const locationSummary = computed(() => {
  if (permissionState.value === 'pending') {
    return 'Nous ne lisons votre position que dans cet onglet et nous arrêtons le suivi dès que vous le quittez.'
  }

  if (permissionState.value === 'ready' && userPosition.value?.accuracy) {
    return `Précision estimée : ${Math.round(userPosition.value.accuracy)} m. Les horaires se mettent à jour sans relire toute la liste au lecteur d’écran.`
  }

  if (permissionState.value === 'denied') {
    return 'Activez la géolocalisation dans votre navigateur pour voir les arrêts autour de vous.'
  }

  return 'Vous pouvez toujours actualiser manuellement ou revenir à la recherche classique.'
})

const lastUpdatedLabel = computed(() => formatLastUpdated(lastUpdatedAt.value))

watch(isPageVisible, (visible) => {
  syncLiveProcesses()

  if (visible && userPosition.value) {
    refreshStopTimes({ silent: true })
  }
})

onMounted(() => {
  if (!navigator.geolocation) {
    permissionState.value = 'unsupported'
    loading.value = false
    statusMessage.value = 'La géolocalisation n’est pas disponible sur cet appareil.'
    announce(statusMessage.value)
    return
  }

  document.addEventListener('visibilitychange', handleVisibilityChange)
  syncLiveProcesses()
})

onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  stopLocationTracking()
  stopRefreshTimer()
  cleanupPendingRequests()

  if (announcementTimerId) {
    clearTimeout(announcementTimerId)
  }
})
</script>

<template>
  <div class="flex min-h-full w-full flex-col">
    <header class="sticky top-0 z-50 border-b border-gray-200 bg-background-light/95 px-4 pb-4 pt-4 backdrop-blur-md transition-colors duration-300 dark:border-gray-800 dark:bg-background-dark/95 sm:px-6 sm:pt-6">
      <div class="flex items-start justify-between gap-4">
        <div class="min-w-0">
          <span class="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary dark:bg-primary/15 dark:text-primary">
            <span class="material-icons-round text-sm" aria-hidden="true">near_me</span>
            Autour de vous
          </span>
          <h1 class="mt-3 text-2xl font-semibold text-gray-900 dark:text-white sm:text-3xl">Arrêts proches</h1>
          <p class="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400 sm:text-[15px]">
            Consultez les arrêts autour de vous, les prochains passages exacts et un itinéraire rapide vers l’arrêt choisi.
          </p>
        </div>

        <ThemeToggle />
      </div>

      <div class="mt-4 flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
        <span class="font-medium text-gray-900 dark:text-gray-100">{{ statusMessage }}</span>
        <span
          v-if="refreshingStops"
          class="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300"
        >
          <span class="material-icons-round animate-spin text-sm" aria-hidden="true">sync</span>
          Actualisation
        </span>
        <span
          v-else-if="permissionState === 'ready'"
          class="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-[11px] font-semibold text-green-700 dark:bg-green-950/40 dark:text-green-300"
        >
          <span class="live-dot" aria-hidden="true"></span>
          Temps réel actif
        </span>
        <span
          v-if="lastUpdatedLabel"
          class="text-[11px] font-medium text-gray-500 dark:text-gray-400"
        >
          Mise à jour {{ lastUpdatedLabel }}
        </span>
      </div>

      <p class="mt-2 max-w-2xl text-xs leading-relaxed text-gray-600 dark:text-gray-300 sm:text-sm">
        {{ locationSummary }}
      </p>

      <p class="sr-only" aria-live="polite">{{ liveAnnouncement }}</p>
    </header>

    <main class="flex-grow space-y-4 px-4 pb-8 pt-4 sm:px-6 sm:pt-6">
      <Loader v-if="loading && !nearbyStops.length" />

      <ErrorState
        v-else-if="error && !nearbyStops.length"
        :message="error"
        @retry="handleManualRefresh"
      />

      <section
        v-else-if="permissionState === 'unsupported'"
        class="rounded-3xl border border-gray-200 bg-surface-light p-4 shadow-soft dark:border-gray-800 dark:bg-surface-dark dark:shadow-none"
      >
        <div class="flex items-start gap-3">
          <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
            <span class="material-icons-round text-xl" aria-hidden="true">location_off</span>
          </div>
          <div>
            <h2 class="text-base font-semibold text-gray-900 dark:text-white">Géolocalisation indisponible</h2>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Votre appareil ou votre navigateur ne permet pas d’utiliser cette fonctionnalité.
            </p>
          </div>
        </div>
      </section>

      <section
        v-else-if="permissionState === 'denied' && !nearbyStops.length"
        class="rounded-3xl border border-primary/15 bg-surface-light p-4 shadow-soft dark:border-primary/20 dark:bg-surface-dark dark:shadow-none"
      >
        <div class="flex items-start gap-3">
          <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary dark:bg-primary/15 dark:text-primary">
            <span class="material-icons-round text-xl" aria-hidden="true">location_disabled</span>
          </div>
          <div class="min-w-0 flex-1">
            <h2 class="text-base font-semibold text-gray-900 dark:text-white">Localisation non autorisée</h2>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Autorise la localisation pour afficher les arrêts autour de toi.
            </p>
          </div>
        </div>

        <div class="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            class="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
            @click="handleManualRefresh"
          >
            Autoriser la localisation
          </button>
        </div>
      </section>

      <section
        v-else-if="!loading && !nearbyStops.length"
        class="rounded-3xl border border-dashed border-gray-200 bg-surface-light p-4 dark:border-gray-700 dark:bg-surface-dark"
      >
        <div class="flex items-start gap-3">
          <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
            <span class="material-icons-round text-xl" aria-hidden="true">explore_off</span>
          </div>
          <div class="min-w-0 flex-1">
            <h2 class="text-base font-semibold text-gray-900 dark:text-white">Aucun arrêt trouvé</h2>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Aucun arrêt n’a été trouvé juste autour de vous pour le moment.
            </p>
          </div>
        </div>

        <div class="mt-4">
          <button
            type="button"
            class="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
            @click="handleManualRefresh"
          >
            Réessayer
          </button>
        </div>
      </section>

      <section v-else class="space-y-4">
        <article
          v-for="stop in nearbyStops"
          :key="stop.id"
          class="overflow-hidden rounded-3xl border border-gray-100 bg-surface-light shadow-soft transition-colors dark:border-gray-800 dark:bg-surface-dark dark:shadow-none"
        >
          <div class="border-b border-gray-100 px-4 py-4 dark:border-gray-800 sm:px-5">
            <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
                    {{ stop.exactName || stop.nom }}
                  </h2>
                  <span
                    v-if="stop.distanceMeters != null"
                    class="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                  >
                    <span class="material-icons-round text-sm" aria-hidden="true">near_me</span>
                    {{ formatDistance(stop.distanceMeters) }}
                  </span>
                  <span
                    v-if="stop.accessibilite === 1"
                    class="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-[11px] font-semibold text-green-700 dark:bg-green-950/40 dark:text-green-300"
                  >
                    <span class="material-icons-round text-sm" aria-hidden="true">accessible</span>
                    Accessible
                  </span>
                </div>

                <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Arrêt exact détecté autour de votre position. Les horaires affichés concernent ce quai précis.
                </p>
              </div>

              <div class="flex flex-wrap gap-2">
                <router-link
                  :to="{ name: 'ArretNomView', params: { nom: stop.nom } }"
                  class="inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 transition-colors hover:border-primary hover:text-primary dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-100 dark:hover:border-primary dark:hover:text-primary"
                >
                  <span class="material-icons-round text-lg" aria-hidden="true">schedule</span>
                  Voir l’arrêt
                </router-link>

                <a
                  :href="buildMapsUrl(stop)"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
                  :aria-label="`Ouvrir l’itinéraire vers ${stop.exactName || stop.nom}`"
                >
                  <span class="material-icons-round text-lg" aria-hidden="true">directions</span>
                  Y aller
                </a>
              </div>
            </div>
          </div>

          <div class="px-4 py-4 sm:px-5">
            <div
              v-if="stop.timesLoading && !stop.groups.length"
              class="rounded-2xl border border-dashed border-gray-200 px-4 py-5 dark:border-gray-700"
            >
              <Loader size="sm" />
            </div>

            <div
              v-else-if="stop.timesError && !stop.groups.length"
              class="rounded-2xl border border-red-100 bg-red-50/70 px-4 py-4 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300"
              role="status"
            >
              {{ stop.timesError }}
            </div>

            <div v-else-if="stop.groups.length" class="space-y-3">
              <div
                v-if="stop.timesRefreshing"
                class="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-[11px] font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                role="status"
              >
                <span class="material-icons-round text-sm animate-spin" aria-hidden="true">sync</span>
                Mise à jour des passages…
              </div>

              <div
                v-for="group in stop.groups"
                :key="group.key"
                class="rounded-2xl border border-gray-100 bg-gray-50/80 p-3 dark:border-gray-800 dark:bg-gray-900/30"
              >
                <div class="flex items-start gap-3">
                  <LineBadge
                    :num="group.numLignePublic || '?'"
                    :couleur-fond="group.couleurFond"
                    :couleur-texte="group.couleurTexte"
                    size="sm"
                  />

                  <div class="min-w-0 flex-1">
                    <div class="flex flex-wrap items-center gap-2">
                      <p class="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900 dark:text-white sm:text-[15px]">
                        {{ group.destination }}
                      </p>
                      <span
                        v-if="group.modeTransport === 1"
                        class="rounded-full bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:bg-gray-800 dark:text-gray-300"
                      >
                        Tram
                      </span>
                      <span
                        v-else
                        class="rounded-full bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:bg-gray-800 dark:text-gray-300"
                      >
                        Bus
                      </span>
                    </div>

                    <p
                      v-if="group.precisionDestination"
                      class="mt-0.5 text-xs text-gray-500 dark:text-gray-400"
                    >
                      {{ group.precisionDestination }}
                    </p>

                    <div class="mt-3 flex flex-wrap gap-2">
                      <span
                        v-for="passage in group.passages"
                        :key="passage.key"
                        :class="[
                          'inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-semibold',
                          passage.isClose
                            ? 'border-green-200 bg-green-100 text-green-800 dark:border-green-800 dark:bg-green-900/30 dark:text-green-300'
                            : 'border-gray-200 bg-white text-gray-800 dark:border-gray-700 dark:bg-surface-dark dark:text-gray-100'
                        ]"
                      >
                        <span v-if="passage.isClose" class="live-dot" aria-hidden="true"></span>
                        {{ passage.text }}
                        <span
                          v-if="passage.isTheoretical"
                          class="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                        >
                          Théorique
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <p
                v-if="stop.timesError && stop.groups.length"
                class="text-xs text-gray-500 dark:text-gray-400"
              >
                {{ stop.timesError }}
              </p>
            </div>

            <div
              v-else
              class="rounded-2xl border border-dashed border-gray-200 px-4 py-4 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400"
            >
              Aucun passage proche n’est disponible pour cet arrêt pour le moment.
            </div>
          </div>
        </article>
      </section>

      <section v-if="!loading" class="mt-4 opacity-90">
        <AdBanner ad-slot="8034263336" />
      </section>
    </main>
  </div>
</template>
