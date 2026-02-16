import type { WorkflowCondition, WorkflowAction } from '@/services/workflowService'
import { internalParameterService, type InternalParameter } from '@/services/internalParameterService'

export interface SplitWorkflow {
  nama: string
  description: string
  enabled: boolean
  conditions: Omit<WorkflowCondition, 'id' | 'workflow_id' | 'created_at' | 'parameter'>[]
  actions: Omit<WorkflowAction, 'id' | 'workflow_id' | 'created_at' | 'parameter'>[]
}

export interface NestedIFStructure {
  // First level: IF condition_A THEN action_A
  // Second level: IF condition_B THEN action_B (nested inside first)
  levels: Array<{
    condition: Omit<WorkflowCondition, 'id' | 'workflow_id' | 'created_at' | 'parameter'>
    actions: Omit<WorkflowAction, 'id' | 'workflow_id' | 'created_at' | 'parameter'>[]
    elseActions?: Omit<WorkflowAction, 'id' | 'workflow_id' | 'created_at' | 'parameter'>[] // Actions untuk ELSE branch
  }>
}

/**
 * Mengubah operator menjadi kebalikan (untuk ELSE)
 */
export function invertOperator(operator: '>' | '<' | '>=' | '<=' | '==' | '!='): '>' | '<' | '>=' | '<=' | '==' | '!=' {
  switch (operator) {
    case '>': return '<='
    case '<': return '>='
    case '>=': return '<'
    case '<=': return '>'
    case '==': return '!='
    case '!=': return '=='
    default: return operator
  }
}

/**
 * Detects nested IF structure from React Flow nodes
 * Assumes structure: Trigger -> Condition A -> Action A -> Condition B -> Action B
 */
export function detectNestedIF(nodes: any[], edges: any[]): NestedIFStructure | null {
  // Find trigger node
  const triggerNode = nodes.find(n => n.type === 'trigger')
  if (!triggerNode) return null

  // Build graph structure
  const nodeMap = new Map(nodes.map(n => [n.id, n]))
  const outgoingEdges = new Map<string, string[]>()
  
  edges.forEach(edge => {
    if (!outgoingEdges.has(edge.source)) {
      outgoingEdges.set(edge.source, [])
    }
    outgoingEdges.get(edge.source)!.push(edge.target)
  })

  // Traverse from trigger to detect nested structure
  const levels: Array<{
    condition: Omit<WorkflowCondition, 'id' | 'workflow_id' | 'created_at' | 'parameter'>
    actions: Omit<WorkflowAction, 'id' | 'workflow_id' | 'created_at' | 'parameter'>[]
  }> = []

  let currentNodeId: string | undefined = triggerNode.id
  let level = 0
  const maxDepth = 3 // Max nesting depth

  while (currentNodeId && level < maxDepth) {
    const nextNodes = outgoingEdges.get(currentNodeId) || []
    if (nextNodes.length === 0) break

    // Find next condition node
    const conditionNodeId = nextNodes.find(id => {
      const node = nodeMap.get(id)
      return node?.type === 'condition'
    })

    if (!conditionNodeId) break

    const conditionNode = nodeMap.get(conditionNodeId)
    if (!conditionNode?.data?.condition) break

    // Find actions after this condition
    const actionNodes: any[] = []
    let actionNodeId: string | undefined = conditionNodeId

    // Traverse to find all consecutive action nodes
    while (actionNodeId) {
      const nextActionNodes = outgoingEdges.get(actionNodeId) || []
      const nextActionNodeId = nextActionNodes.find(id => {
        const node = nodeMap.get(id)
        return node?.type === 'action'
      })

      if (nextActionNodeId) {
        const actionNode = nodeMap.get(nextActionNodeId)
        if (actionNode?.data?.action) {
          actionNodes.push(actionNode.data.action)
        }
        actionNodeId = nextActionNodeId
      } else {
        break
      }
    }

    if (actionNodes.length === 0) break

    levels.push({
      condition: conditionNode.data.condition,
      actions: actionNodes,
    })

    // Check if there's another condition after actions (nested IF)
    const lastActionNodeId = actionNodes.length > 0 ? actionNodeId : undefined
    if (lastActionNodeId) {
      const afterActionNodes = outgoingEdges.get(lastActionNodeId) || []
      const nextConditionId = afterActionNodes.find(id => {
        const node = nodeMap.get(id)
        return node?.type === 'condition'
      })
      currentNodeId = nextConditionId
    } else {
      break
    }

    level++
  }

  return levels.length > 0 ? { levels } : null
}

