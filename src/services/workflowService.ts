import api from './api'

export interface Workflow {
  id: number
  nama: string
  description: string
  enabled: boolean
  created_at: string
  updated_at: string
  conditions?: WorkflowCondition[]
  actions?: WorkflowAction[]
}

export interface WorkflowCondition {
  id?: number
  workflow_id?: number
  parameter_id: number
  operator: '>' | '<' | '>=' | '<=' | '==' | '!='
  threshold: number
  created_at?: string
  parameter?: {
    id: number
    nama: string
    unit?: string
  }
}

export interface WorkflowAction {
  id?: number
  workflow_id?: number
  action_type: 'TRIGGER_WRITE' | 'WRITE_WITH_VALUE' | 'event' | 'delay' | 'alarm' | 'write' // 'write' is legacy
  action_order?: number // Urutan eksekusi action (0, 1, 2, ...), actions dieksekusi secara sequential
  parameter_id?: number
  value?: number // Required for WRITE_WITH_VALUE, not allowed for TRIGGER_WRITE
  event_name?: string
  delay_ms?: number
  alarm_message?: string // Required for 'alarm' action
  created_at?: string
  parameter?: {
    id: number
    nama: string
    unit?: string
    write_mode?: 'PRESET' | 'DYNAMIC' // For display purposes
  }
}

export interface CreateWorkflowRequest {
  nama: string
  description?: string
  enabled?: boolean
  conditions: Omit<WorkflowCondition, 'id' | 'workflow_id' | 'created_at' | 'parameter'>[]
  actions: Omit<WorkflowAction, 'id' | 'workflow_id' | 'created_at' | 'parameter'>[]
}

export interface UpdateWorkflowRequest {
  nama?: string
  description?: string
  enabled?: boolean
  conditions?: Omit<WorkflowCondition, 'id' | 'workflow_id' | 'created_at' | 'parameter'>[]
  actions?: Omit<WorkflowAction, 'id' | 'workflow_id' | 'created_at' | 'parameter'>[]
}

export const workflowService = {
  getAll: async (): Promise<Workflow[]> => {
    const response = await api.get('/workflows')
    return response.data.data || []
  },

  getById: async (id: number): Promise<Workflow> => {
    const response = await api.get(`/workflows/${id}`)
    return response.data.data
  },

  create: async (workflow: CreateWorkflowRequest): Promise<Workflow> => {
    const response = await api.post('/workflows', workflow)
    return response.data.data
  },

  update: async (id: number, workflow: UpdateWorkflowRequest): Promise<Workflow> => {
    const response = await api.patch(`/workflows/${id}`, workflow)
    return response.data.data
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/workflows/${id}`)
  },
}

