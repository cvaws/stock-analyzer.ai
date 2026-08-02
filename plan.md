# StockWave Evolutionary Research Engine

Version 2

---

# Vision

StockWave should not be a strategy generator.

It should become an AI Research Platform that continuously discovers
better ETF trading strategies through evidence.

The system should improve over time as more experiments are run.

The LLM is NOT the optimizer.

The optimizer is NOT the backtester.

Every component has a single responsibility.

---

# Guiding Principles

1. Indicators are facts.
2. Rules are hypotheses.
3. Strategies are experiments.
4. Backtests generate evidence.
5. Evidence improves future hypotheses.

The goal is continuous learning.

---

# System Architecture

                     SQLite
                        │
                        ▼
              Indicator Database
                        │
                        ▼
              Strategy Generator
                        │
                        ▼
             Candidate Strategies
                        │
                        ▼
               Backtesting Engine
                        │
                        ▼
             Experiment Database
                        │
                        ▼
              Evidence Aggregator
                        │
                        ▼
                     LLM
                        │
                        ▼
             New Research Direction
                        │
                        ▼
             Strategy Generator

Repeat forever.

---

# Database Layers

Current

etf_metadata

etf_indicators

These remain unchanged.

---

New Tables

strategy

Stores every strategy definition.

experiment

One execution of one strategy.

trade

Every completed trade.

rule

Normalized rule storage.

feature_statistics

Aggregated statistics across every experiment.

indicator_statistics

How every indicator performed historically.

mutation_history

Tracks evolution.

llm_observations

Stores AI reasoning over time.

---

# Strategy Model

Current

"conditions":

EMA8 > EMA21
AND
RSI > 50
AND
Weekly RS > 0

Instead

Strategy

Universe

Entry Rules

Exit Rules

Risk

Profit Taking

Every rule becomes its own object.

Example

Entry

Rule

Left

ema8

Operator

>

Right

ema21

Another

Left

mrs_daily

Operator

>

Right

0

Another

Left

rsi14

Operator

>

Right

50

No SQL strings.

---

# Rule Object

Every rule

id

category

left_operand

operator

right_operand

enabled

weight

Examples

close > ema21

ema8 > ema21

mrs_daily > 0

rsi14 > 55

All rules share one schema.

---

# Strategy Genome

A strategy is DNA.

Universe

Trend

Relative Strength

Momentum

Market Filter

Risk

Exit

Profit Taking

Each section is a gene.

Example

Leadership

EMA8>EMA21

WeeklyRS>0

DailyRS>0

RSI>55

PRESS_GAS

EMA21 Exit

3% Stop

20/20/20 Trim

Every gene is independently mutable.

---

# Strategy Generator

The generator builds candidate strategies.

It should NOT ask the LLM.

Instead

Choose Universe

Choose Trend Rule

Choose RS Rule

Choose Momentum Rule

Choose Exit

Choose Risk

Assemble Strategy

Thousands of combinations.

---

# Mutation Engine

Mutation Types

Threshold

50

↓

55

Operator

>

↓

>=

Indicator

Daily RS

↓

Weekly RS

Rule Removal

Remove RSI

Rule Addition

Add Close>SMA50

Universe

Leadership

↓

Breadth

Exit

EMA21

↓

Weekly RS

Risk

3%

↓

4%

Every mutation is logged.

---

# Crossover Engine

Strategy A

Trend

EMA8>EMA21

RS

WeeklyRS

Exit

EMA21

Strategy B

Trend

Close>SMA50

RS

DailyRS

Exit

ATR

Child

EMA8>EMA21

DailyRS

ATR

Genes are inherited independently.

---

# Backtesting Engine

Input

Strategy

ETF Universe

Historical Indicators

Output

Trade Log

Performance Metrics

Exposure

Equity Curve

Drawdown

The backtester should know nothing about optimization.

Its only job is execution.

---

# Trade Engine

Per ETF

State Machine

Flat

↓

Entry

↓

Long

↓

Exit

↓

Flat

The engine only evaluates rules.

No optimization.

No reasoning.

---

# Experiment Database

