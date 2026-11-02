import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Check, Download, LogIn, LogOut, Upload, UserRound } from 'lucide-react'
import { useVisionAccount } from '../hooks/useVisionAccount'
import { isReachable } from '../lib/visionApi'
import {
  BackupError,
  backupFileName,
  buildBackup,
  mergeSnapshot,
  parseBackup,
  serializeBackup,
  type BackupFile,
  type BackupSnapshot,
  type ImportStrategy,
} from '../lib/backup'

interface Props {
  snapshot: BackupSnapshot
  onImport: (snapshot: BackupSnapshot) => void
  onOpenGuide: () => void
}

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  // 交给浏览器读完后释放，避免大文件立刻失效。
  window.setTimeout(() => URL.revokeObjectURL(url), 10000)
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

export function AccountView({ snapshot, onImport, onOpenGuide }: Props) {
  const vision = useVisionAccount()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const [includeApiKey, setIncludeApiKey] = useState(false)
  const [includeImages, setIncludeImages] = useState(false)
  const [exportNotice, setExportNotice] = useState('')

  const fileInput = useRef<HTMLInputElement | null>(null)
  const [preview, setPreview] = useState<BackupFile | null>(null)
  const [strategy, setStrategy] = useState<ImportStrategy>('replace')
  const [importError, setImportError] = useState('')
  const [imported, setImported] = useState('')
  // null = 还在检测；false 时在账号区提示网络不通，建议用本地 OCR。
  const [reachable, setReachable] = useState<boolean | null>(null)
  useEffect(() => {
    let alive = true
    void isReachable().then((ok) => { if (alive) setReachable(ok) })
    return () => { alive = false }
  }, [])

  const currentSize = useMemo(
    () => new TextEncoder().encode(serializeBackup(buildBackup(snapshot, {
      account: vision.account?.user.username ?? null,
      includeApiKey,
      includeImages,
    }))).length,
    [snapshot, vision.account, includeApiKey, includeImages],
  )

  function exportNow() {
    const file = buildBackup(snapshot, {
      account: vision.account?.user.username ?? null,
      includeApiKey,
      includeImages,
    })
    const text = serializeBackup(file)
    downloadText(backupFileName(), text)
    setExportNotice(
      `已导出 ${file.stats.messages} 条对话、${file.stats.mistakes} 道错题、${file.stats.tasks} 项任务`
      + `${includeImages ? `、${file.stats.images} 张图片` : '（不含图片）'}`
      + `${includeApiKey ? '，包含 API Key' : '，不含 API Key'}。`,
    )
  }

  async function pickFile(file: File | undefined) {
    setImportError('')
    setImported('')
    setPreview(null)
    if (!file) return
    try {
      const text = await file.text()
      setPreview(parseBackup(text))
    } catch (caught) {
      setImportError(caught instanceof BackupError ? caught.message : '读取失败，请确认文件是问渠导出的 JSON 备份。')
    }
  }

  function applyImport() {
    if (!preview) return
    const next = mergeSnapshot(snapshot, preview.data, strategy)
    onImport(next)
    setImported(
      strategy === 'replace'
        ? '已导入并覆盖当前浏览器数据。'
        : '已合并：对话保留原样，错题与任务按编号去重后追加。',
    )
    setPreview(null)
    if (fileInput.current) fileInput.current.value = ''
  }

  return (
    <div className="account-page">
      <header className="page-head">
        <div>
          <p className="eyebrow">账号与数据</p>
          <h1>一处登录，换设备接着用</h1>
          <p className="page-sub">
            识图账号用于云端限次；聊天、错题、计划可以导出成文件，在新浏览器登录后导入。
            第一次读不懂的地方，可以先看 <button type="button" className="inline-link" onClick={onOpenGuide}>使用说明</button>。
          </p>
        </div>
      </header>

      <section className="account-card">
        <h2><UserRound size={18} /> 识图账号</h2>
        {reachable === false && (
          <p className="form-warn">
            <AlertTriangle size={14} />
            当前网络连不上识图服务（部分网络会屏蔽该域名）。登录和云端识图会失败，
            可以先在答疑页用「本地 OCR」或手工填写继续刷题；换 Wi-Fi / 移动网络后重新打开本页即可。
          </p>
        )}
        {!vision.account ? (
          <>
            <p className="account-hint">
              云端图形理解按账号计次，每天 3 张，换设备或清缓存都不会重置。账号只记录识别次数，
              不上传你的聊天内容、错题和图片存档。
            </p>
            <div className="account-tabs" role="tablist" aria-label="登录或注册">
              <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); vision.setError('') }}>登录</button>
              <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => { setMode('register'); vision.setError('') }}>注册新账号</button>
            </div>
            <div className="account-form">
              <label className="field">
                <span>用户名</span>
                <input value={username} autoComplete="username" onChange={(event) => setUsername(event.target.value)} placeholder="3–24 位，中文、字母、数字、下划线" />
              </label>
              <label className="field">
                <span>密码</span>
                <input type="password" value={password} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} onChange={(event) => setPassword(event.target.value)} placeholder="至少 8 位" />
              </label>
              <button className="primary-button" disabled={vision.busy} onClick={async () => {
                const result = await vision.submit(mode, username, password)
                if (result) setPassword('')
              }}>
                <LogIn size={16} /> {vision.busy ? '请稍候…' : mode === 'login' ? '登录' : '注册并登录'}
              </button>
              {vision.error && <p role="alert" className="form-error">{vision.error}</p>}
            </div>
          </>
        ) : (
          <>
            <div className="account-signed-in">
              <div>
                <strong>{vision.account.user.username}</strong>
                <p className="account-hint">
                  今天已用 {vision.quota?.used ?? 0} / {vision.quota?.limit ?? 3} 张
                  · 剩余 <strong>{vision.quota?.remaining ?? '—'}</strong> 张
                  {vision.quota?.day ? ` · ${vision.quota.day}（北京时间）` : ''}
                </p>
              </div>
              <button className="secondary-button" onClick={vision.signOut}><LogOut size={16} /> 退出</button>
            </div>
            <p className="account-hint">
              在另一台设备的浏览器里登录同一个账号，就能接着用同样的识图次数；
              但聊天、错题、计划仍保存在各自浏览器里，需要用下面的导出/导入搬运。
            </p>
          </>
        )}
        {vision.notice && <p role="status" className="form-ok"><Check size={14} /> {vision.notice}</p>}
      </section>

      <section className="account-card">
        <h2><Download size={18} /> 导出这台设备的数据</h2>
        <p className="account-hint">
          生成一个 JSON 文件，包含对话记录、错题本、学习计划和 AI 设置。
          在旧设备导出 → 传到新设备 → 在新设备导入。
        </p>
        <label className="check-row">
          <input type="checkbox" checked={includeImages} onChange={(event) => setIncludeImages(event.target.checked)} />
          <span>包含题目图片（文件会大很多，但导入后原图还在）</span>
        </label>
        <label className="check-row">
          <input type="checkbox" checked={includeApiKey} onChange={(event) => setIncludeApiKey(event.target.checked)} />
          <span>包含 API Key（<strong>只导入回自己的设备才勾选</strong>，发给别人等于泄露密钥）</span>
        </label>
        <p className="account-hint">预计文件大小约 {formatBytes(currentSize)}。</p>
        <button className="primary-button" onClick={exportNow}><Download size={16} /> 下载备份文件</button>
        {exportNotice && <p role="status" className="form-ok"><Check size={14} /> {exportNotice}</p>}
      </section>

      <section className="account-card">
        <h2><Upload size={18} /> 从备份导入到这台设备</h2>
        <p className="account-hint">选择之前导出的 <code>.json</code> 文件。导入前会先校验整个文件，不合格就完全不写入。</p>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="file-input"
          onChange={(event) => void pickFile(event.target.files?.[0])}
        />
        {importError && <p role="alert" className="form-error"><AlertTriangle size={14} /> {importError}</p>}

        {preview && (
          <div className="import-preview">
            <p className="import-title">这份备份包含：</p>
            <ul className="import-stats">
              <li>{preview.stats.messages} 条对话</li>
              <li>{preview.stats.mistakes} 道错题</li>
              <li>{preview.stats.tasks} 项任务</li>
              <li>{preview.stats.images} 张图片</li>
            </ul>
            <p className="account-hint">
              导出时间：{preview.exportedAt ? new Date(preview.exportedAt).toLocaleString() : '未记录'}
              {preview.account ? ` · 导出账号：${preview.account}` : ''}
              {preview.data.settings?.apiKey ? ' · 含 API Key' : ''}
            </p>
            <fieldset className="import-strategy">
              <legend>导入方式</legend>
              <label className="check-row">
                <input type="radio" name="strategy" checked={strategy === 'replace'} onChange={() => setStrategy('replace')} />
                <span><strong>替换</strong>：用备份完全覆盖这台设备的现有数据</span>
              </label>
              <label className="check-row">
                <input type="radio" name="strategy" checked={strategy === 'merge'} onChange={() => setStrategy('merge')} />
                <span><strong>合并</strong>：保留现有对话，错题与任务按编号去重后追加</span>
              </label>
            </fieldset>
            {strategy === 'replace' && (
              <p className="form-warn"><AlertTriangle size={14} /> 替换会清掉这台设备现在的对话和错题，建议先导出一份当前数据。</p>
            )}
            <div className="import-actions">
              <button className="primary-button" onClick={applyImport}>确认导入</button>
              <button className="secondary-button" onClick={() => { setPreview(null); if (fileInput.current) fileInput.current.value = '' }}>取消</button>
            </div>
          </div>
        )}
        {imported && <p role="status" className="form-ok"><Check size={14} /> {imported}</p>}
      </section>

      <section className="account-card muted-card">
        <h2>常见问题</h2>
        <dl className="faq">
          <dt>换电脑登录同一个账号，聊天记录会自动出现吗？</dt>
          <dd>不会。目前账号只用于云端识图计次，对话和错题都存在各自浏览器里，所以需要用导出/导入搬运。这样做的好处是数据不经过服务器，隐私更稳。</dd>
          <dt>导入会把识图次数也带过来吗？</dt>
          <dd>不会。次数按账号在服务端计算，跟这台设备的本地数据无关。</dd>
          <dt>导出文件丢了怎么办？</dt>
          <dd>没法恢复。建议每次大改学习计划后导出一份，存到网盘或自己的电脑。</dd>
        </dl>
      </section>
    </div>
  )
}
