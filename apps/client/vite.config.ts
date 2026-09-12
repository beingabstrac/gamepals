import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [preact()],
  // Relative asset paths so the same build works on the web, in portals and inside Capacitor.
  base: './',
  server: {
    host: true,
    port: 5173,
  },
});