Every run becomes an experiment.

Experiment ID

Strategy ID

Date

Universe

Metrics

Trades

Duration

Parameters

Never overwrite.

Never delete.

Everything becomes evidence.

---

# Evidence Database

This becomes the most valuable table.

Every completed experiment contributes.

Example

Indicator

EMA8>EMA21

Appeared

4820

Winning

3270

Losing

1550

Win Rate

67.8

Profit Factor

1.82

Another

WeeklyRS>0

Appeared

3100

Winning

2600

Profit Factor

2.31

Another

RSI>50

Appeared

5000

Winning

2480

Profit Factor

1.11

Now the optimizer knows

Weekly RS is extremely valuable.

RSI contributes little.

---

# Pair Statistics

Even more valuable.

Example

EMA8>EMA21

AND

WeeklyRS>0

Appeared

1100

Profit Factor

2.8

Another

EMA8>EMA21

AND

RSI>50

Profit Factor

1.2

Now we learn interactions.

---

# Feature Importance

Automatically compute

Indicator Frequency

Average Return

Average Drawdown

Profit Factor

Sharpe

Contribution Score

Every indicator gets a score.

---

# Rule Importance

Same idea.

Example

Close>SMA50

Average PF

Average CAGR

Average DD

WeeklyRS>0

Average PF

Average CAGR

Average DD

Now we rank rules.

---

# Strategy Families

Cluster strategies.

Trend Following

Momentum

Relative Strength

Mean Reversion

Market Rotation

Breakouts

Now compare families.

---

# LLM Responsibilities

The LLM should NEVER write SQL.

The LLM should NEVER invent syntax.

The LLM receives

Top Experiments

Worst Experiments

Rule Statistics

Feature Importance

Indicator Importance

Pair Importance

Recent Discoveries

The LLM returns

Observations

Hypotheses

Potential Relationships

Suggested Search Directions

Example

Weekly RS appears in 91% of profitable Leadership strategies.

Daily RS contributes mostly as confirmation.

Consider exploring stricter Weekly RS thresholds.

Try removing RSI entirely.

Investigate Close>SMA50.

The LLM becomes a researcher.

---

# Search Controller

Uses LLM observations.

Chooses

Mutation Probability

Rule Frequency

Indicator Priority

Threshold Exploration

Universe Priority

This determines the next generation.

---

# Adaptive Search

Poor indicators

↓

Less likely to appear

Strong indicators

↓

More likely to appear

The search becomes smarter over time.

---

# Knowledge Base

Permanent.

Contains

Every Experiment

Every Trade

Every Rule

Every Metric

Every Observation

Never discarded.

This is the memory of the optimizer.

---

# Evidence Dashboard

Eventually build a dashboard.

Top Indicators

Top Rule Pairs

Top Exit Rules

Best Universes

Best Stops

Most Robust Strategies

Feature Importance

Rule Importance

Experiment Timeline

Optimizer Learning Curve

This becomes explainable AI.

---

# Explainability

Every strategy should answer

Why was this generated?

Why was it selected?

Why did it outperform?

Which rules mattered?

Which rules hurt?

The optimizer should always explain itself.

---

# Success Criteria

The optimizer should become progressively better without manually
adding new strategies.

After 50,000 experiments, the optimizer should possess measurable
knowledge about:

- Which indicators matter.
- Which combinations matter.
- Which universes behave differently.
- Which exits work best.
- Which rules are noise.

The LLM should use evidence to guide exploration, not intuition.

Eventually the optimizer should spend less time searching poor areas
of the search space and more time refining promising regions based on
its accumulated evidence.

# Strategy lineage 
Every strategy should know:

Parent Strategy ID
Mutation Type (e.g., threshold change, added rule, removed rule, crossover)
Generation Number

That lets you build an evolutionary tree such as:
Baseline
│
├── + Weekly RS > 0
│   ├── RSI 50 → 55
│   ├── Remove RSI
│   └── Add Close > SMA50
│
└── Replace EMA Exit with MRS Exit
    ├── Tighten Stop Loss
    └── Remove Daily RS