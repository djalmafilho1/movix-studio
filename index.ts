import { config as loadEnv } from 'dotenv'
import { config, higgsfield } from '@higgsfield/client/v2'
import { fileURLToPath } from 'node:url'

loadEnv({ path: fileURLToPath(new URL('.env.local', import.meta.url)) })

async function main() {
  const credentials = process.env.HF_CREDENTIALS?.trim()
  if (!credentials || !/^[^:]+:[^:]+$/.test(credentials)) {
    console.error('Preencha HF_CREDENTIALS em .env.local no formato key-id:key-secret antes de executar o exemplo.')
    process.exitCode = 1
    return
  }

  config({ credentials, maxPollTime: 900000, maxRetries: 0 })
  const result = await higgsfield.subscribe('bytedance/seedance-2.5/text-to-video', {
    input: {
      prompt: 'A cinematic scene at sunset',
      duration: 5,
      resolution: '720p',
      aspect_ratio: '16:9',
    },
    withPolling: true,
  })

  const status: string = result.status
  if (status === 'nsfw' || status === 'moderated') {
    console.error('O provedor moderou o vídeo; nenhum resultado foi gerado.')
  } else if (status === 'canceled' || status === 'cancelled') {
    console.error('A criação foi cancelada; confira o painel Higgsfield.')
  } else if (status === 'failed') {
    console.error('A criação falhou; confira o painel Higgsfield.')
  } else if (status !== 'completed') {
    console.error('A criação não foi confirmada como concluída; confira o painel Higgsfield.')
  } else if (typeof result.video?.url === 'string' && /^https:\/\//i.test(result.video.url)) {
    console.log(result.video.url)
    return
  } else {
    console.error('A criação foi concluída, mas o provedor não devolveu uma URL de vídeo válida.')
  }
  process.exitCode = 1
}

main().catch((error: unknown) => {
  const name = error instanceof Error ? error.name : ''
  const status = error && typeof error === 'object' && 'statusCode' in error && typeof error.statusCode === 'number' ? error.statusCode : undefined
  if (name === 'AuthenticationError' || name === 'CredentialsMissedError' || status === 401) {
    console.error('A chave da API não foi aceita. Confira HF_CREDENTIALS em .env.local.')
  } else if (name === 'NotEnoughCreditsError' || status === 403) {
    console.error('A conta não tem acesso ou créditos suficientes para gerar o vídeo.')
  } else if (status === 404) {
    console.error('O modelo não foi encontrado ou não está habilitado para esta conta.')
  } else if (status === 400 || status === 422) {
    console.error('O provedor rejeitou os parâmetros deste modelo.')
  } else if (name === 'TimeoutError') {
    console.error('A espera terminou sem confirmação. Confira o painel Higgsfield antes de reenviar.')
  } else {
    console.error('O SDK não concluiu a criação. Confira a conexão e o painel Higgsfield antes de reenviar.')
  }
  process.exitCode = 1
})
