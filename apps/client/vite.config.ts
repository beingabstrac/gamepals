import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    preact(),
    // Installable web app that opens with no connection (docs/13): the service worker precaches the
    // whole build. It is registered in main.tsx on the web only, never inside the native apps.
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Game Pals',
        short_name: 'Game Pals',
        description: 'Every game. Every way to play.',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'any',
        background_color: '#FFFDF8',
        theme_color: '#FFFDF8',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff,woff2}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: 'index.html',
      },
    }),
  ],
  // Relative asset paths so the same build works on the web, in portals and inside Capacitor.
  base: './',
  // The bot worker is a module worker (src/bot/worker.ts); keep that format in the build too.
  worker: { format: 'es' },
  server: {
    host: true,
    port: 5173,
  },
});
