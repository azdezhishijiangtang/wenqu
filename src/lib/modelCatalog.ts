/**
 * 模型目录自动发现（Model Catalog Auto-Discovery）
 * ===================================================================
 * 依据用户填写的「API 地址 + API Key」实时拉取服务商 OpenAI 兼容的
 * GET /models 列表，让可选模型随服务商更新，不再依赖写死的模型名说明。
 *
 * 设计参考：格致 · 大学区（Principia）的 src/lib/modelCatalog.ts
 *
 * 1. 优先实时拉取，8 秒超时，避免弱网或跨域失败时卡住界面。
 * 2. 拉取失败（无 Key / CORS / 网络不通 / 接口不支持）时：
 *    - 有旧缓存 → 返回旧数据并标记 stale；
 *    - 无缓存 → 回退到内置参考目录（标记 builtin），仍可手动输入模型名。
 * 3. 按「接口地址 + 密钥指纹」缓存 24 小时；指纹取自保险库的 SHA-256
 *    短哈希，缓存里不存密钥明文；超过 7 天的条目自动清理。
 * 4. 密钥全程经由 byokVault 的安全通道（secureFetch + authHeaders），
 *    组件层只持有句柄，拿不到明文。
 */

import { vault } from './byokVault'

/** 目录缓存有效期：24 小时 */
export const CATALOG_TTL_MS = 24 * 60 * 60 * 1000
/** 实时拉取超时：8 秒 */
export const FETCH_TIMEOUT_MS = 8000
/** 缓存条目最长保留 7 天 */
const CACHE_KEEP_MS = 7 * 24 * 60 * 60 * 1000
const CACHE_KEY = 'wenqu-model-catalog.v1'

export interface CatalogEntry {
  models: string[]
  /** remote = 服务商实时列表；builtin = 内置参考目录 */
  source: 'remote' | 'builtin'
  fetchedAt: number
  /** remote 数据已超过 TTL（仍可用，建议刷新） */
  stale?: boolean
  /** 实时拉取失败的具体原因（已回退旧缓存或内置目录时仍会带回，供 UI 显示真实错误） */
  failureReason?: string
}

interface CacheEntry {
  models: string[]
  source: 'remote' | 'builtin'
  fetchedAt: number
}

interface CacheShape {
  [key: string]: CacheEntry
}

/** 规范化接口地址：去空白、去尾部斜杠 */
export const normalizeBaseUrl = (baseUrl: string): string =>
  baseUrl.trim().replace(/\/+$/, '')

