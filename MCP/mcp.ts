import express from 'express'
import cors from 'cors'
import { randomUUID } from 'node:crypto'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { z } from 'zod'

const app = express()
app.use(cors())
app.use(express.json())

const transports = new Map<string, StreamableHTTPServerTransport>()
const ApiUrl = 'http://localhost:3000/api'

function createServer() {
  const server = new McpServer({
    name: 'ginku-mcp',
    version: '1.0.0',
  })

  ;(server.registerTool(
    'hello',
    {
      title: 'Dire bonjour',
      description: 'Retourne un message de test',
      inputSchema: {
        name: z.string().default('Diogo'),
      },
    },
    async ({ name }) => ({
      content: [
        {
          type: 'text',
          text: `Salut ${name}, ton serveur MCP Streamable HTTP fonctionne 🎉`,
        },
      ],
    }),
  ),
    server.registerTool(
        'GetStations',
        {
            title: 'Récupérer tous les arrêt',
            description: 'Récupère tous les arrêts de Ginko',
            inputSchema: {},
        },
        async () => {
            const response = await fetch(`${ApiUrl}/getLingnes`);
            const stations = await response.json();
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(stations),
                    },
                ],
            };
        }
    )
  )


  return server
}

app.post('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined

  let transport: StreamableHTTPServerTransport

  if (sessionId && transports.has(sessionId)) {
    transport = transports.get(sessionId)!
  } else {
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (newSessionId) => {
        transports.set(newSessionId, transport)
      },
    })

    transport.onclose = () => {
      if (transport.sessionId) {
        transports.delete(transport.sessionId)
      }
    }

    const server = createServer()
    await server.connect(transport)
  }

  await transport.handleRequest(req, res, req.body)
})

app.get('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined
  const transport = sessionId ? transports.get(sessionId) : undefined

  if (!transport) {
    res.status(400).send('Invalid or missing session ID')
    return
  }

  await transport.handleRequest(req, res)
})

app.delete('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined
  const transport = sessionId ? transports.get(sessionId) : undefined

  if (!transport) {
    res.status(400).send('Invalid or missing session ID')
    return
  }

  await transport.handleRequest(req, res)
})

app.listen(3001, () => {
  console.log('MCP Streamable HTTP lancé sur http://localhost:3001/mcp')
})
