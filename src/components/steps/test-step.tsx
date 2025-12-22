import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Activity, AlertCircle, ArrowRight } from 'lucide-react'
import type { Connection, ModbusFunction, DataType, ByteOrder, RawDataField } from '@/types'
// import { ModbusTestPanel } from '@/components/protocol-panels/modbus-test-panel'
import { DigitalIOTestPanel } from '@/components/protocol-panels/digital-io-test-panel'
import { SNMPTestPanel } from '@/components/protocol-panels/snmp-test-panel'
import { testConnectionService } from '@/services/testConnectionService'
import { HexPreview } from '@/components/hex-preview'

interface TestStepProps {
  activeConnection: Connection
  addLog: (
    message: string,
    type?: 'info' | 'error' | 'success' | 'warning',
    connectionId?: string,
    slaveId?: number
  ) => void
  onRawDataReceived?: (
    data: RawDataField[],
    config?: {
      slaveId?: number
      functionCode?: number
      registerAddress?: number
      quantity?: number
      dataType?: string
      byteOrder?: string
      oid?: string
    }
  ) => void
  onNext?: () => void
}

export function TestStep({ activeConnection, addLog, onRawDataReceived, onNext }: TestStepProps) {
  const [isConnectionBusy, setIsConnectionBusy] = useState(false)
  const [testData, setTestData] = useState({
    slaveId: 1,
    function: 'Read Holding Registers' as ModbusFunction,
    startAddress: 0,
    quantity: 1,
    dataType: 'uint16' as DataType,
    byteOrder: 'Big Endian (AB CD)' as ByteOrder,
    writeValue: '',
  })
  const [testResult, setTestResult] = useState<string>('')

  // Auto-adjust quantity based on data type
  const getRequiredQuantity = (dataType: DataType): number => {
    switch (dataType) {
      case 'float32':
      case 'float':
        return 2 // float32 requires 2 registers
      case 'int32':
      case 'uint32':
        return 2 // 32-bit integers require 2 registers
      default:
        return 1 // uint16, int16 require 1 register
    }
  }

  const isModbus = activeConnection.protocol === 'Modbus TCP' || activeConnection.protocol === 'Modbus RTU'
  const isDigitalIO = activeConnection.protocol === 'Digital Input' || activeConnection.protocol === 'Digital Output'
  const isSNMP = activeConnection.protocol === 'SNMP'

  // Convert ModbusFunction to function code number
  const getFunctionCode = (func: ModbusFunction): number => {
    const functionMap: Record<ModbusFunction, number> = {
      'Read Coils': 1,
      'Read Discrete Inputs': 2,
      'Read Holding Registers': 3,
      'Read Input Registers': 4,
      'Write Single Coil': 5,
      'Write Single Register': 6,
      'Write Multiple Coils': 15,
      'Write Multiple Registers': 16,
    }
    return functionMap[func] || 3
  }

  // Convert ByteOrder to backend format
  const convertByteOrder = (byteOrder: ByteOrder): string => {
    const byteOrderMap: Record<ByteOrder, string> = {
      'Big Endian (AB CD)': 'ABCD',
      'Little Endian (CD AB)': 'CDAB',
      'Big Endian Swap (BA DC)': 'BADC',
      'Little Endian Swap (DC BA)': 'DCBA',
    }
    return byteOrderMap[byteOrder] || 'ABCD'
  }

  // Convert protocol type to backend format
  const getBackendType = (protocol: string): string => {
    if (protocol === 'Modbus TCP') return 'modbus_tcp'
    if (protocol === 'Modbus RTU') return 'modbus_rtu'
    if (protocol === 'SNMP') return 'snmp'
    return ''
  }

  const handleTest = async () => {
    if (testData.slaveId < 1 || testData.slaveId > 247) {
      addLog('Invalid Slave ID. Must be between 1-247', 'error', activeConnection.id)
      return
    }

    if (isConnectionBusy) {
      addLog(
        `Connection busy - Please wait for current operation to complete`,
        'warning',
        activeConnection.id,
        testData.slaveId
      )
      return
    }

    setIsConnectionBusy(true)

    addLog(
      `Testing ${testData.function} on slave ${testData.slaveId} at address ${testData.startAddress}`,
      'info',
      activeConnection.id,
      testData.slaveId
    )

    try {
      const backendType = getBackendType(activeConnection.protocol)
      const functionCode = getFunctionCode(testData.function)
      const byteOrder = convertByteOrder(testData.byteOrder)

      // Build config based on protocol
      let config: any = {}

      if (activeConnection.protocol === 'Modbus TCP' && 'host' in activeConnection.config) {
        config = {
          ip_address: activeConnection.config.host,
          port: activeConnection.config.port || 502,
          slave_id: testData.slaveId,
          function_code: functionCode,
          register_address: testData.startAddress,
          quantity: testData.quantity,
          byte_order: byteOrder,
          data_type: testData.dataType === 'float' ? 'float' : testData.dataType,
        }
      } else if (activeConnection.protocol === 'Modbus RTU' && 'serialPort' in activeConnection.config) {
        config = {
          port: activeConnection.config.serialPort,
          baud: activeConnection.config.baudRate || 9600,
          data_bits: activeConnection.config.dataBits || 8,
          parity:
            activeConnection.config.parity === 'none'
              ? 'N'
              : activeConnection.config.parity === 'even'
                ? 'E'
                : 'O',
          stop_bits: activeConnection.config.stopBits || 1,
          slave_id: testData.slaveId,
          function_code: functionCode,
          register_address: testData.startAddress,
          quantity: testData.quantity,
          byte_order: byteOrder,
          data_type: testData.dataType === 'float' ? 'float' : testData.dataType,
        }
      } else if (activeConnection.protocol === 'SNMP' && 'host' in activeConnection.config && 'community' in activeConnection.config && 'version' in activeConnection.config) {
        config = {
          ip_address: activeConnection.config.host,
          port: activeConnection.config.port || 161,
          community: activeConnection.config.community || 'public',
          version: activeConnection.config.version || 'v2c',
          oid: '1.3.6.1.2.1.1.1.0', // Default OID for test
        }
      }

      const result = await testConnectionService.test({
        type: backendType,
        config,
      })

      if (result.connected) {
        // Generate raw data fields from response
        const rawDataFields: RawDataField[] = []
        const resultLines: string[] = []

        // Always show raw hex data if available
        if (result.raw_hex) {
          resultLines.push(`Raw Hex: ${result.raw_hex}`)
          resultLines.push(`Raw Bytes: [${result.raw_bytes?.join(', ') || 'N/A'}] (${result.raw_bytes?.length || 0} bytes)`)
          resultLines.push('')
        }

        if (result.raw_value !== undefined && result.raw_value !== null) {
          // Format result display with 3 decimal places (without exponent)
          const formatValue = (val: number): string => {
            const fixedStr = val.toFixed(3)
            
            // Check if result is still in scientific notation (for very large numbers)
            if (fixedStr.includes('e') || fixedStr.includes('E')) {
              // Parse scientific notation and extract only the base part
              const parts = fixedStr.split(/[eE]/)
              const base = parts[0]
              const baseNum = parseFloat(base)
              
              // Return only the base with 3 decimal places (without exponent)
              // This will show as "1.190" for very large numbers like 1.190e+25
              return baseNum.toFixed(3)
            }
            
            // Normal number, remove trailing zeros
            return fixedStr.replace(/\.?0+$/, '') || '0'
          }

          // Check if raw_value is an array
          if (Array.isArray(result.raw_value)) {
            const values = result.raw_value as number[]
            const functionCode = getFunctionCode(testData.function)
            
            // Function code 1 (Read Coils) and 2 (Read Discrete Inputs) return bits (0/1)
            if (functionCode === 1 || functionCode === 2) {
              values.forEach((bit, index) => {
                const bitAddr = testData.startAddress + index
                resultLines.push(`Bit [${bitAddr}]: ${bit === 1 ? 'ON' : 'OFF'} (${bit})`)
                
                rawDataFields.push({
                  id: `${activeConnection.id}-${testData.slaveId}-${bitAddr}`,
                  name: `Slave ${testData.slaveId} Bit ${bitAddr}`,
                  value: bit,
                  timestamp: new Date(),
                  source: `${activeConnection.name} (Slave ${testData.slaveId})`,
                })
              })
              resultLines.push(`(Read ${testData.quantity} ${functionCode === 1 ? 'coils' : 'discrete inputs'})`)
            } else {
              // Display each register individually (for registers)
              values.forEach((val, index) => {
                const registerAddr = testData.startAddress + index
                const roundedVal = isFinite(val) && !isNaN(val) ? Math.round(val * 1000) / 1000 : 0
                
                resultLines.push(`[${registerAddr}]: ${formatValue(roundedVal)}`)
                
                // Create individual field for each register
                rawDataFields.push({
                  id: `${activeConnection.id}-${testData.slaveId}-${registerAddr}`,
                  name: `Slave ${testData.slaveId} Addr ${registerAddr}`,
                  value: roundedVal,
                  timestamp: new Date(),
                  source: `${activeConnection.name} (Slave ${testData.slaveId})`,
                })
              })
              resultLines.push(`(Read ${testData.quantity} registers, converted to ${testData.dataType})`)
            }
          } else {
            // Single value (for single register or merged multi-register values)
            let value = typeof result.raw_value === 'number' ? result.raw_value : parseFloat(String(result.raw_value))
            
            // Round to exactly 3 decimal places for processing in data mapping
            // For very large numbers, we need to handle precision carefully
            if (isFinite(value) && !isNaN(value)) {
              // Round to 3 decimal places: multiply by 1000, round, divide by 1000
              // This ensures exact 3 decimal places without precision loss
              value = Math.round(value * 1000) / 1000
            } else {
              value = 0
            }
            
            // Create one field with the converted value
            // For quantity > 1, backend reads multiple registers but converts them to one value (e.g., float from 2 registers)
            const fieldName = testData.quantity > 1 
              ? `Slave ${testData.slaveId} Addr ${testData.startAddress}-${testData.startAddress + testData.quantity - 1}`
              : `Slave ${testData.slaveId} Addr ${testData.startAddress}`
            
            rawDataFields.push({
              id: `${activeConnection.id}-${testData.slaveId}-${testData.startAddress}`,
              name: fieldName,
              value,
              timestamp: new Date(),
              source: `${activeConnection.name} (Slave ${testData.slaveId})`,
            })

            if (testData.quantity > 1) {
              resultLines.push(`[${testData.startAddress}-${testData.startAddress + testData.quantity - 1}]: ${formatValue(value)}`)
              resultLines.push(`(Read ${testData.quantity} registers, converted to ${testData.dataType})`)
            } else {
              resultLines.push(`[${testData.startAddress}]: ${formatValue(value)}`)
            }
          }
        } else {
          // No raw_value but connection OK (read failed but connection works)
          resultLines.push(`Connection OK`)
          if (result.details) {
            resultLines.push(`Details: ${result.details}`)
          }
          // Still show raw hex if available even if conversion failed
          if (result.raw_hex) {
            resultLines.push('')
            resultLines.push(`Raw Hex: ${result.raw_hex}`)
            resultLines.push(`Raw Bytes: [${result.raw_bytes?.join(', ') || 'N/A'}] (${result.raw_bytes?.length || 0} bytes)`)
          }
        }

        const resultText = resultLines.join('\n')
        setTestResult(resultText)

        if (onRawDataReceived && rawDataFields.length > 0) {
          // Pass test configuration along with raw data
          const testConfig = {
            slaveId: testData.slaveId,
            functionCode: getFunctionCode(testData.function),
            registerAddress: testData.startAddress,
            quantity: testData.quantity,
            dataType: testData.dataType === 'float' ? 'float' : testData.dataType,
            byteOrder: convertByteOrder(testData.byteOrder),
          }
          onRawDataReceived(rawDataFields, testConfig)
        }

        addLog(
          result.message || `Read ${testData.quantity} registers from slave ${testData.slaveId}`,
          rawDataFields.length > 0 ? 'success' : 'warning',
          activeConnection.id,
          testData.slaveId
        )
      } else {
        // Connection failed
        const errorMsg = `${result.message}${result.details ? ` - ${result.details}` : ''}`
        setTestResult(`Error: ${errorMsg}`)
        addLog(errorMsg, 'error', activeConnection.id, testData.slaveId)
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Unknown error'
      setTestResult(`Error: ${errorMessage}`)
      addLog(`Test failed: ${errorMessage}`, 'error', activeConnection.id, testData.slaveId)
    } finally {
      setIsConnectionBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Step 2: Read/Write Test Panel</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {isModbus && 'Direct Modbus operations on any slave ID'}
            {isDigitalIO && 'Digital I/O control and monitoring'}
            {isSNMP && 'SNMP GET and SET operations'}
          </p>
        </div>
      </div>

      <div className="max-w-2xl">
        {isModbus && (
          <Card>
            <CardHeader>
              <CardTitle>Manual Test Panel - Modbus</CardTitle>
              <CardDescription>Test operations on any slave ID</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isConnectionBusy && (
                <div className="flex items-center gap-2 rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3 text-sm text-yellow-600 dark:text-yellow-500">
                  <AlertCircle className="h-4 w-4" />
                  <span className="font-medium">Connection Busy - Operation in progress</span>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="slaveId">Slave ID (1-247) *</Label>
                <Input
                  id="slaveId"
                  type="number"
                  min="1"
                  max="247"
                  value={testData.slaveId}
                  onChange={(e) => setTestData({ ...testData, slaveId: parseInt(e.target.value) || 1 })}
                  placeholder="Enter slave ID"
                />
                <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                  <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                  <span>Modbus requests on the same connection are executed sequentially</span>
                </p>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Modbus Function</Label>
                <Select
                  value={testData.function}
                  onValueChange={(value) => setTestData({ ...testData, function: value as ModbusFunction })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Read Coils">Read Coils (0x01)</SelectItem>
                    <SelectItem value="Read Discrete Inputs">Read Discrete Inputs (0x02)</SelectItem>
                    <SelectItem value="Read Holding Registers">Read Holding Registers (0x03)</SelectItem>
                    <SelectItem value="Read Input Registers">Read Input Registers (0x04)</SelectItem>
                    <SelectItem value="Write Single Coil">Write Single Coil (0x05)</SelectItem>
                    <SelectItem value="Write Single Register">Write Single Register (0x06)</SelectItem>
                    <SelectItem value="Write Multiple Coils">Write Multiple Coils (0x0F)</SelectItem>
                    <SelectItem value="Write Multiple Registers">Write Multiple Registers (0x10)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Start Address</Label>
                  <Input
                    type="number"
                    min="0"
                    max="65535"
                    value={testData.startAddress}
                    onChange={(e) => setTestData({ ...testData, startAddress: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    min={getRequiredQuantity(testData.dataType)}
                    max="125"
                    value={testData.quantity}
                    onChange={(e) => {
                      const newQuantity = parseInt(e.target.value) || getRequiredQuantity(testData.dataType)
                      const minQuantity = getRequiredQuantity(testData.dataType)
                      setTestData({
                        ...testData,
                        quantity: Math.max(newQuantity, minQuantity),
                      })
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    Minimum: {getRequiredQuantity(testData.dataType)} register(s) for {testData.dataType}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Data Type</Label>
                  <Select
                    value={testData.dataType}
                    onValueChange={(value) => {
                      const newDataType = value as DataType
                      const requiredQuantity = getRequiredQuantity(newDataType)
                      setTestData({
                        ...testData,
                        dataType: newDataType,
                        quantity: requiredQuantity, // Auto-adjust quantity
                      })
                    }}
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
                      <SelectItem value="float">FLOAT</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {getRequiredQuantity(testData.dataType) > 1
                      ? `Requires ${getRequiredQuantity(testData.dataType)} registers`
                      : 'Requires 1 register'}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Byte Order</Label>
                  <Select
                    value={testData.byteOrder}
                    onValueChange={(value) => setTestData({ ...testData, byteOrder: value as ByteOrder })}
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

              {/* Hex Preview */}
              {isModbus && (
                <div className="space-y-2">
                  <Label>Hex Preview (Request Frame)</Label>
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <HexPreview
                      protocol={activeConnection.protocol}
                      slaveId={testData.slaveId}
                      functionCode={getFunctionCode(testData.function)}
                      address={testData.startAddress}
                      quantity={testData.quantity}
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button onClick={handleTest} className="w-full" disabled={isConnectionBusy}>
                  <Activity className="h-4 w-4 mr-2" />
                  {isConnectionBusy ? 'Connection Busy' : 'Read'}
                </Button>
              </div>

              {testResult && (
                <div className="space-y-2">
                  <Label>Test Results (Slave {testData.slaveId})</Label>
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <pre className="text-xs font-mono text-foreground whitespace-pre-wrap">{testResult}</pre>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {isDigitalIO && <DigitalIOTestPanel connection={activeConnection} addLog={addLog} />}

        {isSNMP && <SNMPTestPanel connection={activeConnection} addLog={addLog} />}
      </div>

      {testResult && onNext && (
        <div className="max-w-2xl mt-6">
          <Button onClick={onNext} className="w-full" size="lg">
            <ArrowRight className="h-4 w-4 mr-2" />
            Next: Data Mapping
          </Button>
        </div>
      )}
    </div>
  )
}

