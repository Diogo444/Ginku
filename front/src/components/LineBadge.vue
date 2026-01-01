<script setup>
import { computed } from 'vue'

defineOptions({ name: 'LineBadge' })

const props = defineProps({
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
    validator: (value) => ['xs', 'sm', 'md', 'lg', 'xl'].includes(value)
  }
})

// Déterminer si le texte est long (plus de 2 caractères)
const isLongText = computed(() => props.num && props.num.length > 2)

// Classes pour les badges courts (cercle)
const shortSizeClasses = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-xl'
}

// Classes pour les badges longs (pilule)
const longSizeClasses = {
  xs: 'h-6 px-1.5 text-[9px]',
  sm: 'h-8 px-2 text-[10px]',
  md: 'h-10 px-2.5 text-xs',
  lg: 'h-12 px-3 text-sm',
  xl: 'h-16 px-4 text-base'
}

const sizeClasses = computed(() => {
  return isLongText.value ? longSizeClasses[props.size] : shortSizeClasses[props.size]
})

const toHex = (color) => {
  if (!color) return '#222222'
  const clean = String(color).replace('#', '').trim()
  return `#${clean}`
}
</script>

<template>
  <div 
    :class="[
      'flex items-center justify-center font-bold shadow-sm border-2 border-white dark:border-gray-700 flex-shrink-0 whitespace-nowrap',
      isLongText ? 'rounded-full' : 'rounded-full',
      sizeClasses
    ]"
    :style="{
      backgroundColor: toHex(couleurFond),
      color: toHex(couleurTexte)
    }"
  >
    {{ num }}
  </div>
</template>
