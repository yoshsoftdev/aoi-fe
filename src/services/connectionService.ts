import api from './api'
import type { Connection, ProtocolType } from '@/types'

export interface ConnectionTestRequest {
  type: ProtocolType
  config: any
}

export interface ConnectionTestResponse {
  connected: boolean
  message: string
  details?: string
}

export const connectionService = {
  // Load existing connections (koneksi) from backend
  loadAll: async (): Promise<Connection[]> => {
    const response = await api.get('/devices')
    const items = response.data.data as any[]

    return items.map((item) => mapBackendKoneksiToConnection(item))
  },

  test: async (req: ConnectionTestRequest): Promise<ConnectionTestResponse> => {
    // Convert frontend connection config to backend format
    const backendType = convertProtocolTypeToBackend(req.type)
    const backendConfig = convertConfigToBackend(req.type, req.config)

    const response = await api.post('/parameters/test-connection', {
      type: backendType,
      config: backendConfig,
    })
    return response.data.data
  },

  // Create new connection in backend
  create: async (connection: Connection): Promise<Connection> => {
    const payload = mapConnectionToBackendPayload(connection)
    const response = await api.post('/devices', payload)
    const device = response.data.data
    return mapBackendKoneksiToConnection(device)
  },

  // Update existing connection in backend
  update: async (connection: Connection): Promise<Connection> => {
    const numericId = parseInt(connection.id, 10)
    if (!numericId) {
      // If id is not numeric (local temp), fallback to create
      return connectionService.create(connection)
    }
    const payload = mapConnectionToBackendPayload(connection)
    const response = await api.patch(`/devices/${numericId}`, payload)
    const device = response.data.data
    return mapBackendKoneksiToConnection(device)
  },

  // Delete connection in backend
  delete: async (id: string): Promise<void> => {
    const numericId = parseInt(id, 10)
    if (!numericId) return
    await api.delete(`/devices/${numericId}`)
  },
}

// Helper to map backend Koneksi → frontend Connection
function mapBackendKoneksiToConnection(koneksi: any): Connection {
  const id = String(koneksi.id)
  const name = koneksi.nama || `Koneksi ${id}`

  let protocol: ProtocolType = 'Modbus TCP'
  let config: any = {}

  switch (koneksi.type) {
    case 'modbus_tcp':
      protocol = 'Modbus TCP'
      config = {
        host: koneksi.ip_address || '',
        port: koneksi.tcp_port || 502,
        timeout: koneksi.timeout_ms || 1000,
      }
      break
    case 'modbus_rtu':
      protocol = 'Modbus RTU'
      config = {
        serialPort: koneksi.port || '',
        baudRate: koneksi.baud || 9600,
        dataBits: koneksi.data_bits || 8,
        stopBits: koneksi.stop_bits || 1,
        parity:
          koneksi.parity === 'E'
            ? 'even'
            : koneksi.parity === 'O'
              ? 'odd'
              : 'none',
        timeout: koneksi.timeout_ms || 1000,
      }
      break
    case 'snmp':
      protocol = 'SNMP'
      config = {
        host: koneksi.ip_address || '',
        port: koneksi.tcp_port || 161,
        community: 'public',
        version: 'v2c',
      }
      break
    case 'digital':
      protocol = 'Digital Input'
      config = {
        pins: [],
        mode: 'input',
      }
      break
    case 'analog':
      protocol = 'Analog Input'
      config = {
        // Placeholder, analog config belum dipakai di tester saat ini
      }
      break
    default:
      protocol = 'Modbus TCP'
      config = {
        host: '',
        port: 502,
        timeout: 1000,
      }
      break
  }

  return {
    id,
    name,
    protocol,
    status: 'disconnected',
    config,
  }
}

// Helper to map frontend Connection → backend Koneksi payload
function mapConnectionToBackendPayload(connection: Connection): any {
  let type = 'modbus_tcp'
  const cfg: any = connection.config as any
  const payload: any = {
    nama: connection.name,
    enabled: true,
  }

  switch (connection.protocol) {
    case 'Modbus TCP':
      type = 'modbus_tcp'
      payload.type = type
      payload.ip_address = cfg.host || ''
      payload.tcp_port = cfg.port || 502
      // Set default slave_id (can be overridden at parameter level)
      payload.slave_id = cfg.slaveId || 1
      // Optional: polling & timeout
      payload.polling_ms = 1000
      payload.timeout_ms = cfg.timeout || 1000
      break

    case 'Modbus RTU':
      type = 'modbus_rtu'
      payload.type = type
      payload.port = cfg.serialPort || ''
      payload.baud = cfg.baudRate || 9600
      payload.data_bits = cfg.dataBits || 8
      payload.stop_bits = cfg.stopBits || 1
      payload.parity =
        cfg.parity === 'even' ? 'E' : cfg.parity === 'odd' ? 'O' : 'N'
      // Set default slave_id (can be overridden at parameter level)
      payload.slave_id = cfg.slaveId || 1
      payload.polling_ms = 1000
      payload.timeout_ms = cfg.timeout || 1000
      break

    case 'SNMP':
      type = 'snmp'
      payload.type = type
      payload.ip_address = cfg.host || ''
      payload.tcp_port = cfg.port || 161
      payload.polling_ms = 1000
      payload.timeout_ms = 1000
      break

    case 'Digital Input':
    case 'Digital Output':
      type = 'digital'
      payload.type = type
      payload.polling_ms = 1000
      payload.timeout_ms = 1000
      break

    default:
      payload.type = 'modbus_tcp'
      payload.ip_address = cfg.host || ''
      payload.tcp_port = cfg.port || 502
      payload.polling_ms = 1000
      payload.timeout_ms = cfg.timeout || 1000
      break
  }

  return payload
}

function convertProtocolTypeToBackend(protocol: ProtocolType): string {
  switch (protocol) {
    case 'Modbus TCP':
      return 'modbus_tcp'
    case 'Modbus RTU':
      return 'modbus_rtu'
    case 'SNMP':
      return 'snmp'
    case 'Digital Input':
    case 'Digital Output':
      // Digital I/O tidak ada test connection di backend, return empty
      return ''
    default:
      return ''
  }
}

function convertConfigToBackend(protocol: ProtocolType, config: any): any {
  switch (protocol) {
    case 'Modbus TCP':
      return {
        ip_address: config.host,
        port: config.port || 502,
        slave_id: 1, // Default slave_id untuk test connection
        function_code: 3, // Read Holding Registers
        register_address: 0, // Default address untuk test
        quantity: 1, // Read 1 register untuk test
        byte_order: 'ABCD',
        data_type: 'uint16',
      }
    case 'Modbus RTU':
      return {
        port: config.serialPort,
        baud: config.baudRate || 9600,
        data_bits: config.dataBits || 8,
        parity: config.parity === 'none' ? 'N' : config.parity === 'even' ? 'E' : 'O',
        stop_bits: config.stopBits || 1,
        slave_id: 1, // Default slave_id untuk test connection
        function_code: 3, // Read Holding Registers
        register_address: 0, // Default address untuk test
        quantity: 1, // Read 1 register untuk test
        byte_order: 'ABCD',
        data_type: 'uint16',
      }
    case 'SNMP':
      return {
        ip_address: config.host,
        port: config.port || 161,
        community: config.community || 'public',
        version: config.version || 'v2c',
        oid: '1.3.6.1.2.1.1.1.0', // sysDescr - default OID untuk test
      }
    default:
      return {}
  }
}

