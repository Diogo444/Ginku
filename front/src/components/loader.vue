<script setup>
defineOptions({
  name: 'LoadingSpinner',
})
</script>

<template>
  <div class="loader-container">
    <span class="sr-only">Chargement...</span>
    <span class="loader" role="status" aria-live="polite" aria-label="Chargement..."></span>
  </div>
</template>

<style>
.loader-container {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.loader {
  width: 48px;
  height: 48px;
  border: 5px solid #ffffff;
  border-bottom-color: transparent;
  border-radius: 50%;
  display: inline-block;
  box-sizing: border-box;
  animation: rotation 1s linear infinite;
}

/* Animation */
@keyframes rotation {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

/* 🌞 Light mode override */
@media (prefers-color-scheme: light) {
  .loader {
    border: 5px solid #222222; /* Couleur foncée pour light mode */
    border-bottom-color: transparent; /* Toujours transparent pour l'effet */
  }
}
</style>
