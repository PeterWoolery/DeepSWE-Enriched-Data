import { resolve } from 'node:path'
import { address, createStaticServer } from './static-server-lib.ts'

const basePath = process.env.STATIC_BASE_PATH ?? '/deepswe-explorer/'
const host = process.env.STATIC_HOST ?? '127.0.0.1'
const port = Number(process.env.STATIC_PORT ?? 4173)
const server = createStaticServer(resolve('dist'), basePath)
server.listen(port, host, () => {
  const listening = address(server)
  console.log(`Plain static preview: http://${host === '0.0.0.0' ? '127.0.0.1' : host}:${listening.port}${basePath}`)
  console.log('Unknown paths return 404; query-state refreshes use the static index at the project root.')
})
