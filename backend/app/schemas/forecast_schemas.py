from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class ForecastRequest(BaseModel):
    target_date: Optional[str] = None  # YYYY-MM-DD, defaults to day after latest record
    model_name: str = "auto"           # auto, ml_ridge, ml_rf, seasonal_naive, moving_average, tabpfn
    service_level: float = 0.85        # Service level for prep recommendation (e.g. 0.85 = P85 quantile buffer to avoid stockouts on high-margin items)

class ForecastItemOut(BaseModel):
    item: str
    target_date: str
    point_forecast: float
    lower_bound: float
    upper_bound: float
    recommended_prep: int
    forecast_method: str
    data_sufficiency: str
    short_explanation: str
    stats: Dict[str, Any] = {}

class ForecastResponse(BaseModel):
    run_id: int
    target_date: str
    target_weekday: str
    model_name: str
    created_at: str
    items: List[ForecastItemOut]

class PrepItemUpdate(BaseModel):
    item: str
    final_quantity: int
    is_overridden: bool = False
    baker_notes: str = ""

class PrepListSaveRequest(BaseModel):
    target_date: str
    items: List[PrepItemUpdate]

class PrepItemOut(BaseModel):
    item: str
    target_date: str
    forecast_point: float
    suggested_prep: int
    final_quantity: int
    is_overridden: bool
    baker_notes: str
    reason: str

class PrepListResponse(BaseModel):
    target_date: str
    updated_at: str
    items: List[PrepItemOut]

class BacktestRequest(BaseModel):
    window_days: int = Field(default=21, ge=7, le=60)
    model_name: str = "auto"

class ModelMetrics(BaseModel):
    mae: float
    wape: float
    rmse: float
    coverage_rate: Optional[float] = None
    sample_size: int

class BacktestTimelinePoint(BaseModel):
    date: str
    actual: float
    is_stockout: bool
    estimated_demand: Optional[float] = None
    predictions: Dict[str, float] = {}

class BacktestItemSummary(BaseModel):
    item: str
    sample_size: int
    uncensored_sample_size: int
    stockout_sample_size: int
    models: Dict[str, ModelMetrics]
    timeline: List[BacktestTimelinePoint] = []

class BacktestResponse(BaseModel):
    evaluated_at: str
    start_date: str
    end_date: str
    window_days: int
    overall: Dict[str, ModelMetrics]
    per_item: List[BacktestItemSummary]
    uncensored_comparison: Dict[str, ModelMetrics]
    limitations: List[str]
