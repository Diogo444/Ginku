import axios from 'axios'
import { Capacitor } from '@capacitor/core'
import { registerPwa } from './pwa'

const STORAGE_KEY = 'ginku-web-push'
const api = axios.create({
  baseURL: `${(import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')}/notifications`,
  timeout: 15000,
})
let queue = Promise.resolve()

export function isWebPushSupported() {
  return !Capacitor.isNativePlatform() && window.isSecureContext &&
    'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

function credentials() {
  const value = localStorage.getItem(STORAGE_KEY)
  if (!value) return null
  try {
    const parsed = JSON.parse(value)
    return typeof parsed.id === 'string' && typeof parsed.token === 'string' ? parsed : null
  } catch {
    localStorage.removeItem(STORAGE_KEY)
    return null
  }
}

function decodePublicKey(key) {
  const bytes = atob(key.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(bytes, (char) => char.charCodeAt(0))
}

async function getConfig() {
  const { data } = await api.get('/config')
  if (!data.enabled || typeof data.publicKey !== 'string') {
    throw new Error('Les notifications Web ne sont pas encore activées sur le serveur.')
  }
  return data
}

async function getSubscription() {
  const registration = await registerPwa()
  if (!registration) throw new Error('Installez ou ouvrez la PWA dans un navigateur compatible en HTTPS.')
  const current = await registration.pushManager.getSubscription()
  if (current) return current
  const config = await getConfig()
  return registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodePublicKey(config.publicKey) })
}

export async function requestWebNotificationAccess() {
  if (!isWebPushSupported()) return false
  // Appel direct depuis le clic : Safari exige une interaction utilisateur.
  const permission = Notification.permission === 'default'
    ? await Notification.requestPermission()
    : Notification.permission
  if (permission !== 'granted') return false
  await getConfig()
  await getSubscription()
  return true
}

/** Une seule mutation à la fois ; le fournisseur peut conserver l'abonnement
 * après fermeture de la PWA, le backend assure alors la surveillance. */
export function syncWebWatchedStops(stops) {
  queue = queue.catch(() => undefined).then(async () => {
    let saved = credentials()
    if (!stops.length) {
      if (saved) {
        try {
          await api.delete(`/subscriptions/${saved.id}`, { headers: { Authorization: `Bearer ${saved.token}` } })
        } catch (error) {
          if (error.response?.status !== 401) throw error
        }
        localStorage.removeItem(STORAGE_KEY)
      }
      const registration = await registerPwa()
      const subscription = await registration?.pushManager.getSubscription()
      if (subscription) await subscription.unsubscribe()
      return
    }
    if (Notification.permission !== 'granted') throw new Error('Autorisez les notifications dans les réglages du navigateur.')
    const subscription = await getSubscription()
    const save = () => api.put('/subscriptions', { id: saved?.id, subscription: subscription.toJSON(), stops }, {
      headers: saved ? { Authorization: `Bearer ${saved.token}` } : {},
    })
    let response
    try {
      response = await save()
    } catch (error) {
      if (error.response?.status !== 401 || !saved) throw error
      // Les abonnements sans visite depuis 30 jours sont supprimés côté serveur.
      localStorage.removeItem(STORAGE_KEY)
      saved = null
      response = await save()
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(response.data))
    } catch (error) {
      // Ne pas laisser de surveillance que le navigateur ne saurait plus supprimer.
      await api.delete(`/subscriptions/${response.data.id}`, {
        headers: { Authorization: `Bearer ${response.data.token}` },
      })
      throw error
    }
  })
  return queue
}

export function notificationErrorMessage(error) {
  return error.response?.data?.error || (error.isAxiosError
    ? 'Connexion au service de notifications impossible. Vérifiez votre connexion et réessayez.'
    : error.message || 'Impossible de synchroniser les notifications.')
}
