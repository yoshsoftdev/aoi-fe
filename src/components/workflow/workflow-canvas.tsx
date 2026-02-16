import { useCallback, useRef, useMemo } from 'react'
import {
  ReactFlow,
  Controls,
  Background,
  BackgroundVariant,
  type Node,
  type Edge,
  type Connection,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type ReactFlowInstance,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { TriggerNode } from './nodes/trigger-node'
import { ConditionNode } from './nodes/condition-node'
import { ActionNode } from './nodes/action-node'
import type { Parameter } from '@/types/parameter'
import type { SetPoint } from '@/services/setPointService'

interface WorkflowCanvasProps {
  nodes: Node[]
  edges: Edge[]
  onNodesChange: OnNodesChange
  onEdgesChange: OnEdgesChange
  onConnect: OnConnect
  onNodeClick: (event: React.MouseEvent, node: Node) => void
  onPaneClick: () => void
  onDrop: (type: string, subType: string, label: string, description: string, position: { x: number; y: number }) => void
  reactFlowInstance: ReactFlowInstance | null
  setReactFlowInstance: (instance: ReactFlowInstance) => void
  parameters?: Parameter[]
  setPoints?: SetPoint[]
}

export function WorkflowCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeClick,
  onPaneClick,
  onDrop,
  reactFlowInstance,
  setReactFlowInstance,
  parameters = [],
  setPoints = [],
}: WorkflowCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null)

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()

      const type = event.dataTransfer.getData('application/reactflow-type')
      const subType = event.dataTransfer.getData('application/reactflow-subtype')
      const label = event.dataTransfer.getData('application/reactflow-label')
      const description = event.dataTransfer.getData('application/reactflow-description')

      if (!type || !reactFlowInstance) return

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })

      onDrop(type, subType, label, description, position)
    },
    [reactFlowInstance, onDrop]
  )

  // Memoize nodeTypes to prevent React Flow warning
  // Pass parameters and setPoints to nodes via props
  const nodeTypesWithProps = useMemo(() => ({
    trigger: (props: any) => <TriggerNode {...props} parameters={parameters} setPoints={setPoints} />,
    condition: (props: any) => <ConditionNode {...props} parameters={parameters} setPoints={setPoints} />,
    action: (props: any) => <ActionNode {...props} parameters={parameters} setPoints={setPoints} />,
  }), [parameters, setPoints])

  return (
    <div ref={reactFlowWrapper} className="flex-1">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onInit={setReactFlowInstance}
        nodeTypes={nodeTypesWithProps}
        fitView
        defaultEdgeOptions={{
          style: { stroke: 'hsl(220 12% 30%)', strokeWidth: 2 },
          type: 'smoothstep',
        }}
        proOptions={{ hideAttribution: true }}
        className="bg-background"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="hsl(220 12% 22%)"
        />
        <Controls
          className="!rounded-lg !border !border-border !bg-card !shadow-lg [&_button]:!border-border [&_button]:!bg-card [&_button]:!text-foreground [&_button:hover]:!bg-secondary"
        />
      </ReactFlow>
    </div>
  )
}
