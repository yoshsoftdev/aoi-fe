import { useState } from 'react'
import * as React from 'react'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { DeleteConfirmationDialog } from '@/components/ui/delete-confirmation-dialog'
import { Activity, TrendingUp, Zap, Database, Network, Edit, Trash2, LineChart, AlertCircle, SlidersHorizontal } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { SavedDashboardData, MappedValue } from '@/types'
import type { DashboardData } from '@/types/parameter'
import { formatNumber } from '@/utils/formatters'
import { parameterService } from '@/services/parameterService'
import { thresholdService, type ThresholdType, type ThresholdLogItem } from '@/services/thresholdService'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuth } from '@/contexts/AuthContext'
import { ParameterChartDialog } from './parameter-chart-dialog'

interface DashboardViewProps {
  savedData: SavedDashboardData[]
  // Dipanggil ketika parameter berhasil di-update (rename) dari dashboard
  // Mengirim id parameter dan nama baru agar parent bisa sinkronkan state lokal
  onParameterUpdate?: (payload: { id: number; nama: string }) => void
}

export function DashboardView({ savedData, onParameterUpdate }: DashboardViewProps) {
  const queryClient = useQueryClient()
  const { isAdmin } = useAuth()
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedParameter, setSelectedParameter] = useState<MappedValue | null>(null)
  const [editFormData, setEditFormData] = useState({ nama: '' })
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [chartDialogOpen, setChartDialogOpen] = useState(false)
  const [selectedChartParameter, setSelectedChartParameter] = useState<DashboardData | null>(null)
  const [thresholdDialogOpen, setThresholdDialogOpen] = useState(false)
  const [selectedThresholdParamId, setSelectedThresholdParamId] = useState<number | null>(null)
  const [selectedThresholdParamName, setSelectedThresholdParamName] = useState<string>('')
  const [thresholdFormData, setThresholdFormData] = useState({
    id: undefined as number | undefined,
    threshold_type: 'max' as ThresholdType,
    min_value: 0,
    max_value: 100,
    critical_low: 0,
    critical_high: 100,
    warning_low: 0,
    warning_high: 100,
  })

  // Fetch parameter details for editing
  const { data: parameterDetails } = useQuery({
    queryKey: ['parameter', selectedParameter?.parameterId],
    queryFn: () => parameterService.getById(selectedParameter?.parameterId!),
    enabled: !!selectedParameter?.parameterId && editDialogOpen,
  })

  const { data: selectedThresholdConfig } = useQuery({
    queryKey: ['threshold', selectedThresholdParamId],
    queryFn: () => thresholdService.getByParameterId(selectedThresholdParamId!),
    enabled: thresholdDialogOpen && !!selectedThresholdParamId,
  })

  const { data: thresholdLogs, isLoading: isThresholdLogsLoading } = useQuery({
    queryKey: ['threshold-logs', selectedThresholdParamId],
    queryFn: () => thresholdService.getLogsByParameterId(selectedThresholdParamId!, 20),
    enabled: thresholdDialogOpen && !!selectedThresholdParamId,
  })

  const updateMutation = useMutation({
    // Dashboard hanya mengubah nama parameter, gunakan endpoint rename khusus
    mutationFn: ({ id, nama }: { id: number; nama: string }) => parameterService.updateName(id, nama),
    onSuccess: (updatedParam) => {
      queryClient.invalidateQueries({ queryKey: ['parameters'] })
      setEditDialogOpen(false)
      setSelectedParameter(null)
      onParameterUpdate?.({ id: updatedParam.id, nama: updatedParam.nama })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => parameterService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parameters'] })
      setDeleteDialogOpen(false)
      setSelectedParameter(null)
      setDeleteError(null)
      // Hapus parameter yang dihapus dari dashboard saved data di parent (jika di-handle)
      // Parent bisa memilih untuk ignore payload ini atau melakukan full refresh
      // Di sini kita tidak meneruskan ID karena sudah tidak diperlukan di dashboard saved mapping
    },
    onError: (error: any) => {
      if (error instanceof Error && error.name === 'ParameterDeleteError') {
        setDeleteError(error.message)
      } else {
        setDeleteError(error?.message || 'Failed to delete parameter')
      }
    },
  })

  const saveThresholdMutation = useMutation({
    mutationFn: () => {
      if (!selectedThresholdParamId) {
        throw new Error('Parameter belum dipilih')
      }
      return thresholdService.save({
        id: thresholdFormData.id,
        id_param: selectedThresholdParamId,
        threshold_type: thresholdFormData.threshold_type,
        min_value: thresholdFormData.min_value,
        max_value: thresholdFormData.max_value,
        critical_low: thresholdFormData.critical_low,
        critical_high: thresholdFormData.critical_high,
        warning_low: thresholdFormData.warning_low,
        warning_high: thresholdFormData.warning_high,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['threshold', selectedThresholdParamId] })
      setThresholdDialogOpen(false)
    },
  })

  const handleEdit = (value: MappedValue) => {
    setSelectedParameter(value)
    // Initialize form with current values
    setEditFormData({
      nama: value.outputName,
    })
    setEditDialogOpen(true)
  }

  // Update form when parameter details are loaded
  React.useEffect(() => {
    if (parameterDetails && editDialogOpen) {
      setEditFormData({
        nama: parameterDetails.nama || selectedParameter?.outputName || '',
      })
    }
  }, [parameterDetails, editDialogOpen, selectedParameter])

  const handleDelete = (value: MappedValue) => {
    setSelectedParameter(value)
    setDeleteError(null)
    setDeleteDialogOpen(true)
  }

  const handleSaveEdit = () => {
    if (!selectedParameter?.parameterId) return
    updateMutation.mutate({
      id: selectedParameter.parameterId,
      nama: editFormData.nama,
    })
  }

  const handleConfirmDelete = () => {
    if (!selectedParameter?.parameterId) return
    deleteMutation.mutate(selectedParameter.parameterId)
  }

  React.useEffect(() => {
    if (!thresholdDialogOpen) return
    if (!selectedThresholdParamId) return

    if (!selectedThresholdConfig) {
      setThresholdFormData({
        id: undefined,
        threshold_type: 'max',
        min_value: 0,
        max_value: 100,
        critical_low: 0,
        critical_high: 100,
        warning_low: 0,
        warning_high: 100,
      })
      return
    }

    setThresholdFormData({
      id: selectedThresholdConfig.id,
      threshold_type:
        selectedThresholdConfig.threshold_type === 'abnormal'
          ? 'max'
          : selectedThresholdConfig.threshold_type,
      min_value: selectedThresholdConfig.min_value,
      max_value: selectedThresholdConfig.max_value,
      critical_low: selectedThresholdConfig.critical_low,
      critical_high: selectedThresholdConfig.critical_high,
      warning_low: selectedThresholdConfig.warning_low,
      warning_high: selectedThresholdConfig.warning_high,
    })
  }, [thresholdDialogOpen, selectedThresholdParamId, selectedThresholdConfig])
  const groupedByConnection = savedData.reduce(
    (acc, data) => {
      if (!acc[data.connectionId]) {
        acc[data.connectionId] = {
          connectionName: data.connectionName,
          data: [],
        }
      }
      acc[data.connectionId].data.push(data)
      return acc
    },
    {} as Record<string, { connectionName: string; data: SavedDashboardData[] }>
  )

  const totalMetrics = savedData.reduce((sum, data) => sum + data.mappedValues.length, 0)
  const latestUpdate = savedData.length > 0 ? savedData[0].savedAt : null
  const totalSuccessful = savedData.reduce(
    (sum, data) => sum + data.mappedValues.filter((v) => !v.error).length,
    0
  )
  const totalValues = savedData.reduce((sum, data) => sum + data.mappedValues.length, 0)
  const successRate = totalValues > 0 ? (totalSuccessful / totalValues) * 100 : 0

  const getAlarmBadgeVariant = (status: string): 'default' | 'destructive' | 'secondary' | 'outline' => {
    if (status === 'critical_high' || status === 'critical_low') return 'destructive'
    if (status === 'warning_high' || status === 'warning_low') return 'secondary'
    return 'outline'
  }

  const formatAlarmStatus = (status: string): string => {
    return status.replace(/_/g, ' ').toUpperCase()
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Dashboard</h2>
        <p className="text-sm text-muted-foreground mt-1">Pantau nilai data yang telah dipetakan</p>
      </div>

      {savedData.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <Database className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="font-medium text-foreground">Belum ada data tersimpan</p>
            <p className="text-sm text-muted-foreground mt-2">
              Selesaikan alur Communication Tester dan simpan data yang telah dipetakan untuk melihatnya di sini
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Metrik</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalMetrics}</div>
                <p className="text-xs text-muted-foreground">Nilai yang dipetakan aktif</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Pembaruan Terakhir</CardTitle>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {latestUpdate ? latestUpdate.toLocaleTimeString() : '--:--'}
                </div>
                <p className="text-xs text-muted-foreground">
                  {latestUpdate ? latestUpdate.toLocaleDateString() : 'Belum ada pembaruan'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Tingkat Keberhasilan</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{successRate.toFixed(0)}%</div>
                <p className="text-xs text-muted-foreground">Nilai berhasil dihitung</p>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            {Object.entries(groupedByConnection).map(([connectionId, { connectionName, data }]) => {
              // Get the latest data entry (should only be one per connection after grouping fix)
              const latestConnectionData = data[0]
              
              // Collect all mappedValues from all data entries (in case of duplicates)
              // Use a Map to preserve order and avoid duplicates
              const mappedValuesMap = new Map<string, typeof latestConnectionData.mappedValues[0]>()
              data.forEach(item => {
                item.mappedValues.forEach(mv => {
                  // Use parameter name as key to ensure uniqueness
                  if (!mappedValuesMap.has(mv.outputName)) {
                    mappedValuesMap.set(mv.outputName, mv)
                  } else {
                    // Update with latest value if timestamp is newer, preserving parameterId
                    const existing = mappedValuesMap.get(mv.outputName)!
                    if (mv.timestamp > existing.timestamp) {
                      mappedValuesMap.set(mv.outputName, {
                        ...mv,
                        parameterId: mv.parameterId || existing.parameterId, // Preserve parameterId
                      })
                    }
                  }
                })
              })
              
              // Convert to array and sort by parameter name for fixed ordering
              const allMappedValues = Array.from(mappedValuesMap.values())
                .sort((a, b) => a.outputName.localeCompare(b.outputName))
              
              return (
                <div key={connectionId} className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-border">
                    <Network className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-semibold text-foreground">{connectionName}</h3>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {latestConnectionData.savedAt.toLocaleString()}
                    </span>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {allMappedValues.map((value) => {
                      const isOffline = value.status === 'offline' || value.status === 'error'
                      return (
                        <Card 
                          key={value.id} 
                          className={`relative group ${isOffline ? 'bg-muted/50 border-muted' : ''}`}
                        >
                          <CardHeader>
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <CardTitle className={`text-base ${isOffline ? 'text-muted-foreground' : ''}`}>
                                    {value.outputName}
                                  </CardTitle>
                                  {isOffline && (
                                    <Badge variant="destructive" className="text-xs">
                                      <AlertCircle className="h-3 w-3 mr-1" />
                                      OFFLINE
                                    </Badge>
                                  )}
                                </div>
                                <CardDescription className="font-mono text-xs">{value.formula}</CardDescription>
                              </div>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    // Convert MappedValue to DashboardData format
                                    const chartData: DashboardData = {
                                      parameter_id: value.parameterId,
                                      parameter_nama: value.outputName,
                                      device_nama: connectionName,
                                      value: typeof value.mappedValue === 'number' ? value.mappedValue : Number(value.mappedValue) || 0,
                                      timestamp: value.timestamp.toISOString(),
                                      status: value.status || (value.error ? 'error' : 'online'),
                                    }
                                    setSelectedChartParameter(chartData)
                                    setChartDialogOpen(true)
                                  }}
                                  title="Lihat grafik"
                                >
                                  <LineChart className="h-4 w-4" />
                                </Button>
                                {value.parameterId && isAdmin && (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => {
                                        setSelectedThresholdParamId(value.parameterId!)
                                        setSelectedThresholdParamName(value.outputName)
                                        setThresholdDialogOpen(true)
                                      }}
                                      title="Atur threshold"
                                    >
                                      <SlidersHorizontal className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => handleEdit(value)}
                                      title="Edit parameter"
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-destructive hover:text-destructive"
                                      onClick={() => handleDelete(value)}
                                      title="Hapus parameter"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            {value.error ? (
                              <div className="text-destructive">
                                <p className="text-sm font-medium">Error</p>
                                <p className="text-xs">{value.error}</p>
                              </div>
                            ) : isOffline ? (
                              <div className="text-muted-foreground">
                                <p className="text-2xl font-semibold">---</p>
                                <p className="text-xs mt-1">Device tidak terhubung</p>
                              </div>
                            ) : (
                              <div>
                                <p className="text-3xl font-bold text-primary">
                                  {formatNumber(value.mappedValue, 2)}
                                </p>
                                {value.rawValues.length > 0 && (
                                  <div className="mt-3 pt-3 border-t border-border space-y-1">
                                    <p className="text-xs font-medium text-muted-foreground">Nilai sumber:</p>
                                    {value.rawValues.map((rv, i) => (
                                      <div key={i} className="flex items-center justify-between text-xs">
                                        <span className="text-muted-foreground">{rv.name}</span>
                                        <span className="font-mono font-medium">{rv.value}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Parameter</DialogTitle>
            <DialogDescription>
              Perbarui nama parameter. Perubahan akan diterapkan segera.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nama">Nama Parameter</Label>
              <Input
                id="nama"
                value={editFormData.nama}
                onChange={(e) => setEditFormData({ ...editFormData, nama: e.target.value })}
                placeholder="Masukkan nama parameter"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleSaveEdit} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Menyimpan...' : 'Simpan Perubahan'}
            </Button>
          </DialogFooter>
          <DialogClose />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open)
          if (!open) {
            setDeleteError(null)
            setSelectedParameter(null)
          }
        }}
        onConfirm={handleConfirmDelete}
        title="Hapus Parameter"
        description="Apakah Anda yakin ingin menghapus parameter ini? Tindakan ini tidak dapat dibatalkan."
        itemName={selectedParameter?.outputName}
        isDeleting={deleteMutation.isPending}
        error={deleteError}
      />

      {/* Parameter Chart Dialog */}
      <ParameterChartDialog
        open={chartDialogOpen}
        onOpenChange={setChartDialogOpen}
        parameter={selectedChartParameter}
      />

      {/* Threshold Dialog */}
      <Dialog open={thresholdDialogOpen} onOpenChange={setThresholdDialogOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Atur Threshold</DialogTitle>
            <DialogDescription>
              Atur batas alarm untuk parameter yang dipilih pada card dashboard.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 py-2">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Parameter</Label>
                <Input value={selectedThresholdParamName || '-'} readOnly />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2 col-span-2">
                  <Label>Tipe Threshold</Label>
                  <Select
                    value={thresholdFormData.threshold_type}
                    onValueChange={(v: string) =>
                      setThresholdFormData((prev) => ({ ...prev, threshold_type: v as ThresholdType }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="max">max</SelectItem>
                      <SelectItem value="min">min</SelectItem>
                      <SelectItem value="min-max">min-max</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {(thresholdFormData.threshold_type === 'max' ||
                  thresholdFormData.threshold_type === 'min' ||
                  thresholdFormData.threshold_type === 'min-max') && (
                  <>
                    <div className="space-y-2">
                      <Label>Min Value</Label>
                      <Input
                        type="number"
                        value={thresholdFormData.min_value}
                        onChange={(e) =>
                          setThresholdFormData((prev) => ({
                            ...prev,
                            min_value: Number(e.target.value),
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Max Value</Label>
                      <Input
                        type="number"
                        value={thresholdFormData.max_value}
                        onChange={(e) =>
                          setThresholdFormData((prev) => ({
                            ...prev,
                            max_value: Number(e.target.value),
                          }))
                        }
                      />
                    </div>
                  </>
                )}

                {(thresholdFormData.threshold_type === 'min' ||
                  thresholdFormData.threshold_type === 'min-max') && (
                  <>
                    <div className="space-y-2">
                      <Label>Warning Low</Label>
                      <Input
                        type="number"
                        value={thresholdFormData.warning_low}
                        onChange={(e) =>
                          setThresholdFormData((prev) => ({
                            ...prev,
                            warning_low: Number(e.target.value),
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Critical Low</Label>
                      <Input
                        type="number"
                        value={thresholdFormData.critical_low}
                        onChange={(e) =>
                          setThresholdFormData((prev) => ({
                            ...prev,
                            critical_low: Number(e.target.value),
                          }))
                        }
                      />
                    </div>
                  </>
                )}

                {(thresholdFormData.threshold_type === 'max' ||
                  thresholdFormData.threshold_type === 'min-max') && (
                  <>
                    <div className="space-y-2">
                      <Label>Warning High</Label>
                      <Input
                        type="number"
                        value={thresholdFormData.warning_high}
                        onChange={(e) =>
                          setThresholdFormData((prev) => ({
                            ...prev,
                            warning_high: Number(e.target.value),
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Critical High</Label>
                      <Input
                        type="number"
                        value={thresholdFormData.critical_high}
                        onChange={(e) =>
                          setThresholdFormData((prev) => ({
                            ...prev,
                            critical_high: Number(e.target.value),
                          }))
                        }
                      />
                    </div>
                  </>
                )}
              </div>

              {saveThresholdMutation.isError && (
                <p className="text-sm text-destructive">
                  {(saveThresholdMutation.error as any)?.message || 'Gagal menyimpan threshold'}
                </p>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Log Threshold</Label>
                <span className="text-xs text-muted-foreground">20 log terakhir</span>
              </div>
              <div className="border rounded-md p-3 h-[360px] overflow-y-auto space-y-3">
                {isThresholdLogsLoading ? (
                  <p className="text-sm text-muted-foreground">Memuat log threshold...</p>
                ) : !thresholdLogs || thresholdLogs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Belum ada log threshold.</p>
                ) : (
                  (thresholdLogs as ThresholdLogItem[]).map((log) => (
                    <div key={log.id} className="border rounded-md p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant={getAlarmBadgeVariant(log.alarm_status)}>
                          {formatAlarmStatus(log.alarm_status)}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(log.trigger_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm font-medium">Nilai: {formatNumber(log.value, 2)}</p>
                      <p className="text-xs text-muted-foreground">
                        {log.resolve_at
                          ? `Resolved: ${new Date(log.resolve_at).toLocaleString()}`
                          : 'Status: aktif'}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setThresholdDialogOpen(false)}>
              Batal
            </Button>
            <Button
              onClick={() => saveThresholdMutation.mutate()}
              disabled={saveThresholdMutation.isPending || !selectedThresholdParamId}
            >
              {saveThresholdMutation.isPending ? 'Menyimpan...' : 'Simpan Threshold'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

