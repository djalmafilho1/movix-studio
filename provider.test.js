import assert from 'node:assert/strict'
import test from 'node:test'
import { buildRequest, extractOutput, publicError } from './provider.js'

test('builds the documented Seedance 2.5 text-to-video request', () => {
  assert.deepEqual(buildRequest({ mode: 'video', prompt: 'A cinematic scene at sunset', duration: 5, resolution: '720p', aspectRatio: '16:9' }), {
    endpoint: 'bytedance/seedance-2.5/text-to-video',
    input: { prompt: 'A cinematic scene at sunset', duration: 5, resolution: '720p', aspect_ratio: '16:9' },
  })
})

test('keeps image animation routed to DoP Turbo', () => {
  assert.deepEqual(buildRequest({ mode: 'animate', prompt: 'Camera pans right', referenceUrl: 'https://example.com/image.png' }), {
    endpoint: '/v1/image2video/dop',
    input: {
      model: 'dop-turbo',
      prompt: 'Camera pans right',
      input_images: [{ type: 'image_url', image_url: 'https://example.com/image.png' }],
    },
  })
})

test('returns a video URL only after confirmed completion', () => {
  assert.equal(extractOutput({ status: 'completed', video: { url: 'https://example.com/video.mp4' } }, 'video'), 'https://example.com/video.mp4')
  for (const status of ['queued', 'in_progress', 'failed', 'canceled', 'cancelled', 'nsfw', 'moderated']) {
    assert.throws(() => extractOutput({ status, video: { url: 'https://example.com/video.mp4' } }, 'video'))
  }
  assert.throws(() => extractOutput({ status: 'completed', video: {} }, 'video'), /OUTPUT_UNAVAILABLE/)
  assert.throws(() => extractOutput({ status: 'completed', video: { url: 'http://example.com/video.mp4' } }, 'video'), /OUTPUT_UNAVAILABLE/)
})

test('shows failures without claiming generation succeeded', () => {
  assert.match(publicError(new Error('GENERATION_CANCELED')), /cancelada/)
  assert.match(publicError(new Error('CONTENT_BLOCKED')), /bloqueou/)
  assert.match(publicError(new Error('GENERATION_FAILED')), /falhou/)
})
