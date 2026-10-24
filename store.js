import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

export function createStore(filePath) {
  mkdirSync(dirname(filePath), { recursive: true })
  let jobs = []

  if (existsSync(filePath)) {
    const saved = JSON.parse(readFileSync(filePath, 'utf8'))
    if (!Array.isArray(saved)) throw new Error('O histórico de criações está corrompido.')
    jobs = saved
  }

  function save() {
    const temporaryPath = `${filePath}.${process.pid}.tmp`
    writeFileSync(temporaryPath, JSON.stringify(jobs, null, 2))
    renameSync(temporaryPath, filePath)
  }

  for (const job of jobs) {
    if (job.status === 'queued' || job.status === 'running') {
      job.status = 'interrupted'
      job.error = 'O servidor reiniciou durante a criação. Verifique o resultado no painel Higgsfield antes de tentar novamente.'
      job.updatedAt = new Date().toISOString()
    }
  }
  if (jobs.length) save()

  return {
    list: () => [...jobs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    get: (id) => jobs.find((job) => job.id === id),
    create(input) {
      const now = new Date().toISOString()
      const job = {
        id: randomUUID(),
        ...input,
        status: 'queued',
        createdAt: now,
        updatedAt: now,
      }
      jobs.push(job)
      save()
      return job
    },
    update(id, patch) {
      const job = jobs.find((item) => item.id === id)
      if (!job) return null
      Object.assign(job, patch, { updatedAt: new Date().toISOString() })
      save()
      return job
    },
    remove(id) {
      const index = jobs.findIndex((job) => job.id === id)
      if (index === -1) return false
      jobs.splice(index, 1)
      save()
      return true
    },
  }
}
