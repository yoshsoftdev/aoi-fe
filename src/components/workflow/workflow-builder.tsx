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
import { validateWorkflowGraph, validateNodeData, convertNodesToTree, convertTreeToNodes } from '@/utils/workflowTreeConverter'
import { autoArrangeNodes } from '@/utils/workflowAutoArrange'
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

  const [nodes, setNodes, onNodesChangeBase] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge[]>([])
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)

  // Custom onNodesChange that also removes edges when nodes are deleted
  const onNodesChange = useCallback(
    (changes: any[]) => {
      // Process node changes first
      onNodesChangeBase(changes)

      // Find deleted node IDs
      const deletedNodeIds = changes
        .filter((change) => change.type === 'remove')
        .map((change) => change.id)

      // Remove edges connected to deleted nodes
      if (deletedNodeIds.length > 0) {
        setEdges((eds) =>
          eds.filter(
            (edge) => !deletedNodeIds.includes(edge.source) && !deletedNodeIds.includes(edge.target)
          )
        )

        // Clear selected node if it was deleted
        setSelectedNode((prev) => {
          if (prev && deletedNodeIds.includes(prev.id)) {
            return null
          }
          return prev
        })
      }
    },
    [onNodesChangeBase, setEdges]
  )
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
  // Only include DIRECT, CLEAN, FORMULA parameters (exclude RAW, SOURCE, and undefined)
  const cleanParameters = useMemo(
    () => parameters.filter((p) => {
      const mode = p.parameter_mode || ''
      // Only include DIRECT, CLEAN, FORMULA - explicitly exclude RAW, SOURCE, and empty
      return ['DIRECT', 'CLEAN', 'FORMULA'].includes(mode)
    }),
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
    const graphErrors = validateWorkflowGraph(nodes, edges)
    const nodeDataErrors = validateNodeData(nodes, edges)
    return [...graphErrors, ...nodeDataErrors]
  }, [nodes, edges])

  // Load workflow data if editing
  useEffect(() => {
    // Only load if workflow ID changes (prevent reloading on every render)
    if (workflow && workflow.version === 2 && workflow.tree_data) {
      try {
        // tree_data should already be parsed by workflowService
        const treeData = workflow.tree_data as WorkflowTree

        const { nodes: treeNodes, edges: treeEdges } = convertTreeToNodes(treeData)
        
        // Clean up edges: remove edges from condition nodes that don't have sourceHandle
        // Condition nodes should only have edges with sourceHandle='then' or 'else'
        const cleanedEdges = treeEdges.filter((edge) => {
          const sourceNode = treeNodes.find((n) => n.id === edge.source)
          if (sourceNode?.type === 'condition') {
            // For condition nodes, only keep edges with sourceHandle='then' or 'else'
            return edge.sourceHandle === 'then' || edge.sourceHandle === 'else'
          }
          // For other node types, keep all edges
          return true
        })
        
        // Clear existing nodes/edges first to prevent duplicates
        setNodes([])
        setEdges([])
        
        // Set new nodes and edges
        setNodes(treeNodes)
        setEdges(cleanedEdges)
        
        // Auto arrange only if no saved positions exist
        if (!treeData.node_positions || Object.keys(treeData.node_positions).length === 0) {
          setTimeout(() => {
            const arrangedNodes = autoArrangeNodes(treeNodes, treeEdges)
            setNodes(arrangedNodes)
            
            // Fit view after arrangement
            setTimeout(() => {
              if (reactFlowInstance) {
                reactFlowInstance.fitView({ padding: 0.2, duration: 300 })
              }
            }, 100)
          }, 100)
        } else {
          // If we have saved positions, just fit view
          setTimeout(() => {
            if (reactFlowInstance) {
              reactFlowInstance.fitView({ padding: 0.2, duration: 300 })
            }
          }, 100)
        }
        
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
      
      // For condition nodes, only allow connections with sourceHandle='then' or 'else'
      if (sourceNode?.type === 'condition') {
        if (params.sourceHandle !== 'then' && params.sourceHandle !== 'else') {
          // Reject connection if sourceHandle is not 'then' or 'else'
          return
        }
      }
      
      // Check if edge already exists to prevent duplicates
      setEdges((eds) => {
        const edgeExists = eds.some(
          (edge) =>
            edge.source === params.source &&
            edge.target === params.target &&
            edge.sourceHandle === params.sourceHandle &&
            edge.targetHandle === params.targetHandle
        )
        if (edgeExists) {
          return eds // Return existing edges if duplicate found
        }

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

        return addEdge(
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
      })
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
            // Create a new data object to ensure React Flow detects the change
            return { ...node, data: { ...data } }
          }
          return node
        })
      )
      // Update selectedNode with the new data
      setSelectedNode((prev) => {
        if (prev && prev.id === id) {
          return { ...prev, data: { ...data } }
        }
        return prev
      })
    },
    [setNodes]
  )

  // Sync selectedNode with nodes when nodes change (only if selectedNode exists)
  useEffect(() => {
    if (selectedNode) {
      const updatedNode = nodes.find((n) => n.id === selectedNode.id)
      if (updatedNode) {
        // Compare data objects by stringifying to detect changes
        const currentDataStr = JSON.stringify(selectedNode.data)
        const updatedDataStr = JSON.stringify(updatedNode.data)
        if (currentDataStr !== updatedDataStr) {
          setSelectedNode(updatedNode)
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes])

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
          if (subType === 'time-window') {
            data = {
              label,
              description,
              conditionType: 'time_window',
              timeWindow: {
                startTime: '08:00',
                endTime: '17:00',
                days: [],
              },
              enabled: true,
            }
          } else {
            data = {
              label,
              description,
              conditionType: 'comparison',
              leftSourceType: 'parameter',
              leftValue: '',
              operator: '>',
              rightValueType: 'static',
              rightValue: '',
              enabled: true,
            }
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
        case 'timer':
          data = {
            label,
            description,
            duration: 5,
            unit: 'seconds',
            enabled: true,
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
      const errorMessage = validationErrors.length === 1 
        ? validationErrors[0]
        : `Terdapat ${validationErrors.length} masalah:\n\n${validationErrors.map((e, i) => `${i + 1}. ${e}`).join('\n')}`
      alert(`Gagal menyimpan workflow:\n\n${errorMessage}`)
      return
    }

    try {
      // Convert nodes/edges to tree JSON
      const tree = convertNodesToTree(nodes, edges, workflowName)
      if (!tree) {
        alert('Gagal membuat workflow, ada node yang belum diisi atau line yang belum terhubung')
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
    } catch (error: any) {
      console.error('Failed to save workflow:', error)
      
      // Extract error message from axios error response
      let errorMessage = 'Gagal menyimpan workflow'
      
      if (error?.response?.data?.error) {
        // Backend returned an error message
        const backendError = error.response.data.error
        
        // Parse backend error to make it more user-friendly
        if (backendError.includes('Tree validation failed')) {
          // Extract the specific field that failed
          const match = backendError.match(/condition (left|right): (.+)/)
          if (match) {
            const side = match[1] === 'left' ? 'kiri' : 'kanan'
            const fieldError = match[2]
            if (fieldError.includes('source_id')) {
              errorMessage = `Validasi gagal: Node Condition - Parameter ${side} belum dipilih atau belum lengkap`
            } else {
              errorMessage = `Validasi gagal: Node Condition - ${fieldError}`
            }
          } else {
            // Try to extract node path
            const pathMatch = backendError.match(/then\[(\d+)\]/g)
            if (pathMatch) {
              errorMessage = `Validasi gagal: Ada node di dalam workflow yang belum lengkap datanya`
            } else {
              errorMessage = `Validasi gagal: ${backendError.replace('Tree validation failed: ', '')}`
            }
          }
        } else {
          errorMessage = backendError
        }
      } else if (error?.response?.data?.message) {
        // Alternative error message field
        errorMessage = error.response.data.message
      } else if (error?.message) {
        // Axios or other error message
        errorMessage = error.message
      }
      
      alert(`Gagal menyimpan workflow:\n\n${errorMessage}\n\nSilakan periksa semua node dan pastikan semua field sudah diisi dengan benar.`)
    }
  }, [nodes, edges, workflowName, workflowDescription, workflowEnabled, validationErrors, workflow, onSuccess])

  const handleTest = useCallback(() => {
    // TODO: Implement test functionality
    alert('Test functionality not yet implemented')
  }, [])

  const handleAutoArrange = useCallback(() => {
    // Get current viewport to preserve zoom
    const viewport = reactFlowInstance?.getViewport()
    
    const arrangedNodes = autoArrangeNodes(nodes, edges)
    
    // Update nodes with animation
    setNodes((prevNodes) => {
      return arrangedNodes.map((newNode) => {
        const oldNode = prevNodes.find((n) => n.id === newNode.id)
        if (oldNode) {
          return {
            ...newNode,
            // Add animated position transition
            position: oldNode.position, // Start from old position
          }
        }
        return newNode
      }) as Node[]
    })
    
    // Animate to new positions
    setTimeout(() => {
      setNodes((prevNodes) => {
        return arrangedNodes.map((newNode) => {
          const prevNode = prevNodes.find((n) => n.id === newNode.id)
          if (prevNode && (prevNode.position.x !== newNode.position.x || prevNode.position.y !== newNode.position.y)) {
            return {
              ...newNode,
              position: newNode.position,
            }
          }
          return newNode
        }) as Node[]
      })
      
      // Fit view after arrangement (preserve zoom if possible)
      setTimeout(() => {
        if (reactFlowInstance) {
          if (viewport) {
            // Try to maintain zoom level
            reactFlowInstance.setViewport(viewport, { duration: 300 })
            // Then fit view with padding
            setTimeout(() => {
              reactFlowInstance.fitView({ padding: 0.2, duration: 300 })
            }, 50)
          } else {
            reactFlowInstance.fitView({ padding: 0.2, duration: 300 })
          }
        }
      }, 100)
    }, 50)
  }, [nodes, edges, setNodes, reactFlowInstance])

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
          onAutoArrange={handleAutoArrange}
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
          parameters={cleanParameters}
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
