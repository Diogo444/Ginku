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

test('profil : accès au clavier, thème local persistant et réglages', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mockApi(context)
  await page.goto('/')
  const profileLink = page.getByRole('link', { name: 'Ouvrir mon profil' })
  await profileLink.focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/profil$/)
  await expect(page.getByRole('heading', { name: 'Mon profil' })).toBeFocused()
  await expect(page.getByRole('heading', { name: 'Alex Martin' })).toBeVisible()
  const requests = []
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/')) requests.push(request.url())
  })
  const theme = page.getByRole('combobox', { name: 'Thème' })
  await theme.focus()
  await page.keyboard.press('Home')
  await expect(theme).toHaveValue('light')
  await expect(page.locator('html')).not.toHaveClass(/dark/)
  await page.screenshot({ path: 'test-results/profile-light-mobile.png', fullPage: true })
  await page.keyboard.press('End')
  await expect(theme).toHaveValue('dark')
  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect.poll(() => page.evaluate(() => localStorage.getItem('CapacitorStorage.ginku-theme'))).toBe('dark')
  await page.screenshot({ path: 'test-results/profile-dark-mobile.png', fullPage: true })
  await expect(page.getByRole('switch', { name: 'Contraste élevé' })).toHaveAttribute('aria-checked', 'false')
  await expect(page.getByText('Bientôt')).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.reload()
  await expect(theme).toHaveValue('dark')
  await theme.selectOption('light')
  await expect(page.locator('html')).not.toHaveClass(/dark/)
  expect(requests).toEqual([])
})

test('profil : modifie le nom au clavier, le conserve localement et permet d’annuler', async ({ page, context }) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await mockApi(context)
  const requests = []
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/')) requests.push(request.url())
  })
  await page.goto('/profil')
  const edit = page.getByRole('button', { name: 'Modifier le nom' })
  await edit.focus()
  await page.keyboard.press('Enter')
  const name = page.getByRole('textbox', { name: 'Nom ou pseudo' })
  await expect(name).toBeFocused()
  await name.fill('Élodie Dupont')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Élodie Dupont' })).toBeVisible()
  await expect(edit).toBeFocused()
  expect(await page.evaluate(() => localStorage.getItem('ginku-profile-name'))).toBe('Élodie Dupont')
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Élodie Dupont' })).toBeVisible()
  await edit.click()
  await name.fill('Autre nom')
  await page.keyboard.press('Escape')
  await expect(edit).toBeFocused()
  await expect(page.getByRole('heading', { name: 'Élodie Dupont' })).toBeVisible()
  await edit.click()
  await name.fill('   ')
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText('Saisissez un nom ou un pseudo.')
  await expect(name).toBeFocused()
  await name.fill('Voyageur'.repeat(10))
  await page.keyboard.press('Enter')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: 'test-results/profile-name-mobile.png', fullPage: true })
  expect(requests).toEqual([])
})

test('profil : signale un refus de localStorage sans perdre la saisie ni le nom précédent', async ({ page, context }) => {
  await mockApi(context)
  await context.addInitScript(() => {
    const setItem = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (key === 'ginku-profile-name') throw new DOMException('Stockage bloqué', 'QuotaExceededError')
      return setItem.call(this, key, value)
    }
  })
  await page.goto('/profil')
  await page.getByRole('button', { name: 'Modifier le nom' }).click()
  await page.getByRole('textbox', { name: 'Nom ou pseudo' }).fill('Mon pseudo')
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Enregistrement impossible')
  await expect(page.getByRole('textbox', { name: 'Nom ou pseudo' })).toHaveValue('Mon pseudo')
  await expect(page.getByRole('heading', { name: 'Alex Martin' })).toBeVisible()
})

test('accueil : affiche le pseudo enregistré après modification et rechargement', async ({ page, context }) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await mockApi(context)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Bonjour', exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Ouvrir mon profil' }).click()
  await page.getByRole('button', { name: 'Modifier le nom' }).click()
  const nickname = 'Voyageur'.repeat(10)
  await page.getByRole('textbox', { name: 'Nom ou pseudo' }).fill(nickname)
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click()
  await page.getByRole('link', { name: 'Aller à Favoris' }).click()
  await expect(page.getByRole('heading', { name: `Bonjour ${nickname}`, exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await expect(page.getByRole('link', { name: 'Ouvrir mon profil' })).toBeInViewport()
  await page.reload()
  await expect(page.getByRole('heading', { name: `Bonjour ${nickname}`, exact: true })).toBeVisible()
})

async function checkEnhancedContrast(page) {
  const samples = await page.locator('h1, h2, h3, p, label, button, select, footer a, nav a, [data-line-badge]').evaluateAll((elements) => {
    function rgb(color) { return color.match(/[\d.]+/g)?.map(Number) || [0, 0, 0, 0] }
    function luminance(channels) {
      const values = channels.slice(0, 3).map((value) => {
        const channel = value / 255
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
      })
      return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2]
    }
    return elements.filter((element) => element.getClientRects().length && element.textContent.trim()).map((element) => {
      let background = [255, 255, 255]
      for (let parent = element; parent; parent = parent.parentElement) {
        const color = rgb(getComputedStyle(parent).backgroundColor)
        if (color.length === 3 || color[3] === 1) { background = color; break }
      }
      const text = luminance(rgb(getComputedStyle(element).color))
      const surface = luminance(background)
      return { text: element.textContent.trim().slice(0, 60), ratio: (Math.max(text, surface) + 0.05) / (Math.min(text, surface) + 0.05) }
    })
  })
  for (const sample of samples) expect(sample.ratio, sample.text).toBeGreaterThanOrEqual(7)
}

