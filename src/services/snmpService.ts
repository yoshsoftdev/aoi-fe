import api from './api'
import { SNMP } from '@/types/parameter'

export const snmpService = {
  getAll: async (): Promise<SNMP[]> => {
    const response = await api.get('/snmp')
    return response.data.data
  },

  getById: async (id: number): Promise<SNMP> => {
    const response = await api.get(`/snmp/${id}`)
    return response.data.data
  },

  create: async (config: Omit<SNMP, 'id' | 'created_at' | 'updated_at'>): Promise<SNMP> => {
    const response = await api.post('/snmp', config)
    return response.data.data
  },

  update: async (id: number, config: Partial<SNMP>): Promise<SNMP> => {
    const response = await api.patch(`/snmp/${id}`, config)
    return response.data.data
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/snmp/${id}`)
  },
}

