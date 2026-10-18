import { Capacitor } from '@capacitor/core'

let registrationPromise

export function registerPwa() {
  if (Capacitor.isNativePlatform() || !window.isSecureContext || !('serviceWorker' in navigator)) {
    return Promise.resolve(null)
  }
  if (!registrationPromise) {
    registrationPromise = navigator.serviceWorker.register(
      import.meta.env.DEV ? '/dev-sw.js?dev-sw' : '/sw.js',
      { type: import.meta.env.DEV ? 'module' : 'classic', updateViaCache: 'none' },
    )
      .then(() => new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('La PWA ne répond pas. Rechargez la page.')), 15000)
        navigator.serviceWorker.ready.then(resolve, reject).finally(() => clearTimeout(timer))
      }))
      .catch((error) => {
        registrationPromise = undefined
        throw error
      })
  }
  return registrationPromise
}
