"""
Evidence Aggregator for StockWave Evolutionary Research Engine.
Computes indicator frequencies, win rates, rule performance, and regime-grouped evidence across all SQLite experiments.
"""
import json
import logging
import sqlite3
from typing import Dict, Any, List
from config_loader import get_path_config
from research.models.strategy import StrategyGenome

logger = logging.getLogger(__name__)


class EvidenceAggregator:
    def __init__(self, db_path: str = None):
        self.db_path = db_path or get_path_config()["etf_db"]

    def compute_indicator_statistics(self) -> List[Dict[str, Any]]:
        """
        Aggregates statistical performance per indicator operand across all completed experiments.
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        query = """
            SELECT s.genome_json, e.total_return_pct, e.win_rate, e.profit_factor
            FROM research_experiments e
            JOIN research_strategies s ON e.strategy_id = s.id
        """
        cursor.execute(query)
        rows = cursor.fetchall()
        conn.close()

        indicator_stats: Dict[str, Dict[str, float]] = {}

        for row in rows:
            genome_dict = json.loads(row[0])
            genome = StrategyGenome.from_dict(genome_dict)
            tot_ret = row[1] or 0.0
            win_rate = row[2] or 0.0
            pf = row[3] or 0.0

            # Extract left operands used in entry rules
            operands = {r.left_operand for r in genome.entry_rules if r.enabled}

            for op in operands:
                if op not in indicator_stats:
                    indicator_stats[op] = {
                        "count": 0,
                        "sum_return": 0.0,
                        "sum_win_rate": 0.0,
                        "sum_profit_factor": 0.0,
                        "winning_experiments": 0,
                    }

                st = indicator_stats[op]
                st["count"] += 1
                st["sum_return"] += tot_ret
                st["sum_win_rate"] += win_rate
                st["sum_profit_factor"] += pf
                if tot_ret > 0:
                    st["winning_experiments"] += 1

        results = []
        for op, st in indicator_stats.items():
            cnt = st["count"]
            results.append({
                "indicator": op,
                "frequency": cnt,
                "win_rate_pct": round((st["winning_experiments"] / cnt * 100), 1) if cnt > 0 else 0.0,
                "avg_return_pct": round(st["sum_return"] / cnt, 2) if cnt > 0 else 0.0,
                "avg_profit_factor": round(st["sum_profit_factor"] / cnt, 2) if cnt > 0 else 0.0,
            })

        results.sort(key=lambda x: x["avg_profit_factor"], reverse=True)
        return results

    def compute_regime_grouped_evidence(self) -> Dict[str, List[Dict[str, Any]]]:
        """
        Aggregates indicator statistical performance grouped by Market Regime filter
        ('PRESS_GAS', 'HALF_SIZE', 'STEP_ASIDE').
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        query = """
            SELECT s.genome_json, e.total_return_pct, e.win_rate, e.profit_factor
            FROM research_experiments e
            JOIN research_strategies s ON e.strategy_id = s.id
        """
        cursor.execute(query)
        rows = cursor.fetchall()
        conn.close()

        regime_stats: Dict[str, Dict[str, Dict[str, float]]] = {
            "PRESS_GAS": {},
            "HALF_SIZE": {},
            "STEP_ASIDE": {},
            "ALL": {}
        }

        for row in rows:
            genome_dict = json.loads(row[0])
            genome = StrategyGenome.from_dict(genome_dict)
            tot_ret = row[1] or 0.0
            win_rate = row[2] or 0.0
            pf = row[3] or 0.0

            # Find market filter regimes used in this strategy
            regimes_used = []
            for r in genome.market_filter_rules:
                if r.left_operand == "r.regime_code" and r.enabled:
                    val = r.right_operand
                    if isinstance(val, (list, tuple, set)):
                        regimes_used.extend([str(v).replace("'", "") for v in val])
                    elif isinstance(val, str):
                        regimes_used.append(val.replace("'", ""))

            if not regimes_used:
                regimes_used = ["ALL"]

            operands = {r.left_operand for r in genome.entry_rules if r.enabled}

            for reg in set(regimes_used):
                if reg not in regime_stats:
                    regime_stats[reg] = {}

                for op in operands:
                    if op not in regime_stats[reg]:
                        regime_stats[reg][op] = {"count": 0, "sum_return": 0.0, "sum_win_rate": 0.0, "sum_pf": 0.0, "wins": 0}

                    st = regime_stats[reg][op]
                    st["count"] += 1
                    st["sum_return"] += tot_ret
                    st["sum_win_rate"] += win_rate
                    st["sum_pf"] += pf
                    if tot_ret > 0:
                        st["wins"] += 1

        output: Dict[str, List[Dict[str, Any]]] = {}
        for reg_code, ind_map in regime_stats.items():
            reg_list = []
            for op, st in ind_map.items():
                cnt = st["count"]
                reg_list.append({
                    "indicator": op,
                    "frequency": cnt,
                    "win_rate_pct": round((st["wins"] / cnt * 100), 1) if cnt > 0 else 0.0,
                    "avg_return_pct": round(st["sum_return"] / cnt, 2) if cnt > 0 else 0.0,
                    "avg_profit_factor": round(st["sum_pf"] / cnt, 2) if cnt > 0 else 0.0,
                })
            reg_list.sort(key=lambda x: x["avg_profit_factor"], reverse=True)
            output[reg_code] = reg_list

        return output
