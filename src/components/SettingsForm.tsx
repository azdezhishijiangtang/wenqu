import {
  Activity,
  AlertTriangle,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  SquareTerminal,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { testConnection } from '../lib/ai'
import { vault } from '../lib/byokVault'
import {
  describeCatalogAge,
  getCatalog,
  retiredModelHint,
  type CatalogEntry,
} from '../lib/modelCatalog'
import type { TestResult } from '../lib/ai'
import type { ApiSettings } from '../types'

interface SettingsModalProps {
  settings: ApiSettings
  onSave: (settings: ApiSettings) => void
  onClose: () => void
}

type PresetId = 'deepseek' | 'zhipu' | 'moonshot' | 'openai' | 'custom'

const presets: {
  id: PresetId
  name: string
  baseUrl: string
  model: string
  hint: string
}[] = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-flash',
    hint: '模型名单随服务商更新，点下方「获取可用模型」即可拉取当前列表。',
  },
  {
    id: 'zhipu',
    name: '智谱 GLM',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-5.3',
    hint: '以当前账号实际开通的模型为准，可自动获取列表。',
  },
  {
    id: 'moonshot',
    name: 'Kimi',
    baseUrl: 'https://api.moonshot.cn/v1',
    model: 'kimi-k3',
    hint: '以当前账号实际可用的模型为准，可自动获取列表。',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-5.6-luna',
    hint: '以当前账号实际可用的模型为准，可自动获取列表。',
  },
  {
    id: 'custom',
    name: '自定义',
    baseUrl: '',
    model: '',
    hint: '任意兼容 OpenAI Chat Completions 的服务：填完整地址（一般以 /v1 结尾）和密钥，再点「获取可用模型」；不支持时手动填写模型名。',
  },
]

const emptyCatalog = (): CatalogEntry => ({
  models: [],
  source: 'builtin',
  fetchedAt: 0,
})

/**
 * 把「输入框里的明文 / 句柄 / 已保存配置」统一解析成保险库句柄。
 * 组件层始终只持有句柄，明文密钥不会进入任何状态或缓存。
 */
function resolveKeyHandle(draft: ApiSettings, settings: ApiSettings): string | null {
  const typed = draft.apiKey.trim()
  if (typed && !vault.isHandle(typed)) {
    vault.set('default', typed)
    return vault.handleFor('default')
  }
  if (typed) return typed
  const saved = settings.apiKey.trim()
  if (saved && vault.has(saved)) return saved
  return null
}

