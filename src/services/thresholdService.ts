import api from "./api";

export type ThresholdType = "max" | "min" | "min-max" | "abnormal";

export interface ThresholdConfig {
  id?: number;
  id_parameter: number;
  unit?: string;
  threshold_type: ThresholdType;
  min_value: number;
  max_value: number;
  critical_low: number;
  critical_high: number;
  warning_low: number;
  warning_high: number;
  created_at?: string;
  updated_at?: string;
}

export interface SaveThresholdPayload {
  id?: number;
  id_param: number;
  unit?: string;
  threshold_type: ThresholdType;
  min_value: number;
  max_value: number;
  critical_low: number;
  critical_high: number;
  warning_low: number;
  warning_high: number;
}

export interface ThresholdLogItem {
  id: number;
  parameter_id: number;
  threshold_id?: number;
  threshold_type: string;
  value: number;
  alarm_status: string;
  message: string;
  trigger_at: string;
  resolve_at?: string;
  created_at: string;
}

export const thresholdService = {
  getAll: async (): Promise<ThresholdConfig[]> => {
    const response = await api.get("/tracehold");
    return response.data.data || [];
  },

  getByParameterId: async (parameterId: number): Promise<ThresholdConfig | null> => {
    try {
      const response = await api.get(`/tracehold/${parameterId}`);
      return response.data.data || null;
    } catch {
      return null;
    }
  },

  save: async (payload: SaveThresholdPayload): Promise<ThresholdConfig> => {
    const response = await api.post("/tracehold", payload);
    return response.data.data;
  },

  getLogsByParameterId: async (parameterId: number, limit = 20): Promise<ThresholdLogItem[]> => {
    const response = await api.get(`/threshold-logs/parameter/${parameterId}?limit=${limit}`);
    return response.data.data || [];
  },
};

