import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Eye, Edit } from 'lucide-react'
import type { Connection } from '@/types'

interface ModbusTestPanelProps {
  connection: Connection
  addLog: (message: string, type?: 'info' | 'error' | 'success') => void
}

export function ModbusTestPanel({ connection, addLog }: ModbusTestPanelProps) {
  const [functionCode, setFunctionCode] = useState('Read Holding Registers')
  const [startAddress, setStartAddress] = useState('0')
  const [quantity, setQuantity] = useState('1')
  const [dataType, setDataType] = useState('uint16')
  const [byteOrder, setByteOrder] = useState('big-endian')
  const [writeValue, setWriteValue] = useState('')
  const [response, setResponse] = useState<string | null>(null)
  const [isReading, setIsReading] = useState(false)

  const handleRead = async () => {
    setIsReading(true)
    addLog(`Reading ${functionCode} from address ${startAddress}, quantity: ${quantity}`, 'info')

    setTimeout(() => {
      const mockData = Array.from({ length: parseInt(quantity) }, (_, i) => Math.floor(Math.random() * 65535))
      const hexData = mockData.map((v) => v.toString(16).padStart(4, '0')).join(' ')
      setResponse(`HEX: ${hexData}\nDEC: ${mockData.join(', ')}\nData Type: ${dataType}`)
      addLog(`Successfully read ${quantity} register(s)`, 'success')
      setIsReading(false)
    }, 800)
  }

  const handleWrite = async () => {
    setIsReading(true)
    addLog(`Writing value ${writeValue} to address ${startAddress}`, 'info')

    setTimeout(() => {
      setResponse(`Write successful\nAddress: ${startAddress}\nValue: ${writeValue}`)
      addLog(`Successfully wrote to register ${startAddress}`, 'success')
      setIsReading(false)
    }, 800)
  }

  const isWriteFunction = functionCode.includes('Write')

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Function Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="function">Function Code</Label>
              <Select value={functionCode} onValueChange={setFunctionCode}>
                <SelectTrigger id="function">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Read Coils">Read Coils (FC 01)</SelectItem>
                  <SelectItem value="Read Discrete Inputs">Read Discrete Inputs (FC 02)</SelectItem>
                  <SelectItem value="Read Holding Registers">Read Holding Registers (FC 03)</SelectItem>
                  <SelectItem value="Read Input Registers">Read Input Registers (FC 04)</SelectItem>
                  <SelectItem value="Write Single Coil">Write Single Coil (FC 05)</SelectItem>
                  <SelectItem value="Write Single Register">Write Single Register (FC 06)</SelectItem>
                  <SelectItem value="Write Multiple Registers">Write Multiple Registers (FC 16)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Start Address</Label>
              <Input
                id="address"
                type="number"
                min="0"
                max="65535"
                value={startAddress}
                onChange={(e) => setStartAddress(e.target.value)}
              />
            </div>

            {!isWriteFunction && (
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  max="125"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>
            )}

            {functionCode.includes('Register') && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="dataType">Data Type</Label>
                  <Select value={dataType} onValueChange={setDataType}>
                    <SelectTrigger id="dataType">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="uint16">Uint16</SelectItem>
                      <SelectItem value="int16">Int16</SelectItem>
                      <SelectItem value="uint32">Uint32</SelectItem>
                      <SelectItem value="int32">Int32</SelectItem>
                      <SelectItem value="float32">Float32</SelectItem>
                      <SelectItem value="float">Float</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="byteOrder">Byte Order</Label>
                  <Select value={byteOrder} onValueChange={setByteOrder}>
                    <SelectTrigger id="byteOrder">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="big-endian">Big Endian (AB CD)</SelectItem>
                      <SelectItem value="little-endian">Little Endian (CD AB)</SelectItem>
                      <SelectItem value="big-endian-swap">Big Endian Swap (BA DC)</SelectItem>
                      <SelectItem value="little-endian-swap">Little Endian Swap (DC BA)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {isWriteFunction && (
              <div className="space-y-2">
                <Label htmlFor="writeValue">Value</Label>
                <Input
                  id="writeValue"
                  placeholder="Enter value"
                  value={writeValue}
                  onChange={(e) => setWriteValue(e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="flex gap-2">
            {isWriteFunction ? (
              <Button onClick={handleWrite} disabled={isReading || !writeValue} className="flex-1">
                <Edit className="h-4 w-4 mr-2" />
                {isReading ? 'Writing...' : 'Write'}
              </Button>
            ) : (
              <Button onClick={handleRead} disabled={isReading} className="flex-1">
                <Eye className="h-4 w-4 mr-2" />
                {isReading ? 'Reading...' : 'Read'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {response && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Response</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted p-4 rounded-lg text-xs font-mono text-muted-foreground overflow-x-auto whitespace-pre-wrap">
              {response}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

