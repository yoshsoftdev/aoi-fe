import api from './api'
import { Parameter } from '@/types/parameter'

export const parameterService = {
  getAll: async (): Promise<Parameter[]> => {
    const response = await api.get('/parameters')
    return response.data.data
  },

  getById: async (id: number): Promise<Parameter> => {
    const response = await api.get(`/parameters/${id}`)
    return response.data.data
  },

  create: async (param: Omit<Parameter, 'id' | 'created_at' | 'updated_at'>): Promise<Parameter> => {
    const response = await api.post('/parameters', param)
    return response.data.data
  },

  update: async (id: number, param: Partial<Parameter>): Promise<Parameter> => {
    const response = await api.patch(`/parameters/${id}`, param)
    return response.data.data
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/parameters/${id}`)
  },
}

