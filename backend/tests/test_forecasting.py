import pytest
import pandas as pd
from app.forecasting.baselines import SeasonalNaiveForecaster, FourWeekMovingAverageForecaster
from app.forecasting.ml_model import BakeryMLForecaster
from app.services.demo_data_generator import generate_bakery_demo_dataframe
from app.services.censored_demand import censored_demand_service

@pytest.fixture
def sample_croissant_data():
    df_raw = generate_bakery_demo_dataframe(days=45, seed=123)
    df_processed = censored_demand_service.process_dataframe(df_raw)
    return df_processed[df_processed["item"] == "Artisanal Croissant"].sort_values("date").reset_index(drop=True)

def test_seasonal_naive_forecast(sample_croissant_data):
    forecaster = SeasonalNaiveForecaster()
    target_date = sample_croissant_data["date"].iloc[-1]
    history = sample_croissant_data[sample_croissant_data["date"] < target_date]

    pred = forecaster.predict(history, target_date)
    assert pred["point_forecast"] > 0
    assert pred["lower_bound"] <= pred["point_forecast"]
    assert pred["upper_bound"] >= pred["point_forecast"]
    assert "Seasonal Naive" in pred["method"]

def test_four_week_moving_average_forecast(sample_croissant_data):
    forecaster = FourWeekMovingAverageForecaster()
    target_date = sample_croissant_data["date"].iloc[-1]
    history = sample_croissant_data[sample_croissant_data["date"] < target_date]

    pred = forecaster.predict(history, target_date)
    assert pred["point_forecast"] > 0
    assert pred["lower_bound"] <= pred["point_forecast"]
    assert pred["upper_bound"] >= pred["point_forecast"]
    assert "Average" in pred["method"]

def test_ml_forecaster_predictions_and_intervals(sample_croissant_data):
    ml = BakeryMLForecaster()
    target_date = sample_croissant_data["date"].iloc[-1]
    history = sample_croissant_data[sample_croissant_data["date"] < target_date]

    pred = ml.predict(history, target_date)
    assert pred["point_forecast"] > 0
    assert pred["lower_bound"] <= pred["point_forecast"]
    assert pred["upper_bound"] >= pred["point_forecast"]
    assert pred["data_sufficiency"] in ("robust", "moderate")
    assert "Random Forest" in pred["method"]

def test_ml_forecaster_limited_history_fallback():
    ml = BakeryMLForecaster()
    short_df = pd.DataFrame([
        {"date": "2026-10-01", "quantity_sold": 20.0, "estimated_demand": 20.0, "is_stockout": False},
        {"date": "2026-10-02", "quantity_sold": 22.0, "estimated_demand": 22.0, "is_stockout": False},
        {"date": "2026-10-03", "quantity_sold": 25.0, "estimated_demand": 25.0, "is_stockout": False},
    ])
    pred = ml.predict(short_df, "2026-10-04")
    assert pred["point_forecast"] > 0
    assert pred["data_sufficiency"] == "limited"
