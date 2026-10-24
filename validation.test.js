import assert from 'node:assert/strict'
import test from 'node:test'
import { parseReferenceUrl, validateGeneration } from './validation.js'

test('accepts an image request with a fixed seed', () => {
  assert.deepEqual(validateGeneration({ mode: 'image', prompt: '  Céu sobre dunas  ', aspectRatio: '9:16', seed: 0 }), {
    data: { mode: 'image', prompt: 'Céu sobre dunas', aspectRatio: '9:16', seed: 0 },
  })
})

test('uses Seedance 2.5 defaults for text-to-video without an image', () => {
  assert.deepEqual(validateGeneration({ mode: 'video', prompt: '  A cinematic scene at sunset  ' }), {
    data: { mode: 'video', prompt: 'A cinematic scene at sunset', duration: 5, resolution: '720p', aspectRatio: '16:9' },
  })
  assert.deepEqual(validateGeneration({ mode: 'video', prompt: 'A moving scene', duration: 12, resolution: '1080p', aspectRatio: '9:16' }), {
    data: { mode: 'video', prompt: 'A moving scene', duration: 12, resolution: '1080p', aspectRatio: '9:16' },
  })
})

test('rejects unsupported Seedance settings', () => {
  for (const input of [
    { duration: 3 }, { duration: 31 }, { duration: 5.5 }, { duration: '5' },
    { resolution: '4k' }, { aspectRatio: '2:1' },
  ]) {
    assert.ok(validateGeneration({ mode: 'video', prompt: 'Uma cena', ...input }).error)
  }
})

test('requires a public HTTPS reference for image animation', () => {
  assert.deepEqual(validateGeneration({ mode: 'animate', prompt: 'A câmera acompanha o mar', referenceUrl: 'https://cdn.example.com/shot.png' }), {
    data: { mode: 'animate', prompt: 'A câmera acompanha o mar', referenceUrl: 'https://cdn.example.com/shot.png', seed: undefined },
  })
  for (const url of ['http://example.com/a.png', 'https://127.0.0.1/a.png', 'https://localhost/a.png', 'https://user:pass@example.com/a.png', 'https://host.internal/a.png']) {
    assert.equal(parseReferenceUrl(url), null)
  }
})

test('rejects invalid prompts, ratios, seeds and animation references', () => {
  assert.match(validateGeneration({ mode: 'image', prompt: '  ' }).error, /descrição/)
  assert.match(validateGeneration({ mode: 'image', prompt: 'Um retrato', aspectRatio: '21:9' }).error, /formato/)
  assert.match(validateGeneration({ mode: 'image', prompt: 'Um retrato', seed: -1 }).error, /semente/)
  assert.match(validateGeneration({ mode: 'animate', prompt: 'Um retrato' }).error, /URL HTTPS/)
})
