<script setup>
defineOptions({ name: 'ProfileButton' })
</script>

<template>
  <router-link
    :to="{ name: 'profil' }"
    aria-label="Ouvrir mon profil"
    title="Mon profil"
    class="w-11 h-11 shrink-0 rounded-full bg-white dark:bg-surface-dark shadow-sm flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 border border-gray-100 dark:border-gray-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
  >
    <span class="material-icons-round text-2xl" aria-hidden="true">person_outline</span>
  </router-link>
</template>
