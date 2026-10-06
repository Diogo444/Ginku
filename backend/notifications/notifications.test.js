import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createECDH } from 'node:crypto'
import express from 'express'
import { evaluateArrival } from './arrivals.js'
import { createSubscriptionStore } from './store.js'
import { createPushWatcher } from './watcher.js'
import { createNotificationRouter } from './routes.js'
import { validateSubscription, validateStops } from './validation.js'

const stop = { id: 'gare-t1', nomArret: 'Gare Viotte', idLigne: '1', numLigne: 'T1', destination: 'Hauts du Chazal' }
const passage = (seconds, vehicle = '42') => ({ idLigne: '1', destination: stop.destination, tempsEnSeconde: seconds, numVehicule: vehicle })
const ecdh = createECDH('prime256v1')
ecdh.generateKeys()
const subscription = (suffix = 'one') => ({
  endpoint: `https://fcm.googleapis.com/fcm/send/${suffix}`,
  keys: { p256dh: ecdh.getPublicKey().toString('base64url'), auth: Buffer.alloc(16, 1).toString('base64url') },
})

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'ginku-push-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const path = join(directory, 'subscriptions.json')
  return { path, store: await createSubscriptionStore(path) }
}

test('alertes à 2 et 1 minute, sans doublon pour le même véhicule', () => {
  assert.equal(evaluateArrival(stop, [passage(240)], null).payload, null)
  const first = evaluateArrival(stop, [passage(120)], null)
  assert.match(first.payload.body, /2 min/)
  assert.equal(evaluateArrival(stop, [passage(110)], first.state).payload, null)
  const second = evaluateArrival(stop, [passage(60)], first.state)
  assert.match(second.payload.body, /1 min/)
  assert.equal(evaluateArrival(stop, [passage(0)], second.state).payload, null)
  assert.ok(evaluateArrival(stop, [passage(120, '43')], second.state).payload)
})

test('première observation à moins de 1 minute : une seule alerte', () => {
  const update = evaluateArrival(stop, [passage(30)], null)
  assert.deepEqual(update.state.notified, [2, 1])
  assert.equal(evaluateArrival(stop, [passage(10)], update.state).payload, null)
})

test('ne pas alerter pour une autre direction ou des horaires invalides', () => {
  for (const values of [[], [{ ...passage(60), destination: 'Autre' }], [passage(-1)], [passage('60')]]) {
    assert.equal(evaluateArrival(stop, values, null), null)
  }
})

test('sans numéro de véhicule, distingue un nouveau passage éloigné', () => {
  const first = evaluateArrival(stop, [passage(60, '')], null)
  assert.equal(evaluateArrival(stop, [passage(60, '')], first.state).payload, null)
  const older = { ...first.state, arrivalAt: first.state.arrivalAt - 180000 }
  assert.ok(evaluateArrival(stop, [passage(60, '')], older).payload)
})

test('refuse endpoints privés, HTTP, fournisseurs inconnus et clés incorrectes', () => {
  for (const endpoint of ['https://127.0.0.1/push', 'http://fcm.googleapis.com/push', 'https://example.com/push', 'https://fcm.googleapis.com:8443/push', 'https://user@fcm.googleapis.com/push']) {
    assert.throws(() => validateSubscription({ ...subscription(), endpoint }), { status: 400 })
  }
  assert.throws(() => validateSubscription({ ...subscription(), keys: { auth: 'x', p256dh: 'x' } }), { status: 400 })
  assert.equal(validateSubscription(subscription()).endpoint, subscription().endpoint)
})

test('valide les favoris, borne le nombre et refuse doublons et entrées invalides', () => {
  assert.deepEqual(validateStops([stop]), [stop])
  for (const values of [null, [stop, stop], Array(21).fill(stop), [{ ...stop, nomArret: '' }]]) {
    assert.throws(() => validateStops(values), { status: 400 })
  }
})

test('abonnements et seuils survivent à un redémarrage ; mutations authentifiées', async (t) => {
  const { store, path } = await fixture(t)
  const credentials = await store.save({ subscription: subscription(), stops: [stop] })
  await assert.rejects(store.save({ id: credentials.id, token: 'wrong', subscription: subscription(), stops: [] }), { status: 401 })
  await assert.rejects(store.remove(credentials.id, 'wrong'), { status: 401 })
  await assert.rejects(store.save({ subscription: subscription(), stops: [] }), { status: 409 })
  store.records.get(credentials.id).states[stop.id] = evaluateArrival(stop, [passage(60)], null).state
  await store.persist()
  const restored = await createSubscriptionStore(path)
  assert.deepEqual(restored.records.get(credentials.id).states[stop.id].notified, [2, 1])
  await restored.remove(credentials.id, credentials.token)
  assert.equal((await createSubscriptionStore(path)).records.size, 0)
})

