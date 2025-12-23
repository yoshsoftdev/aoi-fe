import { Stepper } from '@/components/stepper'

interface WriteControlViewStepperProps {
  currentStep: number
  onStepClick: (step: number) => void
  canProceedToStep2: boolean
}

export function WriteControlViewStepper({
  currentStep,
  onStepClick,
  canProceedToStep2,
}: WriteControlViewStepperProps) {
  const steps = [
    {
      title: 'Connection Setup',
      description: 'Configure transport layer',
      disabled: false,
    },
    {
      title: 'Write Configuration',
      description: 'Configure write parameters',
      disabled: !canProceedToStep2,
    },
  ]

  return <Stepper steps={steps} currentStep={currentStep} onStepClick={onStepClick} />
}

