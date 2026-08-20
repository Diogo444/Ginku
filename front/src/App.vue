<script setup>
import axios from 'axios'
import { Capacitor } from '@capacitor/core'
import { onMounted, ref } from 'vue'
import BottomNav from '@/components/BottomNav.vue'
import UpdatePopup from '@/components/UpdatePopup.vue'
import '@/stores/theme' // Initialise le thème au démarrage

const APP_VERSION = import.meta.env.VITE_APP_VERSION || '1.0.2'
const latestVersion = ref('')
const apkDownloadUrl = ref('')
const showUpdatePopup = ref(false)

const isNewerVersion = (latest, current) => {
    const parseVersion = (version) => {
        const normalizedVersion = version.trim().replace(/^v/i, '')

        if (!/^\d+(\.\d+)*$/.test(normalizedVersion)) return null

        return normalizedVersion.split('.').map(Number)
    }

    const latestParts = parseVersion(latest)
    const currentParts = parseVersion(current)
    if (!latestParts || !currentParts) return false

    const partCount = Math.max(latestParts.length, currentParts.length)

    for (let index = 0; index < partCount; index += 1) {
        const latestPart = latestParts[index] ?? 0
        const currentPart = currentParts[index] ?? 0

        if (latestPart !== currentPart) return latestPart > currentPart
    }

    return false
}

const loadLatestVersion = async () => {
    try {
        const response = await axios.get(
            'https://api.github.com/repos/Diogo444/Ginku/releases/latest',
            {
                timeout: 10000,
                headers: { Accept: 'application/vnd.github+json' },
            },
        )

        if (typeof response.data?.tag_name !== 'string') return

        const apkAsset = response.data.assets?.find(
            (asset) =>
                asset?.content_type === 'application/vnd.android.package-archive' ||
                asset?.name?.toLowerCase().endsWith('.apk'),
        )

        latestVersion.value = response.data.tag_name
        apkDownloadUrl.value =
            typeof apkAsset?.browser_download_url === 'string' ? apkAsset.browser_download_url : ''
        showUpdatePopup.value = isNewerVersion(latestVersion.value, APP_VERSION)
    } catch (error) {
        console.error('Impossible de récupérer la dernière version Android :', error)
    }
}

onMounted(() => {
    if (Capacitor.getPlatform() === 'android') {
        loadLatestVersion()
    }
})
</script>

<template>
    <div
        class="min-h-screen flex flex-col bg-background-light dark:bg-background-dark text-gray-900 dark:text-gray-100 font-sans antialiased">
        <!-- Skip link pour l'accessibilité -->
        <a href="#main-content"
            class="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[200] focus:px-4 focus:py-2 focus:bg-primary focus:text-white focus:rounded-lg focus:font-semibold">
            Aller au contenu principal
        </a>

        <main id="main-content" tabindex="-1" class="flex-1 flex flex-col pb-bottom-nav-offset" role="main">
            <router-view class="flex-1 flex flex-col" />
        </main>

        <!-- Footer attribution -->
        <footer class="pb-24 px-4 sm:px-6 text-center" role="contentinfo">
            <div class="max-w-lg mx-auto py-4 border-t border-gray-200 dark:border-gray-800">
                <p class="text-[11px] sm:text-xs text-gray-400 dark:text-gray-500 leading-relaxed">
                    Les données de transport affichées proviennent de l'<a href="https://open.ginko.voyage/"
                        target="_blank" rel="noopener"
                        class="underline hover:text-gray-600 dark:hover:text-gray-300 transition-colors">API Ginko</a>
                    du réseau de transport du <strong>Grand Besançon Métropole</strong>. Ce site n'est ni affilié ni
                    géré par Ginko ou le Grand Besançon Métropole.
                </p>
                <p class="text-[10px] sm:text-[11px] text-gray-300 dark:text-gray-600 mt-2">
                    Fait avec ♥ par <a href="https://diogo-andrade.org" target="_blank" rel="noopener"
                        class="underline hover:text-gray-500 dark:hover:text-gray-400 transition-colors">Diogo
                        Andrade</a> — © {{ new Date().getFullYear() }} Ginku
                </p>
                <nav class="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-2 text-[10px] sm:text-[11px]"
                    aria-label="Informations légales">
                    <router-link to="/conditions-utilisation"
                        class="text-gray-400 dark:text-gray-500 underline underline-offset-2 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                        Conditions d’utilisation
                    </router-link>
                    <router-link to="/politique-confidentialite"
                        class="text-gray-400 dark:text-gray-500 underline underline-offset-2 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                        Politique de confidentialité
                    </router-link>
                </nav>
            </div>
        </footer>

        <BottomNav />

        <UpdatePopup :show="showUpdatePopup" :version="latestVersion" :url-apk="apkDownloadUrl"
            @close="showUpdatePopup = false" />
    </div>
</template>
