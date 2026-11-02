import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DAILY_USER_LIMIT,
  dayKey,
  formatEvidence,
  hashPassword,
  limitsFromEnv,
  parseImageList,
  parseQuestion,
  randomSalt,
  readQuota,
  releaseQuota,
  reserveQuota,
  safeEqual,
  signToken,
  validatePassword,
  validateUsername,
  verifyToken,
} from '../src/core.js'

/** 只实现 core.js 用到的那几条语句，用来验证配额语义。 */
function fakeDb() {
  const counts = new Map()
  const key = (user, day) => `${user}|${day}`
  return {
    counts,
    prepare(sql) {
      const statement = { args: [], bind(...args) { this.args = args; return this } }
      if (sql.startsWith('INSERT INTO usage')) {
        statement.run = async () => {
          const [user, day, amount, limit] = statement.args
          const current = counts.get(key(user, day)) ?? 0
          if (current + amount > limit) return { meta: { changes: 0 } }
          counts.set(key(user, day), current + amount)
          return { meta: { changes: 1 } }
        }
      } else if (sql.startsWith('SELECT count FROM usage')) {
        statement.first = async () => {
          const [user, day] = statement.args
          const value = counts.get(key(user, day))
          return value === undefined ? null : { count: value }
        }
      } else if (sql.startsWith('SELECT COALESCE(SUM')) {
        statement.first = async () => {
          const [day] = statement.args
          let total = 0
          for (const [entry, value] of counts) if (entry.endsWith(`|${day}`)) total += value
          return { total }
        }
      } else if (sql.startsWith('UPDATE usage SET count = MAX')) {
        statement.run = async () => {
          const [amount, user, day] = statement.args
          counts.set(key(user, day), Math.max(0, (counts.get(key(user, day)) ?? 0) - amount))
          return { meta: { changes: 1 } }
        }
      } else {
        throw new Error(`unexpected SQL: ${sql}`)
      }
      return statement
    },
  }
}

const limits = { userLimit: DAILY_USER_LIMIT, globalLimit: 60 }
const DAY = '2026-11-02'

test('每个账号每天最多识别 3 张，超出后拒绝并保持已用次数', async () => {
  const db = fakeDb()
  assert.equal((await reserveQuota(db, 'u1', DAY, 2, limits)).ok, true)
  assert.equal((await reserveQuota(db, 'u1', DAY, 1, limits)).ok, true)
  const blocked = await reserveQuota(db, 'u1', DAY, 1, limits)
  assert.equal(blocked.ok, false)
  assert.equal(blocked.reason, 'user')
  const quota = await readQuota(db, 'u1', DAY, limits)
  assert.equal(quota.used, 3)
  assert.equal(quota.remaining, 0)
})

test('一次上传超过上限的张数会被整体拒绝，不会部分扣次', async () => {
  const db = fakeDb()
  const result = await reserveQuota(db, 'u1', DAY, 4, limits)
  assert.equal(result.ok, false)
  assert.equal((await readQuota(db, 'u1', DAY, limits)).used, 0)
})

test('不同账号互相独立，跨天后额度重置', async () => {
  const db = fakeDb()
  await reserveQuota(db, 'u1', DAY, 3, limits)
  assert.equal((await reserveQuota(db, 'u2', DAY, 3, limits)).ok, true)
  const nextDay = await reserveQuota(db, 'u1', '2026-11-03', 3, limits)
  assert.equal(nextDay.ok, true)
  assert.equal(nextDay.quota.remaining, 0)
})

test('全站额度用尽时回滚本次占用，用户次数不被白白扣掉', async () => {
  const db = fakeDb()
  const tight = { userLimit: 3, globalLimit: 3 }
  assert.equal((await reserveQuota(db, 'u1', DAY, 3, tight)).ok, true)
  const blocked = await reserveQuota(db, 'u2', DAY, 2, tight)
  assert.equal(blocked.ok, false)
  assert.equal(blocked.reason, 'global')
  assert.equal((await readQuota(db, 'u2', DAY, tight)).used, 0)
  assert.equal(tight.globalLimit, 3)
})

