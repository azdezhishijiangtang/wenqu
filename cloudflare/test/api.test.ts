import test from 'node:test'
import assert from 'node:assert/strict'
import worker from '../src/index.ts'

/** 覆盖 index.ts 与 core.js 实际用到的全部语句。 */
function fakeDb() {
  const users = new Map()
  const counts = new Map()
  const key = (user, day) => `${user}|${day}`
  return {
    users,
    counts,
    prepare(sql) {
      const stmt = { args: [], bind(...args) { this.args = args; return this } }
      if (sql.startsWith('INSERT INTO users')) {
        stmt.run = async () => {
          const [id, username, hash, salt] = stmt.args
          if ([...users.values()].some((u) => u.username === username)) throw new Error('duplicate')
          users.set(id, { id, username, password_hash: hash, salt })
          return { meta: { changes: 1 } }
        }
      } else if (sql.startsWith('SELECT id, username, password_hash')) {
        stmt.first = async () => [...users.values()].find((u) => u.username === stmt.args[0]) ?? null
      } else if (sql.startsWith('INSERT INTO usage')) {
        stmt.run = async () => {
          const [user, day, amount, limit] = stmt.args
          const current = counts.get(key(user, day)) ?? 0
          if (current + amount > limit) return { meta: { changes: 0 } }
          counts.set(key(user, day), current + amount)
          return { meta: { changes: 1 } }
        }
      } else if (sql.startsWith('SELECT count FROM usage')) {
        stmt.first = async () => {
          const value = counts.get(key(stmt.args[0], stmt.args[1]))
          return value === undefined ? null : { count: value }
        }
      } else if (sql.startsWith('SELECT COALESCE(SUM')) {
        stmt.first = async () => {
          let total = 0
          for (const [entry, value] of counts) if (entry.endsWith(`|${stmt.args[0]}`)) total += value
          return { total }
        }
      } else if (sql.startsWith('UPDATE usage SET count = MAX')) {
        stmt.run = async () => {
          const [amount, user, day] = stmt.args
          counts.set(key(user, day), Math.max(0, (counts.get(key(user, day)) ?? 0) - amount))
          return { meta: { changes: 1 } }
        }
      } else {
        throw new Error(`unexpected SQL: ${sql}`)
      }
      return stmt
    },
  }
}

function makeEnv({ ai, overrides = {} } = {}) {
  let calls = 0
  return {
    env: {
      DB: fakeDb(),
      AUTH_SECRET: 'test-secret',
      AI: {
        run: async () => {
          calls += 1
          return ai ? ai() : { answer: '横轴为 t/s，曲线单调递增。' }
        },
      },
      DAILY_USER_LIMIT: '3',
      DAILY_GLOBAL_LIMIT: '60',
      ...overrides,
    },
    aiCalls: () => calls,
  }
}

const ORIGIN = 'https://azdezhishijiangtang.github.io'
const image = `data:image/jpeg;base64,${Buffer.from('fake-jpeg-bytes').toString('base64')}`

function call(env, path, { method = 'GET', token, body } = {}) {
  const headers = { Origin: ORIGIN }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`
  return worker.fetch(
    new Request(`https://vision.example.com${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    env,
  )
}

async function signUp(env, username = '小明同学', password = 'goodpassword') {
  const response = await call(env, '/api/auth/register', { method: 'POST', body: { username, password } })
  return { response, data: await response.json() }
}

test('注册后可识图，并且返回更新后的剩余次数', async () => {
  const { env, aiCalls } = makeEnv()
  const { response, data } = await signUp(env)
  assert.equal(response.status, 200)
  assert.equal(data.quota.remaining, 3)
  assert.equal(response.headers.get('access-control-allow-origin'), ORIGIN)

  const read = await call(env, '/api/vision/read', {
    method: 'POST',
    token: data.token,
    body: { images: [image], question: '求第 3 秒的速度' },
  })
  const body = await read.json()
  assert.equal(read.status, 200)
  assert.equal(body.evidence.length, 1)
  assert.match(body.evidence[0], /须核对/)
  assert.equal(body.quota.used, 1)
  assert.equal(body.quota.remaining, 2)
  assert.equal(aiCalls(), 1)
})

