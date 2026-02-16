import { memo, useCallback } from 'react'
import { Handle, Position, type NodeProps, useReactFlow } from 'reactflow'
import { Bell, Pencil, Zap, AlertTriangle } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import type { ActionNodeData, ActionType } from '@/types/workflow-builder'
import type { Parameter } from '@/types/parameter'
import type { SetPoint } from '@/services/setPointService'

const ACTION_CONFIG: Record<
  ActionType,
  { icon: React.ComponentType<{ className?: string }>; color: string; label: string; borderColor: string }
> = {
  'alarm-notification': {
    icon: Bell,
    color: 'hsl(0 72% 51%)',
    label: 'Alarm Notification',
    borderColor: 'hsl(0 72% 51%)',
  },
  'write-dynamic': {
    icon: Pencil,
    color: 'hsl(142 71% 45%)',
    label: 'Write Dynamic Value',
    borderColor: 'hsl(142 71% 45%)',
  },
  'trigger-preset': {
    icon: Zap,
    color: 'hsl(207 90% 54%)',
    label: 'Trigger Preset',
    borderColor: 'hsl(207 90% 54%)',
  },
}

function getValidationWarnings(data: ActionNodeData): string[] {
  const warnings: string[] = []
  switch (data.actionType) {
    case 'alarm-notification':
      if (!data.alarmTitle) warnings.push('Title required')
      if (!data.alarmSeverity) warnings.push('Severity required')
      if (!data.alarmMessage) warnings.push('Message required')
      break
    case 'write-dynamic':
      if (!data.targetParameter) warnings.push('Target required')
      if (!data.valueSource) warnings.push('Source required')
      if (data.valueSource === 'static' && !data.staticValue) warnings.push('Value required')
      if (data.valueSource === 'setpoint' && !data.sourceSetpoint) warnings.push('Set-point required')
      break
    case 'trigger-preset':
      if (!data.presetName) warnings.push('Preset required')
      break
  }
  return warnings
}

interface ActionNodeComponentProps extends NodeProps {
  data: ActionNodeData
  parameters?: Parameter[]
  setPoints?: SetPoint[]
}

