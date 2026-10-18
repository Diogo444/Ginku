import axios from 'axios'
import http from 'node:http'
import https from 'node:https'

/** Délai commun à tous les appels Ginko, y compris les données référentielles. */
export function createGinkoClient() {
  return axios.create({
    baseURL: 'https://api.ginko.voyage',
    timeout: 8000,
    httpAgent: new http.Agent({ keepAlive: true }),
    httpsAgent: new https.Agent({ keepAlive: true }),
  })
}

export function logUpstreamError(context, error, logger = console) {
  // Les erreurs Axios contiennent la configuration et donc la clé API.
  // Ne conserver que les métadonnées nécessaires au diagnostic.
  logger.error(context, {
    code: typeof error?.code === 'string' ? error.code : 'UPSTREAM_ERROR',
    status: Number.isInteger(error?.response?.status) ? error.response.status : null,
  })
}
