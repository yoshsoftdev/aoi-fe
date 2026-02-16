import { memo, useCallback } from 'react'
import { Handle, Position, type NodeProps, useReactFlow } from 'reactflow'
import { Activity, Target, AlertTriangle } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { TriggerNodeData, TriggerType } from '@/types/workflow-builder'
import type { Parameter } from '@/types/parameter'
import type { SetPoint } from '@/services/setPointService'

interface TriggerNodeComponentProps extends NodeProps {
  data: TriggerNodeData
  parameters?: Parameter[]
  setPoints?: SetPoint[]
}

function TriggerNodeComponent({ id, data, selected, parameters = [], setPoints = [] }: TriggerNodeComponentProps) {
  const { setNodes } = useReactFlow()
  const Icon = data.triggerType === 'parameter-changed' ? Activity : Target

  const isParameterTrigger = data.triggerType === 'parameter-changed'
  const selectedSource = isParameterTrigger ? data.parameter : data.setpoint
  const hasWarning = !selectedSource

  const handleTriggerTypeChange = useCallback(
    (val: string) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === id) {
            return {
              ...node,
              data: {
                ...node.data,
                triggerType: val as TriggerType,
                label: val === 'parameter-changed' ? 'Parameter Changed' : 'Set-Point Changed',
                description:
                  val === 'parameter-changed'
                    ? 'Fires when a parameter value changes'
                    : 'Fires when a set-point is modified',
                parameter: '',
                setpoint: '',
                source_id: undefined,
              },
            }
          }
          return node
        })
      )
    },
    [id, setNodes]
  )

  const handleSourceChange = useCallback(
    (val: string) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === id) {
            const sourceId = isParameterTrigger
              ? parameters.find((p) => String(p.id) === val)?.id
              : setPoints.find((sp) => String(sp.id) === val)?.id

            return {
              ...node,
              data: {
                ...node.data,
                ...(isParameterTrigger ? { parameter: val } : { setpoint: val }),
                source_id: sourceId,
              },
            }
          }
          return node
        })
      )
    },
    [id, isParameterTrigger, parameters, setPoints, setNodes]
  )

  const sourceOptions = isParameterTrigger ? parameters : setPoints

  return (
    <div
      className={`min-w-[240px] max-w-[280px] rounded-lg border shadow-lg transition-all duration-200 ${
        selected
          ? 'border-primary ring-2 ring-primary/30 shadow-primary/20'
          : 'border-border hover:border-primary/50'
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
        {/* Trigger type selector */}
        <div className="space-y-1">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Trigger Type
          </span>
          <Select value={data.triggerType} onValueChange={handleTriggerTypeChange}>
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
              <SelectItem value="parameter-changed">
                <span className="flex items-center gap-2">
                  <Activity className="h-3 w-3" />
                  Parameter Changed
                </span>
              </SelectItem>
              <SelectItem value="setpoint-changed">
                <span className="flex items-center gap-2">
                  <Target className="h-3 w-3" />
                  Set-Point Changed
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Contextual source selector */}
        <div className="space-y-1">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {isParameterTrigger ? 'Parameter' : 'Set-Point'}
          </span>
          <Select value={selectedSource || ''} onValueChange={handleSourceChange}>
            <SelectTrigger 
              className="h-8 border-border bg-secondary text-xs text-foreground"
              onClick={(e) => e.stopPropagation()}
            >
              <SelectValue placeholder={`Select ${isParameterTrigger ? 'parameter' : 'set-point'}...`} />
            </SelectTrigger>
            <SelectContent 
              onPointerDownOutside={(e) => e.preventDefault()}
              onInteractOutside={(e) => e.preventDefault()}
            >
              {sourceOptions.length === 0 ? (
                <div className="px-2 py-1.5 text-sm text-muted-foreground">
                  No {isParameterTrigger ? 'parameters' : 'set-points'} available
                </div>
              ) : (
                sourceOptions.map((item) => (
                  <SelectItem key={item.id} value={String(item.id)}>
                    {isParameterTrigger ? (item as Parameter).nama : (item as SetPoint).name}
                    {isParameterTrigger && (item as Parameter).unit && ` (${(item as Parameter).unit})`}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
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

export const TriggerNode = memo(TriggerNodeComponent)
