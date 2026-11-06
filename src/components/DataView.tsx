import { useMemo, useRef, useState } from 'react'
import { AlertTriangle, Check, Download, Upload } from 'lucide-react'
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

/**
 * 数据与备份：本站是纯前端应用，所有数据只存在这台设备的浏览器里。
 * 提供 JSON 导出 / 导入，用于换设备或清理浏览器数据前搬运。
 */
export function DataView({ snapshot, onImport, onOpenGuide }: Props) {
  const includeApiKey = false // 安全策略：备份永远不含密钥，导出选项已强制禁用
  const [includeImages, setIncludeImages] = useState(false)
  const [exportNotice, setExportNotice] = useState('')

  const fileInput = useRef<HTMLInputElement | null>(null)
  const [preview, setPreview] = useState<BackupFile | null>(null)
  const [strategy, setStrategy] = useState<ImportStrategy>('replace')
  const [importError, setImportError] = useState('')
  const [imported, setImported] = useState('')

  const currentSize = useMemo(
    () => new TextEncoder().encode(serializeBackup(buildBackup(snapshot, {
      includeApiKey,
      includeImages,
    }))).length,
    [snapshot, includeApiKey, includeImages],
  )

  function exportNow() {
    const file = buildBackup(snapshot, { includeApiKey, includeImages })
    const text = serializeBackup(file)
    downloadText(backupFileName(), text)
    setExportNotice(
      `已导出 ${file.stats.messages} 条对话、${file.stats.mistakes} 道错题、${file.stats.tasks} 项任务`
      + `${includeImages ? `、${file.stats.images} 张图片` : '（不含图片）'}`
      + '，不含 API Key（安全策略已强制移除导出密钥选项）。',
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
          <p className="eyebrow">数据与备份</p>
          <h1>把学习数据带在身边</h1>
          <p className="page-sub">
            本站是纯前端应用，对话、错题和计划只存在这台设备的浏览器里，没有服务器替你保管。
            换设备或清理浏览器数据前，请导出一份 JSON 备份。
            第一次读不懂的地方，可以先看 <button type="button" className="inline-link" onClick={onOpenGuide}>使用说明</button>。
          </p>
        </div>
      </header>

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
        <label className="check-row" style={{ opacity: 0.6 }}>
          <input type="checkbox" checked={false} disabled />
          <span>包含 API Key（<strong>已由安全策略强制禁用</strong>：密钥不再写入磁盘，备份一律不含密钥）</span>
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
          <dt>换电脑后聊天记录会自动出现吗？</dt>
          <dd>不会。本站没有服务器也不设账号，对话、错题和计划都存在各自浏览器里，需要用导出/导入搬运。好处是数据不经过任何服务器。</dd>
          <dt>导出文件丢了怎么办？</dt>
          <dd>没法恢复。建议每次大改学习计划后导出一份，存到网盘或自己的电脑。</dd>
        </dl>
      </section>
    </div>
  )
}
