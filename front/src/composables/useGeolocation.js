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
  if (geoError?.code === 1) {
    return {
      status: 'denied',
      message: 'Autorise la localisation dans ton navigateur pour afficher les arrêts proches.',
    }
  }

  if (geoError?.code === 3) {
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

  function stopWatching() {
    if (watchId.value == null || !isGeolocationSupported()) return

    navigator.geolocation.clearWatch(watchId.value)
    watchId.value = null
  }

  function startWatching() {
    if (!isGeolocationSupported()) {
      status.value = 'unsupported'
      error.value = 'La géolocalisation n’est pas disponible sur cet appareil.'
      return
    }

    if (watchId.value != null || status.value === 'denied') return

    watchId.value = navigator.geolocation.watchPosition(
      handleSuccess,
      handleError,
      GEOLOCATION_OPTIONS,
    )
  }

  function requestPosition() {
    if (!isGeolocationSupported()) {
      status.value = 'unsupported'
      error.value = 'La géolocalisation n’est pas disponible sur cet appareil.'
      return Promise.resolve(null)
    }

    isRequesting.value = true
    status.value = position.value ? 'ready' : 'pending'
    error.value = null

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (nextPosition) => {
          handleSuccess(nextPosition)
          isRequesting.value = false
          startWatching()
          resolve(position.value)
        },
        (geoError) => {
          handleError(geoError)
          isRequesting.value = false
          resolve(null)
        },
        CURRENT_POSITION_OPTIONS,
      )
    })
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
