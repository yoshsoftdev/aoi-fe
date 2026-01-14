import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Plus, Save, Trash2, CheckCircle2, Info, Edit, AlertCircle, X } from 'lucide-react'
import { parameterService, ParameterDeleteError } from '@/services/parameterService'
import { modbusService } from '@/services/modbusService'
import { writeService } from '@/services/writeService'
import { DeleteConfirmationDialog } from '@/components/ui/delete-confirmation-dialog'
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
  onParameterCreated?: (parameter: Parameter) => void
}

export function WriteConfigStep({ activeConnection, addLog, onParameterCreated }: WriteConfigStepProps) {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editingParam, setEditingParam] = useState<ConfiguredWriteParameter | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [paramToDelete, setParamToDelete] = useState<ConfiguredWriteParameter | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    nama: '',
    slave_id: 1,
    function_code: 6, // Default: Write Single Register
    register_address: 0,
    quantity: 1,
    data_type: 'uint16',
    byte_order: 'ABCD',
    test_value: '', // Value untuk test write
    write_mode: 'DYNAMIC' as 'PRESET' | 'DYNAMIC', // Write mode: PRESET or DYNAMIC
    preset_value: '', // JSON string for PRESET mode
  })
  const [testWriteResult, setTestWriteResult] = useState<{
    success: boolean
    message: string
  } | null>(null)
  const [isTestingWrite, setIsTestingWrite] = useState(false)
  const [testWritePassed, setTestWritePassed] = useState(false)

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
      write_mode_type?: 'DYNAMIC' | 'PRESET'
      preset_value?: string
    }) => {
      const direction: 'READ' | 'WRITE' = data.direction === 'READ' || data.direction === 'WRITE' ? data.direction : 'WRITE'
      const type: 'modbus_rtu' | 'modbus_tcp' =
        data.type === 'modbus_rtu' || data.type === 'modbus_tcp' ? data.type : 'modbus_rtu'

      // Set write_mode for WRITE parameters
      const createData: any = {
        nama: data.nama,
        device_id: data.device_id,
        type,
        direction,
        read_write: direction === 'WRITE',
      }
      
      // WRITE parameters must have write_mode set
      if (direction === 'WRITE') {
        createData.write_mode = data.write_mode_type || 'DYNAMIC'
        
        // Add preset_value if PRESET mode
        if (createData.write_mode === 'PRESET' && data.preset_value) {
          // Validate JSON format
          try {
            JSON.parse(data.preset_value)
            createData.preset_value = data.preset_value
          } catch (e) {
            throw new Error('Preset Value must be valid JSON format')
          }
        }
      }
      
      const param = await parameterService.create(createData)

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
      addLog(`Parameter tulis dibuat: ${param.nama}`, 'success', activeConnection.id)
      onParameterCreated?.(param)
      setShowForm(false)
      setEditingParam(null)
      setFormData({
        nama: '',
        slave_id: 1,
        function_code: 6,
        register_address: 0,
        quantity: 1,
        data_type: 'uint16',
        byte_order: 'ABCD',
        test_value: '',
        write_mode: 'DYNAMIC',
        preset_value: '',
      })
      setTestWriteResult(null)
      setTestWritePassed(false)
    },
    onError: (error: any) => {
      addLog(`Gagal membuat parameter: ${error.message}`, 'error', activeConnection.id)
    },
  })

  // Update parameter mutation
  const updateParameterMutation = useMutation({
    mutationFn: async (data: {
      parameterId: number
      modbusConfigId: number | null
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

      // Get existing parameter to preserve write_mode and preset_value
      const existingParam = await parameterService.getById(data.parameterId)
      
      // Update parameter - preserve write_mode and preset_value
      const updateData: any = {
        nama: data.nama,
        device_id: data.device_id,
        type,
        direction,
        read_write: direction === 'WRITE',
      }
      
      // Preserve write_mode if it exists
      if ((existingParam as any).write_mode) {
        updateData.write_mode = (existingParam as any).write_mode
      }
      
      // Preserve preset_value if it exists
      if ((existingParam as any).preset_value) {
        updateData.preset_value = (existingParam as any).preset_value
      }
      
      const param = await parameterService.update(data.parameterId, updateData)

      // Update or create modbus config
      if (data.modbusConfigId) {
        // Update existing modbus config
        if (data.type === 'modbus_rtu') {
          await modbusService.updateRTU(data.modbusConfigId, {
            slave_id: data.slave_id,
            function_code: data.function_code,
            register_address: data.register_address,
            quantity: data.quantity,
            data_type: data.data_type,
            byte_order: data.byte_order,
            read_write: data.direction === 'WRITE',
          })
        } else if (data.type === 'modbus_tcp') {
          await modbusService.updateTCP(data.modbusConfigId, {
            slave_id: data.slave_id,
            function_code: data.function_code,
            register_address: data.register_address,
            quantity: data.quantity,
            data_type: data.data_type,
            byte_order: data.byte_order,
            read_write: data.direction === 'WRITE',
          })
        }
      } else {
        // Create new modbus config if it doesn't exist
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
      }

      return param
    },
    onSuccess: (param) => {
      queryClient.invalidateQueries({ queryKey: ['parameters'] })
      queryClient.invalidateQueries({ queryKey: ['modbus-rtu'] })
      queryClient.invalidateQueries({ queryKey: ['modbus-tcp'] })
      addLog(`Parameter tulis diperbarui: ${param.nama}`, 'success', activeConnection.id)
      setShowForm(false)
      setEditingParam(null)
      setFormData({
        nama: '',
        slave_id: 1,
        function_code: 6,
        register_address: 0,
        quantity: 1,
        data_type: 'uint16',
        byte_order: 'ABCD',
        test_value: '',
        write_mode: 'DYNAMIC',
        preset_value: '',
      })
      setTestWriteResult(null)
      setTestWritePassed(false)
    },
    onError: (error: any) => {
      addLog(`Gagal memperbarui parameter: ${error.message}`, 'error', activeConnection.id)
    },
  })

  // Test write before saving parameter
  // Uses test write endpoint that doesn't require parameter_id (no DB save)
  const handleTestWrite = async () => {
    if (!formData.nama.trim()) {
      addLog('Mohon masukkan nama parameter', 'error', activeConnection.id)
      return
    }

    if (formData.slave_id < 1 || formData.slave_id > 247) {
      addLog('Slave ID tidak valid. Harus antara 1-247', 'error', activeConnection.id)
      return
    }

    if (!formData.test_value.trim()) {
      addLog('Mohon masukkan nilai uji', 'error', activeConnection.id)
      return
    }

    if (formData.write_mode === 'PRESET' && !formData.preset_value.trim()) {
      addLog('Nilai Preset wajib untuk mode PRESET', 'error', activeConnection.id)
      return
    }

    setIsTestingWrite(true)
    setTestWriteResult(null)
    setTestWritePassed(false)

    // Determine parameter type from connection
    const paramType = activeConnection.protocol === 'Modbus TCP' ? 'modbus_tcp' : 'modbus_rtu'

    try {
      addLog('Menguji operasi tulis (parameter belum disimpan)...', 'info', activeConnection.id)

      // Parse and encode test value to register values
      let testRegisterValues: number[] = []
      if (formData.test_value.trim()) {
        // Parse test value - support single value or comma-separated values for multiple registers
        if (formData.quantity > 1) {
          // Multiple registers: parse comma-separated values
          const values = formData.test_value.split(',').map(v => parseFloat(v.trim())).filter(v => !isNaN(v))
          if (values.length === formData.quantity) {
            testRegisterValues = values.map(v => Math.round(v))
          } else {
            throw new Error(`Please provide ${formData.quantity} comma-separated values for ${formData.quantity} registers`)
          }
        } else {
          // Single register: parse single value
          const value = parseFloat(formData.test_value.trim())
          if (isNaN(value)) {
            throw new Error('Invalid test value. Please enter a valid number.')
          }
          testRegisterValues = [Math.round(value)]
        }
      } else {
        // Default: use 0 for test
        testRegisterValues = formData.quantity === 1 ? [0] : new Array(formData.quantity).fill(0)
      }

      // Test write using test endpoint (no parameter_id required, no DB save)
      const testWriteConfig = {
        device_id: parseInt(activeConnection.id, 10),
        protocol: paramType as 'modbus_rtu' | 'modbus_tcp',
        slave_id: formData.slave_id || 1,
        function_code: formData.function_code || 6,
        register_address: formData.register_address ?? 0,
        quantity: formData.quantity || 1,
        data_type: formData.data_type || 'uint16',
        byte_order: formData.byte_order || 'ABCD',
        register_values: testRegisterValues,
      }
      
      // Validate required fields
      if (testWriteConfig.register_address < 0 || testWriteConfig.register_address > 65535) {
        throw new Error('Alamat register harus antara 0 dan 65535')
      }
      
      const writeResult = await writeService.testWrite(testWriteConfig)

      if (writeResult.success) {
        setTestWriteResult({
          success: true,
          message: writeResult.message || 'Test write successful',
        })
        setTestWritePassed(true)
        addLog(`Uji tulis berhasil: ${writeResult.message}`, 'success', activeConnection.id)
      } else {
        throw new Error(writeResult.error || writeResult.message || 'Uji tulis gagal')
      }
    } catch (error: any) {
      setTestWriteResult({
        success: false,
        message: error.message || 'Uji tulis gagal',
      })
      setTestWritePassed(false)
      addLog(`Uji tulis gagal: ${error.message}`, 'error', activeConnection.id)
    } finally {
      setIsTestingWrite(false)
    }
  }

  // Save parameter after successful test write
  // Only called after test write is successful, creates parameter in DB
  const handleSaveParameter = async () => {
    if (!testWritePassed) {
      addLog('Mohon uji tulis terlebih dahulu sebelum menyimpan parameter', 'error', activeConnection.id)
      return
    }

    try {
      addLog('Menyimpan parameter ke database...', 'info', activeConnection.id)
      
      // Determine parameter type from connection
      const paramType: 'modbus_rtu' | 'modbus_tcp' = activeConnection.protocol === 'Modbus TCP' ? 'modbus_tcp' : 'modbus_rtu'

      await createParameterMutation.mutateAsync({
        nama: formData.nama,
        device_id: parseInt(activeConnection.id, 10),
        type: paramType,
        direction: 'WRITE',
        slave_id: formData.slave_id,
        function_code: formData.function_code,
        register_address: formData.register_address,
        quantity: formData.quantity,
        data_type: formData.data_type,
        byte_order: formData.byte_order,
        write_mode_type: formData.write_mode,
        preset_value: formData.write_mode === 'PRESET' ? formData.preset_value : undefined,
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
      nama: param.parameter.nama,
      slave_id: param.slaveId,
      function_code: param.functionCode,
      register_address: param.address,
      quantity: param.quantity,
      data_type: param.dataType,
      byte_order: param.byteOrder,
      test_value: '',
      write_mode: ((param.parameter as any).write_mode as 'DYNAMIC' | 'PRESET') || 'DYNAMIC',
      preset_value: ((param.parameter as any).preset_value as string) || '',
    })
    setShowForm(true)
  }

  const handleDelete = (param: ConfiguredWriteParameter) => {
    setParamToDelete(param)
    setDeleteError(null)
    setDeleteDialogOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!paramToDelete) return

    try {
      await parameterService.delete(paramToDelete.id)
      queryClient.invalidateQueries({ queryKey: ['parameters'] })
      queryClient.invalidateQueries({ queryKey: ['modbus-rtu'] })
      queryClient.invalidateQueries({ queryKey: ['modbus-tcp'] })
      addLog(`Parameter tulis dihapus: ${paramToDelete.parameter.nama}`, 'info', activeConnection.id)
      setDeleteDialogOpen(false)
      setParamToDelete(null)
      setDeleteError(null)
    } catch (error: any) {
      if (error instanceof ParameterDeleteError) {
        setDeleteError(error.message)
      } else {
        const errorMsg = error?.message || 'Gagal menghapus parameter'
        setDeleteError(errorMsg)
        addLog(`Gagal menghapus parameter: ${errorMsg}`, 'error', activeConnection.id)
      }
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
      `Menjalankan tulis: ${param.parameter.nama} - Slave ${param.slaveId}, Alamat ${param.address}, Nilai: [${registerValues.join(', ')}]`,
      'info',
      activeConnection.id,
      param.slaveId,
    )

    try {
      const response = await writeService.execute(param.parameter.id, 'manual', undefined, registerValues)
      if (response.success) {
        addLog(
          `Tulis berhasil: ${param.parameter.nama} - Nilai [${registerValues.join(', ')}] ditulis`,
          'success',
          activeConnection.id,
          param.slaveId,
        )
      } else {
        addLog(`Tulis gagal: ${response.error || response.message}`, 'error', activeConnection.id, param.slaveId)
      }
    } catch (error: any) {
      addLog(`Tulis gagal: ${error.message}`, 'error', activeConnection.id, param.slaveId)
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
          <h2 className="text-2xl font-bold text-foreground">Langkah 2: Konfigurasi Tulis</h2>
          <p className="text-sm text-muted-foreground mt-1">Konfigurasi parameter tulis untuk {activeConnection.name}</p>
        </div>
        <Button
          onClick={() => {
            setEditingParam(null)
            setFormData({
              nama: '',
              slave_id: 1,
              function_code: 6,
              register_address: 0,
              quantity: 1,
              data_type: 'uint16',
              byte_order: 'ABCD',
              test_value: '',
              write_mode: 'DYNAMIC',
              preset_value: '',
            })
            setTestWriteResult(null)
            setTestWritePassed(false)
            setShowForm(!showForm)
          }}
          size="sm"
        >
          <Plus className="h-4 w-4 mr-2" />
          Parameter Tulis Baru
        </Button>
      </div>

      {showForm && !editingParam && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Buat Parameter Tulis</CardTitle>
                <CardDescription>
                  Buat parameter tulis baru. <strong>Uji tulis wajib dilakukan</strong> sebelum parameter dapat disimpan.
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowForm(false)
                  setFormData({
                    nama: '',
                    slave_id: 1,
                    function_code: 6,
                    register_address: 0,
                    quantity: 1,
                    data_type: 'uint16',
                    byte_order: 'ABCD',
                    test_value: '',
                    write_mode: 'DYNAMIC',
                    preset_value: '',
                  })
                  setTestWriteResult(null)
                  setTestWritePassed(false)
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="param-name">Nama Parameter *</Label>
              <Input
                id="param-name"
                value={formData.nama}
                onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                placeholder="contoh: Set Kecepatan Motor, Kontrol Relay"
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
                  value={formData.slave_id}
                  onChange={(e) => setFormData({ ...formData, slave_id: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="function-code">Kode Fungsi *</Label>
                <Select
                  value={formData.function_code?.toString() || '6'}
                  onValueChange={(value) => setFormData({ ...formData, function_code: parseInt(value) || 6 })}
                >
                  <SelectTrigger id="function-code">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 - Tulis Single Coil</SelectItem>
                    <SelectItem value="6">6 - Tulis Single Register</SelectItem>
                    <SelectItem value="15">15 - Tulis Multiple Coils</SelectItem>
                    <SelectItem value="16">16 - Tulis Multiple Registers</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="register-address">Alamat Register *</Label>
                <Input
                  id="register-address"
                  type="number"
                  min="0"
                  max="65535"
                  value={formData.register_address}
                  onChange={(e) => setFormData({ ...formData, register_address: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quantity">Kuantitas *</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  max="100"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="data-type">Tipe Data *</Label>
                <Select
                  value={formData.data_type}
                  onValueChange={(value) => {
                    setFormData((prev) => {
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
                <Label htmlFor="byte-order">Urutan Byte *</Label>
                <Select
                  value={formData.byte_order}
                  onValueChange={(value) => setFormData({ ...formData, byte_order: value })}
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

            {/* Write Mode Selection */}
            <div className="space-y-2">
              <Label htmlFor="write-mode">Mode Tulis *</Label>
              <Select
                value={formData.write_mode}
                onValueChange={(value) => {
                  setFormData({
                    ...formData,
                    write_mode: value as 'PRESET' | 'DYNAMIC',
                    preset_value: value === 'DYNAMIC' ? '' : formData.preset_value, // Clear preset_value if switching to DYNAMIC
                  })
                }}
              >
                <SelectTrigger id="write-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PRESET">PRESET (Nilai disimpan dalam parameter)</SelectItem>
                  <SelectItem value="DYNAMIC">DYNAMIC (Nilai disediakan saat waktu tulis)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                PRESET: Nilai disimpan dalam parameter (digunakan oleh pemicu Alur Kerja). DYNAMIC: Nilai disediakan saat menulis (digunakan oleh Alur Kerja dengan nilai atau tulis manual).
              </p>
            </div>

            {/* Preset Value Field (only for PRESET mode) */}
            {formData.write_mode === 'PRESET' && (
              <div className="space-y-2">
                <Label htmlFor="preset-value">Nilai Preset * (format JSON)</Label>
                <Input
                  id="preset-value"
                  type="text"
                  value={formData.preset_value}
                  onChange={(e) => setFormData({ ...formData, preset_value: e.target.value })}
                  placeholder={
                    formData.quantity > 1
                      ? `{"register_values": [1, 1, 1, 1]} (untuk ${formData.quantity} register)`
                      : '{"value": 1} (nilai tunggal)'
                  }
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Format JSON: {"{"}"value": 1{"}"} untuk nilai tunggal, atau {"{"}"register_values": [1, 1, 1, 1]{"}"} untuk beberapa register.
                  Nilai ini akan digunakan saat alur kerja memicu parameter ini.
                </p>
              </div>
            )}

            {/* Test Value Field */}
            <div className="space-y-2">
              <Label htmlFor="test-value">
                Nilai Uji * {formData.quantity > 1 && `(Masukkan ${formData.quantity} nilai yang dipisahkan koma)`}
              </Label>
              <Input
                id="test-value"
                type="text"
                value={formData.test_value}
                onChange={(e) => setFormData({ ...formData, test_value: e.target.value })}
                placeholder={
                  formData.quantity > 1
                    ? `contoh: 100, 200, 300 (untuk ${formData.quantity} register)`
                    : 'contoh: 100 (nilai register tunggal)'
                }
              />
              <p className="text-xs text-muted-foreground">
                Masukkan nilai untuk uji tulis. Untuk beberapa register, gunakan nilai yang dipisahkan koma.
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
                      {testWriteResult.success ? 'Uji Tulis Berhasil' : 'Uji Tulis Gagal'}
                    </p>
                    <p className="text-xs mt-1">{testWriteResult.message}</p>
                    {testWriteResult.success && (
                      <p className="text-xs mt-2 font-medium">
                        Uji tulis berhasil! Klik "Simpan Parameter" untuk mengonfirmasi dan menyimpan parameter.
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
                    disabled={
                      isTestingWrite ||
                      !formData.nama.trim() ||
                      !formData.test_value.trim() ||
                      (formData.write_mode === 'PRESET' && !formData.preset_value.trim())
                    }
                    className="flex-1"
                  >
                    {isTestingWrite ? 'Menguji Tulis...' : 'Uji Tulis'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowForm(false)
                      setFormData({
                        nama: '',
                        slave_id: 1,
                        function_code: 6,
                        register_address: 0,
                        quantity: 1,
                        data_type: 'uint16',
                        byte_order: 'ABCD',
                        test_value: '',
                        write_mode: 'DYNAMIC',
                        preset_value: '',
                      })
                      setTestWriteResult(null)
                      setTestWritePassed(false)
                    }}
                    disabled={isTestingWrite}
                  >
                    Batal
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    onClick={handleSaveParameter}
                    className="flex-1"
                    variant="default"
                  >
                    Simpan Parameter
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowForm(false)
                      setFormData({
                        nama: '',
                        slave_id: 1,
                        function_code: 6,
                        register_address: 0,
                        quantity: 1,
                        data_type: 'uint16',
                        byte_order: 'ABCD',
                        test_value: '',
                        write_mode: 'DYNAMIC',
                        preset_value: '',
                      })
                      setTestWriteResult(null)
                      setTestWritePassed(false)
                    }}
                  >
                    Batal
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Form (for existing parameters) */}
      {showForm && editingParam && (
        <Card>
          <CardHeader>
            <CardTitle>Edit Parameter Tulis</CardTitle>
            <CardDescription>Perbarui konfigurasi parameter tulis</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Edit form will be implemented separately if needed */}
            <p className="text-sm text-muted-foreground">Fungsi edit akan diimplementasikan di sini</p>
            <Button
              onClick={() => {
                setShowForm(false)
                setEditingParam(null)
              }}
              variant="outline"
            >
              Batal
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Display configured parameters */}
      {configuredParameters.length === 0 && !showForm ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Plus className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Belum Ada Parameter Tulis</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Buat parameter tulis untuk mengonfigurasi nilai yang dapat ditulis ke perangkat Modbus Anda
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
                        {(param.parameter as any).write_mode && (
                          <Badge
                            variant="outline"
                            className={`text-xs ${
                              (param.parameter as any).write_mode === 'PRESET'
                                ? 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                                : 'bg-orange-500/10 text-orange-600 border-orange-500/20'
                            }`}
                          >
                            {(param.parameter as any).write_mode}
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        Slave {param.slaveId} • Alamat {param.address === 0 ? 'O' : param.address}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Nilai:</span>
                      <span className="font-mono font-semibold">{param.value ?? 1}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tipe Data:</span>
                      <span className="font-mono">{param.dataType.toUpperCase()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Urutan Byte:</span>
                      <span className="font-mono">{getByteOrderDisplay(param.byteOrder)}</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleExecute(param)}
                      size="sm"
                      className="flex-1"
                      disabled={(param.parameter as any).write_mode === 'DYNAMIC'}
                      title={
                        (param.parameter as any).write_mode === 'DYNAMIC'
                          ? 'Parameter tulis DYNAMIC tidak dapat dieksekusi langsung. Gunakan alur kerja atau API tulis dengan nilai.'
                          : 'Jalankan operasi tulis'
                      }
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Jalankan
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
                    {configuredParameters.length} Parameter Tulis{' '}
                    Terkonfigurasi
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Siap dieksekusi pada {activeConnection.name}</p>
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

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open)
          if (!open) {
            setDeleteError(null)
            setParamToDelete(null)
          }
        }}
        onConfirm={handleConfirmDelete}
        title="Hapus Parameter Tulis"
        description="Apakah Anda yakin ingin menghapus parameter tulis ini? Tindakan ini tidak dapat dibatalkan."
        itemName={paramToDelete?.parameter.nama}
        isDeleting={false}
        error={deleteError}
      />
    </div>
  )
}
