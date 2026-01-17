import api from './api'

export interface CurrentAlarm {
  id: number
  workflow_id: number
  workflow_name: string
  parameter_id: number
  parameter_name?: string
  alarm_message: string
  triggered_at: string
  created_at: string
  updated_at: string
}

export const alarmService = {
  getAll: async (): Promise<CurrentAlarm[]> => {
    const response = await api.get('/alarms')
    return response.data.data || []
  },

  deleteById: async (id: number): Promise<void> => {
    await api.delete(`/alarms/${id}`)
  },

  deleteByWorkflowId: async (workflowId: number): Promise<void> => {
    await api.delete(`/alarms/workflow/${workflowId}`)
  },
}

