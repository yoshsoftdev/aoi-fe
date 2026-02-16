import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import {
  useNodesState,
  useEdgesState,
  addEdge,
  type Node,
  type Edge,
  type Connection,
  type ReactFlowInstance,
  ReactFlowProvider,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { useQuery } from '@tanstack/react-query'
import { parameterService } from '@/services/parameterService'
import { setPointService } from '@/services/setPointService'
import { workflowService, type Workflow } from '@/services/workflowService'
import { TriggerNode } from './nodes/trigger-node'
import { ConditionNode } from './nodes/condition-node'
import { ActionNode } from './nodes/action-node'
import { WorkflowCanvas } from './workflow-canvas'
import { NodePalette } from './node-palette'
import { PropertiesPanel } from './properties-panel'
import { TopBar } from './top-bar'
import { validateWorkflowGraph, convertNodesToTree, convertTreeToNodes } from '@/utils/workflowTreeConverter'
import type { WorkflowTree } from '@/services/workflowService'

interface WorkflowBuilderProps {
  workflow?: Workflow | null
  onCancel: () => void
  onSuccess: () => void
}

function WorkflowBuilderInner({ workflow, onCancel, onSuccess }: WorkflowBuilderProps) {
  const nodeIdCounterRef = useRef(0)
  const getId = useCallback(() => {
    const id = `node_${nodeIdCounterRef.current}`
    nodeIdCounterRef.current += 1
    return id
  }, [])

  const [nodes, setNodes, onNodesChange] = useNodesState<Node[]>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge[]>([])
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [workflowName, setWorkflowName] = useState(workflow?.nama || 'New Workflow')
  const [workflowDescription, setWorkflowDescription] = useState(workflow?.description || '')
  const [workflowEnabled, setWorkflowEnabled] = useState(workflow?.enabled ?? true)
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null)

  // Fetch parameters and set-points
  const { data: parameters = [] } = useQuery({
    queryKey: ['parameters'],
    queryFn: () => parameterService.getAll(),
  })

  const { data: setPoints = [] } = useQuery({
    queryKey: ['set-points'],
    queryFn: () => setPointService.getAll(),
  })

  // Filter parameters for different use cases
  const cleanParameters = useMemo(
    () => parameters.filter((p) => ['DIRECT', 'CLEAN', 'FORMULA'].includes(p.parameter_mode || '')),
    [parameters]
  )

  const writeParameters = useMemo(
    () => parameters.filter((p) => p.direction === 'WRITE' || p.read_write === 1 || p.read_write === 2),
    [parameters]
  )

  const presetParameters = useMemo(
    () => parameters.filter((p) => p.direction === 'WRITE' && p.write_mode === 'PRESET'),
    [parameters]
  )

  // Validation errors
  const validationErrors = useMemo(() => {
    return validateWorkflowGraph(nodes, edges)
  }, [nodes, edges])

  // Load workflow data if editing
  useEffect(() => {
    // Only load if workflow ID changes (prevent reloading on every render)
    if (workflow && workflow.version === 2 && workflow.tree_data) {
      try {
        // tree_data should already be parsed by workflowService
        const treeData = workflow.tree_data as WorkflowTree

        const { nodes: treeNodes, edges: treeEdges } = convertTreeToNodes(treeData)
        
        // Clear existing nodes/edges first to prevent duplicates
        setNodes([])
        setEdges([])
        
        // Set new nodes and edges
        setNodes(treeNodes)
        setEdges(treeEdges)
        
        // Extract max node ID from loaded nodes to set counter
        const maxId = treeNodes.reduce((max, node) => {
          const match = node.id.match(/node_(\d+)/)
          if (match) {
            const idNum = parseInt(match[1], 10)
            return Math.max(max, idNum)
          }
          return max
        }, -1)
        nodeIdCounterRef.current = maxId + 1 // Set counter to next available ID
      } catch (error) {
        console.error('Failed to load workflow tree:', error)
        console.error('Workflow tree_data:', workflow.tree_data)
      }
    } else if (workflow && (!workflow.version || workflow.version === 1)) {
      // Clear nodes/edges for version 1 workflows (use old form)
      setNodes([])
      setEdges([])
    } else if (!workflow) {
      // Clear nodes/edges when no workflow (creating new)
      setNodes([])
      setEdges([])
    }
  }, [workflow?.id, workflow?.version, setNodes, setEdges]) // Removed workflow?.tree_data from deps to prevent reload on every change

  const onConnect = useCallback(
    (params: Connection) => {
      const sourceNode = nodes.find((n) => n.id === params.source)
      let edgeStyle = { stroke: 'hsl(220 12% 30%)', strokeWidth: 2 }
      let label = undefined as string | undefined
      let labelStyle = undefined as Record<string, unknown> | undefined
      let labelBgStyle = undefined as Record<string, unknown> | undefined

      if (sourceNode?.type === 'condition') {
        if (params.sourceHandle === 'then') {
          edgeStyle = { stroke: 'hsl(142 71% 45%)', strokeWidth: 2 }
          label = 'THEN'
          labelStyle = { fill: 'hsl(142 71% 45%)', fontWeight: 600, fontSize: 10 }
          labelBgStyle = { fill: 'hsl(220 14% 10%)', fillOpacity: 0.8 }
        } else if (params.sourceHandle === 'else') {
          edgeStyle = { stroke: 'hsl(0 72% 51%)', strokeWidth: 2 }
          label = 'ELSE'
          labelStyle = { fill: 'hsl(0 72% 51%)', fontWeight: 600, fontSize: 10 }
          labelBgStyle = { fill: 'hsl(220 14% 10%)', fillOpacity: 0.8 }
        }
      }

      setEdges((eds) =>
        addEdge(
          {
            ...params,
            type: 'smoothstep',
            style: edgeStyle,
            label,
            labelStyle,
            labelBgStyle,
          },
          eds
        )
      )
    },
    [nodes, setEdges]
  )

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    // Only set selected node if click is not on an interactive element inside the node
    const target = event.target as HTMLElement
    // Check if click is on Select trigger, content, or option
    const isSelectElement = target.closest(
      '[role="combobox"], [role="listbox"], [role="option"], [data-radix-select-trigger], [data-radix-select-content], [data-radix-select-item]'
    )
    if (isSelectElement) {
      return
    }
    setSelectedNode(node)
  }, [])

  const onPaneClick = useCallback(() => {
    setSelectedNode(null)
  }, [])

  const onNodeChange = useCallback(
    (id: string, data: Record<string, unknown>) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === id) {
            return { ...node, data }
          }
          return node
        })
      )
      setSelectedNode((prev) => (prev && prev.id === id ? { ...prev, data } : prev))
    },
    [setNodes]
  )

  const onDrop = useCallback(
    (
      type: string,
      subType: string,
      label: string,
      description: string,
      position: { x: number; y: number }
    ) => {
      const id = getId()
      let data: Record<string, unknown> = {}

      switch (type) {
        case 'trigger':
          data = {
            label,
            description,
            triggerType: subType,
            parameter: '',
            setpoint: '',
            enabled: true,
          }
          break
        case 'condition':
          data = {
            label,
            description,
            leftSourceType: 'parameter',
            leftValue: '',
            operator: '>',
            rightValueType: 'static',
            rightValue: '',
            enabled: true,
          }
          break
        case 'action':
          data = {
            label,
            description,
            actionType: subType,
            enabled: true,
            alarmTitle: '',
            alarmSeverity: undefined,
            alarmMessage: '',
            targetParameter: '',
            valueSource: undefined,
            staticValue: '',
            sourceSetpoint: '',
            presetName: '',
          }
          break
      }

      const newNode: Node = {
        id,
        type: type as 'trigger' | 'condition' | 'action',
        position,
        data,
      }

      setNodes((nds) => nds.concat(newNode))
    },
    [setNodes, getId]
  )

  const handleSave = useCallback(async () => {
    if (validationErrors.length > 0) {
      alert(`Validation errors:\n${validationErrors.join('\n')}`)
      return
    }

    try {
      // Convert nodes/edges to tree JSON
      const tree = convertNodesToTree(nodes, edges, workflowName)
      if (!tree) {
        alert('Failed to convert workflow to tree structure')
        return
      }

      const payload = {
        nama: workflowName,
        description: workflowDescription,
        enabled: workflowEnabled,
        version: 2,
        tree_data: tree,
      }

      if (workflow) {
        await workflowService.update(workflow.id, payload)
      } else {
        await workflowService.create(payload as any)
      }

      onSuccess()
    } catch (error) {
      console.error('Failed to save workflow:', error)
      alert('Failed to save workflow. Please check the console for details.')
    }
  }, [nodes, edges, workflowName, workflowDescription, workflowEnabled, validationErrors, workflow, onSuccess])

  const handleTest = useCallback(() => {
    // TODO: Implement test functionality
    alert('Test functionality not yet implemented')
  }, [])

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background">
        <TopBar
          workflowName={workflowName}
          onNameChange={setWorkflowName}
          enabled={workflowEnabled}
          onEnabledChange={setWorkflowEnabled}
          validationErrors={validationErrors}
          onSave={handleSave}
          onTest={handleTest}
          onCancel={onCancel}
        />
      <div className="flex flex-1 overflow-hidden">
        <NodePalette />
        <WorkflowCanvas
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          onDrop={onDrop}
          reactFlowInstance={reactFlowInstance}
          setReactFlowInstance={setReactFlowInstance}
          parameters={parameters}
          setPoints={setPoints}
        />
        <PropertiesPanel
          selectedNode={selectedNode}
          onNodeChange={onNodeChange}
          onClose={() => setSelectedNode(null)}
          parameters={parameters}
          setPoints={setPoints}
          cleanParameters={cleanParameters}
          writeParameters={writeParameters}
          presetParameters={presetParameters}
        />
      </div>
    </div>
  )
}

export function WorkflowBuilder(props: WorkflowBuilderProps) {
  return (
    <ReactFlowProvider>
      <WorkflowBuilderInner {...props} />
    </ReactFlowProvider>
  )
}
