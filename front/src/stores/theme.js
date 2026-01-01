import { ref, watch } from 'vue'

const STORAGE_KEY = 'ginku-theme'

// Vérifie la préférence système
const getSystemPreference = () => {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return 'light'
}

// Récupère le thème sauvegardé ou utilise la préférence système
const getSavedTheme = () => {
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'dark' || saved === 'light') return saved
  }
  return getSystemPreference()
}

// État réactif du thème
export const isDark = ref(getSavedTheme() === 'dark')

// Applique le thème au DOM
const applyTheme = (dark) => {
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('dark', dark)
  }
}

// Toggle le thème
export const toggleTheme = () => {
  isDark.value = !isDark.value
}

// Set un thème spécifique
export const setTheme = (theme) => {
  isDark.value = theme === 'dark'
}

// Watcher pour persister et appliquer le thème
watch(isDark, (dark) => {
  applyTheme(dark)
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, dark ? 'dark' : 'light')
  }
}, { immediate: true })

// Écouter les changements de préférence système
if (typeof window !== 'undefined' && window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    // Ne change automatiquement que si l'utilisateur n'a pas fait de choix explicite
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) {
      isDark.value = e.matches
    }
  })
}
