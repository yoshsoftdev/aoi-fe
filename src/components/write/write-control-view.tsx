import { useState } from 'react'
import { ConnectionStep } from '@/components/steps/connection-step'
import { WriteConfigStep } from '@/components/steps/write-config-step'
import { LogsPanel } from '@/components/tester/logs-panel'
import type { Connection, LogEntry } from '@/types'

interface WriteControlViewProps {
  currentStep?: number
  setCurrentStep?: (step: number) => void
  onStepChange?: (step: number) => void
  onConnectionChange?: (connection: Connection | null) => void
  onParameterSelected?: (parameter: any) => void
  onValueReady?: () => void
}

export function WriteControlView({
  currentStep: externalCurrentStep,
  setCurrentStep: externalSetCurrentStep,
  onStepChange,
  onConnectionChange,
  onParameterSelected,
  onValueReady,
}: WriteControlViewProps = {}) {
  const [internalStep, setInternalStep] = useState(0)
  const currentStep = externalCurrentStep !== undefined ? externalCurrentStep : internalStep
  const setCurrentStep = (step: number) => {
    if (externalSetCurrentStep) {
      externalSetCurrentStep(step)
    } else {
      setInternalStep(step)
    }
    onStepChange?.(step)
  }
  const [connections, setConnections] = useState<Connection[]>([])
  const [activeConnection, setActiveConnection] = useState<Connection | null>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])

  const addLog = (
    message: string,
    type: 'info' | 'error' | 'success' | 'warning' = 'info',
    connectionId?: string,
    slaveId?: number
  ) => {
    setLogs((prev) => [
      {
        id: Date.now().toString() + Math.random(),
        timestamp: new Date(),
        message,
        type,
        connectionId,
        slaveId,
      },
      ...prev
    ])
  }


  return (
    <div className="flex flex-1 h-full">
      {/* Step Content */}
      <main className="flex-1 overflow-y-auto p-6">
          {currentStep === 0 && (
            <ConnectionStep
              connections={connections}
              setConnections={setConnections}
              activeConnection={activeConnection}
              setActiveConnection={(conn) => {
                setActiveConnection(conn)
                onConnectionChange?.(conn)
              }}
              addLog={addLog}
              onProceed={() => setCurrentStep(1)}
            />
          )}

          {currentStep === 1 && activeConnection && (
            <WriteConfigStep
              activeConnection={activeConnection}
              addLog={addLog}
            />
          )}
      </main>

      {/* Logs Panel */}
      <aside className="w-96 border-l border-border bg-card overflow-y-auto">
        <LogsPanel logs={logs} onClear={() => setLogs([])} />
      </aside>
    </div>
  )
}
