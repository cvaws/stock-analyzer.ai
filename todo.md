# StockWave Evolutionary Research Engine - Task List

## Phase 1: Structured Rule & Strategy Domain Models + Compiler
- [x] Create `src/research/models/rules.py` (Rule, RuleCategory, RuleOperator)
- [x] Create `src/research/models/strategy.py` (StrategyGenome, RiskConfig, ProfitTrimConfig)
- [x] Create `src/research/backtest/strategy_compiler.py` (Compiles StrategyGenome -> SQL condition strings for backtest engine)
- [x] Unit test Rule, StrategyGenome, and StrategyCompiler


## Phase 2: SQLite Schema Migrations & Experiment Persistence
- [x] Create `src/research/persistence/migrations.py` (SQLite schema for `strategies`, `experiments`, `trades`, `mutation_history`)
- [x] Create `src/research/persistence/repositories.py` (CRUD for strategies, experiments, trades, lineage)
- [x] Unit test SQLite migrations and repository persistence


## Phase 3: Generator, Mutation & Crossover Engines
- [x] Create `src/research/generator/strategy_generator.py` (Non-LLM structured strategy generator)
- [x] Create `src/research/evolution/mutation_engine.py` (Threshold, operator, indicator, rule mutations)
- [x] Create `src/research/evolution/crossover_engine.py` (Recombine genes from parent strategies)
- [x] Unit test generator, mutation, and crossover logic


## Phase 4: Evidence Aggregation Engine
- [x] Create `src/research/evidence/aggregator.py` (Computes rule_statistics, pair_statistics, feature_importance across all past experiments)
- [x] Unit test evidence aggregation


## Phase 5: LLM Research Observer & Adaptive Search Controller
- [x] Create `src/research/llm/research_observer.py` (Summarizes evidence for LLM; receives research directions)
- [x] Create `src/research/search/search_controller.py` (Biases mutation rates and rule probabilities based on evidence)


## Phase 6: Pipeline Integration & Dashboard Exposure
- [x] Integrate research pipeline into LangGraph workflow
- [x] Expose evidence summaries & lineage data to dashboard outputs (`strategy_lab.json`)
- [x] Verification run & validation


## Phase 7: Indicator Suite Expansion
- [x] Add `EMA 13` and `EMA 65` calculations to `src/indicators/moving_averages.py` and SQLite indicator schema
- [x] Add `atr14_pct` (ATR % of Close) calculation to `src/indicators/`
- [x] Add `vol_ma20_ratio` (Volume vs 20-day Volume MA) calculation to `src/indicators/`
- [x] Add `return_20d_pct` (20-day rate-of-change momentum) to `src/indicators/`
- [x] Register new indicators in `src/research/generator/strategy_generator.py` rule pools



## Phase 8: Robustness, Pruning & Regime-Grouped Evidence
- [x] Implement Top-K Champion Strategy Pruning (keeps max 1 top champion per universe in `strategies.json`, archives rest in SQLite)
- [x] Implement Regime-Grouped Evidence Aggregation (`EvidenceAggregator` groups indicator performance by `PRESS_GAS`, `HALF_SIZE`, `STEP_ASIDE`)
- [x] Add Out-of-Sample Train/Test Validation (supports `start_date` and `end_date` date range filtering)
- [x] Support logical rule sub-groups (`AND` / `OR` condition grouping) in `StrategyCompiler`


## Phase 9: Declarative YAML-Driven Genetic Engine (LLM-Free Architecture)
- [x] Master v2.0 `data/inputs/backtest_rules.yaml` schema definition
- [x] Create YAML rules parser & config loader (`src/research/generator/yaml_rules_loader.py`)
- [x] Enforce strict confluence rules (Entry Rules = `AND`, Exit Rules = `OR`)
- [x] Implement Parallel Universe Round Processing (`concurrent.futures.ProcessPoolExecutor` across ETF groups)
- [x] Add live combination progress counter and instant log flushing (`sys.stdout.flush()`)
- [x] Verification run & performance validation across all ETF universes


## Phase 11: Institutional Fitness Scoring & Walk-Forward Validation
- [x] Update `data/inputs/backtest_rules.yaml` with Master Institutional Schema (Fitness scoring weights, drawdown floor, 5-year splits)
- [x] Update `src/graphs/nodes/ingest_etfs.py` to fetch 5 years of daily OHLCV (`period="5y"`)
- [x] Implement Fitness Scoring Engine (`PF 35%`, `Expectancy 25%`, `Return 20%`, `WinRate 10%`, `Trades 10%`) in `optimize_strategies.py`
- [x] Implement 3-Period Walk-Forward Gate (`Train`, `Validation`, `Test` multi-period profitability requirement)
- [x] Verify code changes compile cleanly without starting execution run


## Phase 12: Supertrend Indicator Integration
- [x] Create `src/indicators/supertrend.py` — Pine Script parity Supertrend (ATR period=10, factor=3.0)
  - Full historical series via `calculate_supertrend_series(df)` returning `supertrend` + `supertrend_direction` columns
  - Latest-bar scalar via `calculate_supertrend(df)` dict
  - Direction convention: `-1` = Uptrend (support), `+1` = Downtrend (resistance), matching Pine Script
