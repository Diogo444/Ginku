import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { config } from 'dotenv'
import type { Request, Response } from 'express'
import { z } from 'zod'


const environment = process.env.NODE_ENV === 'production' ? 'production' : 'development'
config({ path: [`.env.${environment}`, '.env'] })

const port = Number(process.env.PORT ?? 3001)
const api = String(process.env.API_URL ?? 'http://localhost:3000')
const allowedHosts = String(
  process.env.MCP_ALLOWED_HOSTS ?? 'localhost,127.0.0.1,[::1]',
)
  .split(',')
  .map((host) => host.trim())
  .filter(Boolean)

function createServer() {
  const server = new McpServer({
    name: 'ginku-mcp',
    version: '1.0.0',
  })
  // Récupérer toutes les lignes
  server.registerTool(
    'lignes',
    {
      title: 'Récupérer toutes les lignes',
      description: 'Récupère la liste de toutes les lignes disponibles.',
      inputSchema: {},
    },
    async () => {
      const apiResponse = await fetch(`${api}/getLingnes`)

      if (!apiResponse.ok) {
        throw new Error(
          `Erreur lors de la récupération des lignes : ${apiResponse.status} ${apiResponse.statusText}`,
        )
      }

      const lines = await apiResponse.json()

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(lines, null, 2),
          },
        ],
      }
    },
  )
  // Récupérer les arrêts depuis une ligne
  server.registerTool(
    'arrets_from_ligne',
    {
      title: 'Arrêts depuis une ligne',
      description: 'Récupère la liste des arrêts pour une ligne et une variante données.',
      inputSchema: {
        idLigne: z.string().min(1).describe('Identifiant de la ligne'),
        idVariante: z.string().min(1).describe('Identifiant de la variante'),
      },
    },
    async ({ idLigne, idVariante }) => {
      const apiResponse = await fetch(`${api}/getArretFromLigne/${idLigne}/${idVariante}`)

      if (!apiResponse.ok) {
        throw new Error(
          `Erreur lors de la récupération des arrêts : ${apiResponse.status} ${apiResponse.statusText}`,
        )
      }

      const arrets = await apiResponse.json()

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(arrets, null, 2),
          },
        ],
      }
    },
  )

  // Récupérer quelle ligne et déservie à un arrêt
  server.registerTool(
    'ligne_from_arret',
    {
      title: 'Récupérer la ligne depuis un arrêt',
      description: 'Récupère la ligne et la variante qui dessert un arrêt donné.',
      inputSchema: {
        idArret: z.string().min(1).describe("Identifiant de l'arrêt"),
      },
    },
    async ({ idArret }) => {
      const MODE_TRANSPORT = {
        0: 'Bus',
        1: 'Tramway',
      } as const

      const apiResponse = await fetch(`${api}/getVariantesDesservantArret/${idArret}`)

      if (!apiResponse.ok) {
        throw new Error(
          `Erreur lors de la récupération de la ligne : ${apiResponse.status} ${apiResponse.statusText}`,
        )
      }

      const ligne = (await apiResponse.json()).map((ligne: any) => ({
        ...ligne,
        modeTransport: {
          code: ligne.modeTransport,
          libelle: MODE_TRANSPORT[ligne.modeTransport as keyof typeof MODE_TRANSPORT] ?? 'Inconnu',
        },
      }))

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(ligne, null, 2),
          },
        ],
      }
    },
  )

  server.registerTool(
    'rechercher_arrets',
    {
      title: 'Rechercher un arrêt Ginko',
      description:
        "Recherche un arrêt par son nom, sans tenir compte des accents ni de la casse. Utilise toujours cet outil avant de conclure qu'un arrêt n'existe pas ou avant d'appeler un outil qui exige un idArret. Le résultat contient les identifiants physiques, les coordonnées, les lignes et leurs directions.",
      inputSchema: {
        recherche: z
          .string()
          .min(2)
          .describe("Nom complet ou partiel de l'arrêt, par exemple 'Lavoisier'"),
      },
    },
    async ({ recherche }) => {
      const url = new URL(`${api}/rechercherArrets`)
      url.searchParams.set('recherche', recherche)
      const apiResponse = await fetch(url)

      if (!apiResponse.ok) {
        throw new Error(
          `Erreur lors de la recherche des arrêts : ${apiResponse.status} ${apiResponse.statusText}`,
        )
      }

      const result = await apiResponse.json()

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
        structuredContent: result,
      }
    },
  )

  server.registerTool(
    'rechercher_arrets_proches',
    {
      title: 'Rechercher les arrêts proches de coordonnées',
      description:
        "Retourne les arrêts Ginko situés à moins de 500 mètres de coordonnées GPS, triés du plus proche au plus éloigné. Utilise cet outil lorsqu'une origine ou une destination est une adresse, une entreprise ou un lieu plutôt qu'un nom d'arrêt. Les coordonnées doivent d'abord être obtenues avec une source de géocodage fiable.",
      inputSchema: {
        latitude: z
          .number()
          .min(-90)
          .max(90)
          .describe('Latitude en degrés décimaux'),
        longitude: z
          .number()
          .min(-180)
          .max(180)
          .describe('Longitude en degrés décimaux'),
      },
    },
    async ({ latitude, longitude }) => {
      const url = new URL(`${api}/getArretsProches`)
      url.searchParams.set('latitude', String(latitude))
      url.searchParams.set('longitude', String(longitude))
      const apiResponse = await fetch(url)

      if (!apiResponse.ok) {
        throw new Error(
          `Erreur lors de la recherche des arrêts proches : ${apiResponse.status} ${apiResponse.statusText}`,
        )
      }

      const result = {
        latitude,
        longitude,
        rayonMaximumMetres: 500,
        arrets: await apiResponse.json(),
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
        structuredContent: result,
      }
    },
  )

  server.registerTool(
    'calculer_itineraire',
    {
      title: 'Calculer un itinéraire Ginko',
      description:
        "Calcule et vérifie un trajet entre deux arrêts Ginko, direct ou avec une correspondance. Utilise cet outil pour toute demande d'itinéraire au lieu de déduire un trajet à partir des seules lignes ou des temps d'attente. Si le départ ou l'arrivée est une adresse ou une entreprise, résous d'abord ses coordonnées puis appelle rechercher_arrets_proches. Chaque étape indique la ligne, la direction exacte, l'arrêt de montée et l'arrêt de descente. Ne propose jamais une desserte absente des options retournées.",
      inputSchema: {
        depart: z
          .string()
          .min(2)
          .describe("Nom de l'arrêt de départ, par exemple '8 Septembre'"),
        arrivee: z
          .string()
          .min(2)
          .describe("Nom de l'arrêt d'arrivée, par exemple 'Lavoisier'"),
      },
    },
    async ({ depart, arrivee }) => {
      const url = new URL(`${api}/itineraire`)
      url.searchParams.set('depart', depart)
      url.searchParams.set('arrivee', arrivee)
      const apiResponse = await fetch(url)

      if (!apiResponse.ok) {
        const details = await apiResponse.text()
        throw new Error(
          `Erreur lors du calcul de l'itinéraire : ${apiResponse.status} ${details}`,
        )
      }

      const result = await apiResponse.json()

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
        structuredContent: result,
      }
    },
  )

  // Liste de temps d'attente d'un arrêt
  server.registerTool(
    'temps_attente_arret',
    {
      title: "Liste de temps d'attente d'un arrêt",
      description: "Récupère la liste des temps d'attente pour un arrêt donné.",
      inputSchema: {
        nomArret: z.string().min(1).describe("Nom de l'arrêt"),
      },
    },
    async ({ nomArret }) => {
      const TypeDeTemp = {
        0: "temps avant l'arrivée du véhicule, ex. '2 mn'",
        1: "horaire d'arrivée, ex. '17:30' (généralement si le temps d'attente dépasse 59 mn)",
        2: "court texte de remplacement, ex. 'travaux', 'déviation' ou 'bus complet'",
      } as const

      const AccessibiliteArret = {
        0: 'aucune information disponible',
        1: 'arrêt accessible aux personnes à mobilité réduite',
        2: 'arrêt difficilement accessible ou non accessible',
      } as const

      const AccessibiliteVehicule = {
        0: 'aucune information disponible',
        1: 'véhicule accessible aux personnes à mobilité réduite',
        2: 'véhicule non accessible aux personnes à mobilité réduite',
      } as const

      const Affluence = {
        [-2]: "accès aux informations d'affluence non autorisé",
        [-1]: "prévision d'affluence indisponible",
        0: 'affluence faible : peu de voyageurs à bord',
        1: 'affluence modérée : quelques voyageurs à bord, des places assises devraient rester disponibles',
        2: 'affluence forte : beaucoup de voyageurs à bord, probablement plus de places assises',
      } as const

      const apiResponse = await fetch(`${api}/getTempsLieu/${nomArret}`)

      if (!apiResponse.ok) {
        throw new Error(
          `Erreur lors de la récupération des temps d'attente : ${apiResponse.status} ${apiResponse.statusText}`,
        )
      }

      const tempsAttente = await apiResponse.json()

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                legende: {
                  typeDeTemps: TypeDeTemp,
                  accessibiliteArret: AccessibiliteArret,
                  accessibiliteVehicule: AccessibiliteVehicule,
                  affluence: Affluence,
                },
                tempsAttente,
              },
              null,
              2,
            ),
          },
        ],
      }
    },
  )

  // Récupérer les état des lignes
  server.registerTool(
    'etat_lignes',
    {
      title: 'Récupérer l’état des lignes',
      description: 'Récupère l’état des lignes de transport en commun.',
      inputSchema: {},
    },
    async () => {
      const etat = {
        0: "Aucune couleur ni aucun pictogramme : aucune information sur l'état, par exemple pour les lignes TAD",
        1: 'Vert (pictogramme de validation) : la ligne fonctionne normalement, sans perturbation en cours ni prévue',
        2: "Bleu (pictogramme d'information) : une information concerne la ligne, comme une nouveauté ou une évolution",
        3: 'Gris (pictogramme en forme de croix) : la ligne ne fonctionne pas actuellement, selon sa période de fonctionnement',
        4: "Gris (pictogramme d'attention) : une perturbation est prévue",
        5: "Orange (pictogramme d'attention) : une perturbation est en cours",
        6: 'Rouge (pictogramme en forme de croix) : la circulation de la ligne est totalement interrompue',
      } as const
      const apiResponse = await fetch(`${api}/etatLignes`)

      if (!apiResponse.ok) {
        throw new Error(
          `Erreur lors de la récupération de l'état des lignes : ${apiResponse.status} ${apiResponse.statusText}`,
        )
      }

      const etatLignes = await apiResponse.json()

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                etat,
                etatLignes,
              },
              null,
              2,
            ),
          },
        ],
      }
    },
  )

  // Récupérer les messages d'info trafic
  server.registerTool(
    'info_trafic',
    {
      title: 'Récupérer les messages d info trafic',
      description: 'Récupère les messages d info trafic.',
      inputSchema: {
        idLigne: z.string().min(1).describe('Identifiant de la ligne'),
      },
    },
    async ({ idLigne }) => {
      const etat = {
        1: 'Aucune perturbation',
        2: 'Information concernant la (ou les) ligne(s) (nouveauté, évolution)',
        4: 'Une perturbation est prévue dans le futur',
        5: 'Une perturbation est en cours',
      } as const

      const apiResponse = await fetch(`${api}/messages/${idLigne}`)

      if (!apiResponse.ok) {
        throw new Error(
          `Erreur lors de la récupération des messages d info trafic : ${apiResponse.status} ${apiResponse.statusText}`,
        )
      }

      const infoTrafic = await apiResponse.json()

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                etat,
                infoTrafic,
              },
              null,
              2,
            ),
          },
        ],
      }
    },
  )
  return server
}

const app = createMcpExpressApp({
  host: '0.0.0.0',
  allowedHosts,
})

app.get('/health', (_request: Request, response: Response) => {
  response.status(200).json({ status: 'ok' })
})

app.post('/mcp', async (request: Request, response: Response) => {
  const server = createServer()
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  })

  response.on('close', () => {
    void transport.close()
    void server.close()
  })

  try {
    await server.connect(transport)
    await transport.handleRequest(request, response, request.body)
  } catch (error) {
    console.error('Erreur MCP :', error)

    if (!response.headersSent) {
      response.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Erreur interne du serveur' },
        id: null,
      })
    }
  }
})

app.all('/mcp', (_request: Request, response: Response) => {
  response.status(405).json({
    jsonrpc: '2.0',
    error: { code: -32000, message: 'Méthode non autorisée' },
    id: null,
  })
})

app.listen(port, '0.0.0.0', () => {
  console.log(`Serveur MCP disponible sur http://0.0.0.0:${port}/mcp`)
})
