import api from './api'

export interface FormulaVariable {
  name: string // "a", "b", etc.
  source_parameter_id?: number // Direct reference via parameter ID
  source_parameter_name?: string // Reference via parameter name
}

export interface MappingData {
  output_type: 'DIRECT' | 'FORMULA' // Explicit output type - REQUIRED, no auto-detect
  outputName: string
  
  // For DIRECT type
  source_parameter_id?: number // Source parameter ID for DIRECT (single source only)
  source_field?: string // Source field name (e.g., "Slave 1 Addr 7")
  slaveId?: number
  functionCode?: number
  registerAddress?: number
  quantity?: number
  dataType?: string
  byteOrder?: string
  oid?: string // For SNMP
  
  // For FORMULA type
  formula?: string // Formula expression like "(Slave 1 Addr 7 + Slave 1 Addr 8) / 10"
  expression?: string // Normalized expression "a * 2" or "(a + b) / 2"
  variables?: FormulaVariable[]
  source_parameter_ids?: number[] // Multiple source parameter IDs for FORMULA
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
    clean_parameters: Array<{
      id: number
      nama: string
    }>
  }
  message: string
}

export const mappingService = {
  save: async (req: SaveMappingRequest): Promise<SaveMappingResponse> => {
    const response = await api.post('/mapping/save', req)
    return response.data
  },
}

