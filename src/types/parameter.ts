export interface Parameter {
  id: number
  device_id: number
  nama: string
  type: 'modbus_rtu' | 'modbus_tcp' | 'analog_input' | 'analog_output' | 'digital_input' | 'digital_output' | 'snmp'
  direction: 'READ' | 'WRITE' // READ (polling/scheduler) or WRITE (command/on-demand)
  read_write: boolean // Deprecated: use direction instead
  write_mode?: 'PRESET' | 'DYNAMIC' // PRESET (value stored) or DYNAMIC (value provided at write time) - only for WRITE parameters
  preset_value?: string // JSON-encoded preset value - only for PRESET mode
  unit?: string
  custom_rumus?: string
  description?: string
  created_at: string
  updated_at: string
  device?: any
}

export interface ModbusRTU {
  id: number
  id_parameter: number
  read_write: boolean
  slave_id: number // Parameter-level slave ID (can override device-level)
  function_code: number
  register_address: number
  quantity: number
  byte_order: string
  data_type: string // uint16, uint32, int32, float32, float64
  scaling: number
  polling_ms?: number // Optional: override device-level polling
  description?: string
  created_at: string
  updated_at: string
  parameter?: Parameter
}

export interface ModbusTCP {
  id: number
  id_parameter: number
  read_write: boolean
  slave_id: number // Parameter-level slave ID (can override device-level)
  function_code: number
  register_address: number
  quantity: number
  byte_order: string
  data_type: string // uint16, uint32, int32, float32, float64
  scaling: number
  polling_ms?: number // Optional: override device-level polling
  description?: string
  created_at: string
  updated_at: string
  parameter?: Parameter
}

export interface SNMPConfig {
  id: number
  id_parameter: number
  version: 'v1' | 'v2c' | 'v3'
  community: string
  oid: string
  ip_address: string
  port: number
  polling_ms: number
  description?: string
  created_at: string
  updated_at: string
  parameter?: Parameter
}

// Keep SNMP as alias for backward compatibility
export type SNMP = SNMPConfig

export interface RealtimeData {
  parameter_id: number
  parameter_nama: string
  parameter_type: string
  raw_value: any
  processed_value: any
  custom_rumus?: string
  timestamp: string
  status: 'online' | 'offline' | 'error'
  error?: string
}

// Simplified dashboard data structure (only device name, parameter name, and final value)
export interface DashboardData {
  parameter_id?: number  // Optional parameter ID for edit/delete operations
  device_nama: string
  parameter_nama: string
  value: any // Final processed value
  timestamp: string
  status: 'online' | 'offline' | 'error' | string  // Allow string for backward compatibility
}

