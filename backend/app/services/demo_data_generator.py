import random
from datetime import datetime, timedelta
from typing import List, Dict, Any
import pandas as pd

def generate_bakery_demo_dataframe(days: int = 75, seed: int = 42) -> pd.DataFrame:
    """
    Generates realistic historical POS records for a specialty bakery over `days` days.
    Includes day-of-week seasonality, occasional stockout events with realistic timestamps,
    and realistic pricing.
    """
    rng = random.Random(seed)
    base_end_date = datetime.now().date()
    start_date = base_end_date - timedelta(days=days)

    items_config = {
        "Artisanal Croissant": {
            "base_qty": 38.0,
            "unit_price": 3.75,
            "weekday_mult": [0.85, 0.90, 0.95, 1.05, 1.35, 1.70, 1.55], # Mon to Sun
            "stockout_prob": 0.22,
            "noise_std": 4.5
        },
        "Sourdough Loaf": {
            "base_qty": 20.0,
            "unit_price": 6.50,
            "weekday_mult": [0.80, 0.85, 0.90, 1.00, 1.25, 1.65, 1.45],
            "stockout_prob": 0.15,
            "noise_std": 2.8
        },
        "Pain au Chocolat": {
            "base_qty": 28.0,
            "unit_price": 4.25,
            "weekday_mult": [0.85, 0.90, 0.95, 1.05, 1.30, 1.60, 1.50],
            "stockout_prob": 0.20,
            "noise_std": 3.5
        },
        "Cinnamon Morning Bun": {
            "base_qty": 18.0,
            "unit_price": 4.00,
            "weekday_mult": [0.80, 0.85, 0.90, 0.95, 1.20, 1.50, 1.40],
            "stockout_prob": 0.18,
            "noise_std": 2.5
        },
        "Rustic Baguette": {
            "base_qty": 24.0,
            "unit_price": 3.50,
            "weekday_mult": [0.80, 0.85, 0.90, 1.05, 1.35, 1.60, 1.30],
            "stockout_prob": 0.16,
            "noise_std": 3.0
        },
        "Blueberry Almond Muffin": {
            "base_qty": 22.0,
            "unit_price": 3.95,
            "weekday_mult": [0.95, 1.00, 1.00, 1.05, 1.15, 1.35, 1.25],
            "stockout_prob": 0.12,
            "noise_std": 2.8
        }
    }

    records: List[Dict[str, Any]] = []

    for d_idx in range(days):
        current_date = start_date + timedelta(days=d_idx)
        weekday = current_date.weekday()  # 0=Monday ... 6=Sunday

        # Optional bakery closed day on Mondays (e.g. 50% chance of being closed or smaller menu)
        # To make it realistic for 7-day or 6-day operations:
        is_monday = (weekday == 0)

        for item_name, cfg in items_config.items():
            mult = cfg["weekday_mult"][weekday]
            trend = 1.0 + (d_idx / days) * 0.08  # Gradual 8% business growth over the quarter
            
            # True underlying customer demand
            true_demand = max(5.0, (cfg["base_qty"] * mult * trend) + rng.gauss(0, cfg["noise_std"]))
            
            # Stockout chance
            is_stockout_day = (rng.random() < cfg["stockout_prob"])
            
            if is_stockout_day:
                # Store prepared less than actual demand
                stock_available = max(8.0, true_demand * rng.uniform(0.60, 0.88))
                qty_sold = round(stock_available)
                
                # Realistic stockout hour based on fraction
                frac_sold = stock_available / true_demand
                # Front-heavy: if frac is 0.65, sold out around 11:00-13:00
                hour = 9 + int(frac_sold * 6.5)
                minute = rng.choice([0, 15, 20, 30, 40, 45, 50])
                sold_out_time = f"{hour:02d}:{minute:02d}"
                closing_time = "17:00"
            else:
                # No stockout: prepared sufficient stock, observed sales = true demand (or limited by small prep)
                qty_sold = round(true_demand)
                sold_out_time = None
                closing_time = "17:00"

            records.append({
                "date": current_date.strftime("%Y-%m-%d"),
                "item": item_name,
                "quantity_sold": qty_sold,
                "sold_out_time": sold_out_time,
                "closing_time": closing_time,
                "unit_price": cfg["unit_price"],
                "notes": f"{current_date.strftime('%A')} service"
            })

    # Add a couple duplicate records to test auto-aggregation in the backend
    if len(records) > 10:
        extra_dup = dict(records[5])
        extra_dup["quantity_sold"] = 4.0
        records.append(extra_dup)

    df = pd.DataFrame(records)
    return df
