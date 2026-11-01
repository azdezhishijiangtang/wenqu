import { Check, Eye, EyeOff, KeyRound, ShieldCheck, X } from 'lucide-react'
import { useState } from 'react'
import type { ApiSettings } from '../types'

interface SettingsModalProps {
  settings: ApiSettings
  onSave: (settings: ApiSettings) => void
  onClose: () => void
}

const presets = [
  { name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  { name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  { name: '自定义', baseUrl: '', model: '' },
]

export function SettingsForm({
  settings,
  onSave,
  onClose,
}: SettingsModalProps) {
  const [draft, setDraft] = useState(settings)
  const [showKey, setShowKey] = useState(false)
  const [saved, setSaved] = useState(false)

  function handleSave() {
    onSave({
      apiKey: draft.apiKey.trim(),
      baseUrl: draft.baseUrl.trim(),
      model: draft.model.trim(),
    })
    setSaved(true)
    window.setTimeout(onClose, 350)
  }

  function applyPreset(name: string) {
    const preset = presets.find((item) => item.name === name)
    if (!preset) return
    setDraft((current) => ({
      ...current,
      baseUrl: preset.baseUrl || current.baseUrl,
      model: preset.model || current.model,
    }))
  }

  return (
    <div className="settings-form">
      <div className="settings-note">
        <ShieldCheck size={17} />
        <p>
          密钥仅保存在当前浏览器的本地存储中，由浏览器直接发送给你填写的接口，不会上传到本站服务器。
          共用设备请在使用后清除密钥。
        </p>
      </div>

      <label className="field">
        <span>API 服务商</span>
        <div className="preset-row">
          {presets.map((preset) => {
            const active =
              preset.baseUrl !== '' && draft.baseUrl.startsWith(preset.baseUrl)
            return (
              <button
                type="button"
                key={preset.name}
                className={`preset-chip${active ? ' active' : ''}`}
                onClick={() => applyPreset(preset.name)}
              >
                {preset.name}
                {active && <Check size={13} />}
              </button>
            )
          })}
        </div>
      </label>

      <label className="field">
        <span>API 地址</span>
        <input
          type="url"
          value={draft.baseUrl}
          onChange={(event) =>
            setDraft({ ...draft, baseUrl: event.target.value })
          }
          placeholder="https://api.example.com/v1"
          autoComplete="off"
        />
        <small>兼容 OpenAI Chat Completions。填写 /v1 或完整地址均可。</small>
      </label>

      <label className="field">
        <span>模型名称</span>
        <input
          type="text"
          value={draft.model}
          onChange={(event) => setDraft({ ...draft, model: event.target.value })}
          placeholder="deepseek-chat"
          autoComplete="off"
        />
      </label>

      <label className="field">
        <span>API Key</span>
        <div className="secret-input">
          <KeyRound size={16} />
          <input
            type={showKey ? 'text' : 'password'}
            value={draft.apiKey}
            onChange={(event) =>
              setDraft({ ...draft, apiKey: event.target.value })
            }
            placeholder="sk-..."
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            className="reveal-button"
            onClick={() => setShowKey((current) => !current)}
            aria-label={showKey ? '隐藏密钥' : '显示密钥'}
          >
            {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </label>

      <div className="settings-actions">
        {settings.apiKey && (
          <button
            type="button"
            className="text-button danger"
            onClick={() => {
              setDraft({ ...draft, apiKey: '' })
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
