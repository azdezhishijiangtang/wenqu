import {
  Atom,
  BookMarked,
  BookOpen,
  CalendarDays,
  Check,
  FlaskConical,
  GraduationCap,
  HandCoins,
  HeartHandshake,
  KeyRound,
  Menu,
  MessagesSquare,
  NotebookPen,
  Settings2,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import './App.css'
import { AboutView } from './components/AboutView'
import { DataView } from './components/DataView'
import { CustomView } from './components/CustomView'
import { DonateView } from './components/DonateView'
import { FormulaView as Formulas } from './components/FormulaView'
import { GuideView } from './components/GuideView'
import { MistakeForm } from './components/MistakeForm'
import { MistakesView as Mistakes } from './components/MistakesView'
import { PlanView } from './components/PlanView'
import { SettingsForm } from './components/SettingsForm'
import { TutorView } from './components/TutorView'
import { VisionBridge } from './components/VisionBridge'
import { useLocalStorage } from './hooks/useLocalStorage'
import { vault } from './lib/byokVault'
import { defaultSettings, streamChat } from './lib/ai'
import { compressImageFile, MAX_IMAGES } from './lib/image'
import { ThinkSplitter } from './lib/think'
import { createId } from './lib/utils'
import type {
  ApiSettings,
  ChatMessage,
  HintLevel,
  Mistake,
  Subject,
  SubjectFilter,
  Task,
  TutorMode,
  View,
} from './types'

const navItems = [
  { id: 'tutor' as const, label: 'AI 答疑', note: '问题与讲解', icon: Sparkles },
  { id: 'formulas' as const, label: '知识手册', note: '四科速查', icon: BookMarked },
  { id: 'mistakes' as const, label: '错题本', note: '错因与复盘', icon: NotebookPen },
  { id: 'plan' as const, label: '学习计划', note: '专注与节奏', icon: CalendarDays },
  { id: 'data' as const, label: '数据与备份', note: '导出 · 导入', icon: UserRound },
  { id: 'guide' as const, label: '使用说明', note: '三分钟上手', icon: BookOpen },
]

const aboutNav = [
  { id: 'about' as const, label: '关于开发者', note: '谁在做问渠', icon: HeartHandshake },
  { id: 'donate' as const, label: '打赏开发者', note: '自愿支持', icon: HandCoins },
  { id: 'custom' as const, label: '功能共建', note: '定制与建议', icon: MessagesSquare },
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
    words: ['化学', '反应', '溶液', '离子', '氧化', '还原', '摩尔', '平衡', '有机', '元素周期', 'pH'],
  },
  {
    subject: 'biology',
    words: ['生物', '细胞', '遗传', '基因', '光合', '呼吸作用', '酶', '生态', '种群', 'DNA', '蛋白质'],
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
      score: words.filter((word) => normalized.toLowerCase().includes(word.toLowerCase()))
        .length,
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
    subject: currentSubject === 'all' ? detectSubject(question) : currentSubject,
    title: question ? question.replace(/\s+/g, ' ').slice(0, 30) : '',
    question,
    cause: '',
    correction: lastAnswer?.content.slice(0, 1600) ?? '',
    mastered: false,
  }
}

/** 兼容旧版本保存的设置：缺的高级字段用默认值补齐 */
function mergeSettings(stored: ApiSettings): ApiSettings {
  return { ...defaultSettings(), ...stored }
}

