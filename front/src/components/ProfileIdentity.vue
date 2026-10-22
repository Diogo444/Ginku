<script setup>
import { computed, nextTick, ref } from 'vue'
import { getProfileName, saveProfileName } from '@/services/profile'

defineOptions({ name: 'ProfileIdentity' })

const error = ref('')
const status = ref('')
const isEditing = ref(false)
const nameInput = ref(null)
const editButton = ref(null)

function loadName() {
  try {
    return getProfileName() || 'Alex Martin'
  } catch {
    error.value = 'Impossible de lire votre nom sur cet appareil.'
    return 'Alex Martin'
  }
}

const displayName = ref(loadName())
const draftName = ref(displayName.value)
const initials = computed(() => displayName.value.split(/\s+/).slice(0, 2)
  .map((word) => Array.from(word)[0]).join('').toLocaleUpperCase('fr'))

async function editName() {
  draftName.value = displayName.value
  error.value = ''
  status.value = ''
  isEditing.value = true
  await nextTick()
  nameInput.value?.focus()
  nameInput.value?.select()
}

async function closeEditor() {
  isEditing.value = false
  error.value = ''
  await nextTick()
  editButton.value?.focus()
}

async function saveName() {
  const name = draftName.value.trim()
  if (!name) {
    error.value = 'Saisissez un nom ou un pseudo.'
    nameInput.value?.focus()
    return
  }
  try {
    // Stockage local demandé pour ce profil, sur Web comme dans la WebView Android.
    saveProfileName(name)
  } catch {
    error.value = 'Enregistrement impossible sur cet appareil. Réessayez.'
    return
  }
  displayName.value = name
  status.value = 'Votre nom a été enregistré.'
  await closeEditor()
}
</script>

<template>
  <section aria-labelledby="profile-name" class="rounded-2xl border border-gray-100 dark:border-gray-800 bg-surface-light dark:bg-surface-dark p-5 sm:p-6 shadow-soft">
    <div class="flex items-center gap-3 sm:gap-4">
      <div class="w-16 h-16 shrink-0 rounded-2xl bg-primary/10 text-rose-700 dark:text-rose-300 flex items-center justify-center text-xl font-semibold" aria-hidden="true">{{ initials }}</div>
      <div class="min-w-0 flex-1">
        <p class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Bienvenue dans votre espace</p>
        <h2 id="profile-name" class="text-xl font-semibold text-gray-900 dark:text-white [overflow-wrap:anywhere]">{{ displayName }}</h2>
      </div>
      <button v-if="!isEditing" ref="editButton" type="button" aria-label="Modifier le nom"
        class="w-11 h-11 shrink-0 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        @click="editName">
        <span class="material-icons-round text-xl" aria-hidden="true">edit</span>
      </button>
    </div>

    <form v-if="isEditing" class="mt-5 space-y-3" novalidate @submit.prevent="saveName" @keydown.esc.prevent="closeEditor">
      <div>
        <label for="profile-name-input" class="block text-sm font-semibold text-gray-900 dark:text-white mb-2">Nom ou pseudo</label>
        <input id="profile-name-input" ref="nameInput" v-model="draftName" type="text" autocomplete="nickname" required
          :aria-invalid="Boolean(error)" :aria-describedby="error ? 'profile-name-hint profile-name-error' : 'profile-name-hint'"
          class="w-full min-h-11 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-base text-gray-900 dark:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
        <p id="profile-name-hint" class="mt-2 text-xs text-gray-600 dark:text-gray-300">Choisissez le nom qui s’affiche sur votre profil.</p>
      </div>
      <div class="flex flex-wrap justify-end gap-2">
        <button type="button" class="min-h-11 rounded-xl px-4 border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" @click="closeEditor">Annuler</button>
        <button type="submit" class="min-h-11 rounded-xl px-4 bg-rose-700 dark:bg-rose-800 text-white text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Enregistrer</button>
      </div>
    </form>
    <p v-if="error" id="profile-name-error" role="alert" class="mt-3 text-sm text-red-700 dark:text-red-300">{{ error }}</p>
    <p role="status" :class="['text-xs text-gray-600 dark:text-gray-300', status ? 'mt-2' : '']">{{ status }}</p>
  </section>
</template>
