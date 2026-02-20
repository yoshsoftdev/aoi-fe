import { Handle, Position, NodeProps } from 'reactflow'
import { Clock, AlertTriangle } from 'lucide-react'
import type { TimerNodeData } from '@/types/workflow-builder'

interface TimerNodeComponentProps extends NodeProps {
  data: TimerNodeData
}

export function TimerNodeComponent({ data, selected }: TimerNodeComponentProps) {
  const formatDuration = () => {
    if (!data.duration) return '0s'
    const unit = data.unit || 'seconds'
    const abbrev = unit === 'seconds' ? 's' : unit === 'minutes' ? 'm' : 'h'
    return `${data.duration}${abbrev}`
  }

  const hasWarning = !data.duration || data.duration <= 0

  return (
    <div
      className={`min-w-[200px] max-w-[240px] rounded-lg border shadow-lg transition-all duration-200 ${
        selected
          ? 'border-warning ring-2 ring-warning/30 shadow-warning/20'
          : 'border-border hover:border-warning/50'
      }`}
      style={{ background: 'hsl(220 13% 14%)' }}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!h-3 !w-3 !rounded-full !border-2 !border-warning !bg-background"
      />

      {/* Header */}
      <div
        className="flex items-center gap-2 rounded-t-lg px-3 py-2"
        style={{ background: 'hsl(38 92% 50%)' }}
      >
        <Clock className="h-4 w-4 text-white" />
        <span className="text-sm font-semibold text-white">Timer</span>
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
        {/* Duration Display */}
        <div className="rounded border border-border bg-secondary px-2 py-2">
          <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">
            Duration
          </div>
          <div className="text-sm font-semibold text-foreground">{formatDuration()}</div>
        </div>

        {/* Unit Display */}
        <div className="rounded border border-border bg-secondary px-2 py-2">
          <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">
            Unit
          </div>
          <div className="text-sm font-semibold text-foreground capitalize">{data.unit || 'seconds'}</div>
        </div>

        {/* Validation warning */}
        {hasWarning && (
          <div className="flex items-start gap-1.5 rounded border border-accent/30 bg-accent/10 px-2 py-1.5">
            <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0 text-accent" />
            <span className="text-[10px] leading-tight text-accent">
              Duration must be greater than 0
            </span>
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-3 !w-3 !rounded-full !border-2 !border-warning !bg-background"
      />
    </div>
  )
}
