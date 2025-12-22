/**
 * Calculate Modbus RTU CRC16 checksum
 */
function calculateCRC16(data: number[]): number {
  let crc = 0xffff
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i]
    for (let j = 0; j < 8; j++) {
      if (crc & 0x0001) {
        crc = (crc >> 1) ^ 0xa001
      } else {
        crc >>= 1
      }
    }
  }
  return crc
}

/**
 * Format number as 2-digit hex string
 */
function toHex(value: number): string {
  return value.toString(16).toUpperCase().padStart(2, '0')
}

/**
 * Generate Modbus RTU request hex preview
 */
export function generateModbusRTUHex(
  slaveId: number,
  functionCode: number,
  address: number,
  quantity: number
): string {
  // Build request frame (without CRC)
  const frame: number[] = [
    slaveId,
    functionCode,
    (address >> 8) & 0xff, // Address high byte
    address & 0xff, // Address low byte
    (quantity >> 8) & 0xff, // Quantity high byte
    quantity & 0xff, // Quantity low byte
  ]

  // Calculate CRC16
  const crc = calculateCRC16(frame)

  // Add CRC (little endian: low byte first, then high byte)
  frame.push(crc & 0xff) // CRC low byte
  frame.push((crc >> 8) & 0xff) // CRC high byte

  // Format as hex string with spaces
  return frame.map(toHex).join(' ')
}

/**
 * Generate Modbus TCP request hex preview
 */
export function generateModbusTCPHex(
  transactionId: number,
  unitId: number,
  functionCode: number,
  address: number,
  quantity: number
): string {
  // MBAP Header
  const mbapHeader: number[] = [
    (transactionId >> 8) & 0xff, // Transaction ID high byte
    transactionId & 0xff, // Transaction ID low byte
    0x00, // Protocol ID high byte (always 0)
    0x00, // Protocol ID low byte (always 0)
  ]

  // PDU (Protocol Data Unit)
  const pdu: number[] = [
    functionCode,
    (address >> 8) & 0xff, // Address high byte
    address & 0xff, // Address low byte
    (quantity >> 8) & 0xff, // Quantity high byte
    quantity & 0xff, // Quantity low byte
  ]

  // Calculate length (Unit ID + PDU length)
  const length = 1 + pdu.length // Unit ID (1 byte) + PDU length

  mbapHeader.push((length >> 8) & 0xff) // Length high byte
  mbapHeader.push(length & 0xff) // Length low byte
  mbapHeader.push(unitId) // Unit ID (Slave ID)

  // Combine MBAP Header + PDU
  const frame = [...mbapHeader, ...pdu]

  // Format as hex string with spaces
  return frame.map(toHex).join(' ')
}

/**
 * Generate hex preview description
 */
export function getHexPreviewDescription(
  protocol: string,
  slaveId: number,
  functionCode: number,
  address: number,
  quantity: number
): string {
  const functionCodeName: Record<number, string> = {
    1: 'Read Coils',
    2: 'Read Discrete Inputs',
    3: 'Read Holding Registers',
    4: 'Read Input Registers',
    5: 'Write Single Coil',
    6: 'Write Single Register',
    15: 'Write Multiple Coils',
    16: 'Write Multiple Registers',
  }

  const fcName = functionCodeName[functionCode] || `Function Code ${functionCode}`

  if (protocol === 'Modbus RTU') {
    return `RTU Request: Slave ${slaveId}, ${fcName} (FC=${functionCode}), Address=${address}, Quantity=${quantity}`
  } else if (protocol === 'Modbus TCP') {
    return `TCP Request: Unit ID ${slaveId}, ${fcName} (FC=${functionCode}), Address=${address}, Quantity=${quantity}`
  }

  return ''
}

