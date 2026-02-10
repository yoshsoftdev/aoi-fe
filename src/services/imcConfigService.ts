import api from './api'

export interface IMCParameterConfig {
  id: number
  card_key: string
  parameter_id?: number
  created_at: string
  updated_at: string
  parameter?: {
    id: number
    nama: string
  }
}

export interface CreateOrUpdateIMCConfigRequest {
  card_key: string
  parameter_id?: number | null | undefined
}

export const imcConfigService = {
  getAll: async (): Promise<IMCParameterConfig[]> => {
    const response = await api.get('/imc-config')
    return response.data.data
  },

  getByCardKey: async (cardKey: string): Promise<IMCParameterConfig> => {
    const response = await api.get(`/imc-config/${cardKey}`)
    return response.data.data
  },

  createOrUpdate: async (payload: CreateOrUpdateIMCConfigRequest): Promise<IMCParameterConfig> => {
    const response = await api.post('/imc-config', payload)
    return response.data.data
  },

  delete: async (cardKey: string): Promise<void> => {
    await api.delete(`/imc-config/${cardKey}`)
  },
}
