import {
  BookOpen,
  BrainCircuit,
  ChevronDown,
  ImagePlus,
  Layers,
  NotebookPen,
  Plus,
  Send,
  Sparkles,
  Timer,
  X,
  Zap,
} from 'lucide-react'
import type { ClipboardEvent, KeyboardEvent, RefObject } from 'react'
import { useEffect, useState } from 'react'
import { useFocusTimer } from '../hooks/useFocusTimer'
import { subjectLabel } from '../data/subjects'
import type {
  ChatMessage,
  Subject,
  SubjectFilter,
  TutorMode,
} from '../types'
import { greeting, todayLabel } from '../lib/utils'
import { MarkdownContent } from './MarkdownContent'

interface TutorViewProps {
  messages: ChatMessage[]
  input: string
  subject: SubjectFilter
  mode: TutorMode
  loading: boolean
  error: string
  hasApiKey: boolean
  onInputChange: (value: string) => void
  onSubjectChange: (subject: SubjectFilter) => void
  onModeChange: (mode: TutorMode) => void
  onSend: (text?: string) => void
  onFollowup: (question: string) => void
  onUnlockNextHint: (message: ChatMessage) => void
  onStop: () => void
  onOpenSettings: () => void
  onNewChat: () => void
  onOpenFormula: (subject: Subject) => void
  onAddMistake: () => void
  pendingImages: string[]
  imageError: string
  onAddImages: (files: File[]) => void
  onRemoveImage: (index: number) => void
  messagesEndRef: RefObject<HTMLDivElement | null>
}

const starters = [
  {
    subject: 'math' as const,
    label: '数学 · 压轴',
    icon: '∑',
    title: '导数题的单调性与分类讨论',
    text: '已知函数 f(x)=x³-3ax+1（a∈R），讨论它的单调区间。我是含参分类总是漏情况，请按「考点定位 → 分类标准 → 逐类讨论」带我走一遍，并说明为什么要按这个标准分。',
  },
  {
    subject: 'physics' as const,
    label: '物理 · 模型',
    icon: 'v',
    title: '传送带模型的力与运动',
    text: '物块轻放在水平匀速传动的传送带上，从静止加速到与带同速。请先识别模型和需要注意的分界条件，再分析受力、加速度和位移，最后告诉我这类题有哪些现成结论可以直接用。',
  },
  {
    subject: 'chemistry' as const,
    label: '化学 · 平衡',
    icon: '⚗',
    title: '平衡移动与 K 的独立',
    text: '密闭容器中 N₂(g)+3H₂(g)⇌2NH₃(g) 达到平衡后缩小体积增大压强。请用三段式分析移动方向，并说明浓度、转化率、K 各自怎么变——重点是"哪些量永远不会变"。',
  },
  {
    subject: 'biology' as const,
    label: '生物 · 遗传',
    icon: '○',
    title: '9:3:3:1 的变式拆解',
    text: '两对相对性状的杂合子杂交得 9:3:3:1。请教我怎么把"异常比例"（如 9:7、12:3:1、15:1）反推出基因间的相互作用，给我一套判读规则而不是死记。',
  },
  {
    subject: 'math' as const,
    label: '数学 · 圆锥曲线',
    icon: '△',
    title: '联立计算总出错的解法',
    text: '椭圆 x²/4 + y² = 1 与直线 y=kx+1 交于 A、B 两点。请讲清联立时怎么通过设而不求、韦达定理减少计算量，判别式和取值范围怎么严谨收尾。',
  },
  {
    subject: 'physics' as const,
    label: '物理 · 场与粒子',
    icon: '◎',
    title: '带电粒子圆轨迹的确定',
    text: '正粒子垂直射入匀强磁场。请说明洛伦兹力为什么不做功、怎么定圆心找半径，以及"平移进出场速度方向找圆心"这类作图技巧的原理。',
  },
]