/**
 * Splits nested IF structure into multiple flat workflows using internal parameters
 * Handles ELSE by creating separate workflows with inverted conditions
 */
export async function splitNestedIFToWorkflows(
  baseNama: string,
  baseDescription: string,
  enabled: boolean,
  nestedStructure: NestedIFStructure,
  deviceId: number
): Promise<SplitWorkflow[]> {
  const workflows: SplitWorkflow[] = []
  const internalFlags: InternalParameter[] = []
  const allFlags: InternalParameter[] = [] // Track all flags for reset

  // Count how many flags we need (for nested IF and nested ELSE)
  const totalLevels = nestedStructure.levels.length
  const needsFlags = totalLevels > 1 || nestedStructure.levels.some(level => level.elseActions && level.elseActions.length > 0)

  // Create internal flag parameters for chaining
  if (needsFlags) {
    for (let i = 0; i < totalLevels; i++) {
      const flagName = `wf_flag_${baseNama.toLowerCase().replace(/\s+/g, '_')}_${i}`
      try {
        const flag = await internalParameterService.create({
          name: flagName,
          device_id: deviceId,
        })
        internalFlags.push(flag)
        allFlags.push(flag)
      } catch (error) {
        console.error(`Failed to create internal flag ${flagName}:`, error)
        throw error
      }
    }
  }

  // Create workflows for IF branches
  nestedStructure.levels.forEach((level, index) => {
    if (index === 0) {
      // First workflow: IF condition_A THEN actions + set flag if nested
      const actions: Omit<WorkflowAction, 'id' | 'workflow_id' | 'created_at' | 'parameter'>[] = [...level.actions]
      
      // If there are nested levels or ELSE, set flag
      if (totalLevels > 1 || level.elseActions) {
        const flagAction: Omit<WorkflowAction, 'id' | 'workflow_id' | 'created_at' | 'parameter'> = {
          action_type: 'WRITE_INTERNAL',
          action_order: actions.length,
          parameter_id: internalFlags[0]?.id,
          value: 1,
        }
        actions.push(flagAction)
      }

      workflows.push({
        nama: `${baseNama} - IF Level ${index + 1}`,
        description: `${baseDescription} (IF branch level ${index + 1})`,
        enabled,
        conditions: [level.condition],
        actions,
      })

      // Create ELSE workflow if ELSE actions exist
      if (level.elseActions && level.elseActions.length > 0) {
        const invertedCondition: Omit<WorkflowCondition, 'id' | 'workflow_id' | 'created_at' | 'parameter'> = {
          parameter_id: level.condition.parameter_id,
          operator: invertOperator(level.condition.operator),
          threshold: level.condition.threshold,
        }

        workflows.push({
          nama: `${baseNama} - ELSE Level ${index + 1}`,
          description: `${baseDescription} (ELSE branch level ${index + 1})`,
          enabled,
          conditions: [invertedCondition],
          actions: level.elseActions.map((action, actionIndex) => ({
            ...action,
            action_order: actionIndex,
          })),
        })
      }
    } else {
      // Middle/Last workflows: IF internal_flag_{index-1} == 1 AND condition_{index} THEN actions
      const prevFlagCondition: Omit<WorkflowCondition, 'id' | 'workflow_id' | 'created_at' | 'parameter'> = {
        parameter_id: internalFlags[index - 1].id,
        operator: '==',
        threshold: 1,
      }

      const actions: Omit<WorkflowAction, 'id' | 'workflow_id' | 'created_at' | 'parameter'>[] = [...level.actions]
      
      // If not last level, set next flag
      if (index < totalLevels - 1) {
        const flagAction: Omit<WorkflowAction, 'id' | 'workflow_id' | 'created_at' | 'parameter'> = {
          action_type: 'WRITE_INTERNAL',
          action_order: actions.length,
          parameter_id: internalFlags[index]?.id,
          value: 1,
        }
        actions.push(flagAction)
      } else {
        // Last level: reset all flags after execution
        const resetActions: Omit<WorkflowAction, 'id' | 'workflow_id' | 'created_at' | 'parameter'>[] = 
          allFlags.map((flag, flagIndex) => ({
            action_type: 'WRITE_INTERNAL' as const,
            action_order: actions.length + flagIndex,
            parameter_id: flag.id,
            value: 0, // Reset to 0
          }))
        actions.push(...resetActions)
      }

      workflows.push({
        nama: `${baseNama} - IF Level ${index + 1}`,
        description: `${baseDescription} (IF branch level ${index + 1}${index === totalLevels - 1 ? ' - Final' : ''})`,
        enabled,
        conditions: [prevFlagCondition, level.condition],
        actions,
      })

      // Create ELSE workflow if ELSE actions exist
      if (level.elseActions && level.elseActions.length > 0) {
        const invertedCondition: Omit<WorkflowCondition, 'id' | 'workflow_id' | 'created_at' | 'parameter'> = {
          parameter_id: level.condition.parameter_id,
          operator: invertOperator(level.condition.operator),
          threshold: level.condition.threshold,
        }

        // ELSE workflow: IF internal_flag_{index-1} == 1 AND NOT condition_{index} THEN elseActions
        const elseActionsWithOrder = level.elseActions.map((action, actionIndex) => ({
          ...action,
          action_order: actionIndex,
        }))

        // If last level, reset flags after ELSE execution
        if (index === totalLevels - 1) {
          const resetActions: Omit<WorkflowAction, 'id' | 'workflow_id' | 'created_at' | 'parameter'>[] = 
            allFlags.map((flag, flagIndex) => ({
              action_type: 'WRITE_INTERNAL' as const,
              action_order: elseActionsWithOrder.length + flagIndex,
              parameter_id: flag.id,
              value: 0,
            }))
          elseActionsWithOrder.push(...resetActions)
        }

        workflows.push({
          nama: `${baseNama} - ELSE Level ${index + 1}`,
          description: `${baseDescription} (ELSE branch level ${index + 1}${index === totalLevels - 1 ? ' - Final' : ''})`,
          enabled,
          conditions: [prevFlagCondition, invertedCondition],
          actions: elseActionsWithOrder,
        })
      }
    }
  })

  return workflows
}

