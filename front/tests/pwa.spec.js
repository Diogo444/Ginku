import { test, expect } from '@playwright/test'
import { createECDH } from 'node:crypto'
import { Buffer } from 'node:buffer'

const stop = { id: 'gare-t1', nomArret: 'Gare Viotte', idLigne: '1', numLigne: 'T1', destination: 'Hauts du Chazal', notifyEnabled: false }
const ecdh = createECDH('prime256v1')
ecdh.generateKeys()
const publicKey = ecdh.getPublicKey().toString('base64url')
const subscription = { endpoint: 'https://fcm.googleapis.com/fcm/send/test', keys: { p256dh: publicKey, auth: Buffer.alloc(16).toString('base64url') } }

async function setup(context, { enabled = true, permission = 'granted', failSave = false, unsupported = false, initialFavorites = [stop], storage = 'legacy' } = {}) {
  const saves = []
  const deletes = []
  await context.addInitScript(({ initialFavorites, storage, subscription, permission, unsupported }) => {
    if (!localStorage.getItem('CapacitorStorage.ginku-favorites')) {
      localStorage.setItem(storage === 'preferences' ? 'CapacitorStorage.ginku-favorites' : 'ginku-favorites', JSON.stringify(initialFavorites))
    }
    if (unsupported) {
      delete window.PushManager
      return
    }
    // Le transport du fournisseur push est simulé ; le service worker est réel.
    Object.defineProperty(Notification, 'permission', { get: () => permission })
    Notification.requestPermission = async () => permission
    let current = null
    PushManager.prototype.getSubscription = async () => current
    PushManager.prototype.subscribe = async () => {
      current = { toJSON: () => subscription, unsubscribe: async () => { current = null; return true } }
      return current
    }
  }, { initialFavorites, storage, subscription, permission, unsupported })
  await context.route('**/api/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    let body = []
    let status = 200
    if (path.endsWith('/notifications/config')) body = { enabled, publicKey: enabled ? publicKey : null }
    else if (path.endsWith('/notifications/subscriptions') && request.method() === 'PUT') {
      saves.push(request.postDataJSON())
      body = failSave ? { error: 'Sauvegarde indisponible' } : { id: 'test-id', token: 'test-token' }
      status = failSave ? 503 : 200
    } else if (request.method() === 'DELETE') {
      deletes.push(path)
      body = null
      status = 204
    } else if (path.includes('/getTempsLieu/')) body = { listeTemps: [{ idLigne: '1', destination: stop.destination, tempsEnSeconde: 120, tempsTexte: '2 min', numVehicule: '42' }] }
    await route.fulfill({ status, contentType: 'application/json', body: status === 204 ? '' : JSON.stringify(body) })
  })
  return { saves, deletes }
}

async function ready(page) {
  await page.goto('/')
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true))
  await expect(page.getByRole('switch')).toBeVisible()
}

test('manifeste et icônes installables, navigation au clavier et zones tactiles', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await setup(context)
  await ready(page)
  const manifest = await (await page.request.get('/manifest.json')).json()
  expect(manifest.display).toBe('standalone')
  for (const icon of manifest.icons) expect((await page.request.get(icon.src)).ok()).toBe(true)
  const toggle = page.getByRole('switch')
  await toggle.focus()
  await expect(toggle).toBeFocused()
  const size = await toggle.boundingBox()
  expect(size.width).toBeGreaterThanOrEqual(44)
  expect(size.height).toBeGreaterThanOrEqual(44)
  expect(await toggle.evaluate((element) => element.closest('a'))).toBe(null)
  await page.screenshot({ path: 'test-results/pwa-mobile.png', fullPage: true })
})

test('active au clavier, conserve le choix et désactive la surveillance serveur', async ({ page, context }) => {
  const { saves, deletes } = await setup(context)
  await ready(page)
  const toggle = page.getByRole('switch')
  await toggle.focus()
  await page.keyboard.press('Space')
  await expect(toggle).toHaveAttribute('aria-checked', 'true')
  await expect(toggle).toBeEnabled()
  expect(saves.at(-1).stops[0].nomArret).toBe(stop.nomArret)
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('CapacitorStorage.ginku-favorites'))[0].notifyEnabled)).toBe(true)
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-checked', 'false')
  await expect(toggle).toBeEnabled()
  expect(deletes).toContain('/api/notifications/subscriptions/test-id')
})

test('permission refusée : message accessible et aucune surveillance créée', async ({ page, context }) => {
  const { saves } = await setup(context, { permission: 'denied' })
  await ready(page)
  await page.getByRole('switch').click()
  await expect(page.getByRole('alert')).toContainText('réglages du navigateur')
  await expect(page.getByRole('switch')).toHaveAttribute('aria-checked', 'false')
  expect(saves).toHaveLength(0)
})

