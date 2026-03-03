import { useEffect, useMemo, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Stepper } from "@/components/stepper";
import { ConnectionStep } from "@/components/steps/connection-step";
import { TestStep } from "@/components/steps/test-step";
import { DataMappingStep } from "@/components/steps/data-mapping-step";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { AlarmList } from "@/components/alarm/alarm-list";
import { WriteLogList } from "@/components/write-log/write-log-list";
import { LogsPanel } from "@/components/tester/logs-panel";
import { WriteControlView } from "@/components/write/write-control-view";
import { WriteControlViewStepper } from "@/components/write/write-control-stepper";
import { WorkflowView } from "@/components/workflow/workflow-view";
import { SetPointView } from "@/components/set-point/set-point-view";
import ReadWriteParameterForm from "@/pages/Parameters/ReadWriteParameterForm";
import { ImcPage } from "./components/imc/imc-page";
import { HTTPParameterRead } from "@/pages/HTTP/HTTPParameterRead";
import {
  LayoutDashboard,
  TestTube2,
  PenTool,
  Menu,
  X,
  Workflow,
  Lock,
  Unlock,
  LogOut,
  FileText,
  ArrowLeftRight,
  Globe,
} from "lucide-react";
import logoctg1 from "../logoctg1.png";
import type {
  Connection,
  LogEntry,
  RawDataField,
  SavedDashboardData,
  MappedValue,
  DashboardData,
} from "@/types";
import { cn } from "@/lib/utils";
import { useWebSocket } from "@/hooks/useWebSocket";
import { ToastProvider, useToast } from "@/contexts/ToastContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ToastContainer } from "@/components/ui/toast";
import { AdminLoginDialog } from "@/components/auth/AdminLoginDialog";

const queryClient = new QueryClient();

