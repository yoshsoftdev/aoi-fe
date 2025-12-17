import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { deviceService } from '@/services/deviceService'
import { Device, DeviceCreateRequest } from '@/types/device'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'

export default function DeviceForm() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const isEdit = !!id

  const { data: device } = useQuery({
    queryKey: ['device', id],
    queryFn: () => deviceService.getByID(Number(id!)),
    enabled: isEdit,
  })

  const [formData, setFormData] = useState<DeviceCreateRequest>({
    nama: '',
    type: 'modbus_rtu',
    enabled: true,
    polling_ms: 1000,
    timeout_ms: 1000,
    retry_count: 3,
  })

  useEffect(() => {
    if (device) {
      setFormData({
        nama: device.nama,
        type: device.type,
        enabled: device.enabled,
        description: device.description,
        port: device.port,
        baud: device.baud,
        data_bits: device.data_bits,
        parity: device.parity,
        stop_bits: device.stop_bits,
        ip_address: device.ip_address,
        tcp_port: device.tcp_port,
        slave_id: device.slave_id,
        polling_ms: device.polling_ms,
        timeout_ms: device.timeout_ms,
        retry_count: device.retry_count,
      })
    }
  }, [device])

  const mutation = useMutation({
    mutationFn: (data: DeviceCreateRequest) =>
      isEdit ? deviceService.update(Number(id!), data) : deviceService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] })
      navigate('/devices')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    mutation.mutate(formData)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/devices')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            {isEdit ? 'Edit Connection' : 'New Connection'}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {isEdit ? 'Update connection configuration' : 'Create a new connection'}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{isEdit ? 'Edit Connection' : 'New Connection'}</CardTitle>
          <CardDescription>
            Configure connection settings for {formData.type}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="nama">Connection Name *</Label>
              <Input
                id="nama"
                required
                value={formData.nama}
                onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                placeholder="e.g., Modbus Device 1"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Connection Type *</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData({ ...formData, type: value as Device['type'] })}
              >
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="modbus_rtu">Modbus RTU</SelectItem>
                  <SelectItem value="modbus_tcp">Modbus TCP</SelectItem>
                  <SelectItem value="snmp">SNMP</SelectItem>
                  <SelectItem value="analog">Analog</SelectItem>
                  <SelectItem value="digital">Digital</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Modbus RTU Configuration */}
            {formData.type === 'modbus_rtu' && (
              <>
                <Separator />
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold">Modbus RTU Configuration</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="port">Port *</Label>
                      <Input
                        id="port"
                        required
                        value={formData.port || ''}
                        onChange={(e) => setFormData({ ...formData, port: e.target.value })}
                        placeholder="/dev/ttyUSB0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="baud">Baud Rate *</Label>
                      <Select
                        value={formData.baud?.toString() || '9600'}
                        onValueChange={(value) => setFormData({ ...formData, baud: parseInt(value) })}
                      >
                        <SelectTrigger id="baud">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="9600">9600</SelectItem>
                          <SelectItem value="19200">19200</SelectItem>
                          <SelectItem value="38400">38400</SelectItem>
                          <SelectItem value="57600">57600</SelectItem>
                          <SelectItem value="115200">115200</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="data_bits">Data Bits *</Label>
                      <Select
                        value={formData.data_bits?.toString() || '8'}
                        onValueChange={(value) => setFormData({ ...formData, data_bits: parseInt(value) as 7 | 8 })}
                      >
                        <SelectTrigger id="data_bits">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="7">7</SelectItem>
                          <SelectItem value="8">8</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="parity">Parity *</Label>
                      <Select
                        value={formData.parity || 'N'}
                        onValueChange={(value) => setFormData({ ...formData, parity: value as 'N' | 'E' | 'O' })}
                      >
                        <SelectTrigger id="parity">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="N">N (None)</SelectItem>
                          <SelectItem value="E">E (Even)</SelectItem>
                          <SelectItem value="O">O (Odd)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="stop_bits">Stop Bits *</Label>
                      <Input
                        id="stop_bits"
                        type="number"
                        required
                        value={formData.stop_bits || 1}
                        onChange={(e) => setFormData({ ...formData, stop_bits: parseInt(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rtu_slave_id">Slave ID *</Label>
                      <Input
                        id="rtu_slave_id"
                        type="number"
                        required
                        value={formData.slave_id || ''}
                        onChange={(e) => setFormData({ ...formData, slave_id: parseInt(e.target.value) })}
                        placeholder="1"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Modbus TCP Configuration */}
            {formData.type === 'modbus_tcp' && (
              <>
                <Separator />
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold">Modbus TCP Configuration</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="ip_address">IP Address *</Label>
                      <Input
                        id="ip_address"
                        required
                        value={formData.ip_address || ''}
                        onChange={(e) => setFormData({ ...formData, ip_address: e.target.value })}
                        placeholder="192.168.1.100"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tcp_port">TCP Port *</Label>
                      <Input
                        id="tcp_port"
                        type="number"
                        required
                        value={formData.tcp_port || 502}
                        onChange={(e) => setFormData({ ...formData, tcp_port: parseInt(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tcp_slave_id">Slave ID *</Label>
                      <Input
                        id="tcp_slave_id"
                        type="number"
                        required
                        value={formData.slave_id || ''}
                        onChange={(e) => setFormData({ ...formData, slave_id: parseInt(e.target.value) })}
                        placeholder="1"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Polling Configuration */}
            <Separator />
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Polling Configuration</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="polling_ms">Polling Interval (ms) *</Label>
                  <Input
                    id="polling_ms"
                    type="number"
                    required
                    value={formData.polling_ms || 1000}
                    onChange={(e) => setFormData({ ...formData, polling_ms: parseInt(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timeout_ms">Timeout (ms) *</Label>
                  <Input
                    id="timeout_ms"
                    type="number"
                    required
                    value={formData.timeout_ms || 1000}
                    onChange={(e) => setFormData({ ...formData, timeout_ms: parseInt(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="retry_count">Retry Count *</Label>
                  <Input
                    id="retry_count"
                    type="number"
                    required
                    value={formData.retry_count || 3}
                    onChange={(e) => setFormData({ ...formData, retry_count: parseInt(e.target.value) })}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="enabled"
                checked={formData.enabled}
                onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
              />
              <Label htmlFor="enabled" className="cursor-pointer">
                Connection Enabled
              </Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                placeholder="Optional connection description"
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="secondary" onClick={() => navigate('/devices')}>
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Saving...' : isEdit ? 'Update' : 'Create'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
