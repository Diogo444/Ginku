import './style.css'
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { initializeFavorites } from '@/stores/favorites'
import { initializeTheme } from '@/stores/theme'

const startApp = async () => {
  await Promise.all([
    initializeFavorites(),
    initializeTheme()
  ])

  const app = createApp(App)

  app.use(router)
  app.mount('#app')
}

startApp()
