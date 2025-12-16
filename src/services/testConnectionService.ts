import api from './api'

export interface TestConnectionRequest {
  type: string
  config: any
}

export interface TestConnectionResponse {
  connected: boolean
  raw_value?: any
  message: string
  details?: string
}

export const testConnectionService = {
  test: async (req: TestConnectionRequest): Promise<TestConnectionResponse> => {
    const response = await api.post('/parameters/test-connection', req)
    return response.data.data
  },
}

