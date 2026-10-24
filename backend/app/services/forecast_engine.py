from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
import numpy as np
import pandas as pd
from sqlalchemy.orm import Session

from app.database.models import SalesRecord, ForecastRun, ForecastItem, PrepListItem
from app.schemas.forecast_schemas import ForecastRequest, ForecastResponse, ForecastItemOut
from app.forecasting.baselines import SeasonalNaiveForecaster, FourWeekMovingAverageForecaster
from app.forecasting.ml_model import BakeryMLForecaster
from app.forecasting.tabpfn_adapter import tabpfn_adapter
from app.services.llm_explainer import llm_explainer

class ForecastEngine:
    """
    Main orchestrator for generating bakery item forecasts, prediction intervals,
    suggested preparation quantities, and natural-language explanations.
    """

    def __init__(self):
        self.seasonal_naive = SeasonalNaiveForecaster()
        self.four_week_ma = FourWeekMovingAverageForecaster()
        self.ml_forecaster = BakeryMLForecaster()
        self.tabpfn = tabpfn_adapter

    def compute_item_statistics(self, df_item: pd.DataFrame, target_date: str) -> Dict[str, Any]:
        """Calculates historical summary metrics for an item to feed explanations and prep buffer."""
        target_dt = pd.to_datetime(target_date)
        target_dow = target_dt.weekday()
        
        history = df_item[df_item["date"] < target_date].sort_values("date")
        if history.empty:
            return {"sample_size": 0}

        val_col = "estimated_demand" if "estimated_demand" in history.columns else "quantity_sold"
        recent_14 = history.tail(14)
        same_dow = history[pd.to_datetime(history["date"]).dt.weekday == target_dow]

        same_dow_vals = same_dow[val_col].tolist()
        same_dow_avg = round(float(np.mean(same_dow_vals[-4:])), 1) if same_dow_vals else None

        # Trend direction over last 14 days
        trend_direction = "steady"
        if len(recent_14) >= 7:
            y = recent_14[val_col].values
            x = np.arange(len(y))
            slope = float(np.polyfit(x, y, 1)[0])
            if slope > 0.4:
                trend_direction = "increasing"
            elif slope < -0.4:
                trend_direction = "decreasing"

        # Stockout count in last 30 days
        recent_30 = history.tail(30)
        stockout_count = int(recent_30["is_stockout"].sum()) if "is_stockout" in recent_30.columns else 0

        # Mean unit price if available
        unit_price = float(history["unit_price"].dropna().mean()) if "unit_price" in history.columns and not history["unit_price"].dropna().empty else None

        return {
            "sample_size": len(history),
            "same_dow_avg": same_dow_avg,
            "trend_direction": trend_direction,
            "stockout_count": stockout_count,
            "unit_price": unit_price,
            "recent_7d_avg": round(float(history.tail(7)[val_col].mean()), 1) if len(history) >= 7 else None
        }

    def determine_target_date(self, db: Session, requested_date: Optional[str]) -> str:
        """Determines forecast target date: user specified, or day after latest sales record."""
        if requested_date:
            return requested_date
        
        latest_rec = db.query(SalesRecord.date).order_by(SalesRecord.date.desc()).first()
        if latest_rec and latest_rec[0]:
            next_day = pd.to_datetime(latest_rec[0]) + timedelta(days=1)
            return next_day.strftime("%Y-%m-%d")
            
        return (datetime.now().date() + timedelta(days=1)).strftime("%Y-%m-%d")

    def generate_forecasts(self, db: Session, req: ForecastRequest) -> ForecastResponse:
        """Runs the selected forecasting pipeline across all active items."""
        # Query all sales records into a DataFrame
        query = db.query(SalesRecord)
        df_all = pd.read_sql(query.statement, db.bind)
        
        if df_all.empty:
            raise ValueError("No sales data available. Please upload a POS CSV or load the demo dataset first.")

        target_date = self.determine_target_date(db, req.target_date)
        target_dt = pd.to_datetime(target_date)
        target_weekday_name = target_dt.strftime("%A")

        items = sorted(df_all["item"].unique().tolist())
        forecast_items: List[ForecastItemOut] = []

        # Create ForecastRun in DB
        forecast_run = ForecastRun(
            target_date=target_date,
            model_name=req.model_name,
            summary_json=""
        )
        db.add(forecast_run)
        db.flush()

        for item_name in items:
            df_item = df_all[df_all["item"] == item_name].sort_values("date").reset_index(drop=True)
            stats = self.compute_item_statistics(df_item, target_date)

            # Choose model
            if req.model_name == "seasonal_naive":
                pred_result = self.seasonal_naive.predict(df_item, target_date)
            elif req.model_name in ("moving_average", "four_week_ma"):
                pred_result = self.four_week_ma.predict(df_item, target_date)
            elif req.model_name == "tabpfn":
                pred_result = self.tabpfn.predict(df_item, target_date)
            elif req.model_name == "ml_rf":
                pred_result = self.ml_forecaster.predict(df_item, target_date)
            else:  # "auto" mode
                # Auto chooses TabPFN if requested and available, or ML if >= 14 samples, else 4-week MA
                if len(df_item) >= 14:
                    pred_result = self.ml_forecaster.predict(df_item, target_date)
                else:
                    pred_result = self.four_week_ma.predict(df_item, target_date)

            point = float(pred_result["point_forecast"])
            lower = float(pred_result["lower_bound"])
            upper = float(pred_result["upper_bound"])
            method = str(pred_result["method"])
            sufficiency = str(pred_result["data_sufficiency"])

            # Recommended prep calculation:
            # Bakeries typically buffer slightly above expected demand for fresh items to avoid costly stockouts,
            # especially on weekends or high-margin items (service level buffer)
            service_level = max(0.5, min(0.95, req.service_level))
            # Buffer between point and upper bound according to service level
            buffer_qty = (upper - point) * (service_level - 0.50) / 0.40 if upper > point else 0.0
            suggested_prep = max(1, int(round(point + buffer_qty)))

            # Generate natural language explanation
            explanation = llm_explainer.explain(
                item=item_name,
                target_weekday_name=target_weekday_name,
                point_forecast=point,
                recommended_prep=suggested_prep,
                stats=stats
            )

            item_out = ForecastItemOut(
                item=item_name,
                target_date=target_date,
                point_forecast=point,
                lower_bound=lower,
                upper_bound=upper,
                recommended_prep=suggested_prep,
                forecast_method=method,
                data_sufficiency=sufficiency,
                short_explanation=explanation,
                stats=stats
            )
            forecast_items.append(item_out)

            # Save ForecastItem to DB
            db_item = ForecastItem(
                run_id=forecast_run.id,
                item=item_name,
                target_date=target_date,
                point_forecast=point,
                lower_bound=lower,
                upper_bound=upper,
                recommended_prep=suggested_prep,
                forecast_method=method,
                data_sufficiency=sufficiency,
                short_explanation=explanation,
                stats_json=str(stats)
            )
            db.add(db_item)

            # Sync with PrepListItem table (initial suggestion)
            existing_prep = db.query(PrepListItem).filter(
                PrepListItem.target_date == target_date,
                PrepListItem.item == item_name
            ).first()

            if not existing_prep:
                prep_entry = PrepListItem(
                    target_date=target_date,
                    item=item_name,
                    forecast_point=point,
                    suggested_prep=suggested_prep,
                    final_quantity=suggested_prep,
                    is_overridden=False,
                    baker_notes="",
                    reason=explanation
                )
                db.add(prep_entry)
            else:
                # Update suggested prep and reason without silently overwriting baker override if already customized
                existing_prep.forecast_point = point
                existing_prep.suggested_prep = suggested_prep
                existing_prep.reason = explanation
                if not existing_prep.is_overridden:
                    existing_prep.final_quantity = suggested_prep

        db.commit()

        return ForecastResponse(
            run_id=forecast_run.id,
            target_date=target_date,
            target_weekday=target_weekday_name,
            model_name=req.model_name,
            created_at=datetime.utcnow().isoformat(),
            items=forecast_items
        )

forecast_engine = ForecastEngine()
