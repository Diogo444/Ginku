import './style.css'
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

// Initialiser le store de thème (applique le thème sauvegardé au démarrage)
import '@/stores/theme'

const app = createApp(App)

app.use(router)

app.mount('#app')
