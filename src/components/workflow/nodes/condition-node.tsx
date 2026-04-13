import { memo } from 'react'
import { Handle, Position, type NodeProps } from 'reactflow'
import { GitBranch, AlertTriangle, Clock, Activity } from 'lucide-react'
import type { ConditionNodeData } from '@/types/workflow-builder'
import type { Parameter } from '@/types/parameter'
import type { SetPoint } from '@/services/setPointService'

interface ConditionNodeComponentProps extends NodeProps {
  data: ConditionNodeData
  parameters?: Parameter[]
  setPoints?: SetPoint[]
}

function ConditionNodeComponent({
  data,
  selected,
  parameters = [],
  setPoints = [],
}: ConditionNodeComponentProps) {
  const conditionType = data.conditionType || 'comparison'
  const leftSourceType = data.leftSourceType || 'parameter'
  const isTimeWindow = conditionType === 'time_window'
  const isParameterStatus = conditionType === 'parameter_status'

  const hasWarning = isParameterStatus
    ? (!data.statusSourceId || !data.statusValue)
    : isTimeWindow
      ? (!data.timeWindow?.startTime || !data.timeWindow?.endTime)
      : (!data.leftValue || !data.rightValue)

  const leftDisplay = isTimeWindow
    ? `${data.timeWindow?.startTime || '?'} - ${data.timeWindow?.endTime || '?'}`
    : isParameterStatus
      ? parameters.find((p) => p.id === data.statusSourceId)?.nama || '?'
      : data.leftValue
        ? leftSourceType === 'parameter'
          ? parameters.find((p) => String(p.id) === data.leftValue)?.nama || data.leftValue
          : setPoints.find((sp) => String(sp.id) === data.leftValue)?.name || data.leftValue
        : '?'

  const opDisplay = isTimeWindow ? 'TIME' : isParameterStatus ? 'STATUS' : (data.operator || '?')

  const rightDisplay = isTimeWindow
    ? (data.timeWindow?.days && data.timeWindow.days.length > 0 ? data.timeWindow.days.join(', ') : 'Every day')
    : isParameterStatus
      ? (data.statusValue || '?')
      : (data.rightValue || '?')

  const conditionColor = 'hsl(38 92% 50%)'
  const borderColor = conditionColor

  return (
    <div
      className={`min-w-[260px] max-w-[300px] rounded-lg border shadow-lg transition-all duration-200 ${
        selected ? 'ring-2 ring-offset-1 ring-offset-background' : 'hover:shadow-xl'
      }`}
      style={{
        background: 'hsl(220 13% 14%)',
        borderColor: selected ? borderColor : 'hsl(220 12% 22%)',
        ...(selected ? { boxShadow: `0 0 20px ${borderColor}33` } : {}),
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!h-3 !w-3 !rounded-full !border-2 !bg-background"
        style={{ borderColor }}
      />

      <div className="flex items-center gap-2 rounded-t-lg px-3 py-2" style={{ background: conditionColor }}>
        {isTimeWindow ? (
          <Clock className="h-4 w-4 text-white" />
        ) : isParameterStatus ? (
          <Activity className="h-4 w-4 text-white" />
        ) : (
          <GitBranch className="h-4 w-4 text-white" />
        )}
        <span className="text-sm font-semibold text-white">
          {isTimeWindow ? 'Time Window' : isParameterStatus ? 'Parameter Status' : 'IF Condition'}
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

      <div className="space-y-2.5 px-3 py-3">
        {isTimeWindow ? (
          <>
            <div className="space-y-2">
              <div className="rounded border border-border bg-secondary px-2 py-2">
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5" style={{ color: 'hsl(217 91% 60%)' }} />
                  <div className="flex-1">
                    <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
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
                  <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
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
            {hasWarning && (
              <div className="flex items-start gap-1.5 rounded border border-accent/30 bg-accent/10 px-2 py-1.5">
                <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0 text-accent" />
                <span className="text-[10px] leading-tight text-accent">
                  Start time and end time are required
                </span>
              </div>
            )}
          </>
        ) : isParameterStatus ? (
          <>
            <div className="space-y-2">
              <div className="rounded border border-border bg-secondary px-2 py-2">
                <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Parameter
                </div>
                <div className="text-sm font-semibold text-foreground">
                  {parameters.find((p) => p.id === data.statusSourceId)?.nama || 'Not set'}
                </div>
              </div>
              <div className="rounded border border-border bg-secondary px-2 py-2">
                <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Expected Status
                </div>
                <div className="text-sm font-semibold text-foreground">
                  {(data.statusValue || 'Not set').toUpperCase()}
                </div>
              </div>
            </div>
            <div className="rounded border border-border bg-secondary px-2 py-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-semibold uppercase" style={{ color: 'hsl(217 91% 60%)' }}>
                  IF
                </span>
                <span className="font-mono text-xs text-primary">{leftDisplay}</span>
                <span
                  className="rounded px-1.5 py-0.5 font-mono text-xs font-bold"
                  style={{ color: 'hsl(217 91% 60%)', background: 'hsl(217 91% 60% / 0.2)' }}
                >
                  {opDisplay}
                </span>
                <span className="font-mono text-xs text-primary">{String(rightDisplay).toUpperCase()}</span>
              </div>
            </div>
            {hasWarning && (
              <div className="flex items-start gap-1.5 rounded border border-accent/30 bg-accent/10 px-2 py-1.5">
                <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0 text-accent" />
                <span className="text-[10px] leading-tight text-accent">
                  Parameter dan status wajib diisi
                </span>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="space-y-2">
              <div className="rounded border border-border bg-secondary px-2 py-2">
                <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
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
              <div className="rounded border border-border bg-secondary px-2 py-2">
                <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Operator
                </div>
                <div className="text-sm font-semibold text-foreground">
                  {data.operator || '?'}
                </div>
              </div>
              <div className="rounded border border-border bg-secondary px-2 py-2">
                <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Right Value ({data.rightValueType || 'static'})
                </div>
                <div className="text-sm font-semibold text-foreground">
                  {data.rightValueType === 'setpoint' && data.rightValue
                    ? setPoints.find((sp) => String(sp.id) === data.rightValue)?.name || data.rightValue
                    : data.rightValue || 'Not set'}
                </div>
              </div>
            </div>
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
        style={{ left: '30%', borderColor: 'hsl(142 71% 45%)' }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="else"
        className="!h-3 !w-3 !rounded-full !border-2 !bg-background"
        style={{ left: '70%', borderColor: 'hsl(0 72% 51%)' }}
      />
    </div>
  )
}

export const ConditionNode = memo(ConditionNodeComponent, (prevProps, nextProps) => {
  const prevData = prevProps.data
  const nextData = nextProps.data
  if (
    prevData.conditionType !== nextData.conditionType ||
    prevData.leftSourceType !== nextData.leftSourceType ||
    prevData.leftValue !== nextData.leftValue ||
    prevData.operator !== nextData.operator ||
    prevData.rightValueType !== nextData.rightValueType ||
    prevData.rightValue !== nextData.rightValue ||
    prevData.statusSourceId !== nextData.statusSourceId ||
    prevData.statusValue !== nextData.statusValue ||
    JSON.stringify(prevData.timeWindow) !== JSON.stringify(nextData.timeWindow) ||
    prevData.enabled !== nextData.enabled ||
    prevProps.selected !== nextProps.selected
  ) {
    return false
  }
  return true
})
