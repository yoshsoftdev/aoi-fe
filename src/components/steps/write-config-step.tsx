import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Plus, Save, Trash2, CheckCircle2, Info, Edit } from 'lucide-react'
import { parameterService } from '@/services/parameterService'
import { modbusService } from '@/services/modbusService'
import { writeService } from '@/services/writeService'
import type { Connection, ModbusFunction, DataType, ByteOrder } from '@/types'
import type { Parameter } from '@/types/parameter'
import type { ModbusRTU, ModbusTCP } from '@/types/parameter'

interface ConfiguredWriteParameter {
  id: number
  parameter: Parameter
  modbusConfig: ModbusRTU | ModbusTCP | null
  slaveId: number
  address: number
  quantity: number
  functionCode: number
  dataType: string
  byteOrder: string
  value?: string | number
}

interface WriteConfigStepProps {
  activeConnection: Connection
  addLog: (
    message: string,
    type?: 'info' | 'error' | 'success' | 'warning',
    connectionId?: string,
    slaveId?: number,
  ) => void
  onNext?: () => void
  onParameterCreated?: (parameter: Parameter) => void
}

export function WriteConfigStep({ activeConnection, addLog, onNext, onParameterCreated }: WriteConfigStepProps) {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editingParam, setEditingParam] = useState<ConfiguredWriteParameter | null>(null)
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
  const { data: allParameters = [], refetch: refetchParameters } = useQuery({
    queryKey: ['parameters'],
    queryFn: () => parameterService.getAll(),
  })

  // Fetch Modbus RTU configs
  const { data: rtuConfigs = [] } = useQuery({
    queryKey: ['modbus-rtu'],
    queryFn: () => modbusService.getAllRTU(),
    enabled: activeConnection.protocol === 'Modbus RTU',
  })

  // Fetch Modbus TCP configs
  const { data: tcpConfigs = [] } = useQuery({
    queryKey: ['modbus-tcp'],
    queryFn: () => modbusService.getAllTCP(),
    enabled: activeConnection.protocol === 'Modbus TCP',
  })

  // Filter writable parameters for this connection and build configured list
  const configuredParameters: ConfiguredWriteParameter[] = allParameters
    .filter(
      (p) =>
        p.device_id === parseInt(activeConnection.id, 10) &&
        (p.direction === 'WRITE' || (p.direction === undefined && (p as any).read_write === true)) &&
        ((p as any).is_formula === false || (p as any).is_formula === undefined),
    )
    .map((param) => {
      const modbusConfigs = activeConnection.protocol === 'Modbus RTU' ? rtuConfigs : tcpConfigs
      const modbusConfig = modbusConfigs.find((c) => c.id_parameter === param.id) || null

      return {
        id: param.id,
        parameter: param,
        modbusConfig,
        slaveId: modbusConfig?.slave_id || 1,
        address: modbusConfig?.register_address || 0,
        quantity: modbusConfig?.quantity || 1,
        functionCode: modbusConfig?.function_code || 6,
        dataType: modbusConfig?.data_type || 'uint16',
        byteOrder: modbusConfig?.byte_order || 'ABCD',
        value: (param as any).preset_value || undefined,
      }
    })

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
      const direction: 'READ' | 'WRITE' = data.direction === 'READ' || data.direction === 'WRITE' ? data.direction : 'WRITE'
      const type: 'modbus_rtu' | 'modbus_tcp' =
        data.type === 'modbus_rtu' || data.type === 'modbus_tcp' ? data.type : 'modbus_rtu'

      const param = await parameterService.create({
        nama: data.nama,
        device_id: data.device_id,
        type,
        direction,
        read_write: direction === 'WRITE',
      })

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
      queryClient.invalidateQueries({ queryKey: ['modbus-rtu'] })
      queryClient.invalidateQueries({ queryKey: ['modbus-tcp'] })
      addLog(`Created write parameter: ${param.nama}`, 'success', activeConnection.id)
      onParameterCreated?.(param)
      setShowForm(false)
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
    },
    onError: (error: any) => {
      addLog(`Failed to create parameter: ${error.message}`, 'error', activeConnection.id)
    },
  })

  const handleCreate = async () => {
    if (!formData.name) {
      addLog('Please enter a parameter name', 'error', activeConnection.id)
      return
    }

    if (formData.slaveId < 1 || formData.slaveId > 247) {
      addLog('Invalid Slave ID. Must be between 1-247', 'error', activeConnection.id)
      return
    }

    let functionCode = 6 // Write Single Register
    if (formData.function === 'Write Multiple Registers') {
      functionCode = 16
    } else if (formData.function === 'Write Single Coil') {
      functionCode = 5
    }

    const paramType = activeConnection.protocol === 'Modbus TCP' ? 'modbus_tcp' : 'modbus_rtu'
    const byteOrderMap: Record<string, string> = {
      'Big Endian (AB CD)': 'ABCD',
      'Little Endian (CD AB)': 'CDAB',
      'Big Endian Swap (BA DC)': 'BADC',
      'Little Endian Swap (DC BA)': 'DCBA',
    }

    try {
      await createParameterMutation.mutateAsync({
        nama: formData.name,
        device_id: parseInt(activeConnection.id, 10),
        type: paramType,
        direction: 'WRITE',
        slave_id: formData.slaveId,
        function_code: functionCode,
        register_address: formData.address,
        quantity: formData.writeMode === 'multiple' ? formData.registerCount || 1 : 1,
        data_type: formData.dataType,
        byte_order: byteOrderMap[formData.byteOrder] || 'ABCD',
      })
    } catch (error: any) {
      // Error already handled in mutation
    }
  }

  const handleEdit = (param: ConfiguredWriteParameter) => {
    setEditingParam(param)
    const functionName =
      param.functionCode === 5
        ? 'Write Single Coil'
        : param.functionCode === 16
          ? 'Write Multiple Registers'
          : 'Write Single Register'
    const byteOrderReverseMap: Record<string, string> = {
      ABCD: 'Big Endian (AB CD)',
      CDAB: 'Little Endian (CD AB)',
      BADC: 'Big Endian Swap (BA DC)',
      DCBA: 'Little Endian Swap (DC BA)',
    }

    setFormData({
      name: param.parameter.nama,
      slaveId: param.slaveId,
      function: functionName as ModbusFunction,
      address: param.address,
      value: param.value?.toString() || '',
      writeMode: param.quantity > 1 ? 'multiple' : 'single',
      registerCount: param.quantity,
      dataType: param.dataType as DataType,
      byteOrder: (byteOrderReverseMap[param.byteOrder] || 'Big Endian (AB CD)') as ByteOrder,
    })
    setShowForm(true)
  }

  const handleDelete = async (param: ConfiguredWriteParameter) => {
    if (!confirm(`Are you sure you want to delete parameter "${param.parameter.nama}"?`)) {
      return
    }

    try {
      await parameterService.delete(param.id)
      queryClient.invalidateQueries({ queryKey: ['parameters'] })
      queryClient.invalidateQueries({ queryKey: ['modbus-rtu'] })
      queryClient.invalidateQueries({ queryKey: ['modbus-tcp'] })
      addLog(`Deleted write parameter: ${param.parameter.nama}`, 'info', activeConnection.id)
    } catch (error: any) {
      addLog(`Failed to delete parameter: ${error.message}`, 'error', activeConnection.id)
    }
  }

  const handleExecute = async (param: ConfiguredWriteParameter) => {
    if (!param.parameter) {
      addLog(`Parameter not found`, 'error', activeConnection.id)
      return
    }

    // Determine register values based on parameter configuration
    let registerValues: number[] = []
    
    // Check if parameter has preset_value
    const presetValue = (param.parameter as any).preset_value
    if (presetValue) {
      try {
        // Try to parse preset_value as JSON
        const parsed = JSON.parse(presetValue)
        if (parsed.register_values && Array.isArray(parsed.register_values)) {
          registerValues = parsed.register_values.map((v: any) => Math.max(0, Math.min(65535, Math.floor(Number(v)))))
        } else if (parsed.value !== undefined) {
          // Single scalar value
          registerValues = [Math.max(0, Math.min(65535, Math.floor(Number(parsed.value))))]
        } else {
          // Fallback: use the value directly if it's a number
          registerValues = [Math.max(0, Math.min(65535, Math.floor(Number(presetValue))))]
        }
      } catch {
        // If not JSON, try to parse as number
        const numValue = Number(presetValue)
        if (!isNaN(numValue)) {
          registerValues = [Math.max(0, Math.min(65535, Math.floor(numValue)))]
        }
      }
    }
    
    // If no preset_value or parsing failed, use default based on quantity
    if (registerValues.length === 0) {
      // Default: fill with 1 for each register
      registerValues = Array(param.quantity).fill(1)
    } else if (registerValues.length !== param.quantity) {
      // If quantity doesn't match, pad or truncate
      if (registerValues.length < param.quantity) {
        // Pad with last value
        const lastValue = registerValues[registerValues.length - 1] || 1
        while (registerValues.length < param.quantity) {
          registerValues.push(lastValue)
        }
      } else {
        // Truncate to quantity
        registerValues = registerValues.slice(0, param.quantity)
      }
    }

    // Ensure all values are uint16 (0-65535)
    registerValues = registerValues.map(v => Math.max(0, Math.min(65535, Math.floor(v))))

    addLog(
      `Executing write: ${param.parameter.nama} - Slave ${param.slaveId}, Address ${param.address}, Values: [${registerValues.join(', ')}]`,
      'info',
      activeConnection.id,
      param.slaveId,
    )

    try {
      const response = await writeService.execute(param.parameter.id, 'manual', undefined, registerValues)
      if (response.success) {
        addLog(
          `Write successful: ${param.parameter.nama} - Values [${registerValues.join(', ')}] written`,
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

  const getByteOrderDisplay = (byteOrder: string): string => {
    const map: Record<string, string> = {
      ABCD: 'Big',
      CDAB: 'Little',
      BADC: 'Big Swap',
      DCBA: 'Little Swap',
    }
    return map[byteOrder] || byteOrder
  }

  const getFunctionCodeName = (fc: number): string => {
    if (fc === 5) return 'Coil'
    if (fc === 6) return 'Single'
    if (fc === 16) return 'Multiple'
    return 'Single'
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

      {/* Display configured parameters */}
      {configuredParameters.length === 0 && !showForm ? (
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
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {configuredParameters.map((param) => (
              <Card key={param.id} className="bg-card">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2">
                        {param.parameter.nama}
                        <Badge variant="outline" className="text-xs">
                          {getFunctionCodeName(param.functionCode)}
                        </Badge>
                      </CardTitle>
                      <CardDescription className="mt-1">
                        Slave {param.slaveId} • Address {param.address === 0 ? 'O' : param.address}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Value:</span>
                      <span className="font-mono font-semibold">{param.value ?? 1}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Data Type:</span>
                      <span className="font-mono">{param.dataType.toUpperCase()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Byte Order:</span>
                      <span className="font-mono">{getByteOrderDisplay(param.byteOrder)}</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={() => handleExecute(param)} size="sm" className="flex-1">
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Execute
                    </Button>
                    <Button onClick={() => handleEdit(param)} variant="outline" size="sm">
                      <Edit className="h-4 w-4 mr-2" />
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

          {configuredParameters.length > 0 && (
            <Card className="border-primary/50 bg-primary/5">
              <CardContent className="flex items-center justify-between py-4">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {configuredParameters.length} Write Parameter{configuredParameters.length > 1 ? 's' : ''}{' '}
                    Configured
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Ready to execute on {activeConnection.name}</p>
                </div>
                <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Ready
                </Badge>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
