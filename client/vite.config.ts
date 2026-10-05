import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // 'inline' incorpora la registrazione del service worker direttamente nell'HTML
      // (invece di un file registerSW.js esterno): alcuni scanner come PWABuilder fanno
      // solo un'analisi statica della pagina e non eseguono script esterni referenziati.
      injectRegister: 'inline',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Nutri',
        short_name: 'Nutri',
        description: 'Traccia calorie, macronutrienti e attività sportive',
        lang: 'it',
        dir: 'ltr',
        categories: ['health', 'food', 'lifestyle'],
        theme_color: '#863bff',
        background_color: '#ffffff',
        display: 'standalone',
        display_override: ['standalone'],
        prefer_related_applications: false,
        orientation: 'portrait',
        id: '/',
        start_url: '/',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        screenshots: [
          { src: 'screenshots/mobile-1.png', sizes: '673x1280', type: 'image/png', form_factor: 'narrow' },
          { src: 'screenshots/desktop-1.png', sizes: '615x682', type: 'image/png', form_factor: 'wide' },
        ],
      },
      workbox: {
        // Le chiamate /api/* non vanno mai servite dalla cache: i dati del diario
        // devono sempre arrivare freschi dal server.
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            urlPattern: /^\/api\//,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
})
