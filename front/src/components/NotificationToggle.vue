<script setup>
import { computed, ref } from 'vue'
import { Capacitor } from '@capacitor/core'
import { changeNotificationEnabled } from '@/composables/useStopNotifications'
import { notificationErrorMessage } from '@/services/webStopNotifications'

defineOptions({ name: 'NotificationToggle' })

const props = defineProps({
  favorite: {
    type: Object,
    required: true
  },
  size: {
    type: String,
    default: 'md',
    validator: (v) => ['sm', 'md', 'lg'].includes(v)
  }
})

const isPending = ref(false)
const errorMessage = ref('')
const statusMessage = ref('')

const isEnabled = computed(() => props.favorite.notifyEnabled === true)

const label = computed(() => {
  const ligne = props.favorite.numLigne ? `du ${props.favorite.numLigne} ` : ''
  return `Notifier l'arrivée ${ligne}à ${props.favorite.nomArret}`
})

const handleToggle = async () => {
  if (isPending.value) return

  isPending.value = true
  errorMessage.value = ''
  statusMessage.value = ''

  try {
    const enabled = !isEnabled.value
    const granted = await changeNotificationEnabled(props.favorite, enabled)
    if (granted) {
      statusMessage.value = enabled ? 'Notifications activées.' : 'Notifications désactivées.'
    } else {
      errorMessage.value = Capacitor.getPlatform() === 'android'
        ? 'Notifications refusées. Active-les dans les réglages Android.'
        : 'Notifications refusées. Active-les dans les réglages du navigateur.'
    }
  } catch (error) {
    errorMessage.value = notificationErrorMessage(error)
  } finally {
    isPending.value = false
  }
}

const sizeClasses = {
  sm: 'text-xl',
  md: 'text-2xl',
  lg: 'text-3xl'
}
</script>

<template>
  <div class="flex flex-col items-end gap-0.5">
    <button
      type="button"
      role="switch"
      :aria-checked="isEnabled"
      :aria-label="label"
      :title="label"
      :disabled="isPending"
      :aria-busy="isPending"
      @click.stop.prevent="handleToggle"
      :class="[
        'min-w-11 min-h-11 inline-flex items-center justify-center rounded-lg motion-safe:transition-colors disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        isEnabled
          ? 'text-primary hover:text-primary/80'
          : 'text-gray-600 dark:text-gray-300 hover:text-primary'
      ]"
    >
      <span :class="['material-icons-round font-semibold', sizeClasses[size]]" aria-hidden="true">
        {{ isEnabled ? 'notifications_active' : 'notifications_none' }}
      </span>
    </button>
    <p
      v-if="errorMessage"
      role="alert"
      class="text-xs leading-tight text-red-700 dark:text-red-300 text-right max-w-[200px]"
    >
      {{ errorMessage }}
    </p>
    <p role="status" class="sr-only">{{ isPending ? 'Synchronisation des notifications…' : statusMessage }}</p>
  </div>
</template>
