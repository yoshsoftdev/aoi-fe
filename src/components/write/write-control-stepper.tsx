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
      title: 'Pengaturan Koneksi',
      description: 'Konfigurasi lapisan transport',
      disabled: false,
    },
    {
      title: 'Konfigurasi Tulis',
      description: 'Konfigurasi parameter tulis',
      disabled: !canProceedToStep2,
    },
  ]

  return <Stepper steps={steps} currentStep={currentStep} onStepClick={onStepClick} />
}

