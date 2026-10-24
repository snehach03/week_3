import pytest
import numpy as np
import pandas as pd
from app.services.censored_demand import (
    CensoredDemandEstimator,
    parse_time_to_minutes,
    bakery_cumulative_traffic_fraction
)

def test_parse_time_to_minutes():
    assert parse_time_to_minutes("07:00") == 420
    assert parse_time_to_minutes("10:40") == 640
    assert parse_time_to_minutes("17:00") == 1020
    assert parse_time_to_minutes(None) is None
    assert parse_time_to_minutes("invalid") is None

def test_bakery_cumulative_traffic_fraction():
    # Morning (10:40 AM) should be roughly 45% - 65% of daily footfall
    t_1040 = parse_time_to_minutes("10:40")
    frac_morning = bakery_cumulative_traffic_fraction(t_1040, open_minutes=420, close_minutes=1020)
    assert 0.40 <= frac_morning <= 0.75

    # At closing time, should be 1.0
    frac_close = bakery_cumulative_traffic_fraction(1020, open_minutes=420, close_minutes=1020)
    assert frac_close == 1.0

def test_stockout_detection():
    estimator = CensoredDemandEstimator()
    # Sold out at 11:30, closes at 17:00 -> confirmed stockout
    assert estimator.is_confirmed_stockout("11:30", "17:00") is True

    # Sold out at 16:55, closes at 17:00 -> less than 15 mins before close -> not a stockout
    assert estimator.is_confirmed_stockout("16:55", "17:00") is False

    # Missing time
    assert estimator.is_confirmed_stockout(None, "17:00") is False

def test_latent_demand_estimation_bounds():
    estimator = CensoredDemandEstimator()
    observed_sales = 20.0
    same_weekday_uncensored = [32.0, 35.0, 28.0, 36.0, 30.0]

    res = estimator.estimate_latent_demand(
        observed_sales=observed_sales,
        item="Croissant",
        weekday=4, # Friday
        sold_out_time="10:40",
        closing_time="17:00",
        historical_uncensored_sales=same_weekday_uncensored
    )

    # 1. Latent demand point estimate must be >= observed sales
    assert res["estimated_demand"] >= observed_sales
    # 2. Lower bound must be >= observed sales
    assert res["estimated_lower"] >= observed_sales
    # 3. Upper bound must be >= point estimate
    assert res["estimated_upper"] >= res["estimated_demand"]
    # 4. Status flags
    assert res["is_stockout"] is True
    assert res["data_sufficiency"] == "robust"
    assert "shrinkage" in res["correction_method"] or "tobit" in res["correction_method"]

def test_latent_demand_zero_sales():
    estimator = CensoredDemandEstimator()
    res = estimator.estimate_latent_demand(
        observed_sales=0.0,
        item="Croissant",
        weekday=0,
        sold_out_time=None,
        closing_time="17:00",
        historical_uncensored_sales=[20.0, 25.0]
    )
    assert res["estimated_demand"] == 0.0
    assert res["is_stockout"] is False

def test_dataframe_processing():
    estimator = CensoredDemandEstimator()
    data = [
        {"date": "2026-10-01", "item": "Croissant", "quantity_sold": 40.0, "sold_out_time": "16:50", "closing_time": "17:00"},
        {"date": "2026-10-02", "item": "Croissant", "quantity_sold": 25.0, "sold_out_time": "11:00", "closing_time": "17:00"},
        {"date": "2026-10-03", "item": "Croissant", "quantity_sold": 55.0, "sold_out_time": None, "closing_time": "17:00"},
    ]
    df = pd.DataFrame(data)
    processed = estimator.process_dataframe(df)

    assert "estimated_demand" in processed.columns
    # Row 1 (11:00 AM stockout) should be flagged as stockout
    row_stockout = processed.iloc[1]
    assert bool(row_stockout["is_stockout"]) is True
    assert float(row_stockout["estimated_demand"]) >= 25.0
