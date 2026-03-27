import path from "path"
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
// VITE_ALLOWED_HOSTS: comma-separated hostnames or patterns (e.g. ".umple.org")
// Defaults to localhost only. Set in frontend/.env for dev behind a reverse proxy.
const env = loadEnv(mode, __dirname, 'VITE_')
const allowedHosts = env.VITE_ALLOWED_HOSTS
  ? ['localhost', ...env.VITE_ALLOWED_HOSTS.split(',').map(h => h.trim()).filter(Boolean)]
  : ['localhost']

return {
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: 'node',
    exclude: ['tests/e2e/**', 'node_modules/**'],
    env: {
      NODE_ENV: 'test',
    },
    setupFiles: [],
    testTimeout: 30000,
  },
  server: {
    port: 3200,
    host: true,
    allowedHosts,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
}
})
