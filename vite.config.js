import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('firebase')) return 'firebase';
            if (id.includes('pdfjs-dist')) return 'pdfjs';
            if (id.includes('react')) return 'react';
            if (id.includes('lucide-react')) return 'icons';
          }
        }
      }
    }
  },
  server: {
    host: true,
    port: 5173
  }
})
