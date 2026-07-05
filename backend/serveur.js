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
const DEFAULT_TTL = 60 * 1000
const REALTIME_TTL = 15 * 1000
const NEARBY_TTL = 30 * 1000
const VEHICLE_DETAILS_TTL = 24 * 60 * 60 * 1000

const api = axios.create({
  baseURL: 'https://api.ginko.voyage',
  httpAgent: new http.Agent({ keepAlive: true }),
  httpsAgent: new https.Agent({ keepAlive: true }),
})

app.use(cors())

const cache = new Map()
const inflight = new Map()

async function fetchWithCache(key, fetcher, ttl = DEFAULT_TTL) {
  const cached = cache.get(key)
  if (cached && Date.now() - cached.timestamp < ttl) {
    return cached.data
  }

  if (inflight.has(key)) {
    return inflight.get(key)
  }

  const request = Promise.resolve()
    .then(fetcher)
    .then((data) => {
      cache.set(key, { data, timestamp: Date.now() })
      return data
    })
    .finally(() => {
      inflight.delete(key)
    })

  inflight.set(key, request)

  return request
}

function parseCoordinate(value) {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : null
}

function roundedCoordinateKey(latitude, longitude, precision = 3) {
  return `${latitude.toFixed(precision)}:${longitude.toFixed(precision)}`
}

function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function stopMatchScore(stopName, search) {
  const normalizedName = normalizeSearchText(stopName)
  const normalizedSearch = normalizeSearchText(search)

  if (!normalizedSearch) return Number.POSITIVE_INFINITY
  if (normalizedName === normalizedSearch) return 0
  if (normalizedName.startsWith(normalizedSearch)) return 1
  if (normalizedName.includes(normalizedSearch)) return 2

  const searchWords = normalizedSearch.split(' ')
  return searchWords.every((word) => normalizedName.includes(word))
    ? 3
    : Number.POSITIVE_INFINITY
}

async function getAllStops() {
  return fetchWithCache('search', async () => {
    const response = await api.get('/DR/getArrets.do', {
      params: { apiKey: APIKEY },
    })
    return Array.isArray(response?.data?.objets) ? response.data.objets : []
  }, VEHICLE_DETAILS_TTL)
}

async function getServingLines(idArret) {
  return fetchWithCache(`getVariantesDesservantArret-${idArret}`, async () => {
    const response = await api.get('/DR/getVariantesDesservantArret.do', {
      params: { apiKey: APIKEY, idArret },
    })
    return Array.isArray(response?.data?.objets) ? response.data.objets : []
  })
}

async function getVariantStops(idLigne, idVariante) {
  return fetchWithCache(`getArretFromLigne-${idLigne}-${idVariante}`, async () => {
    const response = await api.get('/DR/getDetailsVariante.do', {
      params: { apiKey: APIKEY, idLigne, idVariante },
    })
    return Array.isArray(response?.data?.objets) ? response.data.objets : []
  })
}

async function getWaitTimes(idArret) {
  return fetchWithCache(`getTempsArret-${idArret}`, async () => {
    const response = await api.get('/TR/getTempsLieu.do', {
      params: { apiKey: APIKEY, idArret, nb: 3 },
    })
    return Array.isArray(response?.data?.objets?.listeTemps)
      ? response.data.objets.listeTemps
      : []
  }, REALTIME_TTL)
}

function findStopGroups(stops, search, limit = 5) {
  const groups = new Map()

  for (const stop of stops) {
    const score = stopMatchScore(stop.nom, search)
    if (!Number.isFinite(score)) continue

    const key = normalizeSearchText(stop.nom)
    const group = groups.get(key) ?? {
      nom: stop.nom,
      score,
      arrets: [],
    }
    group.score = Math.min(group.score, score)
    group.arrets.push(stop)
    groups.set(key, group)
  }

  return [...groups.values()]
    .sort((a, b) => a.score - b.score || a.nom.localeCompare(b.nom, 'fr'))
    .slice(0, limit)
}

function flattenServingVariants(lines, stopId) {
  return lines.flatMap((line) =>
    (line.variantes ?? []).map((variant) => ({
      key: `${line.id}:${variant.id}`,
      stopId,
      idLigne: String(line.id),
      numLigne: String(line.numLignePublic),
      libelleLigne: line.libellePublic,
      modeTransport: line.modeTransport,
      idVariante: String(variant.id),
      destination: variant.destination,
      precisionDestination: variant.precisionDestination || '',
    })),
  )
}

function uniqueVariants(variants) {
  const unique = new Map()
  for (const variant of variants) {
    const existing = unique.get(variant.key)
    if (existing) {
      existing.stopIds.add(variant.stopId)
    } else {
      unique.set(variant.key, { ...variant, stopIds: new Set([variant.stopId]) })
    }
  }
  return [...unique.values()]
}

