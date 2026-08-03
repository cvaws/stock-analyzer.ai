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




