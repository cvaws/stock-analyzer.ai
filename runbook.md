# Stock Analyzer AI - End-to-End Runbook

This runbook documents every step and CLI command required to run the Stock Analyzer AI system end-to-end, from fetching fresh market data to launching the interactive Market Regime Dashboard.

---

## Quick Start

To run the complete data processing pipeline and launch the web UI:

```bash
uv run dashboard
# OR
PYTHONPATH=src:. uv run python src/main.py
```

This executes:
1. **Data Pipeline**: Ingests 3 years of daily ETF data into SQLite (`data/db/etfs.db`), calculates ThinkOrSwim parity indicators, evaluates objective **Market Regime & Health Scores**, and exports JSON output reports in $\sim 1-2$ seconds.
2. **Dashboard UI**: Launches the React Vite server at **[http://localhost:5173](http://localhost:5173)**.

*(To run calculations without launching the UI, pass `--no-ui`: `PYTHONPATH=src:. uv run python src/main.py --no-ui`)*


---

## Step-by-Step Manual Operations

If you prefer to run each step individually or debug specific pipeline components, follow the procedures below.

### 1. Prerequisite Setup

Ensure Python 3.12+ and Node.js dependencies are synchronized:

```bash
# Sync Python dependencies
uv sync

# Install Dashboard dependencies
cd dashboard
npm install
cd ..
```

---

### 2. Updating ETF Input Lists

The ETF categories are stored as CSV files inside `data/inputs/etfs/`:
- `Breadth.csv`
- `Canaries.csv`
- `Defense.csv`
- `Leadership.csv`
- `Leveraged.csv`

To add or remove an ETF from a category, simply update the corresponding CSV file. The pipeline strictly preserves row order during ingestion and dashboard display.

---

### 3. Fetching Data & Running Technical Calculations (Headless Mode)

If you want to run daily routine scans, custom strategy tests, or full grid search optimization, use the dedicated CLI entrypoints:

```bash
# 1. Fast Daily Scan (~5-10s) (Sync Data -> Calculate Regimes -> Backtest strategies.json -> Export Reports)
uv run dashboard --no-ui

# 2. Strategy Optimization (~15 min) (Grid Search 71k Permutations -> Portfolio Backtest -> Export Reports)
uv run optimize

# 3. Full Complete Pipeline + Web UI Launch
uv run dashboard
```



#### What happens during execution:
1. **SQLite Ingestion (`ingest_etfs`)**: Downloads 3 years of daily OHLCV bars + official ETF metadata descriptions from Yahoo Finance into `data/db/etfs.db`.
2. **Indicator Engine (`calculate_indicators`)**: Calls indicator scripts under `src/indicators/columns/` for:
   - Moving Averages checkmarks (`8ema`, `21ema`, `50sma`)
   - `%52wk_High`
   - ThinkOrSwim Mansfield Relative Strength Phase Performance (`RS_Daily%`, `RS_Weekly%`) with priority color badges (`MAGENTA`, `CYAN`, `GREEN`, `RED`).
3. **Market Regime Engine (`calculate_market_regime`)**:
   - Calculates 0 to 4 Health Scores per ETF.
   - Evaluates Group Health % (Canaries, Leadership, Breadth, Defense).
   - Evaluates objective Market Regime (`🟢 PRESS GAS`, `🟡 HALF SIZE`, `🔴 STEP ASIDE`) and Confidence Score %.
4. **Report Export (`export_reports`)**: Saves output datasets to `data/outputs/` (`etfs_tracker.json`, `theme_tracker.json`, `market_regime.json`, `latest_scan.csv`).

---

### 4. Direct Database Inspection (SQLite)

The SQLite database file is located at `data/db/etfs.db`.

```bash
# Inspect tables in the database
python3 -c "import sqlite3; conn = sqlite3.connect('data/db/etfs.db'); print(conn.cursor().execute(\"SELECT name FROM sqlite_master WHERE type='table';\").fetchall())"

# Query date range and bar counts for tickers
python3 -c "import sqlite3; conn = sqlite3.connect('data/db/etfs.db'); print(conn.cursor().execute(\"SELECT ticker, MIN(date), MAX(date), COUNT(*) FROM ohlcv GROUP BY ticker LIMIT 10;\").fetchall())"

# View cached ETF metadata
python3 -c "import sqlite3; conn = sqlite3.connect('data/db/etfs.db'); print(conn.cursor().execute(\"SELECT ticker, company_name FROM etf_metadata LIMIT 10;\").fetchall())"
```

---

### 5. Launching the Web Dashboard Only

If data reports are already generated under `data/outputs/` and you only want to start the React web UI:

```bash
cd dashboard
npm run dev
```

Open **[http://localhost:5173](http://localhost:5173)** in your browser.

---

## Troubleshooting & FAQ

- **Fast Report Generation**: `export_reports` runs immediately after quantitative calculations, so data is updated in under 2 seconds without waiting for Ollama LLM inference.
- **Port Conflicts**: If port `5173` is in use, Vite will automatically prompt or use the next available port.
