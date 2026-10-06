import { resolve } from 'node:path'
import webPush from 'web-push'
import { createSubscriptionStore } from './store.js'
import { createNotificationRouter } from './routes.js'
import { createPushWatcher } from './watcher.js'

export async function initializeWebPush(fetchPassages) {
  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT
  const origins = new Set((process.env.WEB_PUSH_ORIGINS || 'https://ginku.diogo-andrade.org,http://localhost:5173').split(',').map((value) => value.trim()))
  let store = null
  let watcher = null
  if (publicKey && privateKey && subject) {
    webPush.setVapidDetails(subject, publicKey, privateKey)
    store = await createSubscriptionStore(resolve(process.env.WEB_PUSH_STORE_PATH || 'data/web-push-subscriptions.json'))
    watcher = createPushWatcher({ store, fetchPassages, sendPush: (...args) => webPush.sendNotification(...args) })
  } else {
    console.info('[web-push] Désactivé : configurez les trois variables VAPID pour activer les alertes Web')
  }
  return { router: createNotificationRouter({ store, publicKey, origins }), watcher }
}