test('serveur non configuré : erreur explicite et favori désactivé', async ({ page, context }) => {
  await setup(context, { enabled: false })
  await ready(page)
  await page.getByRole('switch').click()
  await expect(page.getByRole('alert')).toContainText('pas encore activées sur le serveur')
  await expect(page.getByRole('switch')).toHaveAttribute('aria-checked', 'false')
})

test('navigateur incompatible : explication visible et cloche masquée', async ({ page, context }) => {
  await setup(context, { unsupported: true })
  await page.goto('/')
  await expect(page.getByText('Les notifications ne sont pas disponibles dans ce navigateur.', { exact: false })).toBeVisible()
  await expect(page.getByRole('switch')).toHaveCount(0)
})

test('erreur de sauvegarde : annule le choix et affiche une erreur', async ({ page, context }) => {
  await setup(context, { failSave: true })
  await ready(page)
  await page.getByRole('switch').click()
  await expect(page.getByRole('switch')).toBeEnabled()
  await expect(page.getByRole('switch')).toHaveAttribute('aria-checked', 'false')
  await expect(page.getByText('Sauvegarde indisponible').first()).toBeVisible()
})

test('interface et routes disponibles hors ligne, API jamais mise en cache', async ({ page, context }) => {
  await setup(context)
  await ready(page)
  await page.reload()
  await context.setOffline(true)
  await page.goto('/lignes')
  await expect(page.getByRole('heading', { name: 'Le Réseau', exact: true })).toBeVisible()
  await page.goto('/')
  await expect(page.getByText('Hors ligne : les horaires en temps réel sont indisponibles.')).toBeVisible()
  const cachedUrls = await page.evaluate(async () => {
    const keys = await caches.keys()
    const requests = await Promise.all(keys.map(async (key) => (await caches.open(key)).keys()))
    return requests.flat().map((request) => request.url)
  })
  expect(cachedUrls.some((url) => new URL(url).pathname.startsWith('/api/'))).toBe(false)
})

test('réception push par le service worker après fermeture de la page', async ({ page, context }) => {
  await setup(context)
  await context.grantPermissions(['notifications'], { origin: 'http://localhost:4173' })
  const cdp = await context.newCDPSession(page)
  const registrations = []
  cdp.on('ServiceWorker.workerRegistrationUpdated', (event) => registrations.push(...event.registrations))
  await cdp.send('ServiceWorker.enable')
  await ready(page)
  await expect.poll(() => registrations.find((entry) => entry.scopeURL === 'http://localhost:4173/')).toBeTruthy()
  const registrationId = registrations.find((entry) => entry.scopeURL === 'http://localhost:4173/').registrationId
  const worker = context.serviceWorkers()[0]
  // Détacher la page du site tout en conservant la session DevTools qui injecte le push.
  await page.goto('about:blank')
  await cdp.send('ServiceWorker.deliverPushMessage', {
    origin: 'http://localhost:4173', registrationId,
    data: JSON.stringify({ title: 'Ginku test', body: 'T1 arrive dans 2 min', tag: 'test-arrival', url: '/arret/Gare%20Viotte' }),
  })
  await expect.poll(() => worker.evaluate(async () => (await self.registration.getNotifications()).map((notification) => notification.title))).toContain('Ginku test')
  await worker.evaluate(async () => { for (const notification of await self.registration.getNotifications()) notification.close() })
})


test('délais par favori : modification au clavier, transmission et persistance', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const { saves } = await setup(context)
  await ready(page)
  await page.getByRole('switch').click()
  await expect(page.getByRole('switch')).toBeEnabled()
  const summary = page.getByRole('button', { name: /Régler les notifications/ })
  await summary.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog', { name: 'Délais de notification' })).toBeVisible()
  await expect(page.getByLabel('Prévenir avant (min)')).toBeFocused()
  await page.getByLabel('Prévenir avant (min)').fill('8')
  await page.getByLabel('Intervalle de rappel (min)').fill('3')
  await page.screenshot({ path: 'test-results/notification-modal-mobile.png', fullPage: true })
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await expect(summary).toBeFocused()
  await expect(summary).toContainText('8 / 3 min')
  await expect.poll(() => saves.at(-1)?.stops[0]?.notifyBeforeMinutes).toBe(8)
  expect(saves.at(-1).stops[0].notifyIntervalMinutes).toBe(3)
  // Attendre le debounce pour détecter un second envoi superflu après la sauvegarde.
  await page.waitForTimeout(400)
  expect(saves.filter(save => save.stops[0]?.notifyBeforeMinutes === 8)).toHaveLength(1)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: 'test-results/notification-timing-mobile.png', fullPage: true })
  await page.reload()
  await expect(summary).toContainText('8 / 3 min')
})