for (const theme of ['light', 'dark']) {
  test(`contraste élevé ${theme} : clavier, lisibilité, persistance et retour au mode normal`, async ({ page, context }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await context.route('**/api/**', async (route) => {
      const path = new URL(route.request().url()).pathname
      let data = []
      if (path.endsWith('/getLingnes')) data = [{ ...line, couleurFond: '00A5C2', couleurTexte: 'FFFFFF' }]
      if (path.endsWith('/etatLignes')) data = [{ idLigne: line.id, numLignePublic: 'T1', etat: 5 }]
      if (path.endsWith('/messages/101')) data = [{ id: 'travaux', titre: 'Travaux sur le tramway', texte: 'Arrêt temporairement déplacé' }]
      await route.fulfill({ json: data })
    })
    await page.goto('/profil')
    await page.getByRole('combobox', { name: 'Thème' }).selectOption(theme)
    const toggle = page.getByRole('switch', { name: 'Contraste élevé' })
    await toggle.focus()
    await page.keyboard.press('Space')
    await expect(toggle).toBeEnabled()
    await expect(toggle).toHaveAttribute('aria-checked', 'true')
    await expect(page.locator('html')).toHaveClass(/high-contrast/)
    await checkEnhancedContrast(page)
    const focus = await toggle.evaluate((element) => getComputedStyle(element).outlineWidth)
    expect(focus).toBe('3px')
    await page.screenshot({ path: `test-results/contrast-${theme}-mobile.png`, fullPage: true })
    // Toute la carte réagit, y compris son bord et la représentation du switch.
    await toggle.click({ position: { x: 8, y: 8 } })
    await expect(toggle).toBeEnabled()
    await expect(toggle).toHaveAttribute('aria-checked', 'false')
    await toggle.locator('.contrast-switch-thumb').click()
    await expect(toggle).toBeEnabled()
    await expect(toggle).toHaveAttribute('aria-checked', 'true')
    await page.reload()
    await expect(toggle).toHaveAttribute('aria-checked', 'true')
    await page.getByRole('link', { name: 'Aller à Lignes' }).click()
    await expect(page.locator('[data-line-badge]')).toBeVisible()
    await checkEnhancedContrast(page)
    await page.getByRole('link', { name: 'Aller à Infos' }).click()
    await expect(page.getByText('Travaux sur le tramway')).toBeVisible()
    await checkEnhancedContrast(page)
    await page.getByRole('link', { name: 'Ouvrir mon profil' }).click()
    await page.getByRole('combobox', { name: 'Thème' }).selectOption(theme === 'light' ? 'dark' : 'light')
    await checkEnhancedContrast(page)
    await toggle.focus()
    await page.keyboard.press('Enter')
    await expect(toggle).toBeEnabled()
    await expect(toggle).toHaveAttribute('aria-checked', 'false')
    await expect(page.locator('html')).not.toHaveClass(/high-contrast/)
    await page.reload()
    await expect(toggle).toHaveAttribute('aria-checked', 'false')
  })
}

test('contraste : refus de sauvegarde signalé sans conserver un état trompeur', async ({ page, context }) => {
  await mockApi(context)
  await context.addInitScript(() => {
    const setItem = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (key === 'CapacitorStorage.ginku-high-contrast') throw new DOMException('Stockage bloqué', 'QuotaExceededError')
      return setItem.call(this, key, value)
    }
  })
  await page.goto('/profil')
  const toggle = page.getByRole('switch', { name: 'Contraste élevé' })
  await toggle.click()
  await expect(page.getByRole('alert')).toContainText('Le contraste n’a pas pu être enregistré')
  await expect(toggle).toHaveAttribute('aria-checked', 'false')
  await expect(page.locator('html')).not.toHaveClass(/high-contrast/)
})

test('profil : cartes légales accessibles au clavier et liens retirés du footer', async ({ page, context }) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await mockApi(context)
  await page.goto('/profil')
  const legal = page.getByRole('navigation', { name: 'Informations légales' })
  await expect(legal).toBeVisible()
  await expect(page.getByRole('contentinfo').getByRole('link', { name: /confidentialité|Conditions/ })).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  for (const [title, path] of [
    ['Politique de confidentialité', '/politique-confidentialite'],
    ['Conditions d’utilisation', '/conditions-utilisation'],
  ]) {
    const link = legal.getByRole('link', { name: new RegExp(title) })
    const size = await link.boundingBox()
    expect(size.height).toBeGreaterThanOrEqual(44)
    await link.focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(new RegExp(`${path}$`))
    await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeFocused()
    await page.getByRole('button', { name: 'Retour à la page précédente' }).click()
    await expect(page).toHaveURL(/\/profil$/)
  }
})

test('recherche : suggestions accessibles par Tabulation et fermeture avec Échap', async ({ page, context }) => {
  await context.route('**/api/**', (route) => route.fulfill({ json: new URL(route.request().url()).pathname.endsWith('/getLingnes') ? [line] : [] }))
  await page.goto('/')
  const search = page.getByRole('searchbox', { name: 'Rechercher une ligne, un arrêt ou un véhicule' })
  await expect(search).toBeEnabled()
  await search.fill('T1')
  const result = page.getByRole('link', { name: 'Aller à Ligne T1', exact: true })
  await expect(result).toBeVisible()
  await search.press('Tab')
  await expect(result).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(search).toBeFocused()
  await expect(result).not.toBeVisible()
  await page.getByRole('link', { name: 'Ouvrir mon profil' }).click()
  await expect(page.getByRole('link', { name: 'Contacter le support' })).toHaveAttribute('href', 'mailto:ginku@diogo-andrade.org')
})
