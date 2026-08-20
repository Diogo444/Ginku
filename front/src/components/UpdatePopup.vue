<script setup>
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'

defineOptions({ name: 'UpdatePopup' })

const props = defineProps({
  show: {
    type: Boolean,
    default: false,
  },
  version: {
    type: String,
    default: '',
  },
  urlApk: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['close', 'update'])

const popupRef = ref(null)
const updateButtonRef = ref(null)
const previousActiveElement = ref(null)

const getFocusableElements = () => {
  if (!popupRef.value) return []

  return popupRef.value.querySelectorAll(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )
}

const handleKeydown = (event) => {
  if (!props.show) return

  if (event.key === 'Escape') {
    event.preventDefault()
    emit('close')
    return
  }

  if (event.key !== 'Tab') return

  const focusableElements = getFocusableElements()
  if (focusableElements.length === 0) {
    event.preventDefault()
    popupRef.value?.focus()
    return
  }

  const firstElement = focusableElements[0]
  const lastElement = focusableElements[focusableElements.length - 1]

  if (event.shiftKey && document.activeElement === firstElement) {
    event.preventDefault()
    lastElement.focus()
  } else if (!event.shiftKey && document.activeElement === lastElement) {
    event.preventDefault()
    firstElement.focus()
  }
}

const setBackgroundInert = (isInert) => {
  const appRoot = document.getElementById('app')
  if (!appRoot) return

  if (isInert) {
    appRoot.setAttribute('inert', '')
    appRoot.setAttribute('aria-hidden', 'true')
  } else {
    appRoot.removeAttribute('inert')
    appRoot.removeAttribute('aria-hidden')
  }
}

watch(
  () => props.show,
  async (isOpen) => {
    if (isOpen) {
      previousActiveElement.value = document.activeElement
      setBackgroundInert(true)
      document.addEventListener('keydown', handleKeydown)
      await nextTick()
      updateButtonRef.value?.focus()
      return
    }

    document.removeEventListener('keydown', handleKeydown)
    setBackgroundInert(false)
    await nextTick()
    previousActiveElement.value?.focus()
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeydown)
  setBackgroundInert(false)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="update-backdrop">
      <div
        v-if="show"
        class="fixed inset-0 z-[110] bg-gray-950/65 backdrop-blur-sm"
        aria-hidden="true"
        @click="emit('close')"
      ></div>
    </Transition>

    <Transition name="update-popup">
      <div
        v-if="show"
        class="fixed inset-0 z-[111] flex items-end justify-center p-0 sm:items-center sm:p-5"
        @click.self="emit('close')"
      >
        <section
          ref="popupRef"
          class="relative w-full max-w-md overflow-hidden rounded-t-3xl border border-gray-200 bg-surface-light shadow-2xl dark:border-gray-700 dark:bg-surface-dark sm:rounded-3xl"
          role="dialog"
          aria-modal="true"
          aria-labelledby="update-popup-title"
          aria-describedby="update-popup-description"
          tabindex="-1"
        >
          <div class="absolute inset-x-0 top-0 h-1 bg-primary" aria-hidden="true"></div>

          <button
            type="button"
            class="absolute right-3 top-3 z-10 flex size-11 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white dark:focus-visible:ring-offset-surface-dark"
            aria-label="Fermer la fenêtre de mise à jour"
            @click="emit('close')"
          >
            <span class="material-icons-round text-2xl" aria-hidden="true">close</span>
          </button>

          <div class="px-6 pb-6 pt-8 text-center sm:px-8 sm:pb-8 sm:pt-10">
            <div
              class="mx-auto mb-5 flex size-20 items-center justify-center rounded-3xl bg-primary-soft text-primary shadow-glow dark:bg-primary/15"
              aria-hidden="true"
            >
              <span class="material-icons-round text-[2.5rem]">system_update</span>
            </div>

            <p
              class="mb-3 inline-flex rounded-full bg-primary-soft px-3 py-1 text-sm font-bold uppercase tracking-[0.1em] text-red-700 dark:bg-primary/20 dark:text-red-200"
            >
              Mise à jour
            </p>
            <h2
              id="update-popup-title"
              class="text-2xl font-bold leading-tight text-gray-900 dark:text-white sm:text-[1.7rem]"
            >
              Une nouvelle version est disponible
            </h2>
            <p
              id="update-popup-description"
              class="mx-auto mt-3 max-w-sm text-sm leading-6 text-gray-600 dark:text-gray-300"
            >
              Mettez Ginku à jour pour profiter des dernières fonctionnalités, améliorations et corrections.
            </p>

            <p
              v-if="version"
              class="mx-auto mt-4 w-fit rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300"
            >
              Version {{ version }}
            </p>

            <button
              ref="updateButtonRef"
              type="button"
              class="mt-7 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-base font-bold text-white shadow-glow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:bg-primary/80 dark:focus-visible:ring-offset-surface-dark"
              @click="emit('update')"
            >
              <span class="material-icons-round text-xl" aria-hidden="true">download</span>
              Mettre à jour
            </button>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.update-backdrop-enter-active,
.update-backdrop-leave-active {
  transition: opacity 200ms ease;
}

.update-backdrop-enter-from,
.update-backdrop-leave-to {
  opacity: 0;
}

.update-popup-enter-active {
  animation: update-popup-in 280ms ease-out;
}

.update-popup-leave-active {
  animation: update-popup-out 180ms ease-in;
}

@keyframes update-popup-in {
  from {
    opacity: 0;
    transform: translateY(2rem) scale(0.98);
  }
}

@keyframes update-popup-out {
  to {
    opacity: 0;
    transform: translateY(1rem) scale(0.98);
  }
}

@media (prefers-reduced-motion: reduce) {
  .update-backdrop-enter-active,
  .update-backdrop-leave-active {
    transition: none;
  }

  .update-popup-enter-active,
  .update-popup-leave-active {
    animation: none;
  }
}
</style>
