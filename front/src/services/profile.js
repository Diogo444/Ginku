const STORAGE_KEY = 'ginku-profile-name'

// Le profil et l'accueil lisent la même préférence locale. Les erreurs de stockage
// sont laissées à l'appelant pour adapter leur présentation à chaque écran.
export function getProfileName() {
  return localStorage.getItem(STORAGE_KEY)?.trim() || ''
}

export function saveProfileName(name) {
  localStorage.setItem(STORAGE_KEY, name)
}
