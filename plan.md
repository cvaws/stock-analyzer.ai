# AI Coding Handoff Plan

## Goal
Transform the current `stock-analyzer.ai` implementation into an evidence-driven evolutionary research engine that can generate, test, mutate, evaluate, and learn from ETF strategy experiments over time.

This document is written to be passed directly to an AI coding assistant. It is intended to be implementation-oriented, not visionary.

## Project context
The current system already has these working foundations:

- ETF-only technical analysis pipeline.
- SQLite-backed indicator and market regime data.
- Deterministic indicator calculations including Mansfield Relative Strength parity.
- Strategy backtesting and portfolio simulation.
- A local LLM-assisted optimizer that proposes candidate strategies.
- A React/Vite dashboard and JSON/CSV export pipeline.

The target architecture should preserve the current working data pipeline where possible, but change the strategy research layer from "LLM generates strategies and grid searches parameters" into "systematically generate, mutate, backtest, record evidence, and use evidence to guide future search."

## Primary architecture change
The current implementation is strategy-promotion oriented.

The target implementation must be experiment-history oriented.

That means:

- Never overwrite research history.
- Treat every strategy run as an experiment.
- Store rules as structured objects rather than SQL-like freeform strings.
- Record lineage for every generated strategy.
- Aggregate evidence across all experiments.
- Use the LLM only for interpreting evidence and suggesting search directions, not for writing executable strategy logic.

## Non-goals
Do not do these in the first implementation phase:

- Do not rebuild the indicator engine.
- Do not rebuild the dashboard frontend beyond minimal additions needed to expose new outputs.
- Do not remove the current strategy lab until the new research pipeline is functioning.
- Do not make the LLM responsible for SQL generation.
- Do not introduce a distributed system or remote orchestration.

## Desired end state
The system should support this loop:

1. Read current indicator and ETF universe data from SQLite.
2. Generate candidate strategies from structured rule components.
3. Mutate or crossover existing high-value strategies.
4. Backtest each strategy through the existing execution engine or an adapted equivalent.
5. Save all trades, metrics, parameters, and metadata as immutable experiments.
6. Aggregate evidence across experiments.
7. Compute feature, rule, and pair importance statistics.
8. Ask the LLM for research observations based on evidence summaries only.
9. Feed those observations into a search controller that biases the next generation.
10. Repeat.

## Implementation principles

- Indicators are facts.
- Rules are hypotheses.
- Strategies are experiments.
- Backtests create evidence.
- Evidence guides future search.
- The backtester must not contain optimizer logic.
- The optimizer must not contain execution logic.
- The LLM must not generate executable syntax.

## Existing components to preserve
Retain and reuse these current capabilities as much as possible:

- SQLite database with ETF metadata, OHLCV history, daily indicators, and market regime data.
- Indicator computation modules under `src/indicators/`.
- Current backtest execution concepts and portfolio simulation logic.
- Existing export conventions where practical.
- Existing regime context and ETF universe model.

Refactor around them rather than replacing them wholesale.

## New core entities
Introduce these durable domain entities.

### Rule
Represents one structured condition.

Suggested fields:

- `id`
- `category` (`trend`, `relative_strength`, `momentum`, `market_filter`, `exit`, `risk`, `profit_taking`)
- `left_operand`
- `operator`
- `right_operand`
- `enabled`
- `weight`
- `parameter_metadata` (optional JSON)

Examples:

- `ema_8 > ema_21`
- `mrs_weekly_index > 0`
- `rsi_14 > 55`
- `close > sma_50`

### Strategy
Represents a structured strategy definition, not a SQL string.

Suggested fields:

- `id`
- `name`
- `universe`
- `entry_rule_ids`
- `exit_rule_ids`
- `risk_rule_ids`
- `profit_taking_rule_ids`
- `market_filter_rule_ids`
- `status`
- `created_at`
- `created_from_strategy_id` (nullable)
- `generation_number`
- `origin_type` (`seed`, `mutation`, `crossover`, `manual`)

### Experiment
Represents one execution of one strategy on one configuration.

Suggested fields:

- `id`
- `strategy_id`
- `run_timestamp`
- `universe`
- `date_range`
- `parameter_snapshot`
- `metrics_json`
- `portfolio_summary_json`
- `trade_count`
- `duration_seconds`
- `success`
- `failure_reason` (nullable)

### Trade
Represents one completed trade from an experiment.

Suggested fields:

- `id`
- `experiment_id`
- `strategy_id`
- `symbol`
- `entry_date`
- `exit_date`
- `entry_price`
- `exit_price`
- `return_pct`
- `exit_reason`
- `holding_period`

### Mutation history
Tracks how a strategy changed.

Suggested fields:

