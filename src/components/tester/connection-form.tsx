import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Connection, ProtocolType } from '@/types'

interface ConnectionFormProps {
  onSave: (connection: Connection) => void
  onCancel: () => void
  initialData?: Connection | null
}

export function ConnectionForm({ onSave, onCancel, initialData }: ConnectionFormProps) {
  const [name, setName] = useState(initialData?.name || '')
  const [protocol, setProtocol] = useState<ProtocolType>(initialData?.protocol || 'Modbus TCP')
  const [config, setConfig] = useState<any>(initialData?.config || {})

  useEffect(() => {
    if (initialData) {
      setName(initialData.name)
      setProtocol(initialData.protocol)
      setConfig(initialData.config)
    }
  }, [initialData])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const connection: Connection = {
      id: initialData?.id || Date.now().toString(),
      name,
      protocol,
      config,
      status: 'disconnected',
    }

    onSave(connection)
  }

  const renderProtocolFields = () => {
    switch (protocol) {
      case 'Modbus TCP':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="host">Host</Label>
              <Input
                id="host"
                placeholder="192.168.1.100"
                value={config.host || ''}
                onChange={(e) => setConfig({ ...config, host: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="port">Port</Label>
              <Input
                id="port"
                type="number"
                placeholder="502"
                value={config.port || 502}
                onChange={(e) => setConfig({ ...config, port: parseInt(e.target.value) || 502 })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="timeout">Timeout (ms)</Label>
              <Input
                id="timeout"
                type="number"
                placeholder="5000"
                value={config.timeout || 5000}
                onChange={(e) => setConfig({ ...config, timeout: parseInt(e.target.value) || 5000 })}
              />
            </div>
          </>
        )

      case 'Modbus RTU':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="serialPort">Serial Port</Label>
              <Input
                id="serialPort"
                placeholder="/dev/ttyUSB0"
                value={config.serialPort || ''}
                onChange={(e) => setConfig({ ...config, serialPort: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="baudRate">Baud Rate</Label>
              <Select
                value={config.baudRate?.toString() || '9600'}
                onValueChange={(value) => setConfig({ ...config, baudRate: parseInt(value) })}
              >
                <SelectTrigger id="baudRate">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="9600">9600</SelectItem>
                  <SelectItem value="19200">19200</SelectItem>
                  <SelectItem value="38400">38400</SelectItem>
                  <SelectItem value="57600">57600</SelectItem>
                  <SelectItem value="115200">115200</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dataBits">Data Bits</Label>
              <Select
                value={config.dataBits?.toString() || '8'}
                onValueChange={(value) => setConfig({ ...config, dataBits: parseInt(value) as 7 | 8 })}
              >
                <SelectTrigger id="dataBits">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7</SelectItem>
                  <SelectItem value="8">8</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="stopBits">Stop Bits</Label>
              <Select
                value={config.stopBits?.toString() || '1'}
                onValueChange={(value) => setConfig({ ...config, stopBits: parseInt(value) as 1 | 2 })}
              >
                <SelectTrigger id="stopBits">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="parity">Parity</Label>
              <Select
                value={config.parity || 'none'}
                onValueChange={(value) => setConfig({ ...config, parity: value })}
              >
                <SelectTrigger id="parity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="even">Even</SelectItem>
                  <SelectItem value="odd">Odd</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="timeout">Timeout (ms)</Label>
              <Input
                id="timeout"
                type="number"
                placeholder="5000"
                value={config.timeout || 5000}
                onChange={(e) => setConfig({ ...config, timeout: parseInt(e.target.value) || 5000 })}
              />
            </div>
          </>
        )

      case 'Digital Input':
      case 'Digital Output':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="pins">Pin Numbers (comma-separated)</Label>
              <Input
                id="pins"
                placeholder="0,1,2,3"
                value={config.pins?.join(',') || ''}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    pins: e.target.value.split(',').map((p) => parseInt(p.trim())).filter((p) => !isNaN(p)),
                  })
                }
              />
              <p className="text-xs text-muted-foreground">Example: 0,1,2,3 for pins 0 through 3</p>
            </div>
            <div className="space-y-2">
              <Label>Mode</Label>
              <div className="flex items-center h-10 px-3 py-2 border rounded-md bg-muted">
                <span className="text-sm font-medium">
                  {protocol === 'Digital Input' ? 'Input (Read)' : 'Output (Write)'}
                </span>
              </div>
            </div>
          </>
        )

      case 'SNMP':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="snmpHost">Host</Label>
              <Input
                id="snmpHost"
                placeholder="192.168.1.100"
                value={config.host || ''}
                onChange={(e) => setConfig({ ...config, host: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="snmpPort">Port</Label>
              <Input
                id="snmpPort"
                type="number"
                placeholder="161"
                value={config.port || 161}
                onChange={(e) => setConfig({ ...config, port: parseInt(e.target.value) || 161 })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="version">SNMP Version</Label>
              <Select
                value={config.version || 'v2c'}
                onValueChange={(value) => setConfig({ ...config, version: value })}
              >
                <SelectTrigger id="version">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="v1">v1</SelectItem>
                  <SelectItem value="v2c">v2c</SelectItem>
                  <SelectItem value="v3">v3</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(config.version === 'v1' || config.version === 'v2c') && (
              <div className="space-y-2">
                <Label htmlFor="community">Community String</Label>
                <Input
                  id="community"
                  placeholder="public"
                  value={config.community || ''}
                  onChange={(e) => setConfig({ ...config, community: e.target.value })}
                />
              </div>
            )}
          </>
        )
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{initialData ? 'Edit Connection' : 'New Connection'}</CardTitle>
        <CardDescription>Configure the transport layer for your device</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Connection Name</Label>
              <Input
                id="name"
                placeholder="My Device Connection"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="protocol">Protocol Type</Label>
              <Select
                value={protocol}
                onValueChange={(value) => {
                  setProtocol(value as ProtocolType)
                  setConfig({})
                }}
              >
                <SelectTrigger id="protocol">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Modbus TCP">Modbus TCP</SelectItem>
                  <SelectItem value="Modbus RTU">Modbus RTU</SelectItem>
                  <SelectItem value="Digital Input">Digital Input</SelectItem>
                  <SelectItem value="Digital Output">Digital Output</SelectItem>
                  <SelectItem value="SNMP">SNMP</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {renderProtocolFields()}

          <div className="flex gap-2 pt-2">
            <Button type="submit" className="flex-1">
              {initialData ? 'Update' : 'Create'}
            </Button>
            <Button type="button" variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