export default function App() {
  const [view, setView] = useState<View>('tutor')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [storedSettings, setSettings] = useLocalStorage<ApiSettings>(
    'wenqu-api-settings',
    defaultSettings(),
  )
  const settings = mergeSettings(storedSettings)
  const [messages, setMessages] = useLocalStorage<ChatMessage[]>(
    'wenqu-chat-messages',
    [],
  )
  const [subject, setSubject] = useLocalStorage<SubjectFilter>('wenqu-subject', 'math')
  const [mode, setMode] = useLocalStorage<TutorMode>('wenqu-mode', 'explain')
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [formulaSubject, setFormulaSubject] = useState<Subject>('math')
  const [mistakes, setMistakes] = useLocalStorage<Mistake[]>('wenqu-mistakes', [])
  const [tasks, setTasks] = useLocalStorage<Task[]>('wenqu-tasks', [])
  const [mistakeDraft, setMistakeDraft] = useState<
    Omit<Mistake, 'id' | 'createdAt'> | null
  >(null)
  const [visionQuestion, setVisionQuestion] = useState<{text: string; subject?: Subject} | null>(null)
  const [pendingImages, setPendingImages] = useState<string[]>([])
  const [imageError, setImageError] = useState('')
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

  useEffect(() => () => abortRef.current?.abort(), [])

  function navigate(next: View) {
    setView(next)
    setMobileNavOpen(false)
  }

  function openFormula(nextSubject: Subject) {
    setFormulaSubject(nextSubject)
    setView('formulas')
  }

  /** 骨架：构造请求、流式写回 assistant 消息 */
  async function runChat(
    history: ChatMessage[],
    userMessage: ChatMessage,
    assistantId: string,
    options: {
      activeSubject: Subject
      activeMode: TutorMode
      isFollowup: boolean
      hintLevel: HintLevel
      question: string
    },
  ) {
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      mode: options.activeMode,
      subject: options.activeSubject,
      hintLevel: options.hintLevel,
      question: options.question,
    }
    setMessages([...history, userMessage, assistantMessage])
    setInput('')
    setError('')
    setLoading(true)

    const controller = new AbortController()
    abortRef.current = controller

    /** <think> 标签剥离：网关型推理模型的思考混在 content 里 */
    const splitter = new ThinkSplitter()
    const appendContent = (chunk: string) => {
      setMessages((current) =>
        current.map((message) =>
          message.id === assistantId
            ? { ...message, content: message.content + chunk }
            : message,
        ),
      )
    }
    const appendReasoning = (chunk: string) => {
      setMessages((current) =>
        current.map((message) =>
          message.id === assistantId
            ? { ...message, reasoning: (message.reasoning ?? '') + chunk }
            : message,
        ),
      )
    }

    try {
      await streamChat({
        settings,
        subject: options.activeSubject,
        mode: options.activeMode,
        isFollowup: options.isFollowup,
        messages: [...history, userMessage].map((message) => ({
          role: message.role,
          content: message.content,
          // 文字模型仅收到文本，原始图片不进入后续请求。
        })),
        signal: controller.signal,
        onContent: (chunk) => {
          const { reasoning, content } = splitter.feed(chunk)
          if (reasoning) appendReasoning(reasoning)
          if (content) appendContent(content)
        },
        onReasoning: appendReasoning,
      })
      const tail = splitter.flush()
      if (tail.reasoning) appendReasoning(tail.reasoning)
      if (tail.content) appendContent(tail.content)
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
        setError(caught instanceof Error ? caught.message : '发生了未知错误，请重试。')
        setMessages((current) =>
          current.filter((item) => item.id !== assistantId || item.content.trim() !== ''),
        )
      }
    } finally {
      setLoading(false)
      abortRef.current = null
    }
  }

  function sendQuestion(textOverride?: string, subjectOverride?: Subject, verifiedDiagram?: string) {
    const text = (textOverride ?? input).trim()
    const hasImages = pendingImages.length > 0
    if ((!text && !hasImages) || loading) return
    if (!vault.isHandle(settings.apiKey) || !vault.has(settings.apiKey)) {
      setInput(text)
      setError('')
      setSettingsOpen(true)
      return
    }

    if (hasImages && verifiedDiagram === undefined) {
      setVisionQuestion({text, subject: subjectOverride})
      return
    }
    const finalText = verifiedDiagram ? `${text || '请根据图像信息解题。'}\n\n【已核对的图像材料】\n${verifiedDiagram}\n\n仅依据上述材料推理；若仍有缺失或不确定信息请指出，不要臆造。` : text
    const activeSubject =
      subjectOverride ?? (subject === 'all' ? detectSubject(text || '读图解题') : subject)
    const activeMode = mode
    const userMessage: ChatMessage = {
      id: createId(),
      role: 'user',
      content: finalText,
    }
    setPendingImages([])
    setImageError('')
    void runChat(messages, userMessage, createId(), {
      activeSubject,
      activeMode,
      isFollowup: false,
      hintLevel: activeMode === 'guide' ? 1 : 0,
      question: text || '读图解题',
    })
  }

  async function addImages(files: File[]) {
    if (!files.length) return
    setImageError('')
    const room = MAX_IMAGES - pendingImages.length
    if (room <= 0) {
      setImageError(`一次最多 ${MAX_IMAGES} 张图，先删掉一张再添加。`)
      return
    }
    const accepted: string[] = []
    for (const file of files.slice(0, room)) {
      try {
        accepted.push(await compressImageFile(file))
      } catch (error) {
        setImageError(error instanceof Error ? error.message : '图片处理失败。')
      }
    }
    if (accepted.length) {
      setPendingImages((current) => [...current, ...accepted].slice(0, MAX_IMAGES))
    }
  }

  /** 快捷追问：同一道题深入 */
  function followup(question: string) {
    if (loading || !lastAnsweredQuestion) return
    const activeSubject = lastAnsweredSubject
    const userMessage: ChatMessage = {
      id: createId(),
      role: 'user',
      content: question,
    }
    void runChat(messages, userMessage, createId(), {
      activeSubject,
      activeMode: lastAnsweredMode,
      isFollowup: true,
      hintLevel: lastAnsweredHint,
      question: lastAnsweredQuestion,
    })
  }

  /** 引导模式：解锁下一级提示 */
  function unlockNextHint(assistantMessage: ChatMessage) {
    if (loading) return
    const nextLevel = Math.min(3, (assistantMessage.hintLevel ?? 1) + 1) as HintLevel
    const userMessage: ChatMessage = {
      id: createId(),
      role: 'user',
      content: '继续',
    }
    void runChat(messages, userMessage, createId(), {
      activeSubject: assistantMessage.subject ?? 'math',
      activeMode: 'guide',
      isFollowup: true,
      hintLevel: nextLevel,
      question: assistantMessage.question ?? assistantMessage.content,
    })
  }

  function stopGeneration() {
    abortRef.current?.abort()
  }

  function newChat() {
    stopGeneration()
    setMessages([])
    setInput('')
    setError('')
    setPendingImages([])
    setImageError('')
  }

  function openMistakeFromChat() {
    setMistakeDraft(makeMistakeDraft(messages, subject))
  }

  function saveMistake(draft: Omit<Mistake, 'id' | 'createdAt'>) {
    setMistakes((current) => [
      { ...draft, id: createId(), createdAt: new Date().toISOString().slice(0, 10) },
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

  const lastAnswered = [...messages]
    .reverse()
    .find((message) => message.role === 'assistant' && message.content)
  const lastAnsweredQuestion = lastAnswered?.question
  const lastAnsweredSubject = lastAnswered?.subject ?? 'math'
  const lastAnsweredMode = lastAnswered?.mode ?? mode
  const lastAnsweredHint = (lastAnswered?.hintLevel ?? 0) as HintLevel

  return (
    <div className="app-shell">
      {visionQuestion && <VisionBridge images={pendingImages} question={visionQuestion.text} onClose={() => setVisionQuestion(null)} onConfirm={description => {const q = visionQuestion; setVisionQuestion(null); sendQuestion(q.text, q.subject, description)}} />}
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
            <span className="brand-mark">渠</span>
            <span className="brand-words">
              <strong>问渠</strong>
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

        <div className="sidebar-label">关于与共建</div>
        <nav className="main-nav" aria-label="关于与共建">
          {aboutNav.map((item) => {
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
              <small>{settings.apiKey ? settings.model || '未填写模型' : '密钥仅存内存 · 不落盘'}</small>
            </span>
            <Settings2 size={15} className="api-gear" />
          </button>
          <p className="local-note">密钥仅存内存 · 不写入磁盘</p>
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
            问渠
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
            onFollowup={followup}
            onUnlockNextHint={unlockNextHint}
            onStop={stopGeneration}
            onOpenSettings={() => setSettingsOpen(true)}
            onNewChat={newChat}
            onOpenFormula={openFormula}
            onAddMistake={openMistakeFromChat}
            pendingImages={pendingImages}
            imageError={imageError}
            onAddImages={addImages}
            onRemoveImage={(index) =>
              setPendingImages((current) => current.filter((_, i) => i !== index))
            }
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
                      mistake.id === id ? { ...mistake, mastered: !mistake.mastered } : mistake,
                    ),
                  )
                }
                onDelete={(id) =>
                  setMistakes((current) => current.filter((mistake) => mistake.id !== id))
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
            {view === 'data' && (
              <DataView
                snapshot={{ settings, messages, subject, mode, mistakes, tasks }}
                onOpenGuide={() => setView('guide')}
                onImport={(next) => {
                  if (next.settings) setSettings({ ...defaultSettings(), ...next.settings })
                  setMessages(next.messages)
                  setMistakes(next.mistakes)
                  setTasks(next.tasks)
                  setSubject(next.subject as SubjectFilter)
                  setMode(next.mode as TutorMode)
                  setInput('')
                  setError('')
                }}
              />
            )}
            {view === 'guide' && (
              <GuideView
                onOpenSettings={() => setSettingsOpen(true)}
                onOpenData={() => setView('data')}
                onOpenTutor={() => navigate('tutor')}
              />
            )}
            {view === 'about' && (
              <AboutView
                onOpenDonate={() => setView('donate')}
                onOpenCustom={() => setView('custom')}
              />
            )}
            {view === 'donate' && (
              <DonateView
                onOpenAbout={() => setView('about')}
                onOpenCustom={() => setView('custom')}
              />
            )}
            {view === 'custom' && (
              <CustomView
                onOpenAbout={() => setView('about')}
                onOpenDonate={() => setView('donate')}
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
                  如果接口支持浏览器跨域访问，前端即可直接请求；若服务商禁止
                  CORS，需要另外部署一个转发接口。连接失败时先用「测试连接」定位原因。
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
