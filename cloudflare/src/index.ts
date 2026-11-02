import {
  VISION_MODEL,
  dayKey,
  evidencePrompt,
  formatEvidence,
  hashPassword,
  limitsFromEnv,
  parseImageList,
  parseQuestion,
  randomSalt,
  readQuota,
  releaseQuota,
  reserveQuota,
  safeEqual,
  signToken,
  validatePassword,
  validateUsername,
  verifyToken,
} from './core.js'

interface Env {
  AI: { run: (model: string, input: unknown) => Promise<{ answer?: string }> }
  DB: D1Database
  AUTH_SECRET: string
  DAILY_USER_LIMIT?: string
  DAILY_GLOBAL_LIMIT?: string
  ALLOWED_ORIGINS?: string
}

const DEFAULT_ORIGINS = ['https://azdezhishijiangtang.github.io', 'http://localhost:5173', 'http://127.0.0.1:5173']

function corsHeaders(request: Request, env: Env): Record<string, string> | null {
  const origin = request.headers.get('Origin')
  if (!origin) return {}
  const extra = (env.ALLOWED_ORIGINS || '').split(',').map((item) => item.trim()).filter(Boolean)
  const allowed = new Set([...DEFAULT_ORIGINS, ...extra])
  const ok = allowed.has(origin) || /^https:\/\/[a-z0-9-]+\.pages\.dev$/.test(origin)
  if (!ok) return null
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'Content-Type, Authorization',
    'access-control-max-age': '86400',
    vary: 'Origin',
  }
}

function reply(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...cors },
  })
}

async function currentUser(request: Request, env: Env) {
  const header = request.headers.get('Authorization') || ''
  const token = header.replace(/^Bearer\s+/i, '').trim()
  if (!token) return null
  return verifyToken(token, env.AUTH_SECRET)
}

async function readJson(request: Request) {
  const type = request.headers.get('content-type') || ''
  if (!type.includes('application/json')) throw new Error('请求必须是 application/json')
  return request.json() as Promise<Record<string, unknown>>
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const cors = corsHeaders(request, env)
    if (!cors) return reply({ error: '不允许的请求来源' }, 403, {})
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })

    const url = new URL(request.url)
    const day = dayKey()
    const limits = limitsFromEnv(env)

    try {
      if (url.pathname === '/api/health' && request.method === 'GET') {
        return reply({ ok: true, userLimit: limits.userLimit, globalLimit: limits.globalLimit }, 200, cors)
      }

      if (url.pathname === '/api/auth/register' && request.method === 'POST') {
        const body = await readJson(request)
        const username = validateUsername(body.username)
        const password = validatePassword(body.password)
        if (!username) return reply({ error: '用户名需 3–24 位，可用中文、字母、数字和下划线' }, 400, cors)
        if (!password) return reply({ error: '密码至少 8 位' }, 400, cors)
        if (!env.AUTH_SECRET) return reply({ error: '服务端缺少 AUTH_SECRET 配置' }, 500, cors)

        const salt = randomSalt()
        const hash = await hashPassword(password, salt, env.AUTH_SECRET)
        const id = crypto.randomUUID()
        try {
          await env.DB.prepare('INSERT INTO users (id, username, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?)')
            .bind(id, username, hash, salt, Date.now())
            .run()
        } catch {
          return reply({ error: '这个用户名已被使用' }, 409, cors)
        }
        const token = await signToken({ sub: id, name: username, exp: Math.floor(Date.now() / 1000) + 2592000 }, env.AUTH_SECRET)
        return reply({ token, user: { username }, quota: await readQuota(env.DB, id, day, limits) }, 200, cors)
      }

      if (url.pathname === '/api/auth/login' && request.method === 'POST') {
        const body = await readJson(request)
        const username = validateUsername(body.username)
        const password = typeof body.password === 'string' ? body.password : ''
        if (!username || !password) return reply({ error: '请输入用户名和密码' }, 400, cors)

        const row = await env.DB.prepare('SELECT id, username, password_hash, salt FROM users WHERE username = ?')
          .bind(username)
          .first<{ id: string; username: string; password_hash: string; salt: string }>()
        const hash = await hashPassword(password, row?.salt ?? 'missing-user', env.AUTH_SECRET)
        if (!row || !safeEqual(hash, row.password_hash)) {
          return reply({ error: '用户名或密码不正确' }, 401, cors)
        }
        const token = await signToken({ sub: row.id, name: row.username, exp: Math.floor(Date.now() / 1000) + 2592000 }, env.AUTH_SECRET)
        return reply({ token, user: { username: row.username }, quota: await readQuota(env.DB, row.id, day, limits) }, 200, cors)
      }

      if (url.pathname === '/api/auth/me' && request.method === 'GET') {
        const user = await currentUser(request, env)
        if (!user) return reply({ error: '登录状态已失效' }, 401, cors)
        return reply({ user: { username: user.name }, quota: await readQuota(env.DB, user.sub, day, limits) }, 200, cors)
      }

      if (url.pathname === '/api/vision/read' && request.method === 'POST') {
        const user = await currentUser(request, env)
        if (!user) return reply({ error: '请先登录后再识别图片' }, 401, cors)

        const body = await readJson(request)
        let images
        let question
        try {
          images = parseImageList(body.images)
          question = parseQuestion(body.question)
        } catch (error) {
          return reply({ error: error instanceof Error ? error.message : '图片参数不正确' }, 400, cors)
        }

        const reserved = await reserveQuota(env.DB, user.sub, day, images.length, limits)
        if (!reserved.ok) {
          const reason = reserved.reason === 'global'
            ? '全站今日免费识图额度已用完，请明天再试'
            : `今日识图次数已用完，每个账号每天可识别 ${limits.userLimit} 张图片`
          return reply({ error: reason, quota: reserved.quota ?? (await readQuota(env.DB, user.sub, day, limits)) }, 429, cors)
        }

        try {
          const results = []
          for (const image of images) {
            results.push(await env.AI.run(VISION_MODEL, {
              image: image.dataUrl,
              prompt: evidencePrompt(question),
              max_tokens: 1024,
              temperature: 0.1,
            }))
          }
          return reply({ evidence: formatEvidence(results), quota: await readQuota(env.DB, user.sub, day, limits) }, 200, cors)
        } catch (error) {
          await releaseQuota(env.DB, user.sub, day, images.length)
          const detail = error instanceof Error ? error.message : ''
          const hint = /50\d\d/.test(detail) ? `视觉模型调用失败：${detail.slice(0, 120)}` : '识图服务暂时不可用'
          return reply({ error: `${hint}，本次没有扣次数`, quota: await readQuota(env.DB, user.sub, day, limits) }, 502, cors)
        }
      }

      return reply({ error: '接口不存在' }, 404, cors)
    } catch (error) {
      const message = error instanceof Error && error.message.includes('application/json') ? error.message : '请求格式不正确'
      return reply({ error: message }, 400, cors)
    }
  },
}
