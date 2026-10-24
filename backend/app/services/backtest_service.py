from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
import json
import numpy as np
import pandas as pd
from sqlalchemy.orm import Session

from app.database.models import SalesRecord, BacktestRun
from app.schemas.forecast_schemas import (
    BacktestRequest,
    BacktestResponse,
    BacktestItemSummary,
    BacktestTimelinePoint,
    ModelMetrics
)
from app.forecasting.baselines import SeasonalNaiveForecaster, FourWeekMovingAverageForecaster
from app.forecasting.ml_model import BakeryMLForecaster

def calculate_metrics(
    actuals: List[float],
    predictions: List[float],
    lowers: Optional[List[float]] = None,
    uppers: Optional[List[float]] = None
) -> ModelMetrics:
    """Calculates MAE, WAPE (with zero denominator guard), RMSE, and interval coverage rate."""
    if not actuals or not predictions or len(actuals) == 0:
        return ModelMetrics(mae=0.0, wape=0.0, rmse=0.0, coverage_rate=None, sample_size=0)

    y_true = np.array(actuals, dtype=float)
    y_pred = np.array(predictions, dtype=float)
    n = len(y_true)

    # MAE
    errors = np.abs(y_true - y_pred)
    mae = float(np.mean(errors))

    # RMSE
    rmse = float(np.sqrt(np.mean((y_true - y_pred) ** 2)))

    # WAPE (Weighted Absolute Percentage Error = sum(|y - y_hat|) / sum(y))
    sum_actuals = float(np.sum(y_true))
    if sum_actuals > 0:
        wape = float(np.sum(errors) / sum_actuals) * 100.0  # as percentage
    else:
        wape = 0.0 if np.all(errors == 0) else 100.0

    # Coverage rate
    coverage_rate = None
    if lowers is not None and uppers is not None and len(lowers) == n and len(uppers) == n:
        low_arr = np.array(lowers, dtype=float)
        up_arr = np.array(uppers, dtype=float)
        inside = (y_true >= low_arr) & (y_true <= up_arr)
        coverage_rate = float(np.mean(inside)) * 100.0

    return ModelMetrics(
        mae=round(mae, 2),
        wape=round(wape, 2),
        rmse=round(rmse, 2),
        coverage_rate=round(coverage_rate, 1) if coverage_rate is not None else None,
        sample_size=n
    )

