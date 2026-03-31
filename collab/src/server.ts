import http from 'node:http'
import { WebSocketServer } from 'ws'
// @ts-expect-error — y-websocket ships CJS utils without type declarations
import { setupWSConnection } from 'y-websocket/bin/utils'

const PORT = parseInt(process.env.PORT ?? '3002', 10)

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end('ok')
    return
  }
  res.writeHead(404)
  res.end()
})

const wss = new WebSocketServer({ server })

wss.on('connection', (ws, req) => {
  // Extract room ID from URL path: /ws/collab/<roomId>
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`)
  const match = url.pathname.match(/^\/ws\/collab\/(.+)$/)
  const roomId = match?.[1] ?? 'default'

  console.log(`[collab] client connected to room "${roomId}" (url: ${req.url})`)

  setupWSConnection(ws, req, { docName: roomId })

  ws.on('close', () => {
    console.log(`[collab] client disconnected from room "${roomId}"`)
  })
})

server.listen(PORT, () => {
  console.log(`Collab server listening on port ${PORT}`)
})
