import pytest
import numpy as np
from app.services.backtest_service import calculate_metrics

def test_calculate_metrics_basic():
    actuals = [10.0, 20.0, 30.0, 40.0]
    preds = [12.0, 18.0, 32.0, 38.0]
    lowers = [8.0, 15.0, 25.0, 35.0]
    uppers = [15.0, 25.0, 35.0, 45.0]

    metrics = calculate_metrics(actuals, preds, lowers, uppers)
    # MAE = mean(|2, -2, 2, -2|) = 2.0
    assert metrics.mae == 2.0
    # RMSE = sqrt(4) = 2.0
    assert metrics.rmse == 2.0
    # WAPE = sum(|error|) / sum(actuals) = 8 / 100 = 8.0%
    assert metrics.wape == 8.0
    # Coverage: all 4 are inside [lowers, uppers] -> 100%
    assert metrics.coverage_rate == 100.0
    assert metrics.sample_size == 4

def test_calculate_metrics_zero_denominator_guard():
    actuals = [0.0, 0.0]
    preds = [0.0, 0.0]
    metrics = calculate_metrics(actuals, preds)
    assert metrics.mae == 0.0
    assert metrics.wape == 0.0

def test_calculate_metrics_partial_coverage():
    actuals = [10.0, 50.0]
    preds = [10.0, 40.0]
    lowers = [8.0, 35.0]
    uppers = [12.0, 45.0]  # 50 is outside [35, 45]

    metrics = calculate_metrics(actuals, preds, lowers, uppers)
    assert metrics.coverage_rate == 50.0