function AppContent() {
  const { toasts, removeToast } = useToast();
  const { isAdmin, logout } = useAuth();
  const [currentView, setCurrentView] = useState<
    | "dashboard"
    | "imc"
    | "tester"
    | "write"
    | "workflow"
    | "set-point"
    | "write-log"
    | "read-write"
    | "http-parameter-read"
  >("dashboard");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [loginDialogOpen, setLoginDialogOpen] = useState(false);
  const isImcView = currentView === "imc";
  const [showChromeInImc, setShowChromeInImc] = useState(false);
  const [imcTapCount, setImcTapCount] = useState(0);
  const [isWorkflowBuilderOpen, setIsWorkflowBuilderOpen] = useState(false);

  useEffect(() => {
    const parsePathToView = (pathname: string) => {
      const cleaned = pathname.replace(/\/+$/, "");
      if (cleaned === "" || cleaned === "/") return "dashboard";
      if (
        cleaned === "/dashboard" ||
        cleaned === "/imc" ||
        cleaned === "/tester" ||
        cleaned === "/write" ||
        cleaned === "/workflow" ||
        cleaned === "/set-point" ||
        cleaned === "/write-log" ||
        cleaned === "/read-write" ||
        cleaned === "/http-parameter-read"
      ) {
        return cleaned.slice(1);
      }
      return "dashboard";
    };

    const applyPath = () => {
      if (window.location.pathname === "/") {
        window.history.replaceState({}, "", "/imc");
      }
      const nextView = parsePathToView(window.location.pathname) as any;
      setCurrentView(nextView);
    };

    applyPath();
    window.addEventListener("popstate", applyPath);
    return () => window.removeEventListener("popstate", applyPath);
  }, []);

  useEffect(() => {
    if (!isImcView) {
      setShowChromeInImc(false);
      setImcTapCount(0);
    }
  }, [isImcView]);

  useEffect(() => {
    if (!isImcView) return;
    if (imcTapCount === 0) return;
    const t = window.setTimeout(() => setImcTapCount(0), 1200);
    return () => window.clearTimeout(t);
  }, [imcTapCount, isImcView]);

  useEffect(() => {
    if (isWorkflowBuilderOpen) {
      setIsSidebarOpen(false);
    } else if (currentView === "workflow" && !isWorkflowBuilderOpen) {
      // Reopen sidebar when exiting workflow builder
      setIsSidebarOpen(true);
    }
  }, [isWorkflowBuilderOpen, currentView]);

  // Tester state
  const [currentStep, setCurrentStep] = useState(0);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [activeConnection, setActiveConnection] = useState<Connection | null>(
    null,
  );
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [rawData, setRawData] = useState<RawDataField[]>([]);
  const [savedDashboardData, setSavedDashboardData] = useState<
    SavedDashboardData[]
  >([]);
  // Store test configuration from TestStep for use in DataMappingStep
  const [testConfig, setTestConfig] = useState<{
    slaveId?: number;
    functionCode?: number;
    registerAddress?: number;
    quantity?: number;
    dataType?: string;
    byteOrder?: string;
    oid?: string;
  } | null>(null);

  // Write Control state
  const [writeStep, setWriteStep] = useState(0);
  const [writeActiveConnection, setWriteActiveConnection] =
    useState<Connection | null>(null);

  // Live data from backend via WebSocket
  const { data: wsData } = useWebSocket();

  // Convert Map to Array for dependency tracking (ensures re-render when Map contents change)
  const wsDataArray = useMemo(() => Array.from(wsData.values()), [wsData]);

  const liveDashboardData: SavedDashboardData[] = useMemo(() => {
    // Group WebSocket data by device_nama (or "All Devices" if empty)
    const groupedByDevice = new Map<string, DashboardData[]>();

    wsDataArray.forEach((d) => {
      const deviceName = d.device_nama || "All Devices";
      if (!groupedByDevice.has(deviceName)) {
        groupedByDevice.set(deviceName, []);
      }
      groupedByDevice.get(deviceName)!.push(d);
    });

    // Convert grouped data to SavedDashboardData format
    const items: SavedDashboardData[] = [];
    groupedByDevice.forEach((deviceParams, deviceName) => {
      // Sort parameters by parameter name (alphabetically) for fixed, consistent ordering
      // This ensures parameters don't change position when WebSocket updates arrive
      const sortedParams = [...deviceParams].sort((a, b) =>
        (a.parameter_nama || "").localeCompare(b.parameter_nama || ""),
      );

      // Get latest timestamp for savedAt (from any parameter, not necessarily first)
      const latestTimestamp =
        sortedParams.length > 0
          ? new Date(
              Math.max(
                ...sortedParams.map((p) => new Date(p.timestamp).getTime()),
              ),
            )
          : new Date();

      // Create mappedValues from all parameters, maintaining alphabetical order
      const mappedValues = sortedParams.map((d) => ({
        id: `param_${d.parameter_id}_${d.parameter_nama}`, // Use parameter_id for stable ID
        parameterId: d.parameter_id, // Include parameter ID for edit/delete operations
        outputName: d.parameter_nama || `Parameter ${d.parameter_id}`, // Fallback if name is missing
        rawValues: [],
        mappedValue:
          typeof d.value === "number" ? d.value : Number(d.value ?? 0),
        formula: "",
        timestamp: new Date(d.timestamp),
        status: (d.status === 'offline' || d.status === 'error') ? d.status : 'online' as 'online' | 'offline' | 'error', // Preserve status from WebSocket
      }));

      items.push({
        id: deviceName,
        connectionId: deviceName,
        connectionName: deviceName,
        mappedValues,
        savedAt: latestTimestamp,
      });
    });

    // Sort by device name for consistent ordering
    items.sort((a, b) => a.connectionName.localeCompare(b.connectionName));

    return items;
  }, [wsDataArray]);

  const addLog = (
    message: string,
    type: "info" | "error" | "success" | "warning" = "info",
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
    ]);
  };

  const handleRawDataReceived = (
    data: RawDataField[],
    config?: {
      slaveId?: number;
      functionCode?: number;
      registerAddress?: number;
      quantity?: number;
      dataType?: string;
      byteOrder?: string;
      oid?: string;
    },
  ) => {
    setRawData(data);
    setTestConfig(config || null);
    addLog(`Received ${data.length} raw data fields for mapping`, "info");
  };

  const handleSaveDashboard = async (mappedValues: MappedValue[]) => {
    if (!activeConnection) return;

    // This will be handled by DataMappingStep calling backend API
    // For now, keep local state update for immediate UI feedback
    const newData: SavedDashboardData = {
      id: Date.now().toString(),
      connectionId: activeConnection.id,
      connectionName: activeConnection.name,
      mappedValues,
      savedAt: new Date(),
    };
    setSavedDashboardData((prev) => [newData, ...prev]);
  };

  // Force refresh WebSocket data when switching to dashboard
  const handleViewChange = (
    view:
      | "dashboard"
      | "imc"
      | "tester"
      | "write"
      | "workflow"
      | "set-point"
      | "write-log"
      | "read-write"
      | "http-parameter-read",
  ) => {
    // Only allow tester/write/workflow/write-log views if admin
    if (
      (view === "tester" ||
        view === "write" ||
        view === "workflow" ||
        view === "set-point" ||
        view === "write-log") &&
      !isAdmin
    ) {
      return; // Don't allow switching to admin-only views
    }
    setCurrentView(view);

    if (typeof window !== "undefined") {
      const nextPath = view === "dashboard" ? "/" : `/${view}`;
      if (window.location.pathname !== nextPath) {
        window.history.pushState({}, "", nextPath);
      }
    }

    // If switching to dashboard, give WebSocket a moment to update
    if (view === "dashboard") {
      // Small delay to allow WebSocket to receive latest data
      setTimeout(() => {
        // Force re-render by updating a dummy state if needed
        // The useWebSocket hook will automatically update when new data arrives
      }, 500);
    }
    // Reset write step when switching to write view
    if (view === "write") {
      setWriteStep(0);
    }
  };

  const resetTesterState = () => {
    setCurrentStep(0);
    setActiveConnection(null);
    setRawData([]);
    setTestConfig(null);
    setLogs([]);
    // Keep connections list, but reset active connection
  };

  const canProceedToStep2 = activeConnection?.status === "connected";
  const canProceedToStep3 = rawData.length > 0;

  const steps = [
    {
      title: "Pengaturan Koneksi",
      description: "Konfigurasi transport layer",
      disabled: false,
    },
    {
      title: "Uji Read/Write",
      description: "Uji operasi",
      disabled: !canProceedToStep2,
    },
    {
      title: "Pemetaan Data",
      description: "Transformasi data mentah",
      disabled: !canProceedToStep3,
    },
  ];

  return (
    <>
      <div
        className={cn(
          "min-h-screen flex",
          isImcView
            ? "imc-theme bg-background text-foreground"
            : "bg-background",
        )}
      >
        {((!isImcView || showChromeInImc) && !isWorkflowBuilderOpen) && (
          <aside
            className={cn(
              "border-r border-border bg-card transition-all duration-300",
              isSidebarOpen ? "w-64" : "w-0 overflow-hidden",
            )}
          >
            <div className="p-4 space-y-2">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <img
                    src={logoctg1}
                    alt="CTG IMC Logo"
                    className="h-8 w-8 object-contain"
                  />
                </div>
                <div>
                  <h1 className="text-sm font-semibold text-foreground">
                    CTG IMC
                  </h1>
                  <p className="text-xs text-muted-foreground">
                    Immersion Control System
                  </p>
                </div>
              </div>

              <Button
                variant={currentView === "dashboard" ? "default" : "ghost"}
                className="w-full justify-start"
                onClick={() => handleViewChange("dashboard")}
              >
                <LayoutDashboard className="h-4 w-4 mr-2" />
                Dashboard
              </Button>

              <Button
                variant="ghost"
                className="w-full justify-start"
                onClick={() => handleViewChange("imc")}
              >
                <LayoutDashboard className="h-4 w-4 mr-2" />
                IMC
              </Button>

              {isAdmin && (
                <>
                  <Separator className="my-2" />

                  <Button
                    variant={currentView === "tester" ? "default" : "ghost"}
                    className="w-full justify-start"
                    onClick={() => handleViewChange("tester")}
                  >
                    <TestTube2 className="h-4 w-4 mr-2" />
                    Read Parameter
                  </Button>

                  <Button
                    variant={currentView === "write" ? "default" : "ghost"}
                    className="w-full justify-start"
                    onClick={() => handleViewChange("write")}
                  >
                    <PenTool className="h-4 w-4 mr-2" />
                    Write / Control
                  </Button>

                  <Button
                    variant={currentView === "read-write" ? "default" : "ghost"}
                    className="w-full justify-start"
                    onClick={() => handleViewChange("read-write")}
                  >
                    <ArrowLeftRight className="h-4 w-4 mr-2" />
                    Read/Write Parameter
                  </Button>

                  <Button
                    variant={currentView === "http-parameter-read" ? "default" : "ghost"}
                    className="w-full justify-start"
                    onClick={() => handleViewChange("http-parameter-read")}
                  >
                    <Globe className="h-4 w-4 mr-2" />
                    HTTP Parameter Read
                  </Button>

                  <Separator className="my-2" />

                  <Button
                    variant={currentView === "set-point" ? "default" : "ghost"}
                    className="w-full justify-start"
                    onClick={() => handleViewChange("set-point")}
                  >
                    <Workflow className="h-4 w-4 mr-2" />
                    Set-Point
                  </Button>

                  <Button
                    variant={currentView === "workflow" ? "default" : "ghost"}
                    className="w-full justify-start"
                    onClick={() => handleViewChange("workflow")}
                  >
                    <Workflow className="h-4 w-4 mr-2" />
                    Workflow
                  </Button>

                  <Button
                    variant={currentView === "write-log" ? "default" : "ghost"}
                    className="w-full justify-start"
                    onClick={() => handleViewChange("write-log")}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Write Log
                  </Button>
                </>
              )}
            </div>
          </aside>
        )}

        <div className="flex-1 flex flex-col">
          {((!isImcView || showChromeInImc) && !isWorkflowBuilderOpen) && (
            <header className="border-b border-border bg-card sticky top-0 z-10">
              <div className="flex h-16 items-center gap-3 px-6">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                  className="h-10 w-10"
                >
                  {isSidebarOpen ? (
                    <X className="h-5 w-5" />
                  ) : (
                    <Menu className="h-5 w-5" />
                  )}
                </Button>
                <div className="flex-1">
                  <h1 className="text-lg font-semibold text-foreground">
                    {currentView === "dashboard"
                      ? "Dashboard"
                      : currentView === "tester"
                        ? "Communication Tester"
                        : currentView === "write"
                          ? "Write / Control"
                          : currentView === "workflow"
                            ? "Workflow"
                            : currentView === "set-point"
                              ? "Set-Point"
                              : currentView === "read-write"
                                  ? "Read/Write Parameter"
                                  : currentView === "http-parameter-read"
                                    ? "HTTP Parameter Read"
                                    : "Write Log"}
                  </h1>
                  <p className="text-xs text-muted-foreground">
                    {currentView === "dashboard"
                      ? "Pantau nilai data yang telah dipetakan"
                      : currentView === "tester"
                        ? "Uji → Petakan → Transformasi"
                        : currentView === "write"
                          ? "Tulis nilai ke perangkat Modbus"
                          : currentView === "workflow"
                            ? "JIKA kondisi MAKA aksi"
                            : currentView === "set-point"
                              ? "Kelola nilai set-point untuk workflow"
                              : currentView === "read-write"
                                  ? "Buat parameter yang bisa membaca dan menulis"
                                  : currentView === "http-parameter-read"
                                    ? "Buat parameter read dari HTTP GET endpoint"
                                    : "Riwayat semua write action ke parameter"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {isAdmin ? (
                    <>
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary/10 text-primary text-sm">
                        <Unlock className="h-4 w-4" />
                        <span>Admin Mode</span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={logout}
                        className="gap-2"
                      >
                        <LogOut className="h-4 w-4" />
                        <span>Logout</span>
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setLoginDialogOpen(true)}
                      className="gap-2"
                    >
                      <Lock className="h-4 w-4" />
                      <span>Admin Mode</span>
                    </Button>
                  )}
                </div>
              </div>
              {currentView === "tester" && (
                <div className="border-t border-border px-6 py-4">
                  <Stepper
                    steps={steps}
                    currentStep={currentStep}
                    onStepClick={setCurrentStep}
                  />
                </div>
              )}
              {currentView === "write" && (
                <div className="border-t border-border px-6 py-4">
                  <WriteControlViewStepper
                    currentStep={writeStep}
                    onStepClick={setWriteStep}
                    canProceedToStep2={
                      writeActiveConnection?.status === "connected"
                    }
                  />
                </div>
              )}
            </header>
          )}

          {isImcView && !showChromeInImc ? (
            <div
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                width: 160,
                height: 56,
                zIndex: 2147483000,
                background: "transparent",
              }}
              onClick={() => {
                setImcTapCount((c) => {
                  const next = c + 1;
                  if (next >= 4) {
                    setShowChromeInImc(true);
                    setIsSidebarOpen(true);
                    return 0;
                  }
                  return next;
                });
              }}
            />
          ) : null}

          <div
            className={cn(
              "flex flex-1",
              isImcView && !showChromeInImc
                ? "h-screen"
                : "h-[calc(100vh-4rem)]",
            )}
          >
            {currentView === "write" && isAdmin ? (
              <WriteControlView
                currentStep={writeStep}
                setCurrentStep={setWriteStep}
                onStepChange={(step) => {
                  setWriteStep(step);
                  // Reset dependent states when step changes
                  if (step === 0) {
                    setWriteActiveConnection(null);
                  }
                }}
                onConnectionChange={(connection) => {
                  setWriteActiveConnection(connection);
                }}
              />
            ) : currentView === "workflow" && isAdmin ? (
              <main className="flex-1 overflow-hidden">
                <div className="h-full w-full">
                  <WorkflowView 
                    onBuilderOpenChange={setIsWorkflowBuilderOpen}
                  />
                </div>
              </main>
            ) : currentView === "set-point" && isAdmin ? (
              <main className="flex-1 overflow-y-auto">
                <div className="p-6">
                  <SetPointView />
                </div>
              </main>
            ) : currentView === "read-write" && isAdmin ? (
              <main className="flex-1 overflow-y-auto">
                <ReadWriteParameterForm
                  onCancel={() => handleViewChange("dashboard")}
                  onSuccess={() => {
                    handleViewChange("dashboard");
                  }}
                />
              </main>
            ) : currentView === "http-parameter-read" && isAdmin ? (
              <main className="flex-1 overflow-y-auto">
                <HTTPParameterRead />
              </main>
            ) : !isAdmin &&
              (currentView === "tester" ||
                currentView === "write" ||
                currentView === "workflow" ||
                currentView === "set-point" ||
                currentView === "write-log" ||
                currentView === "read-write" ||
                currentView === "http-parameter-read") ? (
              <main className="flex-1 overflow-y-auto">
                <div className="p-6">
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <h2 className="text-2xl font-bold mb-2">
                      Mode Admin Diperlukan
                    </h2>
                    <p className="text-muted-foreground mb-4">
                      Silakan aktifkan Mode Admin untuk mengakses fitur ini.
                    </p>
                    <Button onClick={() => handleViewChange("dashboard")}>
                      Kembali ke Dashboard
                    </Button>
                  </div>
                </div>
              </main>
            ) : (
              <>
                <main className="flex-1 overflow-y-auto">
                  <div
                    className={cn(
                      currentView === "imc" ? "p-0 h-full w-full" : "p-6",
                    )}
                  >
                    {currentView === "dashboard" ? (
                      <div className="space-y-6">
                        <AlarmList />
                        <DashboardView
                          savedData={
                            liveDashboardData.length > 0
                              ? liveDashboardData
                              : savedDashboardData
                          }
                          onParameterUpdate={({ id, nama }) => {
                            // Sinkronkan nama parameter di savedDashboardData
                            setSavedDashboardData((prev) =>
                              prev.map((group) => ({
                                ...group,
                                mappedValues: group.mappedValues.map((mv) =>
                                  mv.parameterId === id
                                    ? { ...mv, outputName: nama }
                                    : mv,
                                ),
                              })),
                            );
                          }}
                        />
                      </div>
                    ) : currentView === "imc" ? (
                      <div className="imc-theme h-full w-full bg-background text-foreground">
                        <ImcPage />
                      </div>
                    ) : currentView === "write-log" && isAdmin ? (
                      <div className="space-y-6">
                        <WriteLogList />
                      </div>
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
                              resetTesterState();
                              setCurrentView("dashboard");
                            }}
                          />
                        )}
                      </>
                    )}
                  </div>
                </main>

                {currentView === "tester" && (
                  <aside className="w-96 border-l border-border bg-card overflow-y-auto">
                    <LogsPanel logs={logs} onClear={() => setLogs([])} />
                  </aside>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      <ToastContainer toasts={toasts} onClose={removeToast} />
      <AdminLoginDialog
        open={loginDialogOpen}
        onOpenChange={setLoginDialogOpen}
      />
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <AppContent />
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
