import { useWebSocket } from '@/hooks/useWebSocket'
import { DashboardData } from '@/types/parameter'
import { formatNumber } from '@/utils/formatters'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Activity, Database, Network } from 'lucide-react'

export default function Dashboard() {
  const { data: dashboardData, connected } = useWebSocket()

  // Convert Map to Array for rendering
  const dataArray = Array.from(dashboardData.values())

  // Group by device (use parameter_nama as fallback if device_nama is empty)
  const groupedByDevice = dataArray.reduce((acc, item) => {
    // Use device_nama if available, otherwise group by "All Devices" or use parameter name prefix
    const deviceKey = item.device_nama || 'All Devices'
    if (!acc[deviceKey]) {
      acc[deviceKey] = []
    }
    acc[deviceKey].push(item)
    return acc
  }, {} as Record<string, DashboardData[]>)

  const totalMetrics = dataArray.length
  const latestUpdate = dataArray.length > 0 ? new Date(dataArray[0].timestamp) : null
  const onlineCount = dataArray.filter(item => item.status === 'online').length
  const successRate = dataArray.length > 0 ? (onlineCount / dataArray.length) * 100 : 0

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Dashboard</h2>
        <p className="text-sm text-muted-foreground mt-1">Monitor your mapped data values</p>
      </div>

      {dataArray.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <Database className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="font-medium text-foreground">No data available yet</p>
            <p className="text-sm text-muted-foreground mt-2">
              Configure parameters and start polling to see data here
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Metrics</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalMetrics}</div>
                <p className="text-xs text-muted-foreground">Active parameters</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Connection Status</CardTitle>
                <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{connected ? 'Connected' : 'Disconnected'}</div>
                <p className="text-xs text-muted-foreground">
                  {latestUpdate ? latestUpdate.toLocaleTimeString() : 'No updates yet'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{successRate.toFixed(0)}%</div>
                <p className="text-xs text-muted-foreground">Parameters online</p>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            {Object.entries(groupedByDevice).map(([deviceName, items]) => {
              const latestItem = items[0]
              return (
                <div key={deviceName} className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-border">
                    <Network className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-semibold text-foreground">{deviceName}</h3>
                    <Badge 
                      variant={latestItem.status === 'online' ? 'default' : 'destructive'}
                      className="ml-auto"
                    >
                      {latestItem.status || 'offline'}
                    </Badge>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {items.map((item, index) => (
                      <Card key={`${item.parameter_id}_${item.parameter_nama}_${index}`}>
                        <CardHeader>
                          <CardTitle className="text-base">{item.parameter_nama || `Parameter ${item.parameter_id}`}</CardTitle>
                          <CardDescription className="text-xs">
                            {item.device_nama || 'Device'}
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          {item.value !== null && item.value !== undefined ? (
                            <div>
                              <p className="text-3xl font-bold text-primary">
                                {formatNumber(item.value, 2)}
                              </p>
                              <div className="mt-3 pt-3 border-t border-border">
                                <p className="text-xs text-muted-foreground">
                                  Updated: {new Date(item.timestamp).toLocaleTimeString()}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div className="text-destructive">
                              <p className="text-sm font-medium">Error</p>
                              <p className="text-xs">
                                {item.status === 'error' ? 'Error reading data' : 'No data available'}
                              </p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
