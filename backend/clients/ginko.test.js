import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { createGinkoClient, logUpstreamError } from './ginko.js'

test('client Ginko : délai par défaut et interruption effective d’un appel bloqué', async (t) => {
  const server = createServer(() => {})
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const client = createGinkoClient()
  t.after(() => {
    client.defaults.httpAgent.destroy()
    client.defaults.httpsAgent.destroy()
    server.closeAllConnections()
    server.close()
  })
  assert.equal(client.defaults.timeout, 8000)
  assert.equal(client.defaults.baseURL, 'https://api.ginko.voyage')
  await assert.rejects(client.get(`http://127.0.0.1:${server.address().port}`, { timeout: 50, proxy: false }), { code: 'ECONNABORTED' })
})

test('journaux Ginko : exclut configuration, réponse et message contenant des secrets', () => {
  const calls = []
  logUpstreamError('/api/test', {
    code: 'ERR_BAD_RESPONSE',
    message: 'secret-api-key',
    config: { params: { apiKey: 'secret-api-key' } },
    response: { status: 502, data: 'secret-api-key' },
  }, { error: (...args) => calls.push(args) })
  assert.deepEqual(calls, [['/api/test', { code: 'ERR_BAD_RESPONSE', status: 502 }]])
})