/**
 * Converts flat conditions/actions to nested structure (for editing existing workflows)
 */
export function flattenNestedStructure(workflows: SplitWorkflow[]): {
  conditions: Omit<WorkflowCondition, 'id' | 'workflow_id' | 'created_at' | 'parameter'>[]
  actions: Omit<WorkflowAction, 'id' | 'workflow_id' | 'created_at' | 'parameter'>[]
} {
  // For now, just combine all conditions and actions
  // In a real implementation, you'd need to track which internal flags belong to which workflow
  const conditions: Omit<WorkflowCondition, 'id' | 'workflow_id' | 'created_at' | 'parameter'>[] = []
  const actions: Omit<WorkflowAction, 'id' | 'workflow_id' | 'created_at' | 'parameter'>[] = []

  workflows.forEach((workflow, index) => {
    // Filter out internal flag conditions (they're for chaining, not user-defined)
    const userConditions = workflow.conditions.filter(c => {
      // Check if this condition checks an internal flag
      // This is a heuristic - in production you'd track flag IDs
      return true // For now, include all
    })

    // Filter out internal flag write actions (they're for chaining, not user-defined)
    const userActions = workflow.actions.filter(a => {
      return a.action_type !== 'WRITE_INTERNAL' || index === workflows.length - 1
    })

    conditions.push(...userConditions)
    actions.push(...userActions)
  })

  return { conditions, actions }
}
