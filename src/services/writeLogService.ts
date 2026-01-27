import api from './api'

export interface WriteLog {
  id: number
  parameter_id: number
  parameter_nama: string
  device_id: number
  device_nama: string
  write_mode: 'TEST' | 'MANUAL' | 'PRESET' | 'TRIGGER'
  value?: number
  register_values?: string // JSON string
  success: boolean
  message?: string
  error?: string
  read_back_value?: number
  workflow_id?: number
  workflow_nama?: string
  triggered_by: 'MANUAL' | 'WORKFLOW' | 'API'
  created_at: string
}

export interface WriteLogMeta {
  total: number
}

export interface WriteLogResponse {
  success: boolean
  data: WriteLog[]
  meta?: WriteLogMeta
}

export const writeLogService = {
  getAll: async (limit?: number): Promise<WriteLog[]> => {
    const params = limit ? { limit: limit.toString() } : {}
    const response = await api.get<WriteLogResponse>('/write-logs', { params })
    return response.data.data || []
  },

  getById: async (id: number): Promise<WriteLog> => {
    const response = await api.get<{ success: boolean; data: WriteLog }>(`/write-logs/${id}`)
    return response.data.data
  },

  getByParameterId: async (parameterId: number, limit?: number): Promise<WriteLog[]> => {
    const params = limit ? { limit: limit.toString() } : {}
    const response = await api.get<WriteLogResponse>(`/write-logs/parameter/${parameterId}`, { params })
    return response.data.data || []
  },

  getByWorkflowId: async (workflowId: number, limit?: number): Promise<WriteLog[]> => {
    const params = limit ? { limit: limit.toString() } : {}
    const response = await api.get<WriteLogResponse>(`/write-logs/workflow/${workflowId}`, { params })
    return response.data.data || []
  },

  getByDateRange: async (startDate: string, endDate: string, limit?: number): Promise<WriteLog[]> => {
    const params: Record<string, string> = {
      start_date: startDate,
      end_date: endDate,
    }
    if (limit) {
      params.limit = limit.toString()
    }
    const response = await api.get<WriteLogResponse>('/write-logs/date-range', { params })
    return response.data.data || []
  },
}

