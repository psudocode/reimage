import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // 'prompt': a new version waits until the user accepts, so a reload never kills a running job.
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'reimage',
        short_name: 'reimage',
        description: 'All-in-one image tools in your browser. No uploads, no sign-up, no limits.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#020617',
        theme_color: '#020617',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App shell, workers and lazy chunks are precached. Codec WASM is large, so it is
        // cached on first use instead (CacheFirst) rather than forcing every codec on install.
        globPatterns: ['**/*.{js,css,html,svg,png,json}'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.endsWith('.wasm'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'codec-wasm',
              expiration: { maxEntries: 20 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
        navigateFallback: 'index.html',
      },
    }),
  ],
  // Workers lazy-load `pica` and the WASM codecs via dynamic import(), which needs
  // code-splitting. Vite's default `iife` worker format cannot do that.
  worker: { format: 'es' },
  // Dev server: pre-bundling rewrites the `new URL('*.wasm', import.meta.url)`
  // lookups inside jSquash, so serve these packages untouched.
  optimizeDeps: {
    exclude: ['@jsquash/jpeg', '@jsquash/png', '@jsquash/oxipng', '@jsquash/webp', '@jsquash/avif'],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
});
