import { BookOpen, Check, Copy, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { formulas } from '../data/formulas'
import { subjectLabel, subjects } from '../data/subjects'
import type { Subject, SubjectFilter } from '../types'
import { MathText } from './MarkdownContent'

interface FormulaViewProps {
  initialSubject: Subject
  onAskAboutFormula: (question: string, subject: Subject) => void
}

export function FormulaView({ initialSubject, onAskAboutFormula }: FormulaViewProps) {
  const [subject, setSubject] = useState<SubjectFilter>(initialSubject)
  const [category, setCategory] = useState('全部')
  const [query, setQuery] = useState('')
  const [copiedId, setCopiedId] = useState('')

  const visible = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return formulas.filter((formula) => {
      const inSubject = subject === 'all' || formula.subject === subject
      const inCategory = category === '全部' || formula.category === category
      const matches =
        !normalizedQuery ||
        `${formula.name}${formula.description}${formula.category}`
          .toLowerCase()
          .includes(normalizedQuery)
      return inSubject && inCategory && matches
    })
  }, [subject, category, query])

  const categories = useMemo(() => {
    const matching = formulas.filter(
      (formula) => subject === 'all' || formula.subject === subject,
    )
    return ['全部', ...new Set(matching.map((formula) => formula.category))]
  }, [subject])

  function selectSubject(next: SubjectFilter) {
    setSubject(next)
    setCategory('全部')
  }

  async function copyFormula(formula: (typeof formulas)[number]) {
    try {
      await navigator.clipboard.writeText(`${formula.name}\n${formula.latex}`)
      setCopiedId(formula.id)
      window.setTimeout(() => setCopiedId(''), 1600)
    } catch {
      setCopiedId('')
    }
  }

  return (
    <section className="page-view">
      <header className="view-header">
        <div>
          <p className="eyebrow">知识手册 / Reference</p>
          <h1>先理解，再记住<span className="accent-dot">.</span></h1>
          <p className="view-description">
            四科核心公式与规律，标出适用条件与最易错的地方。
          </p>
        </div>
        <div className="count-stamp">
          <strong>{formulas.length}</strong>
          <span>条知识卡</span>
        </div>
      </header>

      <div className="toolbar formula-toolbar">
        <div className="subject-tabs">
          <button
            type="button"
            className={subject === 'all' ? 'active' : ''}
            onClick={() => selectSubject('all')}
          >
            全部
          </button>
          {subjects.map((item) => (
            <button
              type="button"
              key={item.id}
              className={subject === item.id ? 'active' : ''}
              onClick={() => selectSubject(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <label className="search-field">
          <Search size={16} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索公式或知识点"
            aria-label="搜索公式"
          />
        </label>
      </div>

      <div className="category-rail" aria-label="知识点分类">
        {categories.map((item) => (
          <button
            type="button"
            key={item}
            className={category === item ? 'active' : ''}
            onClick={() => setCategory(item)}
          >
            {item}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="empty-state">
          <BookOpen size={24} />
          <h2>没有找到相关知识卡</h2>
          <p>换一个关键词，或直接去问 AI 老师。</p>
        </div>
      ) : (
        <div className="formula-grid">
          {visible.map((formula) => (
            <article className="formula-card" key={formula.id}>
              <div className="formula-card-top">
                <span className={`subject-label ${formula.subject}`}>
                  {subjectLabel(formula.subject)} · {formula.category}
                </span>
                <button
                  type="button"
                  className="icon-button subtle"
                  onClick={() => copyFormula(formula)}
                  aria-label={`复制${formula.name}`}
                  title="复制名称与公式"
                >
                  {copiedId === formula.id ? <Check size={15} /> : <Copy size={15} />}
                </button>
              </div>
              <h2>{formula.name}</h2>
              <div className="formula-display">
                <MathText>{`$$${formula.latex}$$`}</MathText>
              </div>
              <p className="formula-description">{formula.description}</p>
              <div className="formula-variables">
                {formula.variables.map((variable) => (
                  <span key={variable}>{variable}</span>
                ))}
              </div>
              <div className="tip-row">
                <span className="tip-label">易错</span>
                <p>{formula.tip}</p>
              </div>
              <button
                type="button"
                className="formula-ask"
                onClick={() =>
                  onAskAboutFormula(
                    `请结合一个典型的高中例题，讲解「${formula.name}」的适用条件、解题步骤和常见错误。\n\n参考公式：${formula.latex}`,
                    formula.subject,
                  )
                }
              >
                让 AI 老师举例讲解
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
