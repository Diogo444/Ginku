import { Capacitor } from '@capacitor/core'
import { Geolocation } from '@capacitor/geolocation'
import { ref } from 'vue'

const GEOLOCATION_OPTIONS = {
  enableHighAccuracy: false,
  maximumAge: 30 * 1000,
  timeout: 10 * 1000,
}

const CURRENT_POSITION_OPTIONS = {
  ...GEOLOCATION_OPTIONS,
  maximumAge: 15 * 1000,
}

function isGeolocationSupported() {
  if (Capacitor.isNativePlatform()) {
    return Capacitor.isPluginAvailable('Geolocation')
  }

  return typeof navigator !== 'undefined' && Boolean(navigator.geolocation)
}

function normalizePosition(position) {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy,
  }
}

function normalizeError(geoError) {
  if (geoError?.code === 1 || geoError?.code === 'OS-PLUG-GLOC-0003') {
    return {
      status: 'denied',
      message:
        'Autorise la localisation dans les paramètres de l’appareil pour afficher les arrêts proches.',
    }
  }

  if (geoError?.code === 3 || geoError?.code === 'OS-PLUG-GLOC-0010') {
    return {
      status: 'timeout',
      message: 'La position met trop de temps à répondre. Réessaie dans quelques secondes.',
    }
  }

  return {
    status: 'unavailable',
    message: 'Position temporairement indisponible.',
  }
}

export function useGeolocation() {
  const position = ref(null)
  const status = ref(isGeolocationSupported() ? 'pending' : 'unsupported')
  const error = ref(
    isGeolocationSupported()
      ? null
      : 'La géolocalisation n’est pas disponible sur cet appareil.',
  )
  const isRequesting = ref(false)
  const watchId = ref(null)
  let shouldWatch = false
  let watchPromise = null

  function hasLocationPermission(permissionStatus) {
    return permissionStatus.location === 'granted' || permissionStatus.coarseLocation === 'granted'
  }

  async function ensurePermission({ request = false } = {}) {
    if (!Capacitor.isNativePlatform()) return true

    const currentPermission = await Geolocation.checkPermissions()
    if (hasLocationPermission(currentPermission)) return true

    if (!request) return false

    const requestedPermission = await Geolocation.requestPermissions({
      permissions: ['location'],
    })

    return hasLocationPermission(requestedPermission)
  }

  function resetError() {
    if (status.value === 'timeout' || status.value === 'unavailable') {
      status.value = position.value ? 'ready' : 'pending'
    }

    error.value = null
  }

  function handleSuccess(nextPosition) {
    position.value = normalizePosition(nextPosition)
    status.value = 'ready'
    error.value = null
  }

  function handleError(geoError) {
    const nextError = normalizeError(geoError)
    status.value = nextError.status
    error.value = nextError.message
  }

  async function stopWatching() {
    shouldWatch = false

    if (watchPromise) {
      await watchPromise
    }

    if (watchId.value == null || !isGeolocationSupported()) return

    const currentWatchId = watchId.value
    watchId.value = null

    try {
      await Geolocation.clearWatch({ id: currentWatchId })
    } catch (geoError) {
      handleError(geoError)
    }
  }

  async function startWatching() {
    if (!isGeolocationSupported()) {
      status.value = 'unsupported'
      error.value = 'La géolocalisation n’est pas disponible sur cet appareil.'
      return
    }

    shouldWatch = true

    if (watchId.value != null || watchPromise || status.value === 'denied') return

    watchPromise = (async () => {
      try {
        const permissionGranted = await ensurePermission()
        if (!permissionGranted || !shouldWatch) return

        const nextWatchId = await Geolocation.watchPosition(
          GEOLOCATION_OPTIONS,
          (nextPosition, geoError) => {
            if (geoError) {
              handleError(geoError)
              return
            }

            if (nextPosition) {
              handleSuccess(nextPosition)
            }
          },
        )

        if (shouldWatch) {
          watchId.value = nextWatchId
        } else {
          await Geolocation.clearWatch({ id: nextWatchId })
        }
      } catch (geoError) {
        handleError(geoError)
      } finally {
        watchPromise = null
      }
    })()

    await watchPromise
  }

  async function requestPosition() {
    if (!isGeolocationSupported()) {
      status.value = 'unsupported'
      error.value = 'La géolocalisation n’est pas disponible sur cet appareil.'
      return null
    }

    if (isRequesting.value) return null

    isRequesting.value = true
    status.value = position.value ? 'ready' : 'pending'
    error.value = null

    try {
      const permissionGranted = await ensurePermission({ request: true })
      if (!permissionGranted) {
        handleError({ code: 'OS-PLUG-GLOC-0003' })
        return null
      }

      const nextPosition = await Geolocation.getCurrentPosition(CURRENT_POSITION_OPTIONS)
      handleSuccess(nextPosition)
      await startWatching()
      return position.value
    } catch (geoError) {
      handleError(geoError)
      return null
    } finally {
      isRequesting.value = false
    }
  }

  return {
    position,
    status,
    error,
    isRequesting,
    requestPosition,
    startWatching,
    stopWatching,
    resetError,
  }
}
