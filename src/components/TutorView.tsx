import { BookOpen, NotebookPen, Plus, Sparkles } from 'lucide-react'
import type { KeyboardEvent, RefObject } from 'react'
import { useFocusTimer } from '../hooks/useFocusTimer'
import type { ChatMessage, Subject, SubjectFilter, TutorMode } from '../types'
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
  onStop: () => void
  onOpenSettings: () => void
  onNewChat: () => void
  onOpenFormula: (subject: Subject) => void
  onAddMistake: () => void
  messagesEndRef: RefObject<HTMLDivElement | null>
}

const starters = [
  {
    subject: 'math' as const,
    label: '数学',
    icon: '∑',
    title: '讲讲导数压轴题的单调性讨论',
    text: '已知函数 f(x)=x³-3ax+1，讨论它的单调区间。请一步步带我分析，并说明参数怎样分类。',
  },
  {
    subject: 'physics' as const,
    label: '物理',
    icon: 'v',
    title: '传送带模型怎么判断摩擦力',
    text: '一个物块轻放在水平匀速运动的传送带上，速度从零开始增加到与传送带相同。请帮我分析整个过程中的受力、加速度和位移关系。',
  },
  {
    subject: 'math' as const,
    label: '数学',
    icon: '△',
    title: '圆锥曲线联立总是算错',
    text: '椭圆 x²/4 + y² = 1 与直线 y=kx+1 相交于 A、B 两点，求 k 的取值范围。请讲清楚联立方程时怎样减少计算错误。',
  },
  {
    subject: 'physics' as const,
    label: '物理',
    icon: '◎',
    title: '带电粒子在磁场中的轨迹',
    text: '一带正电粒子垂直射入匀强磁场，请解释洛伦兹力为什么始终不做功，以及如何确定圆周运动的圆心和半径。',
  },
  {
    subject: 'chemistry' as const,
    label: '化学',
    icon: '⚗',
    title: '化学平衡移动怎么判断',
    text: '在密闭容器中进行合成氨反应 N₂(g)+3H₂(g)⇌2NH₃(g)，达到平衡后增大压强。请判断平衡移动方向，并解释浓度、转化率和平衡常数分别如何变化。',
  },
  {
    subject: 'biology' as const,
    label: '生物',
    icon: '○',
    title: '光合作用与呼吸作用曲线',
    text: '请帮我梳理光合作用与细胞呼吸的曲线题：如何判断净光合速率、总光合速率，以及光补偿点和光饱和点的含义。',
  },
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
      <span className="timer-dot" />
      {minutes}:{String(seconds).padStart(2, '0')}
      <span className="timer-label">{timer.running ? '专注中' : '专注'}</span>
    </button>
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
  onStop,
  onOpenSettings,
  onNewChat,
  onOpenFormula,
  onAddMistake,
  messagesEndRef,
}: TutorViewProps) {
  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      onSend()
    }
  }

  const isEmpty = messages.length === 0
  const lastUserMessage = [...messages].reverse().find((message) => message.role === 'user')

  return (
    <section className="tutor-view">
      <header className="view-header tutor-header">
        <div>
          <p className="eyebrow">{todayLabel()}</p>
          <h1>
            {greeting()}，把今天卡住的题<span className="accent-dot">.</span>
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
                <h2>一道题，讲到你真正会</h2>
                <p>
                  拍照暂时不上传也没关系。把题干、你的思路或卡住的那一步写下来，
                  我们一起把问题拆开。
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
                  不确定怎么写？先描述“已知、求什么、你试过什么”。
                </div>
              </div>
            ) : (
              <div className="message-list">
                {messages.map((message) => (
                  <article
                    key={message.id}
                    className={`message ${message.role}`}
                  >
                    {message.role === 'assistant' && (
                      <div className="assistant-avatar" aria-hidden="true">
                        知
                      </div>
                    )}
                    <div className="message-body">
                      {message.role === 'assistant' ? (
                        <>
                          <div className="message-meta">
                            <span>知弧老师</span>
                            {loading && message === messages[messages.length - 1] && (
                              <span className="thinking">正在推演</span>
                            )}
                          </div>
                          <div className="assistant-content">
                            {message.content ? (
                              <div className="prose-content">
                                <MarkdownContent>{message.content}</MarkdownContent>
                              </div>
                            ) : (
                              <span className="typing-indicator">
                                <i />
                                <i />
                                <i />
                              </span>
                            )}
                          </div>
                          {message.content && !loading && (
                            <div className="answer-actions">
                              <button
                                type="button"
                                className="text-button"
                                onClick={() =>
                                  navigator.clipboard?.writeText(message.content)
                                }
                              >
                                复制解答
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
                        <div className="user-bubble">{message.content}</div>
                      )}
                    </div>
                  </article>
                ))}
                {loading && (
                  <div className="stream-status">
                    <span className="pulse-dot" />
                    正在组织讲解
                  </div>
                )}
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
                <div className="mode-switch">
                  <button
                    type="button"
                    className={mode === 'guide' ? 'active' : ''}
                    onClick={() => onModeChange('guide')}
                    title="先给你思路提示，不直接公布完整答案"
                  >
                    启发式
                  </button>
                  <button
                    type="button"
                    className={mode === 'explain' ? 'active' : ''}
                    onClick={() => onModeChange('explain')}
                    title="给出完整步骤与详细讲解"
                  >
                    完整讲解
                  </button>
                </div>
              </div>
              <textarea
                value={input}
                onChange={(event) => onInputChange(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入题目、你的思路，或直接问一个概念…"
                rows={2}
                disabled={loading}
                aria-label="答疑输入框"
              />
              <div className="composer-footer">
                <button
                  type="button"
                  className="quiet-link"
                  onClick={() =>
                    onOpenFormula(
                      subject === 'all' ? 'math' : subject,
                    )
                  }
                >
                  查看公式速查
                </button>
                <button
                  type="button"
                  className={`send-button${loading ? ' stop' : ''}`}
                  onClick={loading ? onStop : () => onSend()}
                  disabled={!loading && !input.trim()}
                  aria-label={loading ? '停止生成' : '发送问题'}
                >
                  {loading ? (
                    <span className="stop-square" />
                  ) : (
                    <Sparkles size={17} />
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
                后即可获得完整讲解。
              </p>
            )}
            {lastUserMessage && hasApiKey && (
              <p className="composer-footnote">Enter 发送 · Shift + Enter 换行</p>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
