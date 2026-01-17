import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, X, Clock } from 'lucide-react'
import { useAlarms } from '@/hooks/useAlarms'

const formatTimeAgo = (dateString: string): string => {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSecs < 60) {
    return `${diffSecs} detik yang lalu`
  } else if (diffMins < 60) {
    return `${diffMins} menit yang lalu`
  } else if (diffHours < 24) {
    return `${diffHours} jam yang lalu`
  } else {
    return `${diffDays} hari yang lalu`
  }
}

export function AlarmList() {
  const { alarms, isLoading, deleteAlarm } = useAlarms()

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Alarm Aktif</CardTitle>
          <CardDescription>Memuat alarm...</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (alarms.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-green-500" />
            Alarm Aktif
          </CardTitle>
          <CardDescription>Tidak ada alarm aktif</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-red-500" />
          Alarm Aktif
          <Badge variant="destructive" className="ml-2">
            {alarms.length}
          </Badge>
        </CardTitle>
        <CardDescription>Daftar alarm yang sedang aktif</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {alarms.map((alarm) => (
            <div
              key={alarm.id}
              className="flex items-start justify-between p-3 border rounded-lg bg-red-50 border-red-200"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  <span className="font-semibold text-red-900">{alarm.workflow_name}</span>
                </div>
                <p className="text-sm text-gray-700 mb-2">{alarm.alarm_message}</p>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  {alarm.parameter_name && (
                    <span>Parameter: {alarm.parameter_name}</span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatTimeAgo(alarm.triggered_at)}
                  </span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => deleteAlarm(alarm.id)}
                className="text-red-600 hover:text-red-700 hover:bg-red-100"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

