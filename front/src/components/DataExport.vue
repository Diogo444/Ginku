<script setup>
import { nextTick, onBeforeUnmount, ref } from 'vue'
import { exportUserData } from '@/services/dataExport'
import { createDialogBackdropHandlers } from '@/utils/dialogBackdrop'

const exporting = ref(false)
const trigger = ref(null)
const dialog = ref(null)
const confirmButton = ref(null)
const isOpen = ref(false)
const status = ref('')
const error = ref('')
const backdrop = createDialogBackdropHandlers(cancelExport)

async function openDialog() {
  if (exporting.value || isOpen.value) return
  status.value = ''
  error.value = ''
  isOpen.value = true
  await nextTick()
  if (dialog.value?.isConnected) dialog.value.showModal()
}

function cancelExport() {
  if (exporting.value) return
  status.value = 'Export annulé.'
  dialog.value.close()
}

function onClose() {
  isOpen.value = false
  trigger.value?.focus()
}

function keepFocusInside(event) {
  if (event.key !== 'Tab') return
  const buttons = [...dialog.value.querySelectorAll('button:not(:disabled)')]
  const first = buttons[0]
  const last = buttons.at(-1)
  if (!first) event.preventDefault()
  else if (event.shiftKey && event.target === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && event.target === last) {
    event.preventDefault()
    first.focus()
  }
}

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
    dialog.value.close()
  } catch {
    status.value = ''
    error.value = 'Impossible d’exporter vos données. Veuillez réessayer.'
  } finally {
    exporting.value = false
    if (error.value) {
      await nextTick()
      confirmButton.value?.focus()
    }
  }
}

onBeforeUnmount(() => dialog.value?.close())
</script>

<template>
  <div>
    <button ref="trigger" type="button" :disabled="exporting" :aria-busy="exporting" aria-haspopup="dialog" :aria-expanded="isOpen"
      class="w-full flex items-center gap-3 min-h-11 rounded-2xl bg-surface-light dark:bg-surface-dark p-4 sm:p-5 text-left shadow-soft border border-gray-100 dark:border-gray-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-70 disabled:cursor-wait"
      :aria-label="exporting ? 'Export en cours…' : 'Exporter mes données'" aria-describedby="export-data-description" @click="openDialog">
      <span class="w-11 h-11 shrink-0 rounded-xl bg-primary/10 text-primary flex items-center justify-center" aria-hidden="true">
        <span class="material-icons-round text-xl">download</span>
      </span>
      <span class="flex-1 min-w-0">
        <span id="export-data-title" class="block text-sm font-semibold text-gray-900 dark:text-white">{{ exporting ? 'Export en cours…' : 'Exporter mes données' }}</span>
        <span id="export-data-description" class="block mt-1 text-xs text-gray-600 dark:text-gray-300">Gardez une copie de vos données et préférences dans un fichier JSON.</span>
      </span>
      <span class="material-icons-round shrink-0 text-gray-600 dark:text-gray-300" aria-hidden="true">chevron_right</span>
    </button>
    <p role="status" :class="['text-sm text-gray-600 dark:text-gray-300', status && !isOpen ? 'mt-2' : 'sr-only']">{{ isOpen ? '' : status }}</p>
    <Teleport to="body">
      <dialog ref="dialog" aria-labelledby="export-dialog-title" aria-describedby="export-dialog-description"
        class="data-export m-auto w-[calc(100%-2rem)] max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl bg-surface-light dark:bg-surface-dark text-gray-900 dark:text-gray-100 p-5 shadow-xl backdrop:bg-black/60"
        @close="onClose" @cancel.prevent="cancelExport" @keydown="keepFocusInside"
        @pointerdown="backdrop.onPointerDown" @pointerup="backdrop.onPointerUp" @pointercancel="backdrop.onPointerCancel" @click="backdrop.onClick">
        <div v-if="isOpen" class="space-y-4" :aria-busy="exporting">
          <h2 id="export-dialog-title" class="text-xl font-semibold">Exporter mes données ?</h2>
          <p id="export-dialog-description" class="text-sm">Ce fichier contiendra vos favoris, votre nom, vos réglages et les autres données enregistrées dans Ginku.</p>
          <p class="text-sm">Gardez-le pour retrouver vos données plus tard ou sur un autre appareil grâce au bouton « Importer mes données ».</p>
          <p role="status" class="text-sm">{{ exporting ? status : '' }}</p>
          <p v-if="error" role="alert" class="text-sm text-red-700 dark:text-red-300">{{ error }}</p>
          <div class="flex flex-wrap justify-end gap-3">
            <button autofocus type="button" :disabled="exporting" class="min-h-11 px-4 rounded-lg border border-gray-500 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" @click="cancelExport">Annuler</button>
            <button ref="confirmButton" type="button" :disabled="exporting" class="min-h-11 px-4 rounded-lg bg-primary text-white disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" @click="exportData">{{ exporting ? 'Export en cours…' : 'Exporter' }}</button>
          </div>
        </div>
      </dialog>
    </Teleport>
  </div>
</template>

<style scoped>
:global(html:has(dialog.data-export[open])) {
  overflow: hidden;
}
</style>
