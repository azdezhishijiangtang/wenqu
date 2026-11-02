/**
 * 账号数据导出 / 导入。
 *
 * 设计原则：
 * - 导出文件默认不含 API Key（除非用户主动勾选），避免把密钥发给别人。
 * - 导入必须先整体校验，任何字段不合格就整体拒绝，绝不写半份数据。
 * - 文件里记录导出时的账号名，换账号导入时给出提醒但不阻断。
 * - 纯函数，便于测试；不直接读写 localStorage。
 */
import type { ApiSettings, ChatMessage, Mistake, Task } from '../types'

export const BACKUP_APP = 'wenqu'
/** 改名前导出的备份仍然允许导入，避免把旧数据锁死。 */
const LEGACY_BACKUP_APPS = ['zhihu-study']
export const BACKUP_VERSION = 1
/** 单个备份文件的体积上限，避免误选超大文件把浏览器卡死。 */
export const MAX_BACKUP_BYTES = 12 * 1024 * 1024

export interface BackupSnapshot {
  settings: ApiSettings | null
  messages: ChatMessage[]
  subject: string
  mode: string
  mistakes: Mistake[]
  tasks: Task[]
}

export interface BackupFile {
  app: string
  version: number
  exportedAt: string
  account: string | null
  data: BackupSnapshot
  stats: { messages: number; mistakes: number; tasks: number; images: number }
}

export interface BuildOptions {
  account?: string | null
  includeApiKey?: boolean
  includeImages?: boolean
  now?: Date
}

export class BackupError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BackupError'
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function countImages(messages: ChatMessage[]): number {
  return messages.reduce((total, message) => total + (message.images?.length ?? 0), 0)
}

/** 去掉密钥与图片后生成可分享的备份对象。 */
export function buildBackup(snapshot: BackupSnapshot, options: BuildOptions = {}): BackupFile {
  const { account = null, includeApiKey = false, includeImages = true, now = new Date() } = options
  const settings = snapshot.settings
    ? { ...snapshot.settings, ...(includeApiKey ? {} : { apiKey: '' }) }
    : null
  const messages = snapshot.messages.map((message) => {
    if (includeImages) return { ...message }
    const { images: _images, ...rest } = message
    return rest
  })
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    account,
    data: {
      settings,
      messages,
      subject: snapshot.subject,
      mode: snapshot.mode,
      mistakes: snapshot.mistakes.map((item) => ({ ...item })),
      tasks: snapshot.tasks.map((item) => ({ ...item })),
    },
    stats: {
      messages: messages.length,
      mistakes: snapshot.mistakes.length,
      tasks: snapshot.tasks.length,
      images: includeImages ? countImages(snapshot.messages) : 0,
    },
  }
}

export function serializeBackup(file: BackupFile): string {
  return JSON.stringify(file, null, 2)
}

