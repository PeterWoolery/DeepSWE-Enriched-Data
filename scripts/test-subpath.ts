import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { address, createStaticServer } from './static-server-lib.ts'

const basePath = '/deepswe-explorer/'
const dist = resolve('dist')
const server = createStaticServer(dist, basePath)

async function expectStatus(url: string, status: number): Promise<Response> {
  const response = await fetch(url)
  if (response.status !== status) throw new Error(`${url} returned ${response.status}; expected ${status}.`)
  return response
}

async function main() {
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done))
  try {
    const origin = `http://127.0.0.1:${address(server).port}`
    const index = await expectStatus(`${origin}${basePath}?view=combined&x=time&model=openai%3Agpt-6-sol`, 200)
    const html = await index.text()
    if (!html.includes('DeepSWE Explorer')) throw new Error('Project-subpath root did not serve the production index.')
    const localAssets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => match[1]!).filter((asset) => asset.startsWith('/'))
    if (!localAssets.length || localAssets.some((asset) => !asset.startsWith(basePath))) throw new Error(`Production assets are not all project-base aware: ${localAssets.join(', ')}`)
    let assetContents = ''
    for (const asset of localAssets) {
      const response = await expectStatus(new URL(asset, origin).toString(), 200)
      assetContents += await response.text()
    }
    if (/(?:OPENAI|OLLAMA|ANTHROPIC|XAI)_API_KEY\s*=|sk-[a-zA-Z0-9]{24,}/.test(assetContents)) throw new Error('A secret-like credential was found in built client assets.')

    const dataResponse = await expectStatus(`${origin}${basePath}data/observations.json`, 200)
    const dataText = await dataResponse.text()
    const dataset = JSON.parse(dataText) as { revisionId: string; observations: Array<{ id: string; sourceCategory: string }> }
    if (!dataset.revisionId || !dataset.observations.length) throw new Error('Approved JSON export is missing its revision or observations.')
    if (dataset.observations.some((row) => row.id.startsWith('fixture-') || row.id.startsWith('synthetic-'))) throw new Error('Synthetic fixture leaked into production data.')
    const csvText = await (await expectStatus(`${origin}${basePath}data/observations.csv`, 200)).text()
    const candidatesText = await (await expectStatus(`${origin}${basePath}data/candidates.json`, 200)).text()
    if (/(?:OPENAI|OLLAMA|ANTHROPIC|XAI)_API_KEY\s*=|sk-[a-zA-Z0-9]{24,}/.test(`${assetContents}\n${dataText}\n${csvText}\n${candidatesText}`)) throw new Error('A secret-like credential was found in the public static artifact.')
    await expectStatus(`${origin}/deepswe-explorer/not-a-real-route/deep`, 404)
    await expectStatus(`${origin}/not-the-project/`, 404)

    const allFiles = ['index.html', ...localAssets.map((asset) => asset.slice(basePath.length)), 'data/observations.json', 'data/observations.csv']
    let size = 0
    for (const relative of new Set(allFiles)) {
      try { size += (await readFile(resolve(dist, relative))).byteLength } catch { /* built assets are checked by HTTP above */ }
    }
    if (size >= 1_000_000_000) throw new Error('Static site exceeds the documented GitHub Pages 1 GB site limit.')
    console.log(`Project-subpath static verification passed: ${basePath} root/query reload, ${localAssets.length} same-origin assets, approved JSON/CSV/candidate assets, unknown-route 404, ${dataset.observations.length} approved observations, ${size} bytes sampled.`)
  } finally {
    await new Promise<void>((done, reject) => server.close((error) => error ? reject(error) : done()))
  }
}

main().catch((error: unknown) => {
  console.error(`Static subpath verification failed: ${error instanceof Error ? error.message : 'unknown error'}`)
  process.exitCode = 1
})
