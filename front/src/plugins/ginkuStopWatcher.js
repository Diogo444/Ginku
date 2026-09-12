import { registerPlugin } from '@capacitor/core'

// Plugin natif Android : fait tourner un foreground service qui interroge
// l'API toutes les 15s pour les arrêts favoris avec les notifications activées,
// et affiche des notifications d'arrivée même app fermée. Voir
// front/android/app/src/main/java/org/diogoandrade/ginku/GinkuStopWatcherPlugin.java
const GinkuStopWatcher = registerPlugin('GinkuStopWatcher')

export default GinkuStopWatcher