- `id`
- `parent_strategy_id`
- `child_strategy_id`
- `mutation_type`
- `mutation_details_json`
- `created_at`

### Evidence tables
Add evidence-oriented aggregate tables.

Minimum set:

- `feature_statistics`
- `indicator_statistics`
- `rule_statistics`
- `rule_pair_statistics`
- `llm_observations`

## Database changes
Keep the existing ETF and indicator tables intact.

Add new normalized research tables rather than forcing all new behavior into the current `strategies.json` and `strategy_lab.json` flow.

Preferred direction:

- Continue using SQLite.
- Add migrations for new tables.
- Make experiment and trade persistence append-only.
- Allow aggregate tables to be recomputed when needed.

Avoid storing new strategy logic as raw SQL blobs where possible.

## Strategy representation
The assistant should replace string-based strategy definitions with structured, serializable rule objects.

A strategy should be composed from named rule groups:

- Universe
- Entry rules
- Exit rules
- Risk rules
- Profit-taking rules
- Market filters

The system must still be able to compile a structured strategy into executable backtest conditions internally, but compiled execution logic should be derived from structured rules rather than being the source of truth.

## Generator requirements
Implement a strategy generator that does not depend on the LLM.

The generator should:

- Choose a universe.
- Choose one or more trend rules.
- Choose one or more relative strength rules.
- Choose optional momentum rules.
- Choose market filters.
- Choose exit logic.
- Choose stop-loss and profit-taking settings.
- Produce many valid structured candidate strategies.

Generation should be deterministic when seeded.

## Mutation requirements
Implement mutations at the rule and strategy level.

Required mutation types:

- Threshold adjustment, example: `rsi_14 > 50` to `rsi_14 > 55`
- Operator change, example: `>` to `>=`
- Indicator substitution, example: daily RS to weekly RS
- Rule addition
- Rule removal
- Universe change
- Exit change
- Risk parameter change

Every mutation must be recorded in lineage tables.

## Crossover requirements
Implement gene-like crossover between compatible strategies.

A child strategy may inherit independent components such as:

- Trend rules from parent A
- Relative strength rules from parent B
- Exit logic from parent B
- Risk settings from parent A

The child must be validated before backtesting.

## Backtesting requirements
Reuse the existing backtest engine if possible, but enforce clean boundaries.

The backtester must:

- Accept a structured strategy definition.
- Resolve it into executable conditions.
- Run the per-ETF state machine.
- Emit trade logs.
- Emit summary metrics.
- Emit portfolio-level metrics if portfolio simulation is enabled.

The backtester must not:

- Choose what to test next.
- Rank search directions.
- Perform mutation logic.
- Call the LLM.

## Experiment persistence
Every backtest run must create a persistent experiment record.

Rules:

- Never overwrite an old experiment.
- Never delete past evidence during normal operation.
- Persist failed runs when possible with failure metadata.
- Store enough metadata to reproduce the run later.

## Evidence aggregation
Implement a post-processing layer that computes statistics across all completed experiments.

Minimum outputs:

- Rule frequency.
- Rule win rate.
- Rule profit factor.
- Indicator usage frequency.
- Average return by indicator.
- Average drawdown by rule.
- Pairwise rule statistics.
- Universe-level performance summaries.
- Exit-type performance summaries.

These aggregates should be queryable by later optimizer stages and by the dashboard.

## LLM role
The LLM should only receive evidence summaries, not raw execution responsibilities.

The LLM input may include:

- Top experiments.
- Weak experiments.
- Rule statistics.
- Pair statistics.
- Feature importance.
- Indicator importance.
- Recent changes in search performance.

The LLM output should be limited to structured research observations such as:

- promising indicators
- weak indicators
- threshold regions worth exploring
- combinations worth expanding
- combinations worth reducing
- universes worth prioritizing

The LLM must not return executable SQL or direct strategy syntax that becomes the source of truth.

## Search controller
Implement a search controller that consumes aggregate evidence and optional LLM observations.

Its job is to bias the next generation by changing probabilities such as:

- likelihood of selecting certain indicators
- likelihood of selecting certain rule pairs
- mutation rate by strategy family
- threshold exploration ranges
- universe priority

This controller should be rule-based first. LLM suggestions can influence it, but should not fully control it.

## Explainability and lineage
Every strategy should be explainable.

For each strategy, the system should be able to answer:

- Why it was generated.
- Whether it came from seed, mutation, or crossover.
- Which parent strategy it came from.
- Which changes were applied.
- Which rules contributed most to its performance.
- Which rules appear harmful according to aggregate evidence.

## Suggested file and module changes
This is a proposed direction. Adjust to the actual repository layout if needed.

### New modules