- [x] Export `calculate_supertrend` and `calculate_supertrend_series` from `src/indicators/__init__.py`
- [x] Add `supertrend REAL` and `supertrend_direction INTEGER` columns to `etf_daily_indicators` SQLite schema in `ingest_etfs.py`
  - Added `ALTER TABLE` migration guard for existing databases
- [x] Wire `calculate_supertrend_series` into `src/graphs/nodes/calculate_indicators.py`
  - Computed per-ticker on full historical df
  - Persisted to SQLite alongside all other indicator columns
  - Exposed in `technical_indicators` output dict as `supertrend` and `supertrend_direction`
- [x] Register `supertrend_direction` in `data/inputs/backtest_rules.yaml` numeric_metrics pool
  - Backtesting condition: `supertrend_direction < 0` filters for uptrend-only entries


## Phase 13: Market Page — Replace Description Column with Supertrend Badge

### Context
`supertrend` and `supertrend_direction` (+1 = Uptrend, -1 = Downtrend) are already fully computed
per-ticker in `technical_indicators` (via `calculate_indicators.py`) and the convention is
**+1 = Uptrend (bullish), -1 = Downtrend (bearish)** (positive = bullish, matching `supertrend.py` docstring).
However they are **not yet forwarded** into `etfs_tracker.json` by `export_reports.py`, and the
dashboard `ExtendedThemeStockData` interface has no `supertrendDirection` field yet.

### Backend — `src/graphs/nodes/export_reports.py`
- [x] In `export_reports()`, read `supertrend_direction` from `info` (just like `above_e8`):
  ```python
  st_direction = info.get("supertrend_direction", None)   # +1 Uptrend | -1 Downtrend | None
  ```
- [x] Add `"supertrendDirection": st_direction` to the `theme_tracker_items` dict (alongside the
  existing `aboveEma8`, `aboveEma21`, `aboveSma50` fields) so it lands in `etfs_tracker.json`

### Frontend — `dashboard/src/pages/Market.tsx`
- [x] Add `supertrendDirection?: number` field to the `ExtendedThemeStockData` interface
- [x] Remove the **Description** `<th>` header (line ~236) and its corresponding `<td>` data cell
  (line ~259 — the `{stock.symbol} ETF` placeholder cell)
- [x] Add a **Supertrend** `<th>` header in the same position (non-sortable, centred, like the
  `8ema` / `21ema` / `50 sma` headers)
- [x] Add a corresponding `<td>` that calls `renderMaBadge(stock.supertrendDirection === 1)` —
  same green ✓ / red x badge pattern used for the EMA columns.  Direction +1 (Uptrend) → above
  (✓ green), -1 or undefined → below (x red)


## Phase 14: Market Page — Add Top 3 RS Daily% and RS Weekly% Widgets

### Frontend — `dashboard/src/pages/Market.tsx`
- [x] Sort `data` (excluding any with invalid or missing values) to calculate:
  - Top 3 ETFs by `rsDailyPct`
  - Top 3 ETFs by `rsWeeklyPct`
- [x] Add two new widgets next to the Supertrend Transitions widget in the header flex row:
  - **Top 3 RS Daily% Widget**: Green themed, displaying the top 3 ETF symbols along with their parsed daily change % (e.g., `IBIT (+5.4%)`).
  - **Top 3 RS Weekly% Widget**: Purple/Cyan themed, displaying the top 3 ETF symbols along with their parsed weekly change % (e.g., `SOXL (+12.3%)`).
- [x] Ensure all 4 widgets in the header row flex-wrap cleanly on different screen sizes.


## Phase 15: Desktop App Conversion & Native Packaging Plan

### Chosen Architecture: **Tauri 2.0 + FastAPI (Python Sidecar) + React 18**

#### Architecture Rationale:
- **Desktop Shell (Tauri 2.0)**:
  - Uses native OS webviews (WebKit on macOS, WebView2 on Windows) yielding a tiny app bundle (<15MB) and minimal memory footprint (~30-50MB RAM vs 250MB+ with Electron).
  - Built-in native sidecar lifecycle management (`externalBin` in `tauri.conf.json`).
- **Python Sidecar (FastAPI vs Flask)**:
  - **Why FastAPI over Flask**: Both are Python backend servers, but FastAPI is modern, asynchronous (`async`/`await`), and natively supports **Server-Sent Events (SSE) / WebSockets**. When you run a 3-minute backtest or genetic optimization, FastAPI can stream progress line-by-line in real-time to the React progress bar without blocking the server. Flask would require extra threading and WSGI setup for streaming.
  - Packaged into a standalone sidecar binary with `PyInstaller` (includes LangGraph, pandas, yfinance, sqlite3).
- **Frontend (Existing React 18)**:
  - Preserved 100% as-is. Communicates with the local FastAPI sidecar over `http://127.0.0.1:8765`.

---

### Complexity Assessment: **Moderate (3 / 5)**
- **Why it is straightforward**:
  - The React frontend already uses standard `fetch()` calls and componentized views.
  - Python business logic is already modularized in `src/graphs/` and `src/research/`.
- **Where the complexity lies**:
  - Packaging the Python runtime & scientific dependencies (`pandas`, `numpy`, `scipy`, `yfinance`, `sqlite3`) with `PyInstaller` into a cross-platform sidecar binary.
  - Managing process lifecycle (launching the sidecar on app startup, port checking, graceful shutdown on window close).

