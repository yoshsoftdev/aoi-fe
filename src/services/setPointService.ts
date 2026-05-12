import api from './api'

export interface SetPoint {
  id: number
  name: string
  unit?: string | null
  value: number
  data_type: 'int' | 'float' | 'bool'
  min_value?: number | null
  max_value?: number | null
  random_enabled?: boolean
  description?: string | null
  created_at?: string
  updated_at?: string
}

export interface CreateSetPointRequest {
  name: string
  unit?: string | null
  value?: number
  data_type?: 'int' | 'float' | 'bool'
  min_value?: number | null
  max_value?: number | null
  random_enabled?: boolean
  description?: string | null
}

export interface UpdateSetPointRequest extends Partial<CreateSetPointRequest> {}

export const setPointService = {
  getAll: async (): Promise<SetPoint[]> => {
    const response = await api.get('/set-points')
    return response.data.data || []
  },

  getById: async (id: number): Promise<SetPoint> => {
    const response = await api.get(`/set-points/${id}`)
    return response.data.data
  },

  create: async (payload: CreateSetPointRequest): Promise<SetPoint> => {
    const response = await api.post('/set-points', payload)
    return response.data.data
  },

  update: async (id: number, payload: UpdateSetPointRequest): Promise<SetPoint> => {
    const response = await api.patch(`/set-points/${id}`, payload)
    return response.data.data
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/set-points/${id}`)
  },
}

export default setPointService