/** 建议的下载文件名，带日期便于区分多次备份。 */
export function backupFileName(now = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`
  return `问渠备份-${stamp}.json`
}

function validateSettings(value: unknown): ApiSettings | null {
  if (value === null || value === undefined) return null
  if (!isObject(value)) throw new BackupError('备份里的「API 设置」格式不正确')
  const text = (key: string, fallback = '') =>
    typeof value[key] === 'string' ? (value[key] as string) : fallback
  const reasoning = value.reasoning
  return {
    baseUrl: text('baseUrl'),
    model: text('model'),
    apiKey: text('apiKey'),
    maxTokens: text('maxTokens'),
    temperature: text('temperature'),
    reasoning: reasoning === 'low' || reasoning === 'medium' || reasoning === 'high' ? reasoning : 'off',
    extraBody: text('extraBody'),
  }
}

function validateMessages(value: unknown): ChatMessage[] {
  if (value === undefined) return []
  if (!Array.isArray(value)) throw new BackupError('备份里的「聊天记录」不是列表')
  if (value.length > 5000) throw new BackupError('聊天记录条数异常，已拒绝导入')
  return value.map((item, index) => {
    if (!isObject(item)) throw new BackupError(`第 ${index + 1} 条聊天记录格式不正确`)
    if (item.role !== 'user' && item.role !== 'assistant') throw new BackupError(`第 ${index + 1} 条聊天记录缺少角色`)
    if (typeof item.content !== 'string') throw new BackupError(`第 ${index + 1} 条聊天记录缺少正文`)
    const images = Array.isArray(item.images)
      ? item.images.filter((src): src is string => typeof src === 'string' && src.startsWith('data:image/'))
      : undefined
    const hint = item.hintLevel === 1 || item.hintLevel === 2 || item.hintLevel === 3 ? item.hintLevel : item.hintLevel === 0 ? 0 : undefined
    return {
      id: typeof item.id === 'string' && item.id ? item.id : `imported-${index}`,
      role: item.role,
      content: item.content,
      ...(typeof item.reasoning === 'string' ? { reasoning: item.reasoning } : {}),
      ...(hint === undefined ? {} : { hintLevel: hint }),
      ...(item.mode === 'guide' || item.mode === 'explain' || item.mode === 'exam' ? { mode: item.mode } : {}),
      ...(typeof item.subject === 'string' && ['math', 'physics', 'chemistry', 'biology'].includes(item.subject)
        ? { subject: item.subject as ChatMessage['subject'] }
        : {}),
      ...(typeof item.question === 'string' ? { question: item.question } : {}),
      ...(images && images.length ? { images } : {}),
    }
  })
}

function validateMistakes(value: unknown): Mistake[] {
  if (value === undefined) return []
  if (!Array.isArray(value)) throw new BackupError('备份里的「错题本」不是列表')
  if (value.length > 2000) throw new BackupError('错题条数异常，已拒绝导入')
  return value.map((item, index) => {
    if (!isObject(item)) throw new BackupError(`第 ${index + 1} 条错题格式不正确`)
    const subject = item.subject
    if (subject !== 'math' && subject !== 'physics' && subject !== 'chemistry' && subject !== 'biology') {
      throw new BackupError(`第 ${index + 1} 条错题缺少科目`)
    }
    const text = (key: string) => (typeof item[key] === 'string' ? (item[key] as string) : '')
    return {
      id: text('id') || `mistake-imported-${index}`,
      subject,
      title: text('title'),
      question: text('question'),
      cause: text('cause'),
      correction: text('correction'),
      mastered: item.mastered === true,
      createdAt: text('createdAt') || new Date().toISOString(),
    }
  })
}

function validateTasks(value: unknown): Task[] {
  if (value === undefined) return []
  if (!Array.isArray(value)) throw new BackupError('备份里的「学习计划」不是列表')
  if (value.length > 2000) throw new BackupError('任务条数异常，已拒绝导入')
  return value.map((item, index) => {
    if (!isObject(item)) throw new BackupError(`第 ${index + 1} 条任务格式不正确`)
    const subject = item.subject
    if (subject !== 'math' && subject !== 'physics' && subject !== 'chemistry' && subject !== 'biology') {
      throw new BackupError(`第 ${index + 1} 条任务缺少科目`)
    }
    return {
      id: typeof item.id === 'string' && item.id ? item.id : `task-imported-${index}`,
      title: typeof item.title === 'string' ? item.title : '',
      subject,
      minutes: typeof item.minutes === 'number' && Number.isFinite(item.minutes) ? item.minutes : 25,
      dueDate: typeof item.dueDate === 'string' ? item.dueDate : '',
      done: item.done === true,
    }
  })
}

/**
 * 解析并校验备份文本。失败时抛出 BackupError，调用方据此提示用户，
 * 不做任何写入。
 */
export function parseBackup(text: string): BackupFile {
  if (typeof text !== 'string' || !text.trim()) throw new BackupError('文件是空的，或者没有读到内容')
  if (new TextEncoder().encode(text).length > MAX_BACKUP_BYTES) throw new BackupError('文件超过 12 MB，可能不是问渠的备份')
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new BackupError('这不是有效的 JSON 文件，可能选错了文件')
  }
  if (!isObject(raw)) throw new BackupError('备份文件结构不正确')
  if (raw.app !== BACKUP_APP && !LEGACY_BACKUP_APPS.includes(String(raw.app))) {
    throw new BackupError('这个文件不是问渠导出的备份')
  }
  if (raw.version !== BACKUP_VERSION) throw new BackupError(`备份版本是 ${String(raw.version)}，当前只支持版本 ${BACKUP_VERSION}`)
  if (!isObject(raw.data)) throw new BackupError('备份里没有数据部分')

  const data = raw.data
  const subject = typeof data.subject === 'string' ? data.subject : 'math'
  const mode = typeof data.mode === 'string' ? data.mode : 'explain'
  const snapshot: BackupSnapshot = {
    settings: validateSettings(data.settings),
    messages: validateMessages(data.messages),
    subject: ['math', 'physics', 'chemistry', 'biology', 'all'].includes(subject) ? subject : 'math',
    mode: ['guide', 'explain', 'exam'].includes(mode) ? mode : 'explain',
    mistakes: validateMistakes(data.mistakes),
    tasks: validateTasks(data.tasks),
  }

  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : '',
    account: typeof raw.account === 'string' ? raw.account : null,
    data: snapshot,
    stats: {
      messages: snapshot.messages.length,
      mistakes: snapshot.mistakes.length,
      tasks: snapshot.tasks.length,
      images: countImages(snapshot.messages),
    },
  }
}

/** 导入前的合并方式：替换全部，或只补进当前为空的部分。 */
export type ImportStrategy = 'replace' | 'merge'

export function mergeSnapshot(current: BackupSnapshot, incoming: BackupSnapshot, strategy: ImportStrategy): BackupSnapshot {
  if (strategy === 'replace') return incoming
  const knownIds = new Set(current.mistakes.map((item) => item.id))
  const knownTaskIds = new Set(current.tasks.map((item) => item.id))
  return {
    settings: current.settings ?? incoming.settings,
    messages: current.messages.length ? current.messages : incoming.messages,
    subject: current.messages.length ? current.subject : incoming.subject,
    mode: current.messages.length ? current.mode : incoming.mode,
    mistakes: [...current.mistakes, ...incoming.mistakes.filter((item) => !knownIds.has(item.id))],
    tasks: [...current.tasks, ...incoming.tasks.filter((item) => !knownTaskIds.has(item.id))],
  }
}
