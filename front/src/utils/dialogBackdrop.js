/**
 * Le fond d'un <dialog> modal renvoie les événements au dialogue lui-même.
 * Vérifier les coordonnées distingue le fond de son padding et de sa scrollbar.
 * Exiger un appui ET un relâchement dehors évite de fermer après un glissement
 * commencé dans le contenu. Pointer Events couvre souris, tactile et stylet.
 */
export function createDialogBackdropHandlers(dismiss) {
  let outsidePointerId = null
  let outsideGesture = false

  function isOutside(event) {
    if (event.target !== event.currentTarget) return false
    const bounds = event.currentTarget.getBoundingClientRect()
    return event.clientX < bounds.left || event.clientX > bounds.right ||
      event.clientY < bounds.top || event.clientY > bounds.bottom
  }

  return {
    onPointerDown(event) {
      outsideGesture = false
      outsidePointerId = event.isPrimary && event.button === 0 && isOutside(event) ? event.pointerId : null
    },
    onPointerUp(event) {
      outsideGesture = outsidePointerId === event.pointerId && event.isPrimary && isOutside(event)
      outsidePointerId = null
    },
    onClick(event) {
      const shouldDismiss = outsideGesture && isOutside(event)
      outsideGesture = false
      // Attendre le clic : sur WebView Android, fermer au pointerup permettrait
      // aux événements souris de compatibilité de reprendre le focus ensuite.
      if (shouldDismiss) dismiss()
    },
    onPointerCancel() {
      outsidePointerId = null
      outsideGesture = false
    },
  }
}
