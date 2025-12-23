import { useState } from 'react'
import { ConnectionStep } from '@/components/steps/connection-step'
import { WriteConfigStep } from '@/components/steps/write-config-step'
import { WriteTestStep } from '@/components/steps/write-test-step'
import { WriteValueStep } from '@/components/steps/write-value-step'
import { ExecuteWriteStep } from '@/components/steps/execute-write-step'
import { LogsPanel } from '@/components/tester/logs-panel'
import type { Connection, LogEntry } from '@/types'
import type { Parameter } from '@/types/parameter'

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
  const [selectedParameter, setSelectedParameter] = useState<Parameter | null>(null)
  const [modbusConfig, setModbusConfig] = useState<{
    slaveId: number
    functionCode: number
    registerAddress: number
    quantity: number
    dataType: string
    byteOrder: string
  } | null>(null)
  const [writeMode, setWriteMode] = useState<'preset' | 'manual'>('manual')
  const [presetId, setPresetId] = useState<number | undefined>(undefined)
  const [registerValues, setRegisterValues] = useState<number[] | undefined>(undefined)

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

  const handleParameterSelected = (
    parameter: Parameter,
    config: {
      slaveId: number
      functionCode: number
      registerAddress: number
      quantity: number
      dataType: string
      byteOrder: string
    }
  ) => {
    setSelectedParameter(parameter)
    setModbusConfig(config)
    onParameterSelected?.(parameter)
  }

  const handleValueReady = (mode: 'preset' | 'manual', selectedPresetId?: number, values?: number[]) => {
    setWriteMode(mode)
    setPresetId(selectedPresetId)
    setRegisterValues(values)
    onValueReady?.()
  }

  const handleWriteComplete = (success: boolean) => {
    if (success) {
      addLog('Write operation completed successfully', 'success')
    }
  }

  const handleReset = () => {
    setCurrentStep(0)
    setSelectedParameter(null)
    setModbusConfig(null)
    setWriteMode('manual')
    setPresetId(undefined)
    setRegisterValues(undefined)
    addLog('Reset to start', 'info')
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
              onNext={() => setCurrentStep(2)}
            />
          )}

          {currentStep === 2 && activeConnection && (
            <WriteTestStep
              activeConnection={activeConnection}
              addLog={addLog}
              onParameterSelected={handleParameterSelected}
              onNext={() => setCurrentStep(3)}
            />
          )}

          {currentStep === 3 && selectedParameter && modbusConfig && (
            <WriteValueStep
              parameter={selectedParameter}
              config={modbusConfig}
              addLog={addLog}
              onValueReady={handleValueReady}
              onNext={() => setCurrentStep(4)}
            />
          )}

          {currentStep === 4 && selectedParameter && modbusConfig && (
            <ExecuteWriteStep
              parameter={selectedParameter}
              config={modbusConfig}
              writeMode={writeMode}
              presetId={presetId}
              registerValues={registerValues}
              addLog={addLog}
              onWriteComplete={handleWriteComplete}
              onReset={handleReset}
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
