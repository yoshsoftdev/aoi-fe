import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Switch } from "../ui/switch";
import { MinusIcon, PlusIcon } from "lucide-react";

export function ImcPage() {
  const [statusItems, setStatusItems] = useState(() => [
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
            <Card className="p-4 flex flex-col items-center">
              <div className="font-bold">Lembap Ambien</div>
              <div>
                <img src="/img/humid.png" alt="" width={150} />
              </div>
            </Card>
            <Card className="p-4 flex flex-col items-center">
              <div className="font-bold">Suhu Ambien</div>
              <div>
                <img src="/img/temp.png" alt="" width={150} />
              </div>
            </Card>
          </div>
        </Card>
        {/* Status */}
        <Card className="md:col-span-3 p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {statusItems.map((item) => (
              <button
                key={item.key}
                type="button"
                className="rounded-xl border bg-card text-card-foreground shadow-sm p-4 flex flex-col items-center cursor-pointer select-none hover:bg-accent/40"
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
                <div className="flex items-center">
                  <img src={item.imageSrc} alt={item.title} width={150} />
                  <div className="font-bold text-[20px]">
                    {String((item as any)?.data?.setpoint ?? "-")}%
                  </div>
                </div>
              </button>
            ))}
          </div>
        </Card>
      </div>
      <div className="h-[calc(100vh-280px)] grid grid-cols-2 gap-3">
        <Card className="p-4 h-full">
          <div className="h-full flex flex-col">
            <span className="mb-2 font-bold text-center">
              Sirkulasi Cairan Dielektrik
            </span>

            <div className="grid grid-cols-3 gap-3 flex-1">
              <Card className="h-full p-4 border-none">
                <div className="flex flex-col justify-center items-center h-full">
                  <div className="font-semibold">Suhu °C</div>
                  <div>
                    <img src="/img/temp.png" alt="" />
                  </div>
                  <div className="text-[30px] font-bold">34.5</div>
                </div>
              </Card>
              <Card className="h-full p-4 border-none">
                <div className="flex flex-col justify-center items-center h-full">
                  <div className="font-semibold">Aliran m/s</div>
                  <div>
                    <img src="/img/pipe.png" alt="" />
                  </div>
                  <div className="text-[30px] font-bold">0.65</div>
                </div>
              </Card>
              <Card className="h-full p-4 border-none">
                <div className="flex flex-col justify-center items-center h-full">
                  <div className="font-semibold">Tekanan Bar</div>
                  <div>
                    <img src="/img/gauge.png" alt="" />
                  </div>
                  <div className="text-[30px] font-bold">0.84</div>
                </div>
              </Card>
            </div>
          </div>
        </Card>

        <Card className="p-4 h-full">
          <div className="h-full flex flex-col">
            <span className="mb-2 font-bold text-center">
              Sirkulasi Cairan H2O
            </span>

            <div className="grid grid-cols-3 gap-3 flex-1">
              <Card className="h-full p-4 border-none">
                <div className="flex flex-col justify-center items-center h-full">
                  <div className="font-semibold">Suhu °C</div>
                  <div>
                    <img src="/img/temp.png" alt="" />
                  </div>
                  <div className="text-[30px] font-bold">34.5</div>
                </div>
              </Card>
              <Card className="h-full p-4 border-none">
                <div className="flex flex-col justify-center items-center h-full">
                  <div className="font-semibold">Aliran m/s</div>
                  <div>
                    <img src="/img/pipe.png" alt="" />
                  </div>
                  <div className="text-[30px] font-bold">0.65</div>
                </div>
              </Card>
              <Card className="h-full p-4 border-none">
                <div className="flex flex-col justify-center items-center h-full">
                  <div className="font-semibold">Tekanan Bar</div>
                  <div>
                    <img src="/img/gauge.png" alt="" />
                  </div>
                  <div className="text-[30px] font-bold">0.84</div>
                </div>
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
    </div>
  );
}
