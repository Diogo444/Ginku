<script setup>
defineOptions({ name: 'ErrorState' })

defineProps({
  title: {
    type: String,
    default: 'Une erreur est survenue'
  },
  message: {
    type: String,
    default: 'Impossible de charger les données. Veuillez réessayer.'
  }
})

const emit = defineEmits(['retry'])
</script>

<template>
  <div class="flex flex-col items-center justify-center py-12 px-4 text-center" role="alert">
    <div class="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center mb-4" aria-hidden="true">
      <span class="material-icons-round text-3xl text-red-500 dark:text-red-400">error_outline</span>
    </div>
    <h3 class="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-1">{{ title }}</h3>
    <p class="text-sm text-gray-500 dark:text-gray-400 max-w-xs mb-4">{{ message }}</p>
    <button 
      @click="emit('retry')"
      class="px-4 py-2 bg-primary text-white rounded-full text-sm font-semibold hover:bg-primary/90 transition-colors"
      aria-label="Réessayer le chargement"
    >
      Réessayer
    </button>
  </div>
</template>
