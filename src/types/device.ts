export interface Device {
  id: number
  nama: string
  type: 'modbus_rtu' | 'modbus_tcp' | 'snmp' | 'analog' | 'digital'
  enabled: boolean
  description?: string
  
  // Modbus RTU Configuration
  port?: string
  baud?: number
  data_bits?: number
  parity?: 'N' | 'E' | 'O'
  stop_bits?: number
  
  // Modbus TCP Configuration
  ip_address?: string
  tcp_port?: number
  
  // Common Modbus Settings
  slave_id?: number
  
  // Polling Configuration
  polling_ms: number
  timeout_ms: number
  retry_count: number
  
  created_at: string
  updated_at: string
  
  // Relationships
  parameters?: any[]
}

export interface DeviceCreateRequest {
  nama: string
  type: Device['type']
  enabled?: boolean
  description?: string
  
  // Modbus RTU
  port?: string
  baud?: number
  data_bits?: number
  parity?: 'N' | 'E' | 'O'
  stop_bits?: number
  
  // Modbus TCP
  ip_address?: string
  tcp_port?: number
  
  // Common Modbus
  slave_id?: number
  
  // Polling
  polling_ms?: number
  timeout_ms?: number
  retry_count?: number
}

