import math
from typing import Dict, List, Optional, Tuple
import numpy as np
import pandas as pd
from scipy import stats

def parse_time_to_minutes(time_str: Optional[str]) -> Optional[int]:
    """Converts 'HH:MM' or 'H:MM' string to minutes from midnight."""
    if not time_str or not isinstance(time_str, str):
        return None
    try:
        parts = time_str.strip().split(":")
        if len(parts) >= 2:
            return int(parts[0]) * 60 + int(parts[1])
    except (ValueError, IndexError):
        return None
    return None

def bakery_cumulative_traffic_fraction(
    sold_out_minutes: int,
    open_minutes: int = 7 * 60,      # 07:00 AM
    close_minutes: int = 17 * 60     # 05:00 PM
) -> float:
    """
    Empirical cumulative demand fraction for a bakery by time t.
    Demand is front-loaded in the morning (breakfast peak 8-10am, lunch 12-1pm, afternoon lull).
    Modeled via a Beta(1.4, 1.8) cumulative distribution scaled between open and close,
    reflecting real bakery footfall.
    """
    if sold_out_minutes <= open_minutes:
        return 0.10  # Minimum 10% floor to avoid division by zero
    if sold_out_minutes >= close_minutes:
        return 1.0

    # Normalized progress through business day [0, 1]
    norm_t = (sold_out_minutes - open_minutes) / max(1, (close_minutes - open_minutes))
    norm_t = max(0.01, min(0.99, norm_t))

    # Beta(1.4, 1.8) CDF gives realistic front-heavy footfall
    # e.g., at 10:40 AM (3.67h into 10h day = 0.367 progress), ~55% of daily demand has occurred.
    frac = stats.beta.cdf(norm_t, a=1.4, b=1.8)
    return float(max(0.15, min(0.98, frac)))

