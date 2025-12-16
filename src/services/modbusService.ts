import api from './api'
import { ModbusRTU, ModbusTCP } from '@/types/parameter'

export const modbusService = {
  // RTU
  getAllRTU: async (): Promise<ModbusRTU[]> => {
    const response = await api.get('/modbus/rtu')
    return response.data.data
  },

  getRTUById: async (id: number): Promise<ModbusRTU> => {
    const response = await api.get(`/modbus/rtu/${id}`)
    return response.data.data
  },

  createRTU: async (config: Omit<ModbusRTU, 'id' | 'created_at' | 'updated_at'>): Promise<ModbusRTU> => {
    const response = await api.post('/modbus/rtu', config)
    return response.data.data
  },

  updateRTU: async (id: number, config: Partial<ModbusRTU>): Promise<ModbusRTU> => {
    const response = await api.patch(`/modbus/rtu/${id}`, config)
    return response.data.data
  },

  deleteRTU: async (id: number): Promise<void> => {
    await api.delete(`/modbus/rtu/${id}`)
  },

  // TCP
  getAllTCP: async (): Promise<ModbusTCP[]> => {
    const response = await api.get('/modbus/tcp')
    return response.data.data
  },

  getTCPById: async (id: number): Promise<ModbusTCP> => {
    const response = await api.get(`/modbus/tcp/${id}`)
    return response.data.data
  },

  createTCP: async (config: Omit<ModbusTCP, 'id' | 'created_at' | 'updated_at'>): Promise<ModbusTCP> => {
    const response = await api.post('/modbus/tcp', config)
    return response.data.data
  },

  updateTCP: async (id: number, config: Partial<ModbusTCP>): Promise<ModbusTCP> => {
    const response = await api.patch(`/modbus/tcp/${id}`, config)
    return response.data.data
  },

  deleteTCP: async (id: number): Promise<void> => {
    await api.delete(`/modbus/tcp/${id}`)
  },
}

