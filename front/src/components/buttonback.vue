<script setup>
defineOptions({ name: 'ButtonBack' })
</script>
<template>
  <button
    onclick="history.back()"
    class="w-12 h-12 flex items-center justify-center rounded-full bg-light-primary dark:bg-dark-primary hover:bg-light-secondary dark:hover:bg-dark-secondary transition-colors duration-200 shadow-lg focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent focus:ring-offset-2 focus:ring-offset-light-bg dark:focus:ring-offset-dark-bg absolute left-4 top-4"
    aria-label="Retourner à l'accueil"
  >
    <span class="sr-only">Retour à la page précédente</span>
    <svg
      xmlns="http://www.w3.org/2000/svg"
      height="20"
      viewBox="0 -960 960 960"
      width="20"
      fill="currentColor"
      class="text-light-bg dark:text-dark-text"
      aria-hidden="true"
    >
      <path
        d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"
      />
    </svg>
  </button>
</template>

<style>
button {
  position: absolute;
  left: 1rem;
  top: 1rem;
  cursor: pointer;
}
</style>
