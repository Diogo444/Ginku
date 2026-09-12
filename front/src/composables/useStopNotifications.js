import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { watch } from 'vue'
import GinkuStopWatcher from '@/plugins/ginkuStopWatcher'
import { favorites } from '@/stores/favorites'

const SYNC_DEBOUNCE_MS = 300

let started = false
let syncTimeoutId = null

function isSupported() {
  return Capacitor.getPlatform() === 'android'
}

function toWatchedStop(favorite) {
  return {
    id: favorite.id,
    nomArret: favorite.nomArret,
    idLigne: favorite.idLigne,
    numLigne: favorite.numLigne,
    destination: favorite.destination
  }
}

async function syncWatchedStops() {
  const stops = favorites.value.filter(f => f.notifyEnabled === true).map(toWatchedStop)

  try {
    await GinkuStopWatcher.sync({ stops })
  } catch (error) {
    console.warn('Erreur lors de la synchronisation de la surveillance des arrêts favoris:', error)
  }
}

function scheduleSync() {
  if (syncTimeoutId !== null) clearTimeout(syncTimeoutId)
  syncTimeoutId = setTimeout(() => {
    syncTimeoutId = null
    syncWatchedStops()
  }, SYNC_DEBOUNCE_MS)
}

/**
 * Démarre la synchronisation continue entre le store des favoris et le
 * foreground service Android chargé de surveiller les arrêts en arrière-plan.
 * À appeler une seule fois au démarrage de l'app (voir App.vue).
 */
export function startStopNotificationsSync() {
  if (started || !isSupported()) return
  started = true

  watch(favorites, scheduleSync, { deep: true })
  syncWatchedStops()
}

/**
 * Vérifie/demande la permission de notification (Android 13+ requiert
 * POST_NOTIFICATIONS). Retourne true si la permission est accordée.
 */
export async function requestNotificationAccess() {
  if (!isSupported()) return false

  const current = await LocalNotifications.checkPermissions()
  if (current.display === 'granted') return true

  const requested = await LocalNotifications.requestPermissions()
  return requested.display === 'granted'
}

export function isStopNotificationsSupported() {
  return isSupported()
}
