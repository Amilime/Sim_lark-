import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      // 1. 凡是 /api/java 开头的请求，转发到 Java 后端 (8080)
      // 例如：前端发 /api/java/user/login -> 代理转发到 http://localhost:8080/user/login
      '/api/java': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/java/, '')
      },
      // 2. 凡是 /api/go 开头的请求，转发到 Go 后端 (8081)
      '/api/go': {
        target: 'http://localhost:8081',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/go/, '')
      },
      // 3. WebSocket 代理 (转发到 Go)
      '/ws': {
        target: 'ws://localhost:8081',
        ws: true,
        changeOrigin: true
      }
    }
  }
})