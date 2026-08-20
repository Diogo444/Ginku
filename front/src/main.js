import './style.css'
import axios from 'axios'
import { Capacitor } from '@capacitor/core'
import { createApp, readonly, ref } from 'vue'
import App from './App.vue'
import router from './router'
import { initializeFavorites } from '@/stores/favorites'
import { initializeTheme } from '@/stores/theme'

export const APP_VERSION = '1.0.2'
const latestVersion = ref(null)

const loadLatestVersion = async () => {
  try {
    const response = await axios.get(
      'https://api.github.com/repos/Diogo444/Ginku/releases/latest',
      {
        timeout: 10000,
        headers: { Accept: 'application/vnd.github+json' },
      },
    )

    if (typeof response.data?.tag_name === 'string') {
      latestVersion.value = response.data.tag_name
    }
  } catch (error) {
    console.error('Impossible de récupérer la dernière version Android :', error)
  }
}

const startApp = async () => {
  await Promise.all([
    initializeFavorites(),
    initializeTheme()
  ])

  const app = createApp(App)

  app.provide('isAndroid', Capacitor.getPlatform() === 'android')
  app.provide('latestVersion', readonly(latestVersion))
  app.use(router)
  app.mount('#app')

  if (Capacitor.getPlatform() === 'android') {
    loadLatestVersion()
  }
}

startApp()
