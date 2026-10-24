import { createHiggsfieldClient } from '@higgsfield/client/v2'

export function buildRequest(job) {
  if (job.mode === 'video') {
    return {
      endpoint: 'bytedance/seedance-2.5/text-to-video',
      input: {
        prompt: job.prompt,
        duration: job.duration,
        resolution: job.resolution,
        aspect_ratio: job.aspectRatio,
      },
    }
  }

  if (job.mode === 'animate') {
    return {
      endpoint: '/v1/image2video/dop',
      input: {
        model: 'dop-turbo',
        prompt: job.prompt,
        input_images: [{ type: 'image_url', image_url: job.referenceUrl }],
        ...(job.seed === undefined ? {} : { seed: job.seed }),
      },
    }
  }

  return {
    endpoint: 'flux-pro/kontext/max/text-to-image',
    input: {
      prompt: job.prompt,
      aspect_ratio: job.aspectRatio,
      safety_tolerance: 2,
      ...(job.seed === undefined ? {} : { seed: job.seed }),
    },
  }
}

export function extractOutput(result, mode) {
  if (result.status === 'nsfw' || result.status === 'moderated') throw new Error('CONTENT_BLOCKED')
  if (result.status === 'canceled' || result.status === 'cancelled') throw new Error('GENERATION_CANCELED')
  if (result.status === 'failed') throw new Error('GENERATION_FAILED')
  if (result.status !== 'completed') throw new Error('GENERATION_INCOMPLETE')

  const outputUrl = mode === 'image' ? result.images?.[0]?.url : result.video?.url
  if (typeof outputUrl !== 'string' || !/^https:\/\//i.test(outputUrl)) throw new Error('OUTPUT_UNAVAILABLE')
  return outputUrl
}

export async function generateWithHiggsfield(job, credentials) {
  const client = createHiggsfieldClient({ credentials, maxPollTime: 900000, pollInterval: 2500, maxRetries: 0 })
  const { endpoint, input } = buildRequest(job)
  const result = await client.subscribe(endpoint, { input, withPolling: true })
  return extractOutput(result, job.mode)
}

export function publicError(error) {
  if (error.message === 'CONTENT_BLOCKED') return 'O provedor bloqueou este conteúdo. Ajuste a descrição e tente novamente.'
  if (error.message === 'GENERATION_CANCELED') return 'A criação foi cancelada pelo provedor. Confira o painel Higgsfield.'
  if (error.message === 'GENERATION_FAILED') return 'O provedor informou que a criação falhou. Confira o painel Higgsfield.'
  if (error.message === 'GENERATION_INCOMPLETE') return 'O provedor não confirmou a conclusão. Confira o painel Higgsfield antes de tentar novamente.'
  if (error.message === 'OUTPUT_UNAVAILABLE') return 'A criação terminou, mas o provedor não devolveu uma URL de mídia. Confira o painel Higgsfield.'
  if (error.name === 'AuthenticationError' || error.name === 'CredentialsMissedError') return 'A chave da API não foi aceita. Confira HF_CREDENTIALS no arquivo .env.local.'
  if (error.name === 'NotEnoughCreditsError') return 'A conta não tem créditos suficientes para esta criação.'
  if (error.name === 'ValidationError' || error.name === 'BadInputError') return 'O provedor rejeitou os parâmetros. Revise a descrição e as opções do modelo.'
  if (error.name === 'TimeoutError') return 'A espera terminou sem confirmação. Verifique o resultado no painel Higgsfield antes de tentar novamente.'
  return 'Não foi possível concluir a criação. Verifique sua conexão e o painel Higgsfield antes de tentar novamente.'
}