---

### Implementation Roadmap

#### Milestone 1: Local FastAPI Sidecar Service
- [x] Create `src/server.py` using FastAPI & Uvicorn:
  - `/api/data/{filename}`: Serve JSON/CSV output data
  - `/api/pipeline/run-stream`: Trigger LangGraph scan and stream logs via SSE
  - `/api/tickers/technical/{filename}`: Serve ticker technical JSONs
  - `/api/health`: Health-check endpoint for desktop startup handshake
- [x] Test and verify FastAPI sidecar runtime running locally on port 8765

#### Milestone 2: Desktop Shell & Process Lifecycle
- [x] Create `dashboard/electron/main.js` process supervisor:
  - Auto-spawns Python FastAPI sidecar on startup
  - Performs health checks before displaying the desktop window
  - Injects dynamic `window.__SIDECAR_URL__` into webview
  - Gracefully terminates sidecar subprocess on window close / application exit
- [x] Create `dashboard/electron/preload.js` secure bridge
- [x] Configure npm script `npm run desktop:dev` to launch Vite + Electron + Sidecar concurrently

#### Milestone 3: Frontend Integration & Live Controls
- [x] Create `dashboard/src/services/api.ts` with dynamic sidecar and SSE streaming support
- [x] Update `dashboard/src/services/dataService.ts` to seamlessly route all ETF, theme, and backtest data requests through the sidecar
- [x] Add in-app "Run Daily Scan" button with live streaming execution modal to Market overview page
- [x] Add in-app "⚡ Run Strategy Optimizer" button with live streaming progress to Strategy Lab page
- [x] Verify full TypeScript build (`npm run build`) passes cleanly

---

## Phase 16: Standalone Desktop Installer (.dmg / .exe) & Custom Storage Paths

### Milestone 1: Dynamic Data Path Resolution & Custom Storage Settings
- [x] Update `src/config_loader.py` to support `STOCKWAVE_DATA_DIR` environment variable and fall back to OS user data directory:
  - macOS: `~/Library/Application Support/StockWave/data`
  - Windows: `%APPDATA%\StockWave\data`
  - Dev mode: Project root `./data`
- [x] Add Custom Data Directory Picker & Persistence in `dashboard/src/pages/Settings.tsx`
- [x] Seed default SQLite DB (`etfs.db`), inputs (`etf.yaml`, `strategies.json`), and outputs (`*.json`) to user data directory on first app launch

### Milestone 2: Python Sidecar Binary Compilation (PyInstaller)
- [x] Create `scripts/build_sidecar.py` PyInstaller spec bundling `src/server.py` + scientific dependencies (`pandas`, `numpy`, `scipy`, `yfinance`, `sqlite3`, `fastapi`, `uvicorn`) into a standalone binary `stockwave-sidecar`
- [x] Verify standalone binary runs autonomously without active virtual environment

### Milestone 3: Electron Builder & Installer Packaging (.dmg / .exe)
- [x] Configure `electron-builder` in `dashboard/package.json` with macOS DMG and Windows NSIS targets
- [x] Configure `dashboard/electron/main.js` to spawn compiled `stockwave-sidecar` binary in production mode
- [x] Add `npm run desktop:package` automated build script (React bundle + sidecar binary + electron installer)
- [x] Test and generate final standalone `.dmg` installer (`dashboard/dist-electron/StockWave-0.0.0-arm64.dmg`)

---

## Phase 17: Market Navigation Improvements — Indicator Gaps & Widget Accuracy

> **Context**: Identified through a systematic audit of what's needed to effectively navigate market regimes, identify sector leaders, and time entries/exits using the existing ETF rotation system.

---

### 17.1 Fix Data Bugs (Quick Wins)

- [x] **Fix `return5D` and `return10D` incorrect mapping** in `src/graphs/nodes/export_reports.py`
  - Currently both are set to `pct_change_w` (same value duplicated — lines 126-127)
  - `return5D` should be actual 5-day price return: `(close_today / close_5d_ago - 1) * 100`
  - `return10D` should be actual 10-day price return: `(close_today / close_10d_ago - 1) * 100`

---

### 17.2 Stage 2 Trend Detection (High Priority)

> Stage 2 is when institutional money is actively accumulating. Without this, Focus Leaders can include Stage 3 (distribution) or Stage 4 (decline) ETFs that are temporarily bouncing.

