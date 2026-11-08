import { canReadStream, parsePayloads, readResponseText } from './compat'
import type { ApiSettings, Subject, TutorMode } from '../types'
import { vault } from './byokVault'

/* ------------------------------------------------------------------ */
/* 提示词系统：通用原则 + 四科专属 + 三种模式                            */
/* ------------------------------------------------------------------ */

const BASE_PROMPT = String.raw`你是「问渠」的高中理科答疑导师，服务对象是想提分的中国高中生。学生已经自学过课本，绝对不要复述教材定义和基础概念；你的价值是带着学生把题做对、把方法想透。

输出规范：
1. 全程简体中文，用 Markdown 组织；公式一律用 LaTeX，行内 $...$，独立公式 $$...$$。化学式直接用 Unicode 下标或 \quad 对齐，不要依赖 \ce。
2. 有一条明确的解题主线：先定位考点和隐含条件，再给方案，最后落笔。不要用"首先我们来看看……"这类废话开场。
3. 结论和关键步骤必须严谨：数学含参必分类讨论；物理先写研究对象、过程模型、正方向，结果带单位和有效数字；化学方程式配平并注明条件；生物用教材术语，区分"事实"与"推测"。
4. 用到高中大纲以外的工具（如洛必达、向量叉乘、构造函数以外的技巧）时，标注「超纲工具」，并给一个高中范围内的等价写法。
5. 结尾给「变式一问」：改变题目一个条件，让学生自查是否真的懂了。
6. 学生题目信息不全时，先列出缺失条件，不要编数据。
7. 学生发来图片（题目配图、工艺流程图、函数图象、受力分析图、实验装置图等）时：先用一小段明确读出图中关键信息——坐标轴与单位、曲线走势与特殊点、流程步骤与进出料、装置连接与试剂——与题干文字对照确认后再解题；图片模糊或信息不全时，说明你读到什么、哪部分存疑，请学生补充文字描述，禁止脑补图中没有的数据。`

const SUBJECT_PROMPTS: Record<Subject, string> = {
  math: String.raw`数学科目要求：
- 含参数问题必须明确分类标准，先说清"按什么分类、为什么这样分"，再逐类讨论，最后合并结论。
- 优先给出通法，再给一题多解（如：代数法 vs 几何法 vs 构造法），并点明每种方法在考场上何时选用。
- 压轴题要讲清"第一问如何为第二问铺路"，让学生看到设问之间的递进关系。
- 计算量大时，指出可以提前化简或对称处理的节点，减少考场算错。`,
  physics: String.raw`物理科目要求：
- 先做模型识别：这是什么模型（传送带、板块、天体、单摆、带电粒子在场中……），模型对应哪些现成结论。
- 受力分析按"重力→已知外力→弹力→摩擦力"顺序，逐个说明有无和方向依据；多过程问题画出过程链条，写清每个过程的连接量（速度、位移或时间）。
- 列式前做量纲检查；矢量问题先规定正方向。
- 动力学观点、能量观点、动量观点三选一时，说明选择理由和各自的适用边界。`,
  chemistry: String.raw`化学科目要求：
- 先识别问题属于哪条主线：速率与平衡、水溶液中的离子、氧化还原与电化学、有机推断、实验综合。
- 平衡问题写清三段式（起始、转化、平衡），单位统一为 mol/L；Ksp、Ka、Kw 的比较要说明温度前提。
- 方程式必须配平、注明条件和状态；离子方程式注意拆分规则和电荷守恒。
- 实验题按"目的→原理→操作→现象→结论"链条作答，现象描述要具体到颜色、气体、沉淀，不写"有明显现象"。`,
  biology: String.raw`生物科目要求：
- 先划概念边界：题目考的是哪个概念，与易混概念（如净光合/总光合、生长素/赤霉素、细胞凋亡/坏死）的区别是什么。
- 机制解释用因果链：A 导致 B，B 导致 C，每一步都要有依据，不允许跳步。
- 遗传题写清配子、基因型、表现型的推导过程，比例要说明成立前提（独立遗传、样本足够多）。
- 实验设计明确自变量、因变量、无关变量的处理，结论只说到证据支持的程度。`,
}