test('modale : focus contenu, Échap annule et aucune synchronisation sans changement', async ({ page, context }) => {
  const { saves } = await setup(context)
  await ready(page)
  const trigger = page.getByRole('button', { name: /Régler les notifications/ })
  await trigger.click()
  await page.getByLabel('Prévenir avant (min)').fill('9')
  await page.keyboard.press('Shift+Tab')
  await expect(page.getByRole('button', { name: 'Enregistrer', exact: true })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByLabel('Prévenir avant (min)')).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await expect(trigger).toBeFocused()
  await expect(trigger).toContainText('2 / 1 min')
  await trigger.click()
  await expect(page.getByLabel('Prévenir avant (min)')).toHaveValue('2')
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click()
  expect(saves).toHaveLength(0)
})


test('délais désactivés : sauvegarde locale sans appel push', async ({ page, context }) => {
  const { saves } = await setup(context)
  await ready(page)
  const trigger = page.getByRole('button', { name: /Régler les notifications/ })
  await trigger.click()
  await page.getByLabel('Prévenir avant (min)').fill('8')
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click()
  await expect(trigger).toContainText('8 / 1 min')
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('CapacitorStorage.ginku-favorites'))[0].notifyBeforeMinutes)).toBe(8)
  expect(saves).toHaveLength(0)
})

test('erreur dans la modale : conserve la saisie et permet de réessayer', async ({ page, context }) => {
  await setup(context)
  await ready(page)
  await page.getByRole('switch').click()
  await expect(page.getByRole('switch')).toBeEnabled()
  let failed = true
  await context.route('**/api/notifications/subscriptions', async route => {
    await route.fulfill({ status: failed ? 503 : 200, contentType: 'application/json', body: JSON.stringify(failed ? { error: 'Sauvegarde indisponible' } : { id: 'test-id', token: 'test-token' }) })
  })
  const trigger = page.getByRole('button', { name: /Régler les notifications/ })
  await trigger.click()
  await page.getByLabel('Prévenir avant (min)').fill('8')
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('alert')).toHaveText('Sauvegarde indisponible')
  await expect(page.getByLabel('Prévenir avant (min)')).toHaveValue('8')
  await expect(trigger).toContainText('2 / 1 min')
  failed = false
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await expect(trigger).toContainText('8 / 1 min')
})


for (const storage of ['legacy', 'preferences']) {
  test(`anciens favoris (${storage}) : migration sans perte et délais accessibles`, async ({ page, context }) => {
    const old = { ...stop }
    delete old.notifyEnabled
    const custom = { ...stop, id: 'gare-custom', notifyBeforeMinutes: 8, notifyIntervalMinutes: 3 }
    await setup(context, { initialFavorites: [old, custom], storage })
    await page.goto('/')
    const triggers = page.getByRole('button', { name: /Régler les notifications/ })
    await expect(triggers).toHaveCount(2)
    await expect(triggers.nth(0)).toContainText('2 / 1 min')
    await expect(triggers.nth(1)).toContainText('8 / 3 min')
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('CapacitorStorage.ginku-favorites')))).toEqual([
      { ...old, notifyEnabled: false, notifyBeforeMinutes: 2, notifyIntervalMinutes: 1 }, custom,
    ])
    await triggers.nth(0).click()
    await page.getByLabel('Prévenir avant (min)').fill('9')
    await page.getByRole('button', { name: 'Enregistrer', exact: true }).click()
    await page.reload()
    await expect(triggers.nth(0)).toContainText('9 / 1 min')
    await expect(triggers.nth(1)).toContainText('8 / 3 min')
  })
}

test('ancien favori sur navigateur incompatible : réglage local disponible', async ({ page, context }) => {
  const { saves } = await setup(context, { unsupported: true, storage: 'preferences' })
  await page.goto('/')
  const trigger = page.getByRole('button', { name: /Régler les notifications/ })
  await expect(trigger).toBeVisible()
  await trigger.click()
  await expect(page.getByRole('dialog')).toContainText('ce navigateur ne permet pas de recevoir les notifications')
  await page.getByLabel('Prévenir avant (min)').fill('8')
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click()
  await page.reload()
  await expect(trigger).toContainText('8 / 1 min')
  expect(saves).toHaveLength(0)
})
