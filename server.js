import { createServer } from 'http'
import { parse } from 'url'
import next from 'next'
import { WebSocketServer } from 'ws'
import { buildCookieNames, decodeSessionCookie } from './src/lib/authCore.js'
import { buildAlertScopeKey } from './src/lib/alertScope.js'
import {
  registerAlertSocket,
  unregisterAlertSocket,
} from './src/lib/server/alertSocketHub.js'
 
const port = parseInt(process.env.PORT || '3010', 10)
const lifecycleEvent = String(process.env.npm_lifecycle_event || '')
const shouldForceProduction =
  !process.env.NODE_ENV && (lifecycleEvent === 'start' || Boolean(process.env.IISNODE_VERSION))

if (shouldForceProduction) {
  process.env.NODE_ENV = 'production'
}

const dev = process.env.NODE_ENV !== 'production'
const app = next({ dev })
const handle = app.getRequestHandler()
const COOKIE_NAMES = buildCookieNames('customer')

function parseCookieHeader(header = '') {
  return String(header || '')
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean)
    .reduce((acc, pair) => {
      const separatorIndex = pair.indexOf('=')
      if (separatorIndex < 0) return acc
      const key = pair.slice(0, separatorIndex).trim()
      const value = pair.slice(separatorIndex + 1).trim()
      if (key) acc.set(key, decodeURIComponent(value))
      return acc
    }, new Map())
}

function getAuthContextFromRequest(req) {
  const cookieMap = parseCookieHeader(req?.headers?.cookie || '')
  const session = decodeSessionCookie(
    cookieMap.get(COOKIE_NAMES.session),
    cookieMap.get(COOKIE_NAMES.token)
  )

  const loginFor = String(cookieMap.get(COOKIE_NAMES.loginFor) || session?.loginFor || '').toUpperCase()
  const loginKey = String(cookieMap.get(COOKIE_NAMES.loginKey) || session?.loginKey || '')
  const tokenExpiresAt = Number(session?.tokenExpiresAt || 0)
  const accessToken =
    Number.isFinite(tokenExpiresAt) && tokenExpiresAt > 0 && tokenExpiresAt <= Date.now()
      ? ''
      : String(session?.accessToken || '')

  if (!loginFor || !loginKey) return null

  return {
    loginFor,
    loginKey,
    accessToken,
    entryUser: String(session?.userId || session?.username || ''),
    distributorId: String(session?.distributorId || ''),
    organizationId: String(session?.organizationId || ''),
    companyId: String(session?.companyId || ''),
    ownershipScopeType: String(session?.ownershipScopeType || ''),
    ownershipScopeId: String(session?.ownershipScopeId || ''),
  }
}

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true)
    handle(req, res, parsedUrl)
  })
  const wsServer = new WebSocketServer({ noServer: true })

  server.on('upgrade', (req, socket, head) => {
    const parsedUrl = parse(req.url || '', true)
    if (parsedUrl.pathname !== '/ws/alerts') {
      socket.destroy()
      return
    }

    const authContext = getAuthContextFromRequest(req)
    if (!authContext) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
      socket.destroy()
      return
    }

    const scopeKey = buildAlertScopeKey(authContext)
    wsServer.handleUpgrade(req, socket, head, (ws) => {
      ws.scopeKey = scopeKey
      ws.authContext = authContext
      wsServer.emit('connection', ws, req)
    })
  })

  wsServer.on('connection', (socket) => {
    const scopeKey = socket.scopeKey

    if (!scopeKey) {
      socket.close()
      return
    }

    registerAlertSocket(scopeKey, socket)
    socket.send(
      JSON.stringify({
        type: 'alerts.connected',
        scopeKey,
        syncedAt: new Date().toISOString(),
      })
    )

    socket.on('message', (message) => {
      const text = String(message || '').trim().toLowerCase()
      if (text === 'refresh') {
        socket.send(
          JSON.stringify({
            type: 'alerts.refresh-requested',
            scopeKey,
            syncedAt: new Date().toISOString(),
          })
        )
      }
    })

    socket.on('close', () => {
      unregisterAlertSocket(scopeKey, socket)
    })

    socket.on('error', () => {
      unregisterAlertSocket(scopeKey, socket)
    })
  })

  server.listen(port)
 
  console.log(
    `> Server listening at http://localhost:${port} as ${
      dev ? 'development' : process.env.NODE_ENV
    }`
  )
})
