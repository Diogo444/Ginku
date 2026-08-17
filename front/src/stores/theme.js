import { ref } from 'vue'
import { Preferences } from '@capacitor/preferences'

const STORAGE_KEY = 'ginku-theme'
let initializationPromise = null
let persistenceQueue = Promise.resolve()
let hasSavedTheme = false

// Vérifie la préférence système
const getSystemPreference = () => {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return 'light'
}

const isValidTheme = (theme) => theme === 'dark' || theme === 'light'

// État réactif du thème
export const isDark = ref(getSystemPreference() === 'dark')

// Applique le thème au DOM
const applyTheme = (dark) => {
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('dark', dark)
  }
}

const persistTheme = (theme) => {
  persistenceQueue = persistenceQueue
    .catch(() => undefined)
    .then(() => Preferences.set({ key: STORAGE_KEY, value: theme }))
    .catch((error) => {
      console.warn('Erreur lors de la sauvegarde du thème:', error)
    })
}

const loadLegacyTheme = () => {
  if (typeof localStorage === 'undefined') return null

  try {
    const legacyTheme = localStorage.getItem(STORAGE_KEY)
    return isValidTheme(legacyTheme) ? legacyTheme : null
  } catch (error) {
    console.warn('Erreur lors du chargement de l’ancien thème:', error)
    return null
  }
}

/**
 * Charge le thème natif avant le montage de l'application et migre le choix
 * enregistré par les anciennes versions dans localStorage lorsqu'il existe.
 */
export const initializeTheme = () => {
  if (initializationPromise) return initializationPromise

  initializationPromise = (async () => {
    try {
      const { value } = await Preferences.get({ key: STORAGE_KEY })

      if (isValidTheme(value)) {
        hasSavedTheme = true
        isDark.value = value === 'dark'
        applyTheme(isDark.value)
        return
      }

      const legacyTheme = loadLegacyTheme()
      if (legacyTheme !== null) {
        hasSavedTheme = true
        isDark.value = legacyTheme === 'dark'
        applyTheme(isDark.value)

        await Preferences.set({ key: STORAGE_KEY, value: legacyTheme })
        localStorage.removeItem(STORAGE_KEY)
        return
      }

      isDark.value = getSystemPreference() === 'dark'
      applyTheme(isDark.value)
    } catch (error) {
      console.warn('Erreur lors du chargement du thème:', error)

      const legacyTheme = loadLegacyTheme()
      hasSavedTheme = legacyTheme !== null
      isDark.value = (legacyTheme || getSystemPreference()) === 'dark'
      applyTheme(isDark.value)
    }
  })()

  return initializationPromise
}

// Toggle le thème
export const toggleTheme = () => {
  setTheme(isDark.value ? 'light' : 'dark')
}

// Set un thème spécifique
export const setTheme = (theme) => {
  const selectedTheme = theme === 'dark' ? 'dark' : 'light'

  hasSavedTheme = true
  isDark.value = selectedTheme === 'dark'
  applyTheme(isDark.value)
  persistTheme(selectedTheme)
}

// Applique immédiatement la préférence système pendant le chargement natif.
applyTheme(isDark.value)

// Écouter les changements de préférence système
if (typeof window !== 'undefined' && window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    // Ne change automatiquement que si l'utilisateur n'a pas fait de choix explicite
    if (!hasSavedTheme) {
      isDark.value = e.matches
      applyTheme(isDark.value)
    }
  })
}
