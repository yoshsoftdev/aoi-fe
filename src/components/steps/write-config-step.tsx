import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Plus, Save, Trash2, CheckCircle2, Info } from 'lucide-react'
import { parameterService } from '@/services/parameterService'
import { modbusService } from '@/services/modbusService'
import { writeService } from '@/services/writeService'
import type { Connection, ModbusFunction, DataType, ByteOrder } from '@/types'
import type { Parameter } from '@/types/parameter'

interface WriteParameter {
  id: number
  name: string
  slaveId: number
  function: ModbusFunction
  address: number
  value: string
  writeMode: 'single' | 'multiple'
  registerCount?: number
  dataType: DataType
  byteOrder: ByteOrder
  parameter?: Parameter // Reference to actual parameter
}

interface WriteConfigStepProps {
  activeConnection: Connection
  addLog: (
    message: string,
    type?: 'info' | 'error' | 'success' | 'warning',
    connectionId?: string,
    slaveId?: number,
  ) => void
  onParameterCreated?: (parameter: Parameter) => void
}

export function WriteConfigStep({ activeConnection, addLog, onParameterCreated }: WriteConfigStepProps) {
  const queryClient = useQueryClient()
  const [writeParameters, setWriteParameters] = useState<WriteParameter[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingParam, setEditingParam] = useState<WriteParameter | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    slaveId: 1,
    function: 'Write Single Register' as ModbusFunction,
    address: 0,
    value: '',
    writeMode: 'single' as 'single' | 'multiple',
    registerCount: 1,
    dataType: 'uint16' as DataType,
    byteOrder: 'Big Endian (AB CD)' as ByteOrder,
  })

  // Fetch existing parameters
  const { data: allParameters = [] } = useQuery({
    queryKey: ['parameters'],
    queryFn: () => parameterService.getAll(),
  })

  // Filter writable parameters for this connection
  const writableParameters = allParameters.filter(
    (p) =>
      p.device_id === parseInt(activeConnection.id, 10) &&
      (p.direction === 'WRITE' || (p.direction === undefined && (p as any).read_write === true)) &&
      ((p as any).is_formula === false || (p as any).is_formula === undefined)
  )

  // Create parameter mutation
  const createParameterMutation = useMutation({
    mutationFn: async (data: {
      nama: string
      device_id: number
      type: string
      direction: string
      slave_id: number
      function_code: number
      register_address: number
      quantity: number
      data_type: string
      byte_order: string
    }) => {
      // Validate and convert direction
      const direction: 'READ' | 'WRITE' = (data.direction === 'READ' || data.direction === 'WRITE') 
        ? data.direction 
        : 'WRITE' // Default to WRITE for write parameters
      
      // Validate and convert type
      const type: 'modbus_rtu' | 'modbus_tcp' | 'analog_input' | 'analog_output' | 'digital_input' | 'digital_output' | 'snmp' = 
        (['modbus_rtu', 'modbus_tcp', 'analog_input', 'analog_output', 'digital_input', 'digital_output', 'snmp'].includes(data.type))
          ? data.type as 'modbus_rtu' | 'modbus_tcp' | 'analog_input' | 'analog_output' | 'digital_input' | 'digital_output' | 'snmp'
          : 'modbus_rtu' // Default fallback
      
      // First create the parameter
      const param = await parameterService.create({
        nama: data.nama,
        device_id: data.device_id,
        type,
        direction,
        read_write: direction === 'WRITE', // Required field, derived from direction
      })

      // Then create Modbus config
      if (data.type === 'modbus_rtu') {
        await modbusService.createRTU({
          id_parameter: param.id,
          slave_id: data.slave_id,
          function_code: data.function_code,
          register_address: data.register_address,
          quantity: data.quantity,
          data_type: data.data_type,
          byte_order: data.byte_order,
          read_write: data.direction === 'WRITE',
          scaling: 1,
        })
      } else if (data.type === 'modbus_tcp') {
        await modbusService.createTCP({
          id_parameter: param.id,
          slave_id: data.slave_id,
          function_code: data.function_code,
          register_address: data.register_address,
          quantity: data.quantity,
          data_type: data.data_type,
          byte_order: data.byte_order,
          read_write: data.direction === 'WRITE',
          scaling: 1,
        })
      }

      return param
    },
    onSuccess: (param) => {
      queryClient.invalidateQueries({ queryKey: ['parameters'] })
      addLog(`Created write parameter: ${param.nama}`, 'success', activeConnection.id)
      onParameterCreated?.(param)
    },
    onError: (error: any) => {
      addLog(`Failed to create parameter: ${error.message}`, 'error', activeConnection.id)
    },
  })

  // const writeFunctions: ModbusFunction[] = ['Write Single Coil', 'Write Single Register', 'Write Multiple Registers']

  const handleCreate = async () => {
    if (!formData.name) {
      addLog('Please enter a parameter name', 'error', activeConnection.id)
      return
    }

    if (formData.slaveId < 1 || formData.slaveId > 247) {
      addLog('Invalid Slave ID. Must be between 1-247', 'error', activeConnection.id)
      return
    }

    if (!formData.value) {
      addLog('Please enter a value', 'error', activeConnection.id)
      return
    }

    if (formData.writeMode === 'multiple') {
      const values = formData.value.split(',').map((v) => v.trim())
      if (values.length !== formData.registerCount) {
        addLog(`Please enter exactly ${formData.registerCount} values separated by commas`, 'error', activeConnection.id)
        return
      }
      for (const val of values) {
        if (isNaN(Number(val))) {
          addLog(`Invalid value: ${val}. All values must be numbers`, 'error', activeConnection.id)
          return
        }
      }
    }

    // Determine function code
    let functionCode = 6 // Write Single Register
    if (formData.function === 'Write Multiple Registers') {
      functionCode = 16
    } else if (formData.function === 'Write Single Coil') {
      functionCode = 5
    }

    // Determine parameter type from connection
    const paramType = activeConnection.protocol === 'Modbus TCP' ? 'modbus_tcp' : 'modbus_rtu'

    try {
      // Create parameter and Modbus config
      const param = await createParameterMutation.mutateAsync({
        nama: formData.name,
        device_id: parseInt(activeConnection.id, 10),
        type: paramType,
        direction: 'WRITE',
        slave_id: formData.slaveId,
        function_code: functionCode,
        register_address: formData.address,
        quantity: formData.writeMode === 'multiple' ? formData.registerCount || 1 : 1,
        data_type: formData.dataType,
        byte_order: formData.byteOrder,
      })

      // Add to local writeParameters list
      const writeParam: WriteParameter = {
        id: param.id,
        name: formData.name,
        slaveId: formData.slaveId,
        function: formData.function,
        address: formData.address,
        value: formData.value,
        writeMode: formData.writeMode,
        registerCount: formData.registerCount,
        dataType: formData.dataType,
        byteOrder: formData.byteOrder,
        parameter: param,
      }

      if (editingParam) {
        setWriteParameters(writeParameters.map((p) => (p.id === editingParam.id ? writeParam : p)))
        addLog(`Updated write parameter: ${writeParam.name}`, 'success', activeConnection.id)
      } else {
        setWriteParameters([...writeParameters, writeParam])
        addLog(`Created write parameter: ${writeParam.name}`, 'success', activeConnection.id)
      }

      setShowForm(false)
      setEditingParam(null)
      setFormData({
        name: '',
        slaveId: 1,
        function: 'Write Single Register',
        address: 0,
        value: '',
        writeMode: 'single',
        registerCount: 1,
        dataType: 'uint16',
        byteOrder: 'Big Endian (AB CD)',
      })
    } catch (error: any) {
      addLog(`Failed to create parameter: ${error.message}`, 'error', activeConnection.id)
    }
  }

  const handleEdit = (param: WriteParameter) => {
    setEditingParam(param)
    setFormData({
      name: param.name,
      slaveId: param.slaveId,
      function: param.function,
      address: param.address,
      value: param.value,
      writeMode: param.writeMode,
      registerCount: param.registerCount || 1,
      dataType: param.dataType,
      byteOrder: param.byteOrder,
    })
    setShowForm(true)
  }

  const handleDelete = (param: WriteParameter) => {
    setWriteParameters(writeParameters.filter((p) => p.id !== param.id))
    addLog(`Deleted write parameter: ${param.name}`, 'info', activeConnection.id)
  }

  const handleExecute = async (param: WriteParameter) => {
    if (!param.parameter) {
      addLog(`Parameter not found for: ${param.name}`, 'error', activeConnection.id)
      return
    }

    if (param.writeMode === 'multiple') {
      const values = param.value.split(',').map((v) => v.trim()).map(Number)
      addLog(
        `Executing write: ${param.name} - Slave ${param.slaveId}, Starting Address ${param.address}, Writing ${values.length} registers`,
        'info',
        activeConnection.id,
        param.slaveId,
      )

      try {
        const response = await writeService.execute(param.parameter.id, 'manual', undefined, values)
        if (response.success) {
          addLog(
            `Write successful: ${param.name} - Values [${values.join(', ')}] written to ${values.length} registers starting at address ${param.address}`,
            'success',
            activeConnection.id,
            param.slaveId,
          )
        } else {
          addLog(`Write failed: ${response.error || response.message}`, 'error', activeConnection.id, param.slaveId)
        }
      } catch (error: any) {
        addLog(`Write failed: ${error.message}`, 'error', activeConnection.id, param.slaveId)
      }
    } else {
      const value = Number.parseFloat(param.value)
      addLog(
        `Executing write: ${param.name} - Slave ${param.slaveId}, Address ${param.address}, Value ${value}`,
        'info',
        activeConnection.id,
        param.slaveId,
      )

      try {
        const response = await writeService.execute(param.parameter.id, 'manual', undefined, [value])
        if (response.success) {
          addLog(
            `Write successful: ${param.name} - Value ${value} written to address ${param.address}`,
            'success',
            activeConnection.id,
            param.slaveId,
          )
        } else {
          addLog(`Write failed: ${response.error || response.message}`, 'error', activeConnection.id, param.slaveId)
        }
      } catch (error: any) {
        addLog(`Write failed: ${error.message}`, 'error', activeConnection.id, param.slaveId)
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Step 2: Write Configuration</h2>
          <p className="text-sm text-muted-foreground mt-1">Configure write parameters for {activeConnection.name}</p>
        </div>
        <Button
          onClick={() => {
            setEditingParam(null)
            setFormData({
              name: '',
              slaveId: 1,
              function: 'Write Single Register',
              address: 0,
              value: '',
              writeMode: 'single',
              registerCount: 1,
              dataType: 'uint16',
              byteOrder: 'Big Endian (AB CD)',
            })
            setShowForm(!showForm)
          }}
          size="sm"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Write Parameter
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingParam ? 'Edit Write Parameter' : 'Create Write Parameter'}</CardTitle>
            <CardDescription>Define a write operation configuration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="paramName">Parameter Name *</Label>
              <Input
                id="paramName"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Set Motor Speed, Update Temperature"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="slaveId">Slave ID (1-247) *</Label>
                <Input
                  id="slaveId"
                  type="number"
                  min="1"
                  max="247"
                  value={formData.slaveId}
                  onChange={(e) => setFormData({ ...formData, slaveId: Number.parseInt(e.target.value) || 1 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Write Function</Label>
                <Select
                  value={formData.function}
                  onValueChange={(value) => setFormData({ ...formData, function: value as ModbusFunction })}
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
            </div>

            <div className="space-y-2">
              <Label>Write Mode</Label>
              <Select
                value={formData.writeMode}
                onValueChange={(value: 'single' | 'multiple') => {
                  setFormData({
                    ...formData,
                    writeMode: value,
                    function:
                      value === 'multiple'
                        ? 'Write Multiple Registers'
                        : formData.function === 'Write Multiple Registers'
                          ? 'Write Single Register'
                          : formData.function,
                  })
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Single Register</SelectItem>
                  <SelectItem value="multiple">Multiple Registers</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.writeMode === 'multiple' && (
              <div className="space-y-2">
                <Label htmlFor="registerCount">Number of Registers</Label>
                <Input
                  id="registerCount"
                  type="number"
                  min="1"
                  max="100"
                  value={formData.registerCount}
                  onChange={(e) => setFormData({ ...formData, registerCount: Number.parseInt(e.target.value) || 1 })}
                />
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Starting Address</Label>
                <Input
                  type="number"
                  min="0"
                  max="65535"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: Number.parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>
                  Value{formData.writeMode === 'multiple' ? 's' : ''} *
                  {formData.writeMode === 'multiple' && (
                    <span className="text-xs text-muted-foreground ml-1">(comma-separated, e.g., 100, 200, 300)</span>
                  )}
                </Label>
                <Input
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  placeholder={formData.writeMode === 'multiple' ? 'e.g., 100, 200, 300' : 'Enter value to write'}
                />
              </div>
            </div>

            {formData.writeMode === 'multiple' && (
              <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <Info className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-blue-600">
                  Multiple register mode will write {formData.registerCount} registers starting from address{' '}
                  {formData.address}. Enter {formData.registerCount} values separated by commas.
                </p>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Data Type</Label>
                <Select
                  value={formData.dataType}
                  onValueChange={(value) => setFormData({ ...formData, dataType: value as DataType })}
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
                  value={formData.byteOrder}
                  onValueChange={(value) => setFormData({ ...formData, byteOrder: value as ByteOrder })}
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

            <div className="flex gap-2">
              <Button onClick={handleCreate} className="flex-1" disabled={createParameterMutation.isPending}>
                <Save className="h-4 w-4 mr-2" />
                {createParameterMutation.isPending
                  ? 'Creating...'
                  : editingParam
                    ? 'Update Parameter'
                    : 'Create Parameter'}
              </Button>
              <Button
                onClick={() => {
                  setShowForm(false)
                  setEditingParam(null)
                }}
                variant="outline"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Display existing writable parameters */}
      {writableParameters.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Existing Writable Parameters</CardTitle>
            <CardDescription>Parameters already configured for this device</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {writableParameters.map((param) => (
                <div key={param.id} className="flex items-center justify-between p-2 border rounded-md">
                  <div>
                    <span className="font-medium">{param.nama}</span>
                    {param.unit && <span className="text-sm text-muted-foreground ml-2">({param.unit})</span>}
                  </div>
                  <Badge variant="outline">ID: {param.id}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {writeParameters.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Plus className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No Write Parameters Yet</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Create write parameters to configure values that can be written to your Modbus device
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {writeParameters.map((param) => (
            <Card key={param.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-base">{param.name}</CardTitle>
                    <CardDescription className="mt-1">
                      Slave {param.slaveId} • Address {param.address}
                      {param.writeMode === 'multiple' && ` - ${param.address + (param.registerCount || 1) - 1}`}
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {param.writeMode === 'multiple' ? `${param.registerCount}x Regs` : 'Single'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Value{param.writeMode === 'multiple' ? 's' : ''}:</span>
                    <span className="font-mono font-semibold text-right max-w-[200px] truncate">{param.value}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Data Type:</span>
                    <span className="font-mono text-xs">{param.dataType.toUpperCase()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Byte Order:</span>
                    <span className="font-mono text-xs">{param.byteOrder.split(' ')[0]}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button onClick={() => handleExecute(param)} className="flex-1" size="sm">
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Execute
                  </Button>
                  <Button onClick={() => handleEdit(param)} variant="outline" size="sm">
                    Edit
                  </Button>
                  <Button onClick={() => handleDelete(param)} variant="outline" size="sm">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {writeParameters.length > 0 && (
        <Card className="bg-muted/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {writeParameters.length} Write Parameter{writeParameters.length > 1 ? 's' : ''} Configured
                </p>
                <p className="text-xs text-muted-foreground mt-1">Ready to execute on {activeConnection.name}</p>
              </div>
              <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Ready
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

