export type Mode = 'image' | 'video' | 'animate'
export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'interrupted'

export interface Job {
  id: string
  mode: Mode
  prompt: string
  status: JobStatus
  aspectRatio?: '1:1' | '16:9' | '9:16'
  duration?: number
  resolution?: '480p' | '720p' | '1080p'
  referenceUrl?: string
  seed?: number
  outputUrl?: string
  error?: string
  createdAt: string
  updatedAt: string
}

export interface ProviderStatus {
  configured: boolean
  authRequired?: boolean
  storage?: 'browser' | 'server'
  provider: string
  imageModel: string
  videoModel: string
  animateModel: string
}

export type CreateInput = {
  mode: Mode
  prompt: string
  seed?: number
  aspectRatio?: Job['aspectRatio']
  duration?: number
  resolution?: Job['resolution']
  referenceUrl?: string
}
