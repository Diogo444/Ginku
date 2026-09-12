<script setup>
import { computed, ref } from 'vue'
import { requestNotificationAccess } from '@/composables/useStopNotifications'
import { setNotifyEnabled } from '@/stores/favorites'

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
const isDenied = ref(false)

const isEnabled = computed(() => props.favorite.notifyEnabled === true)

const label = computed(() => {
  const ligne = props.favorite.numLigne ? `du ${props.favorite.numLigne} ` : ''
  return `Notifier l'arrivée ${ligne}à ${props.favorite.nomArret}`
})

const handleToggle = async () => {
  if (isPending.value) return

  // Désactivation : aucune permission à vérifier.
  if (isEnabled.value) {
    setNotifyEnabled(props.favorite.id, false)
    isDenied.value = false
    return
  }

  isPending.value = true
  isDenied.value = false

  try {
    const granted = await requestNotificationAccess()
    if (granted) {
      setNotifyEnabled(props.favorite.id, true)
    } else {
      isDenied.value = true
    }
  } catch (error) {
    console.warn('Erreur lors de la demande de permission de notification:', error)
    isDenied.value = true
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
      @click.stop.prevent="handleToggle"
      :class="[
        'transition-colors disabled:opacity-50',
        isEnabled
          ? 'text-primary hover:text-primary/80'
          : 'text-gray-400 dark:text-gray-500 hover:text-primary'
      ]"
    >
      <span :class="['material-icons-round font-semibold', sizeClasses[size]]" aria-hidden="true">
        {{ isEnabled ? 'notifications_active' : 'notifications_none' }}
      </span>
    </button>
    <p
      v-if="isDenied"
      role="alert"
      class="text-[10px] leading-tight text-red-500 dark:text-red-400 text-right max-w-[120px]"
    >
      Notifications refusées. Active-les dans les réglages Android.
    </p>
  </div>
</template>
