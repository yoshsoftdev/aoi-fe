import { useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ParameterChart } from './parameter-chart'
import { useParameterHistory } from '@/hooks/useParameterHistory'
import type { DashboardData } from '@/types/parameter'

interface ParameterChartDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  parameter: DashboardData | null
}

export function ParameterChartDialog({
  open,
  onOpenChange,
  parameter,
}: ParameterChartDialogProps) {
  const parameterId = parameter?.parameter_id
  const { history, currentValue, dataPointCount } = useParameterHistory({
    parameterId,
    maxDataPoints: 200, // Keep last 200 data points
  })

  if (!parameter) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{parameter.parameter_nama || `Parameter ${parameter.parameter_id}`}</DialogTitle>
          <DialogDescription>
            {parameter.device_nama || 'Device'} • Real-time data chart
            {currentValue && (
              <span className="ml-2 text-primary font-medium">
                Current: {typeof currentValue.value === 'number' ? currentValue.value.toFixed(2) : currentValue.value}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>
        
        <div className="mt-4">
          {history.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              <p>Waiting for data... ({dataPointCount} points collected)</p>
            </div>
          ) : (
            <ParameterChart
              data={history}
              parameterName={parameter.parameter_nama || `Parameter ${parameter.parameter_id}`}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

