import assert from 'node:assert/strict'
import test from 'node:test'
import { migrateLegacyStorage } from '../src/lib/storageMigration.ts'

/** 最小可用的 localStorage 假实现，够验证迁移逻辑。 */
function fakeWindow(initial: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(initial))
  const localStorage = {
    getItem: (key: string) => (store.has(key) ? (store.get(key) as string) : null),
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
    removeItem: (key: string) => {
      store.delete(key)
    },
  }
  return { window: { localStorage }, store }
}

function withWindow<T>(win: unknown, run: () => T): T {
  const scope = globalThis as { window?: unknown }
  const previous = scope.window
  scope.window = win
  try {
    return run()
  } finally {
    scope.window = previous
  }
}

test('把旧键的数据搬到问渠的键，并清掉旧键', () => {
  const { window, store } = fakeWindow({
    'zhihu-chat-messages': '[{"role":"user"}]',
    'zhihu-mistakes': '[{"id":"m1"}]',
    'zhihu-unrelated': 'keep-me',
  })

  withWindow(window, migrateLegacyStorage)

  assert.equal(store.get('wenqu-chat-messages'), '[{"role":"user"}]')
  assert.equal(store.get('wenqu-mistakes'), '[{"id":"m1"}]')
  assert.equal(store.has('zhihu-chat-messages'), false)
  assert.equal(store.has('zhihu-mistakes'), false)
  // 不认识的旧键原样保留，不做破坏性清理。
  assert.equal(store.get('zhihu-unrelated'), 'keep-me')
})

test('新键已有数据时不被旧数据覆盖', () => {
  const { window, store } = fakeWindow({
    'zhihu-subject': '"physics"',
    'wenqu-subject': '"chemistry"',
  })

  withWindow(window, migrateLegacyStorage)

  assert.equal(store.get('wenqu-subject'), '"chemistry"')
  assert.equal(store.has('zhihu-subject'), false)
})

test('迁移只跑一次，之后新写入的旧键不会再被搬动', () => {
  const { window, store } = fakeWindow({ 'zhihu-mode': '"exam"' })

  withWindow(window, migrateLegacyStorage)
  assert.equal(store.get('wenqu-mode'), '"exam"')
  assert.equal(store.get('wenqu-storage-migrated-v1'), '1')

  store.set('zhihu-mode', '"guide"')
  withWindow(window, migrateLegacyStorage)
  assert.equal(store.get('wenqu-mode'), '"exam"')
  assert.equal(store.has('zhihu-mode'), true)
})

test('存储不可用时静默失败，不抛错', () => {
  const broken = {
    localStorage: {
      getItem() {
        throw new Error('SecurityError')
      },
      setItem() {
        throw new Error('SecurityError')
      },
      removeItem() {
        throw new Error('SecurityError')
      },
    },
  }

  assert.doesNotThrow(() => withWindow(broken, migrateLegacyStorage))
})

test('没有 window 时（服务端渲染 / 测试环境）直接返回', () => {
  assert.doesNotThrow(() => migrateLegacyStorage())
})
