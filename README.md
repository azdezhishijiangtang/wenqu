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

## 免费图片文字提取

上传或粘贴最多 3 张题图，发送后点击「免费识别图片文字」。网站使用 Tesseract.js 在浏览器本机识别简体中文和英文，不需要视觉 API、额外 Key 或付费服务。识别引擎及字库从本站加载，可由浏览器缓存；首次使用需联网，手机上可能较慢。原图不会发送给识图服务，核对后的文字才发送给你配置的解题模型。解题模型本身是否收费取决于所用接口。

识别后请核对数字、负号、单位、上下标及公式。OCR 不等于图形理解，手写、复杂公式和布局可能出错。对于函数图、几何图、电路、化学流程和生物实验，使用内置模板补充坐标、箭头、连接关系与不确定之处。勾选核对确认后才能交给文字模型。识别失败可以重试或直接填写，系统不会自动调用付费视觉服务。停止识别或关闭窗口会释放识别任务。

构建和开发启动前会自动运行 `scripts/prepare-ocr.mjs`，从 npm 依赖复制 Worker、WASM 引擎和中英文字库到 `public/ocr/`；GitHub Pages 子路径部署同样支持。资源随静态网站发布，运行时不依赖第三方识图 CDN。文字核对与图形补充仅在当前弹窗中暂存，请勿在完成前关闭。

## 部署

仓库已包含 `.github/workflows/deploy.yml`。推送到 `main` 后：

1. GitHub 仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。
2. Actions 会自动构建并部署，地址为 `https://<用户名>.github.io/zhihu-study/`。

构建时通过环境变量 `GITHUB_PAGES=true` 切换资源路径前缀（见 `vite.config.ts`）。

## 技术栈

React 19 + TypeScript + Vite，KaTeX / remark-math 渲染数学公式，lucide-react 图标，localStorage 持久化。
