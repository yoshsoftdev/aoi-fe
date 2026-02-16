import api from './api'

export interface Workflow {
  id: number
  nama: string
  description: string
  enabled: boolean
  version?: number // 1 = flat, 2 = tree (default: 1)
  tree_data?: WorkflowTree // For version 2
  created_at: string
  updated_at: string
  conditions?: WorkflowCondition[] // For version 1
  actions?: WorkflowAction[] // For version 1
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
  action_type: 'TRIGGER_WRITE' | 'WRITE_WITH_VALUE' | 'WRITE_INTERNAL' | 'event' | 'delay' | 'alarm' | 'write' // 'write' is legacy
  action_order?: number // Urutan eksekusi action (0, 1, 2, ...), actions dieksekusi secara sequential
  parameter_id?: number
  value?: number // Required for WRITE_WITH_VALUE, WRITE_INTERNAL, not allowed for TRIGGER_WRITE
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

// Tree-based workflow types (version 2)
export interface WorkflowTree {
  id?: string
  name: string
  trigger: TriggerNode
  root: TreeNode
}

export interface TriggerNode {
  type: 'PARAMETER_CHANGED' | 'SETPOINT_CHANGED'
  source_id: number
  parameter?: string
}

export interface TreeNode {
  type: 'if' | 'action'
  id?: string
  condition?: Condition
  then?: TreeNode[]
  else?: TreeNode[]
  action_type?: 'ALARM_NOTIFICATION' | 'WRITE_DYNAMIC' | 'WRITE_PRESET'
  action_data?: Record<string, any>
}

export interface Condition {
  left: ValueSource
  operator: '>' | '<' | '>=' | '<=' | '==' | '!='
  right: ValueSource
}

export interface ValueSource {
  type: 'parameter' | 'setpoint' | 'static'
  source_id?: number
  value?: number
  parameter?: string
}

export interface CreateWorkflowRequest {
  nama: string
  description?: string
  enabled?: boolean
  version?: number // 1 = flat, 2 = tree (default: 1)
  conditions?: Omit<WorkflowCondition, 'id' | 'workflow_id' | 'created_at' | 'parameter'>[] // For version 1
  actions?: Omit<WorkflowAction, 'id' | 'workflow_id' | 'created_at' | 'parameter'>[] // For version 1
  tree_data?: WorkflowTree // For version 2
}

export interface UpdateWorkflowRequest {
  nama?: string
  description?: string
  enabled?: boolean
  version?: number
  conditions?: Omit<WorkflowCondition, 'id' | 'workflow_id' | 'created_at' | 'parameter'>[] // For version 1
  actions?: Omit<WorkflowAction, 'id' | 'workflow_id' | 'created_at' | 'parameter'>[] // For version 1
  tree_data?: WorkflowTree // For version 2
}

export const workflowService = {
  getAll: async (): Promise<Workflow[]> => {
    const response = await api.get('/workflows')
    const workflows = response.data.data || []
    
    // Parse tree_data for version 2 workflows
    return workflows.map((workflow: Workflow) => {
      if (workflow.version === 2 && workflow.tree_data && typeof workflow.tree_data === 'string') {
        try {
          workflow.tree_data = JSON.parse(workflow.tree_data)
        } catch (error) {
          console.error('Failed to parse tree_data for workflow', workflow.id, ':', error)
        }
      }
      return workflow
    })
  },

  getById: async (id: number): Promise<Workflow> => {
    const response = await api.get(`/workflows/${id}`)
    const workflow = response.data.data
    
    // Parse tree_data if it's a string (from backend JSON)
    if (workflow.version === 2 && workflow.tree_data && typeof workflow.tree_data === 'string') {
      try {
        workflow.tree_data = JSON.parse(workflow.tree_data)
      } catch (error) {
        console.error('Failed to parse tree_data:', error)
      }
    }
    
    return workflow
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

