import type { Node, Edge } from 'reactflow'
import type { WorkflowTree, TreeNode, TriggerNode, Condition, ValueSource } from '@/services/workflowService'
import type { TriggerNodeData, ConditionNodeData, ActionNodeData, TimerNodeData } from '@/types/workflow-builder'

/**
 * Validates workflow graph structure
 * Returns array of validation errors (empty if valid)
 */
export function validateWorkflowGraph(nodes: Node[], edges: Edge[]): string[] {
  const errors: string[] = []

  // Check for trigger node
  const triggerNode = nodes.find((n) => n.type === 'trigger')
  if (!triggerNode) {
    errors.push('At least 1 Trigger node required')
  }

  // Check for action node
  const hasAction = nodes.some((n) => n.type === 'action')
  if (!hasAction) {
    errors.push('At least 1 Action node required')
  }

  // Check for Trigger -> Action direct connections (warn only)
  for (const edge of edges) {
    const sourceNode = nodes.find((n) => n.id === edge.source)
    const targetNode = nodes.find((n) => n.id === edge.target)
    if (sourceNode?.type === 'trigger' && targetNode?.type === 'action') {
      errors.push('Trigger connected directly to Action (should have IF in between)')
      break
    }
  }

  // Check for cycles (using DFS)
  const visited = new Set<string>()
  const recStack = new Set<string>()

  function hasCycle(nodeId: string): boolean {
    if (recStack.has(nodeId)) {
      return true // Cycle detected
    }
    if (visited.has(nodeId)) {
      return false
    }

    visited.add(nodeId)
    recStack.add(nodeId)

    const outgoingEdges = edges.filter((e) => e.source === nodeId)
    for (const edge of outgoingEdges) {
      if (hasCycle(edge.target)) {
        return true
      }
    }

    recStack.delete(nodeId)
    return false
  }

  for (const node of nodes) {
    if (!visited.has(node.id) && hasCycle(node.id)) {
      errors.push('Cyclic reference detected in workflow graph')
      break
    }
  }

  // Check max depth (BFS from trigger)
  if (triggerNode) {
    const depthMap = new Map<string, number>()
    depthMap.set(triggerNode.id, 0)
    const queue: string[] = [triggerNode.id]

    while (queue.length > 0) {
      const currentId = queue.shift()!
      const currentDepth = depthMap.get(currentId) || 0

      if (currentDepth > 10) {
        errors.push(`Max depth exceeded: ${currentDepth} (max: 10)`)
        break
      }

      const outgoingEdges = edges.filter((e) => e.source === currentId)
      for (const edge of outgoingEdges) {
        if (!depthMap.has(edge.target)) {
          depthMap.set(edge.target, currentDepth + 1)
          queue.push(edge.target)
        }
      }
    }
  }

  return errors
}

/**
 * Converts React Flow nodes and edges to WorkflowTree JSON structure
 */
export function convertNodesToTree(
  nodes: Node[],
  edges: Edge[],
  workflowName: string
): WorkflowTree | null {
  // Find trigger node
  const triggerNode = nodes.find((n) => n.type === 'trigger')
  if (!triggerNode) {
    return null
  }

  const triggerData = triggerNode.data as TriggerNodeData

  // Build trigger
  const trigger: TriggerNode = {
    type: triggerData.triggerType === 'parameter-changed' ? 'PARAMETER_CHANGED' : 'SETPOINT_CHANGED',
    source_id: triggerData.source_id || 0,
    parameter: triggerData.parameter,
  }

  // Find root node (first node connected from trigger)
  // Note: We only take the first edge from trigger, but buildTreeNode will handle all subsequent edges
  const triggerEdges = edges.filter((e) => e.source === triggerNode.id)
  if (triggerEdges.length === 0) {
    return null
  }

  const rootNodeId = triggerEdges[0].target
  const rootNode = nodes.find((n) => n.id === rootNodeId)
  if (!rootNode) {
    return null
  }

  // Build root tree node recursively
  // buildTreeNode will traverse all connected nodes through edges
  const root = buildTreeNode(rootNode, nodes, edges, new Set<string>(), 0)

  // Extract node positions (including trigger node)
  const nodePositions: Record<string, { x: number; y: number }> = {}
  nodes.forEach((node) => {
    nodePositions[node.id] = {
      x: node.position.x,
      y: node.position.y,
    }
  })

  return {
    name: workflowName,
    trigger,
    root,
    node_positions: nodePositions,
  }
}