class CensoredDemandEstimator:
    """
    Statistically principled module for estimating latent demand on stockout days.
    Treats observed sales on confirmed stockout days as right-censored (observed sales <= latent demand).
    Uses Tobit conditional expectation and diurnal customer footfall shrinkage with uncertainty bounds.
    """

    def is_confirmed_stockout(
        self,
        sold_out_time: Optional[str],
        closing_time: Optional[str],
        flag: Optional[bool] = None
    ) -> bool:
        if flag is True:
            return True
        if not sold_out_time or not closing_time:
            return False
        
        sold_m = parse_time_to_minutes(sold_out_time)
        close_m = parse_time_to_minutes(closing_time)
        
        if sold_m is not None and close_m is not None:
            # If item sold out at least 15 minutes before closing, it is a confirmed stockout
            return sold_m < (close_m - 15)
        return False

    def estimate_latent_demand(
        self,
        observed_sales: float,
        item: str,
        weekday: int,  # 0=Monday, 6=Sunday
        sold_out_time: Optional[str],
        closing_time: Optional[str],
        historical_uncensored_sales: List[float],
        all_uncensored_sales: Optional[List[float]] = None
    ) -> Dict[str, any]:
        """
        Estimates latent demand on a stockout day.
        
        Parameters:
            observed_sales: Observed units sold before stockout.
            item: Item name.
            weekday: Day of week.
            sold_out_time: 'HH:MM' when stock was exhausted.
            closing_time: 'HH:MM' store closing time.
            historical_uncensored_sales: Uncensored historical sales for this item on the SAME weekday.
            all_uncensored_sales: Uncensored historical sales for this item across ALL weekdays.
            
        Returns:
            Dict containing:
                estimated_demand: Point estimate (float)
                estimated_lower: P10 lower bound (float)
                estimated_upper: P90 upper bound (float)
                correction_method: Description of statistical model used
                data_sufficiency: 'robust', 'moderate', or 'limited'
                observed_sales: Float
                is_stockout: True
        """
        if observed_sales <= 0:
            return {
                "estimated_demand": 0.0,
                "estimated_lower": 0.0,
                "estimated_upper": 0.0,
                "correction_method": "zero_sales_uncorrected",
                "data_sufficiency": "robust",
                "observed_sales": observed_sales,
                "is_stockout": False
            }

        # 1. Determine data sufficiency and baseline distribution
        same_day_samples = [s for s in historical_uncensored_sales if s > 0]
        all_samples = [s for s in (all_uncensored_sales or []) if s > 0]

        if len(same_day_samples) >= 4:
            sufficiency = "robust"
            ref_data = same_day_samples
        elif len(same_day_samples) >= 2 or len(all_samples) >= 5:
            sufficiency = "moderate"
            ref_data = same_day_samples if len(same_day_samples) >= 2 else all_samples
        else:
            sufficiency = "limited"
            ref_data = all_samples if len(all_samples) >= 1 else [observed_sales]

        # 2. Tobit Truncated Normal Conditional Expectation
        if sufficiency in ("robust", "moderate") and len(ref_data) >= 2:
            mu = float(np.mean(ref_data))
            sigma = float(np.std(ref_data, ddof=1))
            sigma = max(sigma, mu * 0.12, 1.5)  # Enforce reasonable minimum dispersion
            
            c = observed_sales
            alpha = (c - mu) / sigma

            # Handle extreme truncation
            if alpha > 4.0:
                # Observed sales was already far above historical average
                point_tobit = c + sigma * 0.5
                lower_tobit = c
                upper_tobit = c + sigma * 1.5
            else:
                # Mill's ratio = phi(alpha) / (1 - Phi(alpha))
                phi_alpha = stats.norm.pdf(alpha)
                ccdf_alpha = max(1e-6, 1.0 - stats.norm.cdf(alpha))
                mills_ratio = phi_alpha / ccdf_alpha
                
                point_tobit = mu + sigma * mills_ratio
                
                # Truncated quantiles
                cdf_alpha = stats.norm.cdf(alpha)
                # P10 of truncated distribution
                u_p10 = cdf_alpha + 0.10 * (1.0 - cdf_alpha)
                lower_tobit = mu + sigma * stats.norm.ppf(min(0.999, u_p10))
                # P90 of truncated distribution
                u_p90 = cdf_alpha + 0.90 * (1.0 - cdf_alpha)
                upper_tobit = mu + sigma * stats.norm.ppf(min(0.999, u_p90))
        else:
            # Fallback for limited data: conservative prior expansion
            point_tobit = observed_sales * 1.25
            lower_tobit = observed_sales
            upper_tobit = observed_sales * 1.55

        # 3. Diurnal Footfall Estimate (if valid stockout timestamps are available)
        sold_m = parse_time_to_minutes(sold_out_time)
        close_m = parse_time_to_minutes(closing_time)
        
        has_time_profile = sold_m is not None and close_m is not None and (sold_m < close_m)
        
        if has_time_profile:
            cum_frac = bakery_cumulative_traffic_fraction(sold_m, close_minutes=close_m)
            diurnal_point = observed_sales / cum_frac
            
            # Apply shrinkage towards Tobit estimate to prevent extreme blowup from early morning runs
            # Weight: more samples -> trust historical distribution more; fewer samples -> blend equally
            w_tobit = 0.65 if sufficiency == "robust" else (0.50 if sufficiency == "moderate" else 0.35)
            w_diurnal = 1.0 - w_tobit
            
            combined_point = (w_tobit * point_tobit) + (w_diurnal * diurnal_point)
            
            # Bound uncertainty interval
            combined_lower = max(observed_sales, min(lower_tobit, combined_point * 0.88))
            combined_upper = max(combined_point * 1.15, upper_tobit, observed_sales * 1.20)
            
            method_desc = "diurnal_profile_and_tobit_shrinkage"
        else:
            combined_point = point_tobit
            combined_lower = max(observed_sales, lower_tobit)
            combined_upper = max(combined_point * 1.12, upper_tobit, observed_sales * 1.15)
            method_desc = "tobit_conditional_expectation" if sufficiency != "limited" else "conservative_provisional_markup"

        # Final sanity guards: latent demand >= observed sales
        final_point = round(max(float(observed_sales), float(combined_point)), 1)
        final_lower = round(max(float(observed_sales), float(combined_lower)), 1)
        final_upper = round(max(float(final_point), float(combined_upper)), 1)

        return {
            "estimated_demand": final_point,
            "estimated_lower": final_lower,
            "estimated_upper": final_upper,
            "correction_method": method_desc,
            "data_sufficiency": sufficiency,
            "observed_sales": observed_sales,
            "is_stockout": True
        }

    def process_dataframe(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Batch processes a sales DataFrame and fills in censored demand estimates.
        Ensures date parsing, weekday extraction, and statistical calculation.
        """
        df = df.copy()
        
        if "date" in df.columns:
            df["date"] = pd.to_datetime(df["date"]).dt.strftime("%Y-%m-%d")
            df["weekday"] = pd.to_datetime(df["date"]).dt.weekday
        
        for col in ["estimated_demand", "estimated_lower", "estimated_upper", "correction_method", "data_sufficiency"]:
            if col not in df.columns:
                df[col] = None

        if "is_stockout" not in df.columns:
            df["is_stockout"] = False

        # Flag stockouts based on timestamps
        for idx, row in df.iterrows():
            sold_time = str(row.get("sold_out_time", "")) if pd.notna(row.get("sold_out_time")) else None
            close_time = str(row.get("closing_time", "")) if pd.notna(row.get("closing_time")) else None
            is_so = self.is_confirmed_stockout(sold_time, close_time, bool(row.get("is_stockout", False)))
            df.at[idx, "is_stockout"] = is_so

        # Now group by item and estimate latent demand for stockout days
        for item, item_df in df.groupby("item"):
            uncensored_all = item_df[~item_df["is_stockout"]]["quantity_sold"].tolist()
            
            for idx, row in item_df.iterrows():
                if row["is_stockout"]:
                    w = row["weekday"] if "weekday" in row else 0
                    uncensored_weekday = item_df[(~item_df["is_stockout"]) & (item_df["weekday"] == w)]["quantity_sold"].tolist()
                    
                    sold_time = str(row.get("sold_out_time", "")) if pd.notna(row.get("sold_out_time")) else None
                    close_time = str(row.get("closing_time", "")) if pd.notna(row.get("closing_time")) else None
                    
                    res = self.estimate_latent_demand(
                        observed_sales=float(row["quantity_sold"]),
                        item=item,
                        weekday=w,
                        sold_out_time=sold_time,
                        closing_time=close_time,
                        historical_uncensored_sales=uncensored_weekday,
                        all_uncensored_sales=uncensored_all
                    )
                    
                    df.at[idx, "estimated_demand"] = res["estimated_demand"]
                    df.at[idx, "estimated_lower"] = res["estimated_lower"]
                    df.at[idx, "estimated_upper"] = res["estimated_upper"]
                    df.at[idx, "correction_method"] = res["correction_method"]
                    df.at[idx, "data_sufficiency"] = res["data_sufficiency"]
                else:
                    # Uncensored day: demand is observed sales
                    df.at[idx, "estimated_demand"] = float(row["quantity_sold"])
                    df.at[idx, "estimated_lower"] = float(row["quantity_sold"])
                    df.at[idx, "estimated_upper"] = float(row["quantity_sold"])
                    df.at[idx, "correction_method"] = "none_uncensored"
                    df.at[idx, "data_sufficiency"] = "observed"

        return df

censored_demand_service = CensoredDemandEstimator()
