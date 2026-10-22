import { Capacitor, registerPlugin } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'
import { waitForThemePersistence } from '@/stores/theme'
import { waitForFavoritesPersistence } from '@/stores/favorites'

const GinkuDataImport = registerPlugin('GinkuDataImport')
export const MAX_BACKUP_BYTES = 5 * 1024 * 1024
const PREFERENCE_PREFIX = 'CapacitorStorage.'
const LEGACY_PREFERENCES = ['ginku-theme', 'ginku-favorites', 'ginku-high-contrast']
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const invalidBackup = () => new Error('Ce fichier n’est pas une sauvegarde Ginku valide (format version 1).')

function validateStorage(storage) {
  if (!isRecord(storage) || Object.values(storage).some((value) => value !== null && typeof value !== 'string')) {
    throw invalidBackup()
  }
}

function validatePreferences(preferences) {
  const theme = preferences['ginku-theme']
  const contrast = preferences['ginku-high-contrast']
  if (theme != null && !['light', 'dark'].includes(theme)) throw invalidBackup()
  if (contrast != null && !['true', 'false'].includes(contrast)) throw invalidBackup()
  const rawFavorites = preferences['ginku-favorites']
  if (rawFavorites == null) return
  let favorites
  try { favorites = JSON.parse(rawFavorites) } catch { throw invalidBackup() }
  if (!Array.isArray(favorites) || favorites.some((favorite) => (
    !isRecord(favorite) ||
    ['id', 'nomArret', 'idLigne', 'destination'].some((key) => typeof favorite[key] !== 'string') ||
    ['numLigne', 'couleurFond', 'couleurTexte'].some((key) => favorite[key] != null && typeof favorite[key] !== 'string') ||
    (favorite.notifyEnabled !== undefined && typeof favorite.notifyEnabled !== 'boolean') ||
    ['notifyBeforeMinutes', 'notifyIntervalMinutes'].some((key) => favorite[key] !== undefined &&
      (!Number.isInteger(favorite[key]) || favorite[key] < 1 || favorite[key] > 60))
  ))) throw invalidBackup()
}

/**
 * Normalise une sauvegarde v1 pour la plateforme cible. Preferences fait autorité
 * sur ses copies Web préfixées et ses anciennes clés locales, sur Web comme Android.
 * Les identifiants Web Push appartiennent au navigateur courant et ne se transfèrent pas.
 */
export function parseDataBackup(text) {
  if (new Blob([text]).size > MAX_BACKUP_BYTES) throw new Error('Le fichier dépasse la limite de 5 Mio.')
  let backup
  try { backup = JSON.parse(text) } catch { throw invalidBackup() }
  if (!isRecord(backup) || backup.app !== 'Ginku' || backup.version !== 1 ||
    !['web', 'android', 'ios'].includes(backup.platform) ||
    typeof backup.exportedAt !== 'string' || !Number.isFinite(Date.parse(backup.exportedAt)) ||
    !isRecord(backup.storage)) throw invalidBackup()
  validateStorage(backup.storage.localStorage)
  validateStorage(backup.storage.preferences)

  const localEntries = []
  const preferences = new Map()
  for (const key of LEGACY_PREFERENCES) {
    if (Object.hasOwn(backup.storage.localStorage, key)) preferences.set(key, backup.storage.localStorage[key])
  }
  for (const [key, value] of Object.entries(backup.storage.localStorage)) {
    if (key.startsWith(PREFERENCE_PREFIX)) preferences.set(key.slice(PREFERENCE_PREFIX.length), value)
    else if (!LEGACY_PREFERENCES.includes(key) && key !== 'ginku-web-push') localEntries.push([key, value])
  }
  for (const [key, value] of Object.entries(backup.storage.preferences)) preferences.set(key, value)
  validatePreferences(Object.fromEntries(preferences))
  const entryCount = localEntries.length + preferences.size
  // Éviter qu'une ancienne clé soit remigrée au redémarrage si sa valeur importée est null.
  for (const key of LEGACY_PREFERENCES) {
    if (preferences.has(key)) localEntries.push([key, null])
  }
  return {
    exportedAt: backup.exportedAt,
    platform: backup.platform,
    entryCount,
    localEntries,
    preferenceEntries: [...preferences],
  }
}

/** Sélecteur Android natif ; null signifie que l’utilisateur a annulé. */
export async function selectNativeBackup() {
  const { cancelled, data } = await GinkuDataImport.open()
  return cancelled ? null : parseDataBackup(data)
}

async function writeEntry(storage, key, value) {
  if (storage === 'localStorage') {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } else if (value === null) await Preferences.remove({ key })
  else await Preferences.set({ key, value })
}

/**
 * Applique uniquement les clés du fichier validé, sans vider les stockages.
 * Journalise les anciennes valeurs avant toute écriture ; en cas d'échec, tente
 * toutes les restaurations, y compris l'écriture qui a rejeté après un effet de bord.
 * Le composant impose ensuite un rechargement pour réinitialiser les stores Vue.
 */
export async function restoreDataBackup(backup) {
  await Promise.all([waitForThemePersistence(), waitForFavoritesPersistence()])
  const operations = [
    ...backup.localEntries.map(([key, value]) => ({ storage: 'localStorage', key, value })),
    ...backup.preferenceEntries.map(([key, value]) => ({ storage: 'preferences', key, value })),
  ]
  try {
    for (const operation of operations) {
      operation.previous = operation.storage === 'localStorage'
        ? localStorage.getItem(operation.key)
        : (await Preferences.get({ key: operation.key })).value
    }
  } catch {
    throw new Error('Impossible de lire les données actuelles. L’import n’a pas commencé. Veuillez réessayer.')
  }
  const attempted = []
  try {
    for (const operation of operations) {
      attempted.push(operation)
      await writeEntry(operation.storage, operation.key, operation.value)
    }
  } catch {
    let rollbackFailed = false
    for (const operation of attempted.reverse()) {
      try { await writeEntry(operation.storage, operation.key, operation.previous) } catch { rollbackFailed = true }
    }
    throw new Error(rollbackFailed
      ? 'L’import et la restauration ont échoué. Certaines données ont pu être modifiées. Conservez votre fichier de sauvegarde.'
      : 'L’import a échoué. Vos données précédentes ont été conservées. Veuillez réessayer.')
  }
}

export const usesNativeImport = () => Capacitor.getPlatform() === 'android'
