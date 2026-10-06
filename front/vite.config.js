import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), tailwindcss(), VitePWA({
    strategies: 'injectManifest',
    srcDir: 'src',
    filename: 'sw.js',
    injectRegister: false,
    manifest: false,
    injectManifest: { globPatterns: ['**/*.{js,css,html,png,ico}'] },
  })],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    preview: {
      allowedHosts: ['ginku.diogo-andrade.org'], // 👈 ajoute ton domaine
      port: 5173, // optionnel, explicite le port
      host: true, // permet d’écouter sur 0.0.0.0
    },
})
