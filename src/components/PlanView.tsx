import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Plus,
  Target,
  Trash2,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { subjectLabel, subjects } from '../data/subjects'
import type { Subject, Task } from '../types'
import {
  dateFromOffset,
  formatShortDate,
  formatWeekday,
  toDateKey,
} from '../lib/utils'

interface PlanViewProps {
  tasks: Task[]
  onAdd: (task: Omit<Task, 'id' | 'done'>) => void
  onToggle: (id: string) => void
  onDelete: (id: string) => void
}

const weekOffsets = [0, 1, 2, 3, 4, 5, 6]

export function PlanView({ tasks, onAdd, onToggle, onDelete }: PlanViewProps) {
  const today = toDateKey(new Date())
  const [selectedDate, setSelectedDate] = useState(today)
  const [weekStart, setWeekStart] = useState(0)
  const [showComposer, setShowComposer] = useState(false)
  const [draft, setDraft] = useState<{
    title: string
    subject: Subject
    minutes: number
  }>({ title: '', subject: 'math', minutes: 30 })

  const days = useMemo(
    () =>
      weekOffsets.map((_, index) => {
        const offset = weekStart * 7 + index
        return { offset, key: dateFromOffset(offset) }
      }),
    [weekStart],
  )

  const dayTasks = tasks.filter((task) => task.dueDate === selectedDate)
  const openToday = tasks.filter((task) => task.dueDate === today && !task.done)
  const doneCount = tasks.filter((task) => task.done).length
  const plannedMinutes = tasks
    .filter((task) => task.dueDate === selectedDate && !task.done)
    .reduce((sum, task) => sum + task.minutes, 0)

  function submitTask() {
    if (!draft.title.trim()) return
    onAdd({
      title: draft.title.trim(),
      subject: draft.subject,
      minutes: draft.minutes,
      dueDate: selectedDate,
    })
    setDraft({ title: '', subject: draft.subject, minutes: 30 })
    setShowComposer(false)
  }

  return (
    <section className="page-view">
      <header className="view-header">
        <div>
          <p className="eyebrow">学习计划 / Weekly rhythm</p>
          <h1>把大目标拆成今天这一小步<span className="accent-dot">.</span></h1>
          <p className="view-description">
            安排每次 20–40 分钟的专注块，留出复盘时间，比列一长串任务更有效。
          </p>
        </div>
        <button
          type="button"
          className="primary-button"
          onClick={() => setShowComposer((current) => !current)}
        >
          <Plus size={16} /> 安排任务
        </button>
      </header>

      <div className="plan-stats">
        <div className="stat-cell">
          <Target size={17} />
          <div>
            <strong>{openToday.length}</strong>
            <span>今日待完成</span>
          </div>
        </div>
        <div className="stat-cell">
          <Clock3 size={17} />
          <div>
            <strong>{plannedMinutes}</strong>
            <span>已选日期分钟数</span>
          </div>
        </div>
        <div className="stat-cell">
          <Check size={17} />
          <div>
            <strong>{doneCount}</strong>
            <span>累计完成</span>
          </div>
        </div>
      </div>

      <div className="week-card">
        <div className="week-head">
          <button
            type="button"
            className="icon-button subtle"
            onClick={() => setWeekStart((current) => current - 1)}
            aria-label="上一周"
          >
            <ChevronLeft size={18} />
          </button>
          <div>
            <strong>{weekStart === 0 ? '本周' : weekStart < 0 ? `${Math.abs(weekStart)} 周前` : `${weekStart} 周后`}</strong>
            <span>
              {formatShortDate(days[0].key)} — {formatShortDate(days[6].key)}
            </span>
          </div>
          <button
            type="button"
            className="icon-button subtle"
            onClick={() => setWeekStart((current) => current + 1)}
            aria-label="下一周"
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="week-days">
          {days.map((day) => {
            const count = tasks.filter((task) => task.dueDate === day.key).length
            return (
              <button
                type="button"
                key={day.key}
                className={`day-cell${selectedDate === day.key ? ' selected' : ''}${day.key === today ? ' today' : ''}`}
                onClick={() => setSelectedDate(day.key)}
              >
                <span>{formatWeekday(day.key)}</span>
                <strong>{Number(day.key.slice(-2))}</strong>
                <i className={count ? 'has-tasks' : ''}>{count || ''}</i>
              </button>
            )
          })}
        </div>
      </div>

      {showComposer && (
        <div className="task-composer">
          <div className="composer-title">
            <CalendarDays size={16} />
            添加到 {formatShortDate(selectedDate)}
          </div>
          <input
            className="task-title-input"
            value={draft.title}
            onChange={(event) => setDraft({ ...draft, title: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submitTask()
            }}
            placeholder="例如：整理电磁感应错题"
            autoFocus
          />
          <div className="task-composer-row">
            <select
              value={draft.subject}
              onChange={(event) =>
                setDraft({ ...draft, subject: event.target.value as Subject })
              }
            >
              {subjects.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
            <select
              value={draft.minutes}
              onChange={(event) =>
                setDraft({ ...draft, minutes: Number(event.target.value) })
              }
            >
              {[20, 25, 30, 40, 60].map((minutes) => (
                <option value={minutes} key={minutes}>
                  {minutes} 分钟
                </option>
              ))}
            </select>
            <button type="button" className="small-primary" onClick={submitTask}>
              添加
            </button>
          </div>
        </div>
      )}

      <div className="day-board">
        <div className="day-board-head">
          <div>
            <span className="eyebrow">
              {selectedDate === today ? '今天' : selectedDate < today ? '回看' : '计划'}
            </span>
            <h2>{formatShortDate(selectedDate)} 的任务</h2>
          </div>
          <span className="day-count">{dayTasks.length} 项</span>
        </div>

        {dayTasks.length === 0 ? (
          <div className="inline-empty">
            <p>这一天还没有安排。留一点时间给薄弱科目。</p>
            <button type="button" className="inline-link" onClick={() => setShowComposer(true)}>
              添加一项任务
            </button>
          </div>
        ) : (
          <div className="task-list">
            {dayTasks.map((task) => (
              <div className={`task-row${task.done ? ' done' : ''}`} key={task.id}>
                <button
                  type="button"
                  className="task-check"
                  onClick={() => onToggle(task.id)}
                  aria-label={task.done ? `标记${task.title}未完成` : `完成${task.title}`}
                >
                  {task.done && <Check size={13} />}
                </button>
                <div className="task-info">
                  <strong>{task.title}</strong>
                  <span>
                    {subjectLabel(task.subject)} · {task.minutes} 分钟
                  </span>
                </div>
                <button
                  type="button"
                  className="icon-button subtle danger-hover"
                  onClick={() => onDelete(task.id)}
                  aria-label={`删除${task.title}`}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="plan-note">
        <span>今日建议</span>
        <p>
          先做一项 25 分钟的数理专项，再用 10 分钟整理错因。化学和生物的知识点适合用短间隔重复，第二天回看一次。
        </p>
      </div>
    </section>
  )
}
