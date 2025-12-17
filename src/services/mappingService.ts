import api from './api'

export interface SaveMappingRequest {
  connection: {
    name: string
    protocol: string
    config: Record<string, any>
  }
  koneksi_id?: number // If provided, use existing koneksi instead of creating new one
  mappings: Array<{
    outputName: string
    formula: string
    slaveId?: number
    functionCode?: number
    registerAddress?: number
    quantity?: number
    dataType?: string
    byteOrder?: string
    oid?: string
  }>
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

