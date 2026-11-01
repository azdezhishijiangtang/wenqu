import { BookmarkCheck, Check, RotateCcw, Search, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { Mistake, SubjectFilter } from '../types'
import { subjectLabel, subjects } from '../data/subjects'
import { formatShortDate } from '../lib/utils'

interface MistakesViewProps {
  mistakes: Mistake[]
  onToggle: (id: string) => void
  onDelete: (id: string) => void
  onNew: () => void
  onAsk: (mistake: Mistake) => void
}

export function MistakesView({
  mistakes,
  onToggle,
  onDelete,
  onNew,
  onAsk,
}: MistakesViewProps) {
  const [subject, setSubject] = useState<SubjectFilter>('all')
  const [showMastered, setShowMastered] = useState(true)
  const [query, setQuery] = useState('')

  const filtered = useMemo(
    () =>
      mistakes.filter((mistake) => {
        const inSubject = subject === 'all' || mistake.subject === subject
        const inStatus = showMastered || !mistake.mastered
        const matches =
          !query.trim() ||
          `${mistake.title}${mistake.question}${mistake.cause}`
            .toLowerCase()
            .includes(query.trim().toLowerCase())
        return inSubject && inStatus && matches
      }),
    [mistakes, subject, showMastered, query],
  )

  const masteredCount = mistakes.filter((mistake) => mistake.mastered).length
  const progress = mistakes.length ? Math.round((masteredCount / mistakes.length) * 100) : 0

  return (
    <section className="page-view">
      <header className="view-header">
        <div>
          <p className="eyebrow">错题本 / Error log</p>
          <h1>错过的地方，才算真正的地图<span className="accent-dot">.</span></h1>
          <p className="view-description">
            不只抄答案。写下错因与修正思路，隔天回来再看一次。
          </p>
        </div>
        <button type="button" className="primary-button" onClick={onNew}>
          记一道错题
        </button>
      </header>

      <div className="insight-strip">
        <div className="insight-metric">
          <span>累计记录</span>
          <strong>{mistakes.length}</strong>
          <small>道错题</small>
        </div>
        <div className="insight-metric">
          <span>已经掌握</span>
          <strong>{masteredCount}</strong>
          <small>道</small>
        </div>
        <div className="mastery-block">
          <div className="mastery-label">
            <span>掌握进度</span>
            <strong>{progress}%</strong>
          </div>
          <div className="progress-track">
            <span style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      <div className="toolbar">
        <div className="subject-tabs">
          <button
            type="button"
            className={subject === 'all' ? 'active' : ''}
            onClick={() => setSubject('all')}
          >
            全部
          </button>
          {subjects.map((item) => (
            <button
              type="button"
              key={item.id}
              className={subject === item.id ? 'active' : ''}
              onClick={() => setSubject(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="toolbar-right">
          <label className="search-field compact">
            <Search size={15} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索错题"
              aria-label="搜索错题"
            />
          </label>
          <button
            type="button"
            className={`filter-toggle${showMastered ? ' active' : ''}`}
            onClick={() => setShowMastered((current) => !current)}
          >
            <BookmarkCheck size={15} />
            {showMastered ? '显示已掌握' : '只看待复习'}
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state mistake-empty">
          <div className="empty-illustration">
            <span>∎</span>
            <span>△</span>
            <span>∑</span>
          </div>
          <h2>{mistakes.length === 0 ? '错题本还是空的' : '没有符合条件的错题'}</h2>
          <p>把第一次做错的原因写下来，比再刷十道同类题更有用。</p>
          <button type="button" className="secondary-button" onClick={onNew}>
            添加第一道错题
          </button>
        </div>
      ) : (
        <div className="mistake-list">
          {filtered.map((mistake) => (
            <article
              className={`mistake-card${mistake.mastered ? ' mastered' : ''}`}
              key={mistake.id}
            >
              <div className="mistake-rail">
                <span className={`status-dot ${mistake.subject}`} />
              </div>
              <div className="mistake-content">
                <div className="mistake-head">
                  <div>
                    <span className={`subject-label ${mistake.subject}`}>
                      {subjectLabel(mistake.subject)}
                    </span>
                    <span className="mistake-date">
                      {formatShortDate(mistake.createdAt)}
                    </span>
                  </div>
                  <div className="mistake-actions">
                    <button
                      type="button"
                      className={`master-button${mistake.mastered ? ' done' : ''}`}
                      onClick={() => onToggle(mistake.id)}
                    >
                      {mistake.mastered ? <RotateCcw size={14} /> : <Check size={14} />}
                      {mistake.mastered ? '再复习' : '已掌握'}
                    </button>
                    <button
                      type="button"
                      className="icon-button subtle danger-hover"
                      onClick={() => onDelete(mistake.id)}
                      aria-label={`删除${mistake.title}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
                <h2>{mistake.title}</h2>
                <p className="mistake-question">{mistake.question}</p>
                <div className="mistake-insights">
                  <div>
                    <span>错因</span>
                    <p>{mistake.cause}</p>
                  </div>
                  <div>
                    <span>修正</span>
                    <p>{mistake.correction || '尚未补充修正思路'}</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="inline-link"
                  onClick={() => onAsk(mistake)}
                >
                  带着错因再问一次
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
