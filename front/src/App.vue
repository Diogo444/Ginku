<script setup>
import BottomNav from '@/components/BottomNav.vue'
import '@/stores/theme' // Initialise le thème au démarrage
</script>

<template>
  <div class="min-h-screen flex flex-col bg-background-light dark:bg-background-dark text-gray-900 dark:text-gray-100 font-sans antialiased">
    <!-- Skip link pour l'accessibilité -->
    <a 
      href="#main-content" 
      class="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[200] focus:px-4 focus:py-2 focus:bg-primary focus:text-white focus:rounded-lg focus:font-semibold"
    >
      Aller au contenu principal
    </a>
    
    <main id="main-content" tabindex="-1" class="flex-1 flex flex-col pb-20" role="main">
      <router-view class="flex-1 flex flex-col" />
    </main>
    
    <!-- Footer attribution -->
    <footer class="pb-24 px-4 sm:px-6 text-center" role="contentinfo">
      <div class="max-w-lg mx-auto py-4 border-t border-gray-200 dark:border-gray-800">
        <p class="text-[11px] sm:text-xs text-gray-400 dark:text-gray-500 leading-relaxed">
          Les données de transport affichées proviennent de l'<a href="https://open.ginko.voyage/" target="_blank" rel="noopener" class="underline hover:text-gray-600 dark:hover:text-gray-300 transition-colors">API Ginko</a> du réseau de transport du <strong>Grand Besançon Métropole</strong>. Ce site n'est ni affilié ni géré par Ginko ou le Grand Besançon Métropole.
        </p>
        <p class="text-[10px] sm:text-[11px] text-gray-300 dark:text-gray-600 mt-2">
          Fait avec ♥ par <a href="https://diogo-andrade.org" target="_blank" rel="noopener" class="underline hover:text-gray-500 dark:hover:text-gray-400 transition-colors">Diogo Andrade</a> — © {{ new Date().getFullYear() }} Ginku
        </p>
      </div>
    </footer>

    <BottomNav />
  </div>
</template>