- [x] Implement `calculate_stage2_trend()` in `src/indicators/columns/stage2_trend.py`:
  - **Stage 2 = ALL of the following**:
    1. `Close > SMA200`
    2. `SMA200` slope is positive (today's SMA200 > SMA200 20 days ago)
    3. `Supertrend Direction = +1` (weekly Supertrend bullish)
    4. `MRS Daily Index > 0` (RS outperforming SPY)
- [x] Wire `calculate_stage2_trend()` into `src/graphs/nodes/calculate_indicators.py` (replace `"stage2_trend": None` hardcode on line 218)
- [x] Export populated `stage2Trend` boolean to `etfs_tracker.json` in `export_reports.py`
- [x] Add `S2` green badge to **Top 10 Focus Leaders** widget when `stock.stage2Trend === true`

---

### 17.3 Add Macro Context ETFs to Canary Universe (High Priority)

> Current Canaries are all-equity, all-US. TLT and VIXY give bond-equity rotation and fear signals that anticipate regime transitions *before* price-only signals catch up.

- [x] Add `TLT` (20+ Year Treasury Bond ETF) to `data/inputs/etfs/Canaries.csv`
  - **Inverted Canary logic**: TLT *weak* (below EMA21 + SMA50) = bullish equity signal (money leaving bonds → entering stocks)
  - Implement special inverted health scoring for TLT in `src/indicators/columns/market_regime.py`
- [x] Add `VIXY` (VIX Short-Term Futures ETF) as fear gauge Canary
  - Inverted: VIXY *weak* (below EMA21) = low fear = bullish
- [x] Add dedicated "Macro Context" row in Market Regime Dashboard widget showing TLT and VIXY status badges (separate from main health table)
- [x] Document inverted Canary logic in README.md Section 2

---

### 17.4 Volume Ratio — Surface as Information Column (Medium Priority)

> Volume doesn't need to be a hard entry filter (markets can rise on low volume — short squeezes, thin-market rallies are valid). Surface it as context; let the trader interpret it.

- [x] Export `volRatio` field in `export_reports.py` `theme_tracker_items` dict (data already in `technical_indicators` as `vol_ratio`)
- [x] Add `volRatio?: number` to `ExtendedThemeStockData` interface in `Market.tsx`
- [x] Add `Vol Ratio` column to the **ETF Category Table** in `Market.tsx`
  - Format: `1.3x` — green if `> 1.2` on an up day, red if `> 1.5` on a down day, grey otherwise

---

### 17.5 Surface Volume Dry-Up (VDU) in Focus Leaders (Medium Priority)

> VDU (tight, low-volume consolidation) is a *bullish* setup precursor — the calm before a breakout. Already detected in `detect_patterns.py` but never shown to the user.

- [x] Export `hasVDU` boolean from pattern detection results to `etfs_tracker.json`
- [x] Add `hasVDU?: boolean` to `ExtendedThemeStockData` interface
- [x] Show cyan `VDU` badge next to ticker in **Top 10 Focus Leaders** when `stock.hasVDU === true`

---

### 17.6 Surface RS New 52-Week High Dot in Focus Leaders (Medium Priority)

> `rs_new_high_250` is already computed and in the JSON as `rsNewHigh250` — just never displayed. An RS line making a new high before price is one of the most reliable leading breakout signals.

- [x] Add `rsNewHigh250?: boolean` to `ExtendedThemeStockData` interface
- [x] Show gold `RS★` badge in **Top 10 Focus Leaders** when `stock.rsNewHigh250 === true`

---

### 17.7 Relative Rotation Graph (RRG) Quadrant Classification (Medium Priority)

> RS Weekly% and RS Velocity are already the two RRG axes. Computing the quadrant gives an instant rotation cycle classification without needing a chart.

- [x] Add `calculate_rrg_quadrant()` in `src/indicators/columns/rrg_quadrant.py`:
  - **Leading**: `rs_weekly_pct > 0 AND rs_weekly_velocity > 0` → ride
  - **Weakening**: `rs_weekly_pct > 0 AND rs_weekly_velocity < 0` → trim watch
  - **Lagging**: `rs_weekly_pct < 0 AND rs_weekly_velocity < 0` → avoid
  - **Improving**: `rs_weekly_pct < 0 AND rs_weekly_velocity > 0` → early watchlist
- [x] Wire into `calculate_indicators.py` and export `rrgQuadrant` in `etfs_tracker.json`
- [x] Add `rrgQuadrant` color-coded column to **Sector Rotation & RS Acceleration** widget in `Market.tsx`
  - Leading = green, Weakening = amber, Lagging = red, Improving = cyan

---

### 17.8 Regime-Aware Top 3 Widgets (Low-Medium Priority)

> In PRESS GAS mode, Defense ETFs outperforming is a *warning*, not an opportunity. Top 3 widgets should filter contextually.

- [x] In `Market.tsx`, use `regimeData.regime_code` to filter Top 3 category results:
  - **PRESS GAS**: Exclude `Defense` from Top 3 RS Daily% and RS Weekly% lists
  - **STEP ASIDE**: Exclude `Leveraged_Long` from Top 3
  - **HALF SIZE**: Show all but flag cross-regime anomalies with a small warning badge
- [x] Add regime context label under each Top 3 widget header (e.g., `"Filtered: PRESS GAS"`)

---

### 17.9 Focus Leaders Formula Footer — Clarify Default Sort (Low Priority)

- [x] Update formula footer text in **Top 10 Focus Leaders** widget (`Market.tsx` line ~904):
  - Add: `"— default ranked by RS Weekly% (click headers to re-sort)"`

---

### 17.10 Clarify RS% Label — Add Tooltip (Low Priority)

- [x] Add tooltip or footnote to `RS Daily%` and `RS Weekly%` column headers in ETF Category Table:
  - "Mansfield RS Index — rate of outperformance vs SPY. Formula: ((ETF/SPY) / SMA52(ETF/SPY) − 1) × 10. Not the ETF's own price % change."

---

### 17.11 Exit Signal System — "Newly Exited" / "Newly Entered" Leaders Panel (Critical)

> **Why**: The system is good at finding entries but has no systematic exit logic. Without exit signals, every trade has an entry but no exit plan. You give back gains because nothing tells you when a leader has stopped being a leader.

- [x] Persist the previous scan's Focus Leaders list to a `last_focus_leaders.json` file in `export_reports.py` alongside each scan run
- [x] On each new scan, compute the diff: which tickers are **newly in** and which have **newly dropped out** of Focus Leaders
- [x] Add a **"Leader Changes"** panel to `Market.tsx` (above Focus Leaders widget):
  - 🟢 **Newly Entered** list — tickers that just qualified this scan (Supertrend flipped bullish + RS accelerating)
  - 🔴 **Newly Exited** list — tickers that just lost qualification (Supertrend flipped bearish OR RS velocity went negative)
  - Show the specific reason for exit next to each exited ticker: `"ST Flipped"` or `"RS Decel"`
- [x] Include a `supertrendFlippedBearish` flag in `etfs_tracker.json` for tickers whose Supertrend direction changed from +1 to -1 in the last scan

---

### 17.12 Position Sizing Output in Focus Leaders (Critical)

> **Why**: ATR14 and Supertrend level are already computed — these are exactly the inputs for institutional position sizing. Without this, the user has to manually size every trade with no data support.

- [x] Add a configurable `portfolioSize` setting to `dashboard/src/pages/Settings.tsx` (default: $100,000)
  - Store in `localStorage` as `portfolio_size`
- [x] In the **Top 10 Focus Leaders** widget, add a `Pos. Size` column:
  - Formula: `Stop Distance = Price − Supertrend` (distance to stop)
  - `Risk = portfolioSize × 0.01` (1% risk per trade — standard institutional rule)
  - `Shares = floor(Risk / Stop Distance)`
  - `Dollar Risk = Shares × Stop Distance`
  - Display as: `42 shares ($1,050 risk)` in small text
- [x] Export `supertrend` value in `etfs_tracker.json` — already done; confirm it's not null for all leaders

---

### 17.13 Regime Score Trending — Early Warning for Regime Transitions (Critical)

> **Why**: Regime confidence is a snapshot. 74% today after being 92% two weeks ago is completely different from 74% today after being 60% two weeks ago. Trending regime health is the earliest possible warning of an incoming regime flip — before price even breaks down.

- [x] In `src/indicators/columns/market_regime.py`, when computing `calculate_market_regime()`, also read the **last 10 days of historical regime data** from SQLite (`etf_daily_regime` table if it exists, or from `market_regime.json` history)
- [x] Compute per-group health % trend:
  - `canary_5d_change` = today's Canary% − Canary% 5 trading days ago
  - Same for Leadership, Breadth, Defense
- [x] Export `group_trends` dict in `market_regime.json`:
  ```json
  "group_trends": { "Canaries": -8.5, "Leadership": -3.0, "Breadth": +2.0, "Defense": +5.0 }
  ```
- [x] In `MarketRegimeWidget.tsx`, add a trend arrow next to each group's health % in the table:
  - ↓ red if 5-day trend < -5%, → grey if within ±5%, ↑ green if > +5%
  - Show the numeric change: e.g., `74% ↓-8.5%`
- [x] Add a **"Regime Trend Warning"** banner if Canary OR Leadership 5-day trend is below -10% while still technically in PRESS GAS (approaching threshold)

---

### 17.14 Distribution Day Counter on Benchmark ETFs (High Priority)

> **Why**: 4-5 distribution days (high-volume down days) on SPY/QQQ in a rolling 25-session window signals institutional selling — often weeks before a visible correction. This is the earliest leading warning available with daily data.

- [x] In `calculate_indicators.py`, for SPY and QQQ specifically, compute a **distribution day count**:
  - Distribution day = `pct_change_d < -0.2% AND vol_ratio > 1.0` (price down meaningfully on above-average volume)
  - Count distribution days in the past 25 trading sessions
  - Export as `spy_dist_days` and `qqq_dist_days` in `market_regime.json`
- [x] Add a **"Distribution Days"** counter badge to the Market Regime Dashboard widget:
  - SPY: `3 dist. days` in green (< 3), amber (3-4), red (≥ 5)
  - QQQ: same thresholds
  - Label: "SPY: 4 dist. days (25-session)" with color coding

---

### 17.15 Concentration / Correlation Warning in Focus Leaders (High Priority)

> **Why**: Focus Leaders might show SOXL, SMH, SOXX, TECL, XLK — all semiconductors/tech. That's not diversification, that's a single-sector bet that collapses together. The system currently cannot warn you about this.

- [x] In `Market.tsx`, after computing `sortedLeaders` (the top 10), count how many leaders share the same `sector` category
- [x] If any single sector has ≥ 3 of the top 10 leaders, show a **"⚠️ Concentration Warning"** badge above the Focus Leaders table:
  - e.g., `"⚠️ Leadership: 5 of 10 leaders are from Leveraged_Long — concentrated exposure"`
- [x] Color code: amber if 3-4, red if 5+

---

### 17.16 Buyability / Extension Score in Focus Leaders (High Priority)

> **Why**: An ETF that's 25% above its last base is a dangerous entry — you'd be buying extended and chasing. An ETF at 3% above its last breakout point is the ideal entry. `% off 52wk high` doesn't capture this — you need distance from the last consolidation.

- [x] In `detect_patterns.py`, compute `pct_above_last_base`:
  - If `isVCP == True` and `contractions` list is non-empty: `last_peak = contractions[-1].peakPrice`
  - `pct_above_last_base = (current_price / last_peak - 1) * 100`
  - If no VCP detected, fall back to: distance from 20-day high as proxy
- [x] Export `pctAboveLastBase` in `etfs_tracker.json`
- [x] Add `Ext%` column to **Top 10 Focus Leaders** table in `Market.tsx`:
  - < 5% = green ("buyable")
  - 5–10% = amber ("extended — wait for pullback")
  - > 10% = red ("too extended — do not chase")

---

### 17.17 Use `rsDailyVelocity` as Dual-Confirmation in Focus Leaders (High Priority)

> **Why**: `rsDailyVelocity` is already computed (line 91 of `calculate_indicators.py`) and exported to the JSON, but never used in any widget. Using both daily AND weekly RS velocity as dual confirmation reduces false positives — the signal is strongest when both timeframes are accelerating simultaneously.

- [x] Add `rsDailyVelocity?: number` to `ExtendedThemeStockData` interface in `Market.tsx`
  - Already in `etfs_tracker.json` as `rsDailyVelocity`
- [x] Add `D-Vel` column to **Top 10 Focus Leaders** table showing the daily RS velocity value
  - Green if > 0, red if ≤ 0
- [x] Add a **"Dual Acceleration"** highlight: if BOTH `rsWeeklyVelocity > 0` AND `rsDailyVelocity > 0`, show a `⚡⚡` double-accelerating badge on the ticker (strongest signal)

---

### 17.18 Data Freshness Indicator — Last Scan Timestamp (Medium Priority)

> **Why**: `scan_date` is already in `market_regime.json` but is never shown prominently. Looking at 3-day-old data thinking it's current makes every decision wrong.

- [x] Read `scan_date` from `regimeData` in `Market.tsx`
- [x] Display prominently in the Market page header bar (next to the "Run Daily Scan" button):
  - Format: `Last scan: Today 4:02 PM` or `Last scan: 3 days ago (Aug 28)` — color red if > 1 day old
  - If scan_date is null or missing: show `"⚠️ No scan data — run a scan first"` in amber

---

### 17.19 Cross-Category Divergence Alerts (Medium Priority)

> **Why**: Leadership strong but Breadth weak = narrow market (a few big names carrying the index while most ETFs decline) — historically precedes corrections. These divergences are visible in the health table but never automatically surfaced.

- [x] In `MarketRegimeWidget.tsx`, compute divergence flags from `groups` data:
  - **Narrow Leadership**: `Leadership% ≥ 70% AND Breadth% < 50%` → show amber warning: `"⚠️ Narrow market — Leadership without Breadth confirmation"`
  - **Defensive Rotation in Bull**: `Defense% ≥ 60% AND regime === PRESS GAS` → show amber warning: `"⚠️ Defensive rotation detected despite bull regime — watch Canaries"`
  - **Canary/Leadership Divergence**: `Canaries% ≥ 80% AND Leadership% < 40%` → show amber: `"⚠️ Canaries strong but Leadership lagging — confirm before adding size"`
- [x] Display divergence alerts as a collapsible `"Divergence Warnings"` section at the bottom of the Market Regime Dashboard widget

---

## Phase 18: Intraday Data Integration — Entry & Exit Signal Confidence

> **Context**: Phase 17 brings the daily EOD system to ~82% confidence. The remaining operational gap is **entry and exit timing** — the daily system identifies *what* to trade but cannot tell you *when intraday* to enter or exit. Adding 15/30-minute intraday bars for confirmed Focus Leaders raises confidence to ~88%.
>
> **Architecture**: Two-tier system — the existing daily pipeline classifies regime and ranks leaders once per day after market close. A separate intraday scanner runs **only on the active leaders list** during market hours, watching for entry/exit triggers. This keeps complexity and data volume manageable.
>
> **Data Source**: Polygon.io (already supported in Settings as an API key option) — free tier gives 15-minute delayed bars; paid gives real-time. yfinance provides free 5min/15min/30min/1hr historical bars with rate limits as a fallback.

---

### 18.1 Intraday Data Source & API Integration

- [ ] Add Polygon.io intraday endpoint support to `src/graphs/nodes/ingest_etfs.py`:
  - New function `fetch_intraday_bars(ticker, interval="30min", days=5)` using Polygon `/v2/aggs/ticker/{ticker}/range/{multiplier}/{timespan}/{from}/{to}` endpoint
  - Fall back to yfinance `yf.download(ticker, period="5d", interval="30m")` if Polygon key not configured
  - Return standardized OHLCV DataFrame with DatetimeIndex
- [ ] Add `intraday_interval` config option to `data/inputs/etfs.yaml` (default: `"30min"`)
- [ ] Add intraday SQLite table `etf_intraday_bars` to schema in `ingest_etfs.py`:
  ```sql
  CREATE TABLE IF NOT EXISTS etf_intraday_bars (
      ticker TEXT, datetime TEXT, open REAL, high REAL,
      low REAL, close REAL, volume INTEGER,
      ema8 REAL, ema21 REAL, supertrend REAL, supertrend_direction INTEGER,
      rs_vs_spy REAL, vol_ratio REAL,
      PRIMARY KEY (ticker, datetime)
  )
  ```
- [ ] Only fetch intraday data for tickers in the **active Focus Leaders list** (from `last_focus_leaders.json`) plus SPY — not the entire ETF universe

---

### 18.2 Intraday Indicator Calculations

- [ ] Create `src/indicators/intraday_indicators.py`:
  - `calculate_intraday_ema(df, periods=[8, 21])` — EMA on 30-min bars
  - `calculate_intraday_supertrend(df, atr_period=10, factor=2.0)` — Supertrend on 30-min bars (separate from daily/weekly — used purely for intraday trend direction)
  - `calculate_intraday_rs_vs_spy(df, spy_df)` — rolling 1-day relative performance vs SPY on 30-min bars: `(etf_close / spy_close) / (etf_open / spy_open) - 1`
  - `calculate_intraday_vol_ratio(df, lookback_bars=20)` — current bar volume vs 20-bar rolling average
- [ ] Wire into a new `ingest_intraday` node in `src/graphs/nodes/ingest_intraday.py`
- [ ] Persist all intraday indicator values to `etf_intraday_bars` SQLite table

---

### 18.3 Entry Signal Detection (Intraday Scanner)

> These are the specific intraday patterns that represent the cleanest entry points within a confirmed daily Focus Leader.

- [ ] Create `src/graphs/nodes/scan_intraday_signals.py` with the following entry signal detectors:

  **Signal 1 — EMA21 Pullback Entry**
  - Trigger: Price crossed below EMA21 then recrossed above it on a 30-min bar, with `vol_ratio > 0.8` (not heavy selling) and daily Supertrend still bullish
  - Label: `"EMA21_RECLAIM"`

  **Signal 2 — Opening Range Breakout (ORB)**
  - Trigger: First 30 minutes establishes a high/low range; price breaks above the opening range high after 10am with `vol_ratio > 1.2`
  - Label: `"ORB_BREAKOUT"`

  **Signal 3 — Intraday RS Leadership**
  - Trigger: ETF's intraday RS vs SPY is in the top 3 of all monitored leaders for the current session AND price is above intraday EMA21
  - Label: `"INTRADAY_RS_LEADER"`

  **Signal 4 — Volume Surge on Breakout**
  - Trigger: Price makes a new intraday high while `vol_ratio > 1.5` (genuine institutional participation)
  - Label: `"VOLUME_BREAKOUT"`

- [ ] Export detected entry signals to `intraday_signals.json` in outputs directory:
  ```json
  [{ "ticker": "SOXL", "signal": "ORB_BREAKOUT", "price": 42.50, "time": "10:32", "vol_ratio": 1.8 }]
  ```

---

### 18.4 Exit Signal Detection (Intraday Scanner)

> Exit signals for positions already held — these are intraday warnings before the EOD close confirms the breakdown.

- [ ] Add exit signal detectors to `scan_intraday_signals.py`:

  **Exit Signal 1 — EMA21 Breakdown**
  - Trigger: Price closes a 30-min bar **below** EMA21 AND `vol_ratio > 1.2` (selling with volume — not just noise)
  - Label: `"EMA21_BREAKDOWN"` — warning to consider exit before EOD

  **Exit Signal 2 — Intraday Supertrend Flip**
  - Trigger: Intraday Supertrend direction flips from bullish to bearish on 30-min bars
  - Label: `"INTRADAY_ST_FLIP"` — stronger exit signal

  **Exit Signal 3 — Heavy Distribution Bar**
  - Trigger: Price down > 1% on a single 30-min bar with `vol_ratio > 2.0` — institutional liquidation
  - Label: `"DISTRIBUTION_BAR"` — immediate exit consideration

  **Exit Signal 4 — RS Collapse vs SPY**
  - Trigger: ETF underperforming SPY by > 1.5% on an intraday basis while daily Supertrend still bullish (divergence — leading exit signal)
  - Label: `"RS_INTRADAY_COLLAPSE"`

- [ ] Include exit signals in `intraday_signals.json` with a `"type": "exit"` field

---

### 18.5 Intraday Pipeline — Scheduled Runner

- [ ] Create `src/server.py` endpoint `/api/intraday/scan` (POST):
  - Fetches latest 30-min bars for active Focus Leaders from Polygon/yfinance
  - Runs `scan_intraday_signals.py` detector
  - Writes `intraday_signals.json`
  - Returns detected signals as JSON response
- [ ] Create `/api/intraday/stream` SSE endpoint for live intraday signal streaming (mirrors the existing `/api/pipeline/run-stream` pattern)
- [ ] Add `npm run intraday:scan` convenience script to `dashboard/package.json` (calls the sidecar endpoint)

---

### 18.6 Frontend — Intraday Signals Panel in Market Page

- [ ] Add `fetchIntradaySignals()` function to `dashboard/src/services/dataService.ts`
  - Reads `intraday_signals.json` from the sidecar API
- [ ] Add **"⚡ Live Intraday Signals"** panel to `dashboard/src/pages/Market.tsx`, rendered between the header row and the Focus Leaders widget:
  - Only visible during market hours (9:30am–4pm ET) OR when signals file exists
  - Entry signals: green cards with ticker, signal type, price, time, vol_ratio
  - Exit signals: red cards with ticker, exit reason
  - Empty state: `"No intraday signals yet — run the intraday scanner or wait for market open"`
- [ ] Add **"Scan Intraday"** button next to "Run Daily Scan" in the Market page header:
  - Triggers `/api/intraday/scan` and shows a brief loading state
  - Refreshes the intraday signals panel on completion

---

### 18.7 Intraday Data Freshness & Market Hours Awareness

- [ ] Add `is_market_open()` utility to `src/server.py`:
  - Returns `True` if current time is between 9:30am–4:00pm ET on weekdays (excluding US market holidays)
  - Used to gate the intraday scanner endpoint (return 400 if market is closed with a clear message)
- [ ] In the Market page frontend, show a market status badge in the header:
  - 🟢 `"Market Open"` with a pulsing dot during trading hours
  - 🔴 `"Market Closed"` outside hours
  - ⏰ `"Pre-Market"` between 4am–9:30am ET
- [ ] Auto-timestamp each intraday signal with the bar time so users know how stale the signal is

---

### 18.8 Position Sizing with Intraday Stop Precision (Enhancement to 17.12)

> Once intraday data is available, position sizing can use the intraday low of the entry bar as the stop — much more precise than the daily Supertrend level.

- [ ] In the intraday entry signal output, include `suggested_stop` = low of the signal bar
- [ ] Update position size calculation in the Focus Leaders widget (17.12) to prefer the intraday stop when an intraday signal is present:
  - `Stop Distance = Entry Price − signal_bar_low` (tighter, more precise)
  - If no intraday signal: fall back to `Price − Supertrend` (daily, as per 17.12)
- [ ] Show which stop is being used: `"Intraday stop: $41.20"` vs `"Daily ST stop: $39.80"`

---

## Phase 19: Relative Rotation Graph (RRG) Quadrant Page

> **Context**: Transform 1-dimensional tabular RRG classifications into a dedicated interactive 2D rotation map with historical trajectory tails. This allows visual tracking of the full institutional sector rotation cycle: $\text{Lagging} \to \text{Improving} \to \text{Leading} \to \text{Weakening} \to \text{Lagging}$.

---

### 19.1 Historical RRG Trajectory Backend / Pipeline Support

- [x] In `src/graphs/nodes/export_reports.py`, export historical RRG coordinate tails (last 5–10 trading days):
  - For each ETF in `etfs_tracker.json`, include `rrgHistory`:
    ```json
    "rrgHistory": [
      { "date": "2026-08-25", "rsWeeklyPct": 2.1, "rsWeeklyVelocity": 1.4, "quadrant": "Leading" },
      { "date": "2026-08-26", "rsWeeklyPct": 2.5, "rsWeeklyVelocity": 2.0, "quadrant": "Leading" },
      ...
      { "date": "2026-08-31", "rsWeeklyPct": 3.8, "rsWeeklyVelocity": 2.8, "quadrant": "Leading" }
    ]
    ```
- [x] Fallback: If full SQLite daily snapshots are building up, compute 5-day trajectory vectors from historical bars or current velocity vectors.

---

### 19.2 Dedicated RRG Quadrant Page Component

- [x] Create `dashboard/src/pages/Quadrant.tsx`:
  - Interactive 2D Coordinate Grid:
    - **X-Axis**: `RS Weekly%` (Mansfield RS vs SPY benchmark, centered on 0)
    - **Y-Axis**: `RS Velocity` (Rate of change of RS momentum, centered on 0)
  - Color-coded quadrant backgrounds with glassmorphic cards:
    - **Top-Right (Leading)**: Soft Emerald / Green gradient (`#10b981`) — Active Focus & Ride
    - **Bottom-Right (Weakening)**: Soft Amber / Orange gradient (`#f59e0b`) — Trim Watch & Tighten Stops
    - **Bottom-Left (Lagging)**: Soft Rose / Red gradient (`#ef4444`) — Avoid / Short / Capital Outflow
    - **Top-Left (Improving)**: Soft Cyan / Sky gradient (`#06b6d4`) — Early Watchlist / Turnaround Plays
  - Render ETF nodes as interactive bubbles:
    - Size based on volume ratio or equal weight
    - Color based on sector category or current quadrant
    - Pulsing badge for confirmed Focus Leaders (Price > Supertrend + ST Bullish)

---

### 19.3 Directional Trajectory Tails (Historical Motion Vector)

- [x] Render 5-day motion arrows/tails for each selected or hovered ETF node showing its path across quadrants.
- [x] Add interactive trail length slider (1 Day, 3 Days, 5 Days, 10 Days).
- [x] "Show All Tails" toggle vs "Hover/Selected Only" toggle to maintain a clean visual interface without clutter.

---

### 19.4 Universe & Group Filter Controls

- [x] Add universe filter buttons at top of Quadrant page:
  - **All ETFs**
  - **Focus Leaders Only (Top 10)**
  - **Sector SPDRs (XLF, XLK, XLE, etc.)**
  - **Thematic & Growth (IGV, SMH, ARKK, etc.)**
  - **Macro Canaries (TLT, VIXY, IWM, HYG, SPY, QQQ)**
  - **Custom Search / Selection multi-select**

---

### 19.5 Navigation & App Wiring

- [x] Add **"Quadrant Map"** tab to `dashboard/src/components/TopNav.tsx` with `<Compass size={16} />` icon.
- [x] Wire `Quadrant.tsx` into `dashboard/src/App.tsx` router and state handling.








