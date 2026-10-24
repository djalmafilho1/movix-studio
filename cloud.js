import { createHash, timingSafeEqual } from 'node:crypto'
import { createHiggsfieldClient } from '@higgsfield/client/v2'
import { buildRequest, extractOutput, publicError } from './provider.js'
import { validateGeneration } from './validation.js'
import { createUploadTicket, isSupportedImageType, publicUploadError } from './upload.js'

const API_BASE = 'https://api.higgsfield.ai'

function send(response, status, body) {
  response.setHeader('Cache-Control', 'no-store')
  return response.status(status).json(body)
}

export function cloudConfiguration() {
  const credentials = process.env.HF_CREDENTIALS?.trim() || ''
  const accessToken = process.env.MOVIX_ACCESS_TOKEN?.trim() || ''
  return {
    credentials,
    accessToken,
    configured: /^[^:]+:[^:]+$/.test(credentials) && accessToken.length >= 32,
  }
}

export function authorize(request, response) {
  const { credentials, accessToken, configured } = cloudConfiguration()
  if (!configured) {
    send(response, 503, { error: 'Configure HF_CREDENTIALS e MOVIX_ACCESS_TOKEN nas variáveis de ambiente da Vercel.' })
    return null
  }

  const provided = request.headers['x-movix-access']
  const value = typeof provided === 'string' ? provided : ''
  const expectedHash = createHash('sha256').update(accessToken).digest()
  const providedHash = createHash('sha256').update(value).digest()
  if (!value || !timingSafeEqual(expectedHash, providedHash)) {
    send(response, 401, { error: 'Código de acesso inválido. Informe o código configurado para este estúdio.' })
    return null
  }
  return credentials
}

export function normalizeCloudResult(result, mode) {
  const status = result?.status
  if (status === 'queued') return { status: 'queued' }
  if (status === 'in_progress') return { status: 'running' }
  if (status === 'completed') {
    try {
      return { status: 'completed', outputUrl: extractOutput(result, mode) }
    } catch (error) {
      return { status: 'failed', error: publicError(error) }
    }
  }
  try {
    extractOutput(result, mode)
  } catch (error) {
    return { status: 'failed', error: publicError(error) }
  }
  return { status: 'failed', error: 'O provedor não confirmou o resultado.' }
}

export function publicCloudStatus(response) {
  return send(response, 200, {
    configured: cloudConfiguration().configured,
    authRequired: true,
    storage: 'browser',
    provider: 'Higgsfield',
    imageModel: 'Flux Pro Kontext Max',
    videoModel: 'Seedance 2.5',
    animateModel: 'DoP Turbo',
  })
}

export async function submitCloudJob(request, response) {
  const credentials = authorize(request, response)
  if (!credentials) return
  if (JSON.stringify(request.body || {}).length > 32768) return send(response, 413, { error: 'A solicitação é grande demais.' })

  const { data, error } = validateGeneration(request.body)
  if (error) return send(response, 400, { error })

  try {
    const client = createHiggsfieldClient({ credentials, maxRetries: 0, timeout: 20000 })
    const { endpoint, input } = buildRequest(data)
    const result = await client.subscribe(endpoint, { input, withPolling: false })
    if (typeof result.request_id !== 'string' || !/^[a-zA-Z0-9_-]{8,128}$/.test(result.request_id)) {
      return send(response, 502, { error: 'O provedor não confirmou o ID da criação. Confira o painel Higgsfield antes de reenviar.' })
    }

    const now = new Date().toISOString()
    return send(response, 202, {
      id: result.request_id,
      ...data,
      ...normalizeCloudResult(result, data.mode),
      createdAt: now,
      updatedAt: now,
    })
  } catch (generationError) {
    return send(response, 502, { error: 'Não foi possível confirmar a solicitação. Confira o painel Higgsfield antes de reenviar; ' + publicError(generationError) })
  }
}

export async function pollCloudJob(request, response) {
  const credentials = authorize(request, response)
  if (!credentials) return
  const id = request.query.id
  const mode = request.query.mode
  if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{8,128}$/.test(id) || !['image', 'video', 'animate'].includes(mode)) {
    return send(response, 400, { error: 'ID ou tipo de criação inválido.' })
  }

  try {
    const upstream = await fetch(`${API_BASE}/requests/${id}/status`, {
      headers: { Authorization: `Key ${credentials}` },
      signal: AbortSignal.timeout(15000),
    })
    if (!upstream.ok) return send(response, 502, { error: 'Não foi possível consultar a criação. Tente novamente mais tarde.' })
    const result = await upstream.json()
    return send(response, 200, { id, ...normalizeCloudResult(result, mode), updatedAt: new Date().toISOString() })
  } catch {
    return send(response, 502, { error: 'Não foi possível consultar a criação. Tente novamente mais tarde.' })
  }
}

export async function uploadCloudImage(request, response) {
  const credentials = authorize(request, response)
  if (!credentials) return
  const contentType = request.body?.contentType
  if (!isSupportedImageType(contentType)) return send(response, 400, { error: 'Escolha uma imagem JPEG, PNG ou WebP.' })
  try {
    return send(response, 200, await createUploadTicket(credentials, contentType))
  } catch (error) {
    return send(response, error.message === 'AUTHENTICATION_FAILED' ? 401 : 502, { error: publicUploadError(error) })
  }
}
