import { useMemo } from 'react'
import {
  generateModbusRTUHex,
  generateModbusTCPHex,
  getHexPreviewDescription,
} from '@/utils/modbusHexPreview'

interface HexPreviewProps {
  protocol: string
  slaveId: number
  functionCode: number
  address: number
  quantity: number
}

export function HexPreview({
  protocol,
  slaveId,
  functionCode,
  address,
  quantity,
}: HexPreviewProps) {
  const hexString = useMemo(() => {
    if (protocol === 'Modbus RTU') {
      return generateModbusRTUHex(slaveId, functionCode, address, quantity)
    } else if (protocol === 'Modbus TCP') {
      // Use a random transaction ID for preview (will be different in actual request)
      const transactionId = Math.floor(Math.random() * 65536)
      return generateModbusTCPHex(transactionId, slaveId, functionCode, address, quantity)
    }
    return ''
  }, [protocol, slaveId, functionCode, address, quantity])

  const description = useMemo(
    () => getHexPreviewDescription(protocol, slaveId, functionCode, address, quantity),
    [protocol, slaveId, functionCode, address, quantity]
  )

  if (!hexString) {
    return null
  }

  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{description}</p>
      <div className="flex items-center gap-2">
        <code className="text-sm font-mono text-foreground font-semibold">{hexString}</code>
        <span className="text-xs text-muted-foreground">
          ({hexString.split(' ').length} bytes)
        </span>
      </div>
      {protocol === 'Modbus TCP' && (
        <p className="text-xs text-muted-foreground italic">
          Note: Transaction ID will be different in actual request
        </p>
      )}
    </div>
  )
}

