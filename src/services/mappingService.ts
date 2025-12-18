import api from './api'

export interface FormulaVariable {
  name: string // "a", "b", etc.
  source_parameter_id?: number // Direct reference via parameter ID
  source_parameter_name?: string // Reference via parameter name
}

export interface MappingData {
  type?: 'raw' | 'formula' // Explicit type - if not provided, auto-detect
  outputName: string
  
  // For RAW parameter
  formula?: string // Simple formula (value * 2) - not field reference
  slaveId?: number
  functionCode?: number
  registerAddress?: number
  quantity?: number
  dataType?: string
  byteOrder?: string
  oid?: string // For SNMP
  
  // For FORMULA parameter
  expression?: string // "a * 2" or "(a + b) / 2"
  variables?: FormulaVariable[]
}

export interface SaveMappingRequest {
  connection: {
    name: string
    protocol: string
    config: Record<string, any>
  }
  koneksi_id?: number // If provided, use existing koneksi instead of creating new one
  mappings: MappingData[]
}

export interface SaveMappingResponse {
  success: boolean
  data: {
    koneksi_id: number
    koneksi_name: string
    parameters_count: number
  }
  message: string
}

export const mappingService = {
  save: async (req: SaveMappingRequest): Promise<SaveMappingResponse> => {
    const response = await api.post('/mapping/save', req)
    return response.data
  },
}

