import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5183,
    // En desarrollo la API vive en wrangler dev (:8787); en producción el
    // mismo Worker sirve /api y estos estáticos, así que no hay proxy ni CORS.
    proxy: { '/api': 'http://localhost:8787' }
  },
  build: {
    // El build se publica como assets del Worker (cloud/server/public).
    outDir: '../server/public',
    emptyOutDir: true
  }
})
