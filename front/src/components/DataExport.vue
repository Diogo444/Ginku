<script setup>
import { ref } from 'vue'
import { exportUserData } from '@/services/dataExport'

const exporting = ref(false)
const status = ref('')
const error = ref('')

async function exportData() {
  if (exporting.value) return
  exporting.value = true
  status.value = 'Préparation de votre sauvegarde…'
  error.value = ''
  try {
    const result = await exportUserData()
    status.value = result === 'cancelled'
      ? 'Export annulé.'
      : result === 'saved' ? 'Votre sauvegarde JSON a été enregistrée.' : 'Le téléchargement de votre sauvegarde JSON a été lancé.'
  } catch {
    status.value = ''
    error.value = 'Impossible d’exporter vos données. Veuillez réessayer.'
  } finally {
    exporting.value = false
  }
}
</script>

<template>
  <div>
    <button type="button" :disabled="exporting" :aria-busy="exporting"
      class="w-full flex items-center gap-3 min-h-11 rounded-2xl bg-surface-light dark:bg-surface-dark p-4 sm:p-5 text-left shadow-soft border border-gray-100 dark:border-gray-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-70 disabled:cursor-wait"
      :aria-label="exporting ? 'Export en cours…' : 'Exporter mes données'" aria-describedby="export-data-description" @click="exportData">
      <span class="w-11 h-11 shrink-0 rounded-xl bg-primary/10 text-primary flex items-center justify-center" aria-hidden="true">
        <span class="material-icons-round text-xl">download</span>
      </span>
      <span class="flex-1 min-w-0">
        <span id="export-data-title" class="block text-sm font-semibold text-gray-900 dark:text-white">{{ exporting ? 'Export en cours…' : 'Exporter mes données' }}</span>
        <span id="export-data-description" class="block mt-1 text-xs text-gray-600 dark:text-gray-300">Gardez une copie de vos données et préférences dans un fichier JSON.</span>
      </span>
      <span class="material-icons-round shrink-0 text-gray-600 dark:text-gray-300" aria-hidden="true">chevron_right</span>
    </button>
    <p role="status" :class="['text-sm text-gray-600 dark:text-gray-300', status ? 'mt-2' : '']">{{ status }}</p>
    <p v-if="error" role="alert" class="mt-2 text-sm text-red-700 dark:text-red-300">{{ error }}</p>
  </div>
</template>
