import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8071',
        changeOrigin: true,
      },
      // Proxy khusus untuk Trend API (Trans-Data HTTP API)
      // Supaya frontend bisa akses lewat origin yang sama saat `pnpm dev`:
      //   /trend-api/days  -> http://localhost:8072/days
      '/trend-api': {
        target: 'http://192.168.113.142:8072',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/trend-api/, ''),
      },
    },
  },
})

