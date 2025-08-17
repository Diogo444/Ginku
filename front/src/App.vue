<script setup></script>

<template>
  <div
    class="flex min-h-screen flex-col bg-light-bg text-light-text dark:bg-dark-bg dark:text-dark-text"
  >
    <router-view class="flex-grow" />
    <footer class="mt-auto p-4 text-center text-xs">
      Données fournies par l’API Ginko — Grand Besançon Métropole<br />
      © Grand Besançon Métropole
    </footer>
  </div>
</template>
