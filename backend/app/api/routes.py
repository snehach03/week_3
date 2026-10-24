import json
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Response
from fastapi.responses import PlainTextResponse, StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
import pandas as pd
import io

from app.database.db import get_db
from app.database.models import SalesRecord, ForecastRun, ForecastItem, PrepListItem, BacktestRun
from app.schemas.data_schemas import ColumnMapping, CSVValidationReport, SalesSummary, SalesRecordOut
from app.schemas.forecast_schemas import (
    ForecastRequest,
    ForecastResponse,
    PrepListSaveRequest,
    PrepListResponse,
    BacktestRequest,
    BacktestResponse
)
from app.services.csv_service import csv_service
from app.services.demo_data_generator import generate_bakery_demo_dataframe
from app.services.forecast_engine import forecast_engine
from app.services.backtest_service import backtest_service
from app.services.prep_list_service import prep_list_service
from app.services.llm_explainer import llm_explainer
from app.forecasting.tabpfn_adapter import tabpfn_adapter

router = APIRouter()

@router.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "Tomorrow's Tray Backend",
        "tabpfn_available": tabpfn_adapter.is_available()
    }

@router.get("/llm-status")
def get_llm_status():
    return llm_explainer.check_ollama_status()

@router.get("/tabpfn-status")
def get_tabpfn_status():
    return tabpfn_adapter.get_status()

@router.get("/sample-csv", response_class=PlainTextResponse)
def get_sample_csv():
    csv_content = csv_service.generate_sample_csv()
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=tomorrows_tray_sample.csv"}
    )

