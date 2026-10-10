<script setup>
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import { changeNotificationTiming } from '@/composables/useStopNotifications'
import { notificationErrorMessage } from '@/services/webStopNotifications'

const props = defineProps({ favorite: { type: Object, required: true } })
const dialog = ref(null)
const trigger = ref(null)
const isOpen = ref(false)
const isPending = ref(false)
const errorMessage = ref('')
const statusMessage = ref('')
const beforeMinutes = ref(2)
const intervalMinutes = ref(1)
const titleId = computed(() => `notification-timing-${props.favorite.id}`)
const descriptionId = computed(() => `${titleId.value}-description`)
const triggerLabel = computed(() => `Régler les notifications de ${props.favorite.numLigne} à ${props.favorite.nomArret}, direction ${props.favorite.destination}`)
const preview = computed(() => {
  const before = beforeMinutes.value
  const interval = intervalMinutes.value
  if (![before, interval].every(value => Number.isInteger(value) && value >= 1 && value <= 60)) return 'Choisis des minutes entières entre 1 et 60.'
  const thresholds = []
  for (let value = before; value > 0; value -= interval) thresholds.push(value)
  return `Alertes à ${thresholds.join(', ')} min restantes.`
})

async function openDialog() {
  beforeMinutes.value = props.favorite.notifyBeforeMinutes ?? 2
  intervalMinutes.value = props.favorite.notifyIntervalMinutes ?? 1
  errorMessage.value = ''
  statusMessage.value = ''
  isOpen.value = true
  // Monter les champs avant showModal pour que autofocus cible le premier champ.
  await nextTick()
  if (!dialog.value?.isConnected) return
  // Le dialogue natif rend le reste de la page inerte et gère la navigation Tab.
  dialog.value.showModal()
}

function keepFocusInside(event) {
  if (event.key !== 'Tab') return
  const fields = [...dialog.value.querySelectorAll('input:not(:disabled), button:not(:disabled)')]
  const first = fields[0]
  const last = fields.at(-1)
  // Certains navigateurs permettent de passer dans leur barre d'adresse aux limites.
  if (!first) event.preventDefault()
  else if (event.shiftKey && event.target === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && event.target === last) {
    event.preventDefault()
    first.focus()
  }
}

function closeDialog() {
  dialog.value.close()
}

function onClose() {
  isOpen.value = false
  trigger.value?.focus()
}

async function saveTiming() {
  if (isPending.value) return
  isPending.value = true
  errorMessage.value = ''
  try {
    await changeNotificationTiming(props.favorite, beforeMinutes.value, intervalMinutes.value)
    statusMessage.value = 'Délais de notification enregistrés.'
    closeDialog()
  } catch (error) {
    errorMessage.value = notificationErrorMessage(error)
  } finally {
    isPending.value = false
  }
}

onBeforeUnmount(() => dialog.value?.close())
</script>

<template>
  <div class="w-full pl-2 mt-2">
    <button ref="trigger" type="button" :aria-label="triggerLabel" aria-haspopup="dialog" :aria-expanded="isOpen"
      class="min-h-11 px-3 rounded-lg text-sm text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      @click.stop="openDialog">
      Délais : {{ favorite.notifyBeforeMinutes ?? 2 }} / {{ favorite.notifyIntervalMinutes ?? 1 }} min
    </button>
    <p role="status" class="sr-only">{{ statusMessage }}</p>
    <Teleport to="body">
      <dialog ref="dialog" :aria-labelledby="titleId" :aria-describedby="descriptionId"
        class="notification-timing m-auto w-[calc(100%-2rem)] max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl bg-surface-light dark:bg-surface-dark text-gray-900 dark:text-gray-100 p-5 shadow-xl backdrop:bg-black/60"
        @close="onClose" @keydown="keepFocusInside" @cancel="isPending && $event.preventDefault()">
        <form v-if="isOpen" class="space-y-4" :aria-busy="isPending" @submit.prevent="saveTiming">
          <h2 :id="titleId" class="text-xl font-semibold">Délais de notification</h2>
          <p :id="descriptionId" class="text-sm">{{ favorite.numLigne }} · {{ favorite.nomArret }} · {{ favorite.destination }}</p>
          <label class="flex flex-col gap-1 text-sm">
            Prévenir avant (min)
            <input v-model.number="beforeMinutes" autofocus type="number" inputmode="numeric" min="1" max="60" step="1" required :disabled="isPending" class="min-h-11 w-full rounded border border-gray-500 bg-white dark:bg-gray-900 px-3 focus-visible:outline-2 focus-visible:outline-primary" />
          </label>
          <label class="flex flex-col gap-1 text-sm">
            Intervalle de rappel (min)
            <input v-model.number="intervalMinutes" type="number" inputmode="numeric" min="1" max="60" step="1" required :disabled="isPending" class="min-h-11 w-full rounded border border-gray-500 bg-white dark:bg-gray-900 px-3 focus-visible:outline-2 focus-visible:outline-primary" />
          </label>
          <p class="text-sm">De 1 à 60 minutes. {{ preview }}</p>
          <p v-if="!favorite.notifyEnabled" class="text-sm">Active la cloche du favori pour recevoir ces notifications.</p>
          <p v-if="errorMessage" role="alert" class="text-sm text-red-700 dark:text-red-300">{{ errorMessage }}</p>
          <p role="status" class="sr-only">{{ isPending ? 'Enregistrement des délais…' : '' }}</p>
          <div class="flex flex-wrap justify-end gap-3">
            <button type="button" :disabled="isPending" class="min-h-11 px-4 rounded-lg border border-gray-500 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" @click="closeDialog">Annuler</button>
            <button type="submit" :disabled="isPending" class="min-h-11 px-4 rounded-lg bg-primary text-white disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">{{ isPending ? 'Enregistrement…' : 'Enregistrer' }}</button>
          </div>
        </form>
      </dialog>
    </Teleport>
  </div>
</template>

<style scoped>
:global(html:has(dialog.notification-timing[open])) {
  overflow: hidden;
}
</style>
