import axios from 'axios'

/**
 * Client API centralisé pour communiquer avec le backend
 */

const instance = axios.create({
  baseURL: (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, ''),
  timeout: 15000,
  headers: {
    Accept: 'application/json',
  },
})

// Cache simple avec TTL
const cache = new Map()
const inflight = new Map()
const DEFAULT_TTL = 60 * 1000 // 60 secondes

const buildKey = (url, params = {}) => `${url}|${JSON.stringify(params)}`

/**
 * Effectue une requête GET avec cache
 */
async function get(url, config = {}) {
  const key = buildKey(url, config.params || {})
  const cached = cache.get(key)
  const now = Date.now()
  const ttl = config.ttl ?? DEFAULT_TTL

  // Retourne le cache si valide
  if (cached && now - cached.timestamp < ttl) {
    return cached.response
  }

  // Évite les requêtes en double
  if (inflight.has(key)) {
    return inflight.get(key)
  }

  const request = instance
    .get(url, config)
    .then((response) => {
      const safeResponse = response ?? { data: null, status: 200 }
      cache.set(key, { response: safeResponse, timestamp: Date.now() })
      return safeResponse
    })
    .catch((error) => {
      if (axios.isCancel(error)) {
        throw error
      }

      return {
        data: null,
        status: error?.response?.status ?? 0,
        error: true,
        message: error?.message || 'Request failed',
      }
    })
    .finally(() => {
      inflight.delete(key)
    })

  inflight.set(key, request)
  return request
}

/**
 * Vide le cache
 */
function clearCache() {
  cache.clear()
}

/**
 * Vide une entrée spécifique du cache
 */
function invalidateCache(url, params = {}) {
  const key = buildKey(url, params)
  cache.delete(key)
}

// ============================================
// API Methods - Données référentielles (DR)
// ============================================

/**
 * Récupère la liste de tous les arrêts
 */
export async function getArrets(signal) {
  const response = await get('/search', { signal })
  return response.data ?? []
}

/**
 * Récupère la liste des lignes
 */
export async function getLignes(signal) {
  const response = await get('/getLingnes', { signal })
  return response.data ?? []
}

/**
 * Récupère les arrêts d'une variante de ligne
 */
export async function getArretsFromLigne(idLigne, idVariante, signal) {
  const response = await get(`/getArretFromLigne/${idLigne}/${idVariante}`, { signal })
  return response.data ?? []
}

/**
 * Récupère les variantes desservant un arrêt
 */
export async function getVariantesDesservantArret(idArret, signal) {
  const response = await get(`/getVariantesDesservantArret/${idArret}`, { signal })
  return response.data ?? []
}

/**
 * Récupère les détails d'un véhicule
 */
export async function getDetailsVehicule(numVehicule, signal) {
  const response = await get(`/detailsVehicule/${numVehicule}`, { signal })
  return response.data ?? null
}

// ============================================
// API Methods - Temps réel (TR)
// ============================================

/**
 * Récupère les temps d'attente pour un lieu/arrêt
 */
export async function getTempsLieu(nomArret, signal) {
  const response = await get(`/getTempsLieu/${encodeURIComponent(nomArret)}`, { 
    signal,
    ttl: 30 * 1000 // 30 secondes pour les données temps réel
  })
  return response.data ?? null
}

/**
 * Récupère l'état de toutes les lignes (perturbations)
 */
export async function getEtatLignes(signal) {
  const response = await get('/etatLignes', { signal })
  return response.data ?? []
}

/**
 * Récupère les messages d'info trafic pour une ligne
 */
export async function getMessages(idLigne, signal) {
  const response = await get(`/messages/${idLigne}`, { signal })
  return response.data ?? []
}

// Export par défaut pour compatibilité
export default { 
  get, 
  clearCache, 
  invalidateCache,
  getArrets,
  getLignes,
  getArretsFromLigne,
  getVariantesDesservantArret,
  getDetailsVehicule,
  getTempsLieu,
  getEtatLignes,
  getMessages
}
