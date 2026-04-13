import type { Node } from 'reactflow'
import { Activity, Target, GitBranch, Bell, Pencil, Zap, Clock, X } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Parameter } from '@/types/parameter'
import type { SetPoint } from '@/services/setPointService'
import type { TriggerNodeData, ConditionNodeData, ActionNodeData, TimerNodeData } from '@/types/workflow-builder'

const OPERATORS = ['>', '<', '>=', '<=', '==', '!='] as const

interface PropertiesPanelProps {
  selectedNode: Node | null
  onNodeChange: (id: string, data: Record<string, unknown>) => void
  onClose: () => void
  parameters?: Parameter[]
  setPoints?: SetPoint[]
  cleanParameters?: Parameter[]
  writeParameters?: Parameter[]
  presetParameters?: Parameter[]
}

export function PropertiesPanel({
  selectedNode,
  onNodeChange,
  onClose,
  parameters = [],
  setPoints = [],
  cleanParameters = [],
  writeParameters = [],
  presetParameters = [],
}: PropertiesPanelProps) {
  if (!selectedNode) {
    return (
      <aside className="flex h-full w-[320px] flex-shrink-0 flex-col border-l border-border bg-card">
        <div className="border-b border-border px-4 py-4">
          <h2 className="text-sm font-semibold text-foreground">Properties</h2>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center px-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
            <Activity className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="mt-3 text-center text-sm text-muted-foreground">
            Select a node on the canvas to view and edit its properties.
          </p>
        </div>
      </aside>
    )
  }

  const data = selectedNode.data as Record<string, unknown>
  const nodeType = selectedNode.type as string

  const handleChange = (key: string, value: unknown) => {
    onNodeChange(selectedNode.id, { ...data, [key]: value })
  }

  const handleTriggerTypeChange = (val: string) => {
    onNodeChange(selectedNode.id, {
      ...data,
      triggerType: val,
      label: val === 'parameter-changed' ? 'Parameter Changed' : 'Set-Point Changed',
      description:
        val === 'parameter-changed'
          ? 'Fires when a parameter value changes'
          : 'Fires when a set-point is modified',
      parameter: '',
      setpoint: '',
      source_id: undefined,
    })
  }

  const handleLeftSourceTypeChange = (val: string) => {
    onNodeChange(selectedNode.id, {
      ...data,
      leftSourceType: val,
      leftValue: '',
      leftSourceId: undefined,
    })
  }

  const handleRightValueTypeChange = (val: string) => {
    onNodeChange(selectedNode.id, {
      ...data,
      rightValueType: val,
      rightValue: '',
      rightSourceId: undefined,
    })
  }

  const handleActionTypeChange = (val: string) => {
    onNodeChange(selectedNode.id, {
      ...data,
      actionType: val,
      label:
        val === 'alarm-notification'
          ? 'Alarm Notification'
          : val === 'write-dynamic'
            ? 'Write Dynamic Value'
            : 'Trigger Preset',
      description:
        val === 'alarm-notification'
          ? 'Send an alarm notification'
          : val === 'write-dynamic'
            ? 'Write a value to a target parameter'
            : 'Execute a predefined preset action',
      alarmTitle: '',
      alarmSeverity: undefined,
      alarmMessage: '',
      targetParameter: '',
      targetType: 'parameter',
      targetSetPoint: '',
      targetId: undefined,
      targetSetPointId: undefined,
      valueSource: undefined,
      staticValue: '',
      sourceSetpoint: '',
      sourceSetpointId: undefined,
      presetName: '',
      presetId: undefined,
    })
  }

  const handleValueSourceChange = (val: string) => {
    onNodeChange(selectedNode.id, {
      ...data,
      valueSource: val,
      staticValue: '',
      sourceSetpoint: '',
      sourceSetpointId: undefined,
    })
  }

  const actionIcons: Record<string, React.ReactNode> = {
    'alarm-notification': <Bell className="h-4 w-4" />,
    'write-dynamic': <Pencil className="h-4 w-4" />,
    'trigger-preset': <Zap className="h-4 w-4" />,
  }

  const actionColors: Record<string, string> = {
    'alarm-notification': 'hsl(0 72% 51%)',
    'write-dynamic': 'hsl(142 71% 45%)',
    // Match Trigger Preset action node color
    'trigger-preset': 'hsl(142 71% 50%)',
  }

  const headerConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
    trigger: {
      color: 'hsl(207 90% 54%)',
      icon:
        (data.triggerType as string) === 'parameter-changed' ? (
          <Activity className="h-4 w-4" />
        ) : (
          <Target className="h-4 w-4" />
        ),
      label: 'Trigger Node',
    },
    condition: {
      color: 'hsl(38 92% 50%)',
      icon: <GitBranch className="h-4 w-4" />,
      label: 'IF Condition',
    },
    // Match Timer node color
    timer: {
      color: 'hsl(270 80% 60%)',
      icon: <Clock className="h-4 w-4" />,
      label: 'Timer Node',
    },
    action: {
      color: actionColors[(data.actionType as string) || 'alarm-notification'],
      icon: actionIcons[(data.actionType as string) || 'alarm-notification'],
      label:
        (data.actionType as string) === 'alarm-notification'
          ? 'Alarm Notification'
          : (data.actionType as string) === 'write-dynamic'
            ? 'Write Dynamic Value'
            : (data.actionType as string) === 'trigger-preset'
              ? 'Trigger Preset'
              : 'Action Node',
    },
  }

  const header = headerConfig[nodeType] || headerConfig.trigger

  const triggerType = (data.triggerType as string) || 'parameter-changed'
  const isParameterTrigger = triggerType === 'parameter-changed'

  const leftSourceType = (data.leftSourceType as string) || 'parameter'
  const rightValueType = (data.rightValueType as string) || 'static'
  const actionTargetType = (data.targetType as string) || 'parameter'

  const leftItems = leftSourceType === 'parameter' ? cleanParameters : setPoints
  const rightItems = setPoints

  return (
    <aside className="flex h-full w-[320px] flex-shrink-0 flex-col border-l border-border bg-card">
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ background: header.color }}
      >
        <div className="flex items-center gap-2 text-white">
          {header.icon}
          <span className="text-sm font-semibold">{header.label}</span>
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Close properties panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-4">
          {/* Common fields */}
          <div className="space-y-2">
            <Label htmlFor="node-label" className="text-xs text-muted-foreground">
              Label
            </Label>
            <Input
              id="node-label"
              value={(data.label as string) || ''}
              onChange={(e) => handleChange('label', e.target.value)}
              className="border-border bg-secondary text-foreground"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="node-description" className="text-xs text-muted-foreground">
              Description
            </Label>
            <Input
              id="node-description"
              value={(data.description as string) || ''}
              onChange={(e) => handleChange('description', e.target.value)}
              className="border-border bg-secondary text-foreground"
            />
          </div>

          <div className="h-px bg-border" />

          {/* ============ TRIGGER FIELDS ============ */}
          {nodeType === 'trigger' && (
            <>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Trigger Type</Label>
                <Select value={triggerType} onValueChange={handleTriggerTypeChange}>
                  <SelectTrigger className="border-border bg-secondary text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="parameter-changed">Parameter Changed</SelectItem>
                    <SelectItem value="setpoint-changed">Set-Point Changed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  {isParameterTrigger ? 'Parameter' : 'Set-Point'}
                </Label>
                <Select
                  value={
                    isParameterTrigger
                      ? String((data.parameter as string) || '')
                      : String((data.setpoint as string) || '')
                  }
                  onValueChange={(val) => {
                    const sourceId = isParameterTrigger
                      ? cleanParameters.find((p) => String(p.id) === val)?.id
                      : setPoints.find((sp) => String(sp.id) === val)?.id

                    // Update both fields in a single call
                    onNodeChange(selectedNode.id, {
                      ...data,
                      [isParameterTrigger ? 'parameter' : 'setpoint']: val,
                      source_id: sourceId,
                    })
                  }}
                >
                  <SelectTrigger className="border-border bg-secondary text-foreground">
                    <SelectValue
                      placeholder={`Select ${isParameterTrigger ? 'parameter' : 'set-point'}...`}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {(isParameterTrigger ? cleanParameters : setPoints).map((item) => (
                      <SelectItem key={item.id} value={String(item.id)}>
                        {isParameterTrigger
                          ? (item as Parameter).nama
                          : (item as SetPoint).name}
                        {isParameterTrigger && (item as Parameter).unit && ` (${(item as Parameter).unit})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {/* ============ CONDITION (IF) FIELDS ============ */}
          {nodeType === 'condition' && (
            <>
              {/* Condition Type */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Condition Type</Label>
                <Select
                  value={(data.conditionType as string) || 'comparison'}
                  onValueChange={(val) => {
                    if (val === 'time_window') {
                      handleChange('conditionType', 'time_window')
                      handleChange('timeWindow', {
                        startTime: '08:00',
                        endTime: '17:00',
                        days: [],
                      })
                    } else {
                      handleChange('conditionType', 'comparison')
                      handleChange('leftSourceType', 'parameter')
                      handleChange('leftValue', '')
                      handleChange('operator', '>')
                      handleChange('rightValueType', 'static')
                      handleChange('rightValue', '')
                    }
                  }}
                >
                  <SelectTrigger className="border-border bg-secondary text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="comparison">Parameter Comparison</SelectItem>
                    <SelectItem value="time_window">Time Window</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(data.conditionType as string) === 'time_window' ? (
                <>
                  {/* Time Window Configuration */}
                  <div className="space-y-2">
                    <Label htmlFor="start-time" className="text-xs text-muted-foreground">
                      Start Time (HH:MM)
                    </Label>
                    <Input
                      id="start-time"
                      type="time"
                      value={(data.timeWindow as any)?.startTime || '08:00'}
                      onChange={(e) =>
                        handleChange('timeWindow', {
                          ...(data.timeWindow as any),
                          startTime: e.target.value,
                        })
                      }
                      className="border-border bg-secondary text-foreground"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="end-time" className="text-xs text-muted-foreground">
                      End Time (HH:MM)
                    </Label>
                    <Input
                      id="end-time"
                      type="time"
                      value={(data.timeWindow as any)?.endTime || '17:00'}
                      onChange={(e) =>
                        handleChange('timeWindow', {
                          ...(data.timeWindow as any),
                          endTime: e.target.value,
                        })
                      }
                      className="border-border bg-secondary text-foreground"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Days (Optional)</Label>
                    <div className="space-y-2">
                      {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((day) => (
                        <div key={day} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id={`day-${day}`}
                            checked={(data.timeWindow as any)?.days?.includes(day) || false}
                            onChange={(e) => {
                              const currentDays = (data.timeWindow as any)?.days || []
                              const newDays = e.target.checked
                                ? [...currentDays, day]
                                : currentDays.filter((d: string) => d !== day)
                              handleChange('timeWindow', {
                                ...(data.timeWindow as any),
                                days: newDays,
                              })
                            }}
                            className="h-4 w-4 rounded border-border"
                          />
                          <Label htmlFor={`day-${day}`} className="text-xs text-foreground capitalize">
                            {day}
                          </Label>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Leave empty to allow all days
                    </p>
                  </div>
                </>
              ) : (
                <>
                  {/* Left Source Type */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Left Source Type</Label>
                    <Select value={leftSourceType} onValueChange={handleLeftSourceTypeChange}>
                      <SelectTrigger className="border-border bg-secondary text-foreground">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="parameter">Parameter</SelectItem>
                        <SelectItem value="setpoint">Set-Point</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

              {/* Left Value dropdown */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  {leftSourceType === 'parameter' ? 'Parameter' : 'Set-Point'}
                </Label>
                <Select
                  value={String((data.leftValue as string) || '')}
                  onValueChange={(val) => {
                    const sourceId =
                      leftSourceType === 'parameter'
                        ? cleanParameters.find((p) => String(p.id) === val)?.id
                        : setPoints.find((sp) => String(sp.id) === val)?.id

                    // Update both fields in a single call
                    onNodeChange(selectedNode.id, {
                      ...data,
                      leftValue: val,
                      leftSourceId: sourceId,
                    })
                  }}
                >
                  <SelectTrigger className="border-border bg-secondary text-foreground">
                    <SelectValue placeholder={`Select ${leftSourceType}...`} />
                  </SelectTrigger>
                  <SelectContent>
                    {leftItems.length === 0 ? (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        No {leftSourceType}s available
                      </div>
                    ) : (
                      leftItems.map((item) => (
                        <SelectItem key={item.id} value={String(item.id)}>
                          {leftSourceType === 'parameter'
                            ? (item as Parameter).nama
                            : (item as SetPoint).name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Operator */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Operator</Label>
                <Select
                  value={(data.operator as string) || '>'}
                  onValueChange={(val) => handleChange('operator', val)}
                >
                  <SelectTrigger className="border-border bg-secondary text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPERATORS.map((op) => (
                      <SelectItem key={op} value={op}>
                        {op}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Right Value Type */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Right Value Type</Label>
                <Select value={rightValueType} onValueChange={handleRightValueTypeChange}>
                  <SelectTrigger className="border-border bg-secondary text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="static">Static Value</SelectItem>
                    <SelectItem value="setpoint">Set-Point</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Right Value */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  {rightValueType === 'static' ? 'Value' : 'Set-Point'}
                </Label>
                {rightValueType === 'static' ? (
                  <Input
                    type="number"
                    value={(data.rightValue as string) || ''}
                    onChange={(e) => handleChange('rightValue', e.target.value)}
                    placeholder="Enter value..."
                    className="border-border bg-secondary text-foreground"
                  />
                ) : (
                  <Select
                    value={String((data.rightValue as string) || '')}
                    onValueChange={(val) => {
                      const sourceId = setPoints.find((sp) => String(sp.id) === val)?.id
                      // Update both fields in a single call
                      onNodeChange(selectedNode.id, {
                        ...data,
                        rightValue: val,
                        rightSourceId: sourceId,
                      })
                    }}
                  >
                    <SelectTrigger className="border-border bg-secondary text-foreground">
                      <SelectValue placeholder="Select set-point..." />
                    </SelectTrigger>
                    <SelectContent>
                      {rightItems.length === 0 ? (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">No set-points available</div>
                      ) : (
                        rightItems.map((item) => (
                          <SelectItem key={item.id} value={String(item.id)}>
                            {(item as SetPoint).name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                )}
              </div>
                </>
              )}
            </>
          )}

          {/* ============ ACTION FIELDS ============ */}
          {nodeType === 'action' && (
            <>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Action Type</Label>
                <Select
                  value={(data.actionType as string) || 'alarm-notification'}
                  onValueChange={handleActionTypeChange}
                >
                  <SelectTrigger className="border-border bg-secondary text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="alarm-notification">Alarm Notification</SelectItem>
                    <SelectItem value="write-dynamic">Write Dynamic Value</SelectItem>
                    <SelectItem value="trigger-preset">Trigger Preset</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="h-px bg-border" />

              {/* Alarm Notification fields */}
              {(data.actionType as string) === 'alarm-notification' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="alarm-title" className="text-xs text-muted-foreground">
                      Alarm Title
                    </Label>
                    <Input
                      id="alarm-title"
                      value={(data.alarmTitle as string) || ''}
                      onChange={(e) => handleChange('alarmTitle', e.target.value)}
                      placeholder="Enter alarm title..."
                      className="border-border bg-secondary text-foreground"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Severity</Label>
                    <Select
                      value={(data.alarmSeverity as string) || ''}
                      onValueChange={(val) => handleChange('alarmSeverity', val)}
                    >
                      <SelectTrigger className="border-border bg-secondary text-foreground">
                        <SelectValue placeholder="Select severity..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="info">Info</SelectItem>
                        <SelectItem value="warning">Warning</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="alarm-message" className="text-xs text-muted-foreground">
                      Message
                    </Label>
                    <Textarea
                      id="alarm-message"
                      value={(data.alarmMessage as string) || ''}
                      onChange={(e) => handleChange('alarmMessage', e.target.value)}
                      placeholder="Enter alarm message..."
                      rows={3}
                      className="border-border bg-secondary text-foreground"
                    />
                  </div>
                </>
              )}

              {/* Write Dynamic Value fields */}
              {(data.actionType as string) === 'write-dynamic' && (
                <>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Target Type</Label>
                    <Select
                      value={actionTargetType}
                      onValueChange={(val) => {
                        onNodeChange(selectedNode.id, {
                          ...data,
                          targetType: val,
                          targetParameter: '',
                          targetSetPoint: '',
                          targetId: undefined,
                          targetSetPointId: undefined,
                        })
                      }}
                    >
                      <SelectTrigger className="border-border bg-secondary text-foreground">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="parameter">Parameter</SelectItem>
                        <SelectItem value="setpoint">Set-Point</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">
                      {actionTargetType === 'setpoint' ? 'Target Set-Point' : 'Target Parameter'}
                    </Label>
                    <Select
                      value={String(
                        actionTargetType === 'setpoint'
                          ? ((data.targetSetPoint as string) || '')
                          : ((data.targetParameter as string) || '')
                      )}
                      onValueChange={(val) => {
                        if (actionTargetType === 'setpoint') {
                          const targetSetPointId = setPoints.find((sp) => String(sp.id) === val)?.id
                          onNodeChange(selectedNode.id, {
                            ...data,
                            targetSetPoint: val,
                            targetSetPointId,
                            targetId: targetSetPointId,
                          })
                        } else {
                          const targetId = writeParameters.find((p) => String(p.id) === val)?.id
                          onNodeChange(selectedNode.id, {
                            ...data,
                            targetParameter: val,
                            targetId,
                          })
                        }
                      }}
                    >
                      <SelectTrigger className="border-border bg-secondary text-foreground">
                        <SelectValue placeholder="Select target..." />
                      </SelectTrigger>
                      <SelectContent>
                        {(actionTargetType === 'setpoint' ? setPoints.length : writeParameters.length) === 0 ? (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">
                            {actionTargetType === 'setpoint'
                              ? 'No set-points available'
                              : 'No write parameters available'}
                          </div>
                        ) : (
                          actionTargetType === 'setpoint'
                            ? setPoints.map((sp) => (
                                <SelectItem key={sp.id} value={String(sp.id)}>
                                  {sp.name} {sp.unit && `(${sp.unit})`}
                                </SelectItem>
                              ))
                            : writeParameters.map((p) => (
                                <SelectItem key={p.id} value={String(p.id)}>
                                  {p.nama} {p.unit && `(${p.unit})`}
                                </SelectItem>
                              ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Value Source</Label>
                    <Select
                      value={(data.valueSource as string) || ''}
                      onValueChange={handleValueSourceChange}
                    >
                      <SelectTrigger className="border-border bg-secondary text-foreground">
                        <SelectValue placeholder="Select source..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="static">Static Value</SelectItem>
                        <SelectItem value="setpoint">Set-Point</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {(data.valueSource as string) === 'static' && (
                    <div className="space-y-2">
                      <Label htmlFor="static-value" className="text-xs text-muted-foreground">
                        Static Value
                      </Label>
                      <Input
                        id="static-value"
                        type="number"
                        value={(data.staticValue as string) || ''}
                        onChange={(e) => handleChange('staticValue', e.target.value)}
                        placeholder="Enter value..."
                        className="border-border bg-secondary text-foreground"
                      />
                    </div>
                  )}
                  {(data.valueSource as string) === 'setpoint' && (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Set-Point</Label>
                      <Select
                        value={String((data.sourceSetpoint as string) || '')}
                        onValueChange={(val) => {
                          const sourceId = setPoints.find((sp) => String(sp.id) === val)?.id
                          // Update both fields in a single call
                          onNodeChange(selectedNode.id, {
                            ...data,
                            sourceSetpoint: val,
                            sourceSetpointId: sourceId,
                          })
                        }}
                      >
                        <SelectTrigger className="border-border bg-secondary text-foreground">
                          <SelectValue placeholder="Select set-point..." />
                        </SelectTrigger>
                        <SelectContent>
                          {setPoints.length === 0 ? (
                            <div className="px-2 py-1.5 text-sm text-muted-foreground">No set-points available</div>
                          ) : (
                            setPoints.map((sp) => (
                              <SelectItem key={sp.id} value={String(sp.id)}>
                                {sp.name}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </>
              )}

              {/* Trigger Preset fields */}
              {(data.actionType as string) === 'trigger-preset' && (
                <>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Preset Parameter</Label>
                    <Select
                      value={String((data.presetName as string) || '')}
                      onValueChange={(val) => {
                        const presetId = presetParameters.find((p) => String(p.id) === val)?.id
                        // Update both fields in a single call
                        onNodeChange(selectedNode.id, {
                          ...data,
                          presetName: val,
                          presetId: presetId,
                        })
                      }}
                    >
                      <SelectTrigger className="border-border bg-secondary text-foreground">
                        <SelectValue placeholder="Select preset..." />
                      </SelectTrigger>
                      <SelectContent>
                        {presetParameters.length === 0 ? (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">No preset parameters available</div>
                        ) : (
                          presetParameters.map((p) => (
                            <SelectItem key={p.id} value={String(p.id)}>
                              {p.nama} {p.unit && `(${p.unit})`}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </>
          )}

          {nodeType === 'timer' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="timer-duration" className="text-xs text-muted-foreground">
                  Duration
                </Label>
                <Input
                  id="timer-duration"
                  type="number"
                  min="1"
                  value={(data.duration as number) || 0}
                  onChange={(e) => handleChange('duration', parseInt(e.target.value) || 0)}
                  placeholder="Enter duration..."
                  className="border-border bg-secondary text-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Unit</Label>
                <Select
                  value={(data.unit as string) || 'seconds'}
                  onValueChange={(val) => handleChange('unit', val)}
                >
                  <SelectTrigger className="border-border bg-secondary text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="seconds">Seconds</SelectItem>
                    <SelectItem value="minutes">Minutes</SelectItem>
                    <SelectItem value="hours">Hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          <div className="h-px bg-border" />

          {/* Enable/Disable */}
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm text-foreground">Enabled</Label>
              <p className="text-xs text-muted-foreground">Node active in workflow</p>
            </div>
            <Switch
              checked={(data.enabled as boolean) ?? true}
              onCheckedChange={(val) => handleChange('enabled', val)}
            />
          </div>
        </div>
      </div>
    </aside>
  )
}
