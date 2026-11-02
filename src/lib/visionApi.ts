/**
 * 公网识图服务客户端。接口地址在构建时可用 VITE_VISION_API_URL 指定，
 * 也可以在部署后修改 public/vision-config.json，无需重新构建。
 */
export interface VisionQuota {
  day: string
  limit: number
  used: number
  remaining: number
  globalUsed: number
  globalLimit: number
}
export interface VisionAccount {
  token: string
  user: { username: string }
  quota: VisionQuota
}
export class VisionError extends Error {
  status: number
  quota?: VisionQuota
  constructor(message: string, status: number, quota?: VisionQuota) {
    super(message)
    this.name = 'VisionError'
    this.status = status
    this.quota = quota
  }
}

const STORAGE_KEY = 'zhihu-vision-account'
let cachedBase: string | null = null

export function loadAccount(): VisionAccount | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as VisionAccount
    return parsed?.token && parsed?.user?.username ? parsed : null
  } catch {
    return null
  }
}
export function saveAccount(account: VisionAccount | null) {
  if (account) localStorage.setItem(STORAGE_KEY, JSON.stringify(account))
  else localStorage.removeItem(STORAGE_KEY)
}

export async function getApiBase(): Promise<string> {
  if (cachedBase !== null) return cachedBase
  const fromEnv = (import.meta.env.VITE_VISION_API_URL as string | undefined) || ''
  if (fromEnv) {
    cachedBase = fromEnv.replace(/\/+$/, '')
    return cachedBase
  }
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}vision-config.json`, { cache: 'no-store' })
    if (response.ok) {
      const data = (await response.json()) as { apiBase?: string }
      cachedBase = String(data.apiBase || '').replace(/\/+$/, '')
    }
  } catch {
    cachedBase = ''
  }
  cachedBase ??= ''
  return cachedBase
}

async function request<T>(path: string, options: { method?: string; token?: string; body?: unknown } = {}): Promise<T> {
  const base = await getApiBase()
  if (!base) throw new VisionError('云端识图还没有配置地址，暂时只能使用本地 OCR。', 0)
  const headers: Record<string, string> = {}
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'
  if (options.token) headers.Authorization = `Bearer ${options.token}`
  let response: Response
  try {
    response = await fetch(`${base}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })
  } catch {
    throw new VisionError('连不上识图服务，请检查网络后重试。', 0)
  }
  let data: { error?: string; quota?: VisionQuota } & Record<string, unknown> = {}
  try {
    data = await response.json()
  } catch {
    throw new VisionError('识图服务返回了无法解析的内容。', response.status)
  }
  if (!response.ok) throw new VisionError(data.error || '识图服务出错', response.status, data.quota)
  return data as unknown as T
}

export function register(username: string, password: string) {
  return request<VisionAccount>('/api/auth/register', { method: 'POST', body: { username, password } })
}
export function login(username: string, password: string) {
  return request<VisionAccount>('/api/auth/login', { method: 'POST', body: { username, password } })
}
export function me(token: string) {
  return request<{ user: { username: string }; quota: VisionQuota }>('/api/auth/me', { token })
}
export function readImages(token: string, images: string[], question: string) {
  return request<{ evidence: string[]; quota: VisionQuota }>('/api/vision/read', {
    method: 'POST',
    token,
    body: { images, question },
  })
}
