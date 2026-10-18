import { test, expect } from '@playwright/test'

async function mockApi(context, delay = 0) {
  await context.route('**/api/**', async (route) => {
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay))
    await route.fulfill({ json: [] })
  })
}

function collectErrors(page) {
  const errors = []
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))
  return errors
}

test('développement : service worker actif et aucune erreur au démarrage', async ({ page, context }) => {
  await mockApi(context)
  const errors = collectErrors(page)
  await page.goto('/')
  await expect.poll(() => page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration()
    return registration?.active?.scriptURL
  })).toContain('/dev-sw.js?dev-sw')
  const response = await page.request.get('/dev-sw.js?dev-sw')
  expect(response.headers()['content-type']).toMatch(/javascript/)
  await expect(page.getByRole('alert')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('navigation rapide : annulation de l’accueil sans erreur ni requête héritée', async ({ page, context }) => {
  await mockApi(context, 500)
  const errors = collectErrors(page)
  const loading = page.waitForRequest((request) => request.url().includes('/getLingnes'))
  await page.goto('/')
  await loading
  await page.evaluate(async () => {
    const { default: router } = await import('/src/router/index.js')
    await router.push('/lignes')
    await router.push('/')
  })
  await expect(page.getByPlaceholder('Rechercher une ligne, un arrêt, un véhicule...')).toBeVisible()
  // Attend la fin des appels encore en vol, y compris ceux de la page quittée.
  await page.waitForTimeout(800)
  expect(errors).toEqual([])
})

test('API : annuler un consommateur ne doit pas annuler celui qui charge la même URL', async ({ page, context }) => {
  await mockApi(context, 200)
  await page.goto('/')
  const results = await page.evaluate(async () => {
    const { default: api } = await import('/src/services/api.js')
    const first = new AbortController()
    const second = new AbortController()
    const one = api.get('/search', { signal: first.signal, ttl: 0 })
    const two = api.get('/search', { signal: second.signal, ttl: 0 })
    first.abort()
    return (await Promise.allSettled([one, two])).map((result) => ({
      status: result.status,
      code: result.reason?.code,
      http: result.value?.status,
    }))
  })
  expect(results).toEqual([
    { status: 'rejected', code: 'ERR_CANCELED', http: undefined },
    { status: 'fulfilled', code: undefined, http: 200 },
  ])
})

const line = { id: '101', numLignePublic: 'T1', libellePublic: 'Hauts du Chazal <> Chalezeule', modeTransport: 1, variantes: [{ id: '15-0' }] }

for (const [path, endpoint, message] of [
  ['/lignes', '/getLingnes', 'Impossible de charger les lignes'],
  ['/infos', '/etatLignes', 'Impossible de charger les informations trafic'],
]) {
  test(`${path} : panne API visible et chargement rétabli après Réessayer`, async ({ page, context }) => {
    let failing = true
    await context.route('**/api/**', async (route) => {
      const url = new URL(route.request().url())
      if (url.pathname.endsWith(endpoint) && failing) {
        await route.fulfill({ status: 503, json: { error: 'Service indisponible' } })
      } else {
        await route.fulfill({ json: url.pathname.endsWith('/getLingnes') ? [line] : [] })
      }
    })
    await page.goto(path)
    await expect(page.getByRole('alert')).toContainText(message)
    await expect(page.getByText('Réseau globalement fluide')).toHaveCount(0)
    failing = false
    await page.getByRole('button', { name: 'Réessayer le chargement' }).click()
    await expect(page.getByRole('alert')).toHaveCount(0)
    if (path === '/lignes') await expect(page.getByRole('link', { name: `Ligne T1, ${line.libellePublic}` })).toBeVisible()
    else await expect(page.getByText('Réseau globalement fluide')).toBeVisible()
  })
}

test('lignes et perturbations : affiche les données renvoyées par le backend', async ({ page, context }) => {
  await context.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    let data = []
    if (path.endsWith('/getLingnes')) data = [line]
    if (path.endsWith('/etatLignes')) data = [{ idLigne: line.id, numLignePublic: 'T1', etat: 5 }]
    if (path.endsWith('/messages/101')) data = [{ id: 'travaux', titre: 'Travaux sur le tramway', texte: 'Arrêt temporairement déplacé' }]
    await route.fulfill({ json: data })
  })
  await page.goto('/lignes')
  await expect(page.getByRole('link', { name: `Ligne T1, ${line.libellePublic}` })).toBeVisible()
  await page.evaluate(async () => {
    const { default: router } = await import('/src/router/index.js')
    await router.push('/infos')
  })
  await expect(page.getByText('Travaux sur le tramway')).toBeVisible()
  await expect(page.getByText('1 perturbation en cours')).toBeVisible()
})
