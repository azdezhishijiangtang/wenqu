import type { ApiSettings, Subject, TutorMode } from '../types'

const SYSTEM_PROMPT = String.raw`你是「知弧」高中理科答疑老师，覆盖数学、物理、化学、生物，面向中国高中生。你的目标是帮助学生真正理解题目，而不是只给答案。

回答规则：
1. 使用简体中文，按学生选择的科目回答。
2. 优先使用 Markdown；数学、物理公式使用 LaTeX：行内用 $...$，独立公式用 $$...$$。化学式与离子方程式使用规范写法，如 \ce{} 不可依赖时改用清晰的文本或 LaTeX 下标。
3. 讲题时给出清晰的步骤，并解释每一步为什么这样做。物理题明确研究对象、过程、正方向和单位；化学题写清条件、配平与守恒关系；生物题区分事实、机制与结论，规范使用教材术语。
4. 若题目信息不足，先列出缺少的条件，再给出可继续思考的方向，不要编造条件。
5. 数学与物理结论要严谨；化学方程式必须配平并注明反应条件；生物表述应符合高中教材范围，避免把假说当成确定结论。
6. 在回答末尾给出一个简短的「自查」问题，帮助学生检验是否真正理解。
7. 不声称自己画了图；若需要图，请用文字描述图形、实验装置或辅助线。`

const COACH_PROMPT = String.raw`你是一位耐心的启发式导师。不要一上来给出完整答案：先指出题目考查的核心概念，再给学生第一步提示；如果学生需要，再继续拆分。可以使用 Markdown 与 LaTeX，最后用一个问题引导学生继续思考。`

interface ChatRequest {
  settings: ApiSettings
  subject: Subject
  mode: TutorMode
  messages: { role: 'user' | 'assistant'; content: string }[]
  signal: AbortSignal
  onChunk: (text: string) => void
}

function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '')
  if (!trimmed) throw new Error('请先在设置中填写 API 地址')
  if (trimmed.endsWith('/chat/completions')) return trimmed
  if (/\/v\d+(?:beta)?$/i.test(trimmed)) return `${trimmed}/chat/completions`
  return `${trimmed}/v1/chat/completions`
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

  if (status === 401 || status === 403) {
    return `API Key 验证失败（${status}）。请检查密钥、接口地址和模型权限。${detail ? `\n\n接口返回：${detail}` : ''}`
  }
  if (status === 404) {
    return `接口地址或模型不存在（404）。请检查 API 地址是否需要包含版本路径，以及模型名是否正确。${detail ? `\n\n接口返回：${detail}` : ''}`
  }
  if (status === 429) {
    return `请求过于频繁或额度不足（429）。请稍后再试或检查账户余额。${detail ? `\n\n接口返回：${detail}` : ''}`
  }
  return `AI 接口请求失败（${status}）。${detail ? `\n\n接口返回：${detail}` : '请检查接口地址、模型与网络。'}`
}

export async function streamChat({
  settings,
  subject,
  mode,
  messages,
  signal,
  onChunk,
}: ChatRequest): Promise<void> {
  if (!settings.apiKey.trim()) {
    throw new Error('尚未配置 API Key。请点击右上角「API 设置」填写你的密钥。')
  }
  if (!settings.model.trim()) {
    throw new Error('尚未配置模型名称。请在「API 设置」中填写例如 gpt-4o-mini 的模型名。')
  }

  const subjectLine = {
    math: '当前答疑科目：高中数学。',
    physics: '当前答疑科目：高中物理。',
    chemistry: '当前答疑科目：高中化学。',
    biology: '当前答疑科目：高中生物。',
  }[subject]

  const response = await fetch(normalizeBaseUrl(settings.baseUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey.trim()}`,
    },
    body: JSON.stringify({
      model: settings.model.trim(),
      stream: true,
      messages: [
        {
          role: 'system',
          content: `${SYSTEM_PROMPT}\n\n${subjectLine}\n\n${mode === 'guide' ? COACH_PROMPT : ''}`,
        },
        ...messages,
      ],
    }),
    signal,
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(friendlyHttpMessage(response.status, body))
  }

  if (!response.body) {
    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[]
    }
    const content = data.choices?.[0]?.message?.content
    if (!content) throw new Error('接口返回了空内容，请检查模型是否支持对话接口。')
    onChunk(content)
    return
  }

  const reader = response.body.getReader()
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
            delta?: { content?: string }
            message?: { content?: string }
          }[]
          error?: { message?: string }
        }
        if (parsed.error?.message) throw new Error(parsed.error.message)
        const chunk =
          parsed.choices?.[0]?.delta?.content ||
          parsed.choices?.[0]?.message?.content ||
          ''
        if (chunk) {
          receivedText = true
          onChunk(chunk)
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
      '接口已连接，但没有返回可显示的文本。请确认模型名与接口兼容 OpenAI 的流式格式。',
    )
  }
}