const MODE_PROMPTS: Record<TutorMode, string> = {
  explain: String.raw`当前模式【完整精讲】：给出结构化的完整讲解，按以下顺序组织——
**考点定位**（一行）→ **隐含条件与陷阱**（列出题目没明说但必须用到的条件）→ **解题路线**（一句话说清主攻方向，为什么走这条路）→ **详细过程**（分步编号，每步给出依据）→ **易错点提醒** → **变式一问**。`,
  guide: String.raw`当前模式【启发式引导】：你的任务是让学生自己想出来，禁止一次性给出完整解答。
把你的讲解拆成三级：
- 第 1 级【切入点】：只点破考点和思考方向，不超过 3 句话。
- 第 2 级【关键步骤】：给出第一步怎么落笔、中间的关键转化，但不给最终答案。
- 第 3 级【完整解答】：完整过程与答案，并对比学生的卡点。
本轮只输出第 1 级，用「**第 1 级 · 切入点**」开头，结尾写一句「回复"继续"解锁下一级提示」。学生说"继续"时输出第 2 级，再说"继续"输出第 3 级，用对应的「**第 2 级 · 关键步骤**」「**第 3 级 · 完整解答**」开头。`,
  exam: String.raw`当前模式【应试速解】：学生要的是考场上的最快解法，要求——
- 直接给最快路线，砍掉铺垫；能用二级结论、特殊值法、图像法、选项排除的地方直接用，并给这个结论的名字（如" Wagner 法则""零点存在定理的推论"等，若属二级结论需注明考场上可直接引用）。
- 输出格式：**秒杀思路**（一两句话）→ **落笔过程**（可以抄进答题卡的精简步骤）→ **这个结论什么时候能用 / 什么时候会失效**。
- 如果此题没有速解法，直说"本题没有安全的速解路线"，再给最稳的标准解法框架。`,
}

const FOLLOWUP_PROMPT = String.raw`【追问加深】学生正在同一道题上继续追问。请保持题目和之前讨论不变：
- 问"换一种方法 / 一题多解"：给出与之前不同的解法，并对比两种方法的适用场景。
- 问"为什么这一步成立"：只针对那一步，从依据讲起，可以给一个具体的数值例子验证。
- 问"更难的变式"：升级题目条件（改参数、加约束、倒过来问），先给新题，再附一句解题方向提示（不给全解）。
- 其他追问：沿学生指定的方向继续深入，保持已有的记号和结论一致。`

/* ------------------------------------------------------------------ */
/* 请求层：默认不传任何限制性参数，把能力交给用户配置                     */
/* ------------------------------------------------------------------ */

interface ChatRequest {
  settings: ApiSettings
  subject: Subject
  mode: TutorMode
  /** 历史与最新消息，可含图片 */
  messages: { role: 'user' | 'assistant'; content: string; images?: string[] }[]
  /** 最后一条用户消息是否为「继续/追问」类指令 */
  isFollowup?: boolean
  signal: AbortSignal
  onContent: (text: string) => void
  onReasoning?: (text: string) => void
}

export function defaultSettings(): ApiSettings {
  return {
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-flash',
    apiKey: '',
    maxTokens: '',
    temperature: '',
    reasoning: 'off',
    extraBody: '',
  }
}

function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '')
  if (!trimmed) throw new Error('请先在设置中填写 API 地址')
  if (trimmed.endsWith('/chat/completions')) return trimmed
  if (/\/v\d+(?:beta)?$/i.test(trimmed)) return `${trimmed}/chat/completions`
  return `${trimmed}/v1/chat/completions`
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  )
}

function deepMerge(
  target: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...target }
  for (const [key, value] of Object.entries(patch)) {
    if (isPlainObject(value) && isPlainObject(out[key])) {
      out[key] = deepMerge(
        out[key] as Record<string, unknown>,
        value,
      )
    } else {
      out[key] = value
    }
  }
  return out
}

export function buildRequestBody(
  settings: ApiSettings,
  messages: { role: string; content: unknown }[],
  stream = true,
): Record<string, unknown> {
  if (!settings.model.trim()) {
    throw new Error('尚未配置模型名称。请在「API 设置」中填写模型名。')
  }

  let body: Record<string, unknown> = {
    model: settings.model.trim(),
    stream,
    messages,
  }

  const maxTokens = Number.parseInt(settings.maxTokens, 10)
  if (Number.isFinite(maxTokens) && maxTokens > 0) {
    body.max_tokens = maxTokens
  }

  const temperature = Number.parseFloat(settings.temperature)
  if (Number.isFinite(temperature)) {
    body.temperature = temperature
  }

  if (settings.reasoning !== 'off') {
    body.reasoning_effort = settings.reasoning
  }

  const extra = settings.extraBody.trim()
  if (extra) {
    let parsed: unknown
    try {
      parsed = JSON.parse(extra)
    } catch {
      throw new Error('「高级 · 额外请求体」不是合法 JSON，请检查后重试。')
    }
    if (!isPlainObject(parsed)) {
      throw new Error('「高级 · 额外请求体」必须是 JSON 对象，例如 {"top_p":0.9}')
    }
    body = deepMerge(body, parsed)
  }

  return body
}