const readCache = (): CacheShape => {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as CacheShape
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

const writeCache = (cache: CacheShape): void => {
  try {
    const now = Date.now()
    const pruned: CacheShape = {}
    for (const [key, value] of Object.entries(cache)) {
      if (value?.fetchedAt && now - value.fetchedAt < CACHE_KEEP_MS) {
        pruned[key] = value
      }
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(pruned))
  } catch {
    /* 隐私模式下写入失败可忽略 */
  }
}

/**
 * 缓存键：接口地址 + 密钥不可逆短指纹。
 * 同一地址换 Key 后可用模型可能不同，指纹取自保险库，不含明文。
 */
export const catalogKeyOf = async (
  baseUrl: string,
  keyHandle: string,
): Promise<string> => {
  let fp: string | null = null
  try {
    fp = await vault.fingerprint(keyHandle)
  } catch {
    /* Web Crypto 不可用时退化为「仅按地址缓存」，不影响主流程 */
  }
  return `${normalizeBaseUrl(baseUrl).toLowerCase()}::${fp ?? 'locked'}`
}

/**
 * 内置参考目录：仅在实时拉取失败时兜底，名单随站点版本更新，
 * 与格致·大学区的 AI_PRESETS.fallbackModels 保持一致。
 */
const BUILTIN_CATALOGS: { match: RegExp; models: string[] }[] = [
  {
    match: /^https:\/\/api\.deepseek\.com(?:\/v\d+(?:beta)?)?$/i,
    models: [
      'deepseek-flash',
      'deepseek-v4-pro',
      'deepseek-v4-flash',
      'deepseek-v4.1-flash',
    ],
  },
  {
    match: /^https:\/\/api\.moonshot\.cn\/v\d+$/i,
    models: ['kimi-k3', 'kimi-k2.6', 'kimi-k2.5'],
  },
  {
    match: /^https:\/\/dashscope\.aliyuncs\.com\/compatible-mode\/v\d+$/i,
    models: ['qwen3-max', 'qwen-plus', 'qwen-flash', 'qwen-turbo', 'qwen3-coder-plus'],
  },
  {
    match: /^https:\/\/open\.bigmodel\.cn\/api\/paas\/v\d+$/i,
    models: [
      'glm-5.3',
      'glm-5.3-flash',
      'glm-5.2',
      'glm-5.1',
      'glm-4.7',
      'glm-4.6',
      'glm-4.5-flash',
    ],
  },
  {
    match: /^https:\/\/api\.openai\.com\/v\d+$/i,
    models: [
      'gpt-6-astra',
      'gpt-6.1-sol',
      'gpt-6-luna',
      'gpt-5.6-sol',
      'gpt-5.6-terra',
      'gpt-5.6-luna',
      'gpt-5.4-mini',
      'gpt-5-mini',
    ],
  },
  {
    match: /^https:\/\/api\.siliconflow\.cn\/v\d+$/i,
    models: [
      'deepseek-ai/DeepSeek-V4-Pro',
      'deepseek-ai/DeepSeek-V4-Flash',
      'deepseek-ai/DeepSeek-V3.2',
      'Qwen/Qwen3-8B',
      'Qwen/Qwen3-Coder-Plus',
      'THUDM/GLM-5.3',
      'moonshotai/Kimi-K2.6',
    ],
  },
]

/** 按接口地址返回内置参考模型（未匹配到时返回空数组） */
export const builtinModelsFor = (baseUrl: string): string[] => {
  const url = normalizeBaseUrl(baseUrl)
  const hit = BUILTIN_CATALOGS.find((item) => item.match.test(url))
  return hit ? [...hit.models] : []
}

/** 目录年龄的人性化描述 */
export const describeCatalogAge = (fetchedAt: number, now = Date.now()): string => {
  const diff = Math.max(0, now - fetchedAt)
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  return `${Math.floor(hours / 24)} 天前`
}

/**
 * 已退役/更名的旧模型 → 迁移建议。
 * 命中时 UI 提示用户从实时列表里选择当前可用的模型。
 */
export const RETIRED_MODEL_SUGGESTIONS: Record<string, string> = {
  'deepseek-chat': '从上方实时列表选择当前可用模型（deepseek-chat 已退役）',
  'deepseek-reasoner': '从上方实时列表选择当前可用模型（deepseek-reasoner 已退役）',
  'moonshot-v1-8k': 'kimi-k3（moonshot-v1 系列已下线）',
  'moonshot-v1-32k': 'kimi-k3（moonshot-v1 系列已下线）',
  'moonshot-v1-128k': 'kimi-k3（moonshot-v1 系列已下线）',
  'moonshot-v1-auto': 'kimi-k3（moonshot-v1 系列已下线）',
  'kimi-latest': 'kimi-k3（已下线）',
  'gpt-4o': '从上方实时列表选择当前可用模型',
  'gpt-4o-mini': '从上方实时列表选择当前可用模型',
  'glm-4-flash': 'glm-4.5-flash 或 glm-5.3',
}

/** 当前模型是否已退役（返回迁移建议；否则 null） */
export const retiredModelHint = (model: string): string | null =>
  RETIRED_MODEL_SUGGESTIONS[model.trim()] ?? null

/** GET /models 的候选地址：部分服务商的 models 端点不带 /v1 前缀 */
function modelsEndpoints(baseUrl: string): string[] {
  const base = normalizeBaseUrl(baseUrl)
  const urls = [`${base}/models`]
  const withoutVersion = base.replace(/\/v\d+(?:beta)?$/i, '')
  if (withoutVersion !== base) urls.push(`${withoutVersion}/models`)
  return urls
}

/**
 * 用当前密钥拉取该服务商可用模型列表（OpenAI 兼容 GET /models）。
 * keyHandle 必须是保险库句柄（@byok-vault:…），不是明文密钥。
 * 返回去重排序后的模型 id；失败抛出可读的中文错误。
 */
export async function fetchModels(
  baseUrl: string,
  keyHandle: string,
  signal?: AbortSignal,
): Promise<string[]> {
  let lastError: unknown = null

  for (const url of modelsEndpoints(baseUrl)) {
    try {
      const response = await vault.secureFetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: vault.authHeaders(keyHandle).Authorization,
        },
        signal,
      })

      if (!response.ok) {
        const detail = (await response.text().catch(() => '')).slice(0, 160)
        const hint =
          response.status === 401 || response.status === 403
            ? 'API Key 无效或没有模型列表权限'
            : response.status === 404
              ? '该接口不提供 /models 列表'
              : `服务商返回 HTTP ${response.status}`
        lastError = new Error(`${hint}${detail ? `：${detail}` : ''}`)
        if (response.status === 404) continue
        throw lastError
      }

      const data = (await response.json()) as { data?: { id?: string }[] }
      const ids = (data.data ?? [])
        .map((item) => item.id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
      if (ids.length === 0) {
        throw new Error('该接口没有返回任何可用模型，请手动填写模型名。')
      }
      return Array.from(new Set(ids)).sort((a, b) => a.localeCompare(b))
    } catch (error) {
      if (signal?.aborted) throw error
      lastError = error
    }
  }

  if (lastError instanceof Error) throw lastError
  const detail = lastError == null ? '未收到任何有效响应' : String(lastError)
  // 不再把一切异常笼统归因为 CORS：旧内核缺失 Web API、DNS 失败、断网都会走到这里。
  throw new Error(
    `无法获取模型列表：${detail}。请检查接口地址、密钥与网络；仅当控制台确有 CORS 报错时才需更换跨域地址。`,
  )
}

