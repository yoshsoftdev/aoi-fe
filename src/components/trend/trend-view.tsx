import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { trendService, type MinutePoint, type HourPoint, type DayPoint } from "@/services/trendService";
import { parameterService } from "@/services/parameterService";
import { Parameter } from "@/types/parameter";
import { ParameterChart } from "@/components/dashboard/parameter-chart";
import type { HistoryDataPoint } from "@/hooks/useParameterHistory";
import { Loader2 } from "lucide-react";

type Granularity = "minutes" | "hours" | "days";

// Helper to convert date (YYYY-MM-DD) to RFC3339 start-of-day / end-of-day
const toRFC3339Range = (date: string | undefined, endOfDay = false): string | undefined => {
  if (!date) return undefined;
  return endOfDay ? `${date}T23:59:59Z` : `${date}T00:00:00Z`;
};

// Convert trend points to HistoryDataPoint[] for reuse in ParameterChart
const mapMinutesToHistory = (points: MinutePoint[]): HistoryDataPoint[] =>
  points.map((p) => ({
    timestamp: new Date(p.period_start),
    value: typeof p.avg_value === "number" ? p.avg_value : Number(p.avg_value ?? 0),
    status: "ok",
  }));

const mapHoursToHistory = (points: HourPoint[]): HistoryDataPoint[] => mapMinutesToHistory(points);
const mapDaysToHistory = (points: DayPoint[]): HistoryDataPoint[] => mapMinutesToHistory(points);

export function TrendView() {
  const [selectedParamId, setSelectedParamId] = useState<number | null>(null);
  const [granularity, setGranularity] = useState<Granularity>("minutes");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  // Load parameter list for dropdown
  const {
    data: parameters = [],
    isLoading: isLoadingParams,
    error: paramsError,
  } = useQuery<Parameter[]>({
    queryKey: ["parameters", "trend"],
    queryFn: () => parameterService.getAll(),
  });

  // Query for minutes (1 jam terakhir)
  const {
    data: minutesData = [],
    isLoading: isLoadingMinutes,
    error: minutesError,
  } = useQuery<MinutePoint[]>({
    queryKey: ["trend", "minutes", selectedParamId],
    queryFn: () => trendService.getMinutes(selectedParamId as number),
    enabled: granularity === "minutes" && !!selectedParamId,
    refetchInterval: 60_000, // refresh setiap 1 menit
  });

  // Query untuk jam
  const {
    data: hoursData = [],
    isLoading: isLoadingHours,
    error: hoursError,
    refetch: refetchHours,
  } = useQuery<HourPoint[]>({
    queryKey: ["trend", "hours", selectedParamId, fromDate, toDate],
    queryFn: () =>
      trendService.getHours(
        selectedParamId as number,
        toRFC3339Range(fromDate, false),
        toRFC3339Range(toDate, true),
      ),
    enabled: granularity === "hours" && !!selectedParamId,
  });

  // Query untuk hari
  const {
    data: daysData = [],
    isLoading: isLoadingDays,
    error: daysError,
    refetch: refetchDays,
  } = useQuery<DayPoint[]>({
    queryKey: ["trend", "days", selectedParamId, fromDate, toDate],
    queryFn: () =>
      trendService.getDays(
        selectedParamId as number,
        toRFC3339Range(fromDate, false),
        toRFC3339Range(toDate, true),
      ),
    enabled: granularity === "days" && !!selectedParamId,
  });

  const currentParam = parameters.find((p) => p.id === selectedParamId);
  const parameterName = currentParam?.nama || (selectedParamId ? `Parameter ${selectedParamId}` : "Parameter");

  const renderChart = () => {
    if (!selectedParamId) {
      return <p className="text-sm text-muted-foreground">Pilih parameter terlebih dahulu.</p>;
    }

    if (granularity === "minutes") {
      if (isLoadingMinutes) {
        return <LoadingState label="Memuat data per menit (1 jam terakhir)..." />;
      }
      if (minutesError) {
        return <ErrorState error={minutesError} />;
      }
      if (!minutesData.length) {
        return <EmptyState label="Belum ada data per menit untuk 1 jam terakhir." />;
      }
      return <ParameterChart data={mapMinutesToHistory(minutesData)} parameterName={parameterName} />;
    }

    if (granularity === "hours") {
      if (isLoadingHours) {
        return <LoadingState label="Memuat data per jam..." />;
      }
      if (hoursError) {
        return <ErrorState error={hoursError} />;
      }
      if (!hoursData.length) {
        return <EmptyState label="Tidak ada data per jam untuk rentang waktu yang dipilih." />;
      }
      return <ParameterChart data={mapHoursToHistory(hoursData)} parameterName={parameterName} />;
    }

    // days
    if (isLoadingDays) {
      return <LoadingState label="Memuat data per hari..." />;
    }
    if (daysError) {
      return <ErrorState error={daysError} />;
    }
    if (!daysData.length) {
      return <EmptyState label="Tidak ada data per hari untuk rentang waktu yang dipilih." />;
    }
    return <ParameterChart data={mapDaysToHistory(daysData)} parameterName={parameterName} />;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-foreground">Trend Data</h2>
          <p className="text-sm text-muted-foreground">
            Lihat trend data per menit (1 jam terakhir), per jam, atau per hari untuk parameter yang dipilih.
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-end">
          <div className="w-[260px]">
            <label className="block text-xs font-medium text-muted-foreground mb-1">Parameter</label>
            <Select
              value={selectedParamId ? String(selectedParamId) : ""}
              onValueChange={(val) => setSelectedParamId(Number(val))}
              disabled={isLoadingParams || !!paramsError}
            >
              <SelectTrigger>
                <SelectValue placeholder={isLoadingParams ? "Memuat parameter..." : "Pilih parameter"} />
              </SelectTrigger>
              <SelectContent>
                {parameters.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.nama || `Parameter ${p.id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {paramsError && (
              <p className="mt-1 text-xs text-destructive">
                Gagal memuat daftar parameter.
              </p>
            )}
          </div>

          <div className="w-full md:w-[260px]">
            <label className="block text-xs font-medium text-muted-foreground mb-1">Resolusi</label>
            <Tabs
              value={granularity}
              onValueChange={(val) => {
                setGranularity(val as Granularity);
              }}
            >
              <TabsList className="grid grid-cols-3">
                <TabsTrigger value="minutes">Per Menit</TabsTrigger>
                <TabsTrigger value="hours">Per Jam</TabsTrigger>
                <TabsTrigger value="days">Per Hari</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {(granularity === "hours" || granularity === "days") && (
            <div className="flex gap-3 items-end">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Dari Tanggal
                </label>
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-[160px]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Sampai Tanggal
                </label>
                <Input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-[160px]"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (!selectedParamId) return;
                  if (granularity === "hours") {
                    refetchHours();
                  } else {
                    refetchDays();
                  }
                }}
              >
                Terapkan
              </Button>
            </div>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {granularity === "minutes"
              ? "Per Menit – 1 Jam Terakhir"
              : granularity === "hours"
                ? "Per Jam"
                : "Per Hari"}{" "}
            {currentParam ? `• ${currentParam.nama}` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent>{renderChart()}</CardContent>
      </Card>
    </div>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span>{label}</span>
    </div>
  );
}

function ErrorState({ error }: { error: unknown }) {
  return (
    <p className="text-sm text-destructive">
      Gagal memuat data trend: {(error as any)?.message || "unknown error"}
    </p>
  );
}

function EmptyState({ label }: { label: string }) {
  return <p className="text-sm text-muted-foreground">{label}</p>;
}

