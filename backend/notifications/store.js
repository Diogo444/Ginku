import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { NotificationError, validateStops, validateSubscription } from './validation.js'

const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

/** Stockage atomique pour un seul processus backend. Le fichier contient des
 * capacités secrètes : ne pas l'exposer via HTTP ni le versionner. */
export async function createSubscriptionStore(path) {
  let entries = []
  try {
    entries = JSON.parse(await readFile(path, 'utf8'))
    if (!Array.isArray(entries)) throw new Error('Format du stockage push invalide')
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  const records = new Map(entries.filter((entry) => entry.updatedAt > Date.now() - MAX_AGE_MS)
    .map((entry) => {
      if (typeof entry.id !== 'string' || typeof entry.token !== 'string') {
        throw new Error('Identifiants push sauvegardés invalides')
      }
      return [entry.id, { ...entry, subscription: validateSubscription(entry.subscription), stops: validateStops(entry.stops) }]
    }))
  let queue = Promise.resolve()
  const persist = () => {
    const snapshot = JSON.stringify([...records.values()])
    queue = queue.catch(() => undefined).then(async () => {
      await mkdir(dirname(path), { recursive: true })
      await writeFile(`${path}.tmp`, snapshot, { mode: 0o600 })
      await rename(`${path}.tmp`, path)
    })
    return queue
  }

  function authorized(id, token) {
    const record = records.get(id)
    const supplied = Buffer.from(typeof token === 'string' ? token : '')
    const expected = Buffer.from(record?.token || '')
    if (!record || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      throw new NotificationError(401, 'Abonnement inconnu ou autorisation invalide')
    }
    return record
  }

  return {
    records,
    persist,
    async save({ id, token, subscription, stops }) {
      const previous = id ? authorized(id, token) : null
      const validated = validateSubscription(subscription)
      const watched = validateStops(stops)
      if ([...records.values()].some((record) => record.id !== id && record.subscription.endpoint === validated.endpoint)) {
        throw new NotificationError(409, 'Ce navigateur possède déjà un abonnement. Réinitialisez ses notifications.')
      }
      if (!previous && records.size >= 1000) throw new NotificationError(503, 'Capacité de surveillance atteinte')
      const record = {
        id: previous?.id || randomBytes(16).toString('hex'),
        token: previous?.token || randomBytes(32).toString('hex'),
        subscription: validated,
        stops: watched,
        updatedAt: Date.now(),
        states: Object.fromEntries(watched.map((stop) => [stop.id, previous?.states?.[stop.id] || null])),
      }
      records.set(record.id, record)
      try {
        await persist()
      } catch (error) {
        if (previous) records.set(record.id, previous)
        else records.delete(record.id)
        throw error
      }
      return { id: record.id, token: record.token }
    },
    async remove(id, token) {
      const record = authorized(id, token)
      records.delete(id)
      try {
        await persist()
      } catch (error) {
        records.set(id, record)
        throw error
      }
    },
    async prune() {
      let changed = false
      for (const [id, record] of records) {
        if (record.updatedAt <= Date.now() - MAX_AGE_MS) {
          records.delete(id)
          changed = true
        }
      }
      if (changed) await persist()
    },
  }
}
