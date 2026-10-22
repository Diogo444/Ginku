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
  const clean = String(color || '').replace('#', '').trim()
  return /^[0-9a-f]{3}([0-9a-f]{3})?$/i.test(clean) ? `#${clean}` : '#222222'
}

function luminance(hex) {
  const expanded = hex.length === 4 ? hex.slice(1).split('').map((digit) => digit + digit).join('') : hex.slice(1)
  const channels = expanded.match(/../g).map((pair) => {
    const value = Number.parseInt(pair, 16) / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
}

const badgeColors = computed(() => {
  const backgroundColor = toHex(props.couleurFond)
  let color = toHex(props.couleurTexte)
  const background = luminance(backgroundColor)
  const foreground = luminance(color)
  const ratio = (Math.max(background, foreground) + 0.05) / (Math.min(background, foreground) + 0.05)
  // Conserver la couleur Ginko lorsqu'elle est lisible, sinon choisir le meilleur
  // contraste noir/blanc pour les petits numéros (minimum 4,5:1).
  if (ratio < 4.5) color = (background + 0.05) / 0.05 >= 1.05 / (background + 0.05) ? '#000000' : '#FFFFFF'
  return { backgroundColor, color }
})
</script>

<template>
  <div
    data-line-badge
    :class="[
      'flex items-center justify-center font-bold shadow-sm border-2 border-white dark:border-gray-700 flex-shrink-0 whitespace-nowrap',
      isLongText ? 'rounded-full' : 'rounded-full',
      sizeClasses
    ]"
    :style="badgeColors"
    :aria-label="'Ligne ' + num"
    role="img"
  >
    <span aria-hidden="true">{{ num }}</span>
  </div>
</template>
