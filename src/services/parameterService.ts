import api from './api'
import { Parameter } from '@/types/parameter'

export interface DeleteParameterError {
  status: 'REJECTED'
  reason: 'PARAMETER_IN_USE' | 'INVALID_ID' | 'INTERNAL_ERROR' | string
  error: string
}

export class ParameterDeleteError extends Error {
  constructor(
    public reason: string,
    public status: string,
    message: string
  ) {
    super(message)
    this.name = 'ParameterDeleteError'
  }
}

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

  // Simple rename endpoint (used by dashboard)
  updateName: async (id: number, nama: string): Promise<Parameter> => {
    const response = await api.patch(`/parameters/${id}/name`, { nama })
    return response.data.data
  },

  delete: async (id: number): Promise<void> => {
    try {
      await api.delete(`/parameters/${id}`)
    } catch (error: any) {
      // Handle error response from backend
      if (error.response?.data) {
        const errorData = error.response.data as DeleteParameterError
        if (errorData.status === 'REJECTED' && errorData.reason === 'PARAMETER_IN_USE') {
          throw new ParameterDeleteError(
            errorData.reason,
            errorData.status,
            errorData.error || 'Parameter is used in workflow and cannot be deleted'
          )
        }
        // Throw generic error with backend message
        throw new ParameterDeleteError(
          errorData.reason || 'UNKNOWN',
          errorData.status || 'REJECTED',
          errorData.error || error.message || 'Failed to delete parameter'
        )
      }
      // Re-throw if not a handled error
      throw error
    }
  },
}

