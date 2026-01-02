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
    
    <BottomNav />
  </div>
</template>
