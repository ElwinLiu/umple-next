import path from "path"
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
// VITE_ALLOWED_HOSTS: comma-separated hostnames or patterns (e.g. ".umple.org")
// Defaults to localhost only. Root .env controls service ports; frontend/.env can override them.
const env = {
  ...loadEnv(mode, path.resolve(__dirname, '..'), ''),
  ...loadEnv(mode, __dirname, ''),
}
const allowedHosts = env.VITE_ALLOWED_HOSTS
  ? ['localhost', ...env.VITE_ALLOWED_HOSTS.split(',').map(h => h.trim()).filter(Boolean)]
  : ['localhost']

function readPort(value: string | undefined, fallback: number) {
  const port = Number(value)
  return Number.isInteger(port) && port > 0 ? port : fallback
}

const backendPort = readPort(env.BACKEND_PORT, 3001)
const collabPort = readPort(env.COLLAB_PORT, 3002)
const lspPort = readPort(env.LSP_PORT, 9999)

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
        target: `http://localhost:${backendPort}`,
        changeOrigin: true,
      },
      '/ws/collab': {
        target: `ws://localhost:${collabPort}`,
        ws: true,
      },
      '/ws/lsp': {
        target: `ws://localhost:${lspPort}`,
        ws: true,
        rewrite: (path) => path.replace(/^\/ws\/lsp/, ''),
      },
    },
  },
}
})