test('识图失败后由 release 退回次数', async () => {
  const db = fakeDb()
  await reserveQuota(db, 'u1', DAY, 3, limits)
  await releaseQuota(db, 'u1', DAY, 3)
  const quota = await readQuota(db, 'u1', DAY, limits)
  assert.equal(quota.used, 0)
  assert.equal(quota.remaining, 3)
})

test('图片只接受内联 data URL，拒绝远程地址与超限', () => {
  const ok = parseImageList([`data:image/jpeg;base64,${Buffer.from('jpeg-bytes').toString('base64')}`])
  assert.equal(ok.length, 1)
  assert.equal(ok[0].mime, 'image/jpeg')
  assert.throws(() => parseImageList(['https://example.com/a.png']), /data URL/)
  assert.throws(() => parseImageList(['data:image/svg+xml;base64,PHN2Zz4=']), /JPEG/)
  assert.throws(() => parseImageList([]), /至少/)
  assert.throws(() => parseImageList(new Array(4).fill(ok[0].dataUrl)), /最多 3 张/)
})

test('问题文字被截断，不参与任何命令解释', () => {
  assert.equal(parseQuestion(undefined), '')
  assert.equal(parseQuestion('求 a 的值'), '求 a 的值')
  assert.equal(parseQuestion('x'.repeat(5000)).length, 2000)
  assert.throws(() => parseQuestion({ a: 1 }), /问题格式/)
})

test('密码哈希可复现，错误密码不匹配', async () => {
  const salt = randomSalt()
  const first = await hashPassword('goodpassword', salt, 'pepper')
  const again = await hashPassword('goodpassword', salt, 'pepper')
  const wrong = await hashPassword('goodpassword!', salt, 'pepper')
  assert.equal(first, again)
  assert.equal(safeEqual(first, wrong), false)
  assert.equal(safeEqual(first, first), true)
})

test('令牌签名可验证，篡改与过期都被拒绝', async () => {
  const now = Math.floor(Date.now() / 1000)
  const token = await signToken({ sub: 'u1', name: '小明', exp: now + 60 }, 'secret')
  assert.equal((await verifyToken(token, 'secret', now))?.name, '小明')
  assert.equal(await verifyToken(token, 'other-secret', now), null)
  assert.equal(await verifyToken(`${token}x`, 'secret', now), null)
  assert.equal(await verifyToken(token, 'secret', now + 120), null)
})

test('用户名与密码校验、按北京时间的自然日', () => {
  assert.equal(validateUsername('小明_2026'), '小明_2026')
  assert.equal(validateUsername('ab'), null)
  assert.equal(validateUsername('bad name'), null)
  assert.equal(validatePassword('1234567'), null)
  assert.equal(validatePassword('12345678'), '12345678')
  assert.equal(dayKey(new Date('2026-11-01T15:59:59Z')), '2026-11-01')
  assert.equal(dayKey(new Date('2026-11-01T16:00:00Z')), '2026-11-02')
})

test('环境变量可覆盖限额，非法值回落到默认', () => {
  assert.deepEqual(limitsFromEnv({}), { userLimit: 3, globalLimit: 60 })
  assert.deepEqual(limitsFromEnv({ DAILY_USER_LIMIT: '5', DAILY_GLOBAL_LIMIT: '120' }), { userLimit: 5, globalLimit: 120 })
  assert.deepEqual(limitsFromEnv({ DAILY_USER_LIMIT: '0', DAILY_GLOBAL_LIMIT: 'abc' }), { userLimit: 3, globalLimit: 60 })
})

test('识图结果统一包装，空结果给出明确提示', () => {
  const output = formatEvidence([{ response: ' 题干内容 ' }, { answer: '备用字段' }, {}])
  assert.match(output[0], /^【图片 1/)
  assert.match(output[0], /题干内容/)
  assert.match(output[1], /备用字段/)
  assert.match(output[2], /未返回可用的图像信息/)
})