function findIndexForIds(stops, ids, fallbackName) {
  const exactIndex = stops.findIndex((stop) => ids.has(stop.id))
  if (exactIndex >= 0) return exactIndex

  const normalizedName = normalizeSearchText(fallbackName)
  return stops.findIndex((stop) => normalizeSearchText(stop.nom) === normalizedName)
}

function publicStop(stop) {
  return {
    id: stop.id,
    nom: stop.nom,
    latitude: stop.latitude,
    longitude: stop.longitude,
    accessibilite: stop.accessibilite,
  }
}

function publicLeg(variant, from, to, stopCount) {
  return {
    ligne: variant.numLigne,
    idLigne: variant.idLigne,
    idVariante: variant.idVariante,
    direction: variant.destination,
    precisionDirection: variant.precisionDestination,
    montee: publicStop(from),
    descente: publicStop(to),
    nombreArrets: stopCount,
  }
}

app.get('/api/search', async (req, res) => {
  try {
    const data = await getAllStops()
    res.json(data)
  } catch (error) {
    res.status(500).send('Error fetching data')
  }
})

app.get('/api/rechercherArrets', async (req, res) => {
  const recherche = String(req.query.recherche || '').trim()
  if (!recherche) {
    return res.status(400).json({ error: 'Paramètre recherche requis' })
  }

  try {
    const stops = await getAllStops()
    const groups = findStopGroups(stops, recherche)

    const results = await Promise.all(
      groups.map(async (group) => {
        const servingLines = await Promise.all(
          group.arrets.map((stop) => getServingLines(stop.id)),
        )
        const lines = new Map()

        for (const line of servingLines.flat()) {
          const existing = lines.get(String(line.id)) ?? {
            id: String(line.id),
            numero: String(line.numLignePublic),
            libelle: line.libellePublic,
            directions: new Set(),
          }
          for (const variant of line.variantes ?? []) {
            existing.directions.add(variant.destination)
          }
          lines.set(String(line.id), existing)
        }

        return {
          nom: group.nom,
          correspondanceExacte: group.score === 0,
          arrets: group.arrets.map(publicStop),
          lignes: [...lines.values()].map((line) => ({
            ...line,
            directions: [...line.directions],
          })),
        }
      }),
    )

    return res.json({
      recherche,
      resultats: results,
    })
  } catch (error) {
    console.error('[/api/rechercherArrets] error:', error?.response?.data || error)
    return res.status(502).json({ error: 'Erreur lors de la recherche des arrêts' })
  }
})

