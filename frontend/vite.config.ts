import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))

function gitShortHash(): string {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    return 'unknown'
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Constantes de build — se recalculan en cada `vite build`, así que el panel
  // "Acerca de" del sidebar siempre refleja el commit y el momento exactos de
  // la publicación vigente, sin tocar el script de deploy.
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __GIT_COMMIT__:  JSON.stringify(gitShortHash()),
    __BUILD_TIME__:  JSON.stringify(new Date().toISOString()),
  },
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
