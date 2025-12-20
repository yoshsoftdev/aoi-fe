import { useState, useEffect } from 'react'
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
import type { Parameter } from '@/types/parameter'

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

  // Fetch all parameters (READ parameters for conditions, WRITE parameters for write actions)
  const { data: allParameters = [] } = useQuery({
    queryKey: ['parameters'],
    queryFn: () => parameterService.getAll(),
  })

  // Filter CLEAN parameters for conditions (only formula/output parameters)
  // Workflow hanya bekerja pada parameter yang sudah clean (bukan raw)
  const cleanParameters = allParameters.filter(
    (p) => {
      // Only include formula parameters (is_formula = true)
      // These are the "clean data" parameters that are broadcast to frontend
      return (p as any).is_formula === true || (p as any).isFormula === true
    }
  )

  // Filter WRITE parameters for write actions
  const writeParameters = allParameters.filter(
    (p) => p.direction === 'WRITE' || (p.direction === undefined && p.read_write)
  )

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
      actions,
    }

    if (workflow) {
      updateMutation.mutate(payload)
    } else {
      createMutation.mutate(payload)
    }
  }

  const addCondition = () => {
    setConditions([
      ...conditions,
      {
        parameter_id: cleanParameters[0]?.id || 0,
        operator: '>',
        threshold: 0,
      },
    ])
  }

  const removeCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index))
  }

  const updateCondition = (index: number, field: string, value: any) => {
    const updated = [...conditions]
    updated[index] = { ...updated[index], [field]: value }
    setConditions(updated)
  }

  const addAction = () => {
    setActions([
      ...actions,
      {
        action_type: 'write',
        parameter_id: writeParameters[0]?.id,
        value: 0,
      },
    ])
  }

  const removeAction = (index: number) => {
    setActions(actions.filter((_, i) => i !== index))
  }

  const updateAction = (index: number, field: string, value: any) => {
    const updated = [...actions]
    updated[index] = { ...updated[index], [field]: value }
    setActions(updated)
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
                      value={condition.parameter_id.toString()}
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
                          cleanParameters.map((param) => (
                            <SelectItem key={param.id} value={param.id.toString()}>
                              {param.nama} {param.unit && `(${param.unit})`}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    {cleanParameters.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        Only formula parameters (clean data) can be used in workflow conditions.
                      </p>
                    )}
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
                    <Select
                      value={action.action_type}
                      onValueChange={(value) => {
                        const updated = { ...action, action_type: value as any }
                        // Reset fields based on action type
                        if (value === 'write') {
                          updated.parameter_id = writeParameters[0]?.id
                          updated.value = 0
                          updated.event_name = undefined
                          updated.delay_ms = undefined
                        } else if (value === 'event') {
                          updated.event_name = ''
                          updated.parameter_id = undefined
                          updated.value = undefined
                          updated.delay_ms = undefined
                        } else if (value === 'delay') {
                          updated.delay_ms = 1000
                          updated.parameter_id = undefined
                          updated.value = undefined
                          updated.event_name = undefined
                        }
                        updateAction(index, 'action_type', updated)
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="write">Write Parameter</SelectItem>
                        <SelectItem value="event">Emit Event</SelectItem>
                        <SelectItem value="delay">Delay</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {action.action_type === 'write' && (
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Parameter (WRITE) *</Label>
                        <Select
                          value={action.parameter_id?.toString() || ''}
                          onValueChange={(value) =>
                            updateAction(index, 'parameter_id', parseInt(value, 10))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select WRITE parameter" />
                          </SelectTrigger>
                          <SelectContent>
                            {writeParameters.map((param) => (
                              <SelectItem key={param.id} value={param.id.toString()}>
                                {param.nama} {param.unit && `(${param.unit})`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Value *</Label>
                        <Input
                          type="number"
                          step="any"
                          value={action.value || ''}
                          onChange={(e) =>
                            updateAction(index, 'value', parseFloat(e.target.value) || 0)
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
                        value={action.event_name || ''}
                        onChange={(e) => updateAction(index, 'event_name', e.target.value)}
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
                        value={action.delay_ms || ''}
                        onChange={(e) =>
                          updateAction(index, 'delay_ms', parseInt(e.target.value, 10) || 0)
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

