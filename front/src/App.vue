<script setup>
import BottomNav from '@/components/BottomNav.vue'
import '@/stores/theme' // Initialise le thème au démarrage
</script>

<template>
  <div class="min-h-screen flex flex-col bg-background-light dark:bg-background-dark text-gray-900 dark:text-gray-100 font-sans antialiased">
    <main id="main-content" tabindex="-1" class="flex-1 flex flex-col pb-20">
      <router-view class="flex-1 flex flex-col" />
    </main>
    
    <BottomNav />
  </div>
</template>
