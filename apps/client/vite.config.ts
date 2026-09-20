import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * A portal build (docs/08 M12d) ships no service worker at all. Not registering one is not enough:
 * the plugin still writes sw.js and a manifest into the folder, and the CI check caught exactly
 * that on its first run, which is the point of checking the build rather than trusting the flag.
 */
const PORTAL = process.env.VITE_PORTAL === '1';

/**
 * Installable web app that opens with no connection (docs/13): the service worker precaches the
 * whole build. It is registered in main.tsx on the web only, never inside the native apps and
 * never in a portal build.
 */
const pwa = [
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
];

export default defineConfig({
  plugins: [preact(), ...(PORTAL ? [] : pwa)],
  // Relative asset paths so the same build works on the web, in portals and inside Capacitor.
  base: './',
  // The bot worker is a module worker (src/bot/worker.ts); keep that format in the build too.
  worker: { format: 'es' },
  server: {
    host: true,
    port: 5173,
  },
});
