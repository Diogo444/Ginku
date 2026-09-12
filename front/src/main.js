import './style.css'
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { initializeFavorites } from '@/stores/favorites'
import { initializeTheme } from '@/stores/theme'
import { startStopNotificationsSync } from '@/composables/useStopNotifications'

const startApp = async () => {
  await Promise.all([
    initializeFavorites(),
    initializeTheme()
  ])

  startStopNotificationsSync()

  const app = createApp(App)

  app.use(router)
  app.mount('#app')
}

startApp()
