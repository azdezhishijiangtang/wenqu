export type View = 'tutor' | 'formulas' | 'mistakes' | 'plan'

export type Subject = 'math' | 'physics' | 'chemistry' | 'biology'
export type SubjectFilter = 'all' | Subject
export type TutorMode = 'guide' | 'explain'

export interface ApiSettings {
  baseUrl: string
  model: string
  apiKey: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
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
