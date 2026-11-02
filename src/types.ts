export type View =
  | 'tutor'
  | 'formulas'
  | 'mistakes'
  | 'plan'
  | 'account'
  | 'guide'
  | 'about'
  | 'donate'
  | 'custom'

export type Subject = 'math' | 'physics' | 'chemistry' | 'biology'
export type SubjectFilter = 'all' | Subject

/** guide: 逐级提示；explain: 完整精讲；exam: 应试速解 */
export type TutorMode = 'guide' | 'explain' | 'exam'

/** 提示层级：0 未请求，1 切入点，2 关键步骤，3 完整解答 */
export type HintLevel = 0 | 1 | 2 | 3

export interface ApiSettings {
  baseUrl: string
  model: string
  apiKey: string
  /** 留空表示不发送，交给服务端决定 */
  maxTokens: string
  temperature: string
  /** 推理强度：空 表示不发送 */
  reasoning: 'off' | 'low' | 'medium' | 'high'
  /** 额外请求体，JSON 字符串，深度合并 */
  extraBody: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  /** 推理过程（reasoning_content），只展示不混入正文 */
  reasoning?: string
  /** 这条回答当前解锁到第几级提示 */
  hintLevel?: HintLevel
  mode?: TutorMode
  subject?: Subject
  /** 对应哪条用户提问，用于「继续深入」 */
  question?: string
  /** 用户随题发送的图片（dataURL，已压缩），仅 user 消息 */
  images?: string[]
}

export interface Formula {
  id: string
  subject: Subject
  category: string
  name: string
  latex: string
  description: string
  variables: string[]
  tip: string
}

export interface Mistake {
  id: string
  subject: Subject
  title: string
  question: string
  cause: string
  correction: string
  mastered: boolean
  createdAt: string
}

export interface Task {
  id: string
  title: string
  subject: Subject
  minutes: number
  dueDate: string
  done: boolean
}
