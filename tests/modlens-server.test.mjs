import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createModlensServer } from '../scripts/modlens-server.mjs'

const image = `data:image/png;base64,${Buffer.from('fake-png').toString('base64')}`

async function withServer(executor, fn, distDir) {
  const app = createModlensServer({ executor, port: 0, distDir: distDir || path.join(os.tmpdir(), 'modlens-test-missing') })
  const address = await app.start()
  const base = `http://127.0.0.1:${address.port}`
  try { return await fn(base) } finally { await app.stop() }
}

test('status reports unavailable engine without exposing executor stderr', async () => {
  const calls = []
  const result = await withServer(async (_cli, args) => {
    calls.push(args)
    throw new Error('agy: not found; SECRET_TOKEN=do-not-leak')
  }, async base => {
    const response = await fetch(`${base}/api/modlens/status`)
    return { response, body: await response.json() }
  })
  assert.equal(result.response.status, 200)
  assert.deepEqual(result.body, { available: false, message: 'Antigravity CLI (agy) is not installed.', provider: 'antigravity-cli' })
  assert.deepEqual(calls[0], ['doctor', '--json'])
  assert.equal(JSON.stringify(result.body).includes('SECRET_TOKEN'), false)
})

test('read uses fixed antigravity provider args and returns sequential evidence', async () => {
  const calls = []
  const result = await withServer(async (_cli, args) => {
    calls.push(args)
    return { image: args[args.indexOf('-i') + 1], result: { ocr: { full_text: 'seen' }, semantics: { relations: [] } } }
  }, async base => {
    const response = await fetch(`${base}/api/modlens/read`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ images: [image, image], question: 'What is visible?' }) })
    return { response, body: await response.json() }
  })
  assert.equal(result.response.status, 200)
  assert.equal(result.body.evidence.length, 2)
  assert.deepEqual(calls.map(args => args.slice(0, 2)), [['-p', 'antigravity-cli'], ['-p', 'antigravity-cli']])
  assert.equal(calls[0].includes('--timeout') && calls[0][calls[0].indexOf('--timeout') + 1] === '180000', true)
  assert.equal(calls[0].includes('-i'), true)
  assert.equal(calls[0].some(value => value.includes('SECRET') || value.startsWith('http')), false)
})

test('rejects malformed uploads, provider overrides, URLs, and oversized image counts', async () => {
  await withServer(async () => ({}), async base => {
    const malformed = await fetch(`${base}/api/modlens/read`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ images: ['https://example.com/a.png'], question: 'x' }) })
    assert.equal(malformed.status, 400)
    const override = await fetch(`${base}/api/modlens/read`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ images: [image], question: 'x', provider: 'gemini-api' }) })
    assert.equal(override.status, 400)
    const tooMany = await fetch(`${base}/api/modlens/read`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ images: [image, image, image, image], question: 'x' }) })
    assert.equal(tooMany.status, 400)
    const wrongType = await fetch(`${base}/api/modlens/read`, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: '{}' })
    assert.equal(wrongType.status, 415)
  })
})

test('rejects cross-origin requests and serves root plus zhihu-study static paths', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'modlens-test-dist-'))
  await fs.writeFile(path.join(dir, 'index.html'), '<h1>ok</h1>')
  try {
    await withServer(async () => ({}), async base => {
      const blocked = await fetch(`${base}/api/modlens/status`, { headers: { origin: 'http://evil.example' } })
      assert.equal(blocked.status, 403)
      const root = await fetch(`${base}/`)
      assert.equal(root.status, 200)
      assert.equal(await root.text(), '<h1>ok</h1>')
      const pages = await fetch(`${base}/zhihu-study/`)
      assert.equal(pages.status, 200)
      assert.equal(await pages.text(), '<h1>ok</h1>')
      const traversal = await fetch(`${base}/%2e%2e/package.json`)
      assert.equal(traversal.status, 404)
    }, dir)
  } finally { await fs.rm(dir, { recursive: true, force: true }) }
})

test('timeout and executor cancellation clean temporary files', async () => {
  let mode = 'timeout'
  const executor = async () => {
    throw Object.assign(new Error('cancelled'), { code: mode === 'timeout' ? 'ETIMEDOUT' : 'ABORT_ERR' })
  }
  const before = (await fs.readdir(os.tmpdir())).filter(name => name.startsWith('modlens-server-'))
  await withServer(executor, async base => {
    const timeoutResponse = await fetch(`${base}/api/modlens/read`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ images: [image], question: 'x' }) })
    assert.equal(timeoutResponse.status, 504)
    await new Promise(resolve => setTimeout(resolve, 50))
    mode = 'abort'
    const abortResponse = await fetch(`${base}/api/modlens/read`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ images: [image], question: 'x' }) })
    assert.equal(abortResponse.status, 499)
    await new Promise(resolve => setTimeout(resolve, 100))
  })
  const after = (await fs.readdir(os.tmpdir())).filter(name => name.startsWith('modlens-server-'))
  assert.deepEqual(after, before)
})
