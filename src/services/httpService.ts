import api from './api'

export interface HTTPConfig {
  id: number
  id_parameter: number
  url: string
  method: string
  username?: string
  password?: string
  headers?: string // JSON string
  timeout_ms: number
  polling_ms: number
  field_mappings: string // JSON string
  description?: string
  created_at: string
  updated_at: string
  parameter?: any
}

export interface CreateHTTPConfigRequest {
  id_parameter: number
  url: string
  method?: string
  username?: string
  password?: string
  headers?: string
  timeout_ms?: number
  polling_ms: number
  field_mappings: string // Backend expects snake_case
  description?: string
}

export const httpService = {
  getAll: async (): Promise<HTTPConfig[]> => {
    const response = await api.get('/http')
    return response.data.data
  },

  getById: async (id: number): Promise<HTTPConfig> => {
    const response = await api.get(`/http/${id}`)
    return response.data.data
  },

  create: async (config: CreateHTTPConfigRequest): Promise<HTTPConfig> => {
    const response = await api.post('/http', config)
    return response.data.data
  },

  update: async (id: number, config: Partial<CreateHTTPConfigRequest>): Promise<HTTPConfig> => {
    const response = await api.patch(`/http/${id}`, config)
    return response.data.data
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/http/${id}`)
  },
}
