import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

const repository = process.env.GITHUB_REPOSITORY?.split('/')[1]
const owner = process.env.GITHUB_REPOSITORY?.split('/')[0]
const pagesBase = process.env.GITHUB_ACTIONS === 'true'
  ? repository && owner && repository !== `${owner}.github.io`
    ? `/${repository}/`
    : '/'
  : '/'

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? pagesBase,
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
  },
})
