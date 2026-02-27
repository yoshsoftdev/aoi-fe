import { memo } from 'react'
import { Handle, Position, type NodeProps } from 'reactflow'
import { Bell, Pencil, Zap, AlertTriangle } from 'lucide-react'
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

function ActionNodeComponent({ data, selected, parameters = [], setPoints = [] }: ActionNodeComponentProps) {
  const config = ACTION_CONFIG[data.actionType] || ACTION_CONFIG['alarm-notification']
  const Icon = config.icon
  const warnings = getValidationWarnings(data)
  const hasWarnings = warnings.length > 0

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
        {/* Action Type Display */}
        <div className="rounded border border-border bg-secondary px-2 py-2">
          <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">
            Action Type
          </div>
          <div className="flex items-center gap-2">
            <span style={{ color: config.color }}>
              <Icon className="h-3.5 w-3.5" />
            </span>
            <div className="text-sm font-semibold text-foreground">{config.label}</div>
          </div>
        </div>

        {/* Alarm Notification Display */}
        {data.actionType === 'alarm-notification' && (
          <div className="space-y-2">
            {data.alarmTitle && (
              <div className="rounded border border-border bg-secondary px-2 py-2">
                <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">
                  Title
                </div>
                <div className="text-sm font-semibold text-foreground">{data.alarmTitle}</div>
              </div>
            )}
            {data.alarmSeverity && (
              <div className="rounded border border-border bg-secondary px-2 py-2">
                <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">
                  Severity
                </div>
                <div className="text-sm font-semibold text-foreground capitalize">{data.alarmSeverity}</div>
              </div>
            )}
            {data.alarmMessage && (
              <div className="rounded border border-border bg-secondary px-2 py-2">
                <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">
                  Message
                </div>
                <div className="text-sm font-semibold text-foreground">{data.alarmMessage}</div>
              </div>
            )}
          </div>
        )}

        {/* Write Dynamic Value Display */}
        {data.actionType === 'write-dynamic' && (
          <div className="space-y-2">
            {data.targetParameter && (
              <div className="rounded border border-border bg-secondary px-2 py-2">
                <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">
                  Target Parameter
                </div>
                <div className="text-sm font-semibold text-foreground">
                  {parameters.find((p) => String(p.id) === data.targetParameter)?.nama || data.targetParameter}
                </div>
              </div>
            )}
            {data.valueSource && (
              <div className="rounded border border-border bg-secondary px-2 py-2">
                <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">
                  Value Source
                </div>
                <div className="text-sm font-semibold text-foreground capitalize">{data.valueSource}</div>
              </div>
            )}
            {data.valueSource === 'static' && data.staticValue && (
              <div className="rounded border border-border bg-secondary px-2 py-2">
                <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">
                  Static Value
                </div>
                <div className="text-sm font-semibold text-foreground">{data.staticValue}</div>
              </div>
            )}
            {data.valueSource === 'setpoint' && data.sourceSetpoint && (
              <div className="rounded border border-border bg-secondary px-2 py-2">
                <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">
                  Set-Point
                </div>
                <div className="text-sm font-semibold text-foreground">
                  {setPoints.find((sp) => String(sp.id) === data.sourceSetpoint)?.name || data.sourceSetpoint}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Trigger Preset Display */}
        {data.actionType === 'trigger-preset' && data.presetName && (
          <div className="rounded border border-border bg-secondary px-2 py-2">
            <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">
              Preset Parameter
            </div>
            <div className="text-sm font-semibold text-foreground">
              {parameters.find((p) => String(p.id) === data.presetName)?.nama || data.presetName}
            </div>
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

export const ActionNode = memo(ActionNodeComponent, (prevProps, nextProps) => {
  // Custom comparison: re-render if data changed (return false means props are different, need re-render)
  const prevData = prevProps.data
  const nextData = nextProps.data
  if (
    prevData.actionType !== nextData.actionType ||
    prevData.alarmTitle !== nextData.alarmTitle ||
    prevData.alarmSeverity !== nextData.alarmSeverity ||
    prevData.alarmMessage !== nextData.alarmMessage ||
    prevData.targetParameter !== nextData.targetParameter ||
    prevData.valueSource !== nextData.valueSource ||
    prevData.staticValue !== nextData.staticValue ||
    prevData.sourceSetpoint !== nextData.sourceSetpoint ||
    prevData.presetName !== nextData.presetName ||
    prevData.enabled !== nextData.enabled ||
    prevProps.selected !== nextProps.selected
  ) {
    return false // Props are different, need re-render
  }
  return true // Props are same, skip re-render
})
