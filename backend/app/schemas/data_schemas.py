from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict

class ColumnMapping(BaseModel):
    date: str = "date"
    item: str = "item"
    quantity_sold: str = "quantity_sold"
    sold_out_time: Optional[str] = "sold_out_time"
    closing_time: Optional[str] = "closing_time"
    unit_price: Optional[str] = "unit_price"
    notes: Optional[str] = "notes"

class CSVValidationReport(BaseModel):
    is_valid: bool
    total_raw_rows: int
    valid_aggregated_rows: int
    items_count: int
    items: List[str]
    date_min: Optional[str] = None
    date_max: Optional[str] = None
    stockouts_detected: int = 0
    zero_sales_count: int = 0
    missing_dates_count: int = 0
    duplicates_aggregated: int = 0
    errors: List[str] = []
    warnings: List[str] = []
    preview: List[Dict[str, Any]] = []

class SalesRecordOut(BaseModel):
    id: int
    date: str
    item: str
    quantity_sold: float
    sold_out_time: Optional[str] = None
    closing_time: Optional[str] = None
    unit_price: Optional[float] = None
    is_stockout: bool = False
    estimated_demand: Optional[float] = None
    estimated_lower: Optional[float] = None
    estimated_upper: Optional[float] = None
    correction_method: Optional[str] = None
    data_sufficiency: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class SalesSummary(BaseModel):
    total_records: int
    unique_items: int
    items: List[str]
    date_min: Optional[str] = None
    date_max: Optional[str] = None
    stockout_count: int = 0
    stockout_rate_pct: float = 0.0
    total_quantity_sold: float = 0.0
    estimated_lost_demand_units: float = 0.0
