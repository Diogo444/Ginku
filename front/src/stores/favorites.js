import { ref, watch, computed } from 'vue'

const STORAGE_KEY = 'ginku-favorites'

/**
 * Structure d'un favori :
 * {
 *   id: string,           // Identifiant unique (ex: "arret_Gare Viotte_T1_Hauts du Chazal")
 *   type: 'arret' | 'ligne',
 *   nomArret: string,     // Nom de l'arrêt
 *   idLigne: string,      // ID de la ligne
 *   numLigne: string,     // Numéro public de la ligne (ex: "T1", "L3")
 *   destination: string,  // Destination de la ligne
 *   couleurFond: string,  // Couleur de fond de la ligne
 *   couleurTexte: string, // Couleur du texte de la ligne
 *   createdAt: number     // Timestamp de création
 * }
 */

// Charge les favoris depuis localStorage
const loadFavorites = () => {
  if (typeof localStorage !== 'undefined') {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) return parsed
      }
    } catch (e) {
      console.warn('Erreur lors du chargement des favoris:', e)
    }
  }
  return []
}

// État réactif des favoris
export const favorites = ref(loadFavorites())

// Computed pour vérification rapide
export const favoritesIds = computed(() => new Set(favorites.value.map(f => f.id)))

// Sauvegarde automatique
watch(favorites, (newFavorites) => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newFavorites))
  }
}, { deep: true })

/**
 * Génère un ID unique pour un favori
 */
export const generateFavoriteId = (nomArret, idLigne, destination) => {
  return `arret_${nomArret}_${idLigne}_${destination}`
}

/**
 * Vérifie si un élément est en favori
 */
export const isFavorite = (id) => {
  return favoritesIds.value.has(id)
}

/**
 * Ajoute un favori
 */
export const addFavorite = (favorite) => {
  if (!isFavorite(favorite.id)) {
    favorites.value.push({
      ...favorite,
      createdAt: Date.now()
    })
  }
}

/**
 * Supprime un favori
 */
export const removeFavorite = (id) => {
  const index = favorites.value.findIndex(f => f.id === id)
  if (index !== -1) {
    favorites.value.splice(index, 1)
  }
}

/**
 * Toggle un favori (ajoute si absent, supprime si présent)
 */
export const toggleFavorite = (favorite) => {
  if (isFavorite(favorite.id)) {
    removeFavorite(favorite.id)
    return false
  } else {
    addFavorite(favorite)
    return true
  }
}

/**
 * Supprime tous les favoris
 */
export const clearFavorites = () => {
  favorites.value = []
}
