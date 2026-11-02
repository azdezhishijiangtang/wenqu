import test from 'node:test'
import assert from 'node:assert/strict'
import {
  BACKUP_APP,
  BACKUP_VERSION,
  BackupError,
  backupFileName,
  buildBackup,
  mergeSnapshot,
  parseBackup,
  serializeBackup,
} from '../src/lib/backup.ts'

const settings = {
  baseUrl: 'https://api.deepseek.com/v1',
  model: 'deepseek-chat',
  apiKey: 'sk-secret-value',
  maxTokens: '2048',
  temperature: '0.7',
  reasoning: 'medium',
  extraBody: '{}',
}

const snapshot = {
  settings,
  messages: [
    { id: 'm1', role: 'user', content: '求导', images: ['data:image/jpeg;base64,AAA'] },
    { id: 'm2', role: 'assistant', content: '答案是 2x', reasoning: '过程', hintLevel: 3, mode: 'explain', subject: 'math' },
  ],
  subject: 'math',
  mode: 'explain',
  mistakes: [
    { id: 'k1', subject: 'physics', title: '受力分析', question: 'q', cause: '漏力', correction: '画全', mastered: true, createdAt: '2026-01-01T00:00:00.000Z' },
  ],
  tasks: [{ id: 't1', title: '刷题', subject: 'math', minutes: 30, dueDate: '2026-02-01', done: false }],
}

const roundTrip = (file) => parseBackup(serializeBackup(file))

test('导出默认不含 API Key，但保留其它设置', () => {
  const file = buildBackup(snapshot, { account: '小明', includeApiKey: false })
  assert.equal(file.app, BACKUP_APP)
  assert.equal(file.version, BACKUP_VERSION)
  assert.equal(file.account, '小明')
  assert.equal(file.data.settings.apiKey, '')
  assert.equal(file.data.settings.baseUrl, settings.baseUrl)
  assert.equal(JSON.stringify(file).includes('sk-secret-value'), false)
})

test('勾选后才写入 API Key，导出内容原样保留', () => {
  const file = buildBackup(snapshot, { includeApiKey: true })
  assert.equal(file.data.settings.apiKey, 'sk-secret-value')
  const back = roundTrip(file)
  assert.equal(back.data.settings.apiKey, 'sk-secret-value')
  assert.equal(back.data.messages.length, 2)
  assert.equal(back.data.mistakes[0].title, '受力分析')
  assert.equal(back.data.tasks[0].minutes, 30)
})

test('可以选择不导出图片，统计信息随之变化', () => {
  const withImages = buildBackup(snapshot, { includeImages: true })
  assert.equal(withImages.stats.images, 1)
  assert.ok(withImages.data.messages[0].images)

  const without = buildBackup(snapshot, { includeImages: false })
  assert.equal(without.stats.images, 0)
  assert.equal(without.data.messages[0].images, undefined)
  assert.equal(without.data.messages[0].content, '求导')
})

test('往返后聊天、错题、计划、科目与模式都还在', () => {
  const back = roundTrip(buildBackup(snapshot))
  assert.equal(back.data.subject, 'math')
  assert.equal(back.data.mode, 'explain')
  assert.equal(back.data.messages[1].reasoning, '过程')
  assert.equal(back.data.messages[1].hintLevel, 3)
  assert.equal(back.data.mistakes[0].mastered, true)
  assert.equal(back.data.tasks[0].done, false)
})

test('拒绝非本应用的 JSON、错误版本、坏 JSON 和空内容', () => {
  assert.throws(() => parseBackup(''), BackupError)
  assert.throws(() => parseBackup('不是 json'), /有效的 JSON/)
  assert.throws(() => parseBackup(JSON.stringify({ app: 'other', version: 1, data: {} })), /不是问渠/)
  assert.throws(() => parseBackup(JSON.stringify({ app: BACKUP_APP, version: 99, data: {} })), /版本/)
  assert.throws(() => parseBackup(JSON.stringify({ app: BACKUP_APP, version: 1 })), /没有数据/)
  assert.throws(() => parseBackup('[' + '1,'.repeat(10) + '1]'), /结构不正确/)
})

test('坏字段整体拒绝，不返回半份数据', () => {
  const base = buildBackup(snapshot)
  const badMessage = JSON.parse(JSON.stringify(base))
  badMessage.data.messages[0].role = 'system'
  assert.throws(() => parseBackup(JSON.stringify(badMessage)), /缺少角色/)

  const badMistake = JSON.parse(JSON.stringify(base))
  badMistake.data.mistakes[0].subject = 'history'
  assert.throws(() => parseBackup(JSON.stringify(badMistake)), /缺少科目/)

  const notList = JSON.parse(JSON.stringify(base))
  notList.data.tasks = { a: 1 }
  assert.throws(() => parseBackup(JSON.stringify(notList)), /不是列表/)
})

test('缺失的可选字段被安全补全，不会崩溃', () => {
  const minimal = {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    data: {
      messages: [{ role: 'user', content: 'hi' }],
    },
  }
  const back = parseBackup(JSON.stringify(minimal))
  assert.equal(back.data.settings, null)
  assert.equal(back.data.messages[0].id, 'imported-0')
  assert.equal(back.data.mistakes.length, 0)
  assert.equal(back.data.tasks.length, 0)
  assert.equal(back.account, null)
})

test('非图片的 images 内容在导入时被丢弃', () => {
  const file = buildBackup(snapshot)
  file.data.messages[0].images = ['https://evil.example/x.png', 'data:image/png;base64,OK']
  const back = roundTrip(file)
  assert.deepEqual(back.data.messages[0].images, ['data:image/png;base64,OK'])
})

test('替换策略完全覆盖，合并策略跳过重复并保留现有聊天', () => {
  const incoming = parseBackup(serializeBackup(buildBackup(snapshot))).data
  const current = {
    settings: null,
    messages: [{ id: 'old', role: 'user', content: '旧记录' }],
    subject: 'physics',
    mode: 'guide',
    mistakes: [{ id: 'k1', subject: 'physics', title: '已存在', question: '', cause: '', correction: '', mastered: false, createdAt: '' }],
    tasks: [],
  }
  const replaced = mergeSnapshot(current, incoming, 'replace')
  assert.equal(replaced.messages.length, 2)
  assert.equal(replaced.mistakes.length, 1)

  const merged = mergeSnapshot(current, incoming, 'merge')
  assert.equal(merged.messages[0].content, '旧记录')
  assert.equal(merged.mistakes.length, 1)
  assert.equal(merged.mistakes[0].title, '已存在')
  assert.equal(merged.tasks.length, 1)
  assert.equal(merged.settings.baseUrl, settings.baseUrl)
})

test('文件名带时间戳，便于区分多次备份', () => {
  const name = backupFileName(new Date(2026, 10, 2, 15, 4))
  assert.match(name, /^问渠备份-20261102-1504\.json$/)
})
