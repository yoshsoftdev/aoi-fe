import { memo, useCallback } from 'react'
import { Handle, Position, type NodeProps, useReactFlow } from 'reactflow'
import { GitBranch, AlertTriangle } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import type { ConditionNodeData, LeftSourceType, RightValueType } from '@/types/workflow-builder'
import type { Parameter } from '@/types/parameter'
import type { SetPoint } from '@/services/setPointService'

const OPERATORS = ['>', '<', '>=', '<=', '==', '!='] as const

interface ConditionNodeComponentProps extends NodeProps {
  data: ConditionNodeData
  parameters?: Parameter[]
  setPoints?: SetPoint[]
}

function ConditionNodeComponent({ id, data, selected, parameters = [], setPoints = [] }: ConditionNodeComponentProps) {
  const { setNodes } = useReactFlow()

  const leftSourceType = data.leftSourceType || 'parameter'
  const rightValueType = data.rightValueType || 'static'

  const leftItems = leftSourceType === 'parameter' ? parameters : setPoints
  const rightItems = setPoints

  const hasWarning = !data.leftValue || !data.rightValue

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

  const handleLeftSourceTypeChange = useCallback(
    (val: string) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === id) {
            const sourceId = val === 'parameter'
              ? parameters.find((p) => String(p.id) === node.data.leftValue)?.id
              : setPoints.find((sp) => String(sp.id) === node.data.leftValue)?.id

            return {
              ...node,
              data: {
                ...node.data,
                leftSourceType: val as LeftSourceType,
                leftValue: '',
                leftSourceId: sourceId,
              },
            }
          }
          return node
        })
      )
    },
    [id, parameters, setPoints, setNodes]
  )

  const handleLeftValueChange = useCallback(
    (val: string) => {
      // Use current data.leftSourceType instead of closure value
      const currentLeftSourceType = data.leftSourceType || 'parameter'
      const sourceId = currentLeftSourceType === 'parameter'
        ? parameters.find((p) => String(p.id) === val)?.id
        : setPoints.find((sp) => String(sp.id) === val)?.id

      // Update both values in a single state update to avoid race condition
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === id) {
            return {
              ...node,
              data: {
                ...node.data,
                leftValue: val,
                leftSourceId: sourceId,
              },
            }
          }
          return node
        })
      )
    },
    [id, data.leftSourceType, parameters, setPoints, setNodes]
  )

  const handleRightValueTypeChange = useCallback(
    (val: string) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === id) {
            const sourceId = val === 'setpoint'
              ? setPoints.find((sp) => String(sp.id) === node.data.rightValue)?.id
              : undefined

            return {
              ...node,
              data: {
                ...node.data,
                rightValueType: val as RightValueType,
                rightValue: '',
                rightSourceId: sourceId,
              },
            }
          }
          return node
        })
      )
    },
    [id, setPoints, setNodes]
  )

  const handleRightValueChange = useCallback(
    (val: string) => {
      // Use current data.rightValueType instead of closure value
      const currentRightValueType = data.rightValueType || 'static'
      if (currentRightValueType === 'setpoint') {
        const sourceId = setPoints.find((sp) => String(sp.id) === val)?.id
        // Update both values in a single state update
        setNodes((nds) =>
          nds.map((node) => {
            if (node.id === id) {
              return {
                ...node,
                data: {
                  ...node.data,
                  rightValue: val,
                  rightSourceId: sourceId,
                },
              }
            }
            return node
          })
        )
      } else {
        handleChange('rightValue', val)
      }
    },
    [id, data.rightValueType, setPoints, setNodes, handleChange]
  )

  // Build display string for the IF summary
  const leftDisplay = data.leftValue
    ? leftSourceType === 'parameter'
      ? parameters.find((p) => String(p.id) === data.leftValue)?.nama || data.leftValue
      : setPoints.find((sp) => String(sp.id) === data.leftValue)?.name || data.leftValue
    : '?'
  const opDisplay = data.operator || '?'
  const rightDisplay = data.rightValue || '?'

  return (
    <div
      className={`min-w-[260px] max-w-[300px] rounded-lg border shadow-lg transition-all duration-200 ${
        selected
          ? 'border-accent ring-2 ring-accent/30 shadow-accent/20'
          : 'border-border hover:border-accent/50'
      }`}
      style={{ background: 'hsl(220 13% 14%)' }}
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
        className="!h-3 !w-3 !rounded-full !border-2 !border-accent !bg-background"
      />

      {/* Header */}
      <div
        className="flex items-center gap-2 rounded-t-lg px-3 py-2"
        style={{ background: 'hsl(38 92% 50%)' }}
      >
        <GitBranch className="h-4 w-4 text-white" />
        <span className="text-sm font-semibold text-white">IF Condition</span>
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
        {/* Left Source */}
        <div className="space-y-1">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Left Source
          </span>
          <Select value={leftSourceType} onValueChange={handleLeftSourceTypeChange}>
            <SelectTrigger 
              className="h-7 border-border bg-secondary text-xs text-foreground"
              onClick={(e) => e.stopPropagation()}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent 
              onPointerDownOutside={(e) => e.preventDefault()}
            >
              <SelectItem value="parameter">Parameter</SelectItem>
              <SelectItem value="setpoint">Set-Point</SelectItem>
            </SelectContent>
          </Select>
          <Select value={data.leftValue || ''} onValueChange={handleLeftValueChange}>
            <SelectTrigger 
              className="h-7 border-border bg-secondary text-xs text-foreground"
              onClick={(e) => e.stopPropagation()}
            >
              <SelectValue placeholder={`Select ${leftSourceType}...`} />
            </SelectTrigger>
            <SelectContent 
              onPointerDownOutside={(e) => e.preventDefault()}
            >
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
        <div className="space-y-1">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Operator
          </span>
          <Select value={data.operator || '>'} onValueChange={(val) => handleChange('operator', val)}>
            <SelectTrigger 
              className="h-7 border-border bg-secondary text-xs text-foreground"
              onClick={(e) => e.stopPropagation()}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent 
              onPointerDownOutside={(e) => e.preventDefault()}
            >
              {OPERATORS.map((op) => (
                <SelectItem key={op} value={op}>
                  {op}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Right Value */}
        <div className="space-y-1">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Right Value
          </span>
          <Select value={rightValueType} onValueChange={handleRightValueTypeChange}>
            <SelectTrigger 
              className="h-7 border-border bg-secondary text-xs text-foreground"
              onClick={(e) => e.stopPropagation()}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent 
              onPointerDownOutside={(e) => e.preventDefault()}
            >
              <SelectItem value="static">Static Value</SelectItem>
              <SelectItem value="setpoint">Set-Point</SelectItem>
            </SelectContent>
          </Select>
          {rightValueType === 'static' ? (
            <Input
              type="number"
              value={data.rightValue || ''}
              onChange={(e) => handleRightValueChange(e.target.value)}
              placeholder="Enter value..."
              className="h-7 border-border bg-secondary text-xs text-foreground"
            />
          ) : (
            <Select value={data.rightValue || ''} onValueChange={handleRightValueChange}>
              <SelectTrigger 
                className="h-7 border-border bg-secondary text-xs text-foreground"
                onClick={(e) => e.stopPropagation()}
              >
                <SelectValue placeholder="Select set-point..." />
              </SelectTrigger>
              <SelectContent 
                onPointerDownOutside={(e) => e.preventDefault()}
              >
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

export const ConditionNode = memo(ConditionNodeComponent)