@router.post("/upload", response_model=CSVValidationReport)
async def upload_csv(
    file: UploadFile = File(...),
    mapping_json: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    try:
        content = await file.read()
        mapping = None
        if mapping_json:
            try:
                mapping_dict = json.loads(mapping_json)
                mapping = ColumnMapping(**mapping_dict)
            except Exception:
                pass

        report, df_processed = csv_service.validate_and_process_csv(content, mapping)

        if not report.is_valid or df_processed is None:
            return report

        # Clear existing records or replace them
        db.query(SalesRecord).delete()
        db.flush()

        # Batch insert into DB
        records = []
        for _, row in df_processed.iterrows():
            rec = SalesRecord(
                date=str(row["date"]),
                item=str(row["item"]),
                quantity_sold=float(row["quantity_sold"]),
                sold_out_time=str(row["sold_out_time"]) if pd.notna(row.get("sold_out_time")) and str(row.get("sold_out_time")) != "None" else None,
                closing_time=str(row["closing_time"]) if pd.notna(row.get("closing_time")) and str(row.get("closing_time")) != "None" else None,
                unit_price=float(row["unit_price"]) if pd.notna(row.get("unit_price")) else None,
                is_stockout=bool(row.get("is_stockout", False)),
                estimated_demand=float(row["estimated_demand"]) if pd.notna(row.get("estimated_demand")) else None,
                estimated_lower=float(row["estimated_lower"]) if pd.notna(row.get("estimated_lower")) else None,
                estimated_upper=float(row["estimated_upper"]) if pd.notna(row.get("estimated_upper")) else None,
                correction_method=str(row.get("correction_method", "")),
                data_sufficiency=str(row.get("data_sufficiency", ""))
            )
            records.append(rec)

        db.bulk_save_objects(records)
        db.commit()

        return report

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to process CSV: {str(e)}")

@router.post("/demo/load", response_model=CSVValidationReport)
def load_demo_data(days: int = 75, db: Session = Depends(get_db)):
    """Loads a realistic 75-day bakery POS dataset into SQLite."""
    df_raw = generate_bakery_demo_dataframe(days=days)
    csv_bytes = df_raw.to_csv(index=False).encode("utf-8")
    report, df_processed = csv_service.validate_and_process_csv(csv_bytes)

    if not report.is_valid or df_processed is None:
        raise HTTPException(status_code=500, detail="Demo data processing failed.")

    db.query(SalesRecord).delete()
    db.flush()

    records = []
    for _, row in df_processed.iterrows():
        rec = SalesRecord(
            date=str(row["date"]),
            item=str(row["item"]),
            quantity_sold=float(row["quantity_sold"]),
            sold_out_time=str(row["sold_out_time"]) if pd.notna(row.get("sold_out_time")) and str(row.get("sold_out_time")) != "None" else None,
            closing_time=str(row["closing_time"]) if pd.notna(row.get("closing_time")) and str(row.get("closing_time")) != "None" else None,
            unit_price=float(row["unit_price"]) if pd.notna(row.get("unit_price")) else None,
            is_stockout=bool(row.get("is_stockout", False)),
            estimated_demand=float(row["estimated_demand"]) if pd.notna(row.get("estimated_demand")) else None,
            estimated_lower=float(row["estimated_lower"]) if pd.notna(row.get("estimated_lower")) else None,
            estimated_upper=float(row["estimated_upper"]) if pd.notna(row.get("estimated_upper")) else None,
            correction_method=str(row.get("correction_method", "")),
            data_sufficiency=str(row.get("data_sufficiency", ""))
        )
        records.append(rec)

    db.bulk_save_objects(records)
    db.commit()

    return report

@router.get("/sales/summary", response_model=SalesSummary)
def get_sales_summary(db: Session = Depends(get_db)):
    total_count = db.query(SalesRecord).count()
    if total_count == 0:
        return SalesSummary(
            total_records=0,
            unique_items=0,
            items=[],
            date_min=None,
            date_max=None,
            stockout_count=0,
            stockout_rate_pct=0.0,
            total_quantity_sold=0.0,
            estimated_lost_demand_units=0.0
        )

    items = [r[0] for r in db.query(SalesRecord.item).distinct().order_by(SalesRecord.item).all()]
    date_min = db.query(func.min(SalesRecord.date)).scalar()
    date_max = db.query(func.max(SalesRecord.date)).scalar()
    stockout_count = db.query(SalesRecord).filter(SalesRecord.is_stockout == True).count()
    total_qty = db.query(func.sum(SalesRecord.quantity_sold)).scalar() or 0.0

    # Calculate lost demand on stockout days: sum(estimated_demand - quantity_sold)
    est_sum = db.query(func.sum(SalesRecord.estimated_demand)).filter(SalesRecord.is_stockout == True).scalar() or 0.0
    obs_sum = db.query(func.sum(SalesRecord.quantity_sold)).filter(SalesRecord.is_stockout == True).scalar() or 0.0
    lost_units = max(0.0, est_sum - obs_sum)

    stockout_rate = round((stockout_count / total_count) * 100.0, 1) if total_count > 0 else 0.0

    return SalesSummary(
        total_records=total_count,
        unique_items=len(items),
        items=items,
        date_min=date_min,
        date_max=date_max,
        stockout_count=stockout_count,
        stockout_rate_pct=stockout_rate,
        total_quantity_sold=round(total_qty, 1),
        estimated_lost_demand_units=round(lost_units, 1)
    )

@router.get("/sales/records", response_model=List[SalesRecordOut])
def get_sales_records(
    item: Optional[str] = None,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    q = db.query(SalesRecord)
    if item:
        q = q.filter(SalesRecord.item == item)
    recs = q.order_by(SalesRecord.date.desc()).limit(limit).all()
    return recs

@router.get("/items")
def get_items_list(db: Session = Depends(get_db)):
    results = []
    items = [r[0] for r in db.query(SalesRecord.item).distinct().order_by(SalesRecord.item).all()]
    for item in items:
        recs = db.query(SalesRecord).filter(SalesRecord.item == item).all()
        stockouts = sum(1 for r in recs if r.is_stockout)
        avg_sales = sum(r.quantity_sold for r in recs) / len(recs) if recs else 0.0
        results.append({
            "name": item,
            "observations_count": len(recs),
            "stockout_count": stockouts,
            "stockout_pct": round((stockouts / len(recs)) * 100.0, 1) if recs else 0.0,
            "avg_daily_sales": round(avg_sales, 1)
        })
    return results

@router.post("/forecast", response_model=ForecastResponse)
def generate_forecast(req: ForecastRequest, db: Session = Depends(get_db)):
    try:
        return forecast_engine.generate_forecasts(db, req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/forecast/latest", response_model=Optional[ForecastResponse])
def get_latest_forecast(db: Session = Depends(get_db)):
    run = db.query(ForecastRun).order_by(ForecastRun.id.desc()).first()
    if not run:
        return None

    items = db.query(ForecastItem).filter(ForecastItem.run_id == run.id).all()
    target_dt = pd.to_datetime(run.target_date)

    out_items = []
    for it in items:
        stats = {}
        if it.stats_json:
            try:
                stats = eval(it.stats_json) if it.stats_json.startswith("{") else {}
            except Exception:
                pass

        out_items.append({
            "item": it.item,
            "target_date": it.target_date,
            "point_forecast": it.point_forecast,
            "lower_bound": it.lower_bound,
            "upper_bound": it.upper_bound,
            "recommended_prep": it.recommended_prep,
            "forecast_method": it.forecast_method,
            "data_sufficiency": it.data_sufficiency,
            "short_explanation": it.short_explanation,
            "stats": stats
        })

    return ForecastResponse(
        run_id=run.id,
        target_date=run.target_date,
        target_weekday=target_dt.strftime("%A"),
        model_name=run.model_name,
        created_at=run.created_at.isoformat(),
        items=out_items
    )

@router.post("/prep-list", response_model=PrepListResponse)
def save_prep_list(req: PrepListSaveRequest, db: Session = Depends(get_db)):
    return prep_list_service.save_prep_list(db, req)

@router.get("/prep-list/latest", response_model=Optional[PrepListResponse])
def get_latest_prep_list(target_date: Optional[str] = None, db: Session = Depends(get_db)):
    return prep_list_service.get_latest_prep_list(db, target_date)

@router.get("/prep-list/export")
def export_prep_list_csv(target_date: Optional[str] = None, db: Session = Depends(get_db)):
    csv_str, filename = prep_list_service.export_csv(db, target_date)
    return Response(
        content=csv_str,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.post("/backtest", response_model=BacktestResponse)
def run_backtest(req: BacktestRequest, db: Session = Depends(get_db)):
    try:
        return backtest_service.run_backtest(db, req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/model-performance", response_model=Optional[BacktestResponse])
def get_model_performance(db: Session = Depends(get_db)):
    latest = db.query(BacktestRun).order_by(BacktestRun.id.desc()).first()
    if not latest:
        # Run default backtest if data is present
        sales_count = db.query(SalesRecord).count()
        if sales_count >= 14:
            try:
                return backtest_service.run_backtest(db, BacktestRequest(window_days=21))
            except Exception:
                return None
        return None
    return BacktestResponse.model_validate_json(latest.results_json)

@router.post("/reset-data")
def reset_all_data(db: Session = Depends(get_db)):
    """Clears all stored sales records, forecasts, prep lists, and backtests."""
    db.query(SalesRecord).delete()
    db.query(ForecastItem).delete()
    db.query(ForecastRun).delete()
    db.query(PrepListItem).delete()
    db.query(BacktestRun).delete()
    db.commit()
    return {"message": "All database records have been reset successfully."}
