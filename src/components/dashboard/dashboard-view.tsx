import { useState } from 'react'
import * as React from 'react'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { DeleteConfirmationDialog } from '@/components/ui/delete-confirmation-dialog'
import { Activity, TrendingUp, Zap, Database, Network, Edit, Trash2, LineChart } from 'lucide-react'
import type { SavedDashboardData, MappedValue } from '@/types'
import type { DashboardData } from '@/types/parameter'
import { formatNumber } from '@/utils/formatters'
import { parameterService } from '@/services/parameterService'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/contexts/AuthContext'
import { ParameterChartDialog } from './parameter-chart-dialog'

interface DashboardViewProps {
  savedData: SavedDashboardData[]
  onParameterUpdate?: () => void
}

export function DashboardView({ savedData, onParameterUpdate }: DashboardViewProps) {
  const queryClient = useQueryClient()
  const { isAdmin } = useAuth()
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedParameter, setSelectedParameter] = useState<MappedValue | null>(null)
  const [editFormData, setEditFormData] = useState({ nama: '', custom_rumus: '' })
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [chartDialogOpen, setChartDialogOpen] = useState(false)
  const [selectedChartParameter, setSelectedChartParameter] = useState<DashboardData | null>(null)

  // Fetch parameter details for editing
  const { data: parameterDetails } = useQuery({
    queryKey: ['parameter', selectedParameter?.parameterId],
    queryFn: () => parameterService.getById(selectedParameter?.parameterId!),
    enabled: !!selectedParameter?.parameterId && editDialogOpen,
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => parameterService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parameters'] })
      setEditDialogOpen(false)
      setSelectedParameter(null)
      onParameterUpdate?.()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => parameterService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parameters'] })
      setDeleteDialogOpen(false)
      setSelectedParameter(null)
      setDeleteError(null)
      onParameterUpdate?.()
    },
    onError: (error: any) => {
      if (error instanceof Error && error.name === 'ParameterDeleteError') {
        setDeleteError(error.message)
      } else {
        setDeleteError(error?.message || 'Failed to delete parameter')
      }
    },
  })

  const handleEdit = (value: MappedValue) => {
    setSelectedParameter(value)
    // Initialize form with current values
    setEditFormData({
      nama: value.outputName,
      custom_rumus: value.formula || '',
    })
    setEditDialogOpen(true)
  }

  // Update form when parameter details are loaded
  React.useEffect(() => {
    if (parameterDetails && editDialogOpen) {
      setEditFormData({
        nama: parameterDetails.nama || selectedParameter?.outputName || '',
        custom_rumus: parameterDetails.custom_rumus || '',
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
      data: {
        nama: editFormData.nama,
        custom_rumus: editFormData.custom_rumus || null,
      },
    })
  }

  const handleConfirmDelete = () => {
    if (!selectedParameter?.parameterId) return
    deleteMutation.mutate(selectedParameter.parameterId)
  }
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
                    {allMappedValues.map((value) => (
                      <Card key={value.id} className="relative group">
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <CardTitle className="text-base">{value.outputName}</CardTitle>
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
                                    status: value.error ? 'error' : 'online',
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
                    ))}
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
              Perbarui nama parameter dan formula. Perubahan akan diterapkan segera.
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
            <div className="space-y-2">
              <Label htmlFor="custom_rumus">Formula (Custom Rumus)</Label>
              <Input
                id="custom_rumus"
                value={editFormData.custom_rumus}
                onChange={(e) => setEditFormData({ ...editFormData, custom_rumus: e.target.value })}
                placeholder="e.g., value * 10 or Slave 6 Addr 4 / 10"
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
    </div>
  )
}