const modeMeta: { id: TutorMode; label: string; icon: typeof Zap; title: string }[] = [
  { id: 'guide', label: '启发引导', icon: Layers, title: '先给切入点，你回复"继续"逐级解锁关键步骤与完整解答' },
  { id: 'explain', label: '完整精讲', icon: BrainCircuit, title: '考点定位 → 隐含条件 → 路线 → 详解 → 易错点 → 变式' },
  { id: 'exam', label: '应试速解', icon: Zap, title: '最快解法 + 二级结论，直接能抄进答题卡的精简过程' },
]

const followups = [
  { label: '换一种方法', text: '换一种解法（一题多解），并对比两种方法各适合什么场景。' },
  { label: '为什么这一步成立', text: '上面过程中最关键的一步为什么成立？从依据讲起，可以代个具体数值验证。' },
  { label: '出更难的变式', text: '给这道题出一个更难的变式（改参数或加约束），先给新题，再给一句方向提示。' },
  { label: '再讲细一点', text: '我还有一步没跟上，把最容易卡住的那一步拆得更细，讲慢一点。' },
]

function TimerChip() {
  const timer = useFocusTimer()
  const minutes = Math.floor(timer.secondsLeft / 60)
  const seconds = timer.secondsLeft % 60
  return (
    <button
      type="button"
      className={`timer-chip${timer.running ? ' running' : ''}`}
      onClick={timer.toggle}
      title="点击开始或暂停 25 分钟专注计时"
    >
      <Timer size={12} />
      {minutes}:{String(seconds).padStart(2, '0')}
    </button>
  )
}

function ModeBadge({ mode }: { mode?: TutorMode }) {
  const meta = modeMeta.find((item) => item.id === mode)
  if (!meta) return null
  const Icon = meta.icon
  return (
    <span className="mode-badge">
      <Icon size={11} />
      {meta.label}
    </span>
  )
}

function ReasoningFold({ text, active }: { text: string; active: boolean }) {
  const [open, setOpen] = useState(active)

  useEffect(() => {
    if (active) setOpen(true)
  }, [active])

  const charCount = text.replace(/\s/g, '').length

  return (
    <div className={`reasoning-panel${active ? ' active' : ''}${open ? ' open' : ''}`}>
      <button
        type="button"
        className="reasoning-head"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <BrainCircuit size={13} className={active ? 'spin-slow' : ''} />
        <span className="reasoning-title">{active ? '正在思考…' : '思考过程'}</span>
        <span className="reasoning-meta">{charCount} 字</span>
        <ChevronDown size={13} className={open ? 'open' : ''} />
      </button>
      {open && (
        <div className="reasoning-body" role="region" aria-label="模型思考过程">
          {text}
        </div>
      )}
    </div>
  )
}

