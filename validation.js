import { isIP } from 'node:net'

const RATIOS = new Set(['1:1', '16:9', '9:16'])
const VIDEO_RESOLUTIONS = new Set(['480p', '720p', '1080p'])

export function parseReferenceUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) return null

  try {
    const url = new URL(value.trim())
    const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase()
    if (url.protocol !== 'https:' || url.username || url.password || url.port || !host.includes('.') || isIP(host)) return null
    if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return null
    return url.toString()
  } catch {
    return null
  }
}

export function validateGeneration(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { error: 'Envie os dados da criação em um objeto.' }
  }

  const mode = value.mode
  const prompt = typeof value.prompt === 'string' ? value.prompt.trim() : ''
  if (!['image', 'video', 'animate'].includes(mode)) return { error: 'Escolha imagem, vídeo ou animar.' }
  if (prompt.length < 3 || prompt.length > 1500) return { error: 'Escreva uma descrição entre 3 e 1.500 caracteres.' }

  if (mode === 'video') {
    const duration = value.duration ?? 5
    const resolution = value.resolution ?? '720p'
    const aspectRatio = value.aspectRatio ?? '16:9'
    if (!Number.isInteger(duration) || duration < 4 || duration > 30) return { error: 'Escolha uma duração de 4 a 30 segundos.' }
    if (!VIDEO_RESOLUTIONS.has(resolution)) return { error: 'Escolha uma resolução de vídeo válida.' }
    if (!RATIOS.has(aspectRatio)) return { error: 'Escolha um formato de vídeo válido.' }
    return { data: { mode, prompt, duration, resolution, aspectRatio } }
  }

  let seed
  if (value.seed !== undefined && value.seed !== null && value.seed !== '') {
    if (!Number.isInteger(value.seed) || value.seed < 0 || value.seed > 2147483647) {
      return { error: 'A semente deve ser um número inteiro entre 0 e 2147483647.' }
    }
    seed = value.seed
  }

  if (mode === 'image') {
    const aspectRatio = value.aspectRatio || '16:9'
    if (!RATIOS.has(aspectRatio)) return { error: 'Escolha um formato de imagem válido.' }
    return { data: { mode, prompt, aspectRatio, seed } }
  }

  const referenceUrl = parseReferenceUrl(value.referenceUrl)
  if (!referenceUrl) return { error: 'Informe uma URL HTTPS pública da imagem de referência.' }
  return { data: { mode, prompt, referenceUrl, seed } }
}
