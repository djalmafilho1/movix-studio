import { config as loadEnv } from 'dotenv'
import express from 'express'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createStore } from './store.js'
import { validateGeneration } from './validation.js'
import { generateWithHiggsfield, publicError } from './provider.js'
import { createUploadTicket, isSupportedImageType, publicUploadError } from './upload.js'

const root = fileURLToPath(new URL('..', import.meta.url))
loadEnv({ path: join(root, '.env.local') })
const store = createStore(join(root, '.data', 'jobs.json'))
const app = express()
const credentials = process.env.HF_CREDENTIALS?.trim() || ''
const configured = credentials.split(':').length === 2 && credentials.split(':').every(Boolean)
const port = Number(process.env.MOVIX_API_PORT) || 8787

app.disable('x-powered-by')
app.use('/api', express.json({ limit: '32kb' }))
app.use('/api', (_request, response, next) => {
  response.setHeader('Cache-Control', 'no-store')
  next()
})

app.get('/api/status', (_request, response) => {
  response.json({ configured, provider: 'Higgsfield', imageModel: 'Flux Pro Kontext Max', videoModel: 'Seedance 2.5', animateModel: 'DoP Turbo' })
})

app.get('/api/jobs', (_request, response) => {
  response.json(store.list())
})

app.post('/api/upload', async (request, response) => {
  if (!configured) return response.status(503).json({ error: 'Configure HF_CREDENTIALS no arquivo .env.local antes de enviar.' })
  const contentType = request.body?.contentType
  if (!isSupportedImageType(contentType)) return response.status(400).json({ error: 'Escolha uma imagem JPEG, PNG ou WebP.' })

  try {
    response.json(await createUploadTicket(credentials, contentType))
  } catch (error) {
    console.error('Falha ao obter autorização de upload:', error.name)
    response.status(error.message === 'AUTHENTICATION_FAILED' ? 401 : 502).json({ error: publicUploadError(error) })
  }
})

app.post('/api/jobs', (request, response) => {
  if (!configured) return response.status(503).json({ error: 'Configure HF_CREDENTIALS no arquivo .env.local antes de criar.' })

  const { data, error } = validateGeneration(request.body)
  if (error) return response.status(400).json({ error })

  const pending = store.list().filter((job) => job.status === 'queued' || job.status === 'running').length
  if (pending >= 2) return response.status(429).json({ error: 'Aguarde uma das criações em andamento terminar.' })

  const job = store.create(data)
  response.status(202).json(job)

  queueMicrotask(async () => {
    store.update(job.id, { status: 'running' })
    try {
      const outputUrl = await generateWithHiggsfield(job, credentials)
      store.update(job.id, { status: 'completed', outputUrl })
    } catch (generationError) {
      console.error('Falha na criação:', generationError.name, generationError.statusCode || '')
      store.update(job.id, { status: 'failed', error: publicError(generationError) })
    }
  })
})

app.delete('/api/jobs/:id', (request, response) => {
  const job = store.get(request.params.id)
  if (!job) return response.status(404).json({ error: 'Criação não encontrada.' })
  if (job.status === 'queued' || job.status === 'running') {
    return response.status(409).json({ error: 'Aguarde a criação terminar antes de removê-la do histórico.' })
  }
  store.remove(job.id)
  response.status(204).end()
})

app.use('/api', (_request, response) => response.status(404).json({ error: 'Rota não encontrada.' }))
app.use((error, _request, response, _next) => {
  if (error instanceof SyntaxError && 'body' in error) return response.status(400).json({ error: 'O JSON enviado não é válido.' })
  console.error('Erro na API:', error)
  response.status(500).json({ error: 'Ocorreu um erro interno.' })
})

const dist = join(root, 'dist')
if (existsSync(join(dist, 'index.html'))) {
  app.use(express.static(dist))
  app.get(/^\/(?!api(?:\/|$)).*/, (_request, response) => response.sendFile(join(dist, 'index.html')))
}

app.listen(port, '127.0.0.1', () => {
  console.log(`MOVIX Studio disponível em http://127.0.0.1:${port}`)
})
