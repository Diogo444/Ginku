const PUSH_HOSTS = new Set([
  'fcm.googleapis.com',
  'updates.push.services.mozilla.com',
  'web.push.apple.com',
])

export class NotificationError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

function text(value, max = 200) {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u001f]/.test(value)) {
    throw new NotificationError(400, 'Données de notification invalides')
  }
  return value.trim()
}

// Les endpoints sont fournis par le navigateur, jamais par une URL libre :
// limiter les hôtes empêche d'utiliser l'envoi push pour atteindre le réseau privé.
export function validateSubscription(value) {
  if (!value || typeof value !== 'object') throw new NotificationError(400, 'Abonnement requis')
  let url
  try {
    url = new URL(text(value.endpoint, 2048))
  } catch {
    throw new NotificationError(400, 'Endpoint push invalide')
  }
  if (url.protocol !== 'https:' || url.port || url.username || url.password || url.hash ||
      !(PUSH_HOSTS.has(url.hostname) || url.hostname.endsWith('.notify.windows.com'))) {
    throw new NotificationError(400, 'Service push non pris en charge')
  }
  for (const [key, length] of [['p256dh', 65], ['auth', 16]]) {
    const encoded = value.keys?.[key]
    if (typeof encoded !== 'string' || !/^[A-Za-z0-9_-]+={0,2}$/.test(encoded) ||
        Buffer.from(encoded, 'base64url').length !== length) {
      throw new NotificationError(400, 'Clés push invalides')
    }
  }
  return { endpoint: url.href, keys: { p256dh: value.keys.p256dh, auth: value.keys.auth } }
}

export function validateStops(value) {
  if (!Array.isArray(value) || value.length > 20) {
    throw new NotificationError(400, 'Maximum 20 favoris surveillés par navigateur')
  }
  const stops = value.map((stop) => ({
    id: text(stop?.id, 600),
    nomArret: text(stop?.nomArret),
    idLigne: text(stop?.idLigne, 50),
    numLigne: text(stop?.numLigne, 50),
    destination: text(stop?.destination),
  }))
  if (new Set(stops.map((stop) => stop.id)).size !== stops.length) {
    throw new NotificationError(400, 'Favoris dupliqués')
  }
  return stops
}
