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
      setFormData({
        nama: workflow.nama,
        description: workflow.description || '',
        enabled: workflow.enabled,
      })
      setConditions(
        workflow.conditions?.map((c) => ({
          parameter_id: c.parameter_id,
          operator: c.operator,
          threshold: c.threshold,
        })) || []
      )
      setActions(
        workflow.actions?.map((a) => ({
          action_type: a.action_type,
          parameter_id: a.parameter_id,
          value: a.value,
          event_name: a.event_name,
          delay_ms: a.delay_ms,
        })) || []
      )
    }
  }, [workflow])

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
      alert('No WRITE parameters available')
      return
    }

    setActions(prev => [
      ...prev,
      {
        action_type: 'WRITE_WITH_VALUE',
        parameter_id: dynamicParameters[0]?.id || writeParameters[0].id,
        value: 0,
      },
    ])
  }

  const addCondition = () => {
    if (cleanParameters.length === 0) {
      alert('No clean parameters available. Create formula parameters first.')
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
    setActions(prev => prev.filter((_, i) => i !== index))
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
      alert('Please add at least one condition')
      return
    }

    if (actions.length === 0) {
      alert('Please add at least one action')
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
            {workflow ? 'Edit Workflow' : 'Create Workflow'}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Define automation rule: IF condition THEN action
          </p>
        </div>
        <Button type="button" variant="outline" onClick={onCancel}>
          <X className="h-4 w-4 mr-2" />
          Cancel
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nama">Workflow Name *</Label>
            <Input
              id="nama"
              value={formData.nama}
              onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
              placeholder="e.g., Auto Fan Control"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe what this workflow does"
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
            <Label htmlFor="enabled">Enabled</Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Conditions (IF)</CardTitle>
              <CardDescription>All conditions must be met for workflow to trigger</CardDescription>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addCondition}>
              <Plus className="h-4 w-4 mr-2" />
              Add Condition
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {conditions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No conditions added. Click "Add Condition" to add one.
            </p>
          ) : (
            conditions.map((condition, index) => (
              <div key={index} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="outline">Condition {index + 1}</Badge>
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
                        <SelectValue placeholder="Select clean parameter" />
                      </SelectTrigger>
                      <SelectContent>
                        {cleanParameters.length === 0 ? (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">
                            No clean parameters available. Create formula parameters first.
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
                        <SelectItem value=">">{'>'} Greater Than</SelectItem>
                        <SelectItem value="<">{'<'} Less Than</SelectItem>
                        <SelectItem value=">=">{'>='} Greater or Equal</SelectItem>
                        <SelectItem value="<=">{'<='} Less or Equal</SelectItem>
                        <SelectItem value="==">{'=='} Equal</SelectItem>
                        <SelectItem value="!=">{'!='} Not Equal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Threshold *</Label>
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
              <CardTitle>Actions (THEN)</CardTitle>
              <CardDescription>Actions to execute when conditions are met</CardDescription>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addAction}>
              <Plus className="h-4 w-4 mr-2" />
              Add Action
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {actions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No actions added. Click "Add Action" to add one.
            </p>
          ) : (
            actions.map((action, index) => (
              <div key={index} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="outline">Action {index + 1}</Badge>
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
                    <Label>Action Type *</Label>
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
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TRIGGER_WRITE">Trigger Write (PRESET)</SelectItem>
                        <SelectItem value="WRITE_WITH_VALUE">Write with Value (DYNAMIC)</SelectItem>
                        <SelectItem value="event">Emit Event</SelectItem>
                        <SelectItem value="delay">Delay</SelectItem>
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
                          <SelectValue placeholder="Select PRESET parameter" />
                        </SelectTrigger>
                        {/* ✅ 5. RENDER SELECT TANPA STATE */}
                        <SelectContent>
                          {presetParameters.length === 0 ? (
                            <div className="px-2 py-1.5 text-sm text-muted-foreground">
                              No PRESET parameters available. Create WRITE parameters with write_mode=PRESET first.
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
                        TRIGGER_WRITE: Triggers PRESET parameter using its stored preset_value. No value input required.
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
                            <SelectValue placeholder="Select DYNAMIC parameter" />
                          </SelectTrigger>
                          <SelectContent>
                            {dynamicParameters.length === 0 ? (
                              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                No DYNAMIC parameters available. Create WRITE parameters with write_mode=DYNAMIC first.
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
                        <Label>Value *</Label>
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
                      <Label>Event Name *</Label>
                      <Input
                        value={action.event_name ?? ''}
                        onChange={(e) => updateActionField(index, 'event_name', e.target.value)}
                        placeholder="e.g., alarm_triggered, system_shutdown"
                        required
                      />
                    </div>
                  )}

                  {action.action_type === 'delay' && (
                    <div className="space-y-2">
                      <Label>Delay (milliseconds) *</Label>
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
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={createMutation.isPending || updateMutation.isPending}
        >
          {createMutation.isPending || updateMutation.isPending
            ? 'Saving...'
            : workflow
              ? 'Update Workflow'
              : 'Create Workflow'}
        </Button>
      </div>
    </form>
  )
}
