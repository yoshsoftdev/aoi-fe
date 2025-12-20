import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Edit, Trash2, Settings, AlertCircle, CheckCircle2, XCircle } from 'lucide-react'
import { parameterService } from '@/services/parameterService'
import { deviceService } from '@/services/deviceService'
import { modbusService } from '@/services/modbusService'
import type { Parameter } from '@/types/parameter'

export default function WritableParameterList() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [selectedDeviceId, setSelectedDeviceId] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Fetch all devices
  const { data: devices = [] } = useQuery({
    queryKey: ['devices'],
    queryFn: () => deviceService.getAll(),
  })

  // Fetch all parameters
  const { data: allParameters = [], isLoading, error } = useQuery({
    queryKey: ['parameters'],
    queryFn: async () => {
      try {
        const result = await parameterService.getAll()
        console.log('=== WritableParameterList: Fetched parameters ===')
        console.log('Total parameters:', result.length)
        console.log('Sample parameter:', result[0] || 'No parameters')
        return result
      } catch (err) {
        console.error('Error fetching parameters:', err)
        throw err
      }
    },
  })

  // Filter writable parameters
  // CRITICAL: Only show parameters with direction='WRITE'
  // These are command/on-demand parameters, not polling parameters
  const writableParameters = allParameters.filter((p) => {
    // Use new direction field if available, fallback to read_write for legacy
    const isWriteDirection = p.direction === 'WRITE' || (p.direction === undefined && p.read_write === true)
    const isNotFormula = (p as any).is_formula === false || (p as any).is_formula === undefined
    const isModbus = p.type === 'modbus_rtu' || p.type === 'modbus_tcp'
    const result = isWriteDirection && isNotFormula && isModbus
    
    // Debug each parameter that doesn't pass filter
    if (!result && isReadWrite && isModbus) {
      console.log('Parameter filtered out:', {
        id: p.id,
        nama: p.nama,
        read_write: p.read_write,
        is_formula: (p as any).is_formula,
        type: p.type,
        reason: !isReadWrite ? 'not read_write' : !isModbus ? 'not modbus' : 'is formula',
      })
    }
    
    return result
  })

  // Debug logging
  console.log('=== WritableParameterList Debug ===')
  console.log('All parameters count:', allParameters.length)
  console.log('Writable parameters count:', writableParameters.length)
  console.log('Filter breakdown:', {
    total: allParameters.length,
    readWrite: allParameters.filter((p) => p.read_write === true).length,
    modbus: allParameters.filter((p) => p.type === 'modbus_rtu' || p.type === 'modbus_tcp').length,
    writable: writableParameters.length,
  })

  // Filter by device if selected
  const filteredParameters = writableParameters.filter((p) => {
    const matchesDevice = selectedDeviceId === null || p.device_id === selectedDeviceId
    const matchesSearch = searchQuery === '' || p.nama.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesDevice && matchesSearch
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: parameterService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parameters'] })
    },
  })

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this writable parameter?')) {
      try {
        await deleteMutation.mutateAsync(id)
      } catch (error) {
        console.error('Failed to delete parameter:', error)
      }
    }
  }

  const handleCreate = () => {
    if (onCreateClick) {
      onCreateClick()
    } else {
      navigate('/parameters?direction=WRITE')
    }
  }

  const handleEdit = (param: Parameter) => {
    if (onEditClick) {
      onEditClick(param.id)
    } else {
      navigate(`/parameters/${param.id}?direction=WRITE`)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-muted-foreground">Loading parameters...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 font-medium">Failed to load parameters</p>
          <p className="text-sm text-muted-foreground mt-2">{String(error)}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Writable Parameters</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage parameters that support write operations (Read/Write mode)
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Total parameters: {allParameters.length} | Writable: {writableParameters.length}
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Create Writable Parameter
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Device</label>
              <Select
                value={selectedDeviceId?.toString() || ''}
                onValueChange={(value) => setSelectedDeviceId(value ? parseInt(value, 10) : null)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All devices" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All devices</SelectItem>
                  {devices.map((device) => (
                    <SelectItem key={device.id} value={device.id.toString()}>
                      {device.nama || (device as any).name || `Device ${device.id}`} ({device.type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Search</label>
              <Input
                placeholder="Search by parameter name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Writable</p>
                <p className="text-2xl font-bold text-foreground">{writableParameters.length}</p>
              </div>
              <Settings className="h-8 w-8 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Modbus RTU</p>
                <p className="text-2xl font-bold text-foreground">
                  {writableParameters.filter((p) => p.type === 'modbus_rtu').length}
                </p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Modbus TCP</p>
                <p className="text-2xl font-bold text-foreground">
                  {writableParameters.filter((p) => p.type === 'modbus_tcp').length}
                </p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Debug Info (Development Only) */}
      {process.env.NODE_ENV === 'development' && (
        <Card className="bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800">
          <CardContent className="pt-6">
            <p className="text-xs font-mono text-yellow-900 dark:text-yellow-100">
              <strong>Debug Info:</strong><br />
              All Parameters: {allParameters.length}<br />
              Read/Write Parameters: {allParameters.filter((p) => p.read_write === true).length}<br />
              Modbus Parameters: {allParameters.filter((p) => p.type === 'modbus_rtu' || p.type === 'modbus_tcp').length}<br />
              Writable Parameters: {writableParameters.length}<br />
              Filtered Parameters: {filteredParameters.length}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Parameter List */}
      {filteredParameters.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="font-medium text-foreground">
              {writableParameters.length === 0
                ? 'No writable parameters found'
                : 'No parameters match your filters'}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              {writableParameters.length === 0
                ? 'Create your first writable parameter to start controlling devices. Parameters must have read_write=true and type=modbus_rtu or modbus_tcp.'
                : 'Try adjusting your filters'}
            </p>
            {writableParameters.length === 0 && (
              <div className="mt-4 space-y-2">
                <Button onClick={handleCreate}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Writable Parameter
                </Button>
                <p className="text-xs text-muted-foreground">
                  Or go to Parameters page and edit existing parameters to set Access Mode = Read/Write
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredParameters.map((param) => {
            const device = devices.find((d) => d.id === param.device_id)
            return (
              <Card key={param.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-base">{param.nama}</CardTitle>
                      <CardDescription className="mt-1">
                        {device?.nama || device?.name || `Device ID: ${param.device_id}`}
                      </CardDescription>
                    </div>
                    <Badge variant={param.read_write ? 'default' : 'secondary'} className="ml-2">
                      {param.read_write ? 'R/W' : 'R'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Type:</span>
                      <Badge variant="outline">{param.type}</Badge>
                    </div>
                    {param.unit && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Unit:</span>
                        <span className="font-medium">{param.unit}</span>
                      </div>
                    )}
                    {param.description && (
                      <div className="pt-2 border-t border-border">
                        <p className="text-xs text-muted-foreground">{param.description}</p>
                      </div>
                    )}
                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleEdit(param)}
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => navigate(`/write?device_id=${param.device_id}&parameter_id=${param.id}`)}
                      >
                        <Settings className="h-3 w-3 mr-1" />
                        Write
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(param.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

