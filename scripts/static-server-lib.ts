import { createReadStream, statSync } from 'node:fs'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { extname, resolve, sep } from 'node:path'
import { pipeline } from 'node:stream'
import type { AddressInfo } from 'node:net'

const contentTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
}

function send(res: ServerResponse, status: number, text: string) {
  res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8', 'x-content-type-options': 'nosniff' })
  res.end(text)
}

export function createStaticServer(distDirectory: string, basePath: string) {
  const normalizedBase = `/${basePath.split('/').filter(Boolean).join('/')}/`
  const root = resolve(distDirectory)
  return createServer((request: IncomingMessage, response: ServerResponse) => {
    const requestUrl = new URL(request.url ?? '/', 'http://static.local')
    if (request.method !== 'GET' && request.method !== 'HEAD') return send(response, 405, 'Method not allowed')
    if (requestUrl.pathname === normalizedBase.slice(0, -1)) {
      response.writeHead(308, { location: `${normalizedBase}${requestUrl.search}` })
      return response.end()
    }
    if (!requestUrl.pathname.startsWith(normalizedBase)) return send(response, 404, 'Not found')
    let relative = decodeURIComponent(requestUrl.pathname.slice(normalizedBase.length))
    if (!relative || requestUrl.pathname.endsWith('/')) relative = `${relative}index.html`
    const filePath = resolve(root, relative)
    if (filePath !== root && !filePath.startsWith(`${root}${sep}`)) return send(response, 400, 'Invalid path')
    let fileStat
    try { fileStat = statSync(filePath) } catch { return send(response, 404, 'Not found') }
    if (!fileStat.isFile()) return send(response, 404, 'Not found')
    response.writeHead(200, {
      'content-type': contentTypes[extname(filePath)] ?? 'application/octet-stream',
      'content-length': fileStat.size,
      'x-content-type-options': 'nosniff',
      'cache-control': extname(filePath) === '.html' ? 'no-cache' : 'public, max-age=300',
    })
    if (request.method === 'HEAD') return response.end()
    pipeline(createReadStream(filePath), response, (error) => {
      if (error && !response.headersSent) send(response, 500, 'Static file read failed')
    })
  })
}

export function address(server: ReturnType<typeof createStaticServer>): AddressInfo {
  const value = server.address()
  if (!value || typeof value === 'string') throw new Error('Static server is not listening on a TCP port.')
  return value
}
