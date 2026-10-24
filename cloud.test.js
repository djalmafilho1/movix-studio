import assert from 'node:assert/strict'
import test from 'node:test'
import { authorize, cloudConfiguration, normalizeCloudResult, submitCloudJob } from './cloud.js'

function response() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    setHeader(key, value) { this.headers[key] = value; return this },
    status(code) { this.statusCode = code; return this },
    json(body) { this.body = body; return this },
  }
}

test('cloud API rejects requests without a configured access token', () => {
  const previousKey = process.env.HF_CREDENTIALS
  const previousToken = process.env.MOVIX_ACCESS_TOKEN
  try {
    process.env.HF_CREDENTIALS = 'test-id:test-secret'
    delete process.env.MOVIX_ACCESS_TOKEN
    const res = response()
    assert.equal(authorize({ headers: {} }, res), null)
    assert.equal(res.statusCode, 503)
    assert.equal(cloudConfiguration().configured, false)
  } finally {
    if (previousKey === undefined) delete process.env.HF_CREDENTIALS
    else process.env.HF_CREDENTIALS = previousKey
    if (previousToken === undefined) delete process.env.MOVIX_ACCESS_TOKEN
    else process.env.MOVIX_ACCESS_TOKEN = previousToken
  }
})

test('cloud API requires its own access code without exposing provider credentials', async () => {
  const previousKey = process.env.HF_CREDENTIALS
  const previousToken = process.env.MOVIX_ACCESS_TOKEN
  try {
    process.env.HF_CREDENTIALS = 'test-id:test-secret'
    process.env.MOVIX_ACCESS_TOKEN = 'a'.repeat(48)
    const denied = response()
    assert.equal(authorize({ headers: { 'x-movix-access': 'wrong' } }, denied), null)
    assert.equal(denied.statusCode, 401)
    assert.ok(!JSON.stringify(denied.body).includes('test-secret'))

    const accepted = response()
    assert.equal(authorize({ headers: { 'x-movix-access': 'a'.repeat(48) } }, accepted), 'test-id:test-secret')
    const invalid = response()
    await submitCloudJob({ headers: { 'x-movix-access': 'a'.repeat(48) }, body: { mode: 'video', prompt: 'ok', duration: 3 } }, invalid)
    assert.equal(invalid.statusCode, 400)
  } finally {
    if (previousKey === undefined) delete process.env.HF_CREDENTIALS
    else process.env.HF_CREDENTIALS = previousKey
    if (previousToken === undefined) delete process.env.MOVIX_ACCESS_TOKEN
    else process.env.MOVIX_ACCESS_TOKEN = previousToken
  }
})

test('cloud API normalizes in-progress and failed states without false success', () => {
  assert.deepEqual(normalizeCloudResult({ status: 'in_progress' }, 'video'), { status: 'running' })
  assert.deepEqual(normalizeCloudResult({ status: 'completed', video: { url: 'https://example.com/clip.mp4' } }, 'video'), {
    status: 'completed', outputUrl: 'https://example.com/clip.mp4',
  })
  for (const status of ['canceled', 'failed', 'nsfw']) {
    assert.equal(normalizeCloudResult({ status }, 'video').status, 'failed')
  }
})
