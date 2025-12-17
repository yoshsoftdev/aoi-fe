import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface StatusBadgeProps {
  status: 'online' | 'offline' | 'error' | 'connecting'
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const variants = {
    online: { label: 'Online', className: 'bg-green-500/10 text-green-500 border-green-500/20' },
    connecting: { label: 'Connecting', className: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' },
    offline: { label: 'Offline', className: 'bg-muted text-muted-foreground border-border' },
    error: { label: 'Error', className: 'bg-destructive/10 text-destructive border-destructive/20' },
  }

  const { label, className: statusClassName } = variants[status] || variants.offline

  return (
    <Badge variant="outline" className={cn(statusClassName, className)}>
      {label}
    </Badge>
  )
}

