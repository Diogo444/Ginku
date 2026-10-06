<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { Capacitor } from '@capacitor/core'
import { isStopNotificationsSupported, notificationSyncError, syncWatchedStops } from '@/composables/useStopNotifications'

const isWeb = !Capacitor.isNativePlatform()
const notificationsSupported = isStopNotificationsSupported()
const isOffline = ref(!navigator.onLine)
const installPrompt = ref(null)
const isPending = ref(false)
const installError = ref('')
const isInstalled = ref(window.matchMedia('(display-mode: standalone)').matches)
const updateConnection = () => { isOffline.value = !navigator.onLine }
const captureInstall = (event) => {
  event.preventDefault()
  installPrompt.value = event
}
const installed = () => {
  isInstalled.value = true
  installPrompt.value = null
}

async function install() {
  const prompt = installPrompt.value
  if (!prompt || isPending.value) return
  isPending.value = true
  installError.value = ''
  try {
    await prompt.prompt()
    await prompt.userChoice
    installPrompt.value = null
  } catch {
    installError.value = 'Installation impossible. Réessayez depuis le menu du navigateur.'
  } finally {
    isPending.value = false
  }
}

async function retry() {
  isPending.value = true
  try {
    await syncWatchedStops()
  } catch {
    // Le composable expose le message de la nouvelle tentative.
  } finally {
    isPending.value = false
  }
}

onMounted(() => {
  if (!isWeb) return
  window.addEventListener('online', updateConnection)
  window.addEventListener('offline', updateConnection)
  window.addEventListener('beforeinstallprompt', captureInstall)
  window.addEventListener('appinstalled', installed)
})
onBeforeUnmount(() => {
  window.removeEventListener('online', updateConnection)
  window.removeEventListener('offline', updateConnection)
  window.removeEventListener('beforeinstallprompt', captureInstall)
  window.removeEventListener('appinstalled', installed)
})
</script>

<template>
  <aside v-if="isWeb" aria-label="Application Web et notifications" class="rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-sm space-y-3">
    <p v-if="!isInstalled">
      Installez Ginku depuis le menu du navigateur pour l’utiliser comme une application.
      Sur iPhone et iPad, ajoutez Ginku à l’écran d’accueil pour recevoir les notifications.
    </p>
    <p v-if="notificationsSupported">Activez la cloche d’un favori pour être averti à 2 puis 1 minute de l’arrivée, même après fermeture de l’application. La réception dépend du navigateur et de la connexion.</p>
    <p v-else>Les notifications ne sont pas disponibles dans ce navigateur. Essayez un navigateur compatible ou ouvrez Ginku depuis l’écran d’accueil.</p>
    <button v-if="installPrompt" type="button" :disabled="isPending" @click="install"
      class="min-h-11 px-4 rounded-lg bg-primary text-white font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50">
      Installer Ginku
    </button>
    <p role="status" class="text-gray-700 dark:text-gray-200">{{ isOffline ? 'Hors ligne : les horaires en temps réel sont indisponibles.' : '' }}</p>
    <p v-if="installError" role="alert" class="text-red-700 dark:text-red-300">{{ installError }}</p>
    <div v-if="notificationSyncError" class="space-y-2">
      <p role="alert" class="text-red-700 dark:text-red-300">{{ notificationSyncError }}</p>
      <button type="button" :disabled="isPending" @click="retry"
        class="min-h-11 px-4 border rounded-lg font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50">
        {{ isPending ? 'Synchronisation…' : 'Réessayer les notifications' }}
      </button>
    </div>
  </aside>
</template>
