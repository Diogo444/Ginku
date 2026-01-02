<script setup>
import { isDark, toggleTheme } from '@/stores/theme'

defineOptions({ name: 'ThemeToggle' })
</script>

<template>
  <button 
    @click="toggleTheme"
    class="w-10 h-10 rounded-full bg-white dark:bg-surface-dark shadow-sm flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors border border-gray-100 dark:border-gray-700" 
    :title="isDark ? 'Activer le mode clair' : 'Activer le mode sombre'"
    :aria-label="isDark ? 'Activer le mode clair' : 'Activer le mode sombre'"
  >
    <span class="material-icons-round text-xl" aria-hidden="true">
      {{ isDark ? 'light_mode' : 'dark_mode' }}
    </span>
  </button>
</template>
