import { Save, Play, AlertTriangle, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'

interface TopBarProps {
  workflowName: string
  onNameChange: (name: string) => void
  enabled: boolean
  onEnabledChange: (enabled: boolean) => void
  validationErrors: string[]
  onSave: () => void
  onTest: () => void
  onCancel?: () => void
}

export function TopBar({
  workflowName,
  onNameChange,
  enabled,
  onEnabledChange,
  validationErrors,
  onSave,
  onTest,
  onCancel,
}: TopBarProps) {
  return (
    <header className="sticky top-0 z-50 flex h-14 flex-shrink-0 items-center justify-between border-b border-border bg-card px-4">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
            <svg
              className="h-4 w-4 text-primary-foreground"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
            </svg>
          </div>
          <Input
            value={workflowName}
            onChange={(e) => onNameChange(e.target.value)}
            className="h-8 w-56 border-border bg-secondary text-sm font-medium text-foreground"
            aria-label="Workflow name"
          />
        </div>

        {validationErrors.length > 0 && (
          <div className="flex items-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-1">
            <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
            <span className="text-xs font-medium text-destructive">{validationErrors[0]}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Label htmlFor="workflow-toggle" className="text-xs text-muted-foreground">
            {enabled ? 'Enabled' : 'Disabled'}
          </Label>
          <Switch id="workflow-toggle" checked={enabled} onCheckedChange={onEnabledChange} />
        </div>
        <div className="h-6 w-px bg-border" />
        {onCancel && (
          <Button variant="outline" size="sm" onClick={onCancel} className="gap-1.5">
            <X className="h-3.5 w-3.5" />
            Cancel
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={onTest}
          className="gap-1.5 border-border bg-secondary text-foreground hover:bg-muted"
        >
          <Play className="h-3.5 w-3.5" />
          Test
        </Button>
        <Button
          size="sm"
          onClick={onSave}
          disabled={validationErrors.length > 0}
          className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Save className="h-3.5 w-3.5" />
          Save
        </Button>
      </div>
    </header>
  )
}
