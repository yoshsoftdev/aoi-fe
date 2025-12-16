import { useWebSocket } from '@/hooks/useWebSocket'
import { DashboardData } from '@/types/parameter'
import { formatNumber } from '@/utils/formatters'

export default function Dashboard() {
  const { data: dashboardData, connected } = useWebSocket()

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-green-500'
      case 'error':
        return 'bg-red-500'
      default:
        return 'bg-gray-500'
    }
  }

  // Convert Map to Array for rendering
  const dataArray = Array.from(dashboardData.values())

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-800">Dashboard</h1>
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-sm text-gray-600">
            {connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {dataArray.map((item, index) => (
          <div key={`${item.device_nama}_${item.parameter_nama}_${index}`} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-800">{item.parameter_nama}</h3>
                <p className="text-sm text-gray-500">{item.device_nama}</p>
              </div>
              <div className={`w-3 h-3 rounded-full ${getStatusColor(item.status || 'offline')}`} />
            </div>
            <div className="space-y-2">
              {item.value !== null && item.value !== undefined ? (
                <>
                  <div className="text-center py-4">
                    <span className="text-3xl font-bold text-blue-600">
                      {formatNumber(item.value)}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 text-center">
                    Updated: {new Date(item.timestamp).toLocaleTimeString()}
                  </div>
                </>
              ) : (
                <div className="text-sm text-gray-400 text-center py-4">
                  {item.status === 'error' ? 'Error reading data' : 'No data available'}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {dataArray.length === 0 && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-500">No data available yet.</p>
          <p className="text-sm text-gray-400 mt-2">
            Data will appear here once parameters are configured and polling starts.
          </p>
        </div>
      )}
    </div>
  )
}

