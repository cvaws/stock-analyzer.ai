"""
Strategy Engine & SQL Condition Execution Engine for StockWave Strategy Lab.
"""
import sqlite3
import logging
from typing import Dict, Any, List, Optional
import pandas as pd
from dataclasses import dataclass
from config_loader import get_path_config

logger = logging.getLogger(__name__)

@dataclass
class SQLStrategyConfig:
    name: str = "Custom Strategy"
    universe: str = "All ETFs"
    entry_condition: str = "ema_8 > ema_21 AND rsi_14 >= 50 AND mrs_daily_index >= 0.0"
    exit_condition: str = "close < ema_21 OR mrs_daily_index < 0.0"
    max_holding_bars: int = 20
    stop_loss_pct: Optional[float] = None
    profit_taking: Optional[List[Dict[str, float]]] = None
    tickers: Optional[List[str]] = None

class SQLStrategyEngine:
    def __init__(self, config: SQLStrategyConfig):
        self.config = config

    def _get_profit_steps(self) -> List[Dict[str, float]]:
        """Extracts and sorts profit taking target steps."""
        steps: List[Dict[str, float]] = []
        if self.config.profit_taking:
            for step in self.config.profit_taking:
                target = float(step.get("profit_target_pct", 0.0))
                trim = float(step.get("position_trim_pct", 0.20))
                target_pct = target * 100.0 if target <= 1.0 else target
                trim_pct = trim * 100.0 if trim <= 1.0 else trim
                if target_pct > 0:
                    steps.append({"profit_target_pct": target_pct, "position_trim_pct": trim_pct})
        steps.sort(key=lambda x: x["profit_target_pct"])
        return steps

    def run_universe_backtest(self) -> Dict[str, Any]:
        """
        Executes SQL condition evaluation across SQLite database and returns backtest summary per ticker.
        """
        db_path = get_path_config()["etf_db"]
        conn = sqlite3.connect(db_path)

        # Build universe group filter
        universe_filter = ""
        universe_val = self.config.universe.lower()
        if universe_val != "all etfs" and universe_val != "all":
            universe_filter = f"AND LOWER(m.etf_group) = '{universe_val}'"

        if self.config.tickers and len(self.config.tickers) > 0:
            formatted_tickers = ", ".join(f"'{t.strip().upper()}'" for t in self.config.tickers if t.strip())
            if formatted_tickers:
                universe_filter += f" AND UPPER(i.ticker) IN ({formatted_tickers})"

        # Construct SQL query evaluating entry and exit boolean conditions natively
        query = f"""
            SELECT 
                i.ticker,
                i.date,
                o.close,
                o.low,
                o.high,
                r.regime,
                r.regime_code,
                r.confidence AS regime_confidence,
                ({self.config.entry_condition}) AS is_entry,
                ({self.config.exit_condition}) AS is_exit
            FROM etf_daily_indicators i
            JOIN ohlcv o ON i.ticker = o.ticker AND i.date = o.date
            LEFT JOIN etf_metadata m ON i.ticker = m.ticker
            LEFT JOIN daily_market_regime r ON i.date = r.date
            WHERE 1=1 {universe_filter}
            ORDER BY i.ticker, i.date ASC
        """

        try:
            df_signals = pd.read_sql_query(query, conn)
        except Exception as e:
            logger.error(f"SQL Condition execution error: {e}")
            conn.close()
            return {}

        conn.close()

        if df_signals.empty:
            return {}

        results_by_ticker: Dict[str, Any] = {}
        profit_steps_cfg = self._get_profit_steps()

        # Process trade sequential execution per ticker
        for ticker, group in df_signals.groupby("ticker"):
            group = group.reset_index(drop=True)
            trades: List[Dict[str, Any]] = []
            in_position = False
            entry_price = 0.0
            entry_bar = 0
            entry_date = ""
            stop_loss_price = 0.0
            position_size = 10000.0
            remaining_shares = 0.0
            initial_shares = 0.0
            trimmed_pnl_dollar = 0.0
            
            # Step tracking for multi-step profit targets
            active_steps: List[Dict[str, Any]] = []

            for i in range(1, len(group)):
                row = group.iloc[i]
                date_str = str(row["date"])

                if not in_position:
                    if row["is_entry"] == 1:
                        in_position = True
                        entry_price = float(row["close"])
                        entry_bar = i
                        entry_date = date_str
                        position_size = 10000.0
                        initial_shares = position_size / entry_price
                        remaining_shares = initial_shares
                        trimmed_pnl_dollar = 0.0

                        if self.config.stop_loss_pct:
                            sl_val = float(self.config.stop_loss_pct) * 100.0 if float(self.config.stop_loss_pct) <= 1.0 else float(self.config.stop_loss_pct)
                            stop_loss_price = entry_price * (1.0 - (sl_val / 100.0))
                        else:
                            stop_loss_price = 0.0

                        active_steps = []
                        for s in profit_steps_cfg:
                            active_steps.append({
                                "target_price": entry_price * (1.0 + (s["profit_target_pct"] / 100.0)),
                                "trim_pct": s["position_trim_pct"] / 100.0,
                                "triggered": False
                            })
                else:
                    # 0. Multi-Step Partial Profit Target Trims Check
                    trims_executed = 0
                    for s in active_steps:
                        if not s["triggered"] and float(row["high"]) >= s["target_price"] and remaining_shares > 0:
                            trim_shares = min(initial_shares * s["trim_pct"], remaining_shares)
                            remaining_shares -= trim_shares
                            trimmed_pnl_dollar += trim_shares * (s["target_price"] - entry_price)
                            s["triggered"] = True

                    trims_executed = sum(1 for s in active_steps if s["triggered"])

                    exit_triggered = False
                    exit_price = float(row["close"])
                    exit_reason = "Signal Exit"

                    # 1. Stop Loss Check
                    if stop_loss_price > 0 and float(row["low"]) <= stop_loss_price:
                        exit_triggered = True
                        exit_price = stop_loss_price
                        exit_reason = "Stop Loss"
                    # 2. Rule Exit Check
                    elif row["is_exit"] == 1:
                        exit_triggered = True
                        exit_reason = "Rule Exit"
                    # 3. Time Exit Check
                    elif (i - entry_bar) >= self.config.max_holding_bars:
                        exit_triggered = True
                        exit_reason = "Time Exit"

                    if exit_triggered:
                        final_exit_pnl = remaining_shares * (exit_price - entry_price)
                        pnl_dollar = round(trimmed_pnl_dollar + final_exit_pnl, 2)
                        pnl_pct = round((pnl_dollar / position_size) * 100, 2)
                        
                        if trims_executed > 0:
                            exit_reason += f" + {trims_executed} Trim{'s' if trims_executed > 1 else ''}"

                        trades.append({
                            "ticker": ticker,
                            "entry_date": entry_date,
                            "exit_date": date_str,
                            "entry_bar": entry_bar,
                            "exit_bar": i,
                            "holding_days": i - entry_bar,
                            "entry_price": round(entry_price, 2),
                            "exit_price": round(exit_price, 2),
                            "position_size": position_size,
                            "pnl_pct": pnl_pct,
                            "pnl_dollar": pnl_dollar,
                            "reason": exit_reason
                        })
                        in_position = False

            total_trades = len(trades)
            winning_trades = sum(1 for t in trades if t["pnl_pct"] > 0)
            win_rate = round((winning_trades / total_trades) * 100, 1) if total_trades > 0 else 0.0
            net_pnl_dollar = round(sum(t["pnl_dollar"] for t in trades), 2)
            profit_factor = round(
                sum(t["pnl_dollar"] for t in trades if t["pnl_dollar"] > 0) /
                abs(sum(t["pnl_dollar"] for t in trades if t["pnl_dollar"] < 0)), 2
            ) if sum(1 for t in trades if t["pnl_dollar"] < 0) > 0 else (99.0 if net_pnl_dollar > 0 else 0.0)

            results_by_ticker[ticker] = {
                "total_trades": total_trades,
                "win_rate": win_rate,
                "net_pnl_dollar": net_pnl_dollar,
                "profit_factor": profit_factor,
                "trades": trades
            }

        return results_by_ticker

    @staticmethod
    def get_all_trades_flat(results_by_ticker: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Flattens per-ticker backtest results into a single chronologically sorted trade list
        suitable for consumption by PortfolioSimulator.

        Args:
            results_by_ticker: Output of run_universe_backtest()

        Returns:
            Sorted list of all trade dicts across all tickers.
        """
        all_trades: List[Dict[str, Any]] = []
        for ticker_result in results_by_ticker.values():
            all_trades.extend(ticker_result.get("trades", []))
        all_trades.sort(key=lambda t: t.get("entry_date", ""))
        return all_trades
