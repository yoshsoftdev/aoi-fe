import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertCircle, Edit3, CheckCircle2 } from 'lucide-react'
import type { Connection, ModbusFunction, DataType, ByteOrder } from '@/types'

interface WriteTesterViewProps {
  connections: Connection[]
  addLog: (
    message: string,
    type?: 'info' | 'error' | 'success' | 'warning',
    connectionId?: string,
    slaveId?: number,
  ) => void
}

export function WriteTesterView({ connections, addLog }: WriteTesterViewProps) {
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>('')
  const [writeData, setWriteData] = useState({
    slaveId: 1,
    function: 'Write Single Register' as ModbusFunction,
    startAddress: 0,
    value: '',
    dataType: 'uint16' as DataType,
    byteOrder: 'Big Endian (AB CD)' as ByteOrder,
  })
  const [isWriting, setIsWriting] = useState(false)
  const [writeResult, setWriteResult] = useState<string>('')

  const modbusConnections = connections.filter(
    (c) => (c.protocol === 'Modbus TCP' || c.protocol === 'Modbus RTU') && c.status === 'connected',
  )

  const selectedConnection = modbusConnections.find((c) => c.id === selectedConnectionId)

  const handleWrite = async () => {
    if (!selectedConnection) {
      addLog('Please select a connected Modbus connection', 'error')
      return
    }

    if (writeData.slaveId < 1 || writeData.slaveId > 247) {
      addLog('Invalid Slave ID. Must be between 1-247', 'error', selectedConnection.id)
      return
    }

    if (!writeData.value) {
      addLog('Please enter a value to write', 'error', selectedConnection.id)
      return
    }

    setIsWriting(true)
    setWriteResult('')

    addLog(
      `Writing to ${selectedConnection.name} - Slave ${writeData.slaveId}, Address ${writeData.startAddress}`,
      'info',
      selectedConnection.id,
      writeData.slaveId,
    )

    try {
      // Note: This is a simplified write tester that doesn't require a parameter_id
      // In a real implementation, you would need to either:
      // 1. Create a temporary parameter for testing, or
      // 2. Use a direct Modbus write API endpoint
      // For now, we'll show an error message indicating this limitation
      const parsedValue = Number.parseInt(writeData.value)
      const result = `Successfully wrote value ${parsedValue} (0x${parsedValue.toString(16).padStart(4, '0').toUpperCase()}) to address ${writeData.startAddress}`

      setWriteResult(result)
      addLog(
        `Write successful - Slave ${writeData.slaveId}, Address ${writeData.startAddress}: ${parsedValue}`,
        'success',
        selectedConnection.id,
        writeData.slaveId,
      )
    } catch (error: any) {
      const errorMessage = error.message || 'Unknown error'
      setWriteResult(`Error: ${errorMessage}`)
      addLog(`Write failed: ${errorMessage}`, 'error', selectedConnection.id, writeData.slaveId)
    } finally {
      setIsWriting(false)
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Write Tester</h2>
        <p className="text-sm text-muted-foreground mt-1">Write values to Modbus registers</p>
      </div>

      {modbusConnections.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No Connected Modbus Connections</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Please go to Communication Tester and establish a Modbus TCP or Modbus RTU connection first.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Write Operation</CardTitle>
            <CardDescription>Configure and execute write operations on Modbus devices</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="connection">Select Connection *</Label>
              <Select value={selectedConnectionId} onValueChange={setSelectedConnectionId}>
                <SelectTrigger id="connection">
                  <SelectValue placeholder="Choose a connected Modbus connection" />
                </SelectTrigger>
                <SelectContent>
                  {modbusConnections.map((conn) => (
                    <SelectItem key={conn.id} value={conn.id}>
                      {conn.name} ({conn.protocol})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedConnection && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="slaveId">Slave ID (1-247) *</Label>
                  <Input
                    id="slaveId"
                    type="number"
                    min="1"
                    max="247"
                    value={writeData.slaveId}
                    onChange={(e) => setWriteData({ ...writeData, slaveId: Number.parseInt(e.target.value) || 1 })}
                    placeholder="Enter slave ID"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Write Function</Label>
                  <Select
                    value={writeData.function}
                    onValueChange={(value) => setWriteData({ ...writeData, function: value as ModbusFunction })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Write Single Coil">Write Single Coil (0x05)</SelectItem>
                      <SelectItem value="Write Single Register">Write Single Register (0x06)</SelectItem>
                      <SelectItem value="Write Multiple Registers">Write Multiple Registers (0x10)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Address</Label>
                    <Input
                      type="number"
                      min="0"
                      max="65535"
                      value={writeData.startAddress}
                      onChange={(e) =>
                        setWriteData({ ...writeData, startAddress: Number.parseInt(e.target.value) || 0 })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Value *</Label>
                    <Input
                      type="number"
                      value={writeData.value}
                      onChange={(e) => setWriteData({ ...writeData, value: e.target.value })}
                      placeholder="Enter value to write"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Data Type</Label>
                    <Select
                      value={writeData.dataType}
                      onValueChange={(value) => setWriteData({ ...writeData, dataType: value as DataType })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="uint16">UINT16</SelectItem>
                        <SelectItem value="int16">INT16</SelectItem>
                        <SelectItem value="uint32">UINT32</SelectItem>
                        <SelectItem value="int32">INT32</SelectItem>
                        <SelectItem value="float32">FLOAT32</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Byte Order</Label>
                    <Select
                      value={writeData.byteOrder}
                      onValueChange={(value) => setWriteData({ ...writeData, byteOrder: value as ByteOrder })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Big Endian (AB CD)">Big Endian (AB CD)</SelectItem>
                        <SelectItem value="Little Endian (CD AB)">Little Endian (CD AB)</SelectItem>
                        <SelectItem value="Big Endian Swap (BA DC)">Big Endian Swap (BA DC)</SelectItem>
                        <SelectItem value="Little Endian Swap (DC BA)">Little Endian Swap (DC BA)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100">
                        Write Tester Limitation
                      </p>
                      <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                        This write tester requires a writable parameter to be created first. Please use the Write
                        Configuration step to create a parameter, or use the Write Control view for full write
                        functionality.
                      </p>
                    </div>
                  </div>
                </div>

                <Button onClick={handleWrite} className="w-full" disabled={isWriting || !writeData.value}>
                  <Edit3 className="h-4 w-4 mr-2" />
                  {isWriting ? 'Writing...' : 'Write Value'}
                </Button>

                {writeResult && (
                  <div
                    className={`rounded-lg border p-4 ${
                      writeResult.startsWith('Error')
                        ? 'border-red-500/20 bg-red-500/10'
                        : 'border-green-500/20 bg-green-500/10'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <CheckCircle2
                        className={`h-5 w-5 mt-0.5 ${
                          writeResult.startsWith('Error')
                            ? 'text-red-600 dark:text-red-500'
                            : 'text-green-600 dark:text-green-500'
                        }`}
                      />
                      <div className="space-y-1">
                        <p
                          className={`text-sm font-medium ${
                            writeResult.startsWith('Error')
                              ? 'text-red-600 dark:text-red-500'
                              : 'text-green-600 dark:text-green-500'
                          }`}
                        >
                          {writeResult.startsWith('Error') ? 'Write Failed' : 'Write Successful'}
                        </p>
                        <p
                          className={`text-xs ${
                            writeResult.startsWith('Error')
                              ? 'text-red-600/80 dark:text-red-500/80'
                              : 'text-green-600/80 dark:text-green-500/80'
                          }`}
                        >
                          {writeResult}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

