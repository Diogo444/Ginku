<script setup>
import { computed } from 'vue'
import { isFavorite, toggleFavorite, generateFavoriteId } from '@/stores/favorites'

defineOptions({ name: 'FavoriteButton' })

const props = defineProps({
  nomArret: String,
  idLigne: String,
  numLigne: String,
  destination: String,
  couleurFond: String,
  couleurTexte: String,
  size: {
    type: String,
    default: 'md',
    validator: (v) => ['sm', 'md', 'lg'].includes(v)
  }
})

const emit = defineEmits(['toggle'])

const favoriteId = computed(() => generateFavoriteId(props.nomArret, props.idLigne, props.destination))

const isInFavorites = computed(() => isFavorite(favoriteId.value))

const handleToggle = () => {
  const favorite = {
    id: favoriteId.value,
    type: 'arret',
    nomArret: props.nomArret,
    idLigne: props.idLigne,
    numLigne: props.numLigne,
    destination: props.destination,
    couleurFond: props.couleurFond,
    couleurTexte: props.couleurTexte
  }
  const added = toggleFavorite(favorite)
  emit('toggle', added)
}

const sizeClasses = {
  sm: 'text-xl',
  md: 'text-2xl',
  lg: 'text-3xl'
}
</script>

<template>
  <button 
    @click.stop.prevent="handleToggle"
    :class="[
      'transition-colors',
      isInFavorites 
        ? 'text-yellow-500 hover:text-yellow-600' 
        : 'text-gray-400 dark:text-gray-500 hover:text-yellow-500'
    ]"
    :title="isInFavorites ? 'Retirer des favoris' : 'Ajouter aux favoris'"
    :aria-label="isInFavorites ? 'Retirer des favoris' : 'Ajouter aux favoris'"
    :aria-pressed="isInFavorites"
  >
    <span :class="['material-icons-round font-semibold', sizeClasses[size]]" aria-hidden="true">
      {{ isInFavorites ? 'star' : 'star_border' }}
    </span>
  </button>
</template>
