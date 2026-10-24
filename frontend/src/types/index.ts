export interface ColumnMapping {
  date: string;
  item: string;
  quantity_sold: string;
  sold_out_time?: string | null;
  closing_time?: string | null;
  unit_price?: string | null;
  notes?: string | null;
}

export interface CSVValidationReport {
  is_valid: boolean;
  total_raw_rows: number;
  valid_aggregated_rows: number;
  items_count: number;
  items: string[];
  date_min?: string | null;
  date_max?: string | null;
  stockouts_detected: number;
  zero_sales_count: number;
  missing_dates_count: number;
  duplicates_aggregated: number;
  errors: string[];
  warnings: string[];
  preview: Record<string, any>[];
}

export interface SalesSummary {
  total_records: number;
  unique_items: number;
  items: string[];
  date_min?: string | null;
  date_max?: string | null;
  stockout_count: number;
  stockout_rate_pct: number;
  total_quantity_sold: number;
  estimated_lost_demand_units: number;
}

export interface ItemStats {
  sample_size?: number;
  same_dow_avg?: number | null;
  trend_direction?: string;
  stockout_count?: number;
  unit_price?: number | null;
  recent_7d_avg?: number | null;
}

export interface ForecastItem {
  item: string;
  target_date: string;
  point_forecast: number;
  lower_bound: number;
  upper_bound: number;
  recommended_prep: number;
  forecast_method: string;
  data_sufficiency: 'robust' | 'moderate' | 'limited';
  short_explanation: string;
  stats: ItemStats;
}

export interface ForecastResponse {
  run_id: number;
  target_date: string;
  target_weekday: string;
  model_name: string;
  created_at: string;
  items: ForecastItem[];
}

export interface PrepItem {
  item: string;
  target_date: string;
  forecast_point: number;
  suggested_prep: number;
  final_quantity: number;
  is_overridden: boolean;
  baker_notes: string;
  reason: string;
}

export interface PrepListResponse {
  target_date: string;
  updated_at: string;
  items: PrepItem[];
}

export interface ModelMetrics {
  mae: number;
  wape: number;
  rmse: number;
  coverage_rate?: number | null;
  sample_size: number;
}

export interface BacktestTimelinePoint {
  date: string;
  actual: number;
  is_stockout: boolean;
  estimated_demand?: number | null;
  predictions: Record<string, number>;
}

export interface BacktestItemSummary {
  item: string;
  sample_size: number;
  uncensored_sample_size: number;
  stockout_sample_size: number;
  models: Record<string, ModelMetrics>;
  timeline: BacktestTimelinePoint[];
}

export interface BacktestResponse {
  evaluated_at: string;
  start_date: string;
  end_date: string;
  window_days: number;
  overall: Record<string, ModelMetrics>;
  per_item: BacktestItemSummary[];
  uncensored_comparison: Record<string, ModelMetrics>;
  limitations: string[];
}

export interface OllamaStatus {
  is_available: boolean;
  base_url: string;
  available_models: string[];
  has_gemma: boolean;
  status_message: string;
}

export interface TabPFNStatus {
  name: string;
  is_available: boolean;
  status_message: string;
  fallback_active: boolean;
  fallback_model: string;
}

export interface MenuItemSummary {
  name: string;
  observations_count: number;
  stockout_count: number;
  stockout_pct: number;
  avg_daily_sales: number;
}
