import { pollCloudJob } from '../../server/cloud.js'

export default function handler(request, response) {
  if (request.method !== 'GET') return response.status(405).json({ error: 'Método não permitido.' })
  return pollCloudJob(request, response)
}
