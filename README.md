# 知弧 · 高中理科学习工作台

面向高中生的数学、物理、化学、生物 AI 答疑与学习网站。前端纯静态，API Key 只保存在浏览器本地。

## 功能

- **AI 答疑**：四科切换、启发性 / 完整讲解两种模式、流式输出、Markdown + LaTeX 渲染，会话保存在本地。
- **知识手册**：四科核心公式与规律，支持搜索、学科 / 知识点筛选、复制、一键让 AI 举例讲解。
- **错题本**：记录错因与修正思路，按科目筛选，标记掌握，一键带错因再问 AI。
- **学习计划**：周视图安排任务、勾选完成、统计今日待办与累计完成，内置 25 分钟专注计时。

## 本地运行

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # 生产构建到 dist/
```

## 接入你的 API Key

打开网站右上角（手机为右上角钥匙图标）→「API 设置」，填写：

1. **API 地址**：兼容 OpenAI Chat Completions 的地址，例如 `https://api.deepseek.com/v1`，也可以直接填完整 `/chat/completions` 地址。
2. **模型名称**：例如 `deepseek-chat`。
3. **API Key**：保存在当前浏览器 `localStorage`，不会上传到本站服务器。

请求由浏览器直接发往你填写的接口。如果服务商禁止浏览器跨域（CORS），需要自行部署一个转发接口，或把 API 地址换成你的同源代理地址。

> 注意：本项目没有后端，API Key 属于浏览器端凭据。不要在公共电脑上保存密钥，使用完可以点「清除密钥」。

## 部署

仓库已包含 `.github/workflows/deploy.yml`。推送到 `main` 后：

1. GitHub 仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。
2. Actions 会自动构建并部署，地址为 `https://<用户名>.github.io/zhihu-study/`。

构建时通过环境变量 `GITHUB_PAGES=true` 切换资源路径前缀（见 `vite.config.ts`）。

## 技术栈

React 19 + TypeScript + Vite，KaTeX / remark-math 渲染数学公式，lucide-react 图标，localStorage 持久化。
