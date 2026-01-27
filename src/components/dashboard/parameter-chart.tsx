import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { HistoryDataPoint } from '@/hooks/useParameterHistory'
import { formatNumber } from '@/utils/formatters'

interface ParameterChartProps {
  data: HistoryDataPoint[]
  parameterName: string
}

export function ParameterChart({ data, parameterName }: ParameterChartProps) {
  // Format data for recharts
  const chartData = data.map(point => ({
    time: point.timestamp.toLocaleTimeString(),
    timestamp: point.timestamp.getTime(),
    value: typeof point.value === 'number' ? point.value : 0,
    status: point.status,
  }))

  // Calculate min/max for Y-axis with some padding
  const values = chartData.map(d => d.value)
  const minValue = Math.min(...values)
  const maxValue = Math.max(...values)
  const padding = (maxValue - minValue) * 0.1 || 1
  const yAxisDomain = [
    minValue - padding,
    maxValue + padding,
  ]

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium text-foreground">{data.time}</p>
          <p className="text-sm text-primary">
            Value: <span className="font-bold">{formatNumber(data.value, 2)}</span>
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Status: {data.status}
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="w-full h-[600px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 10, right: 30, left: 20, bottom: 20 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="time"
            className="text-xs"
            tick={{ fill: 'currentColor' }}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={yAxisDomain}
            className="text-xs"
            tick={{ fill: 'currentColor' }}
            tickFormatter={(value) => formatNumber(value, 2)}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Line
            type="monotone"
            dataKey="value"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={false}
            name={parameterName}
            isAnimationActive={false} // Disable animation for real-time updates
          />
        </LineChart>
      </ResponsiveContainer>
      
      <div className="mt-4 text-xs text-muted-foreground text-center">
        Showing {data.length} data points • Auto-updating via WebSocket
      </div>
    </div>
  )
}

