import type {
  SalesSummary,
  CSVValidationReport,
  ColumnMapping,
  ForecastResponse,
  PrepListResponse,
  BacktestResponse,
  OllamaStatus,
  TabPFNStatus,
  MenuItemSummary
} from '../types';

const API_BASE = '/api';

export const api = {
  // Health & Service statuses
  async checkHealth(): Promise<{ status: string; tabpfn_available: boolean }> {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) throw new Error('Backend unreachable');
    return res.json();
  },

  async getLlmStatus(): Promise<OllamaStatus> {
    const res = await fetch(`${API_BASE}/llm-status`);
    if (!res.ok) throw new Error('Failed to fetch LLM status');
    return res.json();
  },

  async getTabpfnStatus(): Promise<TabPFNStatus> {
    const res = await fetch(`${API_BASE}/tabpfn-status`);
    if (!res.ok) throw new Error('Failed to fetch TabPFN status');
    return res.json();
  },

  // Sales Data & Demo
  async getSalesSummary(): Promise<SalesSummary> {
    const res = await fetch(`${API_BASE}/sales/summary`);
    if (!res.ok) throw new Error('Failed to fetch sales summary');
    return res.json();
  },

  async getItems(): Promise<MenuItemSummary[]> {
    const res = await fetch(`${API_BASE}/items`);
    if (!res.ok) throw new Error('Failed to fetch items');
    return res.json();
  },

  async loadDemoData(days: number = 75): Promise<CSVValidationReport> {
    const res = await fetch(`${API_BASE}/demo/load?days=${days}`, {
      method: 'POST',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to load demo dataset');
    }
    return res.json();
  },

  async uploadCSV(file: File, mapping?: ColumnMapping): Promise<CSVValidationReport> {
    const formData = new FormData();
    formData.append('file', file);
    if (mapping) {
      formData.append('mapping_json', JSON.stringify(mapping));
    }

    const res = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to upload CSV');
    }
    return res.json();
  },

  getSampleCsvUrl(): string {
    return `${API_BASE}/sample-csv`;
  },

  // Forecasting
  async generateForecast(modelName: string = 'auto', serviceLevel: number = 0.85, targetDate?: string): Promise<ForecastResponse> {
    const res = await fetch(`${API_BASE}/forecast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model_name: modelName,
        service_level: serviceLevel,
        target_date: targetDate || null,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to generate forecast');
    }
    return res.json();
  },

  async getLatestForecast(): Promise<ForecastResponse | null> {
    const res = await fetch(`${API_BASE}/forecast/latest`);
    if (!res.ok) return null;
    return res.json();
  },

  // Prep List
  async getLatestPrepList(targetDate?: string): Promise<PrepListResponse | null> {
    const url = targetDate ? `${API_BASE}/prep-list/latest?target_date=${targetDate}` : `${API_BASE}/prep-list/latest`;
    const res = await fetch(url);
    if (!res.ok) return null;
    return res.json();
  },

  async savePrepList(targetDate: string, items: { item: string; final_quantity: number; is_overridden: boolean; baker_notes: string }[]): Promise<PrepListResponse> {
    const res = await fetch(`${API_BASE}/prep-list`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target_date: targetDate,
        items,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to save prep list');
    }
    return res.json();
  },

  getPrepListExportUrl(targetDate?: string): string {
    return targetDate ? `${API_BASE}/prep-list/export?target_date=${targetDate}` : `${API_BASE}/prep-list/export`;
  },

  // Backtesting
  async runBacktest(windowDays: number = 21, modelName: string = 'auto'): Promise<BacktestResponse> {
    const res = await fetch(`${API_BASE}/backtest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        window_days: windowDays,
        model_name: modelName,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to run backtest');
    }
    return res.json();
  },

  async getModelPerformance(): Promise<BacktestResponse | null> {
    const res = await fetch(`${API_BASE}/model-performance`);
    if (!res.ok) return null;
    return res.json();
  },

  // Reset Data
  async resetData(): Promise<{ message: string }> {
    const res = await fetch(`${API_BASE}/reset-data`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to reset data');
    return res.json();
  },
};
