import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { parameterService } from '@/services/parameterService'
import { modbusService } from '@/services/modbusService'
import { snmpService } from '@/services/snmpService'
import { deviceService } from '@/services/deviceService'
import { testConnectionService } from '@/services/testConnectionService'
import { Parameter } from '@/types/parameter'
import { ArrowLeft, CheckCircle, XCircle, Loader } from 'lucide-react'

interface ParameterFormProps {
  mode?: 'create' | 'edit'
  paramId?: number | null
  queryParams?: string
  onCancel?: () => void
  onSuccess?: () => void
}

export default function ParameterForm({ mode = 'create', paramId = null, queryParams = '', onCancel, onSuccess }: ParameterFormProps = {}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [formData, setFormData] = useState<Omit<Parameter, 'id' | 'created_at' | 'updated_at'>>({
    device_id: 0,
    nama: '',
    type: 'modbus_rtu',
    direction: 'READ', // Default to READ (polling/scheduler)
    read_write: false,
    write_mode: undefined, // PRESET or DYNAMIC (only for WRITE direction)
    preset_value: undefined, // JSON-encoded preset value (only for PRESET mode)
    custom_rumus: '',
  })

  // Initialize form from URL parameters or props
  useEffect(() => {
    // Use provided queryParams if available, otherwise use URL searchParams
    const effectiveQueryParams = queryParams || (searchParams.toString() ? `?${searchParams.toString()}` : '')
    
    // Parse queryParams if provided as string
    const params = effectiveQueryParams ? new URLSearchParams(effectiveQueryParams.replace(/^\?/, '')) : searchParams
    const deviceIdParam = params.get('device_id')
    const readWriteParam = params.get('read_write')
    const directionParam = params.get('direction')
    const typeParam = params.get('type')

    if (deviceIdParam) {
      const deviceId = parseInt(deviceIdParam, 10)
      if (!isNaN(deviceId)) {
        setFormData(prev => ({ ...prev, device_id: deviceId }))
      }
    }

    // Handle direction parameter (new) or read_write (legacy)
    if (directionParam === 'WRITE' || directionParam === 'READ') {
      setFormData(prev => ({
        ...prev,
        direction: directionParam as 'READ' | 'WRITE',
        read_write: directionParam === 'WRITE',
      }))
    } else if (readWriteParam === 'true') {
      // Legacy support: read_write=true means WRITE
      setFormData(prev => ({ ...prev, read_write: true, direction: 'WRITE' }))
    }

    if (typeParam && ['modbus_rtu', 'modbus_tcp', 'analog_input', 'analog_output', 'digital_input', 'digital_output', 'snmp'].includes(typeParam)) {
      setFormData(prev => ({ ...prev, type: typeParam as any }))
    }
  }, [searchParams, queryParams])

  // Fetch devices for selection
  const { data: devices } = useQuery({
    queryKey: ['devices'],
    queryFn: deviceService.getAll,
  })

  // Configuration form data based on type
  const [configData, setConfigData] = useState<any>({
    function_code: 3, // Default function code for READ (Read Holding Registers)
    byte_order: 'ABCD', // Default byte order
    scaling: 1.0, // Default scaling factor
  })

  // Update function_code default when direction changes
  useEffect(() => {
    if (formData.direction === 'WRITE') {
      // For WRITE, default to 6 (Write Single Register)
      if (!configData.function_code || (configData.function_code >= 1 && configData.function_code <= 4)) {
        setConfigData((prev: any) => ({ ...prev, function_code: 6 }))
      }
    } else {
      // For READ, default to 3 (Read Holding Registers)
      if (!configData.function_code || (configData.function_code >= 5 && configData.function_code <= 16)) {
        setConfigData((prev: any) => ({ ...prev, function_code: 3 }))
      }
    }
  }, [formData.direction])
  
  // Modpoll command state
  const [modpollCommand, setModpollCommand] = useState('')
  
  // Test connection state
  const [testResult, setTestResult] = useState<{
    tested: boolean
    connected: boolean
    rawValue?: any
    message?: string
    details?: string
  } | null>(null)
  const [isTesting, setIsTesting] = useState(false)

  const paramMutation = useMutation({
    mutationFn: parameterService.create,
    onSuccess: async (createdParam) => {
      // After creating parameter, create configuration based on type
      try {
        // Ensure all numeric fields are properly set as integers
        const preparedConfig: any = { ...configData }
        
        // Convert all numeric fields to integers
        // Function code is required and must be set - ensure it's always a valid integer
        const functionCodeValue = preparedConfig.function_code ?? configData.function_code ?? 3
        preparedConfig.function_code = Number(functionCodeValue)
        if (isNaN(preparedConfig.function_code) || preparedConfig.function_code === 0 || preparedConfig.function_code < 1 || preparedConfig.function_code > 4) {
          preparedConfig.function_code = 3 // Default to 3 if invalid
        }
        
        if (preparedConfig.slave_id !== undefined) {
          preparedConfig.slave_id = parseInt(preparedConfig.slave_id) || 1
        }
        if (preparedConfig.register_address !== undefined) {
          preparedConfig.register_address = parseInt(preparedConfig.register_address) || 0
        }
        if (preparedConfig.quantity !== undefined) {
          preparedConfig.quantity = parseInt(preparedConfig.quantity) || 1
        }
        if (preparedConfig.polling_ms !== undefined) {
          preparedConfig.polling_ms = parseInt(preparedConfig.polling_ms) || 1000
        }
        if (preparedConfig.baud !== undefined) {
          preparedConfig.baud = parseInt(preparedConfig.baud) || 9600
        }
        if (preparedConfig.data_bits !== undefined) {
          preparedConfig.data_bits = parseInt(preparedConfig.data_bits) || 8
        }
        if (preparedConfig.stop_bits !== undefined) {
          preparedConfig.stop_bits = parseInt(preparedConfig.stop_bits) || 1
        }
        // Port handling: for Modbus RTU, port is a string (e.g., "/dev/ttyUSB0")
        // For Modbus TCP, port is a number
        if (createdParam.type === 'modbus_tcp' && preparedConfig.port !== undefined) {
          if (typeof preparedConfig.port === 'string') {
            preparedConfig.port = parseInt(preparedConfig.port) || 502
          }
        }
        // For Modbus RTU, port should remain as string, so no conversion needed
        
        // Final validation: ensure function_code is always set
        if (!preparedConfig.function_code || preparedConfig.function_code === 0) {
          preparedConfig.function_code = 3
        }
        
        // Ensure byte_order, data_type, and slave_id are always set (required for Modbus RTU/TCP)
        if (createdParam.type === 'modbus_rtu' || createdParam.type === 'modbus_tcp') {
          // Explicitly ensure byte_order is included - check both preparedConfig and configData
          if (!preparedConfig.byte_order || preparedConfig.byte_order === '') {
            preparedConfig.byte_order = configData.byte_order || 'ABCD'
          }
          // Double check - if still empty, set default
          if (!preparedConfig.byte_order || preparedConfig.byte_order === '') {
            preparedConfig.byte_order = 'ABCD'
          }
          
          // Ensure data_type is included (default to uint16 if not set)
          if (!preparedConfig.data_type || preparedConfig.data_type === '') {
            preparedConfig.data_type = configData.data_type || 'uint16'
          }
          
          // Ensure slave_id is set - use from configData or device
          if (!preparedConfig.slave_id || preparedConfig.slave_id === 0) {
            const selectedDev = devices?.find(d => d.id === createdParam.device_id)
            preparedConfig.slave_id = configData.slave_id || selectedDev?.slave_id || 1
          }
        }
        
        // Ensure all string fields from configData are preserved
        // This is important because spread operator might miss some fields
        if (createdParam.type === 'modbus_rtu') {
          if (configData.port && typeof configData.port === 'string') {
            preparedConfig.port = configData.port
          }
          if (configData.parity) {
            preparedConfig.parity = configData.parity
          }
        }
        if (configData.description) {
          preparedConfig.description = configData.description
        }
        if (createdParam.type === 'snmp') {
          if (configData.community) {
            preparedConfig.community = configData.community
          }
          if (configData.oid) {
            preparedConfig.oid = configData.oid
          }
        }
        
        // Debug: log prepared config
        console.log('Prepared config before sending:', preparedConfig)
        console.log('Function code:', preparedConfig.function_code, typeof preparedConfig.function_code)
        console.log('Byte order:', preparedConfig.byte_order, typeof preparedConfig.byte_order)
        console.log('Full configData:', configData)

        switch (createdParam.type) {
          case 'modbus_rtu':
            await modbusService.createRTU({
              id_parameter: createdParam.id,
              read_write: createdParam.read_write,
              ...preparedConfig,
            })
            break
          case 'modbus_tcp':
            await modbusService.createTCP({
              id_parameter: createdParam.id,
              read_write: createdParam.read_write,
              ...preparedConfig,
            })
            break
          case 'snmp':
            await snmpService.create({
              id_parameter: createdParam.id,
              ...preparedConfig,
            })
            break
        }
        queryClient.invalidateQueries({ queryKey: ['parameters'] })
        queryClient.invalidateQueries({ queryKey: ['modbus-rtu'] })
        queryClient.invalidateQueries({ queryKey: ['modbus-tcp'] })
        queryClient.invalidateQueries({ queryKey: ['snmp'] })
        if (onSuccess) {
          onSuccess()
        } else {
          navigate('/parameters')
        }
      } catch (error) {
        console.error('Failed to create configuration:', error)
      }
    },
  })

  const handleTestConnection = async () => {
    if (!formData.nama) {
      alert('Please fill in parameter name first')
      return
    }

    if (!formData.device_id || formData.device_id === 0) {
      alert('Please select a device first')
      return
    }

    // Validate config data based on type
    if (formData.type === 'modbus_rtu' || formData.type === 'modbus_tcp' || formData.type === 'snmp') {
      // Ensure all numeric fields are properly set as integers
      const preparedConfig: any = { ...configData }
      
      // Get device config
      const selectedDev = devices?.find(d => d.id === formData.device_id)
      if (!selectedDev) {
        alert('Selected device not found')
        return
      }

      // For Modbus RTU/TCP, merge device config with parameter config
      if (formData.type === 'modbus_rtu' || formData.type === 'modbus_tcp') {
        // Add device-level config
        if (formData.type === 'modbus_rtu') {
          preparedConfig.port = selectedDev.port
          preparedConfig.baud = selectedDev.baud
          preparedConfig.data_bits = selectedDev.data_bits
          preparedConfig.parity = selectedDev.parity
          preparedConfig.stop_bits = selectedDev.stop_bits
        } else {
          preparedConfig.ip_address = selectedDev.ip_address
          preparedConfig.port = selectedDev.tcp_port
        }
        
        // Use parameter-level slave_id if set, otherwise use device-level
        preparedConfig.slave_id = configData.slave_id ?? selectedDev.slave_id ?? 1
        preparedConfig.device_slave_id = selectedDev.slave_id // For reference
      }
      
      // Function code is required and must be set - ensure it's always a valid integer
      const functionCodeValue = preparedConfig.function_code ?? configData.function_code ?? 3
      preparedConfig.function_code = Number(functionCodeValue)
      if (isNaN(preparedConfig.function_code) || preparedConfig.function_code === 0 || preparedConfig.function_code < 1 || preparedConfig.function_code > 4) {
        preparedConfig.function_code = 3 // Default to 3 if invalid
      }
      
      if (preparedConfig.register_address !== undefined) {
        preparedConfig.register_address = parseInt(preparedConfig.register_address) || 0
      }
      if (preparedConfig.quantity !== undefined) {
        preparedConfig.quantity = parseInt(preparedConfig.quantity) || 1
      }
      if (preparedConfig.polling_ms !== undefined) {
        preparedConfig.polling_ms = parseInt(preparedConfig.polling_ms) || 1000
      }
      
      // Ensure byte_order and data_type are always set (required for Modbus RTU/TCP)
      if (formData.type === 'modbus_rtu' || formData.type === 'modbus_tcp') {
        // Explicitly ensure byte_order is included
        if (!preparedConfig.byte_order || preparedConfig.byte_order === '') {
          preparedConfig.byte_order = configData.byte_order || 'ABCD'
        }
        // Double check - if still empty, set default
        if (!preparedConfig.byte_order || preparedConfig.byte_order === '') {
          preparedConfig.byte_order = 'ABCD'
        }
        
        // Ensure data_type is included (default to uint16 if not set)
        if (!preparedConfig.data_type || preparedConfig.data_type === '') {
          preparedConfig.data_type = configData.data_type || 'uint16'
        }
      }

      setIsTesting(true)
      try {
        const result = await testConnectionService.test({
          type: formData.type,
          config: preparedConfig,
        })
        setTestResult({
          tested: true,
          connected: result.connected,
          rawValue: result.raw_value,
          message: result.message,
          details: result.details,
        })
      } catch (error) {
        setTestResult({
          tested: true,
          connected: false,
          message: 'Test connection failed',
          details: error instanceof Error ? error.message : 'Unknown error',
        })
      } finally {
        setIsTesting(false)
      }
    } else {
      // For analog/digital, just mark as tested (no actual connection test)
      setTestResult({
        tested: true,
        connected: true,
        message: 'Configuration ready',
      })
    }
  }

  // Parse modpoll command to separate device config and parameter config
  const parseModpollCommand = (command: string) => {
    if (!command.trim()) return null

    const parts = command.trim().split(/\s+/)
    const deviceConfig: any = {}
    const paramConfig: any = {}
    
    // Parse protocol mode
    let protocolMode = 'tcp' // default
    let hasSerialPort = false
    let hasIPAddress = false
    
    // Check for protocol flags and connection info
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      
      if (part === '-m') {
        if (i + 1 < parts.length) {
          protocolMode = parts[i + 1]
          i++
        }
      } else if (part.startsWith('/') || part.includes('COM') || part.includes('tty')) {
        hasSerialPort = true
        deviceConfig.port = part
      } else if (part.match(/^\d+\.\d+\.\d+\.\d+$/)) {
        // IP address
        hasIPAddress = true
        deviceConfig.ip_address = part
      }
    }
    
    // Determine device type based on protocol and port
    let deviceType: 'modbus_rtu' | 'modbus_tcp' = 'modbus_tcp'
    if (protocolMode === 'rtu' || hasSerialPort) {
      deviceType = 'modbus_rtu'
    } else if (protocolMode === 'tcp' || protocolMode === 'udp' || protocolMode === 'enc' || hasIPAddress) {
      deviceType = 'modbus_tcp'
    }
    
    // Parse other options
    let zeroBased = false
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const nextPart = i + 1 < parts.length ? parts[i + 1] : null
      
      switch (part) {
        case '-a':
          if (nextPart) {
            deviceConfig.slave_id = parseInt(nextPart) || 1
            i++
          }
          break
        case '-r':
          if (nextPart) {
            // Register address - if -0 flag is used, address is already 0-based
            paramConfig.register_address = parseInt(nextPart) || 0
            if (zeroBased && paramConfig.register_address > 0) {
              paramConfig.register_address = paramConfig.register_address - 1
            }
            i++
          }
          break
        case '-c':
          if (nextPart) {
            // Parse quantity, but don't set it yet - we'll override it based on data type
            const quantityValue = parseInt(nextPart) || 1
            // Store it temporarily, will be overridden by -t flag if needed
            if (!paramConfig._tempQuantity) {
              paramConfig._tempQuantity = quantityValue
            }
            paramConfig.quantity = quantityValue
            i++
          }
          break
        case '-t':
          if (nextPart) {
            // Parse data type
            const dataType = nextPart.toLowerCase()
            
            // Parse function code from prefix (3 = Input Registers FC4, 4 = Holding Registers FC3)
            if (dataType === '0') {
              paramConfig.function_code = 1 // Coils
              paramConfig.data_type = 'uint16'
            } else if (dataType === '1') {
              paramConfig.function_code = 2 // Discrete Inputs
              paramConfig.data_type = 'uint16'
            } else if (dataType === '3' || dataType.startsWith('3:')) {
              paramConfig.function_code = 4 // Input Registers
            } else if (dataType === '4' || dataType.startsWith('4:')) {
              paramConfig.function_code = 3 // Holding Registers (default)
            }
            
            // Parse data type suffix (f32, f64, i32, i64, float, hex, mod)
            // IMPORTANT: When data type requires multiple registers, ALWAYS override quantity
            // even if -c flag says 1 (because modpoll -c 1 with -t 4:float means "1 float value", not "1 register")
            // Modpoll automatically reads the required number of registers based on data type
            if (dataType.includes(':f32') || dataType === '4:float' || dataType === '3:float') {
              // float requires 2 registers (4 bytes) - use "float" not "float32"
              // Override quantity ALWAYS, regardless of -c flag value
              paramConfig.data_type = 'float' // Use "float" as user requested
              paramConfig.quantity = 2 // Always 2 registers for float (modpoll reads 2 registers even if -c 1)
            } else if (dataType.includes(':f64')) {
              // float64 requires 4 registers (8 bytes)
              // Override quantity ALWAYS, regardless of -c flag value
              paramConfig.data_type = 'float64'
              paramConfig.quantity = 4 // Always 4 registers for float64 (modpoll reads 4 registers even if -c 1)
            } else if (dataType.includes(':i32')) {
              // int32 requires 2 registers (4 bytes)
              // Override quantity ALWAYS, regardless of -c flag value
              paramConfig.data_type = 'int32'
              paramConfig.quantity = 2 // Always 2 registers for int32 (modpoll reads 2 registers even if -c 1)
            } else if (dataType.includes(':i64')) {
              // int64 requires 4 registers (8 bytes)
              // Override quantity ALWAYS, regardless of -c flag value
              paramConfig.data_type = 'int32' // We don't have int64 converter yet, use int32
              paramConfig.quantity = 4 // Always 4 registers for int64 (modpoll reads 4 registers even if -c 1)
            } else if (dataType.includes(':hex')) {
              // Hex display, still uint16
              paramConfig.data_type = 'uint16'
              // Keep quantity from -c flag (or default to 1)
              if (!paramConfig.quantity) {
                paramConfig.quantity = 1
              }
            } else if (dataType.includes(':mod')) {
              // Module 10000 type, treat as uint32
              paramConfig.data_type = 'uint32'
              // Override quantity to 2 if not already set or less than 2
              if (!paramConfig.quantity || paramConfig.quantity < 2) {
                paramConfig.quantity = 2
              }
            } else if (dataType === '3' || dataType === '4') {
              // Simple 16-bit register
              paramConfig.data_type = 'uint16'
              // Keep quantity from -c flag (or default to 1)
              if (!paramConfig.quantity) {
                paramConfig.quantity = 1
              }
            }
            
            // Parse byte order from data type suffix and flags
            // -i and -f flags indicate big-endian (ABCD)
            if (dataType.includes('f32') || dataType.includes('f64') || dataType.includes('i32') || dataType.includes('i64') || dataType.includes('float')) {
              // Check for endianness flags
              if (command.includes('-i') || command.includes('-f') || command.includes('-e')) {
                paramConfig.byte_order = 'ABCD' // Big endian
              } else {
                paramConfig.byte_order = 'DCBA' // Little endian (default for some systems)
              }
            }
            i++
          }
          break
        case '-b':
          if (nextPart && deviceType === 'modbus_rtu') {
            deviceConfig.baud = parseInt(nextPart) || 9600
            i++
          }
          break
        case '-d':
          if (nextPart && deviceType === 'modbus_rtu') {
            deviceConfig.data_bits = parseInt(nextPart) || 8
            i++
          }
          break
        case '-s':
          if (nextPart && deviceType === 'modbus_rtu') {
            deviceConfig.stop_bits = parseInt(nextPart) || 1
            i++
          }
          break
        case '-p':
          if (nextPart) {
            if (nextPart === 'none') {
              if (deviceType === 'modbus_rtu') {
                deviceConfig.parity = 'N'
              }
            } else if (nextPart === 'even') {
              if (deviceType === 'modbus_rtu') {
                deviceConfig.parity = 'E'
              }
            } else if (nextPart === 'odd') {
              if (deviceType === 'modbus_rtu') {
                deviceConfig.parity = 'O'
              }
            } else if (!isNaN(parseInt(nextPart))) {
              // Port number for TCP
              if (deviceType === 'modbus_tcp') {
                deviceConfig.tcp_port = parseInt(nextPart) || 502
              }
            }
            i++
          }
          break
        case '-l':
          if (nextPart) {
            deviceConfig.polling_ms = parseInt(nextPart) || 1000
            paramConfig.polling_ms = parseInt(nextPart) || 1000
            i++
          }
          break
        case '-o':
          if (nextPart) {
            // Timeout in seconds, convert to milliseconds
            const timeoutSec = parseFloat(nextPart) || 1.0
            deviceConfig.timeout_ms = Math.round(timeoutSec * 1000)
            i++
          }
          break
        case '-i':
          // Big-endian for integers/floats
          paramConfig.byte_order = 'ABCD'
          break
        case '-f':
          // Big-endian for floats
          paramConfig.byte_order = 'ABCD'
          break
        case '-e':
          // Daniel/Enron mode (implies -i and -f)
          paramConfig.byte_order = 'ABCD'
          break
        case '-0':
          // Zero-based addressing
          zeroBased = true
          if (paramConfig.register_address !== undefined && paramConfig.register_address > 0) {
            paramConfig.register_address = paramConfig.register_address - 1
          }
          break
      }
    }
    
    // Set defaults for parameter config
    if (!paramConfig.function_code) paramConfig.function_code = 3
    if (!paramConfig.register_address && paramConfig.register_address !== 0) paramConfig.register_address = 0
    if (!paramConfig.quantity) paramConfig.quantity = 1
    if (!paramConfig.byte_order) paramConfig.byte_order = 'ABCD'
    if (!paramConfig.scaling) paramConfig.scaling = 1.0
    
    // Set defaults for device config
    if (!deviceConfig.slave_id) deviceConfig.slave_id = 1
    if (!deviceConfig.polling_ms) deviceConfig.polling_ms = 1000
    if (!deviceConfig.timeout_ms) deviceConfig.timeout_ms = 1000
    if (!deviceConfig.retry_count) deviceConfig.retry_count = 3
    
    // Set defaults for RTU device
    if (deviceType === 'modbus_rtu') {
      if (!deviceConfig.baud) deviceConfig.baud = 9600
      if (!deviceConfig.data_bits) deviceConfig.data_bits = 8
      if (!deviceConfig.stop_bits) deviceConfig.stop_bits = 1
      if (!deviceConfig.parity) deviceConfig.parity = 'N'
    }
    
    // Set defaults for TCP device
    if (deviceType === 'modbus_tcp') {
      if (!deviceConfig.tcp_port) deviceConfig.tcp_port = 502
      if (!deviceConfig.ip_address && !hasSerialPort) {
        // Try to extract IP from command
        const ipMatch = command.match(/\d+\.\d+\.\d+\.\d+/)
        if (ipMatch) {
          deviceConfig.ip_address = ipMatch[0]
        }
      }
    }
    
    return {
      deviceType,
      deviceConfig,
      paramConfig,
    }
  }

  const handleModpollParse = () => {
    if (!modpollCommand.trim()) {
      alert('Please enter a modpoll command')
      return
    }
    
    const parsed = parseModpollCommand(modpollCommand)
    if (!parsed) {
      alert('Failed to parse modpoll command')
      return
    }
    
    const { deviceType, deviceConfig, paramConfig } = parsed
    
    // Check if device is already selected
    if (!formData.device_id || formData.device_id === 0) {
      // Try to find matching device
      const matchingDevice = devices?.find(d => 
        d.type === deviceType &&
        (deviceType === 'modbus_rtu' 
          ? d.port === deviceConfig.port && d.baud === deviceConfig.baud && d.slave_id === deviceConfig.slave_id
          : d.ip_address === deviceConfig.ip_address && d.tcp_port === deviceConfig.tcp_port && d.slave_id === deviceConfig.slave_id
        )
      )
      
      if (matchingDevice) {
        // Use existing device
        setFormData({
          ...formData,
          device_id: matchingDevice.id,
          type: deviceType === 'modbus_rtu' ? 'modbus_rtu' : 'modbus_tcp',
        })
      } else {
        // Device not found - user needs to create device first or select existing
        const deviceInfo = deviceType === 'modbus_rtu'
          ? `Port: ${deviceConfig.port}, Baud: ${deviceConfig.baud}, Slave ID: ${deviceConfig.slave_id}`
          : `IP: ${deviceConfig.ip_address}, Port: ${deviceConfig.tcp_port}, Slave ID: ${deviceConfig.slave_id}`
        
        if (confirm(`Device not found. Device config:\n${deviceInfo}\n\nWould you like to create a new device with these settings?`)) {
          // Create device first
          deviceService.create({
            nama: `Device from modpoll - ${deviceType}`,
            type: deviceType,
            enabled: true,
            ...deviceConfig,
          }).then((newDevice) => {
            setFormData({
              ...formData,
              device_id: newDevice.id,
              type: deviceType === 'modbus_rtu' ? 'modbus_rtu' : 'modbus_tcp',
            })
            setConfigData({
              ...configData,
              ...paramConfig,
            })
            setTestResult(null)
            alert('Device created and modpoll command parsed! Please review the fields and test connection.')
          }).catch((err) => {
            alert(`Failed to create device: ${err.message}`)
          })
          return
        } else {
          alert('Please select an existing device first, then parse the modpoll command again.')
          return
        }
      }
    } else {
      // Device already selected, just update parameter config
      setFormData({
        ...formData,
        type: deviceType === 'modbus_rtu' ? 'modbus_rtu' : 'modbus_tcp',
      })
    }
    
    // Update parameter config
    setConfigData({
      ...configData,
      ...paramConfig,
    })
    
    // Reset test result since config changed
    setTestResult(null)
    
    alert('Modpoll command parsed successfully! Please review the fields and test connection.')
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Check if test connection is required and has been tested successfully
    if (formData.type === 'modbus_rtu' || formData.type === 'modbus_tcp' || formData.type === 'snmp') {
      if (!testResult || !testResult.tested) {
        alert('Please test connection first before saving')
        return
      }
      if (!testResult.connected) {
        alert('Connection test failed. Please fix the configuration and test again.')
        return
      }
    }

    paramMutation.mutate({
      ...formData,
      custom_rumus: formData.custom_rumus || undefined,
    })
  }

  const parameterTypes = [
    { value: 'modbus_rtu', label: 'Modbus RTU' },
    { value: 'modbus_tcp', label: 'Modbus TCP' },
    { value: 'snmp', label: 'SNMP' },
    { value: 'analog_input', label: 'Analog Input' },
    { value: 'analog_output', label: 'Analog Output' },
    { value: 'digital_input', label: 'Digital Input' },
    { value: 'digital_output', label: 'Digital Output' },
  ]

  // Get selected device for displaying device-level config
  const selectedDevice = devices?.find(d => d.id === formData.device_id)

  const renderConfigFields = () => {
    switch (formData.type) {
      case 'modbus_rtu':
        return (
          <div className="space-y-4 border-t pt-4">
            <h3 className="text-lg font-semibold text-gray-800">Modbus RTU Parameter Configuration</h3>
            
            {/* Device-level info display */}
            {selectedDevice && selectedDevice.type === 'modbus_rtu' && (
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-4">
                <h4 className="text-sm font-semibold text-blue-900 mb-2">Device Configuration (from selected device)</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="font-medium">Port:</span> {selectedDevice.port || '-'}</div>
                  <div><span className="font-medium">Baud Rate:</span> {selectedDevice.baud || '-'}</div>
                  <div><span className="font-medium">Data Bits:</span> {selectedDevice.data_bits || '-'}</div>
                  <div><span className="font-medium">Parity:</span> {selectedDevice.parity || '-'}</div>
                  <div><span className="font-medium">Stop Bits:</span> {selectedDevice.stop_bits || '-'}</div>
                  <div><span className="font-medium">Device Slave ID:</span> {selectedDevice.slave_id || '-'}</div>
                  <div><span className="font-medium">Polling Interval:</span> {selectedDevice.polling_ms || '-'} ms</div>
                  <div><span className="font-medium">Timeout:</span> {selectedDevice.timeout_ms || '-'} ms</div>
                </div>
                <p className="text-xs text-blue-700 mt-2">
                  These settings are inherited from the device. You can override Slave ID below if needed.
                </p>
              </div>
            )}

            {!selectedDevice && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-4">
                <p className="text-sm text-yellow-800">
                  ⚠️ Please select a device first to see device-level configuration.
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Slave ID *</label>
                <input
                  type="number"
                  required
                  value={configData.slave_id ?? selectedDevice?.slave_id ?? 1}
                  onChange={(e) => setConfigData({ ...configData, slave_id: parseInt(e.target.value) || 1 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={selectedDevice?.slave_id?.toString() || "1"}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {selectedDevice?.slave_id ? `Device default: ${selectedDevice.slave_id}` : 'Parameter-level slave ID'}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Function Code *</label>
                <select
                  required
                  value={configData.function_code ?? (formData.direction === 'WRITE' ? 6 : 3)}
                  onChange={(e) => {
                    const value = parseInt(e.target.value, 10)
                    if (!isNaN(value)) {
                      setConfigData({ ...configData, function_code: value })
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {formData.direction === 'WRITE' ? (
                    <>
                      <option value="5">5 - Write Single Coil</option>
                      <option value="6">6 - Write Single Register</option>
                      <option value="15">15 - Write Multiple Coils</option>
                      <option value="16">16 - Write Multiple Registers</option>
                    </>
                  ) : (
                    <>
                      <option value="1">1 - Read Coils</option>
                      <option value="2">2 - Read Discrete Inputs</option>
                      <option value="3">3 - Read Holding Registers</option>
                      <option value="4">4 - Read Input Registers</option>
                    </>
                  )}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {formData.direction === 'WRITE'
                    ? 'Select write function code based on your Modbus device requirements'
                    : 'Select read function code based on your Modbus device requirements'}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Register Address *</label>
                <input
                  type="number"
                  required
                  value={configData.register_address || ''}
                  onChange={(e) => setConfigData({ ...configData, register_address: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
                <input
                  type="number"
                  required
                  value={configData.quantity || ''}
                  onChange={(e) => setConfigData({ ...configData, quantity: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data Type *</label>
                <select
                  required
                  value={configData.data_type || 'uint16'}
                  onChange={(e) => {
                    const newDataType = e.target.value
                    // Auto-adjust quantity based on data type
                    if (newDataType === 'float64') {
                      setConfigData((prev: any) => ({ ...prev, data_type: newDataType, quantity: 4 }))
                    } else if (newDataType === 'float' || newDataType === 'int32') {
                      setConfigData((prev: any) => ({ ...prev, data_type: newDataType, quantity: 2 }))
                    } else {
                      setConfigData((prev: any) => ({ ...prev, data_type: newDataType }))
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="uint16">uint16 (16-bit unsigned integer, 1 register)</option>
                  <option value="uint32">uint32 (32-bit unsigned integer, 2 registers)</option>
                  <option value="int32">int32 (32-bit signed integer, 2 registers)</option>
                  <option value="float">float (32-bit float, 2 registers)</option>
                  <option value="float64">float64 (64-bit double, 4 registers)</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Select data type based on modpoll -t flag (e.g., -t 4:float = float, -t 4:f64 = float64)
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Byte Order *</label>
                <select
                  required
                  value={configData.byte_order || 'ABCD'}
                  onChange={(e) => setConfigData({ ...configData, byte_order: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ABCD">ABCD (Big Endian)</option>
                  <option value="DCBA">DCBA (Little Endian)</option>
                  <option value="BADC">BADC (Byte Swap)</option>
                  <option value="CDAB">CDAB (Word Swap)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Scaling Factor *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={configData.scaling ?? 1.0}
                  onChange={(e) => setConfigData({ ...configData, scaling: parseFloat(e.target.value) || 1.0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="1.0"
                />
                <p className="text-xs text-gray-500 mt-1">Final value = raw_value × scaling</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Polling Override (ms)</label>
                <input
                  type="number"
                  value={configData.polling_ms || ''}
                  onChange={(e) => setConfigData({ ...configData, polling_ms: e.target.value ? parseInt(e.target.value) : undefined })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Leave empty to use device default"
                />
                <p className="text-xs text-gray-500 mt-1">Optional: Override device polling interval</p>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <input
                type="text"
                value={configData.description || ''}
                onChange={(e) => setConfigData({ ...configData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Temperature sensor RTU"
              />
            </div>
          </div>
        )

      case 'modbus_tcp':
        return (
          <div className="space-y-4 border-t pt-4">
            <h3 className="text-lg font-semibold text-gray-800">Modbus TCP Parameter Configuration</h3>
            
            {/* Device-level info display */}
            {selectedDevice && selectedDevice.type === 'modbus_tcp' && (
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-4">
                <h4 className="text-sm font-semibold text-blue-900 mb-2">Device Configuration (from selected device)</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="font-medium">IP Address:</span> {selectedDevice.ip_address || '-'}</div>
                  <div><span className="font-medium">TCP Port:</span> {selectedDevice.tcp_port || '-'}</div>
                  <div><span className="font-medium">Device Slave ID:</span> {selectedDevice.slave_id || '-'}</div>
                  <div><span className="font-medium">Polling Interval:</span> {selectedDevice.polling_ms || '-'} ms</div>
                  <div><span className="font-medium">Timeout:</span> {selectedDevice.timeout_ms || '-'} ms</div>
                  <div><span className="font-medium">Retry Count:</span> {selectedDevice.retry_count || '-'}</div>
                </div>
                <p className="text-xs text-blue-700 mt-2">
                  These settings are inherited from the device. You can override Slave ID below if needed.
                </p>
              </div>
            )}

            {!selectedDevice && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-4">
                <p className="text-sm text-yellow-800">
                  ⚠️ Please select a device first to see device-level configuration.
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Slave ID *</label>
                <input
                  type="number"
                  required
                  value={configData.slave_id ?? selectedDevice?.slave_id ?? 1}
                  onChange={(e) => setConfigData({ ...configData, slave_id: parseInt(e.target.value) || 1 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={selectedDevice?.slave_id?.toString() || "1"}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {selectedDevice?.slave_id ? `Device default: ${selectedDevice.slave_id}` : 'Parameter-level slave ID'}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Function Code *</label>
                <select
                  required
                  value={configData.function_code ?? (formData.direction === 'WRITE' ? 6 : 3)}
                  onChange={(e) => {
                    const value = parseInt(e.target.value, 10)
                    if (!isNaN(value)) {
                      setConfigData({ ...configData, function_code: value })
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {formData.direction === 'WRITE' ? (
                    <>
                      <option value="5">5 - Write Single Coil</option>
                      <option value="6">6 - Write Single Register</option>
                      <option value="15">15 - Write Multiple Coils</option>
                      <option value="16">16 - Write Multiple Registers</option>
                    </>
                  ) : (
                    <>
                      <option value="1">1 - Read Coils</option>
                      <option value="2">2 - Read Discrete Inputs</option>
                      <option value="3">3 - Read Holding Registers</option>
                      <option value="4">4 - Read Input Registers</option>
                    </>
                  )}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {formData.direction === 'WRITE'
                    ? 'Select write function code based on your Modbus device requirements'
                    : 'Select read function code based on your Modbus device requirements'}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Register Address *</label>
                <input
                  type="number"
                  required
                  value={configData.register_address || ''}
                  onChange={(e) => setConfigData({ ...configData, register_address: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
                <input
                  type="number"
                  required
                  value={configData.quantity || ''}
                  onChange={(e) => setConfigData({ ...configData, quantity: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data Type *</label>
                <select
                  required
                  value={configData.data_type || 'uint16'}
                  onChange={(e) => {
                    const newDataType = e.target.value
                    // Auto-adjust quantity based on data type
                    if (newDataType === 'float64') {
                      setConfigData((prev: any) => ({ ...prev, data_type: newDataType, quantity: 4 }))
                    } else if (newDataType === 'float' || newDataType === 'int32') {
                      setConfigData((prev: any) => ({ ...prev, data_type: newDataType, quantity: 2 }))
                    } else {
                      setConfigData((prev: any) => ({ ...prev, data_type: newDataType }))
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="uint16">uint16 (16-bit unsigned integer, 1 register)</option>
                  <option value="uint32">uint32 (32-bit unsigned integer, 2 registers)</option>
                  <option value="int32">int32 (32-bit signed integer, 2 registers)</option>
                  <option value="float">float (32-bit float, 2 registers)</option>
                  <option value="float64">float64 (64-bit double, 4 registers)</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Select data type based on modpoll -t flag (e.g., -t 4:float = float, -t 4:f64 = float64)
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Byte Order *</label>
                <select
                  required
                  value={configData.byte_order || 'ABCD'}
                  onChange={(e) => setConfigData({ ...configData, byte_order: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ABCD">ABCD (Big Endian)</option>
                  <option value="DCBA">DCBA (Little Endian)</option>
                  <option value="BADC">BADC (Byte Swap)</option>
                  <option value="CDAB">CDAB (Word Swap)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Scaling Factor *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={configData.scaling ?? 1.0}
                  onChange={(e) => setConfigData({ ...configData, scaling: parseFloat(e.target.value) || 1.0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="1.0"
                />
                <p className="text-xs text-gray-500 mt-1">Final value = raw_value × scaling</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Polling Override (ms)</label>
                <input
                  type="number"
                  value={configData.polling_ms || ''}
                  onChange={(e) => setConfigData({ ...configData, polling_ms: e.target.value ? parseInt(e.target.value) : undefined })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Leave empty to use device default"
                />
                <p className="text-xs text-gray-500 mt-1">Optional: Override device polling interval</p>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <input
                type="text"
                value={configData.description || ''}
                onChange={(e) => setConfigData({ ...configData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Pressure sensor TCP"
              />
            </div>
          </div>
        )

      case 'snmp':
        return (
          <div className="space-y-4 border-t pt-4">
            <h3 className="text-lg font-semibold text-gray-800">SNMP Configuration</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">IP Address *</label>
                <input
                  type="text"
                  required
                  value={configData.ip_address || ''}
                  onChange={(e) => setConfigData({ ...configData, ip_address: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="192.168.1.200"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Community *</label>
                <input
                  type="text"
                  required
                  value={configData.community || ''}
                  onChange={(e) => setConfigData({ ...configData, community: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="public"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">OID *</label>
                <input
                  type="text"
                  required
                  value={configData.oid || ''}
                  onChange={(e) => setConfigData({ ...configData, oid: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  placeholder="1.3.6.1.2.1.1.1.0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Polling Interval (ms) *</label>
                <input
                  type="number"
                  required
                  value={configData.polling_ms || ''}
                  onChange={(e) => setConfigData({ ...configData, polling_ms: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="2000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={configData.description || ''}
                  onChange={(e) => setConfigData({ ...configData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="System description"
                />
              </div>
            </div>
          </div>
        )

      default:
        return (
          <div className="border-t pt-4">
            <p className="text-sm text-gray-500">
              Configuration for {formData.type} will be available after creating the parameter.
            </p>
          </div>
        )
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <button
          onClick={() => {
            if (onCancel) {
              onCancel()
            } else {
              navigate('/parameters')
            }
          }}
          className="text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-3xl font-bold text-gray-800">Create New Parameter</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
        <div>
          <label htmlFor="nama" className="block text-sm font-medium text-gray-700 mb-2">
            Parameter Name *
          </label>
          <input
            type="text"
            id="nama"
            required
            value={formData.nama}
            onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., Temperature Sensor 1"
          />
        </div>

        {/* Modpoll Command Parser */}
        <div className="border-t pt-4">
          <div className="mb-4">
            <label htmlFor="modpoll" className="block text-sm font-medium text-gray-700 mb-2">
              Modpoll Command (Optional)
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                id="modpoll"
                value={modpollCommand}
                onChange={(e) => setModpollCommand(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                placeholder="e.g., modpoll -m rtu -a 1 -r 0 -c 2 -t 4 /dev/ttyUSB0 -b 9600"
              />
              <button
                type="button"
                onClick={handleModpollParse}
                disabled={!modpollCommand.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                Parse Command
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Paste your modpoll command here to auto-fill the configuration fields. 
              {formData.device_id === 0 && ' If device doesn\'t exist, you can create it automatically.'}
              {' '}Or fill the fields manually below.
            </p>
            <div className="mt-2 p-3 bg-gray-50 rounded-md">
              <p className="text-xs font-semibold text-gray-700 mb-1">Supported modpoll options:</p>
              <div className="text-xs text-gray-600 space-y-0.5">
                <div><code className="bg-white px-1 rounded">-m rtu/tcp</code> Protocol mode</div>
                <div><code className="bg-white px-1 rounded">-a #</code> Slave address</div>
                <div><code className="bg-white px-1 rounded">-r #</code> Register address</div>
                <div><code className="bg-white px-1 rounded">-c #</code> Quantity</div>
                <div><code className="bg-white px-1 rounded">-t 0/1/3/4</code> Function code (0=Coils, 1=Discrete, 3=Holding, 4=Input)</div>
                <div><code className="bg-white px-1 rounded">-b #</code> Baud rate (RTU)</div>
                <div><code className="bg-white px-1 rounded">-d #</code> Data bits (RTU)</div>
                <div><code className="bg-white px-1 rounded">-s #</code> Stop bits (RTU)</div>
                <div><code className="bg-white px-1 rounded">-p #/none/even/odd</code> TCP port or parity (RTU)</div>
                <div><code className="bg-white px-1 rounded">-i/-f/-e</code> Big-endian byte order</div>
                <div><code className="bg-white px-1 rounded">-l #</code> Polling interval (ms)</div>
                <div><code className="bg-white px-1 rounded">-o #</code> Timeout (seconds)</div>
                <div><code className="bg-white px-1 rounded">-0</code> Zero-based addressing</div>
              </div>
            </div>
          </div>
        </div>

        <div>
          <label htmlFor="device_id" className="block text-sm font-medium text-gray-700 mb-2">
            Select Device *
          </label>
          <select
            id="device_id"
            required
            value={formData.device_id || ''}
            onChange={(e) => {
              const deviceId = parseInt(e.target.value)
              const selectedDev = devices?.find(d => d.id === deviceId)
              setFormData({ 
                ...formData, 
                device_id: deviceId,
                // Auto-set type based on device type if device is selected
                type: selectedDev ? (selectedDev.type === 'modbus_rtu' ? 'modbus_rtu' : selectedDev.type === 'modbus_tcp' ? 'modbus_tcp' : selectedDev.type === 'snmp' ? 'snmp' : selectedDev.type === 'analog' ? (formData.type.startsWith('analog') ? formData.type : 'analog_input') : selectedDev.type === 'digital' ? (formData.type.startsWith('digital') ? formData.type : 'digital_input') : formData.type) : formData.type
              })
              // Auto-fill slave_id from device if not already set (for Modbus)
              if (selectedDev && (selectedDev.type === 'modbus_rtu' || selectedDev.type === 'modbus_tcp') && selectedDev.slave_id && !configData.slave_id) {
                setConfigData({ ...configData, slave_id: selectedDev.slave_id })
              }
              setTestResult(null) // Reset test result when device changes
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">-- Select a device --</option>
            {devices?.filter(d => 
              formData.type === 'modbus_rtu' ? d.type === 'modbus_rtu' :
              formData.type === 'modbus_tcp' ? d.type === 'modbus_tcp' :
              formData.type === 'snmp' ? d.type === 'snmp' :
              formData.type === 'analog_input' || formData.type === 'analog_output' ? d.type === 'analog' :
              formData.type === 'digital_input' || formData.type === 'digital_output' ? d.type === 'digital' :
              true
            ).map((device) => (
              <option key={device.id} value={device.id}>
                {device.nama} ({device.type}) {device.enabled ? '✓' : '(Disabled)'}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">
            Select an existing device. Device-level settings will be inherited automatically.
          </p>
        </div>

        <div>
          <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-2">
            Type *
          </label>
          <select
            id="type"
            required
            value={formData.type}
            onChange={(e) => {
              setFormData({ ...formData, type: e.target.value as Parameter['type'] })
              // Reset config when type changes, but keep defaults
              setConfigData({ 
                slave_id: undefined, // Reset slave_id when type changes
                function_code: 3,
                byte_order: 'ABCD',
              })
              setTestResult(null) // Reset test result when type changes
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {parameterTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Parameter Direction *
          </label>
          <div className="flex space-x-6">
            <label className="flex items-center cursor-pointer">
              <input
                type="radio"
                name="direction"
                checked={formData.direction === 'READ'}
                onChange={() => setFormData({ ...formData, direction: 'READ', read_write: false })}
                className="mr-2 w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
              />
              <span className="text-gray-700 font-medium">READ (Polling/Scheduler)</span>
              <span className="text-xs text-gray-500 ml-2">- For data collection</span>
            </label>
            <label className="flex items-center cursor-pointer">
              <input
                type="radio"
                name="direction"
                checked={formData.direction === 'WRITE'}
                onChange={() => setFormData({ ...formData, direction: 'WRITE', read_write: true })}
                className="mr-2 w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
              />
              <span className="text-gray-700 font-medium">WRITE (Command/On-Demand)</span>
              <span className="text-xs text-gray-500 ml-2">- For control operations</span>
            </label>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            READ parameters are scheduled for polling. WRITE parameters are command-based and executed on-demand.
          </p>
        </div>

        {/* Write Mode Selection (only for WRITE direction) */}
        {formData.direction === 'WRITE' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Write Mode *
            </label>
            <div className="flex space-x-6">
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="write_mode"
                  checked={formData.write_mode === 'PRESET'}
                  onChange={() => setFormData({ ...formData, write_mode: 'PRESET' })}
                  className="mr-2 w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                />
                <span className="text-gray-700 font-medium">PRESET</span>
                <span className="text-xs text-gray-500 ml-2">- Value stored in parameter</span>
              </label>
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="write_mode"
                  checked={formData.write_mode === 'DYNAMIC'}
                  onChange={() => setFormData({ ...formData, write_mode: 'DYNAMIC', preset_value: undefined })}
                  className="mr-2 w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                />
                <span className="text-gray-700 font-medium">DYNAMIC</span>
                <span className="text-xs text-gray-500 ml-2">- Value provided at write time</span>
              </label>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              PRESET: Value is stored in parameter (workflow triggers without sending value). 
              DYNAMIC: Value must be provided when writing (workflow sends value).
            </p>
          </div>
        )}

        {/* Preset Value Input (only for PRESET write_mode) */}
        {formData.direction === 'WRITE' && formData.write_mode === 'PRESET' && (
          <div>
            <label htmlFor="preset_value" className="block text-sm font-medium text-gray-700 mb-2">
              Preset Value * (JSON format)
            </label>
            <textarea
              id="preset_value"
              value={formData.preset_value || ''}
              onChange={(e) => setFormData({ ...formData, preset_value: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              rows={4}
              placeholder='{"value": 25.5} or {"register_values": [1, 1, 1, 1]}'
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              JSON format: {"{"}"value": 25.5{"}"} for scalar, or {"{"}"register_values": [1, 1, 1, 1]{"}"} for raw registers.
              This value will be used when workflow triggers this parameter.
            </p>
          </div>
        )}

        {renderConfigFields()}

        <div>
          <label htmlFor="custom_rumus" className="block text-sm font-medium text-gray-700 mb-2">
            Custom Formula (Optional)
          </label>
          <input
            type="text"
            id="custom_rumus"
            value={formData.custom_rumus || ''}
            onChange={(e) => setFormData({ ...formData, custom_rumus: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., (value * 0.1) - 5"
          />
          <p className="mt-1 text-sm text-gray-500">
            Use variable <code className="bg-gray-100 px-1 rounded">value</code> for raw value.
            Example: <code className="bg-gray-100 px-1 rounded">(value * 0.1) - 5</code>
          </p>
        </div>

        {/* Test Connection Result */}
        {testResult && testResult.tested && (
          <div
            className={`p-4 rounded-lg border ${
              testResult.connected
                ? 'bg-green-50 border-green-200 text-green-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            <div className="flex items-start space-x-2">
              {testResult.connected ? (
                <CheckCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              ) : (
                <XCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              )}
              <div className="flex-1">
                <p className="font-medium">{testResult.message}</p>
                {testResult.rawValue !== undefined && (
                  <p className="text-sm mt-1">
                    Raw Value: <span className="font-mono font-semibold">{testResult.rawValue}</span>
                  </p>
                )}
                {testResult.details && (
                  <p className="text-sm mt-1 opacity-75">{testResult.details}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Test Connection Button */}
        {(formData.type === 'modbus_rtu' || formData.type === 'modbus_tcp' || formData.type === 'snmp') && (
          <div className="border-t pt-4">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {isTesting ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  <span>Testing Connection...</span>
                </>
              ) : (
                <span>Test Connection</span>
              )}
            </button>
            {testResult && testResult.tested && !testResult.connected && (
              <p className="text-sm text-red-600 mt-2">
                ⚠️ Connection test failed. Please fix the configuration and test again before saving.
              </p>
            )}
          </div>
        )}

        {paramMutation.isError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {paramMutation.error instanceof Error
              ? paramMutation.error.message
              : 'Failed to create parameter'}
          </div>
        )}

        <div className="flex justify-end space-x-4 border-t pt-4">
          <button
            type="button"
            onClick={() => {
              if (onCancel) {
                onCancel()
              } else {
                navigate('/parameters')
              }
            }}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={
              paramMutation.isPending ||
              ((formData.type === 'modbus_rtu' || formData.type === 'modbus_tcp' || formData.type === 'snmp') &&
                (!testResult || !testResult.tested || !testResult.connected))
            }
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {paramMutation.isPending ? 'Creating...' : 'Create Parameter'}
          </button>
        </div>
      </form>
    </div>
  )
}
