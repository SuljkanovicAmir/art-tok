import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  base: '/art-tok/',
  plugins: [
    react({
      babel: {
        plugins: [
          ['babel-plugin-react-compiler', {}],
        ],
      },
    }),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: false, // we use public/manifest.json
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
          {
            urlPattern: /\.(png|jpg|jpeg|webp|gif)$/i,
            handler: 'CacheFirst',
            options: { cacheName: 'images', expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 } },
          },
        ],
      },
    }),
  ],
})
