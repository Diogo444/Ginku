<script setup>
import { nextTick, onBeforeUnmount, ref } from 'vue'
import { MAX_BACKUP_BYTES, parseDataBackup, restoreDataBackup, selectNativeBackup, usesNativeImport } from '@/services/dataImport'
import { contrastPending } from '@/stores/accessibility'

const trigger = ref(null)
const fileInput = ref(null)
const dialog = ref(null)
const selected = ref(null)
const reading = ref(false)
const importing = ref(false)
const imported = ref(false)
const status = ref('')
const error = ref('')

async function preview(backup) {
  if (!backup) {
    status.value = 'Import annulé.'
    return
  }
  selected.value = backup
  await nextTick()
  if (dialog.value?.isConnected) dialog.value.showModal()
}

async function chooseFile() {
  if (reading.value || contrastPending.value) return
  error.value = ''
  status.value = ''
  if (!usesNativeImport()) {
    fileInput.value.value = ''
    fileInput.value.click()
    return
  }
  reading.value = true
  try { await preview(await selectNativeBackup()) } catch {
    error.value = 'Impossible de lire cette sauvegarde. Choisissez un fichier JSON Ginku valide de moins de 5 Mio.'
  } finally { reading.value = false }
}

async function readFile(event) {
  const file = event.target.files?.[0]
  if (!file) return
  error.value = ''
  status.value = ''
  reading.value = true
  try {
    if (file.size > MAX_BACKUP_BYTES) throw new Error('Le fichier dépasse la limite de 5 Mio.')
    await preview(parseDataBackup(await file.text()))
  } catch (failure) {
    error.value = failure.message || 'Impossible de lire ce fichier. Veuillez réessayer.'
  } finally { reading.value = false }
}

function closeDialog() {
  if (importing.value || imported.value) return
  dialog.value.close()
}

function onClose() {
  selected.value = null
  error.value = ''
  status.value = 'Import annulé.'
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

async function importData() {
  if (importing.value || !selected.value) return
  importing.value = true
  error.value = ''
  try {
    await restoreDataBackup(selected.value)
    imported.value = true
    status.value = 'Appuyez sur « Continuer » pour retrouver vos données.'
    await nextTick()
    dialog.value.querySelector('button')?.focus()
  } catch (failure) {
    error.value = failure.message || 'Impossible d’importer vos données. Veuillez réessayer.'
  } finally { importing.value = false }
}

function reloadApp() { window.location.reload() }
onBeforeUnmount(() => dialog.value?.close())
</script>

<template>
  <div>
    <button ref="trigger" type="button" :disabled="reading || contrastPending" :aria-busy="reading"
      :aria-label="reading ? 'Lecture de la sauvegarde…' : 'Importer mes données'" aria-describedby="import-data-description"
      class="w-full flex items-center gap-3 min-h-11 rounded-2xl bg-surface-light dark:bg-surface-dark p-4 sm:p-5 text-left shadow-soft border border-gray-100 dark:border-gray-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-70 disabled:cursor-wait"
      @click="chooseFile">
      <span class="w-11 h-11 shrink-0 rounded-xl bg-primary/10 text-primary flex items-center justify-center" aria-hidden="true">
        <span class="material-icons-round text-xl">upload</span>
      </span>
      <span class="flex-1 min-w-0">
        <span class="block text-sm font-semibold text-gray-900 dark:text-white">{{ reading ? 'Lecture de la sauvegarde…' : 'Importer mes données' }}</span>
        <span id="import-data-description" class="block mt-1 text-xs text-gray-600 dark:text-gray-300">Restaurez vos données depuis un fichier JSON exporté par Ginku.</span>
      </span>
      <span class="material-icons-round shrink-0 text-gray-600 dark:text-gray-300" aria-hidden="true">chevron_right</span>
    </button>
    <input ref="fileInput" type="file" accept=".json,application/json" aria-label="Choisir une sauvegarde Ginku" class="hidden" @change="readFile" @cancel="status = 'Import annulé.'" />
    <p role="status" :class="['text-sm text-gray-600 dark:text-gray-300', status && !selected ? 'mt-2' : 'sr-only']">{{ selected ? '' : status }}</p>
    <p v-if="error && !selected" role="alert" class="mt-2 text-sm text-red-700 dark:text-red-300">{{ error }}</p>
    <Teleport to="body">
      <dialog ref="dialog" aria-labelledby="import-title" aria-describedby="import-description"
        class="data-import m-auto w-[calc(100%-2rem)] max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl bg-surface-light dark:bg-surface-dark text-gray-900 dark:text-gray-100 p-5 shadow-xl backdrop:bg-black/60"
        @close="onClose" @cancel="(importing || imported) && $event.preventDefault()" @keydown="keepFocusInside">
        <div v-if="selected" class="space-y-4" :aria-busy="importing">
          <h2 id="import-title" class="text-xl font-semibold">{{ imported ? 'Données importées' : 'Importer cette sauvegarde ?' }}</h2>
          <p id="import-description" class="text-sm">{{ imported ? 'Votre sauvegarde a bien été restaurée.' : 'Retrouvez les favoris, le nom et les réglages enregistrés dans cette sauvegarde. Ils remplaceront ceux déjà présents dans Ginku.' }}</p>
          <p v-if="!imported" class="text-sm">Sauvegarde du {{ new Date(selected.exportedAt).toLocaleString('fr-FR') }}.</p>
          <p role="status" class="text-sm">{{ importing ? 'Import des données en cours…' : imported ? status : '' }}</p>
          <p v-if="error" role="alert" class="text-sm text-red-700 dark:text-red-300">{{ error }}</p>
          <div class="flex flex-wrap justify-end gap-3">
            <template v-if="!imported">
              <button autofocus type="button" :disabled="importing" class="min-h-11 px-4 rounded-lg border border-gray-500 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" @click="closeDialog">Annuler</button>
              <button type="button" :disabled="importing" class="min-h-11 px-4 rounded-lg bg-primary text-white disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" @click="importData">{{ importing ? 'Import en cours…' : 'Importer' }}</button>
            </template>
            <button v-else type="button" class="min-h-11 px-4 rounded-lg bg-primary text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" @click="reloadApp">Continuer</button>
          </div>
        </div>
      </dialog>
    </Teleport>
  </div>
</template>

<style scoped>
:global(html:has(dialog.data-import[open])) {
  overflow: hidden;
}
</style>
