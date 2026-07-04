import 'dotenv/config'

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import type { Request, Response } from 'express'
import { z } from 'zod'

const port = Number(process.env.PORT ?? 3001)
const api = String(process.env.API_URL ?? 'http://localhost:3000')

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
        1: "Vert (pictogramme de validation) : la ligne fonctionne normalement, sans perturbation en cours ni prévue",
        2: "Bleu (pictogramme d'information) : une information concerne la ligne, comme une nouveauté ou une évolution",
        3: "Gris (pictogramme en forme de croix) : la ligne ne fonctionne pas actuellement, selon sa période de fonctionnement",
        4: "Gris (pictogramme d'attention) : une perturbation est prévue",
        5: "Orange (pictogramme d'attention) : une perturbation est en cours",
        6: "Rouge (pictogramme en forme de croix) : la circulation de la ligne est totalement interrompue",
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
              2
            ),
          },
        ],
      }
    },
  )
  return server
}

const app = createMcpExpressApp()

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
