export type ProtocolType = 'Modbus TCP' | 'Modbus RTU' | 'Digital Input' | 'Digital Output' | 'SNMP'

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export type SlaveStatus = 'idle' | 'polling' | 'success' | 'timeout' | 'error'

export type ModbusFunction =
  | 'Read Coils'
  | 'Read Discrete Inputs'
  | 'Read Holding Registers'
  | 'Read Input Registers'
  | 'Write Single Coil'
  | 'Write Single Register'
  | 'Write Multiple Registers'

export type DataType = 'uint16' | 'int16' | 'uint32' | 'int32' | 'float32' | 'float'

export type ByteOrder =
  | 'Big Endian (AB CD)'
  | 'Little Endian (CD AB)'
  | 'Big Endian Swap (BA DC)'
  | 'Little Endian Swap (DC BA)'

// Connection represents transport layer only - NO Slave ID
export interface Connection {
  id: string
  name: string
  protocol: ProtocolType
  status: ConnectionStatus
  config: ModbusTCPConfig | ModbusRTUConfig | DigitalIOConfig | SNMPConfig
}

export interface ModbusTCPConfig {
  host: string
  port: number
  timeout: number
  reconnectStrategy?: 'manual' | 'auto'
}

export interface ModbusRTUConfig {
  serialPort: string
  baudRate: number
  dataBits: 7 | 8
  stopBits: 1 | 2
  parity: 'none' | 'even' | 'odd'
  timeout: number
}

export interface DigitalIOConfig {
  pins: number[]
  mode: 'input' | 'output'
}

export interface SNMPConfig {
  host: string
  port: number
  community: string
  version: 'v1' | 'v2c' | 'v3'
}

// Slave/Device configuration
export interface Slave {
  id: string
  slaveId: number
  deviceName: string
  pollingOrder: number
  enabled: boolean
  status: SlaveStatus
  connectionId: string
  lastPollTime?: Date
  lastError?: string
}

export interface PollingRequest {
  slaveId: number
  slaveName: string
  timestamp: Date
}

export interface LogEntry {
  id: string
  timestamp: Date
  message: string
  type: 'info' | 'error' | 'success' | 'warning'
  connectionId?: string
  slaveId?: number
}

export type OperationType = 'add' | 'subtract' | 'multiply' | 'divide' | 'merge'

export interface RawDataField {
  id: string
  name: string
  value: number
  timestamp: Date
  source: string // e.g., "Slave 1, Address 100"
}

export interface MappingConfig {
  id: string
  outputName: string
  operation: OperationType
  operands: string[] // IDs of raw data fields
  constantValue?: number
  formula: string // custom formula like "(Slave 1 Addr 7 + Slave 1 Addr 8) / 10"
  enabled: boolean
}

export interface MappedValue {
  id: string
  parameterId?: number  // Parameter ID for edit/delete operations
  outputName: string
  rawValues: { name: string; value: number }[]
  mappedValue: number
  formula: string
  error?: string
  timestamp: Date
}

export interface SavedDashboardData {
  id: string
  connectionId: string // Added connectionId to group data by connection
  connectionName: string // Added connection name for display
  mappedValues: MappedValue[]
  savedAt: Date
}

// Dashboard data untuk real-time dari backend
export interface DashboardData {
  parameter_id: number  // Parameter ID for edit/delete operations
  device_nama: string
  parameter_nama: string
  value: number
  timestamp: string
  status: string
}

