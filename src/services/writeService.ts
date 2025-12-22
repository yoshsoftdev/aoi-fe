import api from './api'

export type WriteMode = 'TEST' | 'MANUAL' | 'PRESET'

export interface WriteRequest {
  mode: WriteMode
  value?: number
  preset_id?: number
}

export interface WriteResponse {
  success: boolean
  message: string
  data?: {
    read_back_value?: number
  }
  error?: string
}

export interface ParameterPreset {
  id: number
  parameter_id: number
  name: string
  value_type: 'scalar' | 'bitmask' | 'raw_register'
  value: string // JSON string
  description?: string
  created_at: string
  updated_at: string
}

export const writeService = {
  // Write to a parameter (legacy endpoint)
  write: async (parameterId: number, request: WriteRequest): Promise<WriteResponse> => {
    const response = await api.post(`/parameters/${parameterId}/write`, request)
    return {
      success: response.data.success,
      message: response.data.message || '',
      data: response.data.data,
      error: response.data.error,
    }
  },

  // Execute write (new endpoint matching requirement)
  execute: async (parameterId: number, mode: 'preset' | 'manual' | 'test', presetId?: number, registerValues?: number[]): Promise<WriteResponse> => {
    const payload: any = {
      parameter_id: parameterId,
      mode: mode,
    }
    if (mode === 'preset' && presetId) {
      payload.preset_id = presetId
    }
    if ((mode === 'manual' || mode === 'test') && registerValues) {
      payload.register_values = registerValues
    }

    const response = await api.post('/write/execute', payload)
    return {
      success: response.data.success,
      message: response.data.message || '',
      data: response.data.read_back_value !== undefined ? { read_back_value: response.data.read_back_value } : undefined,
      error: response.data.error,
    }
  },

  // Get presets for a parameter
  getPresets: async (parameterId: number): Promise<ParameterPreset[]> => {
    // Note: This endpoint needs to be created in backend
    // For now, we'll use a placeholder
    try {
      const response = await api.get(`/parameters/${parameterId}/presets`)
      return response.data.data || []
    } catch (error) {
      // If endpoint doesn't exist yet, return empty array
      return []
    }
  },

  // Test write without creating parameter in database
  testWrite: async (config: {
    device_id: number
    protocol: 'modbus_rtu' | 'modbus_tcp'
    slave_id: number
    function_code: number
    register_address: number
    quantity: number
    data_type?: string
    byte_order?: string
    register_values: number[]
  }): Promise<WriteResponse> => {
    const response = await api.post('/write/test', config)
    return {
      success: response.data.success,
      message: response.data.message || '',
      data: response.data.read_back_value !== undefined ? { read_back_value: response.data.read_back_value } : undefined,
      error: response.data.error,
    }
  },
}