export function TutorView({
  messages,
  input,
  subject,
  mode,
  loading,
  error,
  hasApiKey,
  onInputChange,
  onSubjectChange,
  onModeChange,
  onSend,
  onFollowup,
  onUnlockNextHint,
  onStop,
  onOpenSettings,
  onNewChat,
  onOpenFormula,
  onAddMistake,
  pendingImages,
  imageError,
  onAddImages,
  onRemoveImage,
  messagesEndRef,
}: TutorViewProps) {
  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      onSend()
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const files = Array.from(event.clipboardData.files).filter((file) =>
      file.type.startsWith('image/'),
    )
    if (files.length) {
      event.preventDefault()
      onAddImages(files)
    }
  }

  const isEmpty = messages.length === 0
  const lastId = messages[messages.length - 1]?.id
  const lastAssistant = [...messages]
    .reverse()
    .find((message) => message.role === 'assistant' && message.content)
  const showFollowups = !loading && !isEmpty && Boolean(lastAssistant)

  return (
    <section className="tutor-view">
      <header className="view-header tutor-header">
        <div>
          <p className="eyebrow">{todayLabel()}</p>
          <h1>
            {greeting()}，把卡住的题讲透<span className="accent-dot">.</span>
          </h1>
        </div>
        <div className="header-actions">
          <TimerChip />
          <button type="button" className="ghost-button" onClick={onNewChat}>
            <Plus size={16} /> 新对话
          </button>
        </div>
      </header>

      <div className="tutor-layout">
        <div className="chat-panel">
          <div className={`chat-scroll${isEmpty ? ' is-empty' : ''}`}>
            {isEmpty ? (
              <div className="chat-empty">
                <div className="empty-mark" aria-hidden="true">
                  <Sparkles size={22} />
                </div>
                <h2>不重复课本，只解决「不会做」</h2>
                <p>
                  把题干和你卡住的那一步发过来。考什么、陷阱在哪、怎么落笔、为什么会算错——按你选的模式来。
                </p>
                <div className="starter-grid">
                  {starters.map((starter) => (
                    <button
                      type="button"
                      key={starter.title}
                      className="starter-card"
                      onClick={() => {
                        onSubjectChange(starter.subject)
                        onSend(starter.text)
                      }}
                    >
                      <span className={`starter-icon ${starter.subject}`}>
                        {starter.icon}
                      </span>
                      <span className="starter-content">
                        <span className="starter-tag">{starter.label}</span>
                        <strong>{starter.title}</strong>
                      </span>
                    </button>
                  ))}
                </div>
                <div className="empty-hint">
                  <BookOpen size={15} />
                  截图粘贴即可免费提取文字；核对公式、补充图形关系后，交给你的文字模型解题。
                </div>
              </div>
            ) : (
              <div className="message-list">
                {messages.map((message) => {
                  const isThinking =
                    loading &&
                    message.id === lastId &&
                    message.role === 'assistant' &&
                    !message.content
                  return (
                  <article key={message.id} className={`message ${message.role}`}>
                    {message.role === 'assistant' && (
                      <div className="assistant-avatar" aria-hidden="true">
                        知
                      </div>
                    )}
                    <div className="message-body">
                      {message.role === 'assistant' ? (
                        <>
                          <div className="message-meta">
                            <span>问渠老师</span>
                            {message.subject && (
                              <span className="meta-subject">
                                {subjectLabel(message.subject)}
                              </span>
                            )}
                            <ModeBadge mode={message.mode} />
                            {loading &&
                              message === messages[messages.length - 1] &&
                              !isThinking && (
                                <span className="thinking">正在推演</span>
                              )}
                          </div>
                          {message.reasoning && (
                            <ReasoningFold text={message.reasoning} active={isThinking} />
                          )}
                          <div className="assistant-content">
                            {message.content ? (
                              <div className="prose-content">
                                <MarkdownContent>{message.content}</MarkdownContent>
                              </div>
                            ) : isThinking ? null : (
                              <span className="typing-indicator">
                                <i />
                                <i />
                                <i />
                              </span>
                            )}
                          </div>
                          {message.content && !loading && (
                            <div className="answer-actions">
                              {message.mode === 'guide' &&
                                (message.hintLevel ?? 0) < 3 && (
                                  <button
                                    type="button"
                                    className="text-button accent"
                                    onClick={() => onUnlockNextHint(message)}
                                  >
                                    <ChevronDown size={14} />
                                    {message.hintLevel === 1
                                      ? '解锁第 2 级 · 关键步骤'
                                      : '解锁第 3 级 · 完整解答'}
                                  </button>
                                )}
                              <button
                                type="button"
                                className="text-button"
                                onClick={() =>
                                  navigator.clipboard?.writeText(message.content)
                                }
                              >
                                复制
                              </button>
                              <button
                                type="button"
                                className="text-button"
                                onClick={onAddMistake}
                              >
                                <NotebookPen size={14} /> 记入错题本
                              </button>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="user-bubble">
                          {message.images && message.images.length > 0 && (
                            <div className="bubble-images">
                              {message.images.map((image, index) => (
                                <a
                                  key={index}
                                  href={image}
                                  target="_blank"
                                  rel="noreferrer"
                                  title="点开查看原图"
                                >
                                  <img src={image} alt={`题目图片 ${index + 1}`} />
                                </a>
                              ))}
                            </div>
                          )}
                          {message.content}
                        </div>
                      )}
                    </div>
                  </article>
                  )
                })}
                {error && (
                  <div className="error-card" role="alert">
                    <strong>这次没有连上 AI</strong>
                    <p>{error}</p>
                    {!hasApiKey && (
                      <button
                        type="button"
                        className="small-primary"
                        onClick={onOpenSettings}
                      >
                        配置 API
                      </button>
                    )}
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {showFollowups && (
            <div className="followup-bar">
              <span className="followup-label">继续追问</span>
              <div className="followup-chips">
                {followups.map((item) => (
                  <button
                    type="button"
                    key={item.label}
                    disabled={loading}
                    onClick={() => onFollowup(item.text)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="composer-wrap">
            <div className="composer">
              <div className="composer-topline">
                <div className="subject-switch" role="group" aria-label="选择科目">
                  {(['math', 'physics', 'chemistry', 'biology', 'all'] as const).map(
                    (item) => (
                      <button
                        type="button"
                        key={item}
                        className={subject === item ? 'active' : ''}
                        onClick={() => onSubjectChange(item)}
                      >
                        {item === 'math'
                          ? '数学'
                          : item === 'physics'
                            ? '物理'
                            : item === 'chemistry'
                              ? '化学'
                              : item === 'biology'
                                ? '生物'
                                : '综合'}
                      </button>
                    ),
                  )}
                </div>
                <div className="mode-switch" role="group" aria-label="讲解模式">
                  {modeMeta.map((item) => {
                    const Icon = item.icon
                    return (
                      <button
                        type="button"
                        key={item.id}
                        className={mode === item.id ? 'active' : ''}
                        onClick={() => onModeChange(item.id)}
                        title={item.title}
                      >
                        <Icon size={11} />
                        {item.label}
                      </button>
                    )
                  })}
                </div>
              </div>
              <textarea
                value={input}
                onChange={(event) => onInputChange(event.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder={
                  pendingImages.length
                    ? '补充问题（可选），发送后先免费提取文字并核对…'
                    : '输入题目、你的思路，或直接粘贴题目截图…'
                }
                rows={2}
                disabled={loading}
                aria-label="答疑输入框"
              />
              {pendingImages.length > 0 && (
                <div className="pending-images" aria-label="待发送图片">
                  {pendingImages.map((image, index) => (
                    <figure className="pending-thumb" key={`${index}-${image.length}`}>
                      <img src={image} alt={`题目图片 ${index + 1}`} />
                      <button
                        type="button"
                        className="thumb-remove"
                        onClick={() => onRemoveImage(index)}
                        aria-label={`删除图片 ${index + 1}`}
                      >
                        <X size={12} />
                      </button>
                    </figure>
                  ))}
                  <label className="thumb-add">
                    <ImagePlus size={15} />
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(event) => {
                        onAddImages(Array.from(event.target.files ?? []))
                        event.target.value = ''
                      }}
                    />
                  </label>
                </div>
              )}
              {imageError && <p className="image-error">{imageError}</p>}
              <div className="composer-footer">
                <div className="composer-tools">
                  <label
                    className="quiet-link image-trigger"
                    title={pendingImages.length >= 3 ? '最多 3 张' : '添加题目图片'}
                  >
                    <ImagePlus size={13} />
                    题目图片
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(event) => {
                        onAddImages(Array.from(event.target.files ?? []))
                        event.target.value = ''
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    className="quiet-link"
                    onClick={() => onOpenFormula(subject === 'all' ? 'math' : subject)}
                  >
                    知识手册
                  </button>
                </div>
                {mode === 'guide' && (
                  <span className="guide-hint">
                    引导模式：AI 只给切入点，回复「继续」逐级解锁
                  </span>
                )}
                <button
                  type="button"
                  className={`send-button${loading ? ' stop' : ''}`}
                  onClick={loading ? onStop : () => onSend()}
                  disabled={!loading && !input.trim() && pendingImages.length === 0}
                  aria-label={loading ? '停止生成' : '发送问题'}
                >
                  {loading ? (
                    <span className="stop-square" />
                  ) : (
                    <Send size={14} />
                  )}
                  {loading ? '停止' : '发送'}
                </button>
              </div>
            </div>
            {!hasApiKey && (
              <p className="api-hint">
                还没有配置 AI。
                <button type="button" onClick={onOpenSettings}>
                  连接你的 API Key
                </button>
                后即可开始。
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
