import api from './api'

export interface BypassRule {
  id?: number
  bypass_id?: number
  condition_type: 'always' | 'compare'
  left_source_type: 'set_point' | 'parameter'
  left_source_id: number
  operator?: '>' | '<' | '>=' | '<=' | '='
  right_value_type: 'static' | 'set_point'
  right_value?: number
  right_source_id?: number
  created_at?: string
}

export interface BypassAction {
  id?: number
  bypass_id?: number
  write_parameter_id: number
  value_source_type: 'static' | 'set_point'
  value?: number
  source_set_point_id?: number
  action_order?: number
  created_at?: string
}

export interface Bypass {
  id: number
  name: string
  enabled: boolean
  description?: string | null
  created_at: string
  updated_at: string
  rules: BypassRule[]
  actions: BypassAction[]
}

export interface CreateBypassRequest {
  name: string
  enabled?: boolean
  description?: string | null
  rules: BypassRule[]
  actions: BypassAction[]
}

export interface UpdateBypassRequest extends CreateBypassRequest {}

export const bypassService = {
  getAll: async (): Promise<Bypass[]> => {
    const response = await api.get('/bypasses')
    return response.data.data || []
  },

  getById: async (id: number): Promise<Bypass> => {
    const response = await api.get(`/bypasses/${id}`)
    return response.data.data
  },

  create: async (payload: CreateBypassRequest): Promise<Bypass> => {
    const response = await api.post('/bypasses', payload)
    return response.data.data
  },

  update: async (id: number, payload: UpdateBypassRequest): Promise<Bypass> => {
    const response = await api.patch(`/bypasses/${id}`, payload)
    return response.data.data
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/bypasses/${id}`)
  },
}

export default bypassService

