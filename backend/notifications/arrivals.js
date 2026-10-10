/** Même arrondi et seuils que le service Android. Les seuils ne sont marqués
 * qu'après l'envoi réussi, pour pouvoir réessayer après une panne du push. */
export function evaluateArrival(stop, passages, previous) {
  const passage = passages.find((item) =>
    String(item.idLigne) === stop.idLigne && item.destination === stop.destination,
  )
  if (!passage || !Number.isFinite(passage.tempsEnSeconde) || passage.tempsEnSeconde < 0) return null
  const minutes = Math.round(passage.tempsEnSeconde / 60)
  // Sans numéro de véhicule, l'heure estimée permet de distinguer les passages.
  const vehicle = String(passage.numVehicule || '')
  const arrivalAt = Date.now() + passage.tempsEnSeconde * 1000
  const samePassage = previous && (vehicle
    ? previous.vehicle === vehicle
    : !previous.vehicle && Math.abs(previous.arrivalAt - arrivalAt) < 90000)
  const before = stop.notifyBeforeMinutes ?? 2
  const interval = stop.notifyIntervalMinutes ?? 1
  const timing = `${before}/${interval}`
  const notified = samePassage && (previous.timing === timing || (!previous.timing && timing === '2/1')) ? previous.notified : []
  const thresholds = []
  for (let threshold = before; threshold > 0; threshold -= interval) thresholds.push(threshold)
  const reached = thresholds.filter((threshold) => minutes <= threshold && !notified.includes(threshold))
  return {
    state: { vehicle, arrivalAt, timing, notified: [...notified, ...reached] },
    payload: reached.length ? {
      title: `Arrêt ${stop.nomArret} — ${stop.destination}`,
      body: `${stop.numLigne} arrive ${minutes <= 0 ? 'maintenant' : `dans ${minutes} min`} à ${stop.nomArret}`,
      tag: `ginku-arrival-${stop.id}`,
      url: `/arret/${encodeURIComponent(stop.nomArret)}`,
    } : null,
  }
}
