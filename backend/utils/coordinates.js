/** Accepte une unique coordonnée décimale finie, dans la plage GPS indiquée. */
export function parseCoordinate(value, max) {
  if (typeof value !== 'string' || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim())) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && Math.abs(parsed) <= max ? parsed : null
}
