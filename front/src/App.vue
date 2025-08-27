<script setup></script>

<template>
  <div
    class="min-h-screen flex flex-col bg-light-bg text-light-text dark:bg-dark-bg dark:text-dark-text"
  >
    <main class="flex-1 flex flex-col">
      <router-view class="flex-1 flex flex-col" />
    </main>

    <footer class="mt-auto p-4 text-center text-xs opacity-80">
      Données fournies par l’API Ginko — Grand Besançon Métropole<br />
      © Grand Besançon Métropole
    </footer>
  </div>
</template>
