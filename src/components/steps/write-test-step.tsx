import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, ArrowRight, Info, Plus, X } from 'lucide-react'
import { parameterService } from '@/services/parameterService'
import { modbusService } from '@/services/modbusService'
import { writeService } from '@/services/writeService'
import type { Connection } from '@/types'
import type { Parameter, ModbusRTU, ModbusTCP } from '@/types/parameter'

interface WriteTestStepProps {
  activeConnection: Connection
  addLog: (
    message: string,
    type?: 'info' | 'error' | 'success' | 'warning',
    connectionId?: string,
    slaveId?: number
  ) => void
  onParameterSelected?: (
    parameter: Parameter,
    config: {
      slaveId: number
      functionCode: number
      registerAddress: number
      quantity: number
      dataType: string
      byteOrder: string
    }
  ) => void
  onNext?: () => void
}

export function WriteTestStep({ activeConnection, addLog, onParameterSelected, onNext }: WriteTestStepProps) {
  const queryClient = useQueryClient()
  const [selectedParameterId, setSelectedParameterId] = useState<number | null>(null)
  const [modbusConfig, setModbusConfig] = useState<ModbusRTU | ModbusTCP | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [createFormData, setCreateFormData] = useState({
    nama: '',
    slave_id: 1,
    function_code: 6, // Default: Write Single Register
    register_address: 0,
    quantity: 1,
    data_type: 'uint16',
    byte_order: 'ABCD',
    test_value: '', // Value untuk test write
  })
  const [testWriteResult, setTestWriteResult] = useState<{
    success: boolean
    message: string
  } | null>(null)
  const [isTestingWrite, setIsTestingWrite] = useState(false)
  const [testWritePassed, setTestWritePassed] = useState(false)
  const [tempParameterId, setTempParameterId] = useState<number | null>(null) // Store temporary parameter ID

  // Fetch all parameters
  const { data: allParameters = [], refetch: refetchParameters } = useQuery({
    queryKey: ['parameters'],
    queryFn: () => parameterService.getAll(),
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
      // First create the parameter
      const param = await parameterService.create({
        nama: data.nama,
        device_id: data.device_id,
        type: data.type,
        direction: data.direction,
        is_formula: false,
        read_write: true,
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
          read_write: true,
          scaling: 1.0,
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
          read_write: true,
          scaling: 1.0,
        })
      }

      return param
    },
    onSuccess: async (param) => {
      queryClient.invalidateQueries({ queryKey: ['parameters'] })
      queryClient.invalidateQueries({ queryKey: ['modbus-rtu'] })
      queryClient.invalidateQueries({ queryKey: ['modbus-tcp'] })
      addLog(`Created write parameter: ${param.nama}`, 'success', activeConnection.id)
      
      // Reset form
      setCreateFormData({
        nama: '',
        slave_id: 1,
        function_code: 6,
        register_address: 0,
        quantity: 1,
        data_type: 'uint16',
        byte_order: 'ABCD',
      })
      setShowCreateForm(false)
      
      // Refetch to get the new parameter with config
      await refetchParameters()
      
      // Small delay to ensure configs are loaded, then auto-select
      setTimeout(async () => {
        setSelectedParameterId(param.id)
        
        // Load Modbus config for the newly created parameter
        try {
          const paramType = activeConnection.protocol === 'Modbus TCP' ? 'modbus_tcp' : 'modbus_rtu'
          if (paramType === 'modbus_rtu') {
            const rtuConfigs = await modbusService.getAllRTU()
            const config = rtuConfigs.find((c) => c.id_parameter === param.id)
            if (config) {
              setModbusConfig(config)
              addLog(`Loaded Modbus RTU config for parameter ${param.nama}`, 'success')
            }
          } else {
            const tcpConfigs = await modbusService.getAllTCP()
            const config = tcpConfigs.find((c) => c.id_parameter === param.id)
            if (config) {
              setModbusConfig(config)
              addLog(`Loaded Modbus TCP config for parameter ${param.nama}`, 'success')
            }
          }
        } catch (error: any) {
          addLog(`Failed to load Modbus config: ${error.message}`, 'error')
        }
      }, 500)
    },
    onError: (error: any) => {
      addLog(`Failed to create parameter: ${error.message}`, 'error', activeConnection.id)
    },
  })

  // Test write before saving parameter
  const handleTestWrite = async () => {
    if (!createFormData.nama.trim()) {
      addLog('Please enter parameter name', 'error', activeConnection.id)
      return
    }

    if (createFormData.slave_id < 1 || createFormData.slave_id > 247) {
      addLog('Invalid Slave ID. Must be between 1-247', 'error', activeConnection.id)
      return
    }

    if (!createFormData.test_value.trim()) {
      addLog('Please enter a test value', 'error', activeConnection.id)
      return
    }

    setIsTestingWrite(true)
    setTestWriteResult(null)
    setTestWritePassed(false)

    // Determine parameter type from connection
    const paramType = activeConnection.protocol === 'Modbus TCP' ? 'modbus_tcp' : 'modbus_rtu'

    let tempParameterId: number | null = null

    try {
      addLog('Creating temporary parameter for test write...', 'info', activeConnection.id)
      
      // Step 1: Create parameter temporary
      const param = await parameterService.create({
        nama: createFormData.nama,
        device_id: parseInt(activeConnection.id, 10),
        type: paramType,
        direction: 'WRITE',
        is_formula: false,
        read_write: true,
      })
      tempParameterId = param.id

      // Step 2: Create Modbus config
      if (paramType === 'modbus_rtu') {
        await modbusService.createRTU({
          id_parameter: param.id,
          slave_id: createFormData.slave_id,
          function_code: createFormData.function_code,
          register_address: createFormData.register_address,
          quantity: createFormData.quantity,
          data_type: createFormData.data_type,
          byte_order: createFormData.byte_order,
          read_write: true,
          scaling: 1.0,
        })
      } else if (paramType === 'modbus_tcp') {
        await modbusService.createTCP({
          id_parameter: param.id,
          slave_id: createFormData.slave_id,
          function_code: createFormData.function_code,
          register_address: createFormData.register_address,
          quantity: createFormData.quantity,
          data_type: createFormData.data_type,
          byte_order: createFormData.byte_order,
          read_write: true,
          scaling: 1.0,
        })
      }

      addLog('Testing write operation...', 'info', activeConnection.id)

      // Step 3: Parse and encode test value to register values
      let testRegisterValues: number[] = []
      if (createFormData.test_value.trim()) {
        // Parse test value - support single value or comma-separated values for multiple registers
        if (createFormData.quantity > 1) {
          // Multiple registers: parse comma-separated values
          const values = createFormData.test_value.split(',').map(v => parseFloat(v.trim())).filter(v => !isNaN(v))
          if (values.length === createFormData.quantity) {
            testRegisterValues = values.map(v => Math.round(v))
          } else {
            throw new Error(`Please provide ${createFormData.quantity} comma-separated values for ${createFormData.quantity} registers`)
          }
        } else {
          // Single register: parse single value
          const value = parseFloat(createFormData.test_value.trim())
          if (isNaN(value)) {
            throw new Error('Invalid test value. Please enter a valid number.')
          }
          testRegisterValues = [Math.round(value)]
        }
      } else {
        // Default: use 0 for test
        testRegisterValues = createFormData.quantity === 1 ? [0] : new Array(createFormData.quantity).fill(0)
      }

      // Step 4: Test write with TEST mode (doesn't update cache, just validates write capability)
      const writeResult = await writeService.execute(param.id, 'test', undefined, testRegisterValues)

      if (writeResult.success) {
        setTestWriteResult({
          success: true,
          message: writeResult.message || 'Test write successful',
        })
        setTestWritePassed(true)
        setTempParameterId(param.id) // Store temp parameter ID for saving later
        addLog(`Test write successful: ${writeResult.message}`, 'success', activeConnection.id)
      } else {
        throw new Error(writeResult.error || writeResult.message || 'Test write failed')
      }
    } catch (error: any) {
      setTestWriteResult({
        success: false,
        message: error.message || 'Test write failed',
      })
      setTestWritePassed(false)
      addLog(`Test write failed: ${error.message}`, 'error', activeConnection.id)
      
      // Delete temporary parameter if created
      if (tempParameterId) {
        try {
          await parameterService.delete(tempParameterId)
          addLog('Deleted temporary parameter due to test write failure', 'info', activeConnection.id)
        } catch (deleteError: any) {
          addLog(`Failed to delete temporary parameter: ${deleteError.message}`, 'warning', activeConnection.id)
        }
      }
    } finally {
      setIsTestingWrite(false)
    }
  }

  // Save parameter after successful test write
  const handleSaveParameter = async () => {
    if (!tempParameterId) {
      addLog('No parameter to save. Please test write first.', 'error', activeConnection.id)
      return
    }

    try {
      addLog('Saving parameter...', 'info', activeConnection.id)
      
      // Parameter already exists (created during test write), just refresh and select it
      await refetchParameters()
      queryClient.invalidateQueries({ queryKey: ['parameters'] })
      queryClient.invalidateQueries({ queryKey: ['modbus-rtu'] })
      queryClient.invalidateQueries({ queryKey: ['modbus-tcp'] })
      
      // Auto-select the created parameter
      setTimeout(async () => {
        setSelectedParameterId(tempParameterId)
        
        // Load Modbus config
        try {
          const paramType = activeConnection.protocol === 'Modbus TCP' ? 'modbus_tcp' : 'modbus_rtu'
          if (paramType === 'modbus_rtu') {
            const rtuConfigs = await modbusService.getAllRTU()
            const config = rtuConfigs.find((c) => c.id_parameter === tempParameterId)
            if (config) {
              setModbusConfig(config)
            }
          } else {
            const tcpConfigs = await modbusService.getAllTCP()
            const config = tcpConfigs.find((c) => c.id_parameter === tempParameterId)
            if (config) {
              setModbusConfig(config)
            }
          }
        } catch (error: any) {
          addLog(`Failed to load Modbus config: ${error.message}`, 'error')
        }
        
        // Reset form and close
        setCreateFormData({
          nama: '',
          slave_id: 1,
          function_code: 6,
          register_address: 0,
          quantity: 1,
          data_type: 'uint16',
          byte_order: 'ABCD',
          test_value: '',
        })
        setShowCreateForm(false)
        setTestWriteResult(null)
        setTestWritePassed(false)
        setTempParameterId(null)
      }, 500)
      
      addLog('Parameter saved successfully', 'success', activeConnection.id)
    } catch (error: any) {
      addLog(`Failed to save parameter: ${error.message}`, 'error', activeConnection.id)
    }
  }

  // Filter writable parameters for this connection
  // CRITICAL: Only show parameters with direction='WRITE'
  const writableParameters = allParameters.filter((p) => {
    const matchesDevice = p.device_id === parseInt(activeConnection.id, 10)
    const isWriteDirection = p.direction === 'WRITE' || (p.direction === undefined && p.read_write === true)
    const isNotFormula = (p as any).is_formula === false || (p as any).is_formula === undefined
    return matchesDevice && isWriteDirection && isNotFormula
  })

  // Fetch Modbus config when parameter is selected
  useEffect(() => {
    if (!selectedParameterId) {
      setModbusConfig(null)
      return
    }

    // Small delay to ensure parameter list is updated after create
    const timer = setTimeout(async () => {
      const selectedParam = allParameters.find((p) => p.id === selectedParameterId)
      if (!selectedParam) return

      try {
        if (selectedParam.type === 'modbus_rtu') {
          const rtuConfigs = await modbusService.getAllRTU()
          const config = rtuConfigs.find((c) => c.id_parameter === selectedParameterId)
          if (config) {
            setModbusConfig(config)
            addLog(`Loaded Modbus RTU config for parameter ${selectedParam.nama}`, 'success')
          }
        } else if (selectedParam.type === 'modbus_tcp') {
          const tcpConfigs = await modbusService.getAllTCP()
          const config = tcpConfigs.find((c) => c.id_parameter === selectedParameterId)
          if (config) {
            setModbusConfig(config)
            addLog(`Loaded Modbus TCP config for parameter ${selectedParam.nama}`, 'success')
          }
        }
      } catch (error: any) {
        addLog(`Failed to load Modbus config: ${error.message}`, 'error')
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [selectedParameterId, allParameters, addLog])

  const selectedParameter = writableParameters.find((p) => p.id === selectedParameterId)

  const handleNext = () => {
    if (!selectedParameter || !modbusConfig) {
      addLog('Please select a writable parameter', 'warning')
      return
    }

    // Determine function code (6 for single register, 16 for multiple)
    const functionCode = modbusConfig.quantity === 1 ? 6 : 16

    if (onParameterSelected) {
      onParameterSelected(selectedParameter, {
        slaveId: modbusConfig.slave_id,
        functionCode,
        registerAddress: modbusConfig.register_address,
        quantity: modbusConfig.quantity,
        dataType: modbusConfig.data_type || 'uint16',
        byteOrder: modbusConfig.byte_order,
      })
    }

    if (onNext) {
      onNext()
    }
  }

  const canProceed = selectedParameter && modbusConfig

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Step 2: Select OR Create Write Parameter</h2>
          <p className="text-sm text-muted-foreground mt-1">Select an existing writable parameter or create a new one</p>
        </div>
        {!showCreateForm && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCreateForm(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Create New Parameter
          </Button>
        )}
      </div>

      {/* Create Parameter Form */}
      {showCreateForm && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Create Write Parameter</CardTitle>
                <CardDescription>
                  Create a new writable parameter. <strong>Test write is required</strong> before parameter can be saved.
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowCreateForm(false)
                  setCreateFormData({
                    nama: '',
                    slave_id: 1,
                    function_code: 6,
                    register_address: 0,
                    quantity: 1,
                    data_type: 'uint16',
                    byte_order: 'ABCD',
                  })
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="param-name">Parameter Name *</Label>
              <Input
                id="param-name"
                value={createFormData.nama}
                onChange={(e) => setCreateFormData({ ...createFormData, nama: e.target.value })}
                placeholder="e.g., Set Motor Speed, Control Relay"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="slave-id">Slave ID (1-247) *</Label>
                <Input
                  id="slave-id"
                  type="number"
                  min="1"
                  max="247"
                  value={createFormData.slave_id}
                  onChange={(e) => setCreateFormData({ ...createFormData, slave_id: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="function-code">Function Code *</Label>
                <Select
                  value={createFormData.function_code.toString()}
                  onValueChange={(value) => setCreateFormData({ ...createFormData, function_code: parseInt(value) })}
                >
                  <SelectTrigger id="function-code">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 - Write Single Coil</SelectItem>
                    <SelectItem value="6">6 - Write Single Register</SelectItem>
                    <SelectItem value="16">16 - Write Multiple Registers</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="register-address">Register Address *</Label>
                <Input
                  id="register-address"
                  type="number"
                  min="0"
                  max="65535"
                  value={createFormData.register_address}
                  onChange={(e) => setCreateFormData({ ...createFormData, register_address: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity *</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  max="100"
                  value={createFormData.quantity}
                  onChange={(e) => setCreateFormData({ ...createFormData, quantity: parseInt(e.target.value) || 1 })}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="data-type">Data Type *</Label>
                <Select
                  value={createFormData.data_type}
                  onValueChange={(value) => {
                    setCreateFormData((prev) => {
                      let quantity = prev.quantity
                      if (value === 'float64') {
                        quantity = 4
                      } else if (value === 'float32' || value === 'int32' || value === 'uint32') {
                        quantity = 2
                      } else {
                        quantity = 1
                      }
                      return { ...prev, data_type: value, quantity }
                    })
                  }}
                >
                  <SelectTrigger id="data-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="uint16">uint16 (1 register)</SelectItem>
                    <SelectItem value="int16">int16 (1 register)</SelectItem>
                    <SelectItem value="uint32">uint32 (2 registers)</SelectItem>
                    <SelectItem value="int32">int32 (2 registers)</SelectItem>
                    <SelectItem value="float32">float32 (2 registers)</SelectItem>
                    <SelectItem value="float64">float64 (4 registers)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="byte-order">Byte Order *</Label>
                <Select
                  value={createFormData.byte_order}
                  onValueChange={(value) => setCreateFormData({ ...createFormData, byte_order: value })}
                >
                  <SelectTrigger id="byte-order">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ABCD">ABCD (Big Endian)</SelectItem>
                    <SelectItem value="DCBA">DCBA (Little Endian)</SelectItem>
                    <SelectItem value="BADC">BADC (Byte Swap)</SelectItem>
                    <SelectItem value="CDAB">CDAB (Word Swap)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Test Value Field */}
            <div className="space-y-2">
              <Label htmlFor="test-value">
                Test Value * {createFormData.quantity > 1 && `(Enter ${createFormData.quantity} comma-separated values)`}
              </Label>
              <Input
                id="test-value"
                type="text"
                value={createFormData.test_value}
                onChange={(e) => setCreateFormData({ ...createFormData, test_value: e.target.value })}
                placeholder={
                  createFormData.quantity > 1
                    ? `e.g., 100, 200, 300 (for ${createFormData.quantity} registers)`
                    : 'e.g., 100 (single register value)'
                }
              />
              <p className="text-xs text-muted-foreground">
                Enter the value(s) to test write. For multiple registers, use comma-separated values.
              </p>
            </div>

            {/* Test Write Result */}
            {testWriteResult && (
              <div
                className={`rounded-lg border p-4 ${
                  testWriteResult.success
                    ? 'border-green-500 bg-green-50 dark:bg-green-950 text-green-900 dark:text-green-100'
                    : 'border-red-500 bg-red-50 dark:bg-red-950 text-red-900 dark:text-red-100'
                }`}
              >
                <div className="flex items-start gap-2">
                  {testWriteResult.success ? (
                    <Info className="h-5 w-5 mt-0.5 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      {testWriteResult.success ? 'Test Write Successful' : 'Test Write Failed'}
                    </p>
                    <p className="text-xs mt-1">{testWriteResult.message}</p>
                    {testWriteResult.success && (
                      <p className="text-xs mt-2 font-medium">
                        Test write successful! Click "Save Parameter" to confirm and save the parameter.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              {!testWritePassed ? (
                <>
                  <Button
                    onClick={handleTestWrite}
                    disabled={isTestingWrite || !createFormData.nama.trim() || !createFormData.test_value.trim()}
                    className="flex-1"
                  >
                    {isTestingWrite ? 'Testing Write...' : 'Test Write'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowCreateForm(false)
                      setCreateFormData({
                        nama: '',
                        slave_id: 1,
                        function_code: 6,
                        register_address: 0,
                        quantity: 1,
                        data_type: 'uint16',
                        byte_order: 'ABCD',
                        test_value: '',
                      })
                      setTestWriteResult(null)
                      setTestWritePassed(false)
                      setTempParameterId(null)
                    }}
                    disabled={isTestingWrite}
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    onClick={handleSaveParameter}
                    className="flex-1"
                    variant="default"
                  >
                    Save Parameter
                  </Button>
                  <Button
                    variant="outline"
                    onClick={async () => {
                      // Reset everything and delete temp parameter
                      if (tempParameterId) {
                        try {
                          await parameterService.delete(tempParameterId)
                        } catch (error) {
                          // Ignore delete errors
                        }
                      }
                      setShowCreateForm(false)
                      setCreateFormData({
                        nama: '',
                        slave_id: 1,
                        function_code: 6,
                        register_address: 0,
                        quantity: 1,
                        data_type: 'uint16',
                        byte_order: 'ABCD',
                        test_value: '',
                      })
                      setTestWriteResult(null)
                      setTestWritePassed(false)
                      setTempParameterId(null)
                    }}
                  >
                    Cancel
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Parameter Selection */}
      {!showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Select Writable Parameter</CardTitle>
            <CardDescription>Choose a parameter that supports write operations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="parameter-select">Parameter</Label>
            <Select
              value={selectedParameterId?.toString() || ''}
              onValueChange={(value) => setSelectedParameterId(value ? parseInt(value, 10) : null)}
            >
              <SelectTrigger id="parameter-select">
                <SelectValue placeholder="Select a writable parameter" />
              </SelectTrigger>
              <SelectContent>
                {writableParameters.length === 0 ? (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                    No writable parameters found for this connection
                  </div>
                ) : (
                  writableParameters.map((param) => (
                    <SelectItem key={param.id} value={param.id.toString()}>
                      {param.nama} {param.unit && `(${param.unit})`}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {writableParameters.length === 0 && (
            <div className="rounded-lg border border-yellow-500 bg-yellow-50 dark:bg-yellow-950 p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100">
                    No writable parameters available
                  </p>
                  <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1 mb-3">
                    <strong>WRITE parameters must be created first</strong> before they can be used for write operations.
                    <br />
                    <br />
                    To create a WRITE parameter:
                    <br />
                    1. Go to <strong>Parameters</strong> page
                    <br />
                    2. Create a new parameter with <strong>direction=WRITE</strong>
                    <br />
                    3. Configure Modbus settings (slave_id, register_address, quantity, data_type, byte_order)
                    <br />
                    4. Return to this page and refresh the parameter list
                    <br />
                    <br />
                    <strong>Note:</strong> WRITE parameters are command-based and executed on-demand, not scheduled for polling.
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={async () => {
                      // Refetch parameters
                      await refetchParameters()
                      addLog('Refreshed parameter list', 'success')
                    }}
                  >
                    Refresh Parameter List
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Parameter Metadata (Read-only) */}
          {selectedParameter && modbusConfig && (
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">Parameter Configuration</span>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Parameter Name</Label>
                  <p className="text-sm font-medium text-foreground">{selectedParameter.nama}</p>
                </div>
                {selectedParameter.unit && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Unit</Label>
                    <p className="text-sm font-medium text-foreground">{selectedParameter.unit}</p>
                  </div>
                )}
                <div>
                  <Label className="text-xs text-muted-foreground">Slave ID</Label>
                  <p className="text-sm font-medium text-foreground">{modbusConfig.slave_id}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Function Code</Label>
                  <p className="text-sm font-medium text-foreground">
                    {modbusConfig.quantity === 1 ? '6' : '16'} ({modbusConfig.quantity === 1 ? 'Write Single Register' : 'Write Multiple Registers'})
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Register Address</Label>
                  <p className="text-sm font-medium text-foreground">
                    {modbusConfig.register_address}
                    {modbusConfig.quantity > 1 && ` – ${modbusConfig.register_address + modbusConfig.quantity - 1}`}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Quantity</Label>
                  <p className="text-sm font-medium text-foreground">{modbusConfig.quantity} register(s)</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Data Type</Label>
                  <Badge variant="outline" className="mt-1">
                    {modbusConfig.data_type || 'uint16'}
                  </Badge>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Byte Order</Label>
                  <Badge variant="outline" className="mt-1">
                    {modbusConfig.byte_order}
                  </Badge>
                </div>
              </div>

              {selectedParameter.description && (
                <div>
                  <Label className="text-xs text-muted-foreground">Description</Label>
                  <p className="text-sm text-foreground mt-1">{selectedParameter.description}</p>
                </div>
              )}
            </div>
          )}

          {selectedParameter && !modbusConfig && (
            <div className="rounded-lg border border-yellow-500 bg-yellow-50 dark:bg-yellow-950 p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100">Loading configuration...</p>
                <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                  Fetching Modbus configuration for this parameter
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {/* Next Button */}
      <div className="flex justify-end">
        <Button onClick={handleNext} disabled={!canProceed}>
          Next: Write Value
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  )
}

