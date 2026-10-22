import { test, expect } from '@playwright/test'
import { Buffer } from 'node:buffer'

const favorite = {
  id: 'import-test', nomArret: 'Gare Viotte', idLigne: '101', numLigne: 'T1',
  destination: 'Chalezeule', couleurFond: '112233', couleurTexte: 'FFFFFF',
  notifyEnabled: false, notifyBeforeMinutes: 8, notifyIntervalMinutes: 3,
}
const backup = (platform = 'android') => ({
  app: 'Ginku', version: 1, platform, exportedAt: '2026-10-22T09:00:00.000Z',
  storage: {
    localStorage: { 'ginku-profile-name': 'Camille 🚋', 'import-empty': '', 'ginku-web-push': '{"id":"autre-appareil","token":"test"}' },
    preferences: { 'ginku-theme': 'dark', 'ginku-high-contrast': 'true', 'ginku-favorites': JSON.stringify([favorite]) },
  },
})

async function openProfile(page, context) {
  await context.route('**/api/**', (route) => route.fulfill({ json: [] }))
  await page.goto('/profil')
  await expect(page.getByRole('button', { name: 'Importer mes données', exact: true })).toBeVisible()
}

async function selectBackup(page, data = backup()) {
  await page.getByLabel('Choisir une sauvegarde Ginku', { exact: true }).setInputFiles({
    name: 'ginku-sauvegarde.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)),
  })
}

