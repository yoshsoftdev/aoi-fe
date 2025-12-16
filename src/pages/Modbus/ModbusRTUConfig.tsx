import { useQuery } from '@tanstack/react-query'
import { modbusService } from '@/services/modbusService'

export default function ModbusRTUConfig() {
  const { data: configs, isLoading } = useQuery({
    queryKey: ['modbus-rtu'],
    queryFn: modbusService.getAllRTU,
  })

  if (isLoading) {
    return <div>Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-800">Modbus RTU Configuration</h1>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
          Add Configuration
        </button>
      </div>

      <div className="space-y-4">
        {configs?.map((config) => (
          <div key={config.id} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">
                {config.parameter?.nama || `Config #${config.id}`}
              </h3>
              <div className="flex space-x-2">
                <button className="text-blue-600 hover:text-blue-900">Edit</button>
                <button className="text-red-600 hover:text-red-900">Delete</button>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Port:</span>
                <span className="ml-2 font-medium">{config.port}</span>
              </div>
              <div>
                <span className="text-gray-600">Baud:</span>
                <span className="ml-2 font-medium">{config.baud}</span>
              </div>
              <div>
                <span className="text-gray-600">Slave ID:</span>
                <span className="ml-2 font-medium">{config.slave_id}</span>
              </div>
              <div>
                <span className="text-gray-600">Polling:</span>
                <span className="ml-2 font-medium">{config.polling_ms}ms</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {(!configs || configs.length === 0) && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-500">No Modbus RTU configurations found.</p>
        </div>
      )}
    </div>
  )
}

