import { defineConfig } from '@playwright/test'

const systemChromium = process.env.CHROMIUM_PATH

export default defineConfig({
  testDir: './browser-tests',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  timeout: 30_000,
  expect: { timeout: 7_000 },
  use: {
    baseURL: 'http://127.0.0.1:4173/deepswe-explorer/',
    browserName: 'chromium',
    headless: true,
    viewport: { width: 1440, height: 1000 },
    launchOptions: systemChromium ? { executablePath: systemChromium, args: ['--no-sandbox', '--disable-dev-shm-usage'] } : {},
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run serve:static',
    url: 'http://127.0.0.1:4173/deepswe-explorer/',
    reuseExistingServer: false,
    timeout: 30_000,
    env: {
      STATIC_HOST: '127.0.0.1',
      STATIC_BASE_PATH: '/deepswe-explorer/',
      STATIC_PORT: '4173',
    },
  },
})