class BacktestService:
    """
    Performs expanding-window / rolling-origin chronological backtesting.
    Strictly avoids future data leakage by training each step only on observations prior to date t.
    Evaluates against:
      1. Baseline: Seasonal Naive (same weekday previous week)
      2. Baseline: 4-Week Same-Weekday Average
      3. Tomorrow's Tray ML Model (Random Forest + Lag Features)
    Reports uncensored days separately to prevent treating stockout-limited sales as true demand.
    """

    def __init__(self):
        self.seasonal_naive = SeasonalNaiveForecaster()
        self.four_week_ma = FourWeekMovingAverageForecaster()
        self.ml_model = BakeryMLForecaster()

    def run_backtest(self, db: Session, req: BacktestRequest) -> BacktestResponse:
        query = db.query(SalesRecord)
        df_all = pd.read_sql(query.statement, db.bind)

        if df_all.empty:
            raise ValueError("No sales data found to perform backtesting.")

        unique_dates = sorted(df_all["date"].unique().tolist())
        total_dates_count = len(unique_dates)

        if total_dates_count < 14:
            raise ValueError(
                f"Backtesting requires at least 14 days of history. Currently only {total_dates_count} days are present."
            )

        # Set evaluation window: the last `window_days` days in the dataset
        eval_window_len = min(req.window_days, total_dates_count - 7)
        eval_dates = unique_dates[-eval_window_len:]
        start_date = eval_dates[0]
        end_date = eval_dates[-1]

        unique_items = sorted(df_all["item"].unique().tolist())

        # Collect evaluation metrics per model
        # Overall accumulators
        all_actuals: Dict[str, List[float]] = {"seasonal_naive": [], "four_week_ma": [], "ml_model": []}
        all_preds: Dict[str, List[float]] = {"seasonal_naive": [], "four_week_ma": [], "ml_model": []}
        all_lowers: Dict[str, List[float]] = {"seasonal_naive": [], "four_week_ma": [], "ml_model": []}
        all_uppers: Dict[str, List[float]] = {"seasonal_naive": [], "four_week_ma": [], "ml_model": []}

        # Uncensored-only accumulators (ground truth is unconstrained)
        uncensored_actuals: Dict[str, List[float]] = {"seasonal_naive": [], "four_week_ma": [], "ml_model": []}
        uncensored_preds: Dict[str, List[float]] = {"seasonal_naive": [], "four_week_ma": [], "ml_model": []}

        per_item_results: List[BacktestItemSummary] = []

        for item_name in unique_items:
            df_item = df_all[df_all["item"] == item_name].sort_values("date").reset_index(drop=True)
            
            item_actuals = {"seasonal_naive": [], "four_week_ma": [], "ml_model": []}
            item_preds = {"seasonal_naive": [], "four_week_ma": [], "ml_model": []}
            item_lowers = {"seasonal_naive": [], "four_week_ma": [], "ml_model": []}
            item_uppers = {"seasonal_naive": [], "four_week_ma": [], "ml_model": []}

            item_uncensored_act = {"seasonal_naive": [], "four_week_ma": [], "ml_model": []}
            item_uncensored_pred = {"seasonal_naive": [], "four_week_ma": [], "ml_model": []}

            timeline: List[BacktestTimelinePoint] = []
            stockout_count = 0
            uncensored_count = 0

            for t_date in eval_dates:
                # Actual observed sales on date t
                rec = df_item[df_item["date"] == t_date]
                if rec.empty:
                    continue

                actual_sold = float(rec.iloc[0]["quantity_sold"])
                is_stockout = bool(rec.iloc[0]["is_stockout"])
                est_demand = float(rec.iloc[0]["estimated_demand"]) if pd.notna(rec.iloc[0]["estimated_demand"]) else actual_sold

                # Ground truth: on uncensored days, actual_sold is exact ground truth.
                # On stockout days, we record it, but evaluate uncensored days as pure truth.
                target_eval_ground_truth = actual_sold

                if is_stockout:
                    stockout_count += 1
                else:
                    uncensored_count += 1

                # Train only on data strictly prior to t_date (no leakage)
                df_history_prior = df_item[df_item["date"] < t_date]

                # Run baseline 1: Seasonal Naive
                res_naive = self.seasonal_naive.predict(df_history_prior, t_date, use_censored_correction=True)
                # Run baseline 2: 4-week MA
                res_ma = self.four_week_ma.predict(df_history_prior, t_date, use_censored_correction=True)
                # Run ML model
                res_ml = self.ml_model.predict(df_history_prior, t_date, use_censored_correction=True)

                preds_dict = {
                    "seasonal_naive": float(res_naive["point_forecast"]),
                    "four_week_ma": float(res_ma["point_forecast"]),
                    "ml_model": float(res_ml["point_forecast"])
                }

                # Record timeline point
                timeline.append(BacktestTimelinePoint(
                    date=t_date,
                    actual=actual_sold,
                    is_stockout=is_stockout,
                    estimated_demand=est_demand if is_stockout else None,
                    predictions=preds_dict
                ))

                # Append to item & overall metrics
                for m_key, pred_res in [("seasonal_naive", res_naive), ("four_week_ma", res_ma), ("ml_model", res_ml)]:
                    p = float(pred_res["point_forecast"])
                    low = float(pred_res["lower_bound"])
                    up = float(pred_res["upper_bound"])

                    item_actuals[m_key].append(target_eval_ground_truth)
                    item_preds[m_key].append(p)
                    item_lowers[m_key].append(low)
                    item_uppers[m_key].append(up)

                    all_actuals[m_key].append(target_eval_ground_truth)
                    all_preds[m_key].append(p)
                    all_lowers[m_key].append(low)
                    all_uppers[m_key].append(up)

                    if not is_stockout:
                        item_uncensored_act[m_key].append(target_eval_ground_truth)
                        item_uncensored_pred[m_key].append(p)
                        uncensored_actuals[m_key].append(target_eval_ground_truth)
                        uncensored_preds[m_key].append(p)

            # Compute item-level model metrics
            item_model_metrics = {}
            for m_key in ["seasonal_naive", "four_week_ma", "ml_model"]:
                item_model_metrics[m_key] = calculate_metrics(
                    item_actuals[m_key],
                    item_preds[m_key],
                    item_lowers[m_key],
                    item_uppers[m_key]
                )

            per_item_results.append(BacktestItemSummary(
                item=item_name,
                sample_size=len(item_actuals["ml_model"]),
                uncensored_sample_size=uncensored_count,
                stockout_sample_size=stockout_count,
                models=item_model_metrics,
                timeline=timeline
            ))

        # Overall model metrics
        overall_metrics = {}
        for m_key in ["seasonal_naive", "four_week_ma", "ml_model"]:
            overall_metrics[m_key] = calculate_metrics(
                all_actuals[m_key],
                all_preds[m_key],
                all_lowers[m_key],
                all_uppers[m_key]
            )

        # Uncensored-only overall metrics
        uncensored_metrics = {}
        for m_key in ["seasonal_naive", "four_week_ma", "ml_model"]:
            uncensored_metrics[m_key] = calculate_metrics(
                uncensored_actuals[m_key],
                uncensored_preds[m_key]
            )

        # Contextual notes and methodology limitations
        limitations = [
            "Evaluated using chronological rolling-origin validation without future data leakage.",
            f"Evaluated on {eval_window_len} calendar days across {len(unique_items)} menu items ({len(all_actuals['ml_model'])} total forecasts).",
            "On stockout days, observed sales are right-censored (lower bound of true demand). Uncensored metrics are reported separately for unconstrained accuracy.",
            "Prediction interval coverage measures the empirical proportion of actual observations falling within the estimated P10–P90 bounds."
        ]

        if eval_window_len < 14:
            limitations.append("Warning: Evaluation window is under 14 days; metrics should be considered provisional.")

        response = BacktestResponse(
            evaluated_at=datetime.utcnow().isoformat(),
            start_date=start_date,
            end_date=end_date,
            window_days=eval_window_len,
            overall=overall_metrics,
            per_item=per_item_results,
            uncensored_comparison=uncensored_metrics,
            limitations=limitations
        )

        # Save to DB
        backtest_run = BacktestRun(
            start_date=start_date,
            end_date=end_date,
            window_days=eval_window_len,
            results_json=response.model_dump_json()
        )
        db.add(backtest_run)
        db.commit()

        return response

backtest_service = BacktestService()
