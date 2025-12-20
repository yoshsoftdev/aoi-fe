import { useMemo, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Stepper } from '@/components/stepper'
import { ConnectionStep } from '@/components/steps/connection-step'
import { TestStep } from '@/components/steps/test-step'
import { DataMappingStep } from '@/components/steps/data-mapping-step'
import { DashboardView } from '@/components/dashboard/dashboard-view'
import { LogsPanel } from '@/components/tester/logs-panel'
import { WriteControlView } from '@/components/write/write-control-view'
import { WriteControlViewStepper } from '@/components/write/write-control-stepper'
import { WorkflowView } from '@/components/workflow/workflow-view'
import { Activity, LayoutDashboard, TestTube2, PenTool, Menu, X, Workflow } from 'lucide-react'
import type { Connection, LogEntry, RawDataField, SavedDashboardData, MappedValue, DashboardData } from '@/types'
import { cn } from '@/lib/utils'
import { useWebSocket } from '@/hooks/useWebSocket'

const queryClient = new QueryClient()

function App() {
  const [currentView, setCurrentView] = useState<'dashboard' | 'tester' | 'write' | 'workflow'>('dashboard')
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

  // Tester state
  const [currentStep, setCurrentStep] = useState(0)
  const [connections, setConnections] = useState<Connection[]>([])
  const [activeConnection, setActiveConnection] = useState<Connection | null>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [rawData, setRawData] = useState<RawDataField[]>([])
  const [savedDashboardData, setSavedDashboardData] = useState<SavedDashboardData[]>([])
  // Store test configuration from TestStep for use in DataMappingStep
  const [testConfig, setTestConfig] = useState<{
    slaveId?: number
    functionCode?: number
    registerAddress?: number
    quantity?: number
    dataType?: string
    byteOrder?: string
    oid?: string
  } | null>(null)

  // Write Control state
  const [writeStep, setWriteStep] = useState(0)
  const [writeActiveConnection, setWriteActiveConnection] = useState<Connection | null>(null)
  const [writeSelectedParameter, setWriteSelectedParameter] = useState<any>(null)
  const [writeValueReady, setWriteValueReady] = useState(false)

  // Live data from backend via WebSocket
  const { data: wsData } = useWebSocket()

  const liveDashboardData: SavedDashboardData[] = useMemo(() => {
    // Group WebSocket data by device_nama (or "All Devices" if empty)
    const groupedByDevice = new Map<string, DashboardData[]>()
    
    wsData.forEach((d) => {
      const deviceName = d.device_nama || 'All Devices'
      if (!groupedByDevice.has(deviceName)) {
        groupedByDevice.set(deviceName, [])
      }
      groupedByDevice.get(deviceName)!.push(d)
    })

    // Convert grouped data to SavedDashboardData format
    const items: SavedDashboardData[] = []
    groupedByDevice.forEach((deviceParams, deviceName) => {
      // Sort parameters by parameter name (alphabetically) for fixed, consistent ordering
      // This ensures parameters don't change position when WebSocket updates arrive
      const sortedParams = [...deviceParams].sort((a, b) => 
        (a.parameter_nama || '').localeCompare(b.parameter_nama || '')
      )
      
      // Get latest timestamp for savedAt (from any parameter, not necessarily first)
      const latestTimestamp = sortedParams.length > 0 
        ? new Date(Math.max(...sortedParams.map(p => new Date(p.timestamp).getTime())))
        : new Date()

      // Create mappedValues from all parameters, maintaining alphabetical order
      const mappedValues = sortedParams.map((d) => ({
        id: `param_${d.parameter_id}_${d.parameter_nama}`, // Use parameter_id for stable ID
        parameterId: d.parameter_id, // Include parameter ID for edit/delete operations
        outputName: d.parameter_nama || `Parameter ${d.parameter_id}`, // Fallback if name is missing
        rawValues: [],
        mappedValue: typeof d.value === 'number' ? d.value : Number(d.value ?? 0),
        formula: '',
        timestamp: new Date(d.timestamp),
      }))

      items.push({
        id: deviceName,
        connectionId: deviceName,
        connectionName: deviceName,
        mappedValues,
        savedAt: latestTimestamp,
      })
    })

    // Sort by device name for consistent ordering
    items.sort((a, b) => a.connectionName.localeCompare(b.connectionName))
    
    return items
  }, [wsData])

  const addLog = (
    message: string,
    type: 'info' | 'error' | 'success' | 'warning' = 'info',
    connectionId?: string,
    slaveId?: number,
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
      ...prev,
    ])
  }

  const handleRawDataReceived = (
    data: RawDataField[],
    config?: {
      slaveId?: number
      functionCode?: number
      registerAddress?: number
      quantity?: number
      dataType?: string
      byteOrder?: string
      oid?: string
    }
  ) => {
    setRawData(data)
    setTestConfig(config || null)
    addLog(`Received ${data.length} raw data fields for mapping`, 'info')
  }

  const handleSaveDashboard = async (mappedValues: MappedValue[]) => {
    if (!activeConnection) return

    // This will be handled by DataMappingStep calling backend API
    // For now, keep local state update for immediate UI feedback
    const newData: SavedDashboardData = {
      id: Date.now().toString(),
      connectionId: activeConnection.id,
      connectionName: activeConnection.name,
      mappedValues,
      savedAt: new Date(),
    }
    setSavedDashboardData((prev) => [newData, ...prev])
  }
  
  // Force refresh WebSocket data when switching to dashboard
  const handleViewChange = (view: 'dashboard' | 'tester' | 'write' | 'workflow') => {
    setCurrentView(view)
    // If switching to dashboard, give WebSocket a moment to update
    if (view === 'dashboard') {
      // Small delay to allow WebSocket to receive latest data
      setTimeout(() => {
        // Force re-render by updating a dummy state if needed
        // The useWebSocket hook will automatically update when new data arrives
      }, 500)
    }
    // Reset write step when switching to write view
    if (view === 'write') {
      setWriteStep(0)
    }
  }

  const resetTesterState = () => {
    setCurrentStep(0)
    setActiveConnection(null)
    setRawData([])
    setTestConfig(null)
    setLogs([])
    // Keep connections list, but reset active connection
  }

  const canProceedToStep2 = activeConnection?.status === 'connected'
  const canProceedToStep3 = rawData.length > 0

  const steps = [
    {
      title: 'Connection Setup',
      description: 'Configure transport layer',
      disabled: false,
    },
    {
      title: 'Read/Write Test',
      description: 'Test operations',
      disabled: !canProceedToStep2,
    },
    {
      title: 'Data Mapping',
      description: 'Transform raw data',
      disabled: !canProceedToStep3,
    },
  ]

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-background flex">
        <aside
          className={cn(
            'border-r border-border bg-card transition-all duration-300',
            isSidebarOpen ? 'w-64' : 'w-0 overflow-hidden'
          )}
        >
          <div className="p-4 space-y-2">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Activity className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-sm font-semibold text-foreground">AOI System</h1>
                <p className="text-xs text-muted-foreground">Industrial Comm</p>
              </div>
            </div>

            <Button
              variant={currentView === 'dashboard' ? 'default' : 'ghost'}
              className="w-full justify-start"
              onClick={() => handleViewChange('dashboard')}
            >
              <LayoutDashboard className="h-4 w-4 mr-2" />
              Dashboard
            </Button>

            <Button
              variant={currentView === 'tester' ? 'default' : 'ghost'}
              className="w-full justify-start"
              onClick={() => handleViewChange('tester')}
            >
              <TestTube2 className="h-4 w-4 mr-2" />
              Communication Tester
            </Button>

            <Button
              variant={currentView === 'write' ? 'default' : 'ghost'}
              className="w-full justify-start"
              onClick={() => handleViewChange('write')}
            >
              <PenTool className="h-4 w-4 mr-2" />
              Write / Control
            </Button>

            <Button
              variant={currentView === 'workflow' ? 'default' : 'ghost'}
              className="w-full justify-start"
              onClick={() => handleViewChange('workflow')}
            >
              <Workflow className="h-4 w-4 mr-2" />
              Workflow
            </Button>
          </div>
        </aside>

        <div className="flex-1 flex flex-col">
          <header className="border-b border-border bg-card sticky top-0 z-10">
            <div className="flex h-16 items-center gap-3 px-6">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="h-10 w-10"
              >
                {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
              <div>
                <h1 className="text-lg font-semibold text-foreground">
                  {currentView === 'dashboard'
                    ? 'Dashboard'
                    : currentView === 'tester'
                      ? 'Communication Tester'
                      : currentView === 'write'
                        ? 'Write / Control'
                        : 'Workflow'}
                </h1>
                <p className="text-xs text-muted-foreground">
                  {currentView === 'dashboard'
                    ? 'Monitor mapped data values'
                    : currentView === 'tester'
                      ? 'Test → Map → Transform'
                      : currentView === 'write'
                        ? 'Write values to Modbus devices'
                        : 'IF condition THEN action'}
                </p>
              </div>
            </div>
            {currentView === 'tester' && (
              <div className="border-t border-border px-6 py-4">
                <Stepper steps={steps} currentStep={currentStep} onStepClick={setCurrentStep} />
              </div>
            )}
            {currentView === 'write' && (
              <div className="border-t border-border px-6 py-4">
                <WriteControlViewStepper
                  currentStep={writeStep}
                  onStepClick={setWriteStep}
                  canProceedToStep2={writeActiveConnection?.status === 'connected'}
                  canProceedToStep3={!!writeSelectedParameter}
                  canProceedToStep4={writeValueReady}
                />
              </div>
            )}
          </header>

          <div className="flex flex-1 h-[calc(100vh-4rem)]">
            {currentView === 'write' ? (
              <WriteControlView
                currentStep={writeStep}
                setCurrentStep={setWriteStep}
                onStepChange={(step) => {
                  setWriteStep(step)
                  // Reset dependent states when step changes
                  if (step === 0) {
                    setWriteActiveConnection(null)
                    setWriteSelectedParameter(null)
                    setWriteValueReady(false)
                  } else if (step === 1) {
                    setWriteSelectedParameter(null)
                    setWriteValueReady(false)
                  } else if (step === 2) {
                    setWriteValueReady(false)
                  }
                }}
                onConnectionChange={(connection) => {
                  setWriteActiveConnection(connection)
                }}
                onParameterSelected={(parameter) => {
                  setWriteSelectedParameter(parameter)
                }}
                onValueReady={() => {
                  setWriteValueReady(true)
                }}
              />
            ) : currentView === 'workflow' ? (
              <main className="flex-1 overflow-y-auto">
                <div className="p-6">
                  <WorkflowView />
                </div>
              </main>
            ) : (
              <>
                <main className="flex-1 overflow-y-auto">
                  <div className="p-6">
                    {currentView === 'dashboard' ? (
                      <DashboardView
                        savedData={liveDashboardData.length > 0 ? liveDashboardData : savedDashboardData}
                      />
                    ) : (
                      <>
                        {currentStep === 0 && (
                          <ConnectionStep
                            connections={connections}
                            setConnections={setConnections}
                            activeConnection={activeConnection}
                            setActiveConnection={setActiveConnection}
                            addLog={addLog}
                            onProceed={() => setCurrentStep(1)}
                          />
                        )}
                        {currentStep === 1 && (
                          <TestStep
                            activeConnection={activeConnection!}
                            addLog={addLog}
                            onRawDataReceived={handleRawDataReceived}
                            onNext={() => setCurrentStep(2)}
                          />
                        )}
                        {currentStep === 2 && (
                          <DataMappingStep
                            rawData={rawData}
                            addLog={addLog}
                            onSave={handleSaveDashboard}
                            activeConnection={activeConnection!}
                            testConfig={testConfig}
                            onSaveSuccess={() => {
                              resetTesterState()
                              setCurrentView('dashboard')
                            }}
                          />
                        )}
                      </>
                    )}
                  </div>
                </main>

                {currentView === 'tester' && (
                  <aside className="w-96 border-l border-border bg-card overflow-y-auto">
                    <LogsPanel logs={logs} onClear={() => setLogs([])} />
                  </aside>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </QueryClientProvider>
  )
}

export default App
