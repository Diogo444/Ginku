import { defineConfig } from '@playwright/test'
import process from 'node:process'

export default defineConfig({
  testDir: './tests',
  outputDir: './test-results/pwa',
  testMatch: '**/pwa.spec.js',
  workers: 1,
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:4173',
    browserName: 'chromium',
    // Le Chromium complet prend en charge les notifications du service worker,
    // contrairement au headless shell utilisé par défaut sur cette machine.
    channel: process.env.PLAYWRIGHT_CHANNEL || 'chromium',
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