export function SettingsForm({ settings, onSave, onClose }: SettingsModalProps) {
  const [draft, setDraft] = useState<ApiSettings>(settings)
  const [showKey, setShowKey] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(
    Boolean(settings.temperature || settings.maxTokens || settings.extraBody) ||
      settings.reasoning !== 'off',
  )
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const [catalog, setCatalog] = useState<CatalogEntry>(emptyCatalog)
  const [loadingModels, setLoadingModels] = useState(false)
  const [modelError, setModelError] = useState<string | null>(null)
  const [manualModel, setManualModel] = useState(false)
  const baseUrlRef = useRef<HTMLInputElement>(null)
  const vaultHostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!vaultHostRef.current) return
    return vault.mountVaultControls(vaultHostRef.current)
  }, [])

  /** 接口地址或密钥变化后，防抖自动拉取该服务商最新模型目录（静默，不打扰用户） */
  useEffect(() => {
    const base = draft.baseUrl.trim()
    if (!base) return
    const handle = resolveKeyHandle(draft, settings)
    if (!handle || !vault.has(handle)) return
    const keyHandle = handle
    const timer = window.setTimeout(() => {
      void getCatalog(base, keyHandle)
        .then((entry) => {
          setCatalog(entry)
          if (entry.models.length > 0) setManualModel(false)
        })
        .catch(() => {
          /* 自动拉取静默失败：内置目录兜底，手动刷新时再给出原因 */
        })
    }, 700)
    return () => window.clearTimeout(timer)
  }, [draft.baseUrl, draft.apiKey, settings.apiKey])

  function patch(next: Partial<ApiSettings>) {
    setDraft((current) => ({ ...current, ...next }))
    setSaved(false)
    setTestResult(null)
    if (next.baseUrl !== undefined || next.apiKey !== undefined) {
      setCatalog(emptyCatalog())
      setModelError(null)
    }
  }

  function activePreset(): PresetId {
    const match = presets.find(
      (preset) =>
        preset.baseUrl !== '' &&
        draft.baseUrl.trim().replace(/\/+$/, '') === preset.baseUrl,
    )
    return match ? match.id : 'custom'
  }

  function applyPreset(id: PresetId) {
    const preset = presets.find((item) => item.id === id)
    if (!preset) return
    patch({ baseUrl: preset.baseUrl, model: preset.model })
    if (id === 'custom') {
      patch({ baseUrl: '', model: '' })
      window.setTimeout(() => baseUrlRef.current?.focus(), 30)
    }
  }

  /** 手动刷新（force）或首次获取模型列表 */
  async function loadModels(force = false) {
    const handle = resolveKeyHandle(draft, settings)
    if (!handle) {
      setModelError('请先填写 API Key，或重新输入 / 解锁后再获取模型列表。')
      return
    }
    if (!vault.has(handle)) {
      setModelError('密钥已锁定，请重新输入 API Key 或输入解锁口令。')
      return
    }
    if (!draft.baseUrl.trim()) {
      setModelError('请先填写 API 地址。')
      return
    }
    setLoadingModels(true)
    setModelError(null)
    try {
      const entry = await getCatalog(draft.baseUrl.trim(), handle, { force })
      setCatalog(entry)
      if (entry.models.length > 0) setManualModel(false)
    } catch (error) {
      setModelError(error instanceof Error ? error.message : '获取模型列表失败')
    } finally {
      setLoadingModels(false)
    }
  }

  async function runTest() {
    const typed = draft.apiKey.trim()
    if (typed && !vault.isHandle(typed)) vault.set('default', typed)
    const probe = {
      ...draft,
      apiKey: typed ? (vault.isHandle(typed) ? typed : vault.handleFor('default')) : settings.apiKey,
    }
    setTesting(true)
    setTestResult(null)
    const result = await testConnection(probe)
    setTestResult(result)
    setTesting(false)
  }

  function handleSave() {
    const typed = draft.apiKey.trim()
    let handle = settings.apiKey
    if (typed && !vault.isHandle(typed)) {
      vault.set('default', typed)
      handle = vault.handleFor('default')
    }
    onSave({
      ...draft,
      apiKey: handle,
      baseUrl: draft.baseUrl.trim(),
      model: draft.model.trim(),
    })
    setSaved(true)
    window.setTimeout(onClose, 350)
  }

  const current = activePreset()
  const canFetchModels =
    Boolean(draft.baseUrl.trim()) &&
    (Boolean(draft.apiKey.trim()) ||
      Boolean(settings.apiKey.trim() && vault.has(settings.apiKey)))

  return (
    <div className="settings-form">
      <div className="settings-note">
        <ShieldCheck size={17} />
        <p>
          <strong>密钥默认不写入磁盘</strong>：只存在于当前页面的内存中，刷新或关闭即消失。
          浏览器仍会直连你填写的接口，不经过任何中间服务器。若希望刷新后免于重输，可在下方设置口令，把密钥加密暂存于本标签页（关闭标签页即失效）。
          建议使用「额度受限、可随时撤销」的专用子密钥，不要填主账号密钥。
        </p>
      </div>
      <div ref={vaultHostRef} />

      <div className="field">
        <span>服务商预设</span>
        <div className="preset-row">
          {presets.map((preset) => (
            <button
              type="button"
              key={preset.id}
              className={`preset-chip${current === preset.id ? ' active' : ''}`}
              onClick={() => applyPreset(preset.id)}
            >
              {preset.name}
              {current === preset.id && <Check size={13} />}
            </button>
          ))}
        </div>
        <small>{presets.find((preset) => preset.id === current)?.hint}</small>
      </div>

      <label className="field">
        <span>API 地址</span>
        <input
          ref={baseUrlRef}
          type="url"
          value={draft.baseUrl}
          onChange={(event) => patch({ baseUrl: event.target.value })}
          placeholder="https://api.example.com/v1"
          autoComplete="off"
          spellCheck={false}
        />
        <small>兼容 OpenAI Chat Completions。填到 /v1 即可，本站会自动补全 /chat/completions。</small>
      </label>

      <div className="field">
        <div className="model-field-head">
          <span>模型名称</span>
          <button
            type="button"
            className="model-refresh"
            onClick={() => void loadModels(true)}
            disabled={loadingModels || !canFetchModels}
          >
            <RefreshCw size={11} className={loadingModels ? 'spin' : undefined} />
            {loadingModels ? '正在获取…' : '获取可用模型'}
          </button>
        </div>

        {catalog.models.length > 0 && !manualModel ? (
          <select
            value={draft.model}
            onChange={(event) => patch({ model: event.target.value })}
            aria-label="当前可用模型"
          >
            {!draft.model && <option value="">请选择模型</option>}
            {draft.model && !catalog.models.includes(draft.model) && (
              <option value={draft.model}>{draft.model}（当前）</option>
            )}
            {catalog.models.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            value={draft.model}
            onChange={(event) => patch({ model: event.target.value })}
            placeholder="填模型名，或点上方按钮自动获取"
            autoComplete="off"
            spellCheck={false}
          />
        )}

        <div className="catalog-meta">
          {modelError ? (
            <small className="catalog-error">{modelError}</small>
          ) : catalog.models.length > 0 ? (
            <small>
              {catalog.source === 'remote'
                ? `服务商实时列表 · ${catalog.models.length} 个模型 · 更新于 ${describeCatalogAge(catalog.fetchedAt)}${catalog.stale ? '（已过期，建议刷新）' : ''}`
                : `内置参考列表 · ${catalog.models.length} 个模型（实时拉取失败，可手动输入）`}
            </small>
          ) : (
            <small>
              {loadingModels
                ? '正在从服务商获取最新模型列表…'
                : '填入接口地址与密钥后自动列出当前可用模型；服务商不支持时仍可手动填写。'}
            </small>
          )}
          {catalog.models.length > 0 && (
            <button
              type="button"
              className="catalog-toggle"
              onClick={() => setManualModel((value) => !value)}
            >
              {manualModel ? '返回列表选择' : '手动输入'}
            </button>
          )}
        </div>

        {retiredModelHint(draft.model) && (
          <small className="catalog-retired">
            模型 {draft.model} 已退役或更名，建议改用：{retiredModelHint(draft.model)}
          </small>
        )}
      </div>

      <label className="field">
        <span>API Key</span>
        <div className="secret-input">
          <KeyRound size={16} />
          <input
            type={showKey ? 'text' : 'password'}
            value={vault.isHandle(draft.apiKey) ? '' : draft.apiKey}
            onChange={(event) => patch({ apiKey: event.target.value })}
            placeholder={settings.apiKey ? '已配置 · 留空保持不变，或粘贴新密钥替换' : 'sk-…'}
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            className="reveal-button"
            onClick={() => setShowKey((value) => !value)}
            aria-label={showKey ? '隐藏密钥' : '显示密钥'}
          >
            {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </label>

      <button
        type="button"
        className="test-button"
        onClick={runTest}
        disabled={testing || !draft.apiKey.trim() || !draft.baseUrl.trim()}
      >
        {testing ? <LoaderCircle size={15} className="spin" /> : <Activity size={15} />}
        {testing ? '正在测试…' : '测试连接'}
      </button>

      {testResult && (
        <div
          className={`test-result ${testResult.ok ? 'ok' : 'fail'}`}
          role="status"
        >
          {testResult.ok ? <Check size={14} /> : <AlertTriangle size={14} />}
          <div>
            <p>{testResult.message}</p>
            {testResult.reply && <small>模型回复：{testResult.reply}</small>}
          </div>
        </div>
      )}

      <div className="advanced-section">
        <button
          type="button"
          className="advanced-toggle"
          onClick={() => setShowAdvanced((value) => !value)}
          aria-expanded={showAdvanced}
        >
          <SquareTerminal size={15} />
          高级参数
          <small>不设限，把模型的完整能力交给接口</small>
          <ChevronDown size={15} className={showAdvanced ? 'open' : ''} />
        </button>

        {showAdvanced && (
          <div className="advanced-body">
            <div className="advanced-grid">
              <label className="field">
                <span>最大输出 tokens</span>
                <input
                  type="number"
                  min={0}
                  value={draft.maxTokens}
                  onChange={(event) => patch({ maxTokens: event.target.value })}
                  placeholder="默认 · 不限制"
                />
                <small>留空交给服务商；推理模型建议 8192 以上，避免答案被截断。</small>
              </label>
              <label className="field">
                <span>温度 temperature</span>
                <input
                  type="number"
                  step="0.1"
                  min={0}
                  max={2}
                  value={draft.temperature}
                  onChange={(event) => patch({ temperature: event.target.value })}
                  placeholder="默认 · 使用模型推荐值"
                />
                <small>理科答疑保持默认即可；想更发散可到 0.7。</small>
              </label>
            </div>

            <div className="field">
              <span>推理强度</span>
              <div className="reasoning-row">
                {(
                  [
                    { id: 'off', label: '不发送', hint: '兼容所有模型，不额外发送推理参数' },
                    { id: 'low', label: '低', hint: '' },
                    { id: 'medium', label: '中', hint: '' },
                    { id: 'high', label: '高', hint: '需要更多推理预算时选用，以模型实际支持为准' },
                  ] as const
                ).map((option) => (
                  <button
                    type="button"
                    key={option.id}
                    className={`preset-chip${draft.reasoning === option.id ? ' active' : ''}`}
                    title={option.hint ?? ''}
                    onClick={() => patch({ reasoning: option.id })}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <small>
                以 reasoning_effort 字段发送；所选模型不支持时会在测试连接里提示，删掉即可。
              </small>
            </div>

            <label className="field">
              <span>额外请求体（JSON）</span>
              <textarea
                value={draft.extraBody}
                onChange={(event) => patch({ extraBody: event.target.value })}
                placeholder='例如：{"top_p": 0.95, "enable_thinking": true}'
                rows={3}
                spellCheck={false}
              />
              <small>
                深度合并进请求体，用于网关或私有部署的特殊参数。JSON 不合法时保存会提示。
              </small>
            </label>
          </div>
        )}
      </div>

      <div className="settings-actions">
        {settings.apiKey && (
          <button
            type="button"
            className="text-button danger"
            onClick={() => {
              vault.purge()
              patch({ apiKey: '' })
              onSave({ ...settings, apiKey: '' })
            }}
          >
            <X size={15} /> 清除密钥
          </button>
        )}
        <button type="button" className="primary-button" onClick={handleSave}>
          {saved ? <Check size={16} /> : null}
          {saved ? '已保存' : '保存设置'}
        </button>
      </div>
    </div>
  )
}
