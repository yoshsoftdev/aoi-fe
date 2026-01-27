import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { parameterService } from '@/services/parameterService'
import { modbusService } from '@/services/modbusService'
import { deviceService } from '@/services/deviceService'
import { testConnectionService } from '@/services/testConnectionService'
import { writeService } from '@/services/writeService'
import { Parameter } from '@/types/parameter'
import { ArrowLeft, CheckCircle, XCircle, Loader, Play, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

interface ReadWriteParameterFormProps {
  mode?: 'create' | 'edit'
  paramId?: number | null
  queryParams?: string
  onCancel?: () => void
  onSuccess?: () => void
}

type TestStep = 'connect' | 'read' | 'write' | 'complete'

export default function ReadWriteParameterForm({ 
  mode = 'create', 
  paramId = null, 
  queryParams = '', 
  onCancel, 
  onSuccess 
}: ReadWriteParameterFormProps = {}) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()
  
  const [formData, setFormData] = useState<Omit<Parameter, 'id' | 'created_at' | 'updated_at'>>({
    device_id: 0,
    nama: '',
    type: 'modbus_rtu', // Will be set from device
    direction: 'READ_WRITE',
    read_write: false,
    write_mode: undefined,
    preset_value: undefined,
    custom_rumus: '',
  })

  const [configData, setConfigData] = useState<any>({
    slave_id: 1,
    function_code: 3, // Default: Read Holding Registers
    register_address: 0,
    quantity: 1,
    data_type: 'uint16',
    byte_order: 'ABCD',
    scaling: 1.0,
    polling_ms: 200,
  })

  // Test steps state
  const [testSteps, setTestSteps] = useState<{
    connect: { status: 'pending' | 'testing' | 'success' | 'error'; message?: string }
    read: { status: 'pending' | 'testing' | 'success' | 'error'; message?: string; value?: any }
    write: { status: 'pending' | 'testing' | 'success' | 'error'; message?: string }
  }>({
    connect: { status: 'pending' },
    read: { status: 'pending' },
    write: { status: 'pending' },
  })

  const [readValue, setReadValue] = useState<number | null>(null)

  // Fetch devices
  const { data: devices } = useQuery({
    queryKey: ['devices'],
    queryFn: deviceService.getAll,
  })

  // Initialize form from URL parameters
  useEffect(() => {
    const effectiveQueryParams = queryParams || (searchParams.toString() ? `?${searchParams.toString()}` : '')
    const params = effectiveQueryParams ? new URLSearchParams(effectiveQueryParams.replace(/^\?/, '')) : searchParams
    const deviceIdParam = params.get('device_id')
    const typeParam = params.get('type')

    if (deviceIdParam) {
      const deviceId = parseInt(deviceIdParam, 10)
      if (!isNaN(deviceId)) {
        setFormData(prev => ({ ...prev, device_id: deviceId }))
      }
    }

    if (typeParam && ['modbus_rtu', 'modbus_tcp'].includes(typeParam)) {
      setFormData(prev => ({ ...prev, type: typeParam as any }))
    }
  }, [searchParams, queryParams])

  // Test connection step
  const handleTestConnect = async () => {
    if (!formData.device_id) {
      alert('Please select a device first')
      return
    }

    setTestSteps(prev => ({ ...prev, connect: { status: 'testing' } }))

    try {
      const device = devices?.find(d => d.id === formData.device_id)
      if (!device) {
        throw new Error('Device not found')
      }

      // Use device type (modbus_rtu or modbus_tcp)
      const deviceType = device.type || formData.type
      const config: any = {}

      if (deviceType === 'modbus_rtu') {
        config.port = device.port || ''
        config.baud = device.baud || 9600
        config.data_bits = device.data_bits || 8
        config.stop_bits = device.stop_bits || 1
        config.parity = device.parity || 'N'
      } else {
        config.ip_address = device.ip_address || ''
        config.port = device.tcp_port || 502
      }

      config.slave_id = configData.slave_id || 1
      config.function_code = configData.function_code || 3
      config.register_address = configData.register_address || 0
      config.quantity = configData.quantity || 1
      config.byte_order = configData.byte_order || 'ABCD'
      config.data_type = configData.data_type || 'uint16'

      const result = await testConnectionService.test({
        type: deviceType,
        config,
      })

      if (result.connected) {
        setTestSteps(prev => ({
          ...prev,
          connect: { status: 'success', message: result.message || 'Connection successful' },
        }))
      } else {
        setTestSteps(prev => ({
          ...prev,
          connect: { status: 'error', message: result.message || 'Connection failed' },
        }))
      }
    } catch (error: any) {
      setTestSteps(prev => ({
        ...prev,
        connect: { status: 'error', message: error.response?.data?.error || error.message || 'Connection test failed' },
      }))
    }
  }

  // Test read step
  const handleTestRead = async () => {
    if (testSteps.connect.status !== 'success') {
      alert('Please test connection first')
      return
    }

    setTestSteps(prev => ({ ...prev, read: { status: 'testing' } }))

    try {
      const device = devices?.find(d => d.id === formData.device_id)
      if (!device) {
        throw new Error('Device not found')
      }

      // Use device type (modbus_rtu or modbus_tcp)
      const deviceType = device.type || formData.type
      const config: any = {}

      if (deviceType === 'modbus_rtu') {
        config.port = device.port || ''
        config.baud = device.baud || 9600
        config.data_bits = device.data_bits || 8
        config.stop_bits = device.stop_bits || 1
        config.parity = device.parity || 'N'
      } else {
        config.ip_address = device.ip_address || ''
        config.port = device.tcp_port || 502
      }

      // Use read function code (3 or 4)
      const functionCode = configData.function_code === 4 ? 4 : 3

      // Build config for read test
      const readConfig: any = {
        ...config,
        slave_id: configData.slave_id || 1,
        function_code: functionCode,
        register_address: configData.register_address || 0,
        quantity: configData.quantity || 1,
        data_type: configData.data_type || 'uint16',
        byte_order: configData.byte_order || 'ABCD',
      }

      const result = await testConnectionService.test({
        type: deviceType,
        config: readConfig,
      })

      if (result.connected && result.raw_value !== undefined) {
        const value = typeof result.raw_value === 'number' ? result.raw_value : parseFloat(result.raw_value)
        setReadValue(value)
        setTestSteps(prev => ({
          ...prev,
          read: { 
            status: 'success', 
            message: `Read successful: ${value}`,
            value: value,
          },
        }))
      } else {
        setTestSteps(prev => ({
          ...prev,
          read: { status: 'error', message: result.message || 'Read failed' },
        }))
      }
    } catch (error: any) {
      setTestSteps(prev => ({
        ...prev,
        read: { status: 'error', message: error.response?.data?.error || error.message || 'Read test failed' },
      }))
    }
  }

  // Test write step (using value from read)
  const handleTestWrite = async () => {
    if (testSteps.read.status !== 'success' || readValue === null) {
      alert('Please test read first')
      return
    }

    setTestSteps(prev => ({ ...prev, write: { status: 'testing' } }))

    try {
      const device = devices?.find(d => d.id === formData.device_id)
      if (!device) {
        throw new Error('Device not found')
      }

      // Use device type (modbus_rtu or modbus_tcp)
      const deviceType = device.type || formData.type

      // Use write function code (6 for single register, 16 for multiple)
      const functionCode = configData.quantity === 1 ? 6 : 16

      // Get device ID
      const deviceId = formData.device_id

      const result = await writeService.testWrite({
        device_id: deviceId,
        protocol: deviceType as 'modbus_rtu' | 'modbus_tcp',
        slave_id: configData.slave_id || 1,
        function_code: functionCode,
        register_address: configData.register_address || 0,
        quantity: configData.quantity || 1,
        data_type: configData.data_type || 'uint16',
        byte_order: configData.byte_order || 'ABCD',
        register_values: [Math.round(readValue)], // Use read value for write test
      })

      if (result.success) {
        setTestSteps(prev => ({
          ...prev,
          write: { status: 'success', message: result.message || 'Write successful' },
        }))
      } else {
        setTestSteps(prev => ({
          ...prev,
          write: { status: 'error', message: result.error || result.message || 'Write failed' },
        }))
      }
    } catch (error: any) {
      setTestSteps(prev => ({
        ...prev,
        write: { status: 'error', message: error.response?.data?.error || error.message || 'Write test failed' },
      }))
    }
  }

  // Save parameter
  const paramMutation = useMutation({
    mutationFn: parameterService.create,
    onSuccess: async (createdParam) => {
      try {
        const preparedConfig: any = { ...configData }
        
        // Ensure all numeric fields are integers
        if (preparedConfig.slave_id !== undefined) {
          preparedConfig.slave_id = parseInt(preparedConfig.slave_id) || 1
        }
        if (preparedConfig.function_code !== undefined) {
          preparedConfig.function_code = parseInt(preparedConfig.function_code) || 3
        }
        if (preparedConfig.register_address !== undefined) {
          preparedConfig.register_address = parseInt(preparedConfig.register_address) || 0
        }
        if (preparedConfig.quantity !== undefined) {
          preparedConfig.quantity = parseInt(preparedConfig.quantity) || 1
        }
        if (preparedConfig.polling_ms === undefined || preparedConfig.polling_ms === null || preparedConfig.polling_ms === '') {
          preparedConfig.polling_ms = 200
        } else {
          preparedConfig.polling_ms = parseInt(preparedConfig.polling_ms) || 200
        }

        // Get device type
        const device = devices?.find(d => d.id === formData.device_id)
        const deviceType = device?.type || formData.type

        // Create modbus config
        if (deviceType === 'modbus_rtu') {
          await modbusService.createRTU({
            id_parameter: createdParam.id,
            read_write: false,
            slave_id: preparedConfig.slave_id,
            function_code: preparedConfig.function_code,
            register_address: preparedConfig.register_address,
            quantity: preparedConfig.quantity,
            byte_order: preparedConfig.byte_order || 'ABCD',
            data_type: preparedConfig.data_type || 'uint16',
            scaling: preparedConfig.scaling || 1.0,
            polling_ms: preparedConfig.polling_ms,
          })
        } else if (deviceType === 'modbus_tcp') {
          await modbusService.createTCP({
            id_parameter: createdParam.id,
            read_write: false,
            slave_id: preparedConfig.slave_id,
            function_code: preparedConfig.function_code,
            register_address: preparedConfig.register_address,
            quantity: preparedConfig.quantity,
            byte_order: preparedConfig.byte_order || 'ABCD',
            data_type: preparedConfig.data_type || 'uint16',
            scaling: preparedConfig.scaling || 1.0,
            polling_ms: preparedConfig.polling_ms,
          })
        }

        queryClient.invalidateQueries({ queryKey: ['parameters'] })
        if (onSuccess) {
          onSuccess()
        } else {
          navigate('/parameters')
        }
      } catch (error: any) {
        alert(`Failed to create config: ${error.response?.data?.error || error.message}`)
      }
    },
    onError: (error: any) => {
      alert(`Failed to create parameter: ${error.response?.data?.error || error.message}`)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Validate all test steps passed
    if (testSteps.connect.status !== 'success') {
      alert('Please test connection first')
      return
    }
    if (testSteps.read.status !== 'success') {
      alert('Please test read first')
      return
    }
    if (testSteps.write.status !== 'success') {
      alert('Please test write first')
      return
    }

    if (!formData.nama.trim()) {
      alert('Please enter parameter name')
      return
    }

    if (!formData.device_id) {
      alert('Please select a device')
      return
    }

    // Get device type
    const device = devices?.find(d => d.id === formData.device_id)
    const deviceType = device?.type || formData.type

    paramMutation.mutate({
      ...formData,
      type: deviceType,
      direction: 'READ_WRITE',
    })
  }

  const canSave = testSteps.connect.status === 'success' && 
                  testSteps.read.status === 'success' && 
                  testSteps.write.status === 'success'

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={onCancel || (() => navigate('/parameters'))}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">Create Read/Write Parameter</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>Configure the parameter details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="nama">Parameter Name *</Label>
              <Input
                id="nama"
                value={formData.nama}
                onChange={(e) => setFormData(prev => ({ ...prev, nama: e.target.value }))}
                placeholder="Enter parameter name"
                required
              />
            </div>

            <div>
              <Label htmlFor="device_id">Device *</Label>
              <Select
                value={formData.device_id?.toString() || ''}
                onValueChange={(value) => {
                  const deviceId = parseInt(value)
                  const device = devices?.find(d => d.id === deviceId)
                  setFormData(prev => ({ 
                    ...prev, 
                    device_id: deviceId,
                    type: device?.type || 'modbus_rtu' // Set type from device
                  }))
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select device" />
                </SelectTrigger>
                <SelectContent>
                  {devices?.filter(d => d.type === 'modbus_rtu' || d.type === 'modbus_tcp').map((device) => (
                    <SelectItem key={device.id} value={device.id.toString()}>
                      {device.nama} ({device.type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Modbus Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Modbus Configuration</CardTitle>
            <CardDescription>Configure Modbus register settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="slave_id">Slave ID *</Label>
                <Input
                  id="slave_id"
                  type="number"
                  value={configData.slave_id || ''}
                  onChange={(e) => setConfigData(prev => ({ ...prev, slave_id: parseInt(e.target.value) || 1 }))}
                  min="1"
                  max="247"
                />
              </div>

              <div>
                <Label htmlFor="function_code">Function Code *</Label>
                <Select
                  value={configData.function_code?.toString() || '3'}
                  onValueChange={(value) => setConfigData(prev => ({ ...prev, function_code: parseInt(value) }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 - Read Holding Registers</SelectItem>
                    <SelectItem value="4">4 - Read Input Registers</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="register_address">Register Address *</Label>
                <Input
                  id="register_address"
                  type="number"
                  value={configData.register_address || ''}
                  onChange={(e) => setConfigData(prev => ({ ...prev, register_address: parseInt(e.target.value) || 0 }))}
                  min="0"
                />
              </div>

              <div>
                <Label htmlFor="quantity">Quantity *</Label>
                <Input
                  id="quantity"
                  type="number"
                  value={configData.quantity || ''}
                  onChange={(e) => setConfigData(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                  min="1"
                />
              </div>

              <div>
                <Label htmlFor="data_type">Data Type *</Label>
                <Select
                  value={configData.data_type || 'uint16'}
                  onValueChange={(value) => setConfigData(prev => ({ ...prev, data_type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="uint16">uint16</SelectItem>
                    <SelectItem value="int16">int16</SelectItem>
                    <SelectItem value="uint32">uint32</SelectItem>
                    <SelectItem value="int32">int32</SelectItem>
                    <SelectItem value="float32">float32</SelectItem>
                    <SelectItem value="float64">float64</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="byte_order">Byte Order *</Label>
                <Select
                  value={configData.byte_order || 'ABCD'}
                  onValueChange={(value) => setConfigData(prev => ({ ...prev, byte_order: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ABCD">Big Endian (AB CD)</SelectItem>
                    <SelectItem value="CDAB">Little Endian (CD AB)</SelectItem>
                    <SelectItem value="BADC">Big Endian Swap (BA DC)</SelectItem>
                    <SelectItem value="DCBA">Little Endian Swap (DC BA)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="scaling">Scaling Factor</Label>
                <Input
                  id="scaling"
                  type="number"
                  step="0.1"
                  value={configData.scaling || 1.0}
                  onChange={(e) => setConfigData(prev => ({ ...prev, scaling: parseFloat(e.target.value) || 1.0 }))}
                />
              </div>

              <div>
                <Label htmlFor="polling_ms">Polling Interval (ms)</Label>
                <Input
                  id="polling_ms"
                  type="number"
                  value={configData.polling_ms || 200}
                  onChange={(e) => setConfigData(prev => ({ ...prev, polling_ms: parseInt(e.target.value) || 200 }))}
                  min="200"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Test Steps */}
        <Card>
          <CardHeader>
            <CardTitle>Test Steps</CardTitle>
            <CardDescription>Test connection, read, and write operations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Step 1: Connect */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                {testSteps.connect.status === 'success' && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                {testSteps.connect.status === 'error' && <XCircle className="h-5 w-5 text-red-500" />}
                {testSteps.connect.status === 'testing' && <Loader className="h-5 w-5 animate-spin" />}
                {testSteps.connect.status === 'pending' && <div className="h-5 w-5 rounded-full border-2 border-gray-300" />}
                <div>
                  <div className="font-medium">1. Test Connection</div>
                  {testSteps.connect.message && (
                    <div className="text-sm text-muted-foreground">{testSteps.connect.message}</div>
                  )}
                </div>
              </div>
              <Button
                type="button"
                onClick={handleTestConnect}
                disabled={!formData.device_id || testSteps.connect.status === 'testing'}
                variant={testSteps.connect.status === 'success' ? 'outline' : 'default'}
              >
                {testSteps.connect.status === 'testing' ? 'Testing...' : 'Test Connect'}
              </Button>
            </div>

            {/* Step 2: Read */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                {testSteps.read.status === 'success' && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                {testSteps.read.status === 'error' && <XCircle className="h-5 w-5 text-red-500" />}
                {testSteps.read.status === 'testing' && <Loader className="h-5 w-5 animate-spin" />}
                {testSteps.read.status === 'pending' && <div className="h-5 w-5 rounded-full border-2 border-gray-300" />}
                <div>
                  <div className="font-medium">2. Test Read</div>
                  {testSteps.read.message && (
                    <div className="text-sm text-muted-foreground">{testSteps.read.message}</div>
                  )}
                  {readValue !== null && (
                    <div className="text-sm font-medium text-primary">Read Value: {readValue}</div>
                  )}
                </div>
              </div>
              <Button
                type="button"
                onClick={handleTestRead}
                disabled={testSteps.connect.status !== 'success' || testSteps.read.status === 'testing'}
                variant={testSteps.read.status === 'success' ? 'outline' : 'default'}
              >
                {testSteps.read.status === 'testing' ? 'Testing...' : 'Test Read'}
              </Button>
            </div>

            {/* Step 3: Write */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                {testSteps.write.status === 'success' && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                {testSteps.write.status === 'error' && <XCircle className="h-5 w-5 text-red-500" />}
                {testSteps.write.status === 'testing' && <Loader className="h-5 w-5 animate-spin" />}
                {testSteps.write.status === 'pending' && <div className="h-5 w-5 rounded-full border-2 border-gray-300" />}
                <div>
                  <div className="font-medium">3. Test Write (using read value)</div>
                  {testSteps.write.message && (
                    <div className="text-sm text-muted-foreground">{testSteps.write.message}</div>
                  )}
                </div>
              </div>
              <Button
                type="button"
                onClick={handleTestWrite}
                disabled={testSteps.read.status !== 'success' || testSteps.write.status === 'testing'}
                variant={testSteps.write.status === 'success' ? 'outline' : 'default'}
              >
                {testSteps.write.status === 'testing' ? 'Testing...' : 'Test Write'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={onCancel || (() => navigate('/parameters'))}>
            Cancel
          </Button>
          <Button type="submit" disabled={!canSave || paramMutation.isPending}>
            {paramMutation.isPending ? 'Saving...' : 'Save Parameter'}
          </Button>
        </div>
      </form>
    </div>
  )
}

