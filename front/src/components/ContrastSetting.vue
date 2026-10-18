<script setup>
import { isHighContrast, contrastPending, contrastError, setHighContrast } from '@/stores/accessibility'

defineOptions({ name: 'ContrastSetting' })
</script>

<template>
  <div>
    <button type="button" role="switch" :aria-checked="isHighContrast" aria-labelledby="contrast-label"
      :aria-busy="contrastPending" :disabled="contrastPending"
      class="w-full text-left rounded-2xl bg-surface-light dark:bg-surface-dark p-4 sm:p-5 shadow-soft border border-gray-100 dark:border-gray-800 cursor-pointer disabled:cursor-wait disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      @click="setHighContrast(!isHighContrast)">
      <span class="flex items-center gap-3">
        <span class="w-11 h-11 shrink-0 rounded-xl bg-primary/10 text-primary flex items-center justify-center" aria-hidden="true">
          <span class="material-icons-round text-xl">contrast</span>
        </span>
        <span class="flex-1 min-w-0">
          <span id="contrast-label" class="block font-semibold text-sm text-gray-900 dark:text-white">Contraste élevé</span>
          <span class="block mt-1 text-xs text-gray-600 dark:text-gray-300">{{ isHighContrast ? 'Activé' : 'Désactivé' }}</span>
        </span>
        <span class="min-w-14 min-h-11 shrink-0 flex items-center justify-center" aria-hidden="true">
          <span :class="['contrast-switch-track w-14 h-8 p-1 rounded-full flex items-center border border-transparent', isHighContrast ? 'bg-primary' : 'bg-gray-600 dark:bg-gray-400']">
            <span :class="['contrast-switch-thumb w-6 h-6 rounded-full bg-white motion-safe:transition-transform', isHighContrast ? 'translate-x-6' : 'translate-x-0']"></span>
          </span>
        </span>
      </span>
    </button>
    <p v-if="contrastError" role="alert" class="mt-3 text-sm text-red-700 dark:text-red-300">{{ contrastError }}</p>
    <p role="status" class="sr-only">{{ contrastPending ? 'Enregistrement du contraste…' : `Contraste élevé ${isHighContrast ? 'activé' : 'désactivé'}.` }}</p>
  </div>
</template>
