import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Backend controllers no longer carry an "api/" prefix in their route templates —
      // in IIS that prefix comes from the child Application's PathBase (/api). Locally,
      // Vite's dev server plays that same role: it owns the /api prefix and forwards the
      // remainder to the backend, so the frontend's relative /api/... calls stay identical
      // in both environments.
      '/api': {
        target:       'http://localhost:5000',
        changeOrigin: true,
        rewrite:      path => path.replace(/^\/api/, ''),
      },
    },
  },
})