export function buildSystemPrompt(
  subject: Subject,
  mode: TutorMode,
  isFollowup = false,
): string {
  return [
    BASE_PROMPT,
    SUBJECT_PROMPTS[subject],
    MODE_PROMPTS[mode],
    isFollowup ? FOLLOWUP_PROMPT : '',
  ]
    .filter(Boolean)
    .join('\n\n')
}

function friendlyHttpMessage(status: number, body: string): string {
  let detail = ''
  try {
    const parsed = JSON.parse(body) as {
      error?: { message?: string } | string
      message?: string
    }
    detail =
      typeof parsed.error === 'string'
        ? parsed.error
        : parsed.error?.message || parsed.message || ''
  } catch {
    detail = body.slice(0, 240)
  }

  if (status === 400 && /max_tokens|max tokens/i.test(detail)) {
    return `接口拒绝了 max_tokens 参数（400）。可以在「API 设置 → 高级」里清空最大输出后重试。${detail ? `\n\n接口返回：${detail}` : ''}`
  }
  if (status === 400 && /temperature/i.test(detail)) {
    return `接口拒绝了 temperature 参数（400）。可以在「API 设置 → 高级」里清空温度后重试。${detail ? `\n\n接口返回：${detail}` : ''}`
  }
  if (status === 401 || status === 403) {
    return `API Key 验证失败（${status}）。请检查密钥、接口地址和模型权限。${detail ? `\n\n接口返回：${detail}` : ''}`
  }
  if (status === 404) {
    return `接口地址或模型不存在（404）。请检查 API 地址是否需要带版本路径、模型名是否正确。${detail ? `\n\n接口返回：${detail}` : ''}`
  }
  if (status === 429) {
    return `请求过于频繁或额度不足（429）。请稍后再试或检查账户余额。${detail ? `\n\n接口返回：${detail}` : ''}`
  }
  return `AI 接口请求失败（${status}）。${detail ? `\n\n接口返回：${detail}` : '请检查接口地址、模型与网络。'}`
}

async function readErrorBody(response: Response): Promise<string> {
  try {
    return await response.text()
  } catch {
    return ''
  }
}

/* ------------------------------------------------------------------ */
/* 消息转换：纯文本 → string；带图 → 多模态 content 数组                  */
/* ------------------------------------------------------------------ */

type OutMessage = {
  role: string
  content:
    | string
    | (
        | { type: 'text'; text: string }
        | { type: 'image_url'; image_url: { url: string; detail: 'high' } }
      )[]
}

function toOutMessage(message: {
  role: 'user' | 'assistant'
  content: string
  images?: string[]
}): OutMessage {
  const images = message.role === 'user' ? (message.images ?? []).slice(0, 3) : []
  if (images.length === 0) {
    return { role: message.role, content: message.content }
  }
  const parts: Extract<OutMessage['content'], unknown[]> = [
    { type: 'text', text: message.content || '请读图并解答这道题。' },
  ]
  for (const url of images) {
    parts.push({ type: 'image_url', image_url: { url, detail: 'high' } })
  }
  return { role: message.role, content: parts }
}