/**
 * Recursively builds a TreeNode from a React Flow node
 */
function buildTreeNode(
  node: Node,
  allNodes: Node[],
  allEdges: Edge[],
  visited: Set<string>,
  depth: number
): TreeNode {
  if (depth > 10) {
    throw new Error('Max depth exceeded')
  }

  if (visited.has(node.id)) {
    throw new Error('Cyclic reference detected')
  }

  visited.add(node.id)

  if (node.type === 'action') {
    const actionData = node.data as ActionNodeData
    const actionDataMap: Record<string, any> = {}

    switch (actionData.actionType) {
      case 'alarm-notification':
        actionDataMap.title = actionData.alarmTitle || ''
        actionDataMap.message = actionData.alarmMessage || ''
        actionDataMap.severity = actionData.alarmSeverity || 'info'
        break

      case 'write-dynamic':
        actionDataMap.target_id = actionData.targetId || 0
        if (actionData.valueSource === 'static') {
          actionDataMap.value = parseFloat(actionData.staticValue || '0')
        } else if (actionData.valueSource === 'setpoint') {
          // For setpoint, we need to get the setpoint value
          // This will be resolved at runtime
          actionDataMap.value_source = 'setpoint'
          actionDataMap.setpoint_id = actionData.sourceSetpointId || 0
        }
        break

      case 'trigger-preset':
        actionDataMap.target_id = actionData.presetId || 0
        break
    }

    // Check for outgoing edges (action chaining)
    // Action nodes can have children in the `then` array for sequential execution
    // Get all outgoing edges (action nodes typically don't use sourceHandle)
    const outgoingEdges = allEdges.filter((e) => e.source === node.id)
    const nextNodes: TreeNode[] = []
    
    for (const edge of outgoingEdges) {
      const childNode = allNodes.find((n) => n.id === edge.target)
      if (childNode && !visited.has(childNode.id)) {
        const childVisited = new Set(visited)
        try {
          nextNodes.push(buildTreeNode(childNode, allNodes, allEdges, childVisited, depth + 1))
        } catch (error) {
          // Skip if there's an error (e.g., cyclic reference, max depth)
          console.warn(`Skipping node ${childNode.id} due to error:`, error)
        }
      }
    }

    visited.delete(node.id)
    
    // Return action node with then array for chaining (backend supports this)
    return {
      type: 'action',
      id: node.id,
      action_type: actionData.actionType === 'alarm-notification' ? 'ALARM_NOTIFICATION' : actionData.actionType === 'write-dynamic' ? 'WRITE_DYNAMIC' : 'WRITE_PRESET',
      action_data: actionDataMap,
      // Add then array for action chaining
      ...(nextNodes.length > 0 ? { then: nextNodes } : {}),
    }
  }

  if (node.type === 'condition') {
    const conditionData = node.data as ConditionNodeData

    // Check condition type
    const conditionType = conditionData.conditionType || 'comparison'
    
    let condition: Condition
    if (conditionType === 'time_window') {
      // Build time window condition
      condition = {
        type: 'time_window',
        time_window: {
          start_time: conditionData.timeWindow?.startTime || '08:00',
          end_time: conditionData.timeWindow?.endTime || '17:00',
          days: conditionData.timeWindow?.days || [],
        },
      }
    } else {
      // Build comparison condition
      const left: ValueSource = {
        type: conditionData.leftSourceType || 'parameter',
        source_id: conditionData.leftSourceId,
      }

      const right: ValueSource =
        conditionData.rightValueType === 'static'
          ? {
              type: 'static',
              value: parseFloat(conditionData.rightValue || '0'),
            }
          : {
              type: 'setpoint',
              source_id: conditionData.rightSourceId,
            }

      condition = {
        type: 'comparison',
        left,
        operator: conditionData.operator || '>',
        right,
      }
    }

    // Build THEN branch
    // Only get edges with sourceHandle='then' (ignore edges without sourceHandle for IF nodes)
    const thenEdges = allEdges.filter(
      (e) => e.source === node.id && e.sourceHandle === 'then'
    )
    const then: TreeNode[] = []
    for (const edge of thenEdges) {
      const childNode = allNodes.find((n) => n.id === edge.target)
      if (childNode && !visited.has(childNode.id)) {
        const childVisited = new Set(visited)
        try {
          then.push(buildTreeNode(childNode, allNodes, allEdges, childVisited, depth + 1))
        } catch (error) {
          // Skip if there's an error (e.g., cyclic reference, max depth)
          console.warn(`Skipping node ${childNode.id} due to error:`, error)
        }
      }
    }

    // Build ELSE branch
    const elseEdges = allEdges.filter(
      (e) => e.source === node.id && e.sourceHandle === 'else'
    )
    const elseBranch: TreeNode[] = []
    for (const edge of elseEdges) {
      const childNode = allNodes.find((n) => n.id === edge.target)
      if (childNode && !visited.has(childNode.id)) {
        const childVisited = new Set(visited)
        try {
          elseBranch.push(buildTreeNode(childNode, allNodes, allEdges, childVisited, depth + 1))
        } catch (error) {
          // Skip if there's an error (e.g., cyclic reference, max depth)
          console.warn(`Skipping node ${childNode.id} due to error:`, error)
        }
      }
    }

    visited.delete(node.id)
    return {
      type: 'if',
      id: node.id,
      condition,
      then,
      else: elseBranch,
    }
  }

  if (node.type === 'timer') {
    const timerData = node.data as TimerNodeData

    // Check for outgoing edges (timer continues to next node)
    const outgoingEdges = allEdges.filter((e) => e.source === node.id)
    const nextNodes: TreeNode[] = []

    for (const edge of outgoingEdges) {
      const childNode = allNodes.find((n) => n.id === edge.target)
      if (childNode && !visited.has(childNode.id)) {
        const childVisited = new Set(visited)
        try {
          nextNodes.push(buildTreeNode(childNode, allNodes, allEdges, childVisited, depth + 1))
        } catch (error) {
          console.warn(`Skipping node ${childNode.id} due to error:`, error)
        }
      }
    }

    visited.delete(node.id)

    return {
      type: 'timer',
      id: node.id,
      timer_data: {
        duration: timerData.duration || 0,
        unit: timerData.unit || 'seconds',
      },
      ...(nextNodes.length > 0 ? { then: nextNodes } : {}),
    }
  }

  visited.delete(node.id)
  throw new Error(`Unknown node type: ${node.type}`)
}

