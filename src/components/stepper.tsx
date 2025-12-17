import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Step {
  title: string
  description: string
  disabled: boolean
}

interface StepperProps {
  steps: Step[]
  currentStep: number
  onStepClick: (index: number) => void
}

export function Stepper({ steps, currentStep, onStepClick }: StepperProps) {
  return (
    <div className="flex items-center justify-between">
      {steps.map((step, index) => {
        const isActive = index === currentStep
        const isCompleted = index < currentStep
        const isDisabled = step.disabled && !isCompleted

        return (
          <div key={index} className="flex flex-1 items-center">
            <button
              onClick={() => !isDisabled && onStepClick(index)}
              disabled={isDisabled}
              className={cn(
                'flex items-center gap-3 transition-opacity',
                isDisabled && 'cursor-not-allowed opacity-40'
              )}
            >
              <div
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-full border-2 font-semibold transition-all',
                  isCompleted && 'border-primary bg-primary text-primary-foreground',
                  isActive && 'border-primary bg-primary/10 text-primary',
                  !isActive && !isCompleted && 'border-border bg-card text-muted-foreground'
                )}
              >
                {isCompleted ? <Check className="h-5 w-5" /> : index + 1}
              </div>
              <div className="text-left">
                <div
                  className={cn(
                    'text-sm font-medium',
                    isActive && 'text-foreground',
                    !isActive && 'text-muted-foreground'
                  )}
                >
                  {step.title}
                </div>
                <div className="text-xs text-muted-foreground">{step.description}</div>
              </div>
            </button>
            {index < steps.length - 1 && (
              <div className={cn('mx-4 h-0.5 flex-1 bg-border', isCompleted && 'bg-primary')} />
            )}
          </div>
        )
      })}
    </div>
  )
}

