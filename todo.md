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

