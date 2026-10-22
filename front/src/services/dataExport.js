import { Capacitor, registerPlugin } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'

const GinkuDataExport = registerPlugin('GinkuDataExport')

/**
 * Format de sauvegarde v1 : valeurs brutes par stockage, sans conversion JSON
 * des chaînes, pour permettre une restauration fidèle lors du futur import.
 * Les préférences Capacitor sont distinctes du localStorage sur Android.
 * Les caches réseau et l'état interne des services Android n'en font pas partie.
 * Toute erreur de lecture interrompt l'export pour éviter une sauvegarde partielle.
 */
export async function createDataBackup() {
  const localEntries = Object.keys(localStorage).map((key) => [key, localStorage.getItem(key)])
  const { keys } = await Preferences.keys()
  const preferenceEntries = await Promise.all(keys.map(async (key) => {
    const { value } = await Preferences.get({ key })
    return [key, value]
  }))

  return {
    app: 'Ginku',
    version: 1,
    exportedAt: new Date().toISOString(),
    platform: Capacitor.getPlatform(),
    storage: {
      localStorage: Object.fromEntries(localEntries),
      preferences: Object.fromEntries(preferenceEntries),
    },
  }
}

/** Retourne saved, downloaded ou cancelled ; propage les erreurs de lecture/écriture. */
export async function exportUserData() {
  const backup = await createDataBackup()
  const data = JSON.stringify(backup, null, 2)
  const filename = `ginku-sauvegarde-${backup.exportedAt.replace(/[:.]/g, '-')}.json`

  if (Capacitor.getPlatform() === 'android') {
    const { cancelled } = await GinkuDataExport.save({ filename, data })
    return cancelled ? 'cancelled' : 'saved'
  }

  const url = URL.createObjectURL(new Blob([data], { type: 'application/json;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  try {
    link.click()
  } finally {
    link.remove()
    // Laisser le navigateur démarrer le téléchargement avant de libérer le Blob.
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return 'downloaded'
}
