import { Capacitor } from '@capacitor/core'

let registrationPromise
let updatesStarted = false
let controllerWatched = false

function watchUpdates(registration) {
  if (import.meta.env.DEV || updatesStarted) return
  updatesStarted = true

  const checkForUpdate = () => {
    if (document.visibilityState !== 'visible' || !navigator.onLine) return
    registration.update().catch((error) => {
      console.warn('Impossible de vérifier la mise à jour de la PWA:', error)
    })
  }

  document.addEventListener('visibilitychange', checkForUpdate)
  window.addEventListener('online', checkForUpdate)
  window.setInterval(checkForUpdate, 5 * 60 * 1000)
  checkForUpdate()
}

export function registerPwa() {
  if (Capacitor.isNativePlatform() || !window.isSecureContext || !('serviceWorker' in navigator)) {
    return Promise.resolve(null)
  }
  if (!registrationPromise) {
    if (!import.meta.env.DEV && !controllerWatched) {
      controllerWatched = true
      let controlled = Boolean(navigator.serviceWorker.controller)
      let reloading = false
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        // La première installation ne nécessite pas de recharger l'interface.
        if (controlled && !reloading) {
          reloading = true
          window.location.reload()
        }
        controlled = true
      })
    }
    registrationPromise = navigator.serviceWorker.register(
      import.meta.env.DEV ? '/dev-sw.js?dev-sw' : '/sw.js',
      { type: import.meta.env.DEV ? 'module' : 'classic', updateViaCache: 'none' },
    )
      .then(() => new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('La PWA ne répond pas. Rechargez la page.')), 15000)
        navigator.serviceWorker.ready.then(resolve, reject).finally(() => clearTimeout(timer))
      }))
      .then((registration) => {
        watchUpdates(registration)
        return registration
      })
      .catch((error) => {
        registrationPromise = undefined
        throw error
      })
  }
  return registrationPromise
}
