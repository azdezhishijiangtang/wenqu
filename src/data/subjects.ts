import type { Subject } from '../types'

export const subjects: {
  id: Subject
  label: string
  short: string
  glyph: string
  focus: string
}[] = [
  { id: 'math', label: '数学', short: '数', glyph: '∑', focus: '推理与构造' },
  { id: 'physics', label: '物理', short: '物', glyph: 'v', focus: '建模与过程' },
  { id: 'chemistry', label: '化学', short: '化', glyph: '⚗', focus: '守恒与条件' },
  { id: 'biology', label: '生物', short: '生', glyph: '○', focus: '机制与边界' },
]

export function subjectLabel(subject: Subject): string {
  return subjects.find((item) => item.id === subject)?.label ?? subject
}

export function isSubject(value: string): value is Subject {
  return subjects.some((item) => item.id === value)
}
