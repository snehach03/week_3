# Tomorrow's Tray — AI Demand Forecasting for Small Bakeries & Cafés

> **Actionable next-day preparation planning powered by censored-demand statistical corrections, calibrated uncertainty ranges, and human-in-the-loop baker overrides.**

---

## 1. Product Overview

Small artisanal bakeries and cafés face a high-stakes daily dilemma: bake too little and popular pastries sell out by 10:40 AM (leaving high-margin revenue on the table); bake too much and day-old items are discounted or discarded.

Standard demand forecasting fails because **when an item sells out early, historical POS sales records record only the stock prepared, not the true customer demand**. If a bakery prepared 20 croissants and sold out at 10:40 AM, observed sales equal 20, but latent demand was easily 32–38.

**Tomorrow's Tray** addresses this with:
1. **Statistically Defensible Censored-Demand Correction**: Identifies stockout days and models observed sales as right-censored observations using Tobit conditional expectations and diurnal footfall shrinkage.
2. **Modular Multi-Model Forecasting**: Compares seasonal-naive baselines, 4-week moving averages, machine learning (Random Forest with lag & momentum features), and optional TabPFN adapters.
3. **Calibrated Prediction Bounds (P10–P90)**: Conformal / empirical quantile intervals so bakers see the spread of risk.
4. **Transparent AI Explanations**: Grounded, single-sentence explanations powered by local Gemma via Ollama, with an instant deterministic statistical fallback.
5. **Baker-in-the-Loop Production Sheets**: Suggested prep quantities with service-level buffers, editable final quantities, kitchen notes, persistent SQLite storage, and CSV export.
6. **Chronological Expanding-Window Backtesting**: Honest evaluation across MAE, WAPE (with zero-denominator guard), RMSE, and interval coverage, separating uncensored ground truth from censored observations.

---

## 2. System Architecture

```
tomorrows-tray/
├── backend/
│   ├── app/
│   │   ├── main.py                     # FastAPI application & lifecycle
│   │   ├── api/
│   │   │   └── routes.py               # Documented REST API endpoints
│   │   ├── core/
│   │   │   └── config.py               # Pydantic v2 application configuration
│   │   ├── database/
│   │   │   ├── db.py                   # SQLAlchemy SQLite engine & session
│   │   │   └── models.py               # SalesRecord, ForecastItem, PrepListItem, BacktestRun
│   │   ├── schemas/
│   │   │   ├── data_schemas.py         # CSV mappings, validation reports, summaries
│   │   │   └── forecast_schemas.py     # Forecast & backtest request/response contracts
│   │   ├── services/
│   │   │   ├── csv_service.py          # POS parsing, fuzzy column mapping, validation
│   │   │   ├── censored_demand.py      # Core Technical: Tobit & Diurnal Footfall Estimator
│   │   │   ├── forecast_engine.py      # Item forecast orchestrator & service buffer
│   │   │   ├── backtest_service.py     # Expanding-window chronological backtesting
│   │   │   ├── prep_list_service.py    # Production sheets, overrides & CSV export
│   │   │   ├── llm_explainer.py        # Ollama Gemma client + deterministic template fallback
│   │   │   └── demo_data_generator.py  # 75-day realistic bakery POS simulation
│   │   └── forecasting/
│   │       ├── baselines.py            # Seasonal Naive (t-7) & 4-Week Moving Average
│   │       ├── ml_model.py             # Random Forest regressor with lag features
│   │       └── tabpfn_adapter.py       # Modular TabPFN integration adapter
│   ├── tests/
│   │   ├── test_censored_demand.py     # Tobit expectation, footfall, and bounds tests
│   │   ├── test_csv_validation.py      # Flexible date, dirty data & aggregation tests
│   │   ├── test_forecasting.py         # Baseline & ML forecasting tests
│   │   ├── test_backtesting.py         # Metric calculation & coverage tests
│   │   └── test_api_routes.py          # End-to-end API integration tests
│   ├── requirements.txt
│   └── run_backend.py
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   └── client.ts               # Typed frontend API client
│   │   ├── components/
│   │   │   ├── Navbar.tsx              # Navigation & live model status pills
│   │   │   └── ConfidenceIntervalBar.tsx # Visual P10-P90 uncertainty & prep pin
│   │   ├── pages/
│   │   │   ├── OverviewPage.tsx        # Dashboard KPI cards & stockout risk alerts
│   │   │   ├── UploadPage.tsx          # POS CSV upload, column mapping & preview
│   │   │   ├── ForecastPage.tsx        # Item cards, P10-P90 bars, 30-day sales chart
│   │   │   ├── PrepListPage.tsx        # Production list, quantity steppers, overrides & CSV
│   │   │   ├── PerformancePage.tsx     # Expanding-window backtest & error comparison
│   │   │   └── SettingsPage.tsx        # Storage management, LLM & TabPFN status
│   │   ├── types/
│   │   │   └── index.ts                # TypeScript interfaces
│   │   ├── App.tsx                     # Main layout & router
│   │   └── index.css                   # Tailwind styles & artisanal palette
│   ├── package.json
│   ├── tailwind.config.js              # Warm cream, espresso, terracotta & sage tokens
│   └── vite.config.ts
├── start.bat                           # 1-click Windows startup batch script
├── start.ps1                           # 1-click PowerShell startup script
└── README.md
```