- `src/research/models/rules.py`
- `src/research/models/strategy.py`
- `src/research/models/experiment.py`
- `src/research/generator/strategy_generator.py`
- `src/research/evolution/mutation_engine.py`
- `src/research/evolution/crossover_engine.py`
- `src/research/backtest/strategy_compiler.py`
- `src/research/evidence/aggregator.py`
- `src/research/evidence/importance.py`
- `src/research/search/search_controller.py`
- `src/research/llm/research_observer.py`
- `src/research/persistence/repositories.py`
- `src/research/persistence/migrations.py`

### Existing modules likely to be adapted

- Current optimizer node implementation.
- Current backtest engine.
- Current strategy definition loading path.
- Current export pipeline.
- Current dashboard data endpoints or JSON output generation.

## Delivery phases
Implement in phases. Do not attempt a full rewrite in one pass.

### Phase 1: Structured strategy model

Deliverables:

- Rule and Strategy domain models.
- Serialization and deserialization.
- Compiler from structured strategies to executable conditions.
- Compatibility layer so existing backtester can run structured strategies.

Acceptance criteria:

- At least one current strategy can be represented as structured rules.
- Structured strategy compiles and backtests successfully.
- Existing indicator references still work.

### Phase 2: Experiment persistence

Deliverables:

- SQLite migrations for strategy, experiment, trade, and mutation tables.
- Persistence layer for experiment runs.
- Append-only experiment logging.

Acceptance criteria:

- Every run creates experiment and trade records.
- Failed runs are recorded safely.
- Prior runs remain queryable.

### Phase 3: Generator and mutation engine

Deliverables:

- Non-LLM strategy generator.
- Mutation engine.
- Crossover engine.
- Validation rules for generated strategies.

Acceptance criteria:

- System can generate multiple valid strategies automatically.
- Mutations and crossovers are logged with lineage.
- Invalid strategies are rejected before backtest.

### Phase 4: Evidence aggregation

Deliverables:

- Aggregate rule and indicator statistics.
- Pair statistics.
- Feature importance computations.
- Exportable evidence summaries.

Acceptance criteria:

- Aggregates can be recomputed from persisted experiments.
- Evidence tables support ranking by profitability, robustness, and frequency.

### Phase 5: LLM research observer and search controller

Deliverables:

- Evidence summarizer for the LLM.
- Structured observation output format.
- Search controller that biases next-generation search.

Acceptance criteria:

- LLM output is advisory, not executable.
- Search behavior changes based on evidence.
- Search can run without the LLM as a fallback.

### Phase 6: Dashboard exposure

Deliverables:

- Evidence and lineage outputs available to the dashboard.
- Minimal new views or data endpoints for experiment history and importance metrics.

Acceptance criteria:

- User can inspect top rules, top pairs, strategy lineage, and optimizer learning history.

## Constraints

- Keep Python implementation style consistent with the existing repository.
- Prefer additive changes over destructive rewrites.
- Preserve current indicator naming unless there is a migration plan.
- Keep SQLite as the source of truth in the near term.
- Maintain deterministic behavior where practical for reproducibility.
- Favor explicit types and schema clarity over loosely structured dicts.

## Testing requirements
Add tests for:

- Rule serialization.
- Strategy compilation.
- Mutation correctness.
- Crossover validity.
- Experiment persistence.
- Evidence aggregation accuracy.
- Lineage reconstruction.
- Backward compatibility for at least one existing strategy path.

## Output requirements
The implementation should produce machine-readable outputs for:

- strategy definitions
- experiment results
- trade logs
- evidence summaries
- lineage relationships
- LLM observations

JSON is acceptable for exports, but SQLite should remain the canonical persistent store.

## Open questions to resolve explicitly during implementation
If any of these are not already answered by the repository, stop and document the decision rather than guessing.

- Should existing `strategies.json` remain supported as an import format only, or as an active runtime format?
- Should portfolio simulation occur for every experiment or only shortlisted strategies?
- What metrics define a "promising" strategy beyond profit factor and net profit?
- How should regime filters be represented as rule objects?
- What is the minimum viable dashboard surface for evidence inspection?
- Should aggregates be materialized tables, views, or batch-generated snapshots?
- How should duplicate strategies be detected canonically?

## Definition of done
The first successful milestone is not "the best strategy was found."

The first successful milestone is:

- structured strategies exist
- experiments are persisted immutably
- mutations and lineage are tracked
- aggregate evidence is computed
- the search process can improve based on stored evidence
- the LLM is limited to research guidance

## Instructions to the AI coding assistant

- Read the current repository structure before changing files.
- Preserve working behavior where possible.
- Implement phase by phase.
- After each phase, summarize changed files, new abstractions, tradeoffs, and any unresolved decisions.
- Do not invent hidden requirements.
- When repository details conflict with this plan, prefer the repository reality and document the deviation.
- Ask for confirmation before making destructive schema or interface changes.