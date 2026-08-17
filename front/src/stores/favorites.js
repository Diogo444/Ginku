import { computed, ref } from 'vue'
import { Preferences } from '@capacitor/preferences'

const STORAGE_KEY = 'ginku-favorites'
let initializationPromise = null
let persistenceQueue = Promise.resolve()

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

const deserializeFavorites = (serializedFavorites) => {
  const parsedFavorites = JSON.parse(serializedFavorites)

  if (!Array.isArray(parsedFavorites)) {
    throw new TypeError('Le format des favoris sauvegardés est invalide')
  }

  return parsedFavorites.filter((favorite) => (
    favorite &&
    typeof favorite.id === 'string' &&
    typeof favorite.nomArret === 'string' &&
    typeof favorite.idLigne === 'string' &&
    typeof favorite.destination === 'string'
  ))
}

// État réactif des favoris
export const favorites = ref([])

// Computed pour vérification rapide
export const favoritesIds = computed(() => new Set(favorites.value.map(f => f.id)))

const persistFavorites = () => {
  const serializedFavorites = JSON.stringify(favorites.value)

  // Les écritures sont mises en file afin qu'une action rapide ne puisse pas
  // terminer avant une sauvegarde plus ancienne et restaurer un état obsolète.
  persistenceQueue = persistenceQueue
    .catch(() => undefined)
    .then(() => Preferences.set({
      key: STORAGE_KEY,
      value: serializedFavorites
    }))
    .catch((error) => {
      console.warn('Erreur lors de la sauvegarde des favoris:', error)
    })
}

const loadLegacyFavorites = () => {
  if (typeof localStorage === 'undefined') return null

  const serializedFavorites = localStorage.getItem(STORAGE_KEY)
  if (serializedFavorites === null) return null

  return deserializeFavorites(serializedFavorites)
}

/**
 * Charge les favoris natifs avant le montage de l'application et migre, si
 * nécessaire, ceux sauvegardés par les anciennes versions dans localStorage.
 */
export const initializeFavorites = () => {
  if (initializationPromise) return initializationPromise

  initializationPromise = (async () => {
    try {
      const { value } = await Preferences.get({ key: STORAGE_KEY })

      if (value !== null) {
        favorites.value = deserializeFavorites(value)
        return
      }

      const legacyFavorites = loadLegacyFavorites()
      if (legacyFavorites === null) return

      favorites.value = legacyFavorites
      await Preferences.set({
        key: STORAGE_KEY,
        value: JSON.stringify(legacyFavorites)
      })

      // L'ancienne copie n'est supprimée qu'une fois l'écriture native réussie.
      localStorage.removeItem(STORAGE_KEY)
    } catch (error) {
      console.warn('Erreur lors du chargement des favoris:', error)

      try {
        const legacyFavorites = loadLegacyFavorites()
        if (legacyFavorites !== null) favorites.value = legacyFavorites
      } catch (legacyError) {
        console.warn('Erreur lors du chargement des anciens favoris:', legacyError)
      }
    }
  })()

  return initializationPromise
}

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
    persistFavorites()
  }
}

/**
 * Supprime un favori
 */
export const removeFavorite = (id) => {
  const index = favorites.value.findIndex(f => f.id === id)
  if (index !== -1) {
    favorites.value.splice(index, 1)
    persistFavorites()
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
  persistFavorites()
}