test('supprime les abonnements après 30 jours sans synchronisation', async (t) => {
  const { store, path } = await fixture(t)
  const credentials = await store.save({ subscription: subscription(), stops: [stop] })
  store.records.get(credentials.id).updatedAt = Date.now() - 31 * 86400000
  await store.prune()
  assert.equal((await createSubscriptionStore(path)).records.size, 0)
})

test('un stockage corrompu est signalé sans être écrasé', async (t) => {
  const { path } = await fixture(t)
  await writeFile(path, '{invalid')
  await assert.rejects(createSubscriptionStore(path))
})

test('mutualise les horaires, persiste les seuils et ne renvoie pas au prochain cycle', async (t) => {
  const { store } = await fixture(t)
  await store.save({ subscription: subscription('one'), stops: [stop] })
  await store.save({ subscription: subscription('two'), stops: [stop] })
  let requests = 0
  const sent = []
  const watcher = createPushWatcher({ store, fetchPassages: async () => { requests++; return [passage(120)] }, sendPush: async (...args) => sent.push(args) })
  await watcher.poll()
  assert.equal(requests, 1)
  assert.equal(sent.length, 2)
  assert.equal(sent[0][2].TTL, 30)
  assert.equal(sent[0][2].timeout, 8000)
  await watcher.poll()
  assert.equal(sent.length, 2)
})

test('réessaie après erreur réseau ; supprime un abonnement push expiré', async (t) => {
  const { store } = await fixture(t)
  await store.save({ subscription: subscription(), stops: [stop] })
  let error = new Error('network')
  let attempts = 0
  const watcher = createPushWatcher({ store, fetchPassages: async () => [passage(60)], sendPush: async () => { attempts++; if (error) throw error }, logger: { warn() {}, error() {} } })
  await watcher.poll()
  error = null
  await watcher.poll()
  assert.equal(attempts, 2)
  store.records.values().next().value.states = {}
  error = Object.assign(new Error('expired'), { statusCode: 410 })
  await watcher.poll()
  assert.equal(store.records.size, 0)
})

test('un arrêt désactivé pendant la requête ne déclenche pas de push', async (t) => {
  const { store } = await fixture(t)
  const credentials = await store.save({ subscription: subscription(), stops: [stop] })
  let sends = 0
  const watcher = createPushWatcher({
    store,
    fetchPassages: async () => {
      await store.save({ ...credentials, subscription: subscription(), stops: [] })
      return [passage(60)]
    },
    sendPush: async () => { sends++ },
  })
  await watcher.poll()
  assert.equal(sends, 0)
})

test('API HTTP : configuration, création, validation, autorisation et suppression', async (t) => {
  const { store } = await fixture(t)
  const app = express()
  app.use('/api/notifications', createNotificationRouter({ store, publicKey: 'test-public-key', origins: new Set(['http://localhost:5173']) }))
  const server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  t.after(() => new Promise((resolve) => server.close(resolve)))
  const base = `http://127.0.0.1:${server.address().port}/api/notifications`
  const headers = { Origin: 'http://localhost:5173', 'Content-Type': 'application/json' }
  const config = await fetch(`${base}/config`)
  assert.equal(config.headers.get('cache-control'), 'no-store')
  assert.equal((await config.json()).enabled, true)
  const body = JSON.stringify({ subscription: subscription(), stops: [stop] })
  assert.equal((await fetch(`${base}/subscriptions`, { method: 'PUT', headers: { ...headers, Origin: 'https://evil.example' }, body })).status, 403)
  assert.equal((await fetch(`${base}/subscriptions`, { method: 'PUT', headers, body: '{}' })).status, 400)
  assert.equal((await fetch(`${base}/subscriptions`, { method: 'PUT', headers, body: '{' })).status, 400)
  const response = await fetch(`${base}/subscriptions`, { method: 'PUT', headers, body })
  assert.equal(response.status, 200)
  const credentials = await response.json()
  assert.equal((await fetch(`${base}/subscriptions/${credentials.id}`, { method: 'DELETE', headers })).status, 401)
  assert.equal((await fetch(`${base}/subscriptions/${credentials.id}`, { method: 'DELETE', headers: { ...headers, Authorization: `Bearer ${credentials.token}` } })).status, 204)
})

test('API HTTP désactivée sans configuration VAPID : refus explicite', async (t) => {
  const app = express()
  app.use(createNotificationRouter({ store: null, origins: new Set() }))
  const server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  t.after(() => new Promise((resolve) => server.close(resolve)))
  const base = `http://127.0.0.1:${server.address().port}`
  assert.deepEqual(await (await fetch(`${base}/config`)).json(), { enabled: false, publicKey: null })
  assert.equal((await fetch(`${base}/subscriptions`, { method: 'PUT' })).status, 503)
})
