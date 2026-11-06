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
        id: './',
        name: 'Ámbar Steak House',
        short_name: 'Ámbar',
        description: 'Menú digital, pedidos y tarjeta de fidelización de Ámbar Steak House',
        lang: 'es',
        theme_color: '#0E0E10',
        background_color: '#0E0E10',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui'],
        orientation: 'any',
        categories: ['food', 'lifestyle'],
        start_url: './',
        scope: './',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/monochrome-512.png', sizes: '512x512', type: 'image/png', purpose: 'monochrome' },
        ],
        // Accesos directos al mantener presionado el ícono (Android) o clic derecho (escritorio).
        shortcuts: [
          { name: 'Menú', short_name: 'Menú', url: './#/menu', icons: [{ src: 'icons/shortcut-menu.png', sizes: '96x96', type: 'image/png' }] },
          { name: 'Pedido', short_name: 'Pedido', url: './#/pedido', icons: [{ src: 'icons/shortcut-pedido.png', sizes: '96x96', type: 'image/png' }] },
          { name: 'Tarjeta Ámbar', short_name: 'Tarjeta', url: './#/tarjeta', icons: [{ src: 'icons/shortcut-tarjeta.png', sizes: '96x96', type: 'image/png' }] },
        ],
        // Ficha de instalación enriquecida en Android/Chrome.
        screenshots: [
          { src: 'screenshots/home-narrow.png', sizes: '390x844', type: 'image/png', form_factor: 'narrow', label: 'Inicio de Ámbar Steak House' },
          { src: 'screenshots/menu-narrow.png', sizes: '390x844', type: 'image/png', form_factor: 'narrow', label: 'Menú digital' },
          { src: 'screenshots/home-wide.png', sizes: '1280x800', type: 'image/png', form_factor: 'wide', label: 'Ámbar en tablet y escritorio' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,webp,svg,woff2}'],
        // Las pantallas de arranque y capturas solo las usa el sistema al instalar; no se precargan.
        globIgnores: ['splash/**', 'screenshots/**'],
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