app.get('/api/itineraire', async (req, res) => {
  const depart = String(req.query.depart || '').trim()
  const arrivee = String(req.query.arrivee || '').trim()

  if (!depart || !arrivee) {
    return res.status(400).json({ error: 'Paramètres depart et arrivee requis' })
  }

  try {
    const allStops = await getAllStops()
    const departureGroup = findStopGroups(allStops, depart, 1)[0]
    const arrivalGroup = findStopGroups(allStops, arrivee, 1)[0]

    if (!departureGroup || !arrivalGroup) {
      return res.status(404).json({
        error: 'Arrêt de départ ou d’arrivée introuvable',
        departTrouve: departureGroup?.nom ?? null,
        arriveeTrouvee: arrivalGroup?.nom ?? null,
      })
    }

    const [departureLines, arrivalLines] = await Promise.all([
      Promise.all(departureGroup.arrets.map((stop) => getServingLines(stop.id))),
      Promise.all(arrivalGroup.arrets.map((stop) => getServingLines(stop.id))),
    ])

    const departureVariants = uniqueVariants(
      departureLines.flatMap((lines, index) =>
        flattenServingVariants(lines, departureGroup.arrets[index].id),
      ),
    )
    const arrivalVariants = uniqueVariants(
      arrivalLines.flatMap((lines, index) =>
        flattenServingVariants(lines, arrivalGroup.arrets[index].id),
      ),
    )
    const allVariants = uniqueVariants([...departureVariants, ...arrivalVariants])

    const variantStops = new Map(
      await Promise.all(
        allVariants.map(async (variant) => [
          variant.key,
          await getVariantStops(variant.idLigne, variant.idVariante),
        ]),
      ),
    )

    const options = []
    const arrivalByKey = new Map(arrivalVariants.map((variant) => [variant.key, variant]))

    for (const first of departureVariants) {
      const stops = variantStops.get(first.key) ?? []
      const departureIndex = findIndexForIds(stops, first.stopIds, departureGroup.nom)
      const matchingArrival = arrivalByKey.get(first.key)
      if (!matchingArrival || departureIndex < 0) continue

      const arrivalIndex = findIndexForIds(
        stops,
        matchingArrival.stopIds,
        arrivalGroup.nom,
      )
      if (arrivalIndex <= departureIndex) continue

      options.push({
        type: 'direct',
        nombreCorrespondances: 0,
        nombreArrets: arrivalIndex - departureIndex,
        etapes: [
          publicLeg(
            first,
            stops[departureIndex],
            stops[arrivalIndex],
            arrivalIndex - departureIndex,
          ),
        ],
      })
    }

    for (const first of departureVariants) {
      const firstStops = variantStops.get(first.key) ?? []
      const departureIndex = findIndexForIds(
        firstStops,
        first.stopIds,
        departureGroup.nom,
      )
      if (departureIndex < 0) continue

      for (const second of arrivalVariants) {
        if (first.idLigne === second.idLigne) continue

        const secondStops = variantStops.get(second.key) ?? []
        const arrivalIndex = findIndexForIds(
          secondStops,
          second.stopIds,
          arrivalGroup.nom,
        )
        if (arrivalIndex <= 0) continue

        const secondStopsBeforeArrival = new Map()
        for (let index = 0; index < arrivalIndex; index += 1) {
          secondStopsBeforeArrival.set(normalizeSearchText(secondStops[index].nom), index)
        }

        let bestTransfer = null
        for (let firstIndex = departureIndex + 1; firstIndex < firstStops.length; firstIndex += 1) {
          const transferName = normalizeSearchText(firstStops[firstIndex].nom)
          const secondIndex = secondStopsBeforeArrival.get(transferName)
          if (secondIndex == null) continue

          const totalStops =
            firstIndex - departureIndex + arrivalIndex - secondIndex
          if (!bestTransfer || totalStops < bestTransfer.totalStops) {
            bestTransfer = { firstIndex, secondIndex, totalStops }
          }
        }

        if (!bestTransfer) continue

        options.push({
          type: 'une_correspondance',
          nombreCorrespondances: 1,
          nombreArrets: bestTransfer.totalStops,
          correspondance: {
            nom: firstStops[bestTransfer.firstIndex].nom,
            arrivee: publicStop(firstStops[bestTransfer.firstIndex]),
            depart: publicStop(secondStops[bestTransfer.secondIndex]),
          },
          etapes: [
            publicLeg(
              first,
              firstStops[departureIndex],
              firstStops[bestTransfer.firstIndex],
              bestTransfer.firstIndex - departureIndex,
            ),
            publicLeg(
              second,
              secondStops[bestTransfer.secondIndex],
              secondStops[arrivalIndex],
              arrivalIndex - bestTransfer.secondIndex,
            ),
          ],
        })
      }
    }

    const deduplicatedOptions = new Map()
    for (const option of options) {
      const key = option.etapes
        .map((leg) => `${leg.idVariante}:${leg.montee.nom}:${leg.descente.nom}`)
        .join('|')
      const existing = deduplicatedOptions.get(key)
      if (!existing || option.nombreArrets < existing.nombreArrets) {
        deduplicatedOptions.set(key, option)
      }
    }

    const optionsToRank = [...deduplicatedOptions.values()]
    const departureStopIds = [
      ...new Set(optionsToRank.map((option) => option.etapes[0].montee.id)),
    ]
    const waitTimesByStop = new Map(
      await Promise.all(
        departureStopIds.map(async (stopId) => [stopId, await getWaitTimes(stopId)]),
      ),
    )

    for (const option of optionsToRank) {
      const firstLeg = option.etapes[0]
      const knownDepartures = (waitTimesByStop.get(firstLeg.montee.id) ?? [])
        .filter(
          (wait) =>
            String(wait.idLigne) === firstLeg.idLigne &&
            normalizeSearchText(wait.destination) ===
              normalizeSearchText(firstLeg.direction),
        )
        .slice(0, 3)
        .map((wait) => ({
          temps: wait.temps,
          tempsEnSeconde: wait.tempsEnSeconde,
          fiable: wait.fiable,
          destination: wait.destination,
          precisionDestination: wait.precisionDestination,
          accessibiliteVehicule: wait.accessibiliteVehicule,
          affluence: wait.affluence,
        }))

      firstLeg.prochainsDeparts = knownDepartures
      option.departImmediatConfirme = knownDepartures.length > 0
    }

    const sortedOptions = optionsToRank
      .sort(
        (a, b) =>
          Number(b.departImmediatConfirme) - Number(a.departImmediatConfirme) ||
          a.nombreCorrespondances - b.nombreCorrespondances ||
          a.nombreArrets - b.nombreArrets,
      )
      .slice(0, 10)

    return res.json({
      depart: {
        recherche: depart,
        nom: departureGroup.nom,
        correspondanceExacte: departureGroup.score === 0,
      },
      arrivee: {
        recherche: arrivee,
        nom: arrivalGroup.nom,
        correspondanceExacte: arrivalGroup.score === 0,
      },
      options: sortedOptions,
      verifieAvecDonneesGinko: true,
      limite:
        'Itinéraires calculés selon les variantes du jour. Le départ de la première ligne est vérifié en temps réel lorsqu’un prochain passage est disponible, mais les horaires aux correspondances ne sont pas prédits.',
    })
  } catch (error) {
    console.error('[/api/itineraire] error:', error?.response?.data || error)
    return res.status(502).json({ error: 'Erreur lors du calcul de l’itinéraire' })
  }
})

