"""
SQLite database migrations for StockWave Evolutionary Research Engine.
Creates immutable research tables: strategies, experiments, experiment_trades, mutation_history, and llm_observations.
"""
import logging
import sqlite3
from config_loader import get_path_config

logger = logging.getLogger(__name__)

MIGRATION_SQL = """
-- Table 1: Persistent Strategy Definitions & Lineage
CREATE TABLE IF NOT EXISTS research_strategies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    universe TEXT NOT NULL,
    genome_json TEXT NOT NULL,
    parent_strategy_id TEXT,
    generation_number INTEGER DEFAULT 0,
    origin_type TEXT DEFAULT 'seed',
    mutation_details_json TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_strategy_id) REFERENCES research_strategies(id)
);

-- Table 2: Immutable Backtest Experiments
CREATE TABLE IF NOT EXISTS research_experiments (
    id TEXT PRIMARY KEY,
    strategy_id TEXT NOT NULL,
    run_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    universe TEXT NOT NULL,
    starting_capital REAL DEFAULT 100000.0,
    ending_capital REAL,
    total_return_pct REAL,
    max_drawdown_pct REAL,
    win_rate REAL,
    profit_factor REAL,
    total_trades INTEGER,
    trades_taken INTEGER,
    trades_skipped INTEGER,
    capital_utilization_pct REAL,
    metrics_json TEXT,
    equity_curve_json TEXT,
    config_json TEXT,
    FOREIGN KEY (strategy_id) REFERENCES research_strategies(id)
);

-- Table 3: Individual Trades Per Experiment
CREATE TABLE IF NOT EXISTS research_experiment_trades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    experiment_id TEXT NOT NULL,
    strategy_id TEXT NOT NULL,
    ticker TEXT NOT NULL,
    entry_date TEXT NOT NULL,
    exit_date TEXT NOT NULL,
    entry_price REAL NOT NULL,
    exit_price REAL NOT NULL,
    pnl_pct REAL NOT NULL,
    pnl_dollar REAL NOT NULL,
    holding_days INTEGER NOT NULL,
    exit_reason TEXT NOT NULL,
    FOREIGN KEY (experiment_id) REFERENCES research_experiments(id),
    FOREIGN KEY (strategy_id) REFERENCES research_strategies(id)
);

-- Table 4: Mutation and Evolution History
CREATE TABLE IF NOT EXISTS research_mutation_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_strategy_id TEXT NOT NULL,
    child_strategy_id TEXT NOT NULL,
    mutation_type TEXT NOT NULL,
    details_json TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_strategy_id) REFERENCES research_strategies(id),
    FOREIGN KEY (child_strategy_id) REFERENCES research_strategies(id)
);

-- Table 5: LLM Advisory Observations Log
CREATE TABLE IF NOT EXISTS research_llm_observations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    generation_number INTEGER NOT NULL,
    observations_json TEXT NOT NULL,
    prompt_used TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
"""


def apply_migrations(db_path: str = None) -> None:
    """Executes SQLite DDL migrations to create research engine tables."""
    if not db_path:
        db_path = get_path_config()["etf_db"]

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    try:
        cursor.executescript(MIGRATION_SQL)
        conn.commit()
        logger.info(f"Applied research engine schema migrations to {db_path}.")
    except Exception as e:
        logger.error(f"Failed to apply research migrations: {e}")
        conn.rollback()
        raise e
    finally:
        conn.close()
