import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Switch } from "../ui/switch";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../ui/dialog";
import { MinusIcon, PlusIcon, Settings } from "lucide-react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useAuth } from "@/contexts/AuthContext";
import { parameterService } from "@/services/parameterService";
import { imcConfigService, type CreateOrUpdateIMCConfigRequest } from "@/services/imcConfigService";
import { setPointService } from "@/services/setPointService";
import type { DashboardData } from "@/types";

interface StatusItem {
  key: string;
  title: string;
  imageSrc: string;
  status: boolean;
  parameterId?: number; // ID parameter dari WebSocket
  sourceType?: "parameter" | "set_point";
  setPointId?: number;
  data: {
    setpoint: number;
    mode?: string;
    currentA?: number;
    voltageV?: number;
    flow?: number;
    pressureBar?: number;
    speedRpm?: number;
    tempC?: number;
    lastUpdate?: string;
  };
}

export function ImcPage() {
  // WebSocket data
  const { data: wsData } = useWebSocket();
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  
  // Convert WebSocket Map to array for easier access
  const wsDataArray = useMemo(() => {
    return Array.from(wsData.values());
  }, [wsData]);

  // Fetch IMC configs from database
  const { data: imcConfigs = [] } = useQuery({
    queryKey: ['imc-configs'],
    queryFn: () => imcConfigService.getAll(),
  });
  const { data: setPoints = [] } = useQuery({
    queryKey: ['set-points'],
    queryFn: () => setPointService.getAll(),
    refetchInterval: 1000,
    refetchIntervalInBackground: true,
  });

  // Create a map for quick lookup
  const configMap = useMemo(() => {
    const map = new Map<string, { sourceType: "parameter" | "set_point"; parameterId?: number; setPointId?: number }>();
    imcConfigs.forEach((config) => {
      map.set(config.card_key, {
        sourceType: (config.source_type as "parameter" | "set_point") || "parameter",
        parameterId: config.parameter_id,
        setPointId: config.set_point_id,
      });
    });
    return map;
  }, [imcConfigs]);

  // Mutation for saving config
  const saveConfigMutation = useMutation({
    mutationFn: (payload: CreateOrUpdateIMCConfigRequest) =>
      imcConfigService.createOrUpdate(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['imc-configs'] });
    },
  });

  // Get parameter value by ID
  const getParameterValue = (parameterId?: number): number | null => {
    if (!parameterId) return null;
    const key = `param_${parameterId}`;
    const paramData = wsData.get(key);
    return paramData?.value ?? null;
  };
  const getSetPointValue = (setPointId?: number): number | null => {
    if (!setPointId) return null;
    const sp = setPoints.find((s) => s.id === setPointId);
    return sp?.value ?? null;
  };
  const getConfiguredValue = (item: StatusItem): number => {
    if ((item.sourceType || "parameter") === "set_point") {
      const spValue = getSetPointValue(item.setPointId);
      if (spValue !== null) return spValue;
    } else {
      const wsValue = getParameterValue(item.parameterId);
      if (wsValue !== null) return wsValue;
    }
    return item.data?.setpoint ?? 0;
  };

  const [statusItems, setStatusItems] = useState<StatusItem[]>(() => [
    {
      key: "oil",
      title: "Status Pompa Oli",
      imageSrc: "/img/pump.png",
      status: false,
      data: {
        setpoint: 0,
        mode: "AUTO",
        currentA: 2.4,
        voltageV: 380,
        lastUpdate: "2026-02-04 13:16:10",
      },
    },
    {
      key: "water",
      title: "Status Pompa Air",
      imageSrc: "/img/pump.png",
      status: false,
      data: {
        setpoint: 0,
        mode: "MANUAL",
        flow: 0.65,
        pressureBar: 0.84,
        lastUpdate: "2026-02-04 13:16:10",
      },
    },
    {
      key: "fan",
      title: "Status Kipas DryCooler",
      imageSrc: "/img/fan.png",
      status: false,
      data: {
        setpoint: 0,
        speedRpm: 1450,
        tempC: 34.5,
        lastUpdate: "2026-02-04 13:16:10",
      },
    },
  ]);

  // Fetch parameters for dropdown
  const { data: parameters = [] } = useQuery({
    queryKey: ['parameters'],
    queryFn: () => parameterService.getAll(),
  });

  // Filter parameters that can be read in IMC page: READ and READ_WRITE
  // Exclude RAW, SOURCE, and parameters without valid parameter_mode
  const readParameters = useMemo(() => {
    return parameters.filter((p) => {
      const isReadableByDirection = p.direction === 'READ' || p.direction === 'READ_WRITE';
      const isReadableLegacy =
        p.direction === undefined &&
        (p.read_write === false || p.read_write === 0 || p.read_write === 2);
      if (!isReadableByDirection && !isReadableLegacy) return false;
      
      const mode = p.parameter_mode || '';
      // Only include DIRECT, CLEAN, FORMULA - explicitly exclude RAW, SOURCE, and empty
      return ['DIRECT', 'CLEAN', 'FORMULA'].includes(mode);
    });
  }, [parameters]);

  // Configuration for parameter IDs for each card
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [configItemKey, setConfigItemKey] = useState<string | null>(null);
  const [configSourceType, setConfigSourceType] = useState<"parameter" | "set_point">("parameter");
  const [configParameterId, setConfigParameterId] = useState<string>("");
  const [configSetPointId, setConfigSetPointId] = useState<string>("");

  // Load configuration from database
  useEffect(() => {
    if (imcConfigs.length > 0) {
      setStatusItems((prev) =>
        prev.map((item) => ({
          ...item,
          sourceType: configMap.get(item.key)?.sourceType || "parameter",
          parameterId: configMap.get(item.key)?.parameterId,
          setPointId: configMap.get(item.key)?.setPointId,
        }))
      );
    }
  }, [imcConfigs, configMap]);

  // Save configuration to database
  const saveConfig = () => {
    if (!configItemKey) {
      console.warn("saveConfig: configItemKey is null");
      return;
    }
    
    const parameterId = configSourceType === "parameter" && configParameterId && configParameterId !== "" && configParameterId !== "none" 
      ? Number(configParameterId) 
      : undefined;
    const setPointId = configSourceType === "set_point" && configSetPointId && configSetPointId !== "" && configSetPointId !== "none"
      ? Number(configSetPointId)
      : undefined;
    
    // Prepare payload - always include parameter_id (null to clear, number to set)
    const payload: CreateOrUpdateIMCConfigRequest = {
      card_key: configItemKey,
      source_type: configSourceType,
      parameter_id: parameterId ?? null,
      set_point_id: setPointId ?? null,
    };
    
    console.log("Saving IMC config:", payload);
    
    saveConfigMutation.mutate(
      payload,
      {
        onSuccess: (data) => {
          console.log("IMC config saved successfully:", data);
          
          // Update local state for status items
          if (["oil", "water", "fan"].includes(configItemKey)) {
            setStatusItems((prev) =>
              prev.map((item) =>
                item.key === configItemKey
                  ? { ...item, sourceType: configSourceType, parameterId: parameterId, setPointId: setPointId }
                  : item
              )
            );
          }
          
          setConfigDialogOpen(false);
          setConfigItemKey(null);
          setConfigSourceType("parameter");
          setConfigParameterId("");
          setConfigSetPointId("");
        },
        onError: (error) => {
          console.error("Failed to save IMC config:", error);
          alert(`Gagal menyimpan konfigurasi: ${error instanceof Error ? error.message : 'Unknown error'}`);
        },
      }
    );
  };

  // Open config dialog (hidden menu - triggered by triple click or special key combo)
  const handleOpenConfig = (key: string) => {
    setConfigItemKey(key);
    
    const cfg = configMap.get(key);
    setConfigSourceType(cfg?.sourceType || "parameter");
    setConfigParameterId(cfg?.parameterId ? String(cfg.parameterId) : "");
    setConfigSetPointId(cfg?.setPointId ? String(cfg.setPointId) : "");
    
    setConfigDialogOpen(true);
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const selectedStatus = useMemo(() => {
    if (!selectedKey) return null;
    return statusItems.find((i) => i.key === selectedKey) ?? null;
  }, [selectedKey, statusItems]);

  const setpointValues = useMemo(() => {
    const values: number[] = [];
    for (let i = 0; i <= 100; i++) values.push(i);
    return values;
  }, []);

  const setpointItemHeight = 36;
  const setpointPickerRef = useRef<HTMLDivElement | null>(null);
  const setpointScrollRafRef = useRef<number | null>(null);

  const adjustSetpoint = (delta: number) => {
    if (!selectedKey) return;
    setStatusItems((prev) =>
      prev.map((it) => {
        if (it.key !== selectedKey) return it;
        const current = Number((it as any).data?.setpoint ?? 0);
        const next = Math.max(0, Math.min(100, current + delta));
        return {
          ...it,
          data: {
            ...(it as any).data,
            setpoint: next,
          },
        };
      }),
    );
  };

  useEffect(() => {
    if (!isModalOpen) return;
    if (!setpointPickerRef.current) return;
    const current = Number((selectedStatus as any)?.data?.setpoint ?? 0);
    setpointPickerRef.current.scrollTop = current * setpointItemHeight;
  }, [isModalOpen, selectedKey]);

  useEffect(() => {
    if (!isModalOpen) return;
    if (!setpointPickerRef.current) return;
    const current = Number((selectedStatus as any)?.data?.setpoint ?? 0);
    const desired = current * setpointItemHeight;
    if (Math.abs(setpointPickerRef.current.scrollTop - desired) <= 2) return;
    setpointPickerRef.current.scrollTop = desired;
  }, [(selectedStatus as any)?.data?.setpoint, isModalOpen]);

  return (
    <div className="h-full p-3 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        <Card className="md:col-span-2 p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Card className="p-4 flex flex-col items-center border-none relative group">
              <div className="font-bold">Lembap Ambien</div>
              <div>
                <img src="/img/humid.png" alt="" width={150} />
              </div>
              <div className="mt-2 font-bold text-[clamp(24px,4vw,42px)]">
                {(() => {
                  const cfg = configMap.get("humidity");
                  const value = cfg?.sourceType === "set_point"
                    ? getSetPointValue(cfg.setPointId)
                    : getParameterValue(cfg?.parameterId);
                  return value !== null ? `${value.toFixed(2)}%` : "0.00%";
                })()}
              </div>
              {isAdmin && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6"
                  onClick={() => handleOpenConfig("humidity")}
                  title="Configure Parameter ID"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              )}
            </Card>
            <Card className="p-4 flex flex-col items-center border-none relative group">
              <div className="font-bold">Suhu Ambien</div>
              <div>
                <img src="/img/temp.png" alt="" width={150} />
              </div>
              <div className="mt-2 font-bold text-[clamp(24px,4vw,42px)]">
                {(() => {
                  const cfg = configMap.get("ambient_temp");
                  const value = cfg?.sourceType === "set_point"
                    ? getSetPointValue(cfg.setPointId)
                    : getParameterValue(cfg?.parameterId);
                  return value !== null ? `${value.toFixed(1)}°C` : "0.0°C";
                })()}
              </div>
              {isAdmin && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6"
                  onClick={() => handleOpenConfig("ambient_temp")}
                  title="Configure Parameter ID"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              )}
            </Card>
          </div>
        </Card>
        {/* Status */}
        <Card className="md:col-span-3 p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {statusItems.map((item) => {
              const displayValue = getConfiguredValue(item);
              
              return (
                <div key={item.key} className="relative group">
                  <button
                    type="button"
                    className="rounded-xl border bg-card text-card-foreground shadow-sm p-4 flex flex-col items-center cursor-pointer select-none hover:bg-accent/40 w-full"
                    style={
                      item.status
                        ? {
                            borderColor: "hsl(142 71% 45%)",
                            boxShadow:
                              "0 0 10px hsl(142 71% 45% / 0.65), 0 0 22px hsl(142 71% 45% / 0.35)",
                          }
                        : {
                            borderColor: "hsl(var(--destructive))",
                            boxShadow:
                              "0 0 10px hsl(var(--destructive) / 0.65), 0 0 22px hsl(var(--destructive) / 0.35)",
                          }
                    }
                    onClick={() => {
                      setSelectedKey(item.key);
                      setIsModalOpen(true);
                    }}
                  >
                    <div className="font-bold text-center">{item.title}</div>
                    <div className="mt-2 flex flex-col items-center justify-center gap-2">
                      <img src={item.imageSrc} alt={item.title} width={150} />
                      <div className="flex flex-col items-center">
                        <div className="font-bold text-[20px]">
                          {displayValue.toFixed(2)}%
                        </div>
                        {(item.parameterId || item.setPointId) && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {item.sourceType === "set_point" ? `Set-Point ID: ${item.setPointId}` : `Param ID: ${item.parameterId}`}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenConfig(item.key);
                      }}
                      title="Configure Parameter ID"
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      </div>
      <div className="h-[calc(100vh-325px)] grid grid-cols-2 gap-3">
        <Card className="p-4 h-full">
          <div className="h-full flex flex-col">
            <span className="mb-2 font-bold text-center">
              Sirkulasi Cairan Dielektrik
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
              <Card className="h-full p-4 border-none relative group">
                <div className="flex flex-col justify-center items-center h-full">
                  <div className="font-semibold">Suhu °C</div>
                  <div>
                    <img src="/img/temp.png" alt="" />
                  </div>
                  <div className="mt-2 font-bold text-[clamp(32px,6vw,80px)]">
                    {(() => {
                      const cfg = configMap.get("dielectric_temp");
                      const value = cfg?.sourceType === "set_point"
                        ? getSetPointValue(cfg.setPointId)
                        : getParameterValue(cfg?.parameterId);
                      return value !== null ? value.toFixed(1) : "34.5";
                    })()}
                  </div>
                </div>
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6"
                    onClick={() => handleOpenConfig("dielectric_temp")}
                    title="Configure Parameter ID"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                )}
              </Card>
              <Card className="h-full p-4 border-none relative group">
                <div className="flex flex-col justify-center items-center h-full">
                  <div className="font-semibold">Aliran m/s</div>
                  <div>
                    <img src="/img/pipe.png" alt="" />
                  </div>
                  <div className="mt-2 font-bold text-[clamp(32px,6vw,80px)]">
                    {(() => {
                      const cfg = configMap.get("dielectric_flow");
                      const value = cfg?.sourceType === "set_point"
                        ? getSetPointValue(cfg.setPointId)
                        : getParameterValue(cfg?.parameterId);
                      return value !== null ? value.toFixed(2) : "0.65";
                    })()}
                  </div>
                </div>
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6"
                    onClick={() => handleOpenConfig("dielectric_flow")}
                    title="Configure Parameter ID"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                )}
              </Card>
              <Card className="h-full p-4 border-none relative group">
                <div className="flex flex-col justify-center items-center h-full">
                  <div className="font-semibold">Tekanan Bar</div>
                  <div>
                    <img src="/img/gauge.png" alt="" />
                  </div>
                  <div className="mt-2 font-bold text-[clamp(32px,6vw,80px)]">
                    {(() => {
                      const cfg = configMap.get("dielectric_pressure");
                      const value = cfg?.sourceType === "set_point"
                        ? getSetPointValue(cfg.setPointId)
                        : getParameterValue(cfg?.parameterId);
                      return value !== null ? value.toFixed(2) : "0.84";
                    })()}
                  </div>
                </div>
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6"
                    onClick={() => handleOpenConfig("dielectric_pressure")}
                    title="Configure Parameter ID"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                )}
              </Card>
            </div>
          </div>
        </Card>

        <Card className="p-4 h-full">
          <div className="h-full flex flex-col">
            <span className="mb-2 font-bold text-center">
              Sirkulasi Cairan H2O
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
              <Card className="h-full p-4 border-none relative group">
                <div className="flex flex-col justify-center items-center h-full">
                  <div className="font-semibold">Suhu °C</div>
                  <div>
                    <img src="/img/temp.png" alt="" />
                  </div>
                  <div className="mt-2 font-bold text-[clamp(32px,6vw,80px)]">
                    {(() => {
                      const cfg = configMap.get("h2o_temp");
                      const value = cfg?.sourceType === "set_point"
                        ? getSetPointValue(cfg.setPointId)
                        : getParameterValue(cfg?.parameterId);
                      return value !== null ? value.toFixed(1) : "34.5";
                    })()}
                  </div>
                </div>
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6"
                    onClick={() => handleOpenConfig("h2o_temp")}
                    title="Configure Parameter ID"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                )}
              </Card>
              <Card className="h-full p-4 border-none relative group">
                <div className="flex flex-col justify-center items-center h-full">
                  <div className="font-semibold">Aliran m/s</div>
                  <div>
                    <img src="/img/pipe.png" alt="" />
                  </div>
                  <div className="mt-2 font-bold text-[clamp(32px,6vw,80px)]">
                    {(() => {
                      const cfg = configMap.get("h2o_flow");
                      const value = cfg?.sourceType === "set_point"
                        ? getSetPointValue(cfg.setPointId)
                        : getParameterValue(cfg?.parameterId);
                      return value !== null ? value.toFixed(2) : "0.65";
                    })()}
                  </div>
                </div>
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6"
                    onClick={() => handleOpenConfig("h2o_flow")}
                    title="Configure Parameter ID"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                )}
              </Card>
              <Card className="h-full p-4 border-none relative group">
                <div className="flex flex-col justify-center items-center h-full">
                  <div className="font-semibold">Tekanan Bar</div>
                  <div>
                    <img src="/img/gauge.png" alt="" />
                  </div>
                  <div className="mt-2 font-bold text-[clamp(32px,6vw,80px)]">
                    {(() => {
                      const cfg = configMap.get("h2o_pressure");
                      const value = cfg?.sourceType === "set_point"
                        ? getSetPointValue(cfg.setPointId)
                        : getParameterValue(cfg?.parameterId);
                      return value !== null ? value.toFixed(2) : "0.84";
                    })()}
                  </div>
                </div>
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6"
                    onClick={() => handleOpenConfig("h2o_pressure")}
                    title="Configure Parameter ID"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                )}
              </Card>
            </div>
          </div>
        </Card>
      </div>

      {isModalOpen ? (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: "100%",
            height: "100%",
            zIndex: 2147483647,
            backgroundColor: "hsl(var(--background) / 0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            pointerEvents: "auto",
            transform: "translateZ(0)",
          }}
        >
          <div
            style={{
              width: "95vw",
              maxWidth: 420,
              backgroundColor: "hsl(var(--card))",
              color: "hsl(var(--card-foreground))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 12,
              padding: 16,
              boxShadow: "0 10px 30px hsl(var(--background) / 0.35)",
              pointerEvents: "auto",
              maxHeight: "80vh",
              overflowY: "auto",
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 700 }}>
              {selectedStatus?.title ?? "Status"}
            </div>

            <div
              style={{
                marginTop: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
                padding: 12,
                borderRadius: 10,
                border: "1px solid hsl(var(--border))",
                backgroundColor: "hsl(var(--background) / 0.25)",
                width: "100%",
              }}
            >
              {/* <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ fontWeight: 600 }}>Setpoint</div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>
                  Ubah nilai dengan tombol - dan +
                </div>
              </div> */}

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Button
                  variant="outline"
                  onClick={() => adjustSetpoint(-1)}
                  style={{ height: 100, width: "100%" }} // bebas, bisa 56 / 64
                >
                  <MinusIcon />
                </Button>
                <div
                  ref={setpointPickerRef}
                  style={{
                    height: setpointItemHeight * 3,
                    width: 200,
                    overflowY: "auto",
                    scrollbarWidth: "none",
                    msOverflowStyle: "none",
                    borderRadius: 10,
                    border: "1px solid hsl(var(--border))",
                    backgroundColor: "hsl(var(--background) / 0.2)",
                    marginLeft: 8,
                    marginRight: 8,
                  }}
                  onScroll={(e) => {
                    if (!selectedKey) return;
                    const el = e.currentTarget;
                    if (setpointScrollRafRef.current) {
                      cancelAnimationFrame(setpointScrollRafRef.current);
                    }
                    setpointScrollRafRef.current = requestAnimationFrame(() => {
                      const raw = el.scrollTop / setpointItemHeight;
                      const next = Math.max(0, Math.min(100, Math.round(raw)));
                      setStatusItems((prev) =>
                        prev.map((it) =>
                          it.key === selectedKey
                            ? {
                                ...it,
                                data: {
                                  ...(it as any).data,
                                  setpoint: next,
                                },
                              }
                            : it,
                        ),
                      );
                    });
                  }}
                >
                  <div style={{ height: setpointItemHeight }} />
                  {setpointValues.map((v) => {
                    const active =
                      v ===
                      Number((selectedStatus as any)?.data?.setpoint ?? 0);
                    return (
                      <div
                        key={v}
                        style={{
                          height: setpointItemHeight,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: active ? 22 : 16,
                          fontWeight: active ? 800 : 600,
                          opacity: active ? 1 : 0.55,
                          color: active
                            ? "hsl(var(--foreground))"
                            : "hsl(var(--muted-foreground))",
                          userSelect: "none",
                        }}
                      >
                        {v}
                      </div>
                    );
                  })}
                  <div style={{ height: setpointItemHeight }} />
                </div>
                <Button
                  variant="outline"
                  // size="icon"
                  onClick={() => adjustSetpoint(1)}
                  style={{ height: 100, width: "100%" }}
                >
                  <PlusIcon />
                </Button>
              </div>
            </div>

            {/* {selectedStatus?.data ? (
              <div
                style={{
                  marginTop: 12,
                  padding: 12,
                  borderRadius: 10,
                  border: "1px solid hsl(var(--border))",
                  backgroundColor: "hsl(var(--background) / 0.25)",
                  display: "grid",
                  gridTemplateColumns: "1fr",
                  gap: 8,
                  fontSize: 13,
                }}
              >
                {Object.entries(selectedStatus.data).map(([k, v]) => (
                  <div
                    key={k}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <div style={{ opacity: 0.75, textTransform: "capitalize" }}>
                      {k.replace(/([A-Z])/g, " $1")}
                    </div>
                    <div style={{ fontWeight: 600 }}>{String(v)}</div>
                  </div>
                ))}
              </div>
            ) : null} */}

            {selectedKey ? (
              <div
                style={{
                  marginTop: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: 12,
                  borderRadius: 10,
                  border: "1px solid hsl(var(--border))",
                  backgroundColor: "hsl(var(--background) / 0.25)",
                }}
              >
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 4 }}
                >
                  <div style={{ fontWeight: 600 }}>Kontrol</div>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: 0.6,
                      color: selectedStatus?.status
                        ? "hsl(142 71% 45%)"
                        : "hsl(var(--destructive))",
                    }}
                  >
                    {selectedStatus?.status ? "ON" : "OFF"}
                  </div>
                </div>

                {/* SWITCH */}
                <div
                  onClick={() => {
                    const next = !selectedStatus?.status;
                    setStatusItems((prev) =>
                      prev.map((it) =>
                        it.key === selectedKey ? { ...it, status: next } : it,
                      ),
                    );
                  }}
                  className={`
                    w-20 h-10 
                    rounded-full 
                    cursor-pointer 
                    transition-colors 
                    flex items-center
                    px-1
                    ${selectedStatus?.status ? "bg-green-600" : "bg-red-600"}
                  `}
                >
                  <div
                    className={`
                      w-8 h-8 
                      bg-gray-800 
                      rounded-full 
                      shadow-md 
                      transition-transform 
                      duration-200
                      ${selectedStatus?.status ? "translate-x-10" : "translate-x-0"}
                    `}
                  />
                </div>
              </div>
            ) : null}

            {selectedStatus?.imageSrc ? (
              <div
                style={{
                  marginTop: 12,
                  display: "flex",
                  justifyContent: "center",
                }}
              >
                <img
                  src={selectedStatus.imageSrc}
                  alt={selectedStatus.title}
                  style={{ maxHeight: 220, objectFit: "contain" }}
                />
              </div>
            ) : null}
            <div
              style={{
                marginTop: 16,
                display: "flex",
                justifyContent: "flex-end",
              }}
            >
              <Button
                variant="outline"
                onClick={() => {
                  setIsModalOpen(false);
                  setSelectedKey(null);
                }}
              >
                Tutup
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Configuration Dialog */}
      <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configure Data Source</DialogTitle>
            <DialogDescription>
              Pilih source type lalu parameter atau set-point untuk ditampilkan di card.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="sourceTypeSelect">Source Type</Label>
              <Select value={configSourceType} onValueChange={(value) => setConfigSourceType(value as "parameter" | "set_point")}>
                <SelectTrigger id="sourceTypeSelect">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="parameter">Parameter</SelectItem>
                  <SelectItem value="set_point">Set-Point</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              {configSourceType === "parameter" ? (
                <>
                  <Label htmlFor="parameterSelect">Parameter</Label>
                  <Select
                    value={configParameterId ? String(configParameterId) : "none"}
                    onValueChange={(value) => {
                      setConfigParameterId(value === "none" ? "" : value);
                    }}
                  >
                    <SelectTrigger id="parameterSelect">
                      <SelectValue placeholder="Select a parameter" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None (Use static value)</SelectItem>
                      {readParameters.map((param) => (
                        <SelectItem key={param.id} value={String(param.id)}>
                          {param.nama} {param.device ? `(${(param.device as any).nama || ''})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              ) : (
                <>
                  <Label htmlFor="setPointSelect">Set-Point</Label>
                  <Select
                    value={configSetPointId ? String(configSetPointId) : "none"}
                    onValueChange={(value) => {
                      setConfigSetPointId(value === "none" ? "" : value);
                    }}
                  >
                    <SelectTrigger id="setPointSelect">
                      <SelectValue placeholder="Select a set-point" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None (Use static value)</SelectItem>
                      {setPoints.map((sp) => (
                        <SelectItem key={sp.id} value={String(sp.id)}>
                          {sp.name} {sp.unit ? `(${sp.unit})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={saveConfig}
              disabled={saveConfigMutation.isPending}
            >
              {saveConfigMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
