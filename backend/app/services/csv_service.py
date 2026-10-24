import io
import re
from typing import Dict, List, Optional, Tuple, Any
import numpy as np
import pandas as pd
from datetime import datetime, timedelta

from app.schemas.data_schemas import ColumnMapping, CSVValidationReport
from app.services.censored_demand import censored_demand_service

COMMON_COLUMN_SYNONYMS = {
    "date": ["date", "sale_date", "day", "transaction_date", "order_date", "timestamp", "dt"],
    "item": ["item", "product", "product_name", "item_name", "description", "menu_item", "sku", "name"],
    "quantity_sold": ["quantity_sold", "quantity", "qty", "sold", "units", "units_sold", "count", "amount_sold"],
    "sold_out_time": ["sold_out_time", "soldout_time", "stockout_time", "stock_out_time", "out_of_stock_time", "sold_out_at"],
    "closing_time": ["closing_time", "close_time", "closed_at", "closing_hour", "closing"],
    "unit_price": ["unit_price", "price", "retail_price", "unit_cost", "item_price", "selling_price"],
    "notes": ["notes", "note", "comment", "remarks", "promotion", "event"]
}

class CSVService:
    """Service to handle POS CSV upload, automatic synonym matching, validation, aggregation, and canonical conversion."""

    def detect_column_mapping(self, df_columns: List[str]) -> ColumnMapping:
        """Heuristically suggests mappings based on common column synonyms."""
        detected = {}
        cols_lower = {col.lower().strip().replace(" ", "_").replace("-", "_"): col for col in df_columns}
        
        for canonical, synonyms in COMMON_COLUMN_SYNONYMS.items():
            matched_col = None
            for syn in synonyms:
                if syn in cols_lower:
                    matched_col = cols_lower[syn]
                    break
            if matched_col:
                detected[canonical] = matched_col
            elif canonical in ("sold_out_time", "closing_time", "unit_price", "notes"):
                detected[canonical] = None
                
        return ColumnMapping(
            date=detected.get("date", "date"),
            item=detected.get("item", "item"),
            quantity_sold=detected.get("quantity_sold", "quantity_sold"),
            sold_out_time=detected.get("sold_out_time"),
            closing_time=detected.get("closing_time"),
            unit_price=detected.get("unit_price"),
            notes=detected.get("notes")
        )

    def parse_flexible_date(self, val: Any) -> Optional[str]:
        """Tries multiple date formats safely without throwing exceptions."""
        if pd.isna(val) or val is None or str(val).strip() == "":
            return None
        val_str = str(val).strip()
        # Common ISO format
        if re.match(r"^\d{4}-\d{2}-\d{2}", val_str):
            return val_str[:10]
        # Try pandas parsing
        try:
            parsed = pd.to_datetime(val_str, errors="coerce")
            if pd.notna(parsed):
                return parsed.strftime("%Y-%m-%d")
        except Exception:
            pass
        return None

    def validate_and_process_csv(
        self,
        file_content: bytes,
        mapping: Optional[ColumnMapping] = None
    ) -> Tuple[CSVValidationReport, Optional[pd.DataFrame]]:
        """
        Parses raw CSV bytes, applies column mapping, validates formats,
        aggregates duplicate records, identifies stockouts, and runs censored demand estimation.
        """
        errors: List[str] = []
        warnings: List[str] = []

        try:
            # Try utf-8, then fallback to latin1
            try:
                df_raw = pd.read_csv(io.BytesIO(file_content), encoding="utf-8")
            except UnicodeDecodeError:
                df_raw = pd.read_csv(io.BytesIO(file_content), encoding="latin1")
        except Exception as e:
            return CSVValidationReport(
                is_valid=False,
                total_raw_rows=0,
                valid_aggregated_rows=0,
                items_count=0,
                items=[],
                errors=[f"Failed to read CSV file: {str(e)}"],
                warnings=[]
            ), None

        if df_raw.empty:
            return CSVValidationReport(
                is_valid=False,
                total_raw_rows=0,
                valid_aggregated_rows=0,
                items_count=0,
                items=[],
                errors=["The uploaded CSV file is completely empty."],
                warnings=[]
            ), None

        # Clean column headers
        df_raw.columns = [str(c).strip() for c in df_raw.columns]

        if not mapping:
            mapping = self.detect_column_mapping(list(df_raw.columns))

        # Check required columns
        if mapping.date not in df_raw.columns:
            errors.append(f"Required date column '{mapping.date}' not found in CSV. Found: {list(df_raw.columns)}")
        if mapping.item not in df_raw.columns:
            errors.append(f"Required item column '{mapping.item}' not found in CSV. Found: {list(df_raw.columns)}")
        if mapping.quantity_sold not in df_raw.columns:
            errors.append(f"Required quantity_sold column '{mapping.quantity_sold}' not found in CSV. Found: {list(df_raw.columns)}")

        if errors:
            return CSVValidationReport(
                is_valid=False,
                total_raw_rows=len(df_raw),
                valid_aggregated_rows=0,
                items_count=0,
                items=[],
                errors=errors,
                warnings=warnings
            ), None

        # Build working canonical dataframe
        df = pd.DataFrame()
        df["date_raw"] = df_raw[mapping.date]
        df["item_raw"] = df_raw[mapping.item]
        df["quantity_raw"] = df_raw[mapping.quantity_sold]

        if mapping.sold_out_time and mapping.sold_out_time in df_raw.columns:
            df["sold_out_time"] = df_raw[mapping.sold_out_time].astype(str).str.strip().replace({"nan": None, "None": None, "": None})
        else:
            df["sold_out_time"] = None

        if mapping.closing_time and mapping.closing_time in df_raw.columns:
            df["closing_time"] = df_raw[mapping.closing_time].astype(str).str.strip().replace({"nan": None, "None": None, "": None})
        else:
            df["closing_time"] = None

        if mapping.unit_price and mapping.unit_price in df_raw.columns:
            df["unit_price"] = pd.to_numeric(df_raw[mapping.unit_price], errors="coerce")
        else:
            df["unit_price"] = None

        # Parse date
        df["date"] = df["date_raw"].apply(self.parse_flexible_date)
        invalid_dates = df["date"].isna().sum()
        if invalid_dates > 0:
            warnings.append(f"Dropped {invalid_dates} rows with unparseable or blank dates.")
            df = df.dropna(subset=["date"])

        # Parse item
        df["item"] = df["item_raw"].astype(str).str.strip()
        blank_items = (df["item"] == "").sum() + (df["item"].str.lower() == "nan").sum()
        if blank_items > 0:
            warnings.append(f"Dropped {blank_items} rows with blank item names.")
            df = df[df["item"] != ""]
            df = df[df["item"].str.lower() != "nan"]

        # Parse quantity
        df["quantity_sold"] = pd.to_numeric(df["quantity_raw"], errors="coerce")
        invalid_qty = df["quantity_sold"].isna().sum()
        if invalid_qty > 0:
            warnings.append(f"Found {invalid_qty} non-numeric quantities; converted to 0.")
            df["quantity_sold"] = df["quantity_sold"].fillna(0.0)

        negative_qty = (df["quantity_sold"] < 0).sum()
        if negative_qty > 0:
            warnings.append(f"Found {negative_qty} negative quantities (e.g. returns/voids); clamped to 0.")
            df["quantity_sold"] = df["quantity_sold"].clip(lower=0.0)

        if df.empty:
            return CSVValidationReport(
                is_valid=False,
                total_raw_rows=len(df_raw),
                valid_aggregated_rows=0,
                items_count=0,
                items=[],
                errors=["No valid rows remaining after filtering invalid dates and items."],
                warnings=warnings
            ), None

        # Check for duplicate item-date rows and aggregate
        total_before_agg = len(df)
        
        # Aggregation logic:
        # Sum quantity_sold, keep average unit_price, keep earliest sold_out_time if any, keep latest closing_time
        def earliest_time(series):
            valid = [s for s in series if s and s != "None" and pd.notna(s)]
            return min(valid) if valid else None

        def latest_time(series):
            valid = [s for s in series if s and s != "None" and pd.notna(s)]
            return max(valid) if valid else None

        agg_dict = {
            "quantity_sold": "sum",
            "unit_price": "mean",
            "sold_out_time": earliest_time,
            "closing_time": latest_time
        }
        
        df_agg = df.groupby(["date", "item"], as_index=False).agg(agg_dict)
        duplicates_count = total_before_agg - len(df_agg)
        if duplicates_count > 0:
            warnings.append(f"Aggregated {duplicates_count} duplicate item-date records by summing quantities.")

        # Sort chronologically
        df_agg = df_agg.sort_values(["item", "date"]).reset_index(drop=True)

        # Distinguish genuine zero sales from missing records
        zero_sales = int((df_agg["quantity_sold"] == 0).sum())
        
        # Check date continuity for items
        unique_items = sorted(df_agg["item"].unique().tolist())
        date_min = df_agg["date"].min()
        date_max = df_agg["date"].max()

        # Compute missing dates count
        missing_dates_count = 0
        try:
            full_date_range = pd.date_range(start=date_min, end=date_max, freq="D").strftime("%Y-%m-%d").tolist()
            total_expected_slots = len(unique_items) * len(full_date_range)
            missing_dates_count = max(0, total_expected_slots - len(df_agg))
            if missing_dates_count > 0:
                warnings.append(
                    f"Notice: {missing_dates_count} item-date combinations are not present in the CSV. "
                    "These will be treated as non-operating/unoffered days rather than artificial zero demand."
                )
        except Exception:
            pass

        # Run Censored Demand Estimation
        df_processed = censored_demand_service.process_dataframe(df_agg)
        stockouts_detected = int(df_processed["is_stockout"].sum())

        # Generate sample preview (up to 10 rows)
        preview_cols = ["date", "item", "quantity_sold", "sold_out_time", "closing_time", "is_stockout", "estimated_demand"]
        preview_data = df_processed[[c for c in preview_cols if c in df_processed.columns]].head(10).to_dict(orient="records")

        report = CSVValidationReport(
            is_valid=True,
            total_raw_rows=len(df_raw),
            valid_aggregated_rows=len(df_processed),
            items_count=len(unique_items),
            items=unique_items,
            date_min=date_min,
            date_max=date_max,
            stockouts_detected=stockouts_detected,
            zero_sales_count=zero_sales,
            missing_dates_count=missing_dates_count,
            duplicates_aggregated=duplicates_count,
            errors=errors,
            warnings=warnings,
            preview=preview_data
        )

        return report, df_processed

    def generate_sample_csv(self) -> str:
        """Generates a downloadable sample CSV representing standard bakery POS export."""
        lines = [
            "date,item,quantity_sold,sold_out_time,closing_time,unit_price,notes",
            "2026-10-01,Artisanal Croissant,42,15:45,17:00,3.75,Morning rush",
            "2026-10-01,Sourdough Loaf,22,,17:00,6.50,Full stock day",
            "2026-10-01,Pain au Chocolat,31,13:15,17:00,4.25,Sold out early",
            "2026-10-01,Cinnamon Morning Bun,18,,17:00,4.00,Standard day",
            "2026-10-02,Artisanal Croissant,50,11:20,17:00,3.75,Sold out before lunch",
            "2026-10-02,Sourdough Loaf,26,16:10,17:00,6.50,Late stockout",
            "2026-10-02,Pain au Chocolat,38,12:00,17:00,4.25,Busy Friday",
            "2026-10-02,Cinnamon Morning Bun,25,14:30,17:00,4.00,Sold out",
            "2026-10-03,Artisanal Croissant,68,14:00,17:00,3.75,Saturday market crowd",
            "2026-10-03,Sourdough Loaf,35,15:30,17:00,6.50,Weekend peak",
            "2026-10-03,Pain au Chocolat,45,13:45,17:00,4.25,High demand",
            "2026-10-03,Cinnamon Morning Bun,32,15:00,17:00,4.00,Weekend special"
        ]
        return "\n".join(lines)

csv_service = CSVService()
