import { useEffect, useState } from 'react'
import { vault } from '../lib/byokVault'

/**
 * 持久化 hook（已加固）：
 * - 读取时把旧版明文密钥搬进内存保险库并立即覆写磁盘，杜绝历史残留；
 * - 写入时把任何非句柄的明文密钥替换成不可用于请求的句柄。
 */
export function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = window.localStorage.getItem(key)
      if (stored === null) return initialValue
      const parsed = JSON.parse(stored) as T
      if (parsed && typeof parsed === 'object') {
        const obj = parsed as Record<string, unknown>
        const legacy = obj.apiKey
        if (typeof legacy === 'string' && legacy.length > 0 && !vault.isHandle(legacy)) {
          // 升级迁移：旧版明文密钥 → 内存保险库，磁盘上立刻换成句柄
          vault.set('default', legacy)
          obj.apiKey = vault.handleFor('default')
          window.localStorage.setItem(key, JSON.stringify(parsed))
        }
      }
      return parsed
    } catch {
      return initialValue
    }
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(
        key,
        JSON.stringify(value, (field, val) => {
          if (
            field === 'apiKey' &&
            typeof val === 'string' &&
            val.length > 0 &&
            !vault.isHandle(val)
          ) {
            return vault.handleFor('default')
          }
          return val
        }),
      )
    } catch {
      // 隐私模式下 localStorage 可能不可写，应用仍可在内存中运行
    }
  }, [key, value])

  return [value, setValue] as const
}