/**
 * 获取模型目录：缓存新鲜 → 实时拉取 → 旧缓存 → 内置参考目录。
 * force=true 时跳过新鲜度检查，强制实时拉取。
 */
export async function getCatalog(
  baseUrl: string,
  keyHandle: string,
  opts: { force?: boolean; now?: number } = {},
): Promise<CatalogEntry> {
  const force = opts.force ?? false
  const now = opts.now ?? Date.now()
  if (!baseUrl.trim() || !keyHandle.trim()) {
    return { models: [], source: 'builtin', fetchedAt: 0 }
  }

  const key = await catalogKeyOf(baseUrl, keyHandle)
  const cache = readCache()
  const hit = cache[key]
  const fresh = hit ? now - hit.fetchedAt < CATALOG_TTL_MS : false

  if (hit && fresh && !force) {
    return { ...hit, stale: false }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const models = await fetchModels(baseUrl, keyHandle, controller.signal)
    const entry: CacheEntry = { models, source: 'remote', fetchedAt: now }
    cache[key] = entry
    writeCache(cache)
    return { ...entry, stale: false }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    if (hit) return { ...hit, stale: true, failureReason: reason }
    // 失败结果不写入 24h 缓存：一次网络抖动不该挡住后续自动重试。
    // 同时把真实原因回传，让界面明确说明是密钥、HTTP 还是网络问题，而不是甩锅 CORS。
    const entry: CatalogEntry = {
      models: builtinModelsFor(baseUrl),
      source: 'builtin',
      fetchedAt: 0,
      stale: false,
      failureReason: reason,
    }
    return entry
  } finally {
    clearTimeout(timer)
  }
}
