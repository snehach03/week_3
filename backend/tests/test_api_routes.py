import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database.db import init_db

@pytest.fixture(scope="module", autouse=True)
def setup_database():
    init_db()

@pytest.fixture
def client():
    return TestClient(app)

def test_health_endpoint(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"

def test_load_demo_and_summary_flow(client):
    # 1. Load demo data
    res_load = client.post("/api/demo/load?days=30")
    assert res_load.status_code == 200
    report = res_load.json()
    assert report["is_valid"] is True
    assert report["valid_aggregated_rows"] > 50
    assert report["items_count"] >= 4

    # 2. Get sales summary
    res_sum = client.get("/api/sales/summary")
    assert res_sum.status_code == 200
    summary = res_sum.json()
    assert summary["total_records"] > 0
    assert summary["unique_items"] >= 4
    assert summary["stockout_count"] > 0

    # 3. Get items list
    res_items = client.get("/api/items")
    assert res_items.status_code == 200
    items = res_items.json()
    assert len(items) >= 4

def test_forecast_and_prep_list_flow(client):
    # 1. Generate next-day forecast
    res_fc = client.post("/api/forecast", json={"model_name": "auto", "service_level": 0.85})
    assert res_fc.status_code == 200
    fc_data = res_fc.json()
    assert len(fc_data["items"]) > 0
    first_item = fc_data["items"][0]
    assert first_item["point_forecast"] > 0
    assert first_item["recommended_prep"] >= 1
    assert len(first_item["short_explanation"]) > 0

    # 2. Fetch latest forecast
    res_latest = client.get("/api/forecast/latest")
    assert res_latest.status_code == 200
    assert res_latest.json()["run_id"] == fc_data["run_id"]

    # 3. Get initial prep list
    res_prep = client.get("/api/prep-list/latest")
    assert res_prep.status_code == 200
    prep = res_prep.json()
    assert len(prep["items"]) > 0

    # 4. Save human override
    item_to_override = prep["items"][0]["item"]
    original_prep = prep["items"][0]["suggested_prep"]
    new_override_qty = original_prep + 5

    res_save = client.post("/api/prep-list", json={
        "target_date": prep["target_date"],
        "items": [
            {
                "item": item_to_override,
                "final_quantity": new_override_qty,
                "is_overridden": True,
                "baker_notes": "Baking extra for expected morning catering."
            }
        ]
    })
    assert res_save.status_code == 200
    saved_items = res_save.json()["items"]
    saved_match = next(it for it in saved_items if it["item"] == item_to_override)
    assert saved_match["final_quantity"] == new_override_qty
    # Check that original suggested prep was preserved!
    assert saved_match["suggested_prep"] == original_prep
    assert saved_match["is_overridden"] is True
    assert "catering" in saved_match["baker_notes"]

    # 5. Export CSV
    res_csv = client.get(f"/api/prep-list/export?target_date={prep['target_date']}")
    assert res_csv.status_code == 200
    assert "text/csv" in res_csv.headers["content-type"]
    assert item_to_override in res_csv.text

def test_backtest_endpoint(client):
    res_bt = client.post("/api/backtest", json={"window_days": 14})
    assert res_bt.status_code == 200
    bt = res_bt.json()
    assert "overall" in bt
    assert "seasonal_naive" in bt["overall"]
    assert "four_week_ma" in bt["overall"]
    assert "ml_model" in bt["overall"]
    assert len(bt["per_item"]) > 0
