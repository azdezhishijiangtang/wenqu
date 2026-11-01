import type { Subject } from '../types'

export const subjects: {
  id: Subject
  label: string
  short: string
  glyph: string
}[] = [
  { id: 'math', label: '数学', short: '数', glyph: '∑' },
  { id: 'physics', label: '物理', short: '物', glyph: 'v' },
  { id: 'chemistry', label: '化学', short: '化', glyph: '⚗' },
  { id: 'biology', label: '生物', short: '生', glyph: '○' },
]

export function subjectLabel(subject: Subject): string {
  return subjects.find((item) => item.id === subject)?.label ?? subject
}

export function isSubject(value: string): value is Subject {
  return subjects.some((item) => item.id === value)
}
