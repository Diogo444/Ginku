import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { ref, watch } from 'vue'
import GinkuStopWatcher from '@/plugins/ginkuStopWatcher'
import { favorites, setNotifyEnabled, setNotificationTiming } from '@/stores/favorites'
import { isWebPushSupported, requestWebNotificationAccess, syncWebWatchedStops, notificationErrorMessage } from '@/services/webStopNotifications'

const SYNC_DEBOUNCE_MS = 300

let started = false
let syncTimeoutId = null
export const notificationSyncError = ref('')

function isSupported() {
  return Capacitor.getPlatform() === 'android' || isWebPushSupported()
}

function toWatchedStop(favorite) {
  return {
    id: favorite.id,
    nomArret: favorite.nomArret,
    idLigne: favorite.idLigne,
    numLigne: favorite.numLigne,
    destination: favorite.destination,
    notifyBeforeMinutes: favorite.notifyBeforeMinutes ?? 2,
    notifyIntervalMinutes: favorite.notifyIntervalMinutes ?? 1
  }
}

export async function syncWatchedStops() {
  if (syncTimeoutId !== null) {
    clearTimeout(syncTimeoutId)
    syncTimeoutId = null
  }
  const stops = favorites.value.filter(f => f.notifyEnabled === true).map(toWatchedStop)

  try {
    if (Capacitor.getPlatform() === 'android') {
      await GinkuStopWatcher.sync({ stops })
    } else {
      await syncWebWatchedStops(stops)
    }
    notificationSyncError.value = ''
  } catch (error) {
    notificationSyncError.value = notificationErrorMessage(error)
    console.warn('Erreur lors de la synchronisation des notifications:', notificationSyncError.value)
    throw error
  }
}

function scheduleSync() {
  if (syncTimeoutId !== null) clearTimeout(syncTimeoutId)
  syncTimeoutId = setTimeout(() => {
    syncTimeoutId = null
    syncWatchedStops().catch(() => undefined)
  }, SYNC_DEBOUNCE_MS)
}

/**
 * Démarre la synchronisation continue entre le store des favoris et le
 * service Android ou le serveur chargé de surveiller les arrêts en arrière-plan.
 * À appeler une seule fois au démarrage de l'app (voir App.vue).
 */
export function startStopNotificationsSync() {
  if (started || !isSupported()) return
  started = true

  // Seuls les champs réellement transmis déclenchent une synchronisation.
  // Le flush synchrone permet à une sauvegarde explicite d'annuler son debounce.
  watch(() => JSON.stringify(favorites.value.filter(f => f.notifyEnabled === true).map(toWatchedStop)), scheduleSync, { flush: 'sync' })
  syncWatchedStops().catch(() => undefined)
  if (Capacitor.getPlatform() === 'web') {
    // Réessayer après reconnexion et renouveler la durée de conservation au retour.
    window.addEventListener('online', scheduleSync)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') scheduleSync()
    })
  }
}

/**
 * Vérifie/demande la permission de notification (Android 13+ requiert
 * POST_NOTIFICATIONS). Retourne true si la permission est accordée.
 */
export async function requestNotificationAccess() {
  if (!isSupported()) return false
  if (Capacitor.getPlatform() === 'web') return requestWebNotificationAccess()

  const current = await LocalNotifications.checkPermissions()
  if (current.display === 'granted') return true

  const requested = await LocalNotifications.requestPermissions()
  return requested.display === 'granted'
}

export function isStopNotificationsSupported() {
  return isSupported()
}

export async function changeNotificationEnabled(favorite, enabled) {
  if (enabled && !await requestNotificationAccess()) return false
  const previous = favorite.notifyEnabled === true
  setNotifyEnabled(favorite.id, enabled)
  try {
    await syncWatchedStops()
  } catch (error) {
    setNotifyEnabled(favorite.id, previous)
    throw error
  }
  return true
}

export async function changeNotificationTiming(favorite, before, interval) {
  const previousBefore = favorite.notifyBeforeMinutes ?? 2
  const previousInterval = favorite.notifyIntervalMinutes ?? 1
  if (before === previousBefore && interval === previousInterval) return
  setNotificationTiming(favorite.id, before, interval)
  if (!favorite.notifyEnabled) return
  try {
    await syncWatchedStops()
  } catch (error) {
    setNotificationTiming(favorite.id, previousBefore, previousInterval)
    throw error
  }
}
