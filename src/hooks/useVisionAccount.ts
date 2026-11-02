import { useCallback, useState } from 'react'
import {
  VisionError,
  loadAccount,
  login as loginRequest,
  me as meRequest,
  register as registerRequest,
  saveAccount,
  type VisionAccount,
  type VisionQuota,
} from '../lib/visionApi'

/**
 * 识图账号状态。VisionBridge 与「账号与数据」页面共用，
 * 保证两个入口看到的登录态和剩余次数始终一致。
 */
export function useVisionAccount() {
  const [account, setAccount] = useState<VisionAccount | null>(() => loadAccount())
  const [quota, setQuota] = useState<VisionQuota | null>(() => loadAccount()?.quota ?? null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const applyQuota = useCallback((next: VisionQuota) => {
    setQuota(next)
    setAccount((current) => {
      if (!current) return current
      const updated = { ...current, quota: next }
      saveAccount(updated)
      return updated
    })
  }, [])

  /** 用已保存的令牌向服务端确认登录仍然有效，并取回最新额度。 */
  const refresh = useCallback(async () => {
    const saved = loadAccount()
    if (!saved) return
    try {
      const data = await meRequest(saved.token)
      setQuota(data.quota)
      const updated = { ...saved, quota: data.quota }
      saveAccount(updated)
      setAccount(updated)
    } catch (caught) {
      if (caught instanceof VisionError && caught.status === 401) {
        saveAccount(null)
        setAccount(null)
        setQuota(null)
        setNotice('登录已过期，请重新登录。')
      }
    }
  }, [])

  const submit = useCallback(async (mode: 'login' | 'register', username: string, password: string) => {
    setError('')
    setNotice('')
    if (!username.trim() || password.length < 8) {
      setError('用户名至少 3 位；密码至少 8 位。')
      return null
    }
    setBusy(true)
    try {
      const result = mode === 'login'
        ? await loginRequest(username.trim(), password)
        : await registerRequest(username.trim(), password)
      saveAccount(result)
      setAccount(result)
      setQuota(result.quota)
      setNotice(`已登录 ${result.user.username}，今天还可识别 ${result.quota.remaining} 张。`)
      return result
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '登录失败，请重试。')
      return null
    } finally {
      setBusy(false)
    }
  }, [])

  const signOut = useCallback(() => {
    saveAccount(null)
    setAccount(null)
    setQuota(null)
    setError('')
    setNotice('已退出识图账号。')
  }, [])

  return { account, quota, busy, error, notice, setError, setNotice, submit, signOut, refresh, applyQuota }
}
