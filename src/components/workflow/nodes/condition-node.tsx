import { memo } from 'react'
import { Handle, Position, type NodeProps } from 'reactflow'
import { GitBranch, AlertTriangle, Clock } from 'lucide-react'
import type { ConditionNodeData } from '@/types/workflow-builder'
import type { Parameter } from '@/types/parameter'
import type { SetPoint } from '@/services/setPointService'

interface ConditionNodeComponentProps extends NodeProps {
  data: ConditionNodeData
  parameters?: Parameter[]
  setPoints?: SetPoint[]
}

function ConditionNodeComponent({ data, selected, parameters = [], setPoints = [] }: ConditionNodeComponentProps) {
  const conditionType = data.conditionType || 'comparison'
  const leftSourceType = data.leftSourceType || 'parameter'

  const hasWarning = conditionType === 'comparison' 
    ? (!data.leftValue || !data.rightValue)
    : (!data.timeWindow?.startTime || !data.timeWindow?.endTime)

  // Build display string for the IF summary
  const leftDisplay = conditionType === 'time_window'
    ? `${data.timeWindow?.startTime || '?'} - ${data.timeWindow?.endTime || '?'}`
    : data.leftValue
      ? leftSourceType === 'parameter'
        ? parameters.find((p) => String(p.id) === data.leftValue)?.nama || data.leftValue
        : setPoints.find((sp) => String(sp.id) === data.leftValue)?.name || data.leftValue
      : '?'
  const opDisplay = conditionType === 'time_window' ? 'TIME' : (data.operator || '?')
  const rightDisplay = conditionType === 'time_window' 
    ? (data.timeWindow?.days && data.timeWindow.days.length > 0 ? data.timeWindow.days.join(', ') : 'Every day')
    : (data.rightValue || '?')

  return (
    <div
      className={`min-w-[260px] max-w-[300px] rounded-lg border shadow-lg transition-all duration-200 ${
        selected
          ? 'border-accent ring-2 ring-accent/30 shadow-accent/20'
          : 'border-border hover:border-accent/50'
      }`}
      style={{ background: 'hsl(220 13% 14%)' }}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!h-3 !w-3 !rounded-full !border-2 !border-accent !bg-background"
      />

      {/* Header */}
      <div
        className="flex items-center gap-2 rounded-t-lg px-3 py-2"
        style={{ 
          background: conditionType === 'time_window' 
            ? 'hsl(217 91% 60%)' // Blue color for time window
            : 'hsl(38 92% 50%)'   // Orange/yellow for comparison
        }}
      >
        {conditionType === 'time_window' ? (
          <Clock className="h-4 w-4 text-white" />
        ) : (
          <GitBranch className="h-4 w-4 text-white" />
        )}
        <span className="text-sm font-semibold text-white">
          {conditionType === 'time_window' ? 'Time Window' : 'IF Condition'}
        </span>
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
        {conditionType === 'time_window' ? (
          <>
            {/* Time Window Display */}
            <div className="space-y-2">
              <div className="rounded border border-border bg-secondary px-2 py-2">
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5" style={{ color: 'hsl(217 91% 60%)' }} />
                  <div className="flex-1">
                    <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">
                      Time Range
                    </div>
                    <div className="font-mono text-sm font-semibold text-foreground">
                      {data.timeWindow?.startTime || '08:00'} - {data.timeWindow?.endTime || '17:00'}
                    </div>
                  </div>
                </div>
              </div>
              {data.timeWindow?.days && data.timeWindow.days.length > 0 && (
                <div className="rounded border border-border bg-secondary px-2 py-2">
                  <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">
                    Days
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {data.timeWindow.days.map((day) => (
                      <span
                        key={day}
                        className="rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-medium text-primary capitalize"
                      >
                        {day}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Time Window Summary */}
            <div className="rounded border border-border bg-secondary px-2 py-1.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-semibold uppercase" style={{ color: 'hsl(217 91% 60%)' }}>
                  IF TIME
                </span>
                <span className="font-mono text-xs text-primary">{leftDisplay}</span>
                {data.timeWindow?.days && data.timeWindow.days.length > 0 && (
                  <>
                    <span className="text-xs text-muted-foreground">on</span>
                    <span className="font-mono text-xs text-primary">{rightDisplay}</span>
                  </>
                )}
              </div>
            </div>

            {/* Validation warning */}
            {hasWarning && (
              <div className="flex items-start gap-1.5 rounded border border-accent/30 bg-accent/10 px-2 py-1.5">
                <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0 text-accent" />
                <span className="text-[10px] leading-tight text-accent">
                  Start time and end time are required
                </span>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Comparison Condition Display */}
            <div className="space-y-2">
              {/* Left Source Display */}
              <div className="rounded border border-border bg-secondary px-2 py-2">
                <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">
                  Left Source ({leftSourceType})
                </div>
                <div className="text-sm font-semibold text-foreground">
                  {data.leftValue
                    ? leftSourceType === 'parameter'
                      ? parameters.find((p) => String(p.id) === data.leftValue)?.nama || data.leftValue
                      : setPoints.find((sp) => String(sp.id) === data.leftValue)?.name || data.leftValue
                    : 'Not set'}
                </div>
              </div>

              {/* Operator Display */}
              <div className="rounded border border-border bg-secondary px-2 py-2">
                <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">
                  Operator
                </div>
                <div className="text-sm font-semibold text-foreground">
                  {data.operator || '?'}
                </div>
              </div>

              {/* Right Value Display */}
              <div className="rounded border border-border bg-secondary px-2 py-2">
                <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">
                  Right Value ({data.rightValueType || 'static'})
                </div>
                <div className="text-sm font-semibold text-foreground">
                  {data.rightValueType === 'setpoint' && data.rightValue
                    ? setPoints.find((sp) => String(sp.id) === data.rightValue)?.name || data.rightValue
                    : data.rightValue || 'Not set'}
                </div>
              </div>
            </div>

            {/* IF Summary display */}
            <div className="rounded border border-border bg-secondary px-2 py-1.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-semibold uppercase text-accent">IF</span>
                <span className="font-mono text-xs text-primary">{leftDisplay}</span>
                <span className="rounded bg-accent/20 px-1.5 py-0.5 font-mono text-xs font-bold text-accent">
                  {opDisplay}
                </span>
                <span className="font-mono text-xs text-primary">{rightDisplay}</span>
              </div>
            </div>

            {/* Validation warning */}
            {hasWarning && (
              <div className="flex items-start gap-1.5 rounded border border-accent/30 bg-accent/10 px-2 py-1.5">
                <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0 text-accent" />
                <span className="text-[10px] leading-tight text-accent">
                  {!data.leftValue && !data.rightValue
                    ? 'Left and right values required'
                    : !data.leftValue
                      ? 'Left value required'
                      : 'Right value required'}
                </span>
              </div>
            )}
          </>
        )}

        {/* THEN / ELSE indicators */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full" style={{ background: 'hsl(142 71% 45%)' }} />
            <span className="text-[10px] font-medium" style={{ color: 'hsl(142 71% 45%)' }}>
              THEN
            </span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full" style={{ background: 'hsl(0 72% 51%)' }} />
            <span className="text-[10px] font-medium" style={{ color: 'hsl(0 72% 51%)' }}>
              ELSE
            </span>
          </div>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        id="then"
        className="!h-3 !w-3 !rounded-full !border-2 !bg-background"
        style={{ 
          left: '30%', 
          borderColor: conditionType === 'time_window' 
            ? 'hsl(142 71% 45%)' 
            : 'hsl(142 71% 45%)' 
        }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="else"
        className="!h-3 !w-3 !rounded-full !border-2 !bg-background"
        style={{ 
          left: '70%', 
          borderColor: conditionType === 'time_window' 
            ? 'hsl(0 72% 51%)' 
            : 'hsl(0 72% 51%)' 
        }}
      />
    </div>
  )
}

export const ConditionNode = memo(ConditionNodeComponent, (prevProps, nextProps) => {
  // Custom comparison: re-render if data changed (return false means props are different, need re-render)
  const prevData = prevProps.data
  const nextData = nextProps.data
  if (
    prevData.conditionType !== nextData.conditionType ||
    prevData.leftSourceType !== nextData.leftSourceType ||
    prevData.leftValue !== nextData.leftValue ||
    prevData.operator !== nextData.operator ||
    prevData.rightValueType !== nextData.rightValueType ||
    prevData.rightValue !== nextData.rightValue ||
    JSON.stringify(prevData.timeWindow) !== JSON.stringify(nextData.timeWindow) ||
    prevData.enabled !== nextData.enabled ||
    prevProps.selected !== nextProps.selected
  ) {
    return false // Props are different, need re-render
  }
  return true // Props are same, skip re-render
})
