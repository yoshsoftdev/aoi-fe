import type { Node, Edge } from 'reactflow'

interface NodePosition {
  nodeId: string
  x: number
  y: number
}

const VERTICAL_SPACING = 250
const HORIZONTAL_SPACING = 400
const MAX_DEPTH = 5

/**
 * Level-based grid auto-arrange algorithm
 * - Nodes at the same depth are aligned horizontally
 * - Nodes at depth+1 are directly below the previous level
 * - Simple deterministic layout: y = depth * VERTICAL_SPACING, x = index_in_level * HORIZONTAL_SPACING
 * - No subtree width calculation
 * - No center alignment
 */
export function autoArrangeNodes<T = any>(nodes: Node<T>[], edges: Edge[]): Node<T>[] {
  if (nodes.length === 0) return nodes

  // Find trigger node
  const triggerNode = nodes.find((n) => n.type === 'trigger')
  if (!triggerNode) return nodes

  // Build node map and children map
  const nodeMap = new Map<string, Node<T>>()
  const childrenMap = new Map<string, { then: string[]; else: string[]; other: string[] }>()
  
  nodes.forEach((node) => {
    nodeMap.set(node.id, node)
    childrenMap.set(node.id, { then: [], else: [], other: [] })
  })

  // Build children map from edges
  edges.forEach((edge) => {
    const children = childrenMap.get(edge.source)
    if (children) {
      if (edge.sourceHandle === 'then') {
        children.then.push(edge.target)
      } else if (edge.sourceHandle === 'else') {
        children.else.push(edge.target)
      } else {
        children.other.push(edge.target)
      }
    }
  })

  // Level-based node grouping: Map<depth, nodeIds[]>
  const levelMap = new Map<number, string[]>()
  
  // Traverse tree recursively and group nodes by depth
  const traverseTree = (nodeId: string, depth: number = 0) => {
    if (depth > MAX_DEPTH) return
    
    // Add current node to its level
    if (!levelMap.has(depth)) {
      levelMap.set(depth, [])
    }
    const levelNodes = levelMap.get(depth)!
    
    // Only add if not already in level (prevent duplicates)
    if (!levelNodes.includes(nodeId)) {
      levelNodes.push(nodeId)
    }

    const children = childrenMap.get(nodeId) || { then: [], else: [], other: [] }
    
    // Process all children at depth + 1
    // Order: THEN first, ELSE second, OTHER last (for deterministic ordering)
    const allChildren = [...children.then, ...children.else, ...children.other]
    
    for (const childId of allChildren) {
      traverseTree(childId, depth + 1)
    }
  }

  // Start traversal from trigger node (depth 0)
  traverseTree(triggerNode.id, 0)

  // Assign positions based on level and index
  const positions = new Map<string, NodePosition>()
  
  // Process each level
  for (const [depth, nodeIds] of levelMap.entries()) {
    // Calculate Y position based on depth
    const y = depth * VERTICAL_SPACING + 50 // +50 for top margin
    
    // Assign X positions based on index in level
    nodeIds.forEach((nodeId, index) => {
      const x = index * HORIZONTAL_SPACING + 200 // +200 for left margin
      positions.set(nodeId, { nodeId, x, y })
    })
  }

  // Update node positions
  return nodes.map((node) => {
    const position = positions.get(node.id)
    if (position) {
      return {
        ...node,
        position: { x: position.x, y: position.y },
      }
    }
    // If node not found in positions (orphaned), keep original position
    return node
  })
}