/**
 * Converts WorkflowTree JSON to React Flow nodes and edges
 * Uses saved node positions if available, otherwise uses auto-arrange
 */
export function convertTreeToNodes(tree: WorkflowTree): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = []
  const edges: Edge[] = []
  let nodeIdCounter = 0

  const getId = () => `node_${nodeIdCounter++}`

  // Check if we have saved node positions
  const hasSavedPositions = tree.node_positions && Object.keys(tree.node_positions).length > 0

  // Create trigger node
  const triggerId = getId()
  const isParameterTrigger = tree.trigger.type === 'PARAMETER_CHANGED'
  
  // Use saved position if available, otherwise use default
  const triggerPosition = hasSavedPositions && tree.node_positions![triggerId]
    ? tree.node_positions![triggerId]
    : { x: 300, y: 50 }
  
  const triggerNode: Node = {
    id: triggerId,
    type: 'trigger',
    position: triggerPosition,
    data: {
      label: isParameterTrigger ? 'Parameter Changed' : 'Set-Point Changed',
      description: isParameterTrigger
        ? 'Fires when a parameter value changes'
        : 'Fires when a set-point is modified',
      triggerType: isParameterTrigger ? 'parameter-changed' : 'setpoint-changed',
      source_id: tree.trigger.source_id,
      parameter: isParameterTrigger ? String(tree.trigger.source_id) : undefined,
      setpoint: !isParameterTrigger ? String(tree.trigger.source_id) : undefined,
      enabled: true,
    },
  }
  nodes.push(triggerNode)

  // Build root node recursively
  // If we have saved positions, use them; otherwise use default positioning
  const rootId = buildNodeFromTree(
    tree.root,
    nodes,
    edges,
    triggerId,
    hasSavedPositions ? undefined : 200, // yOffset only used if no saved positions
    getId,
    hasSavedPositions ? tree.node_positions! : undefined
  )

  return { nodes, edges }
}

