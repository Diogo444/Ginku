import express from 'express'
import { NotificationError } from './validation.js'

export function createNotificationRouter({ store, publicKey, origins }) {
  const router = express.Router()
  const requests = new Map()
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store')
    next()
  })
  router.get('/config', (_req, res) => res.json({ enabled: Boolean(store), publicKey: store ? publicKey : null }))
  router.use((req, res, next) => {
    if (!store) return res.status(503).json({ error: 'Les notifications Web ne sont pas configurées sur le serveur' })
    if (!origins.has(req.get('Origin'))) return res.status(403).json({ error: 'Origine non autorisée' })
    // Limite également la mémoire de ce compteur ; aucun proxy n'est implicitement approuvé.
    const now = Date.now()
    for (const [ip, value] of requests) if (value.until < now) requests.delete(ip)
    const value = requests.get(req.ip) || { count: 0, until: now + 60000 }
    if (++value.count > 60 || requests.size >= 10000) {
      return res.status(429).set('Retry-After', '60').json({ error: 'Trop de demandes, réessayez dans une minute' })
    }
    requests.set(req.ip, value)
    next()
  })
  router.use(express.json({ limit: '32kb' }))
  router.put('/subscriptions', async (req, res) => {
    const body = req.body
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new NotificationError(400, 'Corps JSON requis')
    const credentials = await store.save({ ...body, token: req.get('Authorization')?.replace(/^Bearer /, '') })
    res.json(credentials)
  })
  router.delete('/subscriptions/:id', async (req, res) => {
    await store.remove(req.params.id, req.get('Authorization')?.replace(/^Bearer /, ''))
    res.sendStatus(204)
  })
  router.use((error, _req, res, _next) => {
    const status = error instanceof NotificationError ? error.status : [400, 413, 415].includes(error.status) ? error.status : 500
    if (status === 500) console.error('[web-push] Échec de sauvegarde de l’abonnement')
    res.status(status).json({ error: error instanceof NotificationError ? error.message : status === 500 ? 'Erreur du service de notifications' : 'Corps JSON invalide ou trop volumineux' })
  })
  return router
}
