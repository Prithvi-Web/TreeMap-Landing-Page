import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// three.js is only ever reached through the lazy-loaded Experience chunk, so
// splitting it out keeps the initial paint bundle small; the raised warning
// limit reflects that the three chunk is intentionally large and async.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5199,
    strictPort: true,
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 950,
    rollupOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'three', test: /[\\/]node_modules[\\/]three[\\/]/ },
            { name: 'gsap', test: /[\\/]node_modules[\\/]gsap[\\/]/ },
          ],
        },
      },
    },
  },
})
