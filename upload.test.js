import assert from 'node:assert/strict'
import test from 'node:test'
import { isSupportedImageType, validateUploadTicket } from './upload.js'

test('accepts image MIME types and a safe ticket', () => {
  assert.equal(isSupportedImageType('image/png'), true)
  assert.equal(isSupportedImageType('video/mp4'), false)
  assert.deepEqual(validateUploadTicket({
    upload_url: 'https://storage.example.com/uploads/123',
    public_url: 'https://cdn.example.com/uploads/123.png',
    content_type: 'image/png',
    upload_headers: { 'Content-Type': 'image/png', 'x-storage-token': 'abc' },
  }, 'image/png'), {
    upload_url: 'https://storage.example.com/uploads/123',
    public_url: 'https://cdn.example.com/uploads/123.png',
    upload_headers: { 'Content-Type': 'image/png', 'x-storage-token': 'abc' },
  })
})

test('rejects unsafe or malformed upload tickets', () => {
  const ticket = {
    upload_url: 'https://storage.example.com/uploads/123',
    public_url: 'https://cdn.example.com/uploads/123.png',
    content_type: 'image/png',
    upload_headers: { 'Content-Type': 'image/png' },
  }
  for (const changes of [
    { upload_url: 'http://storage.example.com/uploads/123' },
    { public_url: 'https://user:password@cdn.example.com/image.png' },
    { content_type: 'image/jpeg' },
    { upload_headers: { Authorization: 'Key private', 'Content-Type': 'image/png' } },
    { upload_headers: { 'Content-Type': 'image/jpeg' } },
  ]) {
    assert.throws(() => validateUploadTicket({ ...ticket, ...changes }, 'image/png'), /INVALID_TICKET/)
  }
})
