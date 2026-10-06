import { defineConfig } from '@playwright/test'
import process from 'node:process'

export default defineConfig({
  testDir: './tests',
  workers: 1,
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:4173',
    browserName: 'chromium',
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    serviceWorkers: 'allow',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'pnpm run preview --host localhost --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: false,
  },
})
