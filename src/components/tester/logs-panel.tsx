import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Trash2, AlertCircle, CheckCircle2, Info, AlertTriangle } from 'lucide-react'
import type { LogEntry } from '@/types'

interface LogsPanelProps {
  logs: LogEntry[]
  onClear: () => void
}

export function LogsPanel({ logs, onClear }: LogsPanelProps) {
  const getIcon = (type: LogEntry['type']) => {
    switch (type) {
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      default:
        return <Info className="h-4 w-4 text-blue-500" />
    }
  }

  const getTypeColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'error':
        return 'border-l-red-500'
      case 'success':
        return 'border-l-green-500'
      case 'warning':
        return 'border-l-yellow-500'
      default:
        return 'border-l-blue-500'
    }
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-border bg-card/50">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Activity Logs</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{logs.length} entries</p>
          </div>
          <Button size="sm" variant="ghost" onClick={onClear} disabled={logs.length === 0}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Info className="h-10 w-10 text-muted-foreground mb-3 opacity-50" />
              <p className="text-sm text-muted-foreground">No activity logs yet</p>
              <p className="text-xs text-muted-foreground mt-1">Actions will be logged here</p>
            </div>
          ) : (
            logs.map((log) => (
              <Card key={log.id} className={`bg-card border-l-2 ${getTypeColor(log.type)}`}>
                <CardContent className="p-3">
                  <div className="flex gap-3">
                    <div className="mt-0.5 flex-shrink-0">{getIcon(log.type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="text-xs text-muted-foreground font-mono">
                          {log.timestamp.toLocaleTimeString()}
                        </div>
                        {log.slaveId !== undefined && (
                          <Badge variant="outline" className="text-xs px-1.5 py-0 h-5">
                            Slave {log.slaveId}
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-foreground leading-relaxed">{log.message}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

