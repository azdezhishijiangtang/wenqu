# 问渠 · 高中理科学习工作台

面向高中生的数学、物理、化学、生物 AI 答疑与学习网站。解题 API Key 只保存在浏览器本地；图像理解由网站自带的云端服务提供，所有设备可用。

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

> 注意：解题请求由浏览器直接发送给你的模型接口，不经过本站的识图服务。API Key 属于浏览器端凭据，不要在公共电脑上保存，使用完可以点「清除密钥」。

## 免费图片文字提取

上传或粘贴最多 3 张题图，发送后点击「免费识别图片文字」。网站使用 Tesseract.js 在浏览器本机识别简体中文和英文，不需要视觉 API、额外 Key 或付费服务。识别引擎及字库从本站加载，可由浏览器缓存；首次使用需联网，手机上可能较慢。原图不会发送给识图服务，核对后的文字才发送给你配置的解题模型。解题模型本身是否收费取决于所用接口。

识别后请核对数字、负号、单位、上下标及公式。OCR 不等于图形理解，手写、复杂公式和布局可能出错。对于函数图、几何图、电路、化学流程和生物实验，使用内置模板补充坐标、箭头、连接关系与不确定之处。勾选核对确认后才能交给文字模型。识别失败可以重试或直接填写，系统不会自动调用付费视觉服务。停止识别或关闭窗口会释放识别任务。

构建和开发启动前会自动运行 `scripts/prepare-ocr.mjs`，从 npm 依赖复制 Worker、WASM 引擎和中英文字库到 `public/ocr/`；GitHub Pages 子路径部署同样支持。资源随静态网站发布，运行时不依赖第三方识图 CDN。文字核对与图形补充仅在当前弹窗中暂存，请勿在完成前关闭。

## 云端图形理解（所有设备可用，按账号限次）

网站内置了一个可公开访问的识图服务，部署在 Cloudflare Workers 上，调用 Workers AI 的视觉模型 `@cf/meta/llama-3.2-11b-vision-instruct`。访客在任何手机、平板或电脑上打开网站，用自己的识图账号登录即可上传题图，无需安装插件、无需各自的 API Key、也无需运行本机程序。

识别结果只包含「图像证据」（文字、坐标轴、箭头、连接关系、不确定项），交给你原本配置的文字解题模型推理。主模型不会收到原图。

### 额度分配

| 规则 | 默认值 | 说明 |
| --- | --- | --- |
| 每账号每天 | 3 张 | 按北京时间自然日计算，服务端扣减，换设备或清缓存都不能重置 |
| 全站每天 | 60 张 | 兜住 Cloudflare 免费额度，避免少数人耗尽全站次数 |
| 失败是否扣次 | 不扣 | 模型报错会原样退回本次占用的次数 |

两个上限可改 `cloudflare/wrangler.toml` 的 `DAILY_USER_LIMIT`、`DAILY_GLOBAL_LIMIT` 后重新部署。Cloudflare 免费计划提供每天 10000 Neurons，额度用完只会报错、不会自动扣费；本项目不配置付费结算，也不会切换到付费模型。

实测每张题图约消耗 18 Neurons（1649 输入 + 176 输出 tokens），因此每天 10000 Neurons 约合 500 张；默认全站 60 张留有充足余量。`moondream3.1` 在该账号上始终返回空对象，已弃用；`deepseek-v4-flash` 属付费专用模型，未采用。

账号只用于计数：用户名 + 密码（PBKDF2 加盐，迭代 30000 次以适配免费版 10ms CPU 限制），服务端只保存密码哈希、盐和当天的识别张数，不保存聊天内容或图片。图片只在本次请求中传给视觉模型。

### 账号、数据备份与使用说明

网站导航栏新增两个页面：

- **账号与数据**（`src/components/AccountView.tsx`）：注册/登录识图账号、查看当天剩余次数，导出/导入本机数据。
- **使用说明**（`src/components/GuideView.tsx`）：三步上手、模型接入、三种模式、两种识图方式对比、账号与换设备、错题本、学习计划、已知限制。

### 导出 / 导入

点击「账号与数据 → 导出这台设备的数据」会下载 `问渠备份-YYYYMMDD-HHmm.json`，包含对话记录、错题本、学习计划、科目/模式与 AI 设置。

- 默认 **不含 API Key**，勾选后才写入；可选是否包含题目图片（体积会明显变大）。
- 在另一浏览器登录同一识图账号后，用「从备份导入」选择该文件：先整份校验，任何一个字段不合格就完全不写入。
- 导入方式两种：**替换**（完全覆盖本机数据）或 **合并**（保留现有对话，错题与任务按编号去重后追加）。选择替换时会先提示覆盖风险。
- 识图次数按账号在服务端计算，不随备份文件迁移。

