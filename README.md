# 知弧 · 高中理科学习工作台

面向高中生的数学、物理、化学、生物 AI 答疑与学习网站。支持静态前端与可选的 Modlens 本机增强版，解题 API Key 只保存在浏览器本地。

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

> 注意：解题请求由浏览器直接发送，不经过可选的 Modlens 本机服务。API Key 属于浏览器端凭据。不要在公共电脑上保存密钥，使用完可以点「清除密钥」。

## 免费图片文字提取

上传或粘贴最多 3 张题图，发送后点击「免费识别图片文字」。网站使用 Tesseract.js 在浏览器本机识别简体中文和英文，不需要视觉 API、额外 Key 或付费服务。识别引擎及字库从本站加载，可由浏览器缓存；首次使用需联网，手机上可能较慢。原图不会发送给识图服务，核对后的文字才发送给你配置的解题模型。解题模型本身是否收费取决于所用接口。

识别后请核对数字、负号、单位、上下标及公式。OCR 不等于图形理解，手写、复杂公式和布局可能出错。对于函数图、几何图、电路、化学流程和生物实验，使用内置模板补充坐标、箭头、连接关系与不确定之处。勾选核对确认后才能交给文字模型。识别失败可以重试或直接填写，系统不会自动调用付费视觉服务。停止识别或关闭窗口会释放识别任务。

构建和开发启动前会自动运行 `scripts/prepare-ocr.mjs`，从 npm 依赖复制 Worker、WASM 引擎和中英文字库到 `public/ocr/`；GitHub Pages 子路径部署同样支持。资源随静态网站发布，运行时不依赖第三方识图 CDN。文字核对与图形补充仅在当前弹窗中暂存，请勿在完成前关闭。

## Modlens 图形理解（本机增强版）

已接入 `@liustack/modlens@3.27.2`，不仅能提取文字，还可借助视觉引擎返回布局、实体、关系和不确定项，再交给任意兼容的文字解题模型。Modlens 自身是桥接程序，不包含离线视觉模型。官方文档：[引擎说明](https://github.com/liustack/modlens#vision-engines-six-built-in-providers-four-reusable-clis-one-failover-chain)、[CLI 手册](https://github.com/liustack/modlens/blob/main/docs/cli.md)。

本项目固定使用 `-p antigravity-cli`，**不自动回退到 Gemini API、OpenAI API 或其他付费/订阅接口**。Antigravity 路线由上游提供免费使用，受账号资格、地区、配额与服务政策限制；不能保证永久免费或无限额度。额度耗尽、未登录或不可用时会报错，可手动改用本地 OCR。图片会由本机 Modlens 交给 Antigravity 服务，只有 OCR 是本机离线计算。

GitHub Pages 不能执行 Node.js/CLI。要使用 Modlens，请在自己的电脑或手机 Linux 环境运行本机增强版（Node >= 22.19）：

1. 按 [Antigravity 官方说明](https://antigravity.google/cli) 安装 CLI，运行 `agy` 完成登录并退出（若提示找不到命令，可使用 `~/.local/bin/agy`）。本机服务也会检查该默认安装目录。登录及是否有免费使用资格由用户确认。
2. 在项目目录执行：

   ```bash
   npm ci
   npm run doctor:modlens
   npm run build
   npm run start:modlens
   ```

3. 打开 `http://127.0.0.1:4174`，上传题图并选择「Modlens 图形理解」。识别后逐项核对，再提交给解题模型。

本机增强版仅监听回环地址，提供网页和同源识图接口；拒绝跨站请求、任意本机路径与远程图片 URL。不会向公网暴露你的引擎登录。它与 GitHub Pages 是不同浏览器来源，API 设置、聊天和错题数据独立保存，需要在本机地址重新填写原来的解题接口。关闭服务后 Modlens 功能不可用；GitHub Pages 的 OCR 功能不受影响。普通 `npm run dev` 不提供 Modlens 接口。

`npm run test:modlens` 检查本机服务契约与输入限制，测试使用模拟引擎，不消耗上游额度。真实图形理解需安装、登录并有可用免费额度后另行验证。

## 部署

仓库已包含 `.github/workflows/deploy.yml`。推送到 `main` 后：

1. GitHub 仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。
2. Actions 会自动构建并部署，地址为 `https://<用户名>.github.io/zhihu-study/`。

构建时通过环境变量 `GITHUB_PAGES=true` 切换资源路径前缀（见 `vite.config.ts`）。

## 技术栈

React 19 + TypeScript + Vite，KaTeX / remark-math 渲染数学公式，lucide-react 图标，localStorage 持久化。
