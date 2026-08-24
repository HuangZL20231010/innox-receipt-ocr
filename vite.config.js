import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import pkg from './package.json' with { type: 'json' }

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  server: {
    port: 5173,
    open: true,
    proxy: {
      '/api': 'http://127.0.0.1:3001',
    },
  },
  optimizeDeps: {
    include: ['pdfjs-dist'],
  },
})
