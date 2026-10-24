from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.database.db import Base

class SalesRecord(Base):
    __tablename__ = "sales_records"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(String(10), index=True, nullable=False)  # YYYY-MM-DD
    item = Column(String(120), index=True, nullable=False)
    quantity_sold = Column(Float, nullable=False)
    sold_out_time = Column(String(10), nullable=True)  # e.g. "11:30"
    closing_time = Column(String(10), nullable=True)   # e.g. "17:00"
    unit_price = Column(Float, nullable=True)
    is_stockout = Column(Boolean, default=False)
    
    # Censored demand estimation columns
    estimated_demand = Column(Float, nullable=True)
    estimated_lower = Column(Float, nullable=True)
    estimated_upper = Column(Float, nullable=True)
    correction_method = Column(String(60), nullable=True)
    data_sufficiency = Column(String(30), nullable=True)  # robust, moderate, limited
    
    created_at = Column(DateTime, default=datetime.utcnow)

class ForecastRun(Base):
    __tablename__ = "forecast_runs"

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    target_date = Column(String(10), nullable=False)
    model_name = Column(String(60), nullable=False)
    summary_json = Column(Text, nullable=True)

    items = relationship("ForecastItem", back_populates="run", cascade="all, delete-orphan")

class ForecastItem(Base):
    __tablename__ = "forecast_items"

    id = Column(Integer, primary_key=True, index=True)
    run_id = Column(Integer, ForeignKey("forecast_runs.id"), nullable=False)
    item = Column(String(120), nullable=False)
    target_date = Column(String(10), nullable=False)
    point_forecast = Column(Float, nullable=False)
    lower_bound = Column(Float, nullable=False)
    upper_bound = Column(Float, nullable=False)
    recommended_prep = Column(Integer, nullable=False)
    forecast_method = Column(String(60), nullable=False)
    data_sufficiency = Column(String(30), nullable=False)
    short_explanation = Column(Text, nullable=False)
    stats_json = Column(Text, nullable=True)

    run = relationship("ForecastRun", back_populates="items")

class PrepListItem(Base):
    __tablename__ = "prep_list_items"

    id = Column(Integer, primary_key=True, index=True)
    target_date = Column(String(10), index=True, nullable=False)
    item = Column(String(120), nullable=False)
    forecast_point = Column(Float, nullable=False)
    suggested_prep = Column(Integer, nullable=False)
    final_quantity = Column(Integer, nullable=False)
    is_overridden = Column(Boolean, default=False)
    baker_notes = Column(Text, default="")
    reason = Column(Text, default="")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class BacktestRun(Base):
    __tablename__ = "backtest_runs"

    id = Column(Integer, primary_key=True, index=True)
    evaluated_at = Column(DateTime, default=datetime.utcnow)
    start_date = Column(String(10), nullable=False)
    end_date = Column(String(10), nullable=False)
    window_days = Column(Integer, nullable=False)
    results_json = Column(Text, nullable=False)