---

## 3. The Core Technical Feature: Censored Demand Correction

When an item sells out at $t_{\text{soldout}} < t_{\text{closing}}$, observed sales $y$ are **right-censored**: true latent demand $Y^*$ satisfies $Y^* \ge y$.

### Why Naive Approaches Fail
- **Zero Imputation**: Treating missing sales as zero falsely punishes popular items.
- **Linear Scaling**: Dividing sales by elapsed fraction ($y / (t / T)$) produces catastrophic errors because bakery customer traffic is **front-loaded** in morning hours.

### The Tomorrow's Tray Statistical Formulation
We model latent demand $Y^*$ using two complementary statistical methodologies blended with empirical Bayesian shrinkage:

1. **Tobit Left-Truncated Normal Conditional Expectation**:
   Assuming comparable historical uncensored demand follows $\mathcal{N}(\mu, \sigma^2)$ on the same day of week, the expected latent demand conditional on $Y^* \ge y$ is:
   $$\mathbb{E}[Y^* \mid Y^* \ge y] = \mu + \sigma \cdot \lambda(\alpha)$$
   where $\alpha = \frac{y - \mu}{\sigma}$ and $\lambda(\alpha) = \frac{\phi(\alpha)}{1 - \Phi(\alpha)}$ is the Inverse Mills Ratio.
   Quantiles $q \in \{0.10, 0.90\}$ are computed from the truncated normal CDF:
   $$z_q = \mu + \sigma \cdot \Phi^{-1}\left(\Phi(\alpha) + q \cdot (1 - \Phi(\alpha))\right)$$

2. **Empirical Bakery Footfall Diurnal Profile**:
   Customer arrival curves follow a cumulative traffic distribution $F_{\text{time}}(t) \sim \text{Beta}(1.4, 1.8)$ scaled between opening (07:00) and closing (17:00).
   $$\hat{Y}_{\text{diurnal}} = \frac{y}{F_{\text{time}}(t_{\text{soldout}})}$$

3. **Shrinkage & Boundary Guarantees**:
   The final latent estimate blends the Tobit conditional expectation with the diurnal estimate, bounded strictly such that:
   $$\text{Lower Bound (P10)} \ge y, \quad \hat{Y}^* \ge y, \quad \text{Upper Bound (P90)} \ge \hat{Y}^*$$
   When historical uncensored observations are limited ($n < 2$), the module labels the estimate as `limited` data sufficiency and applies a conservative heuristic markup.

---

## 4. Quick Start Guide

### Prerequisites
- **Python 3.10+** (tested on Python 3.13)
- **Node.js 18+** & **npm**

### Installation

1. **Clone or navigate to the project directory**:
   ```powershell
   cd "C:\Users\Sneha Choudhary\.gemini\antigravity\scratch\tomorrows-tray"
   ```

2. **Install Python backend dependencies**:
   ```powershell
   cd backend
   python -m pip install -r requirements.txt
   cd ..
   ```

3. **Install Frontend dependencies**:
   ```powershell
   cd frontend
   npm install
   cd ..
   ```

---

## 5. Running the Application

### Option A: One-Click Launch (Windows)
Double-click `start.bat` or run:
```powershell
.\start.ps1
```
This automatically launches the FastAPI backend on `http://127.0.0.1:8000` and the Vite frontend on `http://localhost:5173`.

