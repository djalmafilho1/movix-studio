const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

function isSafeHttpsUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password
  } catch {
    return false
  }
}

export function isSupportedImageType(value) {
  return IMAGE_TYPES.has(value)
}

export function validateUploadTicket(value, contentType) {
  if (!value || typeof value !== 'object' || !isSafeHttpsUrl(value.upload_url) || !isSafeHttpsUrl(value.public_url)) {
    throw new Error('INVALID_TICKET')
  }
  if (value.content_type !== contentType || !value.upload_headers || typeof value.upload_headers !== 'object' || Array.isArray(value.upload_headers)) {
    throw new Error('INVALID_TICKET')
  }

  const headers = value.upload_headers
  const entries = Object.entries(headers)
  if (entries.some(([key, headerValue]) => typeof headerValue !== 'string' || /^(authorization|cookie|proxy-authorization)$/i.test(key))) {
    throw new Error('INVALID_TICKET')
  }
  const headerType = entries.find(([key]) => key.toLowerCase() === 'content-type')?.[1]
  if (headerType !== contentType) throw new Error('INVALID_TICKET')

  return {
    upload_url: value.upload_url,
    public_url: value.public_url,
    upload_headers: headers,
  }
}

export async function createUploadTicket(credentials, contentType) {
  if (!isSupportedImageType(contentType)) throw new Error('INVALID_TYPE')

  const response = await fetch('https://api.higgsfield.ai/files/generate-upload-url', {
    method: 'POST',
    headers: {
      Authorization: `Key ${credentials}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content_type: contentType }),
    signal: AbortSignal.timeout(20000),
  })

  if (response.status === 401) throw new Error('AUTHENTICATION_FAILED')
  if (response.status === 403) throw new Error('NOT_ENOUGH_CREDITS')
  if (!response.ok) throw new Error('UPLOAD_TICKET_FAILED')

  const ticket = await response.json()
  return validateUploadTicket(ticket, contentType)
}

export function publicUploadError(error) {
  if (error.message === 'AUTHENTICATION_FAILED') return 'A chave da API não foi aceita. Confira HF_CREDENTIALS no arquivo .env.'
  if (error.message === 'NOT_ENOUGH_CREDITS') return 'A conta não tem acesso ou créditos suficientes para enviar esta imagem.'
  if (error.message === 'INVALID_TYPE') return 'Escolha uma imagem JPEG, PNG ou WebP.'
  return 'Não foi possível preparar o envio. Tente novamente ou use uma URL HTTPS pública.'
}
