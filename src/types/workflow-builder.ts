// Types for React Flow workflow builder
import type { Node, Edge } from 'reactflow'

export type TriggerType = 'parameter-changed' | 'setpoint-changed'

export type TriggerNodeData = {
  label: string
  description: string
  triggerType: TriggerType
  parameter?: string
  setpoint?: string
  enabled: boolean
  // Backend mapping
  source_id?: number // parameter_id or setpoint_id
}

export type LeftSourceType = 'parameter' | 'setpoint'
export type RightValueType = 'static' | 'setpoint'

export type ConditionNodeData = {
  label: string
  description: string
  conditionType?: 'comparison' | 'time_window' // Default: 'comparison'
  // For comparison condition
  leftSourceType?: LeftSourceType
  leftValue?: string
  leftSourceId?: number // parameter_id or setpoint_id
  operator?: '>' | '<' | '>=' | '<=' | '==' | '!='
  rightValueType?: RightValueType
  rightValue?: string
  rightSourceId?: number // setpoint_id (if rightValueType is setpoint)
  // For time window condition
  timeWindow?: {
    startTime: string // Format: "HH:MM" (e.g., "08:00")
    endTime: string   // Format: "HH:MM" (e.g., "17:00")
    days?: string[]   // Optional: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
  }
  enabled: boolean
}

export type ActionType = 'alarm-notification' | 'write-dynamic' | 'trigger-preset'

export type ActionNodeData = {
  label: string
  description: string
  actionType: ActionType
  enabled: boolean
  // Alarm Notification fields
  alarmTitle?: string
  alarmSeverity?: 'info' | 'warning' | 'critical'
  alarmMessage?: string
  // Write Dynamic Value fields
  targetType?: 'parameter' | 'setpoint'
  targetParameter?: string
  targetSetPoint?: string
  targetId?: number // parameter_id or setpoint_id (depends on targetType)
  targetSetPointId?: number // setpoint_id
  valueSource?: 'static' | 'setpoint'
  staticValue?: string
  sourceSetpoint?: string
  sourceSetpointId?: number // setpoint_id
  // Trigger Preset fields
  presetName?: string
  presetId?: number // parameter_id with PRESET mode
}

export type TimerUnit = 'seconds' | 'minutes' | 'hours'

export type TimerNodeData = {
  label: string
  description: string
  duration: number
  unit: TimerUnit
  enabled: boolean
}

export type TriggerNode = Node<TriggerNodeData, 'trigger'>
export type ConditionNode = Node<ConditionNodeData, 'condition'>
export type ActionNode = Node<ActionNodeData, 'action'>
export type TimerNode = Node<TimerNodeData, 'timer'>

export type WorkflowNode = TriggerNode | ConditionNode | ActionNode | TimerNode

export type NodePaletteItem = {
  type: 'trigger' | 'condition' | 'action' | 'timer'
  subType: string
  label: string
  description: string
  icon: string
}
