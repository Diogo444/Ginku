import { defineConfig } from '@playwright/test'
import baseConfig from './playwright.config.js'

export default defineConfig({
  ...baseConfig,
  outputDir: './test-results/dev',
  testMatch: ['**/dev.spec.js', '**/data-import.spec.js'],
  use: { ...baseConfig.use, baseURL: 'http://localhost:4174' },
  webServer: {
    command: 'pnpm run dev --host localhost --port 4174 --strictPort',
    url: 'http://localhost:4174',
    reuseExistingServer: false,
  },
})
