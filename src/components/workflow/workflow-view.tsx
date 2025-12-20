import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2, Edit, Play, Pause } from 'lucide-react'
import { workflowService, type Workflow } from '@/services/workflowService'
import { WorkflowForm } from './workflow-form'

export function WorkflowView() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null)

  const { data: workflows = [], isLoading } = useQuery({
    queryKey: ['workflows'],
    queryFn: () => workflowService.getAll(),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => workflowService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] })
    },
  })

  const toggleMutation = useMutation({
    mutationFn: async (workflow: Workflow) => {
      return workflowService.update(workflow.id, { enabled: !workflow.enabled })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] })
    },
  })

  const handleCreate = () => {
    setEditingWorkflow(null)
    setShowForm(true)
  }

  const handleEdit = (workflow: Workflow) => {
    setEditingWorkflow(workflow)
    setShowForm(true)
  }

  const handleDelete = (id: number) => {
    if (confirm('Are you sure you want to delete this workflow?')) {
      deleteMutation.mutate(id)
    }
  }

  const handleToggle = (workflow: Workflow) => {
    toggleMutation.mutate(workflow)
  }

  if (showForm) {
    return (
      <WorkflowForm
        workflow={editingWorkflow}
        onCancel={() => {
          setShowForm(false)
          setEditingWorkflow(null)
        }}
        onSuccess={() => {
          setShowForm(false)
          setEditingWorkflow(null)
          queryClient.invalidateQueries({ queryKey: ['workflows'] })
        }}
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Workflows</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Create automation rules: IF condition THEN action
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Create Workflow
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading workflows...</div>
      ) : workflows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">No workflows created yet</p>
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Workflow
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {workflows.map((workflow) => (
            <Card key={workflow.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <CardTitle className="text-lg">{workflow.nama}</CardTitle>
                      <Badge variant={workflow.enabled ? 'default' : 'secondary'}>
                        {workflow.enabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </div>
                    {workflow.description && (
                      <CardDescription>{workflow.description}</CardDescription>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggle(workflow)}
                    >
                      {workflow.enabled ? (
                        <>
                          <Pause className="h-4 w-4 mr-1" />
                          Disable
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4 mr-1" />
                          Enable
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(workflow)}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(workflow.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Conditions */}
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Conditions (IF)</h4>
                    <div className="space-y-2">
                      {workflow.conditions?.map((condition, idx) => (
                        <div key={idx} className="text-sm bg-muted/50 p-2 rounded">
                          <span className="font-medium">
                            {condition.parameter?.nama || `Parameter ${condition.parameter_id}`}
                          </span>{' '}
                          <span className="text-muted-foreground">{condition.operator}</span>{' '}
                          <span className="font-medium">{condition.threshold}</span>
                          {condition.parameter?.unit && (
                            <span className="text-muted-foreground"> {condition.parameter.unit}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Actions (THEN)</h4>
                    <div className="space-y-2">
                      {workflow.actions?.map((action, idx) => (
                        <div key={idx} className="text-sm bg-muted/50 p-2 rounded">
                          {action.action_type === 'write' && (
                            <>
                              <span className="font-medium">Write</span>{' '}
                              <span className="text-muted-foreground">to</span>{' '}
                              <span className="font-medium">
                                {action.parameter?.nama || `Parameter ${action.parameter_id}`}
                              </span>{' '}
                              <span className="text-muted-foreground">=</span>{' '}
                              <span className="font-medium">{action.value}</span>
                              {action.parameter?.unit && (
                                <span className="text-muted-foreground"> {action.parameter.unit}</span>
                              )}
                            </>
                          )}
                          {action.action_type === 'event' && (
                            <>
                              <span className="font-medium">Emit Event:</span>{' '}
                              <span className="font-medium">{action.event_name}</span>
                            </>
                          )}
                          {action.action_type === 'delay' && (
                            <>
                              <span className="font-medium">Delay:</span>{' '}
                              <span className="font-medium">{action.delay_ms}ms</span>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