校验逻辑在 `src/lib/backup.ts`，纯函数、不直接读写 localStorage；`npm run test:app` 运行 10 项测试（密钥默认剔除、图片可选、坏字段整体拒绝、非图片内容丢弃、替换与合并语义等）。

## 部署（手机也能完成，不需要电脑）

**方式一：GitHub Actions 自动部署（推荐，点几下即可）**

1. 在 GitHub 仓库 **Settings → Secrets and variables → Actions** 添加两个仓库密钥：
   - `CLOUDFLARE_API_TOKEN`：在 [Cloudflare API 令牌](https://dash.cloudflare.com/profile/api-tokens) 用「Edit Cloudflare Workers」模板创建，再加一条 D1 的 Edit 权限。
   - `CLOUDFLARE_ACCOUNT_ID`：在 Cloudflare 控制台右下角或 URL 里能看到。
2. 推送后 **Actions → Deploy vision worker** 会自动建数据库、建表、生成签名密钥并部署。
3. 运行日志最后一行会给出 `https://zhihu-study-vision.<子域>.workers.dev`，把它填进 `public/vision-config.json` 的 `apiBase` 并提交，网页就能用了。

重复运行是安全的：数据库已存在就复用，签名密钥已存在就不覆盖（否则所有人会被登出）。

**方式二：控制台粘贴单文件（完全不用命令行）**

1. 本地执行 `npm run vision:bundle`，得到 `cloudflare/dist/worker.js`（约 16 KB，无外部依赖）。
2. Cloudflare 控制台 **Storage & Databases → D1** 新建 `zhihu-study`，进入该库的 Console，粘贴 `cloudflare/schema.sql` 的内容并执行。
3. **Workers & Pages → Create → Worker**，把 `worker.js` 全文粘进编辑器并部署。
4. 在该 Worker 的 **Settings → Bindings** 添加：D1 绑定（变量名 `DB`，选 `zhihu-study`）、Workers AI 绑定（变量名 `AI`）；**Settings → Variables** 添加加密变量 `AUTH_SECRET`（随便一段长随机字符串）。
5. 把 Worker 地址写进 `public/vision-config.json`。

**方式三：命令行**

```bash
npx wrangler login
npx wrangler d1 create zhihu-study        # 把返回的 database_id 填进 cloudflare/wrangler.toml
npx wrangler d1 execute zhihu-study --remote --file=cloudflare/schema.sql
npx wrangler secret put AUTH_SECRET --config cloudflare/wrangler.toml
npm run vision:deploy
```

部署完成后把 Worker 地址写进 `public/vision-config.json` 的 `apiBase`（例如 `https://zhihu-study-vision.<子域>.workers.dev`），提交后 GitHub Pages 会自动重建。也可以构建时用 `VITE_VISION_API_URL` 指定同一个地址。

本地运行 `npm run test:vision` 会跑 18 项检查：配额单元测试（跨天重置、失败退回、图片校验、令牌）和接口端到端测试（注册、登录、识图、第 4 张被拒、模型出错退回）。测试使用内存假数据库与假模型，不消耗任何额度。真实识图仍需部署后在具备免费额度的账号下验证。

### 网络可用性提醒

识图服务默认暴露在 `*.workers.dev` 上。实测该域名在国内部分网络会被 DNS 污染（解析到无关地址）而无法连接，同时也会间歇性正常。前端已做三件事：登录类请求 20 秒超时、识图 90 秒超时、「账号与数据」页打开时探活并在失败时提示改用本地 OCR。

如果需要稳定访问，可给 Worker 绑定一个自有域名（`custom_domain` 路由），再把 `public/vision-config.json` 的 `apiBase` 换成该域名即可，无需改前端代码。

### 备用与边界

- 未登录、未配置服务地址或额度用完时，仍可使用浏览器本地 OCR 和手工补充，主模型照样能答题。
- 视觉模型对手写字、复杂公式和图形关系仍可能出错，因此流程强制「核对后再交给主模型」。
- 免费额度受 Cloudflare 政策影响，无法承诺永久免费或无限量；额度耗尽当天暂停云端识图。

## 部署

仓库已包含 `.github/workflows/deploy.yml`。推送到 `main` 后：

1. GitHub 仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。
2. Actions 会自动构建并部署，地址为 `https://<用户名>.github.io/wenqu/`。

构建时通过环境变量 `GITHUB_PAGES=true` 切换资源路径前缀（见 `vite.config.ts`）。

## 技术栈

React 19 + TypeScript + Vite，KaTeX / remark-math 渲染数学公式，lucide-react 图标，localStorage 持久化。
