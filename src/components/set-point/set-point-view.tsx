import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Trash2, Plus, Edit2, Save, X } from 'lucide-react'
import { setPointService, type SetPoint, type CreateSetPointRequest } from '@/services/setPointService'

interface SetPointDraft {
  name: string
  unit: string
  value: number
  data_type: 'int' | 'float' | 'bool'
  min_value?: number
  max_value?: number
  random_enabled?: boolean
  description?: string
}

function createEmptyDraft(): SetPointDraft {
  return {
    name: '',
    unit: '',
    value: 0,
    data_type: 'float',
    random_enabled: false,
  }
}

export function SetPointView() {
  const queryClient = useQueryClient()
  const [newDraft, setNewDraft] = useState<SetPointDraft>(createEmptyDraft())
  const [editingValue, setEditingValue] = useState<{ id: number; value: string } | null>(null)

  const { data: setPoints = [], isLoading } = useQuery<SetPoint[]>({
    queryKey: ['set-points'],
    queryFn: () => setPointService.getAll(),
  })

  const createMutation = useMutation({
    mutationFn: (payload: CreateSetPointRequest) => setPointService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['set-points'] })
      setNewDraft(createEmptyDraft())
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<SetPoint> }) =>
      setPointService.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['set-points'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => setPointService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['set-points'] })
    },
  })

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedName = newDraft.name.trim()
    if (!trimmedName) {
      alert('Nama set-point wajib diisi')
      return
    }
    const payload: CreateSetPointRequest = {
      name: trimmedName,
      value: newDraft.value,
      data_type: newDraft.data_type,
    }
    if (newDraft.unit && newDraft.unit.trim()) {
      payload.unit = newDraft.unit.trim()
    }
    if (newDraft.min_value != null) {
      payload.min_value = newDraft.min_value
    }
    if (newDraft.max_value != null) {
      payload.max_value = newDraft.max_value
    }
    if (newDraft.random_enabled != null) {
      payload.random_enabled = newDraft.random_enabled
    }
    if (newDraft.description && newDraft.description.trim()) {
      payload.description = newDraft.description.trim()
    }
    createMutation.mutate(payload)
  }

  const handleStartEditValue = (sp: SetPoint) => {
    setEditingValue({ id: sp.id, value: String(sp.value) })
  }

  const handleCancelEditValue = () => {
    setEditingValue(null)
  }

  const handleSaveValue = (sp: SetPoint) => {
    if (!editingValue || editingValue.id !== sp.id) return
    const v = editingValue.value === '' ? NaN : Number(editingValue.value)
    if (Number.isNaN(v)) {
      handleCancelEditValue()
      return
    }
    updateMutation.mutate(
      {
        id: sp.id,
        payload: { value: v },
      },
      {
        onSuccess: () => {
          setEditingValue(null)
        },
      }
    )
  }

  const isValueOutOfRange = (sp: SetPoint) => {
    if (sp.min_value != null && sp.value < sp.min_value) return true
    if (sp.max_value != null && sp.value > sp.max_value) return true
    return false
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Set-Point</CardTitle>
          <CardDescription>
            Nilai state yang bisa diubah dari UI, tidak write langsung ke device. Digunakan sebagai input
            workflow / bypass.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="grid gap-4 md:grid-cols-4 items-end">
            <div className="space-y-2">
              <Label>Nama *</Label>
              <Input
                value={newDraft.name}
                onChange={(e) => setNewDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder="Contoh: bypass_nilai_pompa"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Unit</Label>
              <Input
                value={newDraft.unit}
                onChange={(e) => setNewDraft((d) => ({ ...d, unit: e.target.value }))}
                placeholder="bar, A, %, dst"
              />
            </div>
            <div className="space-y-2">
              <Label>Nilai Awal</Label>
              <Input
                type="number"
                step="any"
                value={newDraft.value}
                onChange={(e) =>
                  setNewDraft((d) => ({ ...d, value: Number(e.target.value) || 0 }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Min</Label>
              <Input
                type="number"
                step="any"
                value={newDraft.min_value ?? ''}
                onChange={(e) =>
                  setNewDraft((d) => ({ ...d, min_value: e.target.value === '' ? undefined : Number(e.target.value) }))
                }
                placeholder="opsional"
              />
            </div>
            <div className="space-y-2">
              <Label>Max</Label>
              <Input
                type="number"
                step="any"
                value={newDraft.max_value ?? ''}
                onChange={(e) =>
                  setNewDraft((d) => ({ ...d, max_value: e.target.value === '' ? undefined : Number(e.target.value) }))
                }
                placeholder="opsional"
              />
            </div>
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <Label>Random</Label>
              <Switch
                checked={Boolean(newDraft.random_enabled)}
                onCheckedChange={(val) => setNewDraft((d) => ({ ...d, random_enabled: val }))}
              />
            </div>
            <div className="flex items-end gap-2">
              <Button type="submit" disabled={createMutation.isPending}>
                <Plus className="h-4 w-4 mr-2" />
                Buat Set-Point
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Separator />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Memuat set-point...</p>
      ) : setPoints.length === 0 ? (
        <p className="text-sm text-muted-foreground">Belum ada set-point dibuat.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {setPoints.map((sp) => (
            <Card key={sp.id}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle className="text-base">{sp.name}</CardTitle>
                  <CardDescription>
                    {sp.unit || '-'} · tipe: {sp.data_type}
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => deleteMutation.mutate(sp.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label>Nilai</Label>
                  {editingValue?.id === sp.id ? (
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        step="any"
                        value={editingValue.value}
                        onChange={(e) =>
                          setEditingValue({ id: sp.id, value: e.target.value })
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleSaveValue(sp)
                          } else if (e.key === 'Escape') {
                            handleCancelEditValue()
                          }
                        }}
                        className={
                          editingValue.value !== ''
                            ? (() => {
                                const v = Number(editingValue.value)
                                if (Number.isNaN(v)) return 'border-red-500'
                                if (sp.min_value != null && v < sp.min_value) return 'border-red-500'
                                if (sp.max_value != null && v > sp.max_value) return 'border-red-500'
                                return ''
                              })()
                            : undefined
                        }
                        autoFocus
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="default"
                        onClick={() => handleSaveValue(sp)}
                        disabled={updateMutation.isPending}
                      >
                        <Save className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={handleCancelEditValue}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <div className="flex-1 flex items-center justify-between px-3 py-2 border rounded-md bg-muted/50">
                        <span className="text-lg font-semibold">{sp.value}</span>
                        {sp.unit && (
                          <span className="text-sm text-muted-foreground ml-2">{sp.unit}</span>
                        )}
                      </div>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        onClick={() => handleStartEditValue(sp)}
                        title="Edit nilai"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  {editingValue?.id === sp.id &&
                    editingValue.value !== '' &&
                    (() => {
                      const v = Number(editingValue.value)
                      if (Number.isNaN(v)) {
                        return (
                          <p className="text-xs text-red-500">Nilai harus berupa angka</p>
                        )
                      }
                      if (sp.min_value != null && v < sp.min_value) {
                        return (
                          <p className="text-xs text-red-500">
                            Nilai di bawah minimum ({sp.min_value})
                          </p>
                        )
                      }
                      if (sp.max_value != null && v > sp.max_value) {
                        return (
                          <p className="text-xs text-red-500">
                            Nilai di atas maksimum ({sp.max_value})
                          </p>
                        )
                      }
                      return null
                    })()}
                  {!editingValue && isValueOutOfRange(sp) && (
                    <p className="text-xs text-red-500">
                      Nilai di luar range min/max ({sp.min_value} - {sp.max_value})
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                  <div>
                    <div>Min</div>
                    <div className="font-mono">
                      {sp.min_value != null ? sp.min_value : '-'}
                    </div>
                  </div>
                  <div>
                    <div>Max</div>
                    <div className="font-mono">
                      {sp.max_value != null ? sp.max_value : '-'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-md border px-3 py-2">
                  <span className="text-xs text-muted-foreground">Random</span>
                  <Switch
                    checked={Boolean(sp.random_enabled)}
                    onCheckedChange={(val) =>
                      updateMutation.mutate({
                        id: sp.id,
                        payload: { random_enabled: val },
                      })
                    }
                  />
                </div>
                {sp.description && (
                  <p className="text-xs text-muted-foreground">{sp.description}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

