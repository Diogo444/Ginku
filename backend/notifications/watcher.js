import { evaluateArrival } from './arrivals.js'

export function createPushWatcher({ store, fetchPassages, sendPush, logger = console }) {
  let timer
  let running = false
  let stopped = false

  async function poll() {
    if (running || stopped) return
    running = true
    try {
      await store.prune()
      // Mutualiser les requêtes pour tous les navigateurs surveillant un même arrêt.
      const byStop = new Map()
      for (const record of store.records.values()) {
        for (const stop of record.stops) {
          const entries = byStop.get(stop.nomArret) || []
          entries.push({ record, stop })
          byStop.set(stop.nomArret, entries)
        }
      }
      for (const [name, entries] of byStop) {
        if (stopped) break
        let passages
        try {
          passages = await fetchPassages(name)
          if (!Array.isArray(passages)) throw new Error('Horaires invalides')
        } catch {
          logger.warn('[web-push] Horaires indisponibles ; nouvel essai au prochain cycle')
          continue
        }
        for (const { record, stop } of entries) {
          // Un favori désactivé pendant une requête ne doit plus produire d'alerte.
          if (stopped || store.records.get(record.id) !== record) continue
          const update = evaluateArrival(stop, passages, record.states[stop.id])
          if (!update?.payload) continue
          try {
            // Les messages périmés ne doivent pas attendre longtemps hors réseau.
            await sendPush(record.subscription, JSON.stringify(update.payload), { TTL: 30, urgency: 'high', timeout: 8000 })
            if (store.records.get(record.id) === record) {
              record.states[stop.id] = update.state
              await store.persist()
            }
          } catch (error) {
            if ([404, 410].includes(error.statusCode)) {
              if (store.records.get(record.id) === record) {
                store.records.delete(record.id)
                await store.persist()
              }
            } else {
              // Ne jamais journaliser l'endpoint, les clés ou la réponse du fournisseur.
              logger.warn('[web-push] Envoi impossible ; nouvel essai au prochain cycle')
            }
          }
        }
      }
    } catch {
      logger.error('[web-push] Cycle de surveillance interrompu')
    } finally {
      running = false
    }
  }

  return {
    poll,
    start() {
      if (timer) return
      stopped = false
      const tick = async () => {
        await poll()
        if (!stopped) timer = setTimeout(tick, 15000)
      }
      timer = setTimeout(tick, 0)
    },
    stop() {
      stopped = true
      clearTimeout(timer)
      timer = undefined
    },
  }
}
