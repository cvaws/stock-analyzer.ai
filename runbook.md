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

### 5. Launching the Dashboard (Web or Native Desktop)

#### Option A: Native Desktop App (Recommended)
Launches the native desktop window and automatically manages the local Python FastAPI sidecar in the background:

```bash
cd dashboard
npm run desktop:dev
```
- **Features**: Native frameless window with macOS drag region, auto-managed Python sidecar process, zero browser tabs required.
- **In-App "Run Daily Scan"**: Click the button on the **Market** overview page to trigger live Yahoo Finance sync, Supertrend calculations, and instant UI refresh (~5–8s).
- **In-App "⚡ Run Strategy Optimizer"**: Click the dedicated optimizer button on the **Backtests / Strategy Lab** page to run the multi-process genetic grid search across 71,000 parameter combinations.
- **Port**: Desktop shell connects to the internal FastAPI sidecar at `http://127.0.0.1:8765`.

#### Option B: Web Browser Mode
If you prefer running in a standard web browser:

```bash
cd dashboard
npm run dev
```

Open **[http://localhost:5173](http://localhost:5173)** in your browser.

---

### 6. Custom Data Storage & Persistence Paths

StockWave supports flexible data directories for storing SQLite databases, input lists, and output JSONs:

1. **Default Storage Locations**:
   - **Dev Mode**: Local project folder (`./data/`).
   - **Packaged App (macOS)**: `~/Library/Application Support/StockWave/data/`.
   - **Packaged App (Windows)**: `%APPDATA%\StockWave\data\`.
2. **Configuring a Custom Storage Directory**:
   - Open the desktop app $\rightarrow$ navigate to the **Settings** tab $\rightarrow$ **Local Data & Storage Paths**.
   - Click **`📁 Change Data Directory`** and select any local folder, external drive, or cloud sync folder (e.g. iCloud, Dropbox).
   - The app persists your chosen path in `user_config.json` and automatically routes all scans, database writes, and exports there.
3. **Environment Variable Override**:
   - You can also specify a custom path via terminal:
     ```bash
     STOCKWAVE_DATA_DIR=/path/to/custom/data npm run desktop:dev
     ```

---

### 7. Building Standalone Installers (.dmg for Mac / .exe for Windows)

To distribute StockWave as a self-contained installer that requires **no Python, Node, Git, or terminal tools** for the recipient:

#### Build Locally on macOS (.dmg):
```bash
# 1. Compile the Python sidecar binary
uv run python scripts/build_sidecar.py

# 2. Package into a drag-and-drop .dmg
cd dashboard
npm run desktop:build
```
- **Installer Output**: `dashboard/dist-electron/StockWave-0.0.0-arm64.dmg`.
- **First Run**: Automatically seeds the bundled SQLite database (`etfs.db`) and pre-calculated indicators to the user's system for instant out-of-the-box operation.

#### Build Locally on Windows (.exe):
```cmd
:: 1. Compile the Python sidecar binary
uv run python scripts/build_sidecar.py

:: 2. Package into a Windows NSIS installer
cd dashboard
npm run desktop:build
```
- **Installer Output**: `dashboard/dist-electron/StockWave Setup 0.0.0.exe`.

#### Automated Cloud Multi-OS Builds (GitHub Actions):
- Trigger the workflow from the **Actions** tab in GitHub or push a release tag (`git tag v1.0.0 && git push --tags`).
- GitHub Actions builds both **`StockWave.dmg`** and **`StockWave Setup.exe`** simultaneously and attaches them as downloadable release artifacts.

---

## Troubleshooting & FAQ

- **Desktop App Window Dragging**: Click and drag along the top 28px titlebar region of the desktop window to reposition it on your screen.
- **Fast Report Generation**: In-app daily scans run purely in-memory in ~5–8 seconds, skipping all CPU-heavy optimizer forks.
- **Clean App Shutdown**: Closing the desktop app automatically terminates Vite, Electron, and the Python FastAPI sidecar process cleanly.
- **Port Conflicts**: 
  - If `Port 5173 is already in use` appears when starting `npm run desktop:dev`, ensure any previous dev server instance is terminated.
  - The Python FastAPI sidecar runs automatically on port `8765`. If it's already active from another instance, the desktop app will cleanly connect to the existing sidecar without crashing.