export async function streamChat({
  settings,
  subject,
  mode,
  messages,
  isFollowup = false,
  signal,
  onContent,
  onReasoning,
}: ChatRequest): Promise<void> {
  if (!vault.isHandle(settings.apiKey) || !vault.has(settings.apiKey)) {
    throw new Error('尚未配置或密钥已锁定。请在「API 设置」里输入 API Key，或输入解锁口令。')
  }

  let response: Response
  try {
    response = await vault.secureFetch(normalizeBaseUrl(settings.baseUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: vault.authHeaders(settings.apiKey).Authorization,
      },
      body: JSON.stringify(
        buildRequestBody(settings, [
          {
            role: 'system',
            content: buildSystemPrompt(subject, mode, isFollowup),
          },
          ...messages.map(toOutMessage),
        ]),
      ),
      signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(
      `无法连接到接口地址：${detail}。仅当控制台确有 CORS 报错时才需更换跨域地址；也可在「API 设置 → 测试连接」里看详细原因。`,
    )
  }

  if (!response.ok) {
    throw new Error(
      friendlyHttpMessage(response.status, await readErrorBody(response)),
    )
  }

  if (!canReadStream(response)) {
    // 流式不可用（iOS Safari 旧版 / 部分定制 WebView / XHR 兜底）：
    // 一次性读回完整响应，兼容 SSE 文本与服务商直接返回的完整 JSON。
    let gotText = false
    let serverError = ''
    for (const data of parsePayloads(await readResponseText(response))) {
      try {
        const parsed = JSON.parse(data) as {
          choices?: {
            delta?: { content?: string; reasoning_content?: string }
            message?: { content?: string; reasoning_content?: string }
          }[]
          error?: { message?: string }
        }
        if (parsed.error?.message) { serverError = parsed.error.message; continue }
        const choice = parsed.choices?.[0]
        const reasoning = choice?.delta?.reasoning_content ?? choice?.message?.reasoning_content
        if (reasoning) onReasoning?.(reasoning)
        const chunk = choice?.delta?.content ?? choice?.message?.content ?? ''
        if (chunk) { gotText = true; onContent(chunk) }
      } catch { /* 忽略不完整行 */ }
    }
    if (serverError) throw new Error(serverError)
    if (!gotText) {
      throw new Error(
        '接口已连通但没有返回文本。请确认模型名正确、该模型支持对话接口；也可检查「高级 · 额外请求体」是否覆盖了必要字段。',
      )
    }
    return
  }

  const reader = (response.body as ReadableStream<Uint8Array>).getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let receivedText = false

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const rawLine of lines) {
      const line = rawLine.trim()
      if (!line.startsWith('data:')) continue
      const data = line.slice(5).trim()
      if (!data || data === '[DONE]') continue

      try {
        const parsed = JSON.parse(data) as {
          choices?: {
            delta?: { content?: string; reasoning_content?: string }
            message?: { content?: string; reasoning_content?: string }
          }[]
          error?: { message?: string }
        }
        if (parsed.error?.message) throw new Error(parsed.error.message)
        const choice = parsed.choices?.[0]
        const reasoning = choice?.delta?.reasoning_content ?? choice?.message?.reasoning_content
        if (reasoning) onReasoning?.(reasoning)
        const chunk = choice?.delta?.content ?? choice?.message?.content ?? ''
        if (chunk) {
          receivedText = true
          onContent(chunk)
        }
      } catch (error) {
        if (error instanceof Error && error.message !== 'Unexpected end of JSON input') {
          if (data.length < 500) throw error
        }
      }
    }
  }

  if (!receivedText) {
    throw new Error(
      '接口已连通但没有返回文本。请确认模型名正确、该模型支持对话接口；也可检查「高级 · 额外请求体」是否覆盖了必要字段。',
    )
  }
}

/* ------------------------------------------------------------------ */
/* 连接测试：发一条最小对话，把失败原因翻译成可操作的提示                  */
/* ------------------------------------------------------------------ */

export interface TestResult {
  ok: boolean
  message: string
  latencyMs?: number
  reply?: string
}

export async function testConnection(settings: ApiSettings): Promise<TestResult> {
  if (!vault.isHandle(settings.apiKey) || !vault.has(settings.apiKey)) {
    return { ok: false, message: '请先填写 API Key，或输入解锁口令。' }
  }

  const started = performance.now()
  // AbortSignal.timeout() 在 Chrome / Android WebView < 103 完全不存在，103–123 也仅部分支持
  // （超时抛 AbortError 而非 TimeoutError）。旧内核会直接抛
  // "TypeError: AbortSignal.timeout is not a function"，请求根本发不出去。
  // 改用全内核可用的 AbortController + setTimeout，并用 timedOut 精确区分超时与请求失败。
  const controller = new AbortController()
  let timedOut = false
  const timer = window.setTimeout(() => {
    timedOut = true
    controller.abort()
  }, 45000)
  try {
    const response = await vault.secureFetch(normalizeBaseUrl(settings.baseUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: vault.authHeaders(settings.apiKey).Authorization,
      },
      body: JSON.stringify(
        buildRequestBody(
          settings,
          [{ role: 'user', content: '回复"连接正常"四个字，不要输出其他内容。' }],
          false,
        ),
      ),
      signal: controller.signal,
    })

    if (!response.ok) {
      return {
        ok: false,
        message: friendlyHttpMessage(response.status, await readErrorBody(response)),
      }
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[]
      usage?: { total_tokens?: number }
    }
    const reply = data.choices?.[0]?.message?.content?.trim() || ''
    const latency = Math.round(performance.now() - started)
    return {
      ok: true,
      latencyMs: latency,
      reply: reply.slice(0, 60),
      message: `连接成功，模型 ${settings.model.trim()} 返回正常，耗时 ${latency}ms。`,
    }
  } catch (error) {
    if (timedOut) {
      return { ok: false, message: '连接超时（45 秒）。请检查接口地址与网络。' }
    }
    const detail = error instanceof Error ? error.message : String(error)
    return {
      ok: false,
      message: `请求未能发出：${detail}。仅当浏览器控制台确有 CORS 报错时，才需要换用允许跨域的接口地址或自建转发。`,
    }
  } finally {
    window.clearTimeout(timer)
  }
}
