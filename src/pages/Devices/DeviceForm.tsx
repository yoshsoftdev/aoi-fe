import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { deviceService } from '@/services/deviceService'
import { Device, DeviceCreateRequest } from '@/types/device'
import { ArrowLeft } from 'lucide-react'

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

  const deviceTypes = [
    { value: 'modbus_rtu', label: 'Modbus RTU' },
    { value: 'modbus_tcp', label: 'Modbus TCP' },
    { value: 'snmp', label: 'SNMP' },
    { value: 'analog', label: 'Analog' },
    { value: 'digital', label: 'Digital' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <button
          onClick={() => navigate('/devices')}
          className="text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-3xl font-bold text-gray-800">
          {isEdit ? 'Edit Device' : 'Create New Device'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
        <div>
          <label htmlFor="nama" className="block text-sm font-medium text-gray-700 mb-2">
            Device Name *
          </label>
          <input
            type="text"
            id="nama"
            required
            value={formData.nama}
            onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., Modbus Device 1"
          />
        </div>

        <div>
          <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-2">
            Device Type *
          </label>
          <select
            id="type"
            required
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value as Device['type'] })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {deviceTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        {/* Modbus RTU Configuration */}
        {formData.type === 'modbus_rtu' && (
          <div className="border-t pt-4 space-y-4">
            <h3 className="text-lg font-semibold text-gray-800">Modbus RTU Configuration</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Port *</label>
                <input
                  type="text"
                  required
                  value={formData.port || ''}
                  onChange={(e) => setFormData({ ...formData, port: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="/dev/ttyUSB0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Baud Rate *</label>
                <input
                  type="number"
                  required
                  value={formData.baud || ''}
                  onChange={(e) => setFormData({ ...formData, baud: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="9600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data Bits *</label>
                <input
                  type="number"
                  required
                  value={formData.data_bits || 8}
                  onChange={(e) => setFormData({ ...formData, data_bits: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Parity *</label>
                <select
                  required
                  value={formData.parity || 'N'}
                  onChange={(e) => setFormData({ ...formData, parity: e.target.value as 'N' | 'E' | 'O' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="N">N (None)</option>
                  <option value="E">E (Even)</option>
                  <option value="O">O (Odd)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stop Bits *</label>
                <input
                  type="number"
                  required
                  value={formData.stop_bits || 1}
                  onChange={(e) => setFormData({ ...formData, stop_bits: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Slave ID *</label>
                <input
                  type="number"
                  required
                  value={formData.slave_id || ''}
                  onChange={(e) => setFormData({ ...formData, slave_id: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="1"
                />
              </div>
            </div>
          </div>
        )}

        {/* Modbus TCP Configuration */}
        {formData.type === 'modbus_tcp' && (
          <div className="border-t pt-4 space-y-4">
            <h3 className="text-lg font-semibold text-gray-800">Modbus TCP Configuration</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">IP Address *</label>
                <input
                  type="text"
                  required
                  value={formData.ip_address || ''}
                  onChange={(e) => setFormData({ ...formData, ip_address: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="192.168.1.100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">TCP Port *</label>
                <input
                  type="number"
                  required
                  value={formData.tcp_port || 502}
                  onChange={(e) => setFormData({ ...formData, tcp_port: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Slave ID *</label>
                <input
                  type="number"
                  required
                  value={formData.slave_id || ''}
                  onChange={(e) => setFormData({ ...formData, slave_id: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="1"
                />
              </div>
            </div>
          </div>
        )}

        {/* Polling Configuration */}
        <div className="border-t pt-4 space-y-4">
          <h3 className="text-lg font-semibold text-gray-800">Polling Configuration</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Polling Interval (ms) *</label>
              <input
                type="number"
                required
                value={formData.polling_ms || 1000}
                onChange={(e) => setFormData({ ...formData, polling_ms: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Timeout (ms) *</label>
              <input
                type="number"
                required
                value={formData.timeout_ms || 1000}
                onChange={(e) => setFormData({ ...formData, timeout_ms: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Retry Count *</label>
              <input
                type="number"
                required
                value={formData.retry_count || 3}
                onChange={(e) => setFormData({ ...formData, retry_count: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={formData.enabled}
              onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">Device Enabled</span>
          </label>
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
            Description
          </label>
          <textarea
            id="description"
            value={formData.description || ''}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
            placeholder="Optional device description"
          />
        </div>

        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={() => navigate('/devices')}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {mutation.isPending ? 'Saving...' : isEdit ? 'Update Device' : 'Create Device'}
          </button>
        </div>
      </form>
    </div>
  )
}

