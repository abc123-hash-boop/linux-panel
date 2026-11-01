import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'
import { join } from 'path'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
        ws: true
      },
      '/ws': {
        target: 'ws://127.0.0.1:8080',
        ws: true,
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // 生成 HTML 后注入缓存控制
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    }
  },
  // 开发环境也禁用缓存
  appType: 'spa',
  // 构建后钩子：给 index.html 注入 no-cache meta
  postBuild(options, _bundle) {
    const htmlPath = join(options.outDir, 'index.html')
    let html = readFileSync(htmlPath, 'utf-8')
    const noCache = `<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
    <meta http-equiv="Pragma" content="no-cache" />
    <meta http-equiv="Expires" content="0" />`
    html = html.replace('</head>', noCache + '</head>')
    writeFileSync(htmlPath, html, 'utf-8')
    console.log('index.html cache-control injected')
  },
  // 后处理钩子（Vite 5）：注入缓存控制
  buildEnd(options, bundle) {
    const htmlPath = join(options.outDir, 'index.html')
    try {
      let html = readFileSync(htmlPath, 'utf-8')
      const noCache = `<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
      <meta http-equiv="Pragma" content="no-cache" />
      <meta http-equiv="Expires" content="0" />`
      if (!html.includes('Cache-Control')) {
        html = html.replace('</head>', noCache + '</head>')
        writeFileSync(htmlPath, html, 'utf-8')
        console.log('index.html cache-control injected (buildEnd)')
      }
    } catch (e) {
      console.warn('buildEnd cache-control failed:', e)
    }
  }
})
