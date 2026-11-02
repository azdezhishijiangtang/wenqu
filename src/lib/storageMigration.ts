const MIGRATION_KEY = 'wenqu-storage-migrated-v1'

const STORAGE_RENAMES = [
  ['zhihu-api-settings', 'wenqu-api-settings'],
  ['zhihu-chat-messages', 'wenqu-chat-messages'],
  ['zhihu-subject', 'wenqu-subject'],
  ['zhihu-mode', 'wenqu-mode'],
  ['zhihu-mistakes', 'wenqu-mistakes'],
  ['zhihu-tasks', 'wenqu-tasks'],
  ['zhihu-vision-account', 'wenqu-vision-account'],
] as const

/** 把改名前的浏览器数据迁移到问渠命名空间，避免改名清空用户数据。 */
export function migrateLegacyStorage(): void {
  if (typeof window === 'undefined') return

  try {
    if (window.localStorage.getItem(MIGRATION_KEY) === '1') return

    for (const [legacyKey, currentKey] of STORAGE_RENAMES) {
      const legacyValue = window.localStorage.getItem(legacyKey)
      if (legacyValue === null) continue

      // 新键已有数据时优先保留新数据，避免覆盖用户后来产生的内容。
      if (window.localStorage.getItem(currentKey) === null) {
        window.localStorage.setItem(currentKey, legacyValue)
      }
      window.localStorage.removeItem(legacyKey)
    }

    window.localStorage.setItem(MIGRATION_KEY, '1')
  } catch {
    // 隐私模式或存储空间不足时，保留旧数据并让应用继续工作。
  }
}