### Option B: Manual Two-Terminal Launch

**Terminal 1 — Backend**:
```powershell
cd backend
python run_backend.py
# Server runs on http://127.0.0.1:8000 (API Docs at http://127.0.0.1:8000/docs)
```

**Terminal 2 — Frontend**:
```powershell
cd frontend
npm run dev
# Vite runs on http://localhost:5173
```

Open your browser at **`http://localhost:5173`**.

---

## 6. Running the Automated Test Suite

Tomorrow's Tray includes 22 rigorous unit and integration tests covering CSV parsing, dirty data handling, censored demand bounds, baselines, ML regressors, backtesting metrics, and API endpoints.

To run the test suite:
```powershell
cd backend
python -m pytest -v
```

Expected result:
```
============================== 22 passed in 30.12s ==============================
```

---

## 7. Using the Application

### 1. Overview Dashboard
- Displays next-day prep totals, active menu items, historical stockout risk percentage, and estimated lost units from early stockouts.
- Surfaces items with high stockout vulnerability.

### 2. Upload Sales POS Data
- Upload your bakery POS export CSV or click **"Load 75-Day Demo Data"** for an immediate realistic dataset with croissants, sourdough loaves, brioche, muffins, and morning buns.
- Use **"Customize Column Mapping"** to match custom POS headers.
- Automatic cleaning handles non-numeric quantities, date normalization, negative void clamping, and duplicate item-date aggregation.

### 3. Tomorrow's Forecast
- Item cards display: Point Forecast, P10–P90 Prediction Ranges, and Recommended Prep.
- Model Switcher: Choose between Auto, Random Forest ML, 4-Week Moving Average, or Seasonal Naive.
- Service Level Selector: Toggle lean (70%), standard (85%), or zero-stockout (95%) safety buffers.
- Interactive Chart: Click any pastry to view its 30-day observed sales versus censored latent demand curve.

### 4. Baker's Preparation List
- Review suggested quantities.
- Use the stepper (`+` / `-`) or type directly to override quantities.
- Add kitchen notes (e.g., "Baking extra for 10am office catering").
- Click **"Save Prep List"** to persist to SQLite.
- Click **"Export CSV for Kitchen"** to generate a clean production sheet for the bake team.

### 5. Model Performance & Backtesting
- Expanding-window rolling backtest (14, 21, or 28 days) without future data leakage.
- Direct head-to-head comparison:
  - **Seasonal Naive** ($t - 7$)
  - **4-Week Same-Weekday Average**
  - **Tomorrow's Tray (ML Model)**
- Metrics: **MAE**, **WAPE** (with zero-denominator guard), **RMSE**, and **P10–P90 Empirical Coverage**.
- Uncensored observations are evaluated separately to document ground truth accuracy.

### 6. Settings & Local AI
- **Ollama Gemma**: Check connection to local `http://localhost:11434`. If Ollama is not installed or running, the deterministic statistical template explainer automatically takes over with zero latency and zero hallucination.
- **TabPFN**: Check status of foundation model integration.
- **Database Reset**: Wipe and reset SQLite records whenever testing new datasets.

---

## 8. POS CSV Canonical Schema

| Field Name | Type | Required | Description |
|---|---|---|---|
| `date` | String | Yes | ISO date `YYYY-MM-DD` or standard POS datetime. |
| `item` | String | Yes | Product name (e.g., `Artisanal Croissant`, `Sourdough Loaf`). |
| `quantity_sold` | Number | Yes | Positive units sold. |
| `sold_out_time` | String | Optional | Timestamp when item ran out (e.g., `11:45`). |
| `closing_time` | String | Optional | Store closing time (e.g., `17:00`). |
| `unit_price` | Number | Optional | Retail price per item. |
| `notes` | String | Optional | Free-form event or weather notes. |

---

## 9. Design Philosophy

- **Artisanal Warm Palette**: Cream backgrounds (`#FDFCF7`), espresso typography (`#2D1C15`), muted terracotta buttons (`#C86D51`), and calming sage accents (`#5C7A63`).
- **Scientifically Honest**: AI suggestions and baker final quantities are always kept distinct. If data is limited, bounds are clearly labeled as provisional.
- **Offline & Private First**: Runs 100% locally on your machine with persistent SQLite and optional local Ollama. Zero mandatory cloud subscriptions or API keys.
