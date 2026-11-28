import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
    setupFiles: ['./src/test/setup.ts'],
  },
});
