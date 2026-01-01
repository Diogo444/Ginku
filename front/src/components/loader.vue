<script setup>
defineOptions({ name: 'LoadingSpinner' })

defineProps({
  size: {
    type: String,
    default: 'md',
    validator: (value) => ['sm', 'md', 'lg'].includes(value)
  },
  centered: {
    type: Boolean,
    default: true
  }
})

const sizeClasses = {
  sm: 'w-6 h-6 border-2',
  md: 'w-10 h-10 border-[3px]',
  lg: 'w-12 h-12 border-4'
}
</script>

<template>
  <div :class="['flex items-center justify-center', centered ? 'w-full py-12' : '']">
    <span class="sr-only">Chargement...</span>
    <span 
      :class="[
        'border-primary border-b-transparent rounded-full inline-block animate-spin',
        sizeClasses[size]
      ]" 
      role="status" 
      aria-live="polite" 
      aria-label="Chargement..."
    ></span>
  </div>
</template>