function ActionNodeComponent({ id, data, selected, parameters = [], setPoints = [] }: ActionNodeComponentProps) {
  const { setNodes } = useReactFlow()
  const config = ACTION_CONFIG[data.actionType] || ACTION_CONFIG['alarm-notification']
  const Icon = config.icon
  const warnings = getValidationWarnings(data)
  const hasWarnings = warnings.length > 0

  const handleTypeChange = useCallback(
    (val: string) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === id) {
            return {
              ...node,
              data: {
                ...node.data,
                actionType: val as ActionType,
                label:
                  val === 'alarm-notification'
                    ? 'Alarm Notification'
                    : val === 'write-dynamic'
                      ? 'Write Dynamic Value'
                      : 'Trigger Preset',
                alarmTitle: '',
                alarmSeverity: undefined,
                alarmMessage: '',
                targetParameter: '',
                targetId: undefined,
                valueSource: undefined,
                staticValue: '',
                sourceSetpoint: '',
                sourceSetpointId: undefined,
                presetName: '',
                presetId: undefined,
              },
            }
          }
          return node
        })
      )
    },
    [id, setNodes]
  )

  const handleChange = useCallback(
    (key: string, value: unknown) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === id) {
            return { ...node, data: { ...node.data, [key]: value } }
          }
          return node
        })
      )
    },
    [id, setNodes]
  )

  const handleTargetChange = useCallback(
    (val: string) => {
      const targetId = parameters.find((p) => String(p.id) === val)?.id
      // Update both values in a single state update to avoid race condition
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === id) {
            return {
              ...node,
              data: {
                ...node.data,
                targetParameter: val,
                targetId: targetId,
              },
            }
          }
          return node
        })
      )
    },
    [id, parameters, setNodes]
  )

  const handleValueSourceChange = useCallback(
    (val: string) => {
      handleChange('valueSource', val)
      handleChange('staticValue', '')
      handleChange('sourceSetpoint', '')
      handleChange('sourceSetpointId', undefined)
    },
    [handleChange]
  )

  const handleSetpointChange = useCallback(
    (val: string) => {
      const sourceId = setPoints.find((sp) => String(sp.id) === val)?.id
      // Update both values in a single state update to avoid race condition
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === id) {
            return {
              ...node,
              data: {
                ...node.data,
                sourceSetpoint: val,
                sourceSetpointId: sourceId,
              },
            }
          }
          return node
        })
      )
    },
    [id, setPoints, setNodes]
  )

  return (
    <div
      className={`min-w-[240px] max-w-[280px] rounded-lg border shadow-lg transition-all duration-200 ${
        selected ? 'ring-2 ring-offset-1 ring-offset-background' : 'hover:shadow-xl'
      }`}
      style={{
        background: 'hsl(220 13% 14%)',
        borderColor: selected ? config.borderColor : 'hsl(220 12% 22%)',
        ...(selected ? { boxShadow: `0 0 20px ${config.borderColor}33` } : {}),
      }}
      onMouseDown={(e) => {
        // Don't stop propagation on mousedown, let React Flow handle node selection
        // Only stop if clicking on interactive elements
        const target = e.target as HTMLElement
        if (target.closest('button, [role="combobox"], input, select')) {
          e.stopPropagation()
        }
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!h-3 !w-3 !rounded-full !border-2 !bg-background"
        style={{ borderColor: config.borderColor }}
      />

      {/* Header */}
      <div
        className="flex items-center gap-2 rounded-t-lg px-3 py-2"
        style={{ background: config.color }}
      >
        <Icon className="h-4 w-4 text-white" />
        <span className="text-sm font-semibold text-white">{config.label}</span>
        {!data.enabled && (
          <span className="ml-auto rounded bg-black/20 px-1.5 py-0.5 text-[10px] font-medium text-white/80">
            Disabled
          </span>
        )}
        {hasWarnings && data.enabled && (
          <AlertTriangle className="ml-auto h-3.5 w-3.5 text-white/80" />
        )}
      </div>

      {/* Body */}
      <div className="px-3 py-3 space-y-2.5">
        {/* Action type selector */}
        <Select value={data.actionType} onValueChange={handleTypeChange}>
          <SelectTrigger 
            className="h-8 border-border bg-secondary text-xs text-foreground"
            onClick={(e) => e.stopPropagation()}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent 
            onPointerDownOutside={(e) => e.preventDefault()}
            onInteractOutside={(e) => e.preventDefault()}
          >
            <SelectItem value="alarm-notification">
              <span className="flex items-center gap-2">
                <Bell className="h-3 w-3" />
                Alarm Notification
              </span>
            </SelectItem>
            <SelectItem value="write-dynamic">
              <span className="flex items-center gap-2">
                <Pencil className="h-3 w-3" />
                Write Dynamic Value
              </span>
            </SelectItem>
            <SelectItem value="trigger-preset">
              <span className="flex items-center gap-2">
                <Zap className="h-3 w-3" />
                Trigger Preset
              </span>
            </SelectItem>
          </SelectContent>
        </Select>

        {/* Description */}
        <p className="text-xs text-muted-foreground">{data.description}</p>

        {/* Alarm Notification fields */}
        {data.actionType === 'alarm-notification' && (
          <div className="space-y-2">
            <Input
              value={data.alarmTitle || ''}
              onChange={(e) => handleChange('alarmTitle', e.target.value)}
              placeholder="Alarm title..."
              className="h-7 border-border bg-secondary text-xs text-foreground"
            />
            <Select
              value={data.alarmSeverity || ''}
              onValueChange={(val) => handleChange('alarmSeverity', val)}
            >
              <SelectTrigger className="h-7 border-border bg-secondary text-xs text-foreground">
                <SelectValue placeholder="Select severity..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
            <Input
              value={data.alarmMessage || ''}
              onChange={(e) => handleChange('alarmMessage', e.target.value)}
              placeholder="Alarm message..."
              className="h-7 border-border bg-secondary text-xs text-foreground"
            />
          </div>
        )}

        {/* Write Dynamic Value fields */}
        {data.actionType === 'write-dynamic' && (
          <div className="space-y-2">
            <Select value={data.targetParameter || ''} onValueChange={handleTargetChange}>
              <SelectTrigger 
                className="h-7 border-border bg-secondary text-xs text-foreground"
                onClick={(e) => e.stopPropagation()}
              >
                <SelectValue placeholder="Select target..." />
              </SelectTrigger>
              <SelectContent 
                onPointerDownOutside={(e) => e.preventDefault()}
                onInteractOutside={(e) => e.preventDefault()}
              >
                {parameters
                  .filter((p) => p.direction === 'WRITE' || p.read_write === 1 || p.read_write === 2)
                  .map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.nama} {p.unit && `(${p.unit})`}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Select value={data.valueSource || ''} onValueChange={handleValueSourceChange}>
              <SelectTrigger 
                className="h-7 border-border bg-secondary text-xs text-foreground"
                onClick={(e) => e.stopPropagation()}
              >
                <SelectValue placeholder="Select source..." />
              </SelectTrigger>
              <SelectContent 
                onPointerDownOutside={(e) => e.preventDefault()}
                onInteractOutside={(e) => e.preventDefault()}
              >
                <SelectItem value="static">Static Value</SelectItem>
                <SelectItem value="setpoint">Set-Point</SelectItem>
              </SelectContent>
            </Select>
            {data.valueSource === 'static' && (
              <Input
                type="number"
                value={data.staticValue || ''}
                onChange={(e) => handleChange('staticValue', e.target.value)}
                placeholder="Enter value..."
                className="h-7 border-border bg-secondary text-xs text-foreground"
              />
            )}
            {data.valueSource === 'setpoint' && (
              <Select value={data.sourceSetpoint || ''} onValueChange={handleSetpointChange}>
                <SelectTrigger 
                  className="h-7 border-border bg-secondary text-xs text-foreground"
                  onClick={(e) => e.stopPropagation()}
                >
                  <SelectValue placeholder="Select set-point..." />
                </SelectTrigger>
                <SelectContent 
                  onPointerDownOutside={(e) => e.preventDefault()}
                  onInteractOutside={(e) => e.preventDefault()}
                >
                  {setPoints.map((sp) => (
                    <SelectItem key={sp.id} value={String(sp.id)}>
                      {sp.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        {/* Trigger Preset fields */}
        {data.actionType === 'trigger-preset' && (
          <div className="space-y-2">
            <Select value={data.presetName || ''} onValueChange={(val) => handleChange('presetName', val)}>
              <SelectTrigger 
                className="h-7 border-border bg-secondary text-xs text-foreground"
                onClick={(e) => e.stopPropagation()}
              >
                <SelectValue placeholder="Select preset..." />
              </SelectTrigger>
              <SelectContent 
                onPointerDownOutside={(e) => e.preventDefault()}
                onInteractOutside={(e) => e.preventDefault()}
              >
                {parameters
                  .filter((p) => p.direction === 'WRITE' && p.write_mode === 'PRESET')
                  .map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.nama} {p.unit && `(${p.unit})`}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Validation warning */}
        {hasWarnings && (
          <div className="flex items-start gap-1.5 rounded border border-accent/30 bg-accent/10 px-2 py-1.5">
            <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0 text-accent" />
            <span className="text-[10px] leading-tight text-accent">{warnings.join(', ')}</span>
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-3 !w-3 !rounded-full !border-2 !bg-background"
        style={{ borderColor: config.borderColor }}
      />
    </div>
  )
}

export const ActionNode = memo(ActionNodeComponent)
