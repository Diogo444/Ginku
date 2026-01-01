<script setup>
defineOptions({ name: 'EmptyState' })

defineProps({
  icon: {
    type: String,
    default: 'inbox'
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    default: ''
  }
})
</script>

<template>
  <div class="flex flex-col items-center justify-center py-12 px-4 text-center">
    <div class="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
      <span class="material-icons-round text-3xl text-gray-400 dark:text-gray-500">{{ icon }}</span>
    </div>
    <h3 class="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-1">{{ title }}</h3>
    <p v-if="message" class="text-sm text-gray-500 dark:text-gray-400 max-w-xs">{{ message }}</p>
    <slot />
  </div>
</template>
