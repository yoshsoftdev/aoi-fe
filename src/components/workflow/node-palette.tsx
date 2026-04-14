import { Activity, Target, GitBranch, Bell, Pencil, Zap, Clock } from 'lucide-react'
import type { NodePaletteItem } from '@/types/workflow-builder'

const NODE_PALETTE: NodePaletteItem[] = [
  {
    type: 'trigger',
    subType: 'start',
    label: 'Start',
    description: 'Runs continuously after workflow is loaded',
    icon: 'activity',
  },
  {
    type: 'trigger',
    subType: 'parameter-changed',
    label: 'Parameter Changed',
    description: 'Fires when a parameter value changes',
    icon: 'activity',
  },
  {
    type: 'trigger',
    subType: 'setpoint-changed',
    label: 'Set-Point Changed',
    description: 'Fires when a set-point is modified',
    icon: 'target',
  },
  {
    type: 'condition',
    subType: 'if-condition',
    label: 'IF Condition',
    description: 'Branch based on a condition',
    icon: 'git-branch',
  },
  {
    type: 'condition',
    subType: 'time-window',
    label: 'Time Window Condition',
    description: 'Check if current time is within a time range',
    icon: 'clock',
  },
  {
    type: 'condition',
    subType: 'parameter-status',
    label: 'Parameter Status',
    description: 'Check if parameter is online or offline',
    icon: 'activity',
  },
  {
    type: 'action',
    subType: 'alarm-notification',
    label: 'Alarm Notification',
    description: 'Send an alarm notification',
    icon: 'bell',
  },
  {
    type: 'action',
    subType: 'write-dynamic',
    label: 'Write Dynamic Value',
    description: 'Write a value to a target parameter',
    icon: 'pencil',
  },
  {
    type: 'action',
    subType: 'trigger-preset',
    label: 'Trigger Preset',
    description: 'Execute a predefined preset action',
    icon: 'zap',
  },
  {
    type: 'timer',
    subType: 'delay',
    label: 'Timer',
    description: 'Delay before continuing to next node',
    icon: 'clock',
  },
]

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  activity: Activity,
  target: Target,
  'git-branch': GitBranch,
  bell: Bell,
  pencil: Pencil,
  zap: Zap,
  clock: Clock,
}

const sectionColors: Record<string, { bg: string; border: string; dot: string }> = {
  trigger: {
    bg: 'bg-primary/10',
    border: 'border-primary/20 hover:border-primary/50',
    dot: 'bg-primary',
  },
  condition: {
    bg: 'bg-accent/10',
    border: 'border-accent/20 hover:border-accent/50',
    dot: 'bg-accent',
  },
  action: {
    bg: 'bg-success/10',
    border: 'border-success/20 hover:border-success/50',
    dot: 'bg-success',
  },
  timer: {
    bg: 'bg-warning/10',
    border: 'border-warning/20 hover:border-warning/50',
    dot: 'bg-warning',
  },
}

const sectionLabels: Record<string, string> = {
  trigger: 'Trigger Nodes',
  condition: 'Condition Nodes',
  action: 'Action Nodes',
  timer: 'Timer Nodes',
}

function PaletteCard({ item }: { item: NodePaletteItem }) {
  const Icon = iconMap[item.icon] || Activity
  const colors = sectionColors[item.type]

  const onDragStart = (event: React.DragEvent) => {
    event.dataTransfer.setData('application/reactflow-type', item.type)
    event.dataTransfer.setData('application/reactflow-subtype', item.subType)
    event.dataTransfer.setData('application/reactflow-label', item.label)
    event.dataTransfer.setData('application/reactflow-description', item.description)
    event.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className={`flex cursor-grab items-center gap-3 rounded-lg border p-3 transition-all duration-200 active:cursor-grabbing ${colors.border} ${colors.bg} hover:shadow-md`}
    >
      <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md ${colors.bg}`}>
        <Icon className="h-4 w-4 text-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{item.label}</p>
        <p className="truncate text-xs text-muted-foreground">{item.description}</p>
      </div>
    </div>
  )
}

export function NodePalette() {
  const grouped = NODE_PALETTE.reduce(
    (acc, item) => {
      if (!acc[item.type]) acc[item.type] = []
      acc[item.type].push(item)
      return acc
    },
    {} as Record<string, NodePaletteItem[]>
  )

  return (
    <aside className="flex h-full w-[260px] flex-shrink-0 flex-col border-r border-border bg-card">
      <div className="border-b border-border px-4 py-4">
        <h1 className="text-lg font-bold text-foreground">Workflow Builder</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">Drag nodes to the canvas</p>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-6">
          {(['trigger', 'condition', 'action', 'timer'] as const).map((type) => (
            <div key={type}>
              <div className="mb-2 flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${sectionColors[type].dot}`} />
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {sectionLabels[type]}
                </h2>
              </div>
              <div className="space-y-2">
                {grouped[type]?.map((item) => (
                  <PaletteCard key={item.subType} item={item} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}
