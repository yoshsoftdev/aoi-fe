import React, { useCallback, useMemo, useState } from 'react'
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  NodeTypes,
  Handle,
  Position,
  ReactFlowProvider,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2, AlertCircle } from 'lucide-react'
import type { WorkflowCondition, WorkflowAction } from '@/services/workflowService'
import type { Parameter } from '@/types/parameter'

interface WorkflowNodeEditorProps {
  conditions: Omit<WorkflowCondition, 'id' | 'workflow_id' | 'created_at' | 'parameter'>[]
  actions: Omit<WorkflowAction, 'id' | 'workflow_id' | 'created_at' | 'parameter'>[]
  parameters: Parameter[]
  onConditionsChange: (conditions: Omit<WorkflowCondition, 'id' | 'workflow_id' | 'created_at' | 'parameter'>[]) => void
  onActionsChange: (actions: Omit<WorkflowAction, 'id' | 'workflow_id' | 'created_at' | 'parameter'>[]) => void
}

// Custom Node Types
const TriggerNode = ({ data }: { data: any }) => {
  return (
    <Card className="px-4 py-3 min-w-[200px] bg-blue-50 border-blue-200">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="bg-blue-100 text-blue-800">
          TRIGGER
        </Badge>
      </div>
      <Handle type="source" position={Position.Bottom} />
    </Card>
  )
}

const ConditionNode = ({ data }: { data: any }) => {
  return (
    <Card className="px-4 py-3 min-w-[200px] bg-green-50 border-green-200">
      <div className="space-y-1">
        <Badge variant="outline" className="bg-green-100 text-green-800">
          IF
        </Badge>
        <div className="text-sm font-medium">{data.label || 'Condition'}</div>
      </div>
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
    </Card>
  )
}

const ActionNode = ({ data }: { data: any }) => {
  return (
    <Card className="px-4 py-3 min-w-[200px] bg-purple-50 border-purple-200">
      <div className="space-y-1">
        <Badge variant="outline" className="bg-purple-100 text-purple-800">
          THEN
        </Badge>
        <div className="text-sm font-medium">{data.label || 'Action'}</div>
      </div>
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
    </Card>
  )
}

const nodeTypes: NodeTypes = {
  trigger: TriggerNode,
  condition: ConditionNode,
  action: ActionNode,
}

// Helper function to detect nested IF structure from flat conditions/actions
function detectNestedStructure(
  conditions: Omit<WorkflowCondition, 'id' | 'workflow_id' | 'created_at' | 'parameter'>[],
  actions: Omit<WorkflowAction, 'id' | 'workflow_id' | 'created_at' | 'parameter'>[]
): { hasNested: boolean; depth: number } {
  // Simple heuristic: if we have multiple conditions and actions, might be nested
  // For now, we'll use a simple check: if actions contain WRITE_INTERNAL, it's part of chaining
  const hasInternalWrite = actions.some(a => a.action_type === 'WRITE_INTERNAL')
  
  // If we have more than 1 condition and more than 1 action, might be nested
  // But we need to check if user actually wants nested IF
  // For MVP, we'll assume user wants nested IF if they have multiple conditions/actions
  // and at least one action writes to internal parameter
  
  return {
    hasNested: hasInternalWrite || (conditions.length > 1 && actions.length > 1),
    depth: hasInternalWrite ? 2 : (conditions.length > 1 && actions.length > 1 ? 1 : 0),
  }
}

// Convert flat conditions/actions to React Flow nodes and edges
function convertToNodesAndEdges(
  conditions: Omit<WorkflowCondition, 'id' | 'workflow_id' | 'created_at' | 'parameter'>[],
  actions: Omit<WorkflowAction, 'id' | 'workflow_id' | 'created_at' | 'parameter'>[],
  parameters: Parameter[]
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = []
  const edges: Edge[] = []

  // Start with trigger node
  nodes.push({
    id: 'trigger',
    type: 'trigger',
    position: { x: 250, y: 50 },
    data: { label: 'Start' },
  })

  let yOffset = 150

  // Add condition nodes
  conditions.forEach((condition, index) => {
    const param = parameters.find(p => p.id === condition.parameter_id)
    const label = param
      ? `${param.nama} ${condition.operator} ${condition.threshold}`
      : `Condition ${index + 1}`

    nodes.push({
      id: `condition-${index}`,
      type: 'condition',
      position: { x: 250, y: yOffset },
      data: { label, condition },
    })

    // Connect trigger to first condition, or previous condition to this one
    if (index === 0) {
      edges.push({
        id: `trigger-condition-${index}`,
        source: 'trigger',
        target: `condition-${index}`,
      })
    } else {
      edges.push({
        id: `condition-${index - 1}-condition-${index}`,
        source: `condition-${index - 1}`,
        target: `condition-${index}`,
      })
    }

    yOffset += 120
  })

  // Add action nodes
  actions.forEach((action, index) => {
    let label = `Action ${index + 1}`
    if (action.action_type === 'WRITE_WITH_VALUE' && action.parameter_id) {
      const param = parameters.find(p => p.id === action.parameter_id)
      label = param ? `Write ${param.nama} = ${action.value}` : label
    } else if (action.action_type === 'WRITE_INTERNAL' && action.parameter_id) {
      const param = parameters.find(p => p.id === action.parameter_id)
      label = param ? `Set ${param.nama} = ${action.value}` : label
    } else if (action.action_type === 'TRIGGER_WRITE' && action.parameter_id) {
      const param = parameters.find(p => p.id === action.parameter_id)
      label = param ? `Trigger ${param.nama}` : label
    } else if (action.action_type === 'alarm' && action.alarm_message) {
      label = `Alarm: ${action.alarm_message.substring(0, 30)}...`
    }

    nodes.push({
      id: `action-${index}`,
      type: 'action',
      position: { x: 250, y: yOffset },
      data: { label, action },
    })

    // Connect last condition to first action, or previous action to this one
    if (index === 0 && conditions.length > 0) {
      edges.push({
        id: `condition-${conditions.length - 1}-action-${index}`,
        source: `condition-${conditions.length - 1}`,
        target: `action-${index}`,
      })
    } else if (index > 0) {
      edges.push({
        id: `action-${index - 1}-action-${index}`,
        source: `action-${index - 1}`,
        target: `action-${index}`,
      })
    }

    yOffset += 120
  })

  return { nodes, edges }
}

export function WorkflowNodeEditor({
  conditions,
  actions,
  parameters,
  onConditionsChange,
  onActionsChange,
}: WorkflowNodeEditorProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [validationError, setValidationError] = useState<string | null>(null)

  // Convert conditions/actions to nodes/edges when they change
  React.useEffect(() => {
    const { nodes: newNodes, edges: newEdges } = convertToNodesAndEdges(conditions, actions, parameters)
    setNodes(newNodes)
    setEdges(newEdges)
  }, [conditions, actions, parameters, setNodes, setEdges])

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  )

  // Validate: must have at least one condition and one action
  React.useEffect(() => {
    if (conditions.length === 0) {
      setValidationError('Minimal harus ada 1 kondisi (IF)')
    } else if (actions.length === 0) {
      setValidationError('Minimal harus ada 1 aksi (THEN)')
    } else {
      setValidationError(null)
    }
  }, [conditions.length, actions.length])

  return (
    <div className="w-full h-[600px] border rounded-lg">
      {validationError && (
        <div className="p-3 bg-yellow-50 border-b border-yellow-200 flex items-center gap-2 text-sm text-yellow-800">
          <AlertCircle className="h-4 w-4" />
          {validationError}
        </div>
      )}
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  )
}
