import type { CreateInput, Job, ProviderStatus } from './types'

const HISTORY_KEY = 'movix:jobs:v1'
const ACCESS_KEY = 'movix:access:v1'
let browserHistory = false

function getAccessToken() {
  try {
    return sessionStorage.getItem(ACCESS_KEY) || ''
  } catch {
    return ''
  }
}

function readHistory(): Job[] {
  try {
    const saved = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
    return Array.isArray(saved) ? saved.filter((job) => job && typeof job.id === 'string' && typeof job.prompt === 'string') : []
  } catch {
    return []
  }
}

function saveHistory(jobs: Job[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(jobs.slice(0, 100)))
  } catch {
    // Browser storage can be unavailable in private mode.
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const access = path === '/status' ? '' : getAccessToken()
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(access ? { 'X-Movix-Access': access } : {}), ...init?.headers },
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error || `A solicitação falhou (${response.status}).`)
  }
  if (response.status === 204) return undefined as T
  return response.json()
}

export const api = {
  async status() {
    const status = await request<ProviderStatus>('/status')
    browserHistory = status.storage === 'browser'
    return status
  },
  hasAccessToken: () => !!getAccessToken(),
  setAccessToken(value: string) {
    sessionStorage.setItem(ACCESS_KEY, value)
  },
  clearAccessToken() {
    sessionStorage.removeItem(ACCESS_KEY)
  },
  verifyAccess: () => request<Job[]>('/jobs'),
  async jobs(): Promise<Job[]> {
    if (!browserHistory) return request<Job[]>('/jobs')

    const jobs = readHistory()
    if (!getAccessToken()) return jobs
    const pending = jobs.filter((job) => job.status === 'queued' || job.status === 'running')
    if (!pending.length) return jobs

    const updates = await Promise.allSettled(pending.map((job) =>
      request<Pick<Job, 'id' | 'status' | 'updatedAt'> & Partial<Job>>(`/jobs/${encodeURIComponent(job.id)}?mode=${encodeURIComponent(job.mode)}`),
    ))
    const byId = new Map(updates.flatMap((item) => item.status === 'fulfilled' ? [[item.value.id, item.value] as const] : []))
    const refreshed = readHistory().map((job) => job.status === 'queued' || job.status === 'running' ? { ...job, ...byId.get(job.id) } : job)
    saveHistory(refreshed)
    return refreshed
  },
  async create(input: CreateInput) {
    const job = await request<Job>('/jobs', { method: 'POST', body: JSON.stringify(input) })
    if (browserHistory) saveHistory([job, ...readHistory().filter((item) => item.id !== job.id)])
    return job
  },
  async remove(id: string) {
    if (browserHistory) {
      saveHistory(readHistory().filter((job) => job.id !== id))
      return
    }
    await request<void>(`/jobs/${encodeURIComponent(id)}`, { method: 'DELETE' })
  },
  async uploadImage(file: File): Promise<string> {
    const ticket = await request<{ upload_url: string; public_url: string; upload_headers: Record<string, string> }>('/upload', {
      method: 'POST',
      body: JSON.stringify({ contentType: file.type }),
    })
    const upload = await fetch(ticket.upload_url, { method: 'PUT', body: file, headers: ticket.upload_headers, credentials: 'omit' })
    if (!upload.ok) throw new Error('O envio da imagem falhou. Tente novamente ou use uma URL HTTPS pública.')
    return ticket.public_url
  },
}
