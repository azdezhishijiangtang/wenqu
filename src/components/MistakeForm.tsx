import { useState } from 'react'
import { subjects } from '../data/subjects'
import type { Mistake, Subject } from '../types'
import { Modal } from './Modal'

interface MistakeFormProps {
  initial: Omit<Mistake, 'id' | 'createdAt'>
  onSave: (draft: Omit<Mistake, 'id' | 'createdAt'>) => void
  onClose: () => void
}

export function MistakeForm({ initial, onSave, onClose }: MistakeFormProps) {
  const [draft, setDraft] = useState(initial)

  const valid = draft.title.trim() && draft.question.trim()

  return (
    <Modal
      open
      title="记一道错题"
      description="把错因写具体，复习时才知道该看哪里。"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="text-button" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="primary-button"
            disabled={!valid}
            onClick={() => onSave(draft)}
          >
            保存错题
          </button>
        </>
      }
    >
      <div className="mistake-form">
        <label className="field">
          <span>科目</span>
          <div className="subject-picker">
            {subjects.map((item) => (
              <button
                type="button"
                key={item.id}
                className={`subject-pick ${item.id}${draft.subject === item.id ? ' active' : ''}`}
                onClick={() =>
                  setDraft({ ...draft, subject: item.id as Subject })
                }
              >
                <span>{item.glyph}</span>
                {item.label}
              </button>
            ))}
          </div>
        </label>

        <label className="field">
          <span>错题标题</span>
          <input
            type="text"
            value={draft.title}
            onChange={(event) => setDraft({ ...draft, title: event.target.value })}
            placeholder="例如：圆锥曲线联立后漏判判别式"
            autoFocus
          />
        </label>

        <label className="field">
          <span>题目或关键条件</span>
          <textarea
            value={draft.question}
            onChange={(event) =>
              setDraft({ ...draft, question: event.target.value })
            }
            placeholder="写下题目、你的答案，或卡住的那一步…"
            rows={4}
          />
        </label>

        <label className="field">
          <span>这次错在哪里</span>
          <textarea
            value={draft.cause}
            onChange={(event) => setDraft({ ...draft, cause: event.target.value })}
            placeholder="例如：忘记讨论二次项系数为 0 的情况"
            rows={3}
          />
        </label>

        <label className="field">
          <span>正确的思路（可选）</span>
          <textarea
            value={draft.correction}
            onChange={(event) =>
              setDraft({ ...draft, correction: event.target.value })
            }
            placeholder="用自己的话写下修正后的关键步骤…"
            rows={4}
          />
        </label>

        <label className="mastered-check">
          <input
            type="checkbox"
            checked={draft.mastered}
            onChange={(event) =>
              setDraft({ ...draft, mastered: event.target.checked })
            }
          />
          <span>已经弄懂了，标记为已掌握</span>
        </label>
      </div>
    </Modal>
  )
}