/**
 * Recursively builds React Flow nodes from TreeNode
 */
function buildNodeFromTree(
  treeNode: TreeNode,
  nodes: Node[],
  edges: Edge[],
  parentId: string,
  yOffset: number | undefined,
  getId: () => string,
  savedPositions?: Record<string, { x: number; y: number }>,
  skipDefaultEdge: boolean = false // Flag to skip creating default edge (used for IF node children)
): string {
  // Use treeNode.id if available, otherwise generate new ID
  // But check if node with this ID already exists to prevent duplicates
  let nodeId: string
  if (treeNode.id && nodes.find((n) => n.id === treeNode.id)) {
    // Node with this ID already exists, use existing node but still create edge
    nodeId = treeNode.id
  } else {
    // Use treeNode.id if available, otherwise generate new
    nodeId = treeNode.id || getId()
  }
  
  // Use saved position if available, otherwise use yOffset-based positioning
  let nodePosition: { x: number; y: number }
  if (savedPositions && savedPositions[nodeId]) {
    nodePosition = savedPositions[nodeId]
  } else if (yOffset !== undefined) {
    // Fallback to default positioning if no saved position
    nodePosition = { x: 300, y: yOffset }
  } else {
    // If no saved positions and no yOffset, use default
    nodePosition = { x: 300, y: 200 }
  }
  
  let currentY = yOffset !== undefined ? yOffset : 200
  
  // Check if node already exists
  const existingNode = nodes.find((n) => n.id === nodeId)
  if (existingNode) {
    // Node already exists, just create edge and return
    // Don't create duplicate node
    const edgeExists = edges.find((e) => e.source === parentId && e.target === nodeId)
    if (!edgeExists) {
      edges.push({
        id: `e-${parentId}-${nodeId}`,
        source: parentId,
        target: nodeId,
      })
    }
    return nodeId
  }

  if (treeNode.type === 'action') {
    const actionData = treeNode.action_data || {}
    const actionType = treeNode.action_type || 'ALARM_NOTIFICATION'
    
    // Build action node data based on action type
    let nodeData: any = {
      label: actionType === 'ALARM_NOTIFICATION' ? 'Alarm Notification' : actionType === 'WRITE_DYNAMIC' ? 'Write Dynamic Value' : 'Trigger Preset',
      description: '',
      actionType: actionType === 'ALARM_NOTIFICATION' ? 'alarm-notification' : actionType === 'WRITE_DYNAMIC' ? 'write-dynamic' : 'trigger-preset',
      enabled: true,
    }

    if (actionType === 'ALARM_NOTIFICATION') {
      nodeData.alarmTitle = actionData.title || ''
      nodeData.alarmSeverity = actionData.severity || 'info'
      nodeData.alarmMessage = actionData.message || ''
    } else if (actionType === 'WRITE_DYNAMIC') {
      nodeData.targetParameter = String(actionData.target_id || '')
      nodeData.targetId = actionData.target_id
      // Check for value_source field (from saved data) or value/setpoint_id (legacy)
      if (actionData.value_source === 'setpoint' || actionData.setpoint_id) {
        nodeData.valueSource = 'setpoint'
        nodeData.sourceSetpoint = String(actionData.setpoint_id || '')
        nodeData.sourceSetpointId = actionData.setpoint_id
      } else if (actionData.value !== undefined) {
        nodeData.valueSource = 'static'
        nodeData.staticValue = String(actionData.value)
      } else {
        // Default to static with 0
        nodeData.valueSource = 'static'
        nodeData.staticValue = '0'
      }
    } else if (actionType === 'WRITE_PRESET') {
      nodeData.presetName = String(actionData.target_id || '')
      nodeData.presetId = actionData.target_id
    }

    const actionNode: Node = {
      id: nodeId,
      type: 'action',
      position: nodePosition,
      data: nodeData,
    }
    nodes.push(actionNode)
    
    // Only create default edge if not skipped (for IF node children, edge will be created with sourceHandle)
    if (!skipDefaultEdge) {
      edges.push({
        id: `e-${parentId}-${nodeId}`,
        source: parentId,
        target: nodeId,
      })
    }

    // Process THEN branch for action chaining
    // Note: buildNodeFromTree already creates edge from parent to child, so we don't need to create it again
    if (savedPositions) {
      // If we have saved positions, use them (no need to calculate yOffset)
      for (const thenChild of treeNode.then || []) {
        buildNodeFromTree(thenChild, nodes, edges, nodeId, undefined, getId, savedPositions)
      }
    } else {
      // Fallback to sequential positioning if no saved positions
      currentY += 150
      let thenY = currentY
      for (const thenChild of treeNode.then || []) {
        buildNodeFromTree(thenChild, nodes, edges, nodeId, thenY, getId, savedPositions)
        thenY += 150
      }
    }

    return nodeId
  }

  if (treeNode.type === 'if') {
    const conditionType = treeNode.condition?.type || 'comparison'
    
    let nodeData: any
    if (conditionType === 'time_window') {
      // Build time window condition node
      nodeData = {
        label: 'Time Window',
        description: `${treeNode.condition?.time_window?.start_time || '08:00'} - ${treeNode.condition?.time_window?.end_time || '17:00'}`,
        conditionType: 'time_window',
        timeWindow: {
          startTime: treeNode.condition?.time_window?.start_time || '08:00',
          endTime: treeNode.condition?.time_window?.end_time || '17:00',
          days: treeNode.condition?.time_window?.days || [],
        },
        enabled: true,
      }
    } else {
      // Build comparison condition node
      nodeData = {
        label: 'IF Condition',
        description: '',
        conditionType: 'comparison',
        leftSourceType: treeNode.condition?.left?.type || 'parameter',
        leftValue: String(treeNode.condition?.left?.source_id || ''),
        leftSourceId: treeNode.condition?.left?.source_id,
        operator: treeNode.condition?.operator || '>',
        rightValueType: treeNode.condition?.right?.type === 'static' ? 'static' : 'setpoint',
        rightValue:
          treeNode.condition?.right?.type === 'static'
            ? String(treeNode.condition?.right?.value || '0')
            : String(treeNode.condition?.right?.source_id || ''),
        rightSourceId: treeNode.condition?.right?.type === 'setpoint' ? treeNode.condition?.right?.source_id : undefined,
        enabled: true,
      }
    }
    
    const conditionNode: Node = {
      id: nodeId,
      type: 'condition',
      position: nodePosition,
      data: nodeData,
    }
    nodes.push(conditionNode)
    edges.push({
      id: `e-${parentId}-${nodeId}`,
      source: parentId,
      target: nodeId,
    })

    // Build THEN branch
    if (savedPositions) {
      // If we have saved positions, use them
      for (const thenChild of treeNode.then || []) {
        const thenChildId = buildNodeFromTree(thenChild, nodes, edges, nodeId, undefined, getId, savedPositions, true) // skipDefaultEdge = true
        edges.push({
          id: `e-${nodeId}-${thenChildId}-then`,
          source: nodeId,
          sourceHandle: 'then',
          target: thenChildId,
          label: 'THEN',
          style: { stroke: 'hsl(142 71% 45%)', strokeWidth: 2 },
        })
      }
    } else {
      // Fallback to sequential positioning if no saved positions
      currentY += 150
      let thenY = currentY
      for (const thenChild of treeNode.then || []) {
        const thenChildId = buildNodeFromTree(thenChild, nodes, edges, nodeId, thenY, getId, savedPositions, true) // skipDefaultEdge = true
        edges.push({
          id: `e-${nodeId}-${thenChildId}-then`,
          source: nodeId,
          sourceHandle: 'then',
          target: thenChildId,
          label: 'THEN',
          style: { stroke: 'hsl(142 71% 45%)', strokeWidth: 2 },
        })
        thenY += 150
      }
    }

    // Build ELSE branch
    if (savedPositions) {
      // If we have saved positions, use them
      for (const elseChild of treeNode.else || []) {
        const elseChildId = buildNodeFromTree(elseChild, nodes, edges, nodeId, undefined, getId, savedPositions, true) // skipDefaultEdge = true
        edges.push({
          id: `e-${nodeId}-${elseChildId}-else`,
          source: nodeId,
          sourceHandle: 'else',
          target: elseChildId,
          label: 'ELSE',
          style: { stroke: 'hsl(0 72% 51%)', strokeWidth: 2 },
        })
      }
    } else {
      // Fallback to sequential positioning if no saved positions
      let elseX = 500
      let elseY = currentY
      for (const elseChild of treeNode.else || []) {
        const elseChildId = buildNodeFromTree(elseChild, nodes, edges, nodeId, elseY, getId, savedPositions, true) // skipDefaultEdge = true
        // Update position for ELSE branch (to the right) only if no saved positions
        const elseNode = nodes.find((n) => n.id === elseChildId)
        if (elseNode && !savedPositions) {
          elseNode.position.x = elseX
        }
        edges.push({
          id: `e-${nodeId}-${elseChildId}-else`,
          source: nodeId,
          sourceHandle: 'else',
          target: elseChildId,
          label: 'ELSE',
          style: { stroke: 'hsl(0 72% 51%)', strokeWidth: 2 },
        })
        elseY += 150
      }
    }

    return nodeId
  }

  if (treeNode.type === 'timer') {
    const timerData = treeNode.timer_data || { duration: 0, unit: 'seconds' }
    
    const timerNode: Node = {
      id: nodeId,
      type: 'timer',
      position: nodePosition,
      data: {
        label: 'Timer',
        description: `Delay ${timerData.duration} ${timerData.unit}`,
        duration: timerData.duration || 0,
        unit: timerData.unit || 'seconds',
        enabled: true,
      },
    }
    nodes.push(timerNode)

    // Only create default edge if not skipped
    if (!skipDefaultEdge) {
      edges.push({
        id: `e-${parentId}-${nodeId}`,
        source: parentId,
        target: nodeId,
      })
    }

    // Process THEN branch for continuing after delay
    if (savedPositions) {
      for (const thenChild of treeNode.then || []) {
        buildNodeFromTree(thenChild, nodes, edges, nodeId, undefined, getId, savedPositions)
      }
    } else {
      currentY += 150
      let thenY = currentY
      for (const thenChild of treeNode.then || []) {
        buildNodeFromTree(thenChild, nodes, edges, nodeId, thenY, getId, savedPositions)
        thenY += 150
      }
    }

    return nodeId
  }

  throw new Error(`Unknown tree node type: ${treeNode.type}`)
}
