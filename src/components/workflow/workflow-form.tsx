import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { X, Plus, Trash2 } from 'lucide-react'
import { workflowService, type Workflow, type WorkflowCondition, type WorkflowAction } from '@/services/workflowService'
import { parameterService } from '@/services/parameterService'

interface WorkflowFormProps {
  workflow?: Workflow | null
  onCancel: () => void
  onSuccess: () => void
}

export function WorkflowForm({ workflow, onCancel, onSuccess }: WorkflowFormProps) {
  const [formData, setFormData] = useState({
    nama: '',
    description: '',
    enabled: true,
  })
  const [conditions, setConditions] = useState<Omit<WorkflowCondition, 'id' | 'workflow_id' | 'created_at' | 'parameter'>[]>([])
  const [actions, setActions] = useState<Omit<WorkflowAction, 'id' | 'workflow_id' | 'created_at' | 'parameter'>[]>([])

  // Fetch all parameters
  const { data: allParameters = [] } = useQuery({
    queryKey: ['parameters'],
    queryFn: () => parameterService.getAll(),
  })

  // ✅ 1. SIMPLIFIKASI PARAMETER FILTER
  // Clean parameters = DIRECT, CLEAN, FORMULA (semua yang punya clean data)
  // HANYA untuk READ parameters (WRITE tidak boleh digunakan untuk condition)
  // SOURCE tidak termasuk karena internal only
  const cleanParameters = useMemo(
    () => {
      return allParameters.filter(p => {
        const param = p as any
        
        // CRITICAL: Exclude WRITE parameters (only READ parameters can be used for conditions)
        const isWrite = param.direction === 'WRITE' || (param.direction === undefined && param.read_write === true)
        if (isWrite) {
          return false
        }
        
        const paramMode = param.parameter_mode || param.parameterMode
        const isFormula = param.is_formula === true || param.isFormula === true
        
        // Include DIRECT, CLEAN, FORMULA parameters (READ only)
        // DIRECT: parameter_mode = 'DIRECT' (clean data langsung dari device)
        // CLEAN: parameter_mode = 'CLEAN' (logical parameter dengan clean data)
        // FORMULA: parameter_mode = 'FORMULA' atau is_formula = true (derived parameter)
        return (
          paramMode === 'DIRECT' ||
          paramMode === 'CLEAN' ||
          paramMode === 'FORMULA' ||
          isFormula
        )
      })
    },
    [allParameters]
  )

  const writeParameters = useMemo(
    () => allParameters.filter(p => p.direction === 'WRITE' || (p.direction === undefined && p.read_write)),
    [allParameters]
  )

  const presetParameters = useMemo(
    () => writeParameters.filter(p => (p as any).write_mode === 'PRESET'),
    [writeParameters]
  )

  const dynamicParameters = useMemo(
    () => writeParameters.filter(p => (p as any).write_mode === 'DYNAMIC'),
    [writeParameters]
  )

  // Load workflow data
  useEffect(() => {
    if (workflow) {
      console.log('[WorkflowForm] Loading workflow:', workflow.id, {
        conditions: workflow.conditions?.length || 0,
        actions: workflow.actions?.length || 0,
        actionsData: workflow.actions,
      })
      
      setFormData({
        nama: workflow.nama,
        description: workflow.description || '',
        enabled: workflow.enabled,
      })
      
      // Reset conditions and actions before setting new ones to prevent duplication
      const mappedConditions = workflow.conditions?.map((c) => ({
        parameter_id: c.parameter_id,
        operator: c.operator,
        threshold: c.threshold,
      })) || []
      
      const mappedActions = workflow.actions?.map((a, idx) => ({
        action_type: a.action_type,
        action_order: a.action_order !== undefined ? a.action_order : idx, // Use action_order if available, otherwise use index
        parameter_id: a.parameter_id,
        value: a.value,
        event_name: a.event_name,
        delay_ms: a.delay_ms,
        alarm_message: a.alarm_message,
      })) || []
      
      console.log('[WorkflowForm] Mapped conditions:', mappedConditions.length, mappedConditions)
      console.log('[WorkflowForm] Mapped actions:', mappedActions.length, mappedActions)
      
      setConditions(mappedConditions)
      setActions(mappedActions)
    } else {
      // Reset form when no workflow (create mode)
      setFormData({
        nama: '',
        description: '',
        enabled: true,
      })
      setConditions([])
      setActions([])
    }
  }, [workflow?.id]) // Use workflow.id instead of workflow to prevent re-triggering on object reference changes

  const createMutation = useMutation({
    mutationFn: (data: any) => workflowService.create(data),
    onSuccess,
  })

  const updateMutation = useMutation({
    mutationFn: (data: any) => workflowService.update(workflow!.id, data),
    onSuccess,
  })

  // ✅ 2. ACTION STATE HANDLER (AMAN)
  // Update satu field
  const updateActionField = useCallback(
    (index: number, field: keyof WorkflowAction, value: any) => {
      setActions(prev => {
        const next = [...prev]
        next[index] = { ...next[index], [field]: value }
        return next
      })
    },
    []
  )

  // Replace action object (PENTING)
  const replaceAction = useCallback((index: number, action: any) => {
    setActions(prev => {
      const next = [...prev]
      next[index] = action
      return next
    })
  }, [])

  const updateCondition = useCallback((index: number, field: string, value: any) => {
    setConditions(prev => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }, [])

  // ✅ 6. ADD ACTION (GUARD)
  const addAction = () => {
    if (writeParameters.length === 0) {
      alert('Tidak ada parameter WRITE tersedia')
      return
    }

    setActions(prev => {
      const newActions = [
        ...prev,
        {
          action_type: 'WRITE_WITH_VALUE' as const,
          action_order: prev.length, // Set order based on current length
          parameter_id: dynamicParameters[0]?.id || writeParameters[0].id,
          value: 0,
        },
      ]
      // Re-index all actions to ensure order is correct
      return newActions.map((action, idx) => ({
        ...action,
        action_order: idx,
      }))
    })
  }

  const addCondition = () => {
    if (cleanParameters.length === 0) {
      alert('Tidak ada parameter clean tersedia. Buat parameter formula terlebih dahulu.')
      return
    }

    setConditions(prev => [
      ...prev,
      {
        parameter_id: cleanParameters[0].id,
        operator: '>',
        threshold: 0,
      },
    ])
  }

  const removeCondition = (index: number) => {
    setConditions(prev => prev.filter((_, i) => i !== index))
  }

  const removeAction = (index: number) => {
    setActions(prev => {
      const newActions = prev.filter((_, i) => i !== index)
      // Re-index all actions to ensure order is correct
      return newActions.map((action, idx) => ({
        ...action,
        action_order: idx,
      }))
    })
  }

  // ✅ 7. SANITASI PAYLOAD (WAJIB)
  const sanitizeActions = (actions: any[]) =>
    actions.map(a => {
      const clean = { ...a }
      Object.keys(clean).forEach(
        k => clean[k] === undefined && delete clean[k]
      )
      return clean
    })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (conditions.length === 0) {
      alert('Silakan tambahkan setidaknya satu kondisi')
      return
    }

    if (actions.length === 0) {
      alert('Silakan tambahkan setidaknya satu aksi')
      return
    }

    const payload = {
      ...formData,
      conditions,
      actions: sanitizeActions(actions),
    }

    if (workflow) {
      updateMutation.mutate(payload)
    } else {
      createMutation.mutate(payload)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            {workflow ? 'Edit Workflow' : 'Buat Workflow'}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Definisikan aturan otomasi: JIKA kondisi MAKA aksi
          </p>
        </div>
        <Button type="button" variant="outline" onClick={onCancel}>
          <X className="h-4 w-4 mr-2" />
          Batal
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informasi Dasar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nama">Nama Workflow *</Label>
            <Input
              id="nama"
              value={formData.nama}
              onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
              placeholder="e.g., Auto Fan Control"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Deskripsi</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Jelaskan fungsi workflow ini"
              rows={3}
            />
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="enabled"
              checked={formData.enabled}
              onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
              className="h-4 w-4"
            />
            <Label htmlFor="enabled">Aktif</Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Kondisi (JIKA)</CardTitle>
              <CardDescription>Semua kondisi harus terpenuhi agar workflow terpicu</CardDescription>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addCondition}>
              <Plus className="h-4 w-4 mr-2" />
              Tambah Kondisi
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {conditions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Belum ada kondisi yang ditambahkan. Klik "Tambah Kondisi" untuk menambahkan.
            </p>
          ) : (
            conditions.map((condition, index) => (
              <div key={index} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="outline">Kondisi {index + 1}</Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeCondition(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Parameter (Clean Data) *</Label>
                    <Select
                      value={condition.parameter_id ? String(condition.parameter_id) : ''}
                      onValueChange={(value) =>
                        updateCondition(index, 'parameter_id', parseInt(value, 10))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih parameter clean" />
                      </SelectTrigger>
                      <SelectContent>
                        {cleanParameters.length === 0 ? (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">
                            Tidak ada parameter clean tersedia. Buat parameter formula terlebih dahulu.
                          </div>
                        ) : (
                          cleanParameters.map(p => (
                            <SelectItem key={p.id} value={String(p.id)}>
                              {p.nama} {p.unit && `(${p.unit})`}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Operator *</Label>
                    <Select
                      value={condition.operator}
                      onValueChange={(value) => updateCondition(index, 'operator', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value=">">{'>'} Lebih Besar</SelectItem>
                        <SelectItem value="<">{'<'} Lebih Kecil</SelectItem>
                        <SelectItem value=">=">{'>='} Lebih Besar atau Sama</SelectItem>
                        <SelectItem value="<=">{'<='} Lebih Kecil atau Sama</SelectItem>
                        <SelectItem value="==">{'=='} Sama Dengan</SelectItem>
                        <SelectItem value="!=">{'!='} Tidak Sama</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Ambang Batas *</Label>
                    <Input
                      type="number"
                      step="any"
                      value={condition.threshold}
                      onChange={(e) =>
                        updateCondition(index, 'threshold', parseFloat(e.target.value) || 0)
                      }
                      required
                    />
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Aksi (MAKA)</CardTitle>
              <CardDescription>Aksi yang akan dieksekusi ketika kondisi terpenuhi</CardDescription>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addAction}>
              <Plus className="h-4 w-4 mr-2" />
              Tambah Aksi
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {actions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Belum ada aksi yang ditambahkan. Klik "Tambah Aksi" untuk menambahkan.
            </p>
          ) : (
            actions.map((action, index) => {
              // Ensure action has required fields
              const actionKey = `action-${index}-${action.action_type}-${action.parameter_id || 'none'}`
              // Use action_order if available, otherwise use index
              const displayOrder = action.action_order !== undefined ? action.action_order + 1 : index + 1
              return (
                <div key={actionKey} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="outline" className="font-semibold">
                    Urutan {displayOrder} - Aksi {displayOrder}
                  </Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeAction(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Tipe Aksi *</Label>
                    {/* ✅ 3. ACTION TYPE CHANGE (BUG FIX UTAMA) */}
                    <Select
                      value={action.action_type}
                      onValueChange={(value) => {
                        if (value === 'TRIGGER_WRITE') {
                          replaceAction(index, {
                            action_type: 'TRIGGER_WRITE',
                            parameter_id: presetParameters[0]?.id,
                          })
                        }

                        if (value === 'WRITE_WITH_VALUE') {
                          replaceAction(index, {
                            action_type: 'WRITE_WITH_VALUE',
                            parameter_id: dynamicParameters[0]?.id || writeParameters[0]?.id,
                            value: 0,
                          })
                        }

                        if (value === 'event') {
                          replaceAction(index, {
                            action_type: 'event',
                            event_name: '',
                          })
                        }

                        if (value === 'delay') {
                          replaceAction(index, {
                            action_type: 'delay',
                            delay_ms: 1000,
                          })
                        }

                        if (value === 'alarm') {
                          replaceAction(index, {
                            action_type: 'alarm',
                            alarm_message: '',
                          })
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TRIGGER_WRITE">Trigger Write (PRESET)</SelectItem>
                        <SelectItem value="WRITE_WITH_VALUE">Tulis dengan Nilai (DYNAMIC)</SelectItem>
                        <SelectItem value="event">Kirim Event</SelectItem>
                        <SelectItem value="delay">Tunda</SelectItem>
                        <SelectItem value="alarm">Notifikasi Alarm</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {action.action_type === 'TRIGGER_WRITE' && (
                    <div className="space-y-2">
                      <Label>Parameter (PRESET) *</Label>
                      <Select
                        value={action.parameter_id ? String(action.parameter_id) : ''}
                        onValueChange={(value) => {
                          updateActionField(index, 'parameter_id', parseInt(value, 10))
                          updateActionField(index, 'value', undefined)
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih parameter PRESET" />
                        </SelectTrigger>
                        {/* ✅ 5. RENDER SELECT TANPA STATE */}
                        <SelectContent>
                          {presetParameters.length === 0 ? (
                            <div className="px-2 py-1.5 text-sm text-muted-foreground">
                              Tidak ada parameter PRESET tersedia. Buat parameter WRITE dengan write_mode=PRESET terlebih dahulu.
                            </div>
                          ) : (
                            presetParameters.map(p => (
                              <SelectItem key={p.id} value={String(p.id)}>
                                {p.nama} {p.unit && `(${p.unit})`} [PRESET]
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        TRIGGER_WRITE: Memicu parameter PRESET menggunakan preset_value yang tersimpan. Tidak perlu input nilai.
                      </p>
                    </div>
                  )}

                  {action.action_type === 'WRITE_WITH_VALUE' && (
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Parameter (DYNAMIC) *</Label>
                        <Select
                          value={action.parameter_id ? String(action.parameter_id) : ''}
                          onValueChange={(value) =>
                            updateActionField(index, 'parameter_id', parseInt(value, 10))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Pilih parameter DYNAMIC" />
                          </SelectTrigger>
                          <SelectContent>
                            {dynamicParameters.length === 0 ? (
                              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                Tidak ada parameter DYNAMIC tersedia. Buat parameter WRITE dengan write_mode=DYNAMIC terlebih dahulu.
                              </div>
                            ) : (
                              dynamicParameters.map(p => (
                                <SelectItem key={p.id} value={String(p.id)}>
                                  {p.nama} {p.unit && `(${p.unit})`} [DYNAMIC]
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Nilai *</Label>
                        {/* ✅ 4. INPUT NUMBER YANG BENAR */}
                        <Input
                          type="number"
                          step="any"
                          value={action.value ?? ''}
                          onChange={(e) =>
                            updateActionField(index, 'value', parseFloat(e.target.value) || 0)
                          }
                          required
                        />
                      </div>
                    </div>
                  )}

                  {action.action_type === 'event' && (
                    <div className="space-y-2">
                      <Label>Nama Event *</Label>
                      <Input
                        value={action.event_name ?? ''}
                        onChange={(e) => updateActionField(index, 'event_name', e.target.value)}
                        placeholder="contoh: alarm_triggered, system_shutdown"
                        required
                      />
                    </div>
                  )}

                  {action.action_type === 'delay' && (
                    <div className="space-y-2">
                      <Label>Tunda (milidetik) *</Label>
                      <Input
                        type="number"
                        min="1"
                        value={action.delay_ms ?? ''}
                        onChange={(e) =>
                          updateActionField(index, 'delay_ms', parseInt(e.target.value, 10) || 0)
                        }
                        required
                      />
                    </div>
                  )}

                  {action.action_type === 'alarm' && (
                    <div className="space-y-2">
                      <Label>Pesan Alarm *</Label>
                      <Textarea
                        value={action.alarm_message ?? ''}
                        onChange={(e) => updateActionField(index, 'alarm_message', e.target.value)}
                        placeholder="contoh: Suhu melebihi ambang batas! Silakan periksa sistem."
                        rows={3}
                        required
                      />
                      <p className="text-xs text-muted-foreground">
                        Pesan ini akan ditampilkan sebagai notifikasi ketika kondisi workflow terpenuhi.
                      </p>
                    </div>
                  )}
                </div>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Batal
        </Button>
        <Button
          type="submit"
          disabled={createMutation.isPending || updateMutation.isPending}
        >
          {createMutation.isPending || updateMutation.isPending
            ? 'Menyimpan...'
            : workflow
              ? 'Perbarui Workflow'
              : 'Buat Workflow'}
        </Button>
      </div>
    </form>
  )
}
