import { authorize, submitCloudJob } from '../../server/cloud.js'

export default function handler(request, response) {
  if (request.method === 'POST') return submitCloudJob(request, response)
  if (request.method === 'GET') {
    if (!authorize(request, response)) return
    response.setHeader('Cache-Control', 'no-store')
    return response.status(200).json([])
  }
  return response.status(405).json({ error: 'Método não permitido.' })
}
