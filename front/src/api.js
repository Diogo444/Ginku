import axios from 'axios'

const instance = axios.create({
  baseURL: (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, ''),
  timeout: 12000,
  headers: {
    Accept: 'application/json',
  },
})

const cache = new Map()
const inflight = new Map()
const TTL = 60 * 1000 // 60 seconds

const buildKey = (url, params = {}) => `${url}|${JSON.stringify(params)}`

async function get(url, config = {}) {
  const key = buildKey(url, config.params || {})
  const cached = cache.get(key)
  const now = Date.now()

  if (cached && now - cached.timestamp < TTL) {
    return cached.response
  }

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

function clearCache() {
  cache.clear()
}

export default { get, clearCache }
