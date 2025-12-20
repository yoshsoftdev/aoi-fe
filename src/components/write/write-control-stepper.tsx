import { Stepper } from '@/components/stepper'

interface WriteControlViewStepperProps {
  currentStep: number
  onStepClick: (step: number) => void
  canProceedToStep2: boolean
  canProceedToStep3: boolean
  canProceedToStep4: boolean
}

export function WriteControlViewStepper({
  currentStep,
  onStepClick,
  canProceedToStep2,
  canProceedToStep3,
  canProceedToStep4,
}: WriteControlViewStepperProps) {
  const steps = [
    {
      title: 'Connection Setup',
      description: 'Configure transport layer',
      disabled: false,
    },
    {
      title: 'Select OR Create Write Parameter',
      description: 'Select or create writable parameter',
      disabled: !canProceedToStep2,
    },
    {
      title: 'Write Value',
      description: 'Choose preset or manual',
      disabled: !canProceedToStep3,
    },
    {
      title: 'Execute Write',
      description: 'Review and execute',
      disabled: !canProceedToStep4,
    },
  ]

  return <Stepper steps={steps} currentStep={currentStep} onStepClick={onStepClick} />
}

