/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.png', 'favicon.png', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Ámbar Steak House',
        short_name: 'Ámbar',
        description: 'Menú digital, pedidos y tarjeta de fidelización de Ámbar Steak House',
        lang: 'es',
        theme_color: '#0E0E10',
        background_color: '#0E0E10',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,webp,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.endsWith('/rpc/get_public_data'),
            handler: 'NetworkFirst',
            method: 'POST',
            options: { cacheName: 'menu-data', networkTimeoutSeconds: 5 },
          },
          {
            urlPattern: ({ url }) => url.pathname.includes('/storage/v1/object/public/'),
            handler: 'CacheFirst',
            options: { cacheName: 'media', expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 } },
          },
          {
            urlPattern: ({ url }) => url.hostname.endsWith('fonts.gstatic.com') || url.hostname.endsWith('fonts.googleapis.com'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'fonts' },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
