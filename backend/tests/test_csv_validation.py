import pytest
import io
import pandas as pd
from app.services.csv_service import csv_service
from app.schemas.data_schemas import ColumnMapping

def test_canonical_csv_validation():
    csv_text = """date,item,quantity_sold,sold_out_time,closing_time,unit_price,notes
2026-10-01,Croissant,35,14:00,17:00,3.75,Morning rush
2026-10-01,Sourdough,20,,,6.50,Standard
2026-10-02,Croissant,45,11:30,17:00,3.75,Early rush
2026-10-02,Sourdough,25,,17:00,6.50,Good day
"""
    report, df = csv_service.validate_and_process_csv(csv_text.encode("utf-8"))
    assert report.is_valid is True
    assert report.total_raw_rows == 4
    assert report.valid_aggregated_rows == 4
    assert report.items_count == 2
    assert "Croissant" in report.items
    assert "Sourdough" in report.items
    assert report.stockouts_detected >= 1

def test_column_synonyms_auto_detection():
    # POS exports often have different header names
    csv_pos = """transaction_date,product_name,units_sold,stockout_time,close_time,price
2026-10-01,Baguette,30,15:30,18:00,3.25
2026-10-02,Baguette,35,,18:00,3.25
"""
    cols = ["transaction_date", "product_name", "units_sold", "stockout_time", "close_time", "price"]
    mapping = csv_service.detect_column_mapping(cols)

    assert mapping.date == "transaction_date"
    assert mapping.item == "product_name"
    assert mapping.quantity_sold == "units_sold"
    assert mapping.sold_out_time == "stockout_time"
    assert mapping.closing_time == "close_time"
    assert mapping.unit_price == "price"

    report, df = csv_service.validate_and_process_csv(csv_pos.encode("utf-8"), mapping)
    assert report.is_valid is True
    assert report.items_count == 1
    assert report.valid_aggregated_rows == 2

def test_duplicate_aggregation():
    # Two records for Croissant on the same date should be summed
    csv_dups = """date,item,quantity_sold,sold_out_time,closing_time
2026-10-01,Croissant,20,11:00,17:00
2026-10-01,Croissant,15,11:00,17:00
"""
    report, df = csv_service.validate_and_process_csv(csv_dups.encode("utf-8"))
    assert report.is_valid is True
    assert report.duplicates_aggregated == 1
    assert report.valid_aggregated_rows == 1
    assert df.iloc[0]["quantity_sold"] == 35.0

def test_negative_and_missing_quantities():
    csv_dirty = """date,item,quantity_sold
2026-10-01,Croissant,-5
2026-10-02,Croissant,N/A
2026-10-03,Croissant,22
"""
    report, df = csv_service.validate_and_process_csv(csv_dirty.encode("utf-8"))
    assert report.is_valid is True
    assert any("negative" in w for w in report.warnings)
    # The negative -5 is clamped to 0
    assert df[df["date"] == "2026-10-01"]["quantity_sold"].iloc[0] == 0.0

def test_empty_csv_error_handling():
    report, df = csv_service.validate_and_process_csv(b"")
    assert report.is_valid is False
    assert len(report.errors) > 0
