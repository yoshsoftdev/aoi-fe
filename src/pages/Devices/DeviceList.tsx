import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { deviceService } from '@/services/deviceService'
import { useNavigate } from 'react-router-dom'
import { Plus, Edit, Trash2, Server } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/status-badge'
import { Badge } from '@/components/ui/badge'
import { DeleteConfirmationDialog } from '@/components/ui/delete-confirmation-dialog'
import { useAuth } from '@/contexts/AuthContext'
import type { Device } from '@/types/device'

export default function DeviceList() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { isAdmin } = useAuth()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deviceToDelete, setDeviceToDelete] = useState<Device | null>(null)

  const { data: devices, isLoading } = useQuery({
    queryKey: ['devices'],
    queryFn: deviceService.getAll,
  })

  const deleteMutation = useMutation({
    mutationFn: deviceService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] })
      setDeleteDialogOpen(false)
      setDeviceToDelete(null)
    },
  })

  const handleDelete = (device: Device) => {
    setDeviceToDelete(device)
    setDeleteDialogOpen(true)
  }

  const handleConfirmDelete = () => {
    if (!deviceToDelete) return
    deleteMutation.mutate(deviceToDelete.id)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-muted-foreground">Loading koneksi...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Koneksi</h2>
        <p className="text-sm text-muted-foreground mt-1">Kelola konfigurasi koneksi</p>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {devices?.length || 0} {devices?.length === 1 ? 'koneksi' : 'koneksi'}
        </div>
        {isAdmin && (
          <Button onClick={() => navigate('/devices/new')}>
            <Plus className="h-4 w-4 mr-2" />
            Koneksi Baru
          </Button>
        )}
      </div>

      {devices && devices.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <Server className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="font-medium text-foreground">Belum ada koneksi yang dikonfigurasi</p>
            <p className="text-sm text-muted-foreground mt-2">
              Klik "Koneksi Baru" untuk membuat koneksi pertama
            </p>
            {isAdmin && (
              <Button className="mt-4" onClick={() => navigate('/devices/new')}>
                Buat Koneksi Pertama
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {devices?.map((device) => (
            <Card key={device.id} className="hover:border-primary/50 transition-colors">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base truncate">{device.nama}</CardTitle>
                    <CardDescription className="mt-1">
                      <Badge variant="outline" className="text-xs">
                        {device.type}
                      </Badge>
                    </CardDescription>
                  </div>
                  <StatusBadge status={device.enabled ? 'online' : 'offline'} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Polling:</span>
                    <span className="font-medium">{device.polling_ms}ms</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Parameters:</span>
                    <span className="font-medium">{device.parameters?.length || 0}</span>
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex gap-2 mt-4 pt-4 border-t border-border">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => navigate(`/devices/${device.id}/edit`)}
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleDelete(device)}
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Hapus
                    </Button>
                  </div>
                )}
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
            setDeviceToDelete(null)
          }
        }}
        onConfirm={handleConfirmDelete}
        title="Hapus Device"
        description="Apakah Anda yakin ingin menghapus device ini? Semua parameter yang terkait juga akan dihapus. Tindakan ini tidak dapat dibatalkan."
        itemName={deviceToDelete?.nama}
        isDeleting={deleteMutation.isPending}
        error={null}
      />
    </div>
  )
}
