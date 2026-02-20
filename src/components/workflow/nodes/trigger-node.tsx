import { memo } from 'react'
import { Handle, Position, type NodeProps } from 'reactflow'
import { Activity, Target, AlertTriangle } from 'lucide-react'
import type { TriggerNodeData } from '@/types/workflow-builder'
import type { Parameter } from '@/types/parameter'
import type { SetPoint } from '@/services/setPointService'

interface TriggerNodeComponentProps extends NodeProps {
  data: TriggerNodeData
  parameters?: Parameter[]
  setPoints?: SetPoint[]
}

function TriggerNodeComponent({ data, selected, parameters = [], setPoints = [] }: TriggerNodeComponentProps) {
  const Icon = data.triggerType === 'parameter-changed' ? Activity : Target

  const isParameterTrigger = data.triggerType === 'parameter-changed'
  const selectedSource = isParameterTrigger ? data.parameter : data.setpoint
  const hasWarning = !selectedSource

  return (
    <div
      className={`min-w-[240px] max-w-[280px] rounded-lg border shadow-lg transition-all duration-200 ${
        selected
          ? 'border-primary ring-2 ring-primary/30 shadow-primary/20'
          : 'border-border hover:border-primary/50'
      }`}
      style={{ background: 'hsl(220 13% 14%)' }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 rounded-t-lg px-3 py-2"
        style={{ background: 'hsl(207 90% 54%)' }}
      >
        <Icon className="h-4 w-4 text-white" />
        <span className="text-sm font-semibold text-white">Trigger</span>
        {!data.enabled && (
          <span className="ml-auto rounded bg-black/20 px-1.5 py-0.5 text-[10px] font-medium text-white/80">
            Disabled
          </span>
        )}
        {hasWarning && data.enabled && (
          <AlertTriangle className="ml-auto h-3.5 w-3.5 text-white/80" />
        )}
      </div>

      {/* Body */}
      <div className="px-3 py-3 space-y-2.5">
        {/* Trigger Type Display */}
        <div className="rounded border border-border bg-secondary px-2 py-2">
          <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">
            Trigger Type
          </div>
          <div className="flex items-center gap-2">
            <Icon className="h-3.5 w-3.5" style={{ color: 'hsl(207 90% 54%)' }} />
            <div className="text-sm font-semibold text-foreground">
              {data.triggerType === 'parameter-changed' ? 'Parameter Changed' : 'Set-Point Changed'}
            </div>
          </div>
        </div>

        {/* Source Display */}
        <div className="rounded border border-border bg-secondary px-2 py-2">
          <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">
            {isParameterTrigger ? 'Parameter' : 'Set-Point'}
          </div>
          <div className="text-sm font-semibold text-foreground">
            {selectedSource
              ? isParameterTrigger
                ? parameters.find((p) => String(p.id) === selectedSource)?.nama || selectedSource
                : setPoints.find((sp) => String(sp.id) === selectedSource)?.name || selectedSource
              : 'Not set'}
          </div>
        </div>

        {/* Preview */}
        {selectedSource && (
          <div className="rounded border border-border bg-secondary px-2 py-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">
              {isParameterTrigger ? 'When ' : 'When SP '}
            </span>
            <span className="font-mono text-xs font-medium text-primary">
              {isParameterTrigger
                ? parameters.find((p) => String(p.id) === selectedSource)?.nama || selectedSource
                : setPoints.find((sp) => String(sp.id) === selectedSource)?.name || selectedSource}
            </span>
            <span className="font-mono text-[10px] text-muted-foreground"> changes</span>
          </div>
        )}

        {/* Validation warning */}
        {hasWarning && (
          <div className="flex items-start gap-1.5 rounded border border-accent/30 bg-accent/10 px-2 py-1.5">
            <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0 text-accent" />
            <span className="text-[10px] leading-tight text-accent">
              {isParameterTrigger ? 'Parameter' : 'Set-Point'} required
            </span>
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-3 !w-3 !rounded-full !border-2 !border-primary !bg-background"
      />
    </div>
  )
}

export const TriggerNode = memo(TriggerNodeComponent, (prevProps, nextProps) => {
  // Custom comparison: re-render if data changed (return false means props are different, need re-render)
  const prevData = prevProps.data
  const nextData = nextProps.data
  if (
    prevData.triggerType !== nextData.triggerType ||
    prevData.parameter !== nextData.parameter ||
    prevData.setpoint !== nextData.setpoint ||
    prevData.enabled !== nextData.enabled ||
    prevProps.selected !== nextProps.selected
  ) {
    return false // Props are different, need re-render
  }
  return true // Props are same, skip re-render
})
