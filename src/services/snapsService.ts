import api from './api'
import type { DashboardData } from '@/types/parameter'

export interface SnapshotData {
  parameter_id: number
  parameter_nama: string
  device_nama: string
  value: any
  status: 'online' | 'offline' | 'error' | string
  alarmstatus?: string
  timestamp: string
  unit?: string
  error?: string
}

export interface SnapsResponse {
  success: boolean
  data: SnapshotData[]
  meta?: {
    total: number
  }
}

export const snapsService = {
  getAll: async (): Promise<SnapshotData[]> => {
    const response = await api.get<SnapsResponse>('/snaps')
    return response.data.data
  },
}