test('import : confirmation, annulation au clavier et fichier invalide sans changement', async ({ page, context }) => {
  await openProfile(page, context)
  await page.evaluate(() => localStorage.setItem('ginku-profile-name', 'Avant import'))
  await selectBackup(page)
  const dialog = page.getByRole('dialog', { name: 'Importer cette sauvegarde ?' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Annuler', exact: true })).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(dialog.getByRole('button', { name: 'Importer', exact: true })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  await expect(page.getByRole('button', { name: 'Importer mes données', exact: true })).toBeFocused()
  expect(await page.evaluate(() => localStorage.getItem('ginku-profile-name'))).toBe('Avant import')
  await selectBackup(page, { app: 'Autre', version: 1 })
  await expect(page.getByRole('alert')).toContainText('pas une sauvegarde Ginku valide')
  expect(await page.evaluate(() => localStorage.getItem('ginku-profile-name'))).toBe('Avant import')
  await selectBackup(page)
  await expect(dialog).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('import : sauvegarde Android restaurée sur Web et prise en compte après rechargement', async ({ page, context }) => {
  await openProfile(page, context)
  await page.evaluate(() => {
    localStorage.setItem('import-keep', 'conserver')
    localStorage.setItem('ginku-web-push', '{"id":"courant","token":"test"}')
  })
  await selectBackup(page)
  await page.getByRole('button', { name: 'Importer', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Données importées' })).toBeVisible()
  expect(await page.evaluate(() => ({
    name: localStorage.getItem('ginku-profile-name'), keep: localStorage.getItem('import-keep'),
    empty: localStorage.getItem('import-empty'), push: localStorage.getItem('ginku-web-push'),
    theme: localStorage.getItem('CapacitorStorage.ginku-theme'),
  }))).toEqual({ name: 'Camille 🚋', keep: 'conserver', empty: '', push: '{"id":"courant","token":"test"}', theme: 'dark' })
  await page.getByRole('button', { name: 'Continuer', exact: true }).click()
  await expect(page.getByText('Camille 🚋', { exact: true })).toBeVisible()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect(page.locator('html')).toHaveClass(/high-contrast/)
  await page.goto('/')
  await expect(page.getByText('Gare Viotte', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /Régler les notifications de T1/ })).toContainText('Délais : 8 / 3 min')
})

test('import : échec d’écriture, restauration des anciennes valeurs puis nouvelle tentative', async ({ page, context }) => {
  await openProfile(page, context)
  const previous = await page.evaluate(() => {
    localStorage.setItem('ginku-profile-name', 'Ancien pseudo')
    localStorage.setItem('CapacitorStorage.ginku-theme', 'light')
    return JSON.stringify(Object.fromEntries(Object.entries(localStorage)))
  })
  await selectBackup(page)
  await page.evaluate(() => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (key === 'CapacitorStorage.ginku-theme') {
        Storage.prototype.setItem = original
        // Simuler un rejet après écriture pour vérifier le journal de restauration.
        original.call(this, key, value)
        throw new Error('Quota dépassé')
      }
      return original.call(this, key, value)
    }
  })
  await page.getByRole('button', { name: 'Importer', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Vos données précédentes ont été conservées')
  expect(JSON.parse(await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(localStorage)))))).toEqual(JSON.parse(previous))
  await page.getByRole('button', { name: 'Importer', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Données importées' })).toBeVisible()
})

test('import : valide le format, les préférences, les favoris et la taille avant toute écriture', async ({ page, context }) => {
  await openProfile(page, context)
  const results = await page.evaluate(async (valid) => {
    const { parseDataBackup, MAX_BACKUP_BYTES } = await import('/src/services/dataImport.js')
    const variants = [
      'pas du JSON', JSON.stringify({ ...valid, version: 2 }),
      JSON.stringify({ ...valid, storage: { ...valid.storage, localStorage: { key: 42 } } }),
      JSON.stringify({ ...valid, storage: { ...valid.storage, preferences: { 'ginku-theme': 'blue' } } }),
      JSON.stringify({ ...valid, storage: { ...valid.storage, preferences: { 'ginku-favorites': '[{}]' } } }),
      ' '.repeat(MAX_BACKUP_BYTES + 1),
    ]
    const rejected = variants.map((text) => { try { parseDataBackup(text); return false } catch { return true } })
    const source = JSON.stringify({ ...valid, storage: {
      localStorage: Object.fromEntries([['CapacitorStorage.ginku-theme', 'light'], ['ginku-theme', 'light'], ['__proto__', 'valeur brute']]),
      preferences: { 'ginku-theme': 'dark' },
    } })
    const normalized = parseDataBackup(source)
    const fallback = parseDataBackup(JSON.stringify({ ...valid, storage: {
      localStorage: { 'CapacitorStorage.ginku-theme': 'light', 'ginku-theme': 'dark' }, preferences: {},
    } }))
    return { rejected, normalized, fallback }
  }, backup('web'))
  expect(results.rejected).toEqual([true, true, true, true, true, true])
  expect(results.normalized.preferenceEntries).toEqual([['ginku-theme', 'dark']])
  expect(results.normalized.localEntries).toContainEqual(['ginku-theme', null])
  expect(results.normalized.localEntries).toContainEqual(['__proto__', 'valeur brute'])
  expect(results.fallback.preferenceEntries).toEqual([['ginku-theme', 'light']])
})

test('import : une préférence null supprime aussi son ancienne copie locale', async ({ page, context }) => {
  await openProfile(page, context)
  await page.evaluate(() => {
    localStorage.setItem('ginku-theme', 'dark')
    localStorage.setItem('CapacitorStorage.ginku-theme', 'dark')
  })
  const fixture = backup('web')
  fixture.storage.preferences['ginku-theme'] = null
  fixture.storage.localStorage['ginku-theme'] = 'dark'
  fixture.storage.localStorage['CapacitorStorage.ginku-theme'] = 'dark'
  await selectBackup(page, fixture)
  await page.getByRole('button', { name: 'Importer', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Données importées' })).toBeVisible()
  expect(await page.evaluate(() => [localStorage.getItem('ginku-theme'), localStorage.getItem('CapacitorStorage.ginku-theme')])).toEqual([null, null])
  await page.getByRole('button', { name: 'Continuer', exact: true }).click()
  await expect(page.getByText('Camille 🚋', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('CapacitorStorage.ginku-theme'))).toBeNull()
})

test('import Android : sélecteur natif, sauvegarde Web, annulation et erreurs', async ({ page }) => {
  await page.route('**/import-test-blank', (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="fr"><title>Import</title></html>' }))
  await page.goto('/import-test-blank')
  const result = await page.evaluate(async (fixture) => {
    window.androidBridge = {}
    let outcome = 'selected'
    const preferences = new Map([['keep', 'native'], ['ginku-theme', 'light']])
    window.Capacitor = {
      PluginHeaders: [
        { name: 'Preferences', methods: ['get', 'set', 'remove'].map((name) => ({ name, rtype: 'promise' })) },
        { name: 'GinkuDataImport', methods: [{ name: 'open', rtype: 'promise' }] },
      ],
      nativePromise: async (plugin, method, options) => {
        if (plugin === 'GinkuDataImport') {
          if (outcome === 'error') throw new Error('Lecture impossible')
          return { cancelled: outcome === 'cancelled', data: JSON.stringify(fixture) }
        }
        if (method === 'get') return { value: preferences.get(options.key) ?? null }
        if (method === 'set') preferences.set(options.key, options.value)
        if (method === 'remove') preferences.delete(options.key)
        return {}
      },
    }
    const { selectNativeBackup, restoreDataBackup } = await import('/src/services/dataImport.js')
    const selected = await selectNativeBackup()
    await restoreDataBackup(selected)
    outcome = 'cancelled'
    const cancelled = await selectNativeBackup()
    outcome = 'error'
    let failed = false
    try { await selectNativeBackup() } catch { failed = true }
    return { cancelled, failed, preferences: Object.fromEntries(preferences), local: Object.fromEntries(Object.entries(localStorage)) }
  }, { ...backup('web'), storage: { localStorage: { 'ginku-profile-name': 'Web vers Android', 'CapacitorStorage.ginku-theme': 'light' }, preferences: { 'ginku-theme': 'dark' } } })
  expect(result).toMatchObject({ cancelled: null, failed: true, preferences: { keep: 'native', 'ginku-theme': 'dark' }, local: { 'ginku-profile-name': 'Web vers Android' } })
  expect(result.local).not.toHaveProperty('CapacitorStorage.ginku-theme')
})
