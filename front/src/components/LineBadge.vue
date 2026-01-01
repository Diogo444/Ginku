<script setup>
defineOptions({ name: 'LineBadge' })

defineProps({
  num: {
    type: String,
    required: true
  },
  couleurFond: {
    type: String,
    default: '222222'
  },
  couleurTexte: {
    type: String,
    default: 'FFFFFF'
  },
  size: {
    type: String,
    default: 'md',
    validator: (value) => ['sm', 'md', 'lg', 'xl'].includes(value)
  }
})

const sizeClasses = {
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-base',
  lg: 'w-12 h-12 text-xl',
  xl: 'w-16 h-16 text-3xl'
}

const toHex = (color) => {
  if (!color) return '#222222'
  const clean = String(color).replace('#', '').trim()
  return `#${clean}`
}
</script>

<template>
  <div 
    :class="[
      'rounded-full flex items-center justify-center font-bold shadow-sm border-2 border-white dark:border-gray-700',
      sizeClasses[size]
    ]"
    :style="{
      backgroundColor: toHex(couleurFond),
      color: toHex(couleurTexte)
    }"
  >
    {{ num }}
  </div>
</template>
