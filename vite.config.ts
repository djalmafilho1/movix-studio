import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  envDir: false,
  server: {
    port: 5173,
    strictPort: true,
    watch: { ignored: ['**/.artifacts/**'] },
    proxy: {
      '/api': 'http://127.0.0.1:8787',
    },
  },
})
