import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ParameterChart } from './parameter-chart'
import { useParameterHistory } from '@/hooks/useParameterHistory'
import { useQuery } from '@tanstack/react-query'
import { parameterService } from '@/services/parameterService'
import { writeService } from '@/services/writeService'
import { modbusService } from '@/services/modbusService'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader, Send, AlertCircle, CheckCircle2, Info, Trash2 } from 'lucide-react'
import type { DashboardData } from '@/types/parameter'

interface ParameterChartDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  parameter: DashboardData | null
}

export function ParameterChartDialog({
  open,
  onOpenChange,
  parameter,
}: ParameterChartDialogProps) {
  const parameterId = parameter?.parameter_id
  const { history, currentValue, dataPointCount } = useParameterHistory({
    parameterId,
    maxDataPoints: 200, // Keep last 200 data points
  })

  // Check if parameter is READ_WRITE from DashboardData or fetch from API
  const isReadWrite = parameter?.direction === 'READ_WRITE'
  
  // Fetch parameter details (always fetch to get device_id and type for write)
  const { data: parameterDetail } = useQuery({
    queryKey: ['parameter', parameterId],
    queryFn: () => parameterService.getById(parameterId!),
    enabled: !!parameterId && open,
  })

  // Use direction from DashboardData if available, otherwise from fetched parameter
  const finalIsReadWrite = isReadWrite || parameterDetail?.direction === 'READ_WRITE'

  // Fetch Modbus config based on parameter type
  const { data: modbusRTUConfigs } = useQuery({
    queryKey: ['modbus-rtu'],
    queryFn: () => modbusService.getAllRTU(),
    enabled: !!parameterDetail && parameterDetail.type === 'modbus_rtu' && open,
  })

  const { data: modbusTCPConfigs } = useQuery({
    queryKey: ['modbus-tcp'],
    queryFn: () => modbusService.getAllTCP(),
    enabled: !!parameterDetail && parameterDetail.type === 'modbus_tcp' && open,
  })

  // Get modbus config for this parameter
  const modbusConfig = parameterDetail?.type === 'modbus_rtu'
    ? modbusRTUConfigs?.find(c => c.id_parameter === parameterId)
    : modbusTCPConfigs?.find(c => c.id_parameter === parameterId)
  const [writeValue, setWriteValue] = useState<string>('')
  const [isWriting, setIsWriting] = useState(false)
  const [writeLogs, setWriteLogs] = useState<
    { id: string; timestamp: Date; success: boolean; message: string; value?: number }[]
  >([])

  // Reset write state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setWriteValue('')
      setWriteLogs([])
    }
  }, [open])

  const handleWrite = async () => {
    if (!parameterId || !writeValue.trim() || !parameterDetail || !modbusConfig) {
      if (!parameterDetail) {
        setWriteLogs((prev) => [
          {
            id: `${Date.now()}-${Math.random()}`,
            timestamp: new Date(),
            success: false,
            message: 'Parameter details not loaded',
          },
          ...prev,
        ])
      } else if (!modbusConfig) {
        setWriteLogs((prev) => [
          {
            id: `${Date.now()}-${Math.random()}`,
            timestamp: new Date(),
            success: false,
            message: 'Modbus config not found',
          },
          ...prev,
        ])
      }
      return
    }

    const value = parseFloat(writeValue)
    if (isNaN(value)) {
      setWriteLogs((prev) => [
        {
          id: `${Date.now()}-${Math.random()}`,
          timestamp: new Date(),
          success: false,
          message: 'Invalid number',
        },
        ...prev,
      ])
      return
    }

    setIsWriting(true)

    // Add log entry for write attempt
    const logId = `${Date.now()}-${Math.random()}`
    setWriteLogs((prev) => [
      {
        id: logId,
        timestamp: new Date(),
        success: false,
        message: `Writing value: ${value}...`,
        value: value,
      },
      ...prev,
    ])

    try {
      // Convert value to register_values based on quantity
      // For single register, just round the value
      // For multiple registers, we'd need to encode based on data_type
      // For now, assume single register (quantity = 1) for READ_WRITE parameters
      const quantity = modbusConfig.quantity || 1
      let registerValues: number[] = []

      if (quantity === 1) {
        // Single register: round value to uint16
        registerValues = [Math.max(0, Math.min(65535, Math.round(value)))]
      } else {
        // Multiple registers: for now, fill with rounded value
        // In production, you might want to encode based on data_type (float32, int32, etc.)
        registerValues = new Array(quantity).fill(Math.max(0, Math.min(65535, Math.round(value))))
      }

      // Determine function code based on quantity
      // 6 = Write Single Register, 16 = Write Multiple Registers
      const functionCode = quantity === 1 ? 6 : 16

      // Use /write/test endpoint with correct format
      // Include parameter_id to save log to DB
      const result = await writeService.testWrite({
        parameter_id: parameterId, // Include parameter_id for DB logging
        device_id: parameterDetail.device_id,
        protocol: parameterDetail.type as 'modbus_rtu' | 'modbus_tcp',
        slave_id: modbusConfig.slave_id || 1,
        function_code: functionCode,
        register_address: modbusConfig.register_address || 0,
        quantity: quantity,
        data_type: modbusConfig.data_type || 'uint16',
        byte_order: modbusConfig.byte_order || 'ABCD',
        register_values: registerValues,
      })

      const message =
        result.message || result.error || (result.success ? 'Write successful' : 'Write failed')

      // Update log entry with result
      setWriteLogs((prev) =>
        prev.map((log) =>
          log.id === logId
            ? {
                ...log,
                success: result.success,
                message: result.success
                  ? `✓ Write successful: ${value} → ${message}`
                  : `✗ Write failed: ${message}`,
              }
            : log
        )
      )

      if (result.success) {
        setWriteValue('')
        // Optionally refresh parameter data
      }
    } catch (error: any) {
      const message = error.response?.data?.error || error.message || 'Write failed'
      
      // Update log entry with error
      setWriteLogs((prev) =>
        prev.map((log) =>
          log.id === logId
            ? {
                ...log,
                success: false,
                message: `✗ Write error: ${message}`,
              }
            : log
        )
      )
    } finally {
      setIsWriting(false)
    }
  }

  if (!parameter) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{parameter.parameter_nama || `Parameter ${parameter.parameter_id}`}</DialogTitle>
          <DialogDescription>
            {parameter.device_nama || 'Device'} • Real-time data chart
            {currentValue && (
              <span className="ml-2 text-primary font-medium">
                Current: {typeof currentValue.value === 'number' ? currentValue.value.toFixed(2) : currentValue.value}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>
        
        <div className="mt-4">
          {history.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              <p>Waiting for data... ({dataPointCount} points collected)</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
                <div>
                  <ParameterChart
                    data={history}
                    parameterName={parameter.parameter_nama || `Parameter ${parameter.parameter_id}`}
                  />
                </div>
                
                {finalIsReadWrite && (
                  <div className="border rounded-lg p-4 space-y-4">
                    <div>
                      <h3 className="font-semibold mb-2">Write Value</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Write a value to this parameter
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="write-value">Value</Label>
                      <Input
                        id="write-value"
                        type="number"
                        step="any"
                        value={writeValue}
                        onChange={(e) => setWriteValue(e.target.value)}
                        placeholder="Enter value"
                        disabled={isWriting}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !isWriting) {
                            handleWrite()
                          }
                        }}
                      />
                    </div>

                    <Button
                      onClick={handleWrite}
                      disabled={isWriting || !writeValue.trim() || !parameterDetail || !modbusConfig}
                      className="w-full"
                    >
                      {isWriting ? (
                        <>
                          <Loader className="h-4 w-4 mr-2 animate-spin" />
                          Writing...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          Write
                        </>
                      )}
                    </Button>

                    {/* Write Logs Panel - Replaces Current Value */}
                    <div className="pt-4 border-t">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h4 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                            Write Logs
                          </h4>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {writeLogs.length} entri
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setWriteLogs([])}
                          disabled={writeLogs.length === 0}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <ScrollArea className="h-[200px]">
                        <div className="space-y-2 pr-4">
                          {writeLogs.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-8 text-center">
                              <Info className="h-8 w-8 text-muted-foreground mb-2 opacity-50" />
                              <p className="text-sm text-muted-foreground">Belum ada log aktivitas</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Write operations will be logged here
                              </p>
                            </div>
                          ) : (
                            writeLogs.map((log) => (
                              <Card
                                key={log.id}
                                className={`bg-card border-l-2 ${
                                  log.success
                                    ? 'border-l-green-500'
                                    : log.message.includes('Writing')
                                    ? 'border-l-blue-500'
                                    : 'border-l-red-500'
                                }`}
                              >
                                <CardContent className="p-3">
                                  <div className="flex gap-3">
                                    <div className="mt-0.5 flex-shrink-0">
                                      {log.success ? (
                                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                                      ) : log.message.includes('Writing') ? (
                                        <Loader className="h-4 w-4 text-blue-500 animate-spin" />
                                      ) : (
                                        <AlertCircle className="h-4 w-4 text-red-500" />
                                      )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-1">
                                        <div className="text-xs text-muted-foreground font-mono">
                                          {log.timestamp.toLocaleTimeString()}
                                        </div>
                                        {log.value !== undefined && (
                                          <Badge variant="outline" className="text-xs px-1.5 py-0 h-5">
                                            Value: {log.value}
                                          </Badge>
                                        )}
                                      </div>
                                      <div className="text-sm text-foreground leading-relaxed">
                                        {log.message}
                                      </div>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            ))
                          )}
                        </div>
                      </ScrollArea>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

