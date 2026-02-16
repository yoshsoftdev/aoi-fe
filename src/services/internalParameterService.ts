import api from './api'

export interface InternalParameter {
  id: number
  device_id: number
  nama: string
  type: 'internal'
  direction: string
  parameter_mode: string
  created_at: string
  updated_at: string
}

export interface CreateInternalParameterRequest {
  name: string
  device_id: number
}

export interface SetValueRequest {
  value: number
}

export const internalParameterService = {
  create: async (request: CreateInternalParameterRequest): Promise<InternalParameter> => {
    const response = await api.post('/internal-parameters', request)
    return response.data.data
  },

  setValue: async (id: number, value: number): Promise<void> => {
    await api.post(`/internal-parameters/${id}/set-value`, { value })
  },

  resetValue: async (id: number): Promise<void> => {
    await api.post(`/internal-parameters/${id}/reset`)
  },

  getValue: async (id: number): Promise<number> => {
    const response = await api.get(`/internal-parameters/${id}/value`)
    return response.data.data.value
  },
}
