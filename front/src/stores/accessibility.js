import { ref } from 'vue'
import { Preferences } from '@capacitor/preferences'

const STORAGE_KEY = 'ginku-high-contrast'
let initializationPromise
export const isHighContrast = ref(false)
export const contrastPending = ref(false)
export const contrastError = ref('')

function applyContrast(enabled) {
  isHighContrast.value = enabled
  document.documentElement.classList.toggle('high-contrast', enabled)
}

export function initializeAccessibility() {
  if (!initializationPromise) {
    initializationPromise = (async () => {
      try {
        const { value } = await Preferences.get({ key: STORAGE_KEY })
        applyContrast(value === 'true')
      } catch {
        contrastError.value = 'Impossible de lire votre préférence de contraste sur cet appareil.'
      }
    })()
  }
  return initializationPromise
}

export async function setHighContrast(enabled) {
  if (contrastPending.value) return
  const previous = isHighContrast.value
  contrastPending.value = true
  contrastError.value = ''
  applyContrast(enabled)
  try {
    await Preferences.set({ key: STORAGE_KEY, value: String(enabled) })
  } catch {
    applyContrast(previous)
    contrastError.value = 'Le contraste n’a pas pu être enregistré. Réessayez.'
  } finally {
    contrastPending.value = false
  }
}
