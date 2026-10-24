import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createStore } from './store.js'

test('persists creations and marks interrupted work after restart', () => {
  const directory = mkdtempSync(join(tmpdir(), 'movix-store-'))
  try {
    const file = join(directory, 'jobs.json')
    const store = createStore(file)
    const finished = store.create({ mode: 'image', prompt: 'Uma praia', aspectRatio: '16:9' })
    store.update(finished.id, { status: 'completed', outputUrl: 'https://example.com/image.png' })
    const pending = store.create({ mode: 'video', prompt: 'Ondas', referenceUrl: 'https://example.com/image.png' })

    const restored = createStore(file)
    assert.equal(restored.get(finished.id).status, 'completed')
    assert.equal(restored.get(pending.id).status, 'interrupted')
    assert.equal(restored.list().length, 2)
    assert.equal(restored.remove(finished.id), true)
    assert.equal(createStore(file).get(finished.id), undefined)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
