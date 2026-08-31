"""
Repositories Data Access Layer for StockWave Evolutionary Research Engine.
Handles persistence and querying for strategies, experiments, trades, and mutations.
"""
import json
import logging
import sqlite3
import uuid
from typing import Any, Dict, List, Optional
from config_loader import get_path_config
from research.models.strategy import StrategyGenome

logger = logging.getLogger(__name__)


class StrategyRepository:
    def __init__(self, db_path: str = None):
        self.db_path = db_path or get_path_config()["etf_db"]

    def save_strategy(self, genome: StrategyGenome) -> str:
        """Saves or updates a StrategyGenome in research_strategies."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        query = """
            INSERT INTO research_strategies (
                id, name, universe, genome_json, parent_strategy_id,
                generation_number, origin_type, mutation_details_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                universe = excluded.universe,
                genome_json = excluded.genome_json,
                generation_number = excluded.generation_number
        """
        cursor.execute(query, (
            genome.id,
            genome.name,
            genome.universe,
            json.dumps(genome.to_dict()),
            genome.parent_strategy_id,
            genome.generation_number,
            genome.origin_type,
            json.dumps(genome.mutation_details) if genome.mutation_details else None,
        ))
        conn.commit()
        conn.close()
        return genome.id

    def get_strategy(self, strategy_id: str) -> Optional[StrategyGenome]:
        """Retrieves a StrategyGenome by ID."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT genome_json FROM research_strategies WHERE id = ?", (strategy_id,))
        row = cursor.fetchone()
        conn.close()
        if not row:
            return None
        return StrategyGenome.from_dict(json.loads(row[0]))

    def get_all_strategies(self) -> List[StrategyGenome]:
        """Retrieves all persisted strategy genomes."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT genome_json FROM research_strategies")
        rows = cursor.fetchall()
        conn.close()
        return [StrategyGenome.from_dict(json.loads(r[0])) for r in rows]


class ExperimentRepository:
    def __init__(self, db_path: str = None):
        self.db_path = db_path or get_path_config()["etf_db"]

    def save_experiment(
        self,
        strategy_id: str,
        universe: str,
        per_ticker_results: Dict[str, Any],
        portfolio_result: Dict[str, Any],
    ) -> str:
        """
        Persists a complete backtest experiment and all individual trades to SQLite.
        """
        experiment_id = f"exp_{str(uuid.uuid4())[:8]}"
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        # Compute aggregate per-trade win_rate, profit_factor, total_trades
        all_trades: List[Dict[str, Any]] = []
        for res in per_ticker_results.values():
            all_trades.extend(res.get("trades", []))

        total_trades = len(all_trades)
        wins = sum(1 for t in all_trades if t.get("pnl_pct", 0) > 0)
        win_rate = round((wins / total_trades * 100), 1) if total_trades > 0 else 0.0

        gross_profit = sum(t.get("pnl_dollar", 0) for t in all_trades if t.get("pnl_dollar", 0) > 0)
        gross_loss = abs(sum(t.get("pnl_dollar", 0) for t in all_trades if t.get("pnl_dollar", 0) < 0))
        profit_factor = round(gross_profit / gross_loss, 2) if gross_loss > 0 else (99.0 if gross_profit > 0 else 0.0)

        # 1. Insert experiment record
        cursor.execute(
            """
            INSERT INTO research_experiments (
                id, strategy_id, universe, starting_capital, ending_capital,
                total_return_pct, max_drawdown_pct, win_rate, profit_factor,
                total_trades, trades_taken, trades_skipped, capital_utilization_pct,
                metrics_json, equity_curve_json, config_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                experiment_id,
                strategy_id,
                universe,
                portfolio_result.get("starting_capital", 100000.0),
                portfolio_result.get("ending_capital"),
                portfolio_result.get("total_return_pct"),
                portfolio_result.get("max_drawdown_pct"),
                win_rate,
                profit_factor,
                total_trades,
                portfolio_result.get("trades_taken", 0),
                portfolio_result.get("trades_skipped", 0),
                portfolio_result.get("capital_utilization_pct", 0.0),
                json.dumps({"per_ticker": per_ticker_results}),
                json.dumps(portfolio_result.get("equity_curve", [])),
                json.dumps(portfolio_result.get("config", {})),
            ),
        )

        # 2. Insert individual trades
        for t in all_trades:
            cursor.execute(
                """
                INSERT INTO research_experiment_trades (
                    experiment_id, strategy_id, ticker, entry_date, exit_date,
                    entry_price, exit_price, pnl_pct, pnl_dollar, holding_days, exit_reason
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    experiment_id,
                    strategy_id,
                    t.get("ticker", ""),
                    t.get("entry_date", ""),
                    t.get("exit_date", ""),
                    t.get("entry_price", 0.0),
                    t.get("exit_price", 0.0),
                    t.get("pnl_pct", 0.0),
                    t.get("pnl_dollar", 0.0),
                    t.get("holding_days", 0),
                    t.get("reason", "Signal Exit"),
                ),
            )

        conn.commit()
        conn.close()
        logger.info(f"Persisted experiment '{experiment_id}' for strategy '{strategy_id}' ({total_trades} trades).")
        return experiment_id
