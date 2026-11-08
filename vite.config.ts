import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// 相对 base：构建产物按 index.html 所在目录加载资源，
// 因此仓库改名、换 Pages 子路径或以后绑自定义域名都不用重新改配置。
// 本站是单页状态切换、没有前端路由，不存在多级路径下相对路径失效的问题。
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { target: 'es2018' },
})
