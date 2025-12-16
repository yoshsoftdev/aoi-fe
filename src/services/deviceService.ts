import api from './api'
import { Device, DeviceCreateRequest } from '@/types/device'

export const deviceService = {
  getAll: async (): Promise<Device[]> => {
    const response = await api.get('/devices')
    return response.data.data
  },

  getByID: async (id: number): Promise<Device> => {
    const response = await api.get(`/devices/${id}`)
    return response.data.data
  },

  getByType: async (type: string): Promise<Device[]> => {
    const response = await api.get(`/devices/type?type=${type}`)
    return response.data.data
  },

  create: async (device: DeviceCreateRequest): Promise<Device> => {
    const response = await api.post('/devices', device)
    return response.data.data
  },

  update: async (id: number, device: Partial<DeviceCreateRequest>): Promise<Device> => {
    const response = await api.patch(`/devices/${id}`, device)
    return response.data.data
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/devices/${id}`)
  },

  testConnection: async (id: number): Promise<{ connected: boolean; message: string }> => {
    const response = await api.post(`/devices/${id}/test-connection`)
    return response.data.data
  },
}