test('同一账号第 4 张被拒绝，且不会调用模型', async () => {
  const { env, aiCalls } = makeEnv()
  const { data } = await signUp(env)
  for (let i = 0; i < 3; i += 1) {
    const ok = await call(env, '/api/vision/read', { method: 'POST', token: data.token, body: { images: [image] } })
    assert.equal(ok.status, 200)
  }
  const blocked = await call(env, '/api/vision/read', { method: 'POST', token: data.token, body: { images: [image] } })
  const body = await blocked.json()
  assert.equal(blocked.status, 429)
  assert.match(body.error, /每天可识别 3 张/)
  assert.equal(body.quota.remaining, 0)
  assert.equal(aiCalls(), 3)
})

test('两个账号各自有独立额度', async () => {
  const { env } = makeEnv()
  const first = await signUp(env, '甲同学')
  const second = await signUp(env, '乙同学')
  await call(env, '/api/vision/read', { method: 'POST', token: first.data.token, body: { images: [image, image, image] } })
  const other = await call(env, '/api/vision/read', { method: 'POST', token: second.data.token, body: { images: [image] } })
  assert.equal(other.status, 200)
  const broken = await call(env, '/api/vision/read', { method: 'POST', token: first.data.token, body: { images: [image] } })
  assert.equal(broken.status, 429)
})

test('识图服务出错时退回次数', async () => {
  let fail = true
  const { env } = makeEnv({ ai: () => { if (fail) throw new Error('model down'); return { answer: 'ok' } } })
  const { data } = await signUp(env)
  const failed = await call(env, '/api/vision/read', { method: 'POST', token: data.token, body: { images: [image, image] } })
  const body = await failed.json()
  assert.equal(failed.status, 502)
  assert.equal(body.quota.used, 0)
  assert.equal(body.quota.remaining, 3)

  fail = false
  const retry = await call(env, '/api/vision/read', { method: 'POST', token: data.token, body: { images: [image, image] } })
  assert.equal(retry.status, 200)
})

test('未登录、远程图片、非法来源与错误密码都被拦下', async () => {
  const { env } = makeEnv()
  const anonymous = await call(env, '/api/vision/read', { method: 'POST', body: { images: [image] } })
  assert.equal(anonymous.status, 401)

  const { data } = await signUp(env)
  const remote = await call(env, '/api/vision/read', {
    method: 'POST',
    token: data.token,
    body: { images: ['https://example.com/a.png'] },
  })
  assert.equal(remote.status, 400)

  const evil = await worker.fetch(
    new Request('https://vision.example.com/api/auth/me', { headers: { Origin: 'https://evil.example' } }),
    env,
  )
  assert.equal(evil.status, 403)

  const bad = await call(env, '/api/auth/login', { method: 'POST', body: { username: '小明同学', password: 'wrongpassword' } })
  assert.equal(bad.status, 401)
  const good = await call(env, '/api/auth/login', { method: 'POST', body: { username: '小明同学', password: 'goodpassword' } })
  assert.equal(good.status, 200)
})

test('重名注册被拒绝，登录令牌可用于查询额度', async () => {
  const { env } = makeEnv()
  const first = await signUp(env)
  const again = await call(env, '/api/auth/register', { method: 'POST', body: { username: '小明同学', password: 'goodpassword' } })
  assert.equal(again.status, 409)

  const me = await call(env, '/api/auth/me', { token: first.data.token })
  const body = await me.json()
  assert.equal(me.status, 200)
  assert.equal(body.user.username, '小明同学')
  assert.equal(body.quota.remaining, 3)
})
