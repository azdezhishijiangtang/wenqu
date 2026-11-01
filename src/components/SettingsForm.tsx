import {
  Activity,
  AlertTriangle,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  ShieldCheck,
  SquareTerminal,
  X,
} from 'lucide-react'
import { useRef, useState } from 'react'
import { testConnection } from '../lib/ai'
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
    model: 'deepseek-chat',
    hint: 'chat 为通用对话模型；reasoner 为深度推理模型，答题更强但更慢。',
  },
  {
    id: 'zhipu',
    name: '智谱 GLM',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-4.7',
    hint: '填你实际开通的模型名，如 glm-4.7、glm-4.7-thinking。',
  },
  {
    id: 'moonshot',
    name: 'Kimi',
    baseUrl: 'https://api.moonshot.cn/v1',
    model: 'moonshot-v1-32k',
    hint: '长题目、整卷拍照转文字后粘贴，用 32k 以上更稳。',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o',
    hint: '也可填 gpt-4o-mini；推理模型填 o 系列时建议把「推理强度」调高。',
  },
  {
    id: 'custom',
    name: '自定义',
    baseUrl: '',
    model: '',
    hint: '任意兼容 OpenAI Chat Completions 的服务：填完整地址（一般以 /v1 结尾）、模型名和密钥。',
  },
]

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
  const baseUrlRef = useRef<HTMLInputElement>(null)

  function patch(next: Partial<ApiSettings>) {
    setDraft((current) => ({ ...current, ...next }))
    setSaved(false)
    setTestResult(null)
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

  async function runTest() {
    setTesting(true)
    setTestResult(null)
    const result = await testConnection(draft)
    setTestResult(result)
    setTesting(false)
  }

  function handleSave() {
    onSave({
      ...draft,
      apiKey: draft.apiKey.trim(),
      baseUrl: draft.baseUrl.trim(),
      model: draft.model.trim(),
    })
    setSaved(true)
    window.setTimeout(onClose, 350)
  }

  const current = activePreset()

  return (
    <div className="settings-form">
      <div className="settings-note">
        <ShieldCheck size={17} />
        <p>
          密钥仅保存在当前浏览器的本地存储中，由浏览器直接发送给你填写的接口，不会经过任何中间服务器。
          共用设备请在使用后点「清除密钥」。
        </p>
      </div>

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

      <label className="field">
        <span>模型名称</span>
        <input
          type="text"
          value={draft.model}
          onChange={(event) => patch({ model: event.target.value })}
          placeholder="deepseek-chat"
          autoComplete="off"
          spellCheck={false}
        />
      </label>

      <label className="field">
        <span>API Key</span>
        <div className="secret-input">
          <KeyRound size={16} />
          <input
            type={showKey ? 'text' : 'password'}
            value={draft.apiKey}
            onChange={(event) => patch({ apiKey: event.target.value })}
            placeholder="sk-..."
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
                    { id: 'off', label: '不发送', hint: '兼容所有模型，DeepSeek 用模型名区分推理' },
                    { id: 'low', label: '低', hint: '' },
                    { id: 'medium', label: '中', hint: '' },
                    { id: 'high', label: '高', hint: 'o 系列 / GLM 思考模型的深度推理' },
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
