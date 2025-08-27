<script setup></script>

<template class="bg-white">
  <div
    class="min-h-screen flex flex-col bg-light-bg text-light-text dark:bg-white dark:text-dark-text"
  >
    <main class="flex-1 flex flex-col">
      <router-view class="flex-1 flex flex-col" />
    </main>

    <footer class="mt-auto p-4 text-center text-xs">
      Données fournies par l’API Ginko — Grand Besançon Métropole<br />
      © Grand Besançon Métropole
    </footer>
  </div>
</template>
