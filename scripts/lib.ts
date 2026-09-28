import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export function projectPath(relativePath: string): string {
  return resolve(ROOT, relativePath)
}

export async function readJson<T>(relativePath: string): Promise<T> {
  const text = await readFile(projectPath(relativePath), 'utf8')
  return JSON.parse(text) as T
}

export async function maybeReadJson<T>(relativePath: string): Promise<T | null> {
  try {
    return await readJson<T>(relativePath)
  } catch (error) {
    if (hasCode(error, 'ENOENT')) return null
    throw error
  }
}

export async function writeJsonAtomic(relativePath: string, value: unknown): Promise<void> {
  const destination = projectPath(relativePath)
  await mkdir(dirname(destination), { recursive: true })
  const temporary = `${destination}.tmp-${process.pid}`
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  await rename(temporary, destination)
}

export function sha256(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex')
}

export function hasCode(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code
}

export function stableJson(value: unknown): string {
  return JSON.stringify(value)
}
