from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any
import numpy as np
import pandas as pd

class SeasonalNaiveForecaster:
    """
    Seasonal-naive baseline: Demand from the exact same weekday in the previous week (t - 7).
    Falls back to the most recent same-weekday if t - 7 is missing.
    """
    name: str = "seasonal_naive"

    def predict(
        self,
        df_item: pd.DataFrame,
        target_date: str,
        use_censored_correction: bool = True
    ) -> Dict[str, Any]:
        """
        df_item: DataFrame sorted by date with columns ['date', 'quantity_sold', 'estimated_demand', 'is_stockout']
        target_date: 'YYYY-MM-DD'
        """
        target_dt = pd.to_datetime(target_date)
        target_weekday = target_dt.weekday()

        value_col = "estimated_demand" if use_censored_correction and "estimated_demand" in df_item.columns else "quantity_sold"

        # Check for t - 7
        lag_7_date = (target_dt - timedelta(days=7)).strftime("%Y-%m-%d")
        match = df_item[df_item["date"] == lag_7_date]

        if not match.empty:
            val = float(match.iloc[-1][value_col])
            observed_val = float(match.iloc[-1]["quantity_sold"])
            # Estimate simple residual standard deviation for bounds
            same_day_history = df_item[pd.to_datetime(df_item["date"]).dt.weekday == target_weekday][value_col].tolist()
            sigma = float(np.std(same_day_history, ddof=1)) if len(same_day_history) >= 3 else max(2.0, val * 0.15)
            
            p10 = max(0.0, val - 1.28 * sigma)
            p90 = val + 1.28 * sigma

            return {
                "point_forecast": round(val, 1),
                "lower_bound": round(p10, 1),
                "upper_bound": round(p90, 1),
                "method": "Seasonal Naive (Same Day Last Week)",
                "data_sufficiency": "robust" if len(same_day_history) >= 4 else "moderate",
                "notes": f"Predicted using {lag_7_date} value ({val:.0f} units)."
            }

        # Fallback: look for any previous same-weekday
        df_same_day = df_item[
            (pd.to_datetime(df_item["date"]).dt.weekday == target_weekday) &
            (df_item["date"] < target_date)
        ].sort_values("date")

        if not df_same_day.empty:
            last_val = float(df_same_day.iloc[-1][value_col])
            history_vals = df_same_day[value_col].tolist()
            sigma = float(np.std(history_vals, ddof=1)) if len(history_vals) >= 2 else max(2.0, last_val * 0.20)
            
            p10 = max(0.0, last_val - 1.28 * sigma)
            p90 = last_val + 1.28 * sigma

            return {
                "point_forecast": round(last_val, 1),
                "lower_bound": round(p10, 1),
                "upper_bound": round(p90, 1),
                "method": "Seasonal Naive (Nearest Same Weekday)",
                "data_sufficiency": "moderate",
                "notes": f"t-7 was missing; used nearest prior same-weekday ({df_same_day.iloc[-1]['date']})."
            }

        # Extreme fallback: overall median or 0
        overall = df_item[value_col].tolist()
        fallback_val = float(np.median(overall)) if overall else 10.0
        return {
            "point_forecast": round(fallback_val, 1),
            "lower_bound": round(max(0.0, fallback_val * 0.6), 1),
            "upper_bound": round(fallback_val * 1.4, 1),
            "method": "Seasonal Naive (Insufficient History Fallback)",
            "data_sufficiency": "limited",
            "notes": "Insufficient weekday history; fell back to item median."
        }


class FourWeekMovingAverageForecaster:
    """
    Four-week same-weekday rolling average forecaster.
    Averages the last 4 observations from the identical day of the week.
    """
    name: str = "four_week_moving_average"

    def predict(
        self,
        df_item: pd.DataFrame,
        target_date: str,
        use_censored_correction: bool = True
    ) -> Dict[str, Any]:
        target_dt = pd.to_datetime(target_date)
        target_weekday = target_dt.weekday()

        value_col = "estimated_demand" if use_censored_correction and "estimated_demand" in df_item.columns else "quantity_sold"

        prior_same_days = df_item[
            (pd.to_datetime(df_item["date"]).dt.weekday == target_weekday) &
            (df_item["date"] < target_date)
        ].sort_values("date")

        if len(prior_same_days) >= 2:
            last_4 = prior_same_days.tail(4)[value_col].tolist()
            point = float(np.mean(last_4))
            sample_count = len(last_4)
            sigma = float(np.std(last_4, ddof=1)) if sample_count >= 2 else point * 0.15
            sigma = max(sigma, 1.2)
            
            # P10 and P90 using t-distribution or 1.28 standard deviations
            p10 = max(0.0, point - 1.28 * sigma)
            p90 = point + 1.28 * sigma

            sufficiency = "robust" if sample_count >= 4 else "moderate"
            return {
                "point_forecast": round(point, 1),
                "lower_bound": round(p10, 1),
                "upper_bound": round(p90, 1),
                "method": f"{sample_count}-Week Same-Weekday Average",
                "data_sufficiency": sufficiency,
                "notes": f"Averaged last {sample_count} comparable {target_dt.strftime('%A')}s."
            }

        # Limited history fallback
        all_prior = df_item[df_item["date"] < target_date][value_col].tolist()
        fallback_val = float(np.mean(all_prior)) if all_prior else 10.0
        return {
            "point_forecast": round(fallback_val, 1),
            "lower_bound": round(max(0.0, fallback_val * 0.65), 1),
            "upper_bound": round(fallback_val * 1.35, 1),
            "method": "Moving Average (Overall Mean Fallback)",
            "data_sufficiency": "limited",
            "notes": "Fewer than 2 comparable weekdays available."
        }
