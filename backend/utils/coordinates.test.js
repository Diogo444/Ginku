import test from 'node:test'
import assert from 'node:assert/strict'
import { parseCoordinate } from './coordinates.js'

test('coordonnées GPS : décimales et bornes incluses', () => {
  for (const value of ['47.238', '-90', '+90', ' 0 ', '.5']) {
    assert.equal(parseCoordinate(value, 90), Number(value))
  }
  assert.equal(parseCoordinate('180', 180), 180)
  assert.equal(parseCoordinate('-180', 180), -180)
})

test('coordonnées GPS : refuse les valeurs partielles, multiples et hors limites', () => {
  for (const value of [undefined, null, '', ' ', '47abc', '47,2', 'NaN', 'Infinity', '0x10', ['47'], {}, '90.01', '-90.01']) {
    assert.equal(parseCoordinate(value, 90), null)
  }
  assert.equal(parseCoordinate('180.01', 180), null)
})
