import express from 'express'
import { configDotenv } from 'dotenv'
import axios from 'axios'
import cors from 'cors'
import http from 'http'
import https from 'https'

configDotenv()

const app = express()
const PORT = process.env.PORT || 3000
const APIKEY = process.env.APIKEY

const api = axios.create({
  baseURL: 'https://api.ginko.voyage',
  httpAgent: new http.Agent({ keepAlive: true }),
  httpsAgent: new https.Agent({ keepAlive: true }),
})

app.use(cors())

const cache = new Map()
const TTL = 60 * 1000 // 60 seconds

async function fetchWithCache(key, fetcher) {
  const cached = cache.get(key)
  if (cached && Date.now() - cached.timestamp < TTL) {
    return cached.data
  }
  const data = await fetcher()
  cache.set(key, { data, timestamp: Date.now() })
  return data
}

app.get('/api/search', async (req, res) => {
  try {
    const data = await fetchWithCache('search', async () => {
      const response = await api.get('/DR/getArrets.do', {
        params: { apiKey: APIKEY },
      })
      return response.data.objets
    })
    res.json(data)
  } catch (error) {
    res.status(500).send('Error fetching data')
  }
})

app.get('/api/detailsVehicule/:num', async (req, res) => {
  const { num } = req.params
  try {
    const data = await fetchWithCache(`detailsVehicule-${num}`, async () => {
      const response = await api.get('/DR/getDetailsVehicule.do', {
        params: { apiKey: APIKEY, num },
      })
      return response.data.objets
    })
    res.json(data)
  } catch (error) {
    res.status(500).send('Error fetching data')
  }
})

app.get('/api/getLingnes', async (req, res) => {
  try {
    const data = await fetchWithCache('getLingnes', async () => {
      const response = await api.get('/DR/getLignes.do', {
        params: { apiKey: APIKEY },
      })
      return response.data.objets
    })
    res.json(data)
  } catch (error) {
    res.status(500).send('Error fetching data')
  }
})

app.get('/api/getArretFromLigne/:idLigne/:idVariante', async (req, res) => {
  const { idLigne, idVariante } = req.params
  try {
    const key = `getArretFromLigne-${idLigne}-${idVariante}`
    const data = await fetchWithCache(key, async () => {
      const response = await api.get('/DR/getDetailsVariante.do', {
        params: { apiKey: APIKEY, idLigne, idVariante },
      })
      return response.data.objets
    })
    res.json(data)
  } catch (error) {
    res.status(500).send('Error fetching data')
  }
})

app.get('/api/getVariantesDesservantArret/:idArret', async (req, res) => {
  const { idArret } = req.params
  try {
    const data = await fetchWithCache(`getVariantesDesservantArret-${idArret}`, async () => {
      const response = await api.get('/DR/getVariantesDesservantArret.do', {
        params: { apiKey: APIKEY, idArret },
      })
      return response.data.objets
    })
    res.json(data)
  } catch (error) {
    res.status(500).send('Error fetching data')
  }
})

app.get('/api/getTempsLieu/:nom', async (req, res) => {
  const { nom } = req.params
  try {
    const data = await fetchWithCache(`getTempsLieu-${nom}`, async () => {
      const response = await api.get('/TR/getTempsLieu.do', {
        params: { apiKey: APIKEY, nom, nb: 3 },
      })
      return response.data.objets
    })
    res.json(data)
  } catch (error) {
    res.status(500).send('Error fetching data')
  }
})

// Exemple de route FIXÉE (Axios via `api` + cache par fetcher)
app.get('/api/etatLignes', async (_req, res) => {
  try {
    const data = await fetchWithCache(
      'etatLignes', // 🔑 clé de cache stable
      async () => {
        const { data } = await api.get('/TR/getEtatLignes.do', {
          params: { apiKey: APIKEY },
        })
        // On normalise ce que retourne le fetcher
        return Array.isArray(data?.objets) ? data.objets : null
      },
      60_000, // optionnel: 1 min de TTL
    )

    if (!Array.isArray(data)) {
      // Schéma inattendu de l'API amont
      return res.status(502).json({ error: 'Malformed upstream response' })
    }

    return res.json(data)
  } catch (error) {
    console.error('[/api/etatLignes] error:', error)
    return res.status(502).json({ error: 'Upstream fetch failed' })
  }
})

// backend/serveur.js
app.get('/health', (_req, res) => res.send('ok'))

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
})
