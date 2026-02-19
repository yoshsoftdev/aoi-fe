import { Handle, Position, NodeProps } from 'reactflow'
import { Card } from '@/components/ui/card'
import { Clock } from 'lucide-react'
import type { TimerNodeData } from '@/types/workflow-builder'

interface TimerNodeComponentProps extends NodeProps {
  data: TimerNodeData
}

export function TimerNodeComponent({ id, data, selected }: TimerNodeComponentProps) {
  const formatDuration = () => {
    if (!data.duration) return '0s'
    const unit = data.unit || 'seconds'
    const abbrev = unit === 'seconds' ? 's' : unit === 'minutes' ? 'm' : 'h'
    return `${data.duration}${abbrev}`
  }

  return (
    <Card
      className={`min-w-[180px] border-2 transition-all ${
        selected ? 'border-primary shadow-lg' : 'border-border'
      } ${!data.enabled ? 'opacity-50' : ''}`}
    >
      <div className="flex items-center gap-2 p-3">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-warning/10">
          <Clock className="h-4 w-4 text-warning" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{data.label || 'Timer'}</p>
          <p className="text-xs text-muted-foreground">{formatDuration()}</p>
        </div>
      </div>
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
    </Card>
  )
}
