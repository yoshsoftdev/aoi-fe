import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { alarmService, type CurrentAlarm } from '@/services/alarmService'

export const useAlarms = () => {
  const queryClient = useQueryClient()
  const [alarms, setAlarms] = useState<CurrentAlarm[]>([])

  // Fetch alarms from API
  const { data, isLoading, error } = useQuery({
    queryKey: ['alarms'],
    queryFn: () => alarmService.getAll(),
    refetchInterval: 5000, // Refresh every 5 seconds
  })

  // Update local state when data changes
  useEffect(() => {
    if (data) {
      setAlarms(data)
    }
  }, [data])

  // Listen for alarm updates from WebSocket
  useEffect(() => {
    const handleAlarmUpdated = () => {
      // Refresh alarms when alarm is created/updated
      queryClient.invalidateQueries({ queryKey: ['alarms'] })
    }

    const handleAlarmRemoved = (event: CustomEvent) => {
      const { workflowId } = event.detail
      // Remove alarm from local state immediately
      setAlarms(prev => prev.filter(alarm => alarm.workflow_id !== workflowId))
      // Also refresh from API to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['alarms'] })
    }

    window.addEventListener('alarm-updated', handleAlarmUpdated as EventListener)
    window.addEventListener('alarm-removed', handleAlarmRemoved as EventListener)

    return () => {
      window.removeEventListener('alarm-updated', handleAlarmUpdated as EventListener)
      window.removeEventListener('alarm-removed', handleAlarmRemoved as EventListener)
    }
  }, [queryClient])

  const deleteAlarm = async (id: number) => {
    await alarmService.deleteById(id)
    queryClient.invalidateQueries({ queryKey: ['alarms'] })
  }

  return {
    alarms,
    isLoading,
    error,
    deleteAlarm,
    refresh: () => queryClient.invalidateQueries({ queryKey: ['alarms'] }),
  }
}