app.get('/api/detailsVehicule/:num', async (req, res) => {
  const { num } = req.params
  try {
    const data = await fetchWithCache(`detailsVehicule-${num}`, async () => {
      const response = await api.get('/DR/getDetailsVehicule.do', {
        params: { apiKey: APIKEY, num },
      })
      return response?.data?.objets ?? null
    }, VEHICLE_DETAILS_TTL)
    res.json(data)
  } catch (error) {
    res.status(500).send('Error fetching data')
  }
})

app.get('/api/detailsVehiculeTempsReel/:num', async (req, res) => {
  const { num } = req.params
  try {
    const data = await fetchWithCache(`detailsVehiculeTempsReel-${num}`, async () => {
      const response = await api.get('/TR/getDetailsVehicule.do', {
        params: { apiKey: APIKEY, num },
      })
      return response?.data?.objets ?? null
    }, REALTIME_TTL)
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
    }, REALTIME_TTL)
    res.json(data)
  } catch (error) {
    res.status(500).send('Error fetching data')
  }
})

app.get('/api/getTempsArret/:idArret', async (req, res) => {
  const idArret = String(req.params.idArret || '').trim()

  if (!idArret) {
    return res.status(400).json({ error: 'Paramètre idArret requis' })
  }

  try {
    const data = await fetchWithCache(`getTempsArret-${idArret}`, async () => {
      const response = await api.get('/TR/getTempsLieu.do', {
        params: { apiKey: APIKEY, idArret, nb: 3 },
      })
      return response?.data?.objets ?? null
    }, REALTIME_TTL)

    return res.json(data)
  } catch (error) {
    console.error(`[/api/getTempsArret/${idArret}] error:`, error?.response?.data || error)
    return res.status(502).json({ error: 'Error fetching data' })
  }
})

app.get('/api/getArretsProches', async (req, res) => {
  const latitude = parseCoordinate(req.query.latitude)
  const longitude = parseCoordinate(req.query.longitude)

  if (latitude == null || longitude == null) {
    return res.status(400).json({ error: 'Paramètres latitude et longitude requis' })
  }

  const cacheKey = `getArretsProches-${roundedCoordinateKey(latitude, longitude)}`

  try {
    const data = await fetchWithCache(cacheKey, async () => {
      const response = await api.get('/DR/getArretsProches.do', {
        params: { apiKey: APIKEY, latitude, longitude },
      })
      return Array.isArray(response?.data?.objets) ? response.data.objets : []
    }, NEARBY_TTL)

    return res.json(data)
  } catch (error) {
    console.error('[/api/getArretsProches] error:', error?.response?.data || error)
    return res.status(502).json({ error: 'Error fetching data' })
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

app.get('/api/messages/:idLigne', async (req, res) => {
  const idLigne = String(req.params.idLigne || '').trim()
  if (!idLigne) {
    return res.status(400).json({ error: 'Paramètre idLigne requis' })
  }

  try {
    // Même base que l’URL appelée + clé unique par idLigne (et apiKey si besoin)
    const cacheKey = `/TR/getMessages.do?apiKey=${APIKEY}&idLignes=${encodeURIComponent(idLigne)}`

    const data = await fetchWithCache(cacheKey, async () => {
      const response = await api.get('/TR/getMessages.do', {
        params: { apiKey: APIKEY, idLignes: idLigne }, // 'idLignes' (pluriel) si l’API l’exige
      })
      return response?.data.objets ?? []
    })

    res.json(data)
  } catch (error) {
    console.error('Error fetching /DR/getMessages.do:', error?.response?.data || error)
    res.status(502).json({ error: 'Error fetching data' })
  }
})

// backend/serveur.js
app.get('/health', (_req, res) => res.send('ok'))

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
})
