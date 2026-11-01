import {
  Atom,
  BookMarked,
  CalendarDays,
  Check,
  FlaskConical,
  GraduationCap,
  KeyRound,
  Menu,
  NotebookPen,
  Settings2,
  Sparkles,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import './App.css'
import { FormulaView as Formulas } from './components/FormulaView'
import { MistakeForm } from './components/MistakeForm'
import { MistakesView as Mistakes } from './components/MistakesView'
import { PlanView } from './components/PlanView'
import { SettingsForm } from './components/SettingsForm'
import { TutorView } from './components/TutorView'
import { useLocalStorage } from './hooks/useLocalStorage'
import { streamChat } from './lib/ai'
import { createId } from './lib/utils'
import type {
  ApiSettings,
  ChatMessage,
  Mistake,
  Subject,
  SubjectFilter,
  Task,
  TutorMode,
  View,
} from './types'

const defaultSettings: ApiSettings = {
  baseUrl: 'https://api.deepseek.com/v1',
  model: 'deepseek-chat',
  apiKey: '',
}

const navItems = [
  { id: 'tutor' as const, label: 'AI 答疑', note: '问题与讲解', icon: Sparkles },
  { id: 'formulas' as const, label: '知识手册', note: '四科速查', icon: BookMarked },
  { id: 'mistakes' as const, label: '错题本', note: '错因与复盘', icon: NotebookPen },
  { id: 'plan' as const, label: '学习计划', note: '专注与节奏', icon: CalendarDays },
]

const subjectMeta: Record<Subject, { label: string; icon: typeof Atom }> = {
  math: { label: '数学', icon: GraduationCap },
  physics: { label: '物理', icon: Atom },
  chemistry: { label: '化学', icon: FlaskConical },
  biology: { label: '生物', icon: Sparkles },
}

const subjectHints: { subject: Subject; words: string[] }[] = [
  {
    subject: 'chemistry',
    words: ['化学', '反应', '溶液', '离子', '氧化', '还原', '摩尔', '平衡', '有机', '元素周期', 'ph'],
  },
  {
    subject: 'biology',
    words: ['生物', '细胞', '遗传', '基因', '光合', '呼吸作用', '酶', '生态', '种群', 'dna', '蛋白质'],
  },
  {
    subject: 'physics',
    words: ['物理', '力', '速度', '加速度', '电场', '磁场', '电路', '动量', '能量', '光', '波', '运动'],
  },
]

function detectSubject(text: string): Subject {
  const normalized = text.toLowerCase()
  const best = subjectHints
    .map(({ subject, words }) => ({
      subject,
      score: words.filter((word) => normalized.includes(word)).length,
    }))
    .sort((a, b) => b.score - a.score)[0]
  return best.score > 0 ? best.subject : 'math'
}

function makeMistakeDraft(
  messages: ChatMessage[],
  currentSubject: SubjectFilter,
): Omit<Mistake, 'id' | 'createdAt'> {
  const lastUser = [...messages].reverse().find((message) => message.role === 'user')
  const lastAnswer = [...messages]
    .reverse()
    .find((message) => message.role === 'assistant' && message.content)
  const question = lastUser?.content ?? ''
  return {
    subject:
      currentSubject === 'all' ? detectSubject(question) : currentSubject,
    title: question ? question.replace(/\s+/g, ' ').slice(0, 30) : '',
    question,
    cause: '',
    correction: lastAnswer?.content.slice(0, 1600) ?? '',
    mastered: false,
  }
}

export default function App() {
  const [view, setView] = useState<View>('tutor')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settings, setSettings] = useLocalStorage<ApiSettings>(
    'zhihu-api-settings',
    defaultSettings,
  )
  const [messages, setMessages] = useLocalStorage<ChatMessage[]>(
    'zhihu-chat-messages',
    [],
  )
  const [subject, setSubject] = useLocalStorage<SubjectFilter>(
    'zhihu-subject',
    'math',
  )
  const [mode, setMode] = useState<TutorMode>('explain')
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [formulaSubject, setFormulaSubject] = useState<Subject>('math')
  const [mistakes, setMistakes] = useLocalStorage<Mistake[]>(
    'zhihu-mistakes',
    [],
  )
  const [tasks, setTasks] = useLocalStorage<Task[]>('zhihu-tasks', [])
  const [mistakeDraft, setMistakeDraft] = useState<
    Omit<Mistake, 'id' | 'createdAt'> | null
  >(null)
  const abortRef = useRef<AbortController | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const masteredCount = mistakes.filter((mistake) => mistake.mastered).length
  const openTasks = tasks.filter((task) => !task.done).length

  useEffect(() => {
    const element = messagesEndRef.current
    if (element) {
      element.scrollIntoView({ behavior: loading ? 'auto' : 'smooth', block: 'end' })
    }
  }, [messages, loading, error])

  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  function navigate(next: View) {
    setView(next)
    setMobileNavOpen(false)
  }

  function openFormula(nextSubject: Subject) {
    setFormulaSubject(nextSubject)
    setView('formulas')
  }

  async function sendQuestion(textOverride?: string, subjectOverride?: Subject) {
    const text = (textOverride ?? input).trim()
    if (!text || loading) return
    if (!settings.apiKey.trim()) {
      setInput(text)
      setError('')
      setSettingsOpen(true)
      return
    }

    const activeSubject =
      subjectOverride ?? (subject === 'all' ? detectSubject(text) : subject)
    const userMessage: ChatMessage = {
      id: createId(),
      role: 'user',
      content: text,
    }
    const assistantId = createId()
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
    }
    const previousMessages = messages
    setMessages([...previousMessages, userMessage, assistantMessage])
    setInput('')
    setError('')
    setLoading(true)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      await streamChat({
        settings,
        subject: activeSubject,
        mode,
        messages: [...previousMessages, userMessage].map((message) => ({
          role: message.role,
          content: message.content,
        })),
        signal: controller.signal,
        onChunk: (chunk) => {
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantId
                ? { ...message, content: message.content + chunk }
                : message,
            ),
          )
        },
      })
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === 'AbortError') {
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantId && !message.content
              ? { ...message, content: '已停止生成。' }
              : message,
          ),
        )
      } else {
        const message =
          caught instanceof Error ? caught.message : '发生了未知错误，请重试。'
        setError(message)
        setMessages((current) =>
          current.filter(
            (item) => item.id !== assistantId || item.content.trim() !== '',
          ),
        )
      }
    } finally {
      setLoading(false)
      abortRef.current = null
    }
  }

  function stopGeneration() {
    abortRef.current?.abort()
  }

  function newChat() {
    stopGeneration()
    setMessages([])
    setInput('')
    setError('')
  }

  function openMistakeFromChat() {
    setMistakeDraft(makeMistakeDraft(messages, subject))
  }

  function saveMistake(draft: Omit<Mistake, 'id' | 'createdAt'>) {
    setMistakes((current) => [
      {
        ...draft,
        id: createId(),
        createdAt: new Date().toISOString().slice(0, 10),
      },
      ...current,
    ])
    setMistakeDraft(null)
    setView('mistakes')
  }

  function askAboutMistake(mistake: Mistake) {
    const question = `我在这道题上出过错，请帮我重新梳理。\n\n题目：${mistake.question}\n\n我记录的错误原因：${mistake.cause || '尚未分析'}\n\n我当时的修正：${mistake.correction || '尚未整理'}\n\n请先指出我可能真正卡住的概念，再给出一步步的解法，最后出一道变式题让我检查。`
    navigate('tutor')
    setSubject(mistake.subject)
    sendQuestion(question, mistake.subject)
  }

  function addTask(task: Omit<Task, 'id' | 'done'>) {
    setTasks((current) => [...current, { ...task, id: createId(), done: false }])
  }

  return (
    <div className="app-shell">
      {mobileNavOpen && (
        <button
          type="button"
          className="nav-scrim"
          aria-label="关闭菜单"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      <aside className={`sidebar${mobileNavOpen ? ' open' : ''}`}>
        <div className="brand-row">
          <button
            type="button"
            className="brand"
            onClick={() => navigate('tutor')}
            aria-label="回到答疑首页"
          >
            <span className="brand-mark">知</span>
            <span className="brand-words">
              <strong>知弧</strong>
              <small>高中理科答疑</small>
            </span>
          </button>
          <button
            type="button"
            className="sidebar-close"
            onClick={() => setMobileNavOpen(false)}
            aria-label="关闭菜单"
          >
            <X size={18} />
          </button>
        </div>

        <div className="sidebar-label">学习空间</div>
        <nav className="main-nav" aria-label="主要导航">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <button
                type="button"
                key={item.id}
                className={view === item.id ? 'active' : ''}
                onClick={() => navigate(item.id)}
              >
                <span className="nav-icon">
                  <Icon size={18} strokeWidth={1.8} />
                </span>
                <span className="nav-copy">
                  <strong>{item.label}</strong>
                  <small>{item.note}</small>
                </span>
                {view === item.id && <span className="nav-active-dot" />}
              </button>
            )
          })}
        </nav>

        <div className="sidebar-progress">
          <div className="sidebar-label">学习脉搏</div>
          <div className="mini-stats">
            <div>
              <strong>{mistakes.length}</strong>
              <span>错题记录</span>
            </div>
            <div>
              <strong>{masteredCount}</strong>
              <span>已掌握</span>
            </div>
            <div>
              <strong>{openTasks}</strong>
              <span>待办任务</span>
            </div>
          </div>
          <div className="subject-key">
            {(Object.keys(subjectMeta) as Subject[]).map((item) => {
              const Icon = subjectMeta[item].icon
              return (
                <span key={item} title={subjectMeta[item].label}>
                  <Icon size={14} />
                  {subjectMeta[item].label}
                </span>
              )
            })}
          </div>
        </div>

        <div className="sidebar-bottom">
          <button
            type="button"
            className="api-status-card"
            onClick={() => setSettingsOpen(true)}
          >
            <span className={`api-indicator${settings.apiKey ? ' connected' : ''}`}>
              <KeyRound size={15} />
            </span>
            <span className="api-status-copy">
              <strong>{settings.apiKey ? 'AI 通道已配置' : '连接你的 AI'}</strong>
              <small>
                {settings.apiKey
                  ? settings.model || '未填写模型'
                  : '在本地保存 API Key'}
              </small>
            </span>
            <Settings2 size={15} className="api-gear" />
          </button>
          <p className="local-note">
            密钥仅存储在当前浏览器
          </p>
        </div>
      </aside>

      <main className={`app-main${view === 'tutor' ? ' tutor-mode' : ''}`}>
        <div className="mobile-topbar">
          <button
            type="button"
            className="icon-button"
            onClick={() => setMobileNavOpen(true)}
            aria-label="打开菜单"
          >
            <Menu size={20} />
          </button>
          <button type="button" className="mobile-brand" onClick={() => navigate('tutor')}>
            知弧
          </button>
          <button
            type="button"
            className={`icon-button api-icon${settings.apiKey ? ' connected' : ''}`}
            onClick={() => setSettingsOpen(true)}
            aria-label="API 设置"
          >
            {settings.apiKey ? <Check size={18} /> : <KeyRound size={18} />}
          </button>
        </div>

        {view === 'tutor' && (
          <TutorView
            messages={messages}
            input={input}
            subject={subject}
            mode={mode}
            loading={loading}
            error={error}
            hasApiKey={Boolean(settings.apiKey)}
            onInputChange={setInput}
            onSubjectChange={setSubject}
            onModeChange={setMode}
            onSend={sendQuestion}
            onStop={stopGeneration}
            onOpenSettings={() => setSettingsOpen(true)}
            onNewChat={newChat}
            onOpenFormula={openFormula}
            onAddMistake={openMistakeFromChat}
            messagesEndRef={messagesEndRef}
          />
        )}

        {view !== 'tutor' && (
          <div className="page-scroll">
            {view === 'formulas' && (
              <Formulas
                initialSubject={formulaSubject}
                onAskAboutFormula={(question, nextSubject) => {
                  setView('tutor')
                  setSubject(nextSubject)
                  sendQuestion(question, nextSubject)
                }}
              />
            )}
            {view === 'mistakes' && (
              <Mistakes
                mistakes={mistakes}
                onToggle={(id) =>
                  setMistakes((current) =>
                    current.map((mistake) =>
                      mistake.id === id
                        ? { ...mistake, mastered: !mistake.mastered }
                        : mistake,
                    ),
                  )
                }
                onDelete={(id) =>
                  setMistakes((current) =>
                    current.filter((mistake) => mistake.id !== id),
                  )
                }
                onNew={() =>
                  setMistakeDraft({
                    subject: 'math',
                    title: '',
                    question: '',
                    cause: '',
                    correction: '',
                    mastered: false,
                  })
                }
                onAsk={askAboutMistake}
              />
            )}
            {view === 'plan' && (
              <PlanView
                tasks={tasks}
                onAdd={addTask}
                onToggle={(id) =>
                  setTasks((current) =>
                    current.map((task) =>
                      task.id === id ? { ...task, done: !task.done } : task,
                    ),
                  )
                }
                onDelete={(id) =>
                  setTasks((current) => current.filter((task) => task.id !== id))
                }
              />
            )}
          </div>
        )}
      </main>

      {settingsOpen && (
        <div className="modal-backdrop" role="presentation">
          <div
            className="modal settings-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="modal-header">
              <div>
                <p className="eyebrow">连接 AI / Bring your key</p>
                <h2 id="settings-title">配置 API</h2>
                <p>使用兼容 OpenAI Chat Completions 的服务进行答疑。</p>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setSettingsOpen(false)}
                aria-label="关闭设置"
              >
                <X size={18} />
              </button>
            </header>
            <div className="modal-body">
              <SettingsForm
                settings={settings}
                onSave={setSettings}
                onClose={() => setSettingsOpen(false)}
              />
              <div className="provider-note">
                <strong>提示</strong>
                <p>
                  如果接口支持浏览器跨域访问，前端即可直接请求。若服务商禁止 CORS，
                  需要另外部署一个转发接口，本站不会接触你的密钥。
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {mistakeDraft && (
        <MistakeForm
          initial={mistakeDraft}
          onSave={saveMistake}
          onClose={() => setMistakeDraft(null)}
        />
      )}
    </div>
  )
}
