import { test, expect } from '@playwright/test'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname } from 'node:path'

// Un vrai serveur permet de changer la version du worker : les interceptions
// Playwright ne remplacent pas les requêtes de mise à jour du navigateur.
test('migration de l’ancienne PWA puis mises à jour automatiques sur deux onglets', async ({ context, page }) => {
  const dist = new URL('../dist/', import.meta.url)
  const html = await readFile(new URL('index.html', dist), 'utf8')
  const worker = await readFile(new URL('sw.js', dist), 'utf8')
  let version = 'legacy'
  let unavailable = false
  const legacyWorker = `
    self.addEventListener('install', event => event.waitUntil(
      caches.open('legacy-interface').then(cache => cache.add('/'))
    ))
    self.addEventListener('fetch', event => {
      if (event.request.mode === 'navigate') event.respondWith(caches.match('/'))
    })
  `
  const server = createServer(async (request, response) => {
    try {
      const path = new URL(request.url, 'http://localhost').pathname
      response.setHeader('Cache-Control', 'no-cache')
      if (path === '/sw.js') {
        response.setHeader('Content-Type', 'text/javascript')
        if (unavailable) { response.writeHead(503).end(); return }
        response.end(version === 'legacy' ? legacyWorker : worker.replace(
          /"revision":"[^"]+","url":"index.html"/,
          `"revision":"${version}","url":"index.html"`,
        ))
        return
      }
      if (!extname(path) || path === '/index.html') {
        response.setHeader('Content-Type', 'text/html')
        response.end(version === 'legacy'
          ? '<!doctype html><title>Ancienne interface</title><script>navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" })</script>'
          : html.replace('<html', `<html data-release="${version}"`))
        return
      }
      const types = { '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon' }
      response.setHeader('Content-Type', types[extname(path)] || 'application/octet-stream')
      response.end(await readFile(new URL(`.${path}`, dist)))
    } catch {
      response.writeHead(404).end()
    }
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const origin = `http://127.0.0.1:${server.address().port}`
  try {
    await context.addInitScript(() => {
      sessionStorage.setItem('page-loads', String(Number(sessionStorage.getItem('page-loads') || 0) + 1))
    })
    await context.route('**/api/**', route => route.fulfill({ json: [] }))
    await page.goto(origin)
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => true))
    await page.reload()
    await page.evaluate(() => localStorage.setItem('cache-update-test', 'préservé'))

    // L'ancien client ne sait pas recharger automatiquement ; le nouveau worker
    // doit tout de même s'activer alors que cet onglet reste ouvert.
    version = 'v1'
    await page.evaluate(() => navigator.serviceWorker.getRegistration().then(r => r.update()))
    await expect.poll(() => page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration()
      return !registration.installing && !registration.waiting && Boolean(navigator.serviceWorker.controller)
    })).toBe(true)
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-release', 'v1')

    const second = await context.newPage()
    await second.goto(`${origin}/lignes`)
    await expect(second.locator('html')).toHaveAttribute('data-release', 'v1')
    const loads = await page.evaluate(() => Number(sessionStorage.getItem('page-loads')))
    const secondLoads = await second.evaluate(() => Number(sessionStorage.getItem('page-loads')))
    version = 'v2'
    // Le retour du réseau déclenche la vérification sans rechargement manuel.
    await page.evaluate(() => window.dispatchEvent(new Event('online')))
    await expect(page.locator('html')).toHaveAttribute('data-release', 'v2')
    await expect(second.locator('html')).toHaveAttribute('data-release', 'v2')
    await expect(second).toHaveURL(`${origin}/lignes`)
    expect(await page.evaluate(() => localStorage.getItem('cache-update-test'))).toBe('préservé')
    expect(await page.evaluate(() => Number(sessionStorage.getItem('page-loads')))).toBe(loads + 1)
    expect(await second.evaluate(() => Number(sessionStorage.getItem('page-loads')))).toBe(secondLoads + 1)

    // Une erreur de mise à jour laisse l'interface courante utilisable.
    unavailable = true
    const warning = page.waitForEvent('console', message => message.text().includes('Impossible de vérifier la mise à jour'))
    await page.evaluate(() => window.dispatchEvent(new Event('online')))
    await warning
    await expect(page.locator('html')).toHaveAttribute('data-release', 'v2')
    expect(await page.evaluate(() => Number(sessionStorage.getItem('page-loads')))).toBe(loads + 1)
    await context.setOffline(true)
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-release', 'v2')
  } finally {
    await context.setOffline(false)
    await new Promise(resolve => server.close(resolve))
  }
})
