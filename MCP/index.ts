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

  server.registerTool(
    'hello',
    {
      title: 'Dire bonjour',
      description: 'Renvoie un message de bienvenue avec le nom fourni.',
      inputSchema: {
        name: z.string().min(1).describe('Nom de la personne à saluer'),
      },
    },
    async ({ name }) => ({
      content: [{ type: 'text', text: `Bonjour ${name} !` }],
    }),
  )

  server.registerTool(
    'lignes',
    {
      title: 'Récupérer toutes les lignes',
      description: 'Récupère la liste de toutes les lignes disponibles.',
      inputSchema: {},
    },
    async () => {
      if (!api) {
        throw new Error('API_URL est manquant dans le fichier .env')
      }

      const apiResponse = await fetch(`${api}/getLingnes`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

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
  ),
  

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
