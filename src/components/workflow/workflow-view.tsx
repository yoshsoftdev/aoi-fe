import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2, Edit, Play, Pause } from 'lucide-react'
import { workflowService, type Workflow } from '@/services/workflowService'
import { WorkflowForm } from './workflow-form'
import { DeleteConfirmationDialog } from '@/components/ui/delete-confirmation-dialog'

export function WorkflowView() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [workflowToDelete, setWorkflowToDelete] = useState<Workflow | null>(null)

  const { data: workflows = [], isLoading } = useQuery({
    queryKey: ['workflows'],
    queryFn: () => workflowService.getAll(),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => workflowService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] })
      setDeleteDialogOpen(false)
      setWorkflowToDelete(null)
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

  const handleEdit = async (workflow: Workflow) => {
    // Fetch full workflow data including actions and conditions
    try {
      const fullWorkflow = await workflowService.getById(workflow.id)
      setEditingWorkflow(fullWorkflow)
      setShowForm(true)
    } catch (error) {
      console.error('Failed to load workflow:', error)
      // Fallback to workflow from list if fetch fails
      setEditingWorkflow(workflow)
      setShowForm(true)
    }
  }

  const handleDelete = (workflow: Workflow) => {
    setWorkflowToDelete(workflow)
    setDeleteDialogOpen(true)
  }

  const handleConfirmDelete = () => {
    if (!workflowToDelete) return
    deleteMutation.mutate(workflowToDelete.id)
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
            Buat aturan otomasi: JIKA kondisi MAKA aksi
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Buat Workflow
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Memuat workflow...</div>
      ) : workflows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">Belum ada workflow yang dibuat</p>
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Buat Workflow Pertama
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
                        {workflow.enabled ? 'Aktif' : 'Nonaktif'}
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
                          Nonaktifkan
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4 mr-1" />
                          Aktifkan
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
                      onClick={() => handleDelete(workflow)}
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
                    <h4 className="text-sm font-semibold mb-2">Kondisi (JIKA)</h4>
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
                    <h4 className="text-sm font-semibold mb-2">Aksi (MAKA)</h4>
                    <div className="space-y-2">
                      {workflow.actions && workflow.actions.length > 0 ? (
                        workflow.actions.map((action, idx) => (
                          <div key={idx} className="text-sm bg-muted/50 p-2 rounded">
                            {action.action_type === 'TRIGGER_WRITE' && (
                              <>
                                <span className="font-medium">Trigger Write</span>{' '}
                                <span className="text-muted-foreground">ke</span>{' '}
                                <span className="font-medium">
                                  {action.parameter?.nama || `Parameter ${action.parameter_id}`}
                                </span>
                                {action.parameter?.unit && (
                                  <span className="text-muted-foreground"> ({action.parameter.unit})</span>
                                )}
                                <span className="text-muted-foreground"> [PRESET]</span>
                              </>
                            )}
                            {action.action_type === 'WRITE_WITH_VALUE' && (
                              <>
                                <span className="font-medium">Tulis</span>{' '}
                                <span className="text-muted-foreground">ke</span>{' '}
                                <span className="font-medium">
                                  {action.parameter?.nama || `Parameter ${action.parameter_id}`}
                                </span>{' '}
                                <span className="text-muted-foreground">=</span>{' '}
                                <span className="font-medium">{action.value}</span>
                                {action.parameter?.unit && (
                                  <span className="text-muted-foreground"> {action.parameter.unit}</span>
                                )}
                                <span className="text-muted-foreground"> [DYNAMIC]</span>
                              </>
                            )}
                            {action.action_type === 'write' && (
                              <>
                                <span className="font-medium">Tulis</span>{' '}
                                <span className="text-muted-foreground">ke</span>{' '}
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
                                <span className="font-medium">Kirim Event:</span>{' '}
                                <span className="font-medium">{action.event_name}</span>
                              </>
                            )}
                            {action.action_type === 'delay' && (
                              <>
                                <span className="font-medium">Tunda:</span>{' '}
                                <span className="font-medium">{action.delay_ms}ms</span>
                              </>
                            )}
                            {action.action_type === 'alarm' && (
                              <>
                                <span className="font-medium">Alarm:</span>{' '}
                                <span className="font-medium">{action.alarm_message || 'Tidak ada pesan'}</span>
                              </>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="text-sm text-muted-foreground italic">Tidak ada aksi yang didefinisikan</div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open)
          if (!open) {
            setWorkflowToDelete(null)
          }
        }}
        onConfirm={handleConfirmDelete}
        title="Hapus Workflow"
        description="Apakah Anda yakin ingin menghapus workflow ini? Tindakan ini tidak dapat dibatalkan."
        itemName={workflowToDelete?.nama}
        isDeleting={deleteMutation.isPending}
        error={null}
      />
    </div>
  )
}

