import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// `base` 让构建产物能在 GitHub Pages 的 /<仓库名>/ 子路径下正确加载资源。
// 本地开发不受影响。
export default defineConfig({
  base: process.env.GITHUB_PAGES === 'true' ? '/zhihu-study/' : '/',
  plugins: [react()],
})
