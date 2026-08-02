"""
Portfolio Simulator for StockWave Strategy Lab.

Simulates a real brokerage account by replaying trade signals chronologically
with finite capital, concurrent position limits, and dynamic position sizing.
Produces an equity curve and account-level performance metrics.
"""
import logging
from dataclasses import dataclass, field
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)


@dataclass
class PortfolioConfig:
    """Configuration for portfolio-level simulation, sourced from config.yaml."""
    starting_capital: float = 100_000.0
    max_concurrent_positions: int = 5
    position_size_pct: float = 0.20          # Fraction of current equity per trade (dynamic)
    cash_reserve_pct: float = 0.10           # Minimum cash buffer fraction — never fully deployed
    commission_per_trade: float = 0.0        # $ commission per trade (round-trip)


@dataclass
class OpenPosition:
    """Tracks a single open position in the portfolio simulation."""
    trade_idx: int
    ticker: str
    entry_date: str
    exit_date: str
    entry_price: float
    exit_price: float
    pnl_pct: float
    allocated_capital: float                  # $ allocated at entry (position_size_pct × equity)
    shares: float                             # allocated_capital / entry_price


class PortfolioSimulator:
    """
    Replays a strategy's trade list chronologically through a simulated capital pool.

    Key mechanics:
    - Position size = position_size_pct × current_equity at time of entry (dynamic)
    - Respects max_concurrent_positions and cash_reserve_pct
    - Trades skipped due to capital/position limits are recorded
    - Produces daily equity snapshots for charting

    Usage:
        sim = PortfolioSimulator(portfolio_config)
        result = sim.simulate(flat_trades)
    """

    def __init__(self, config: PortfolioConfig):
        self.cfg = config

    def simulate(self, flat_trades: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Runs the portfolio simulation over a chronologically sorted list of trades.

        Args:
            flat_trades: List of trade dicts from SQLStrategyEngine, sorted by entry_date.
                         Each trade must have: ticker, entry_date, exit_date, entry_price,
                         exit_price, pnl_pct, pnl_dollar, position_size.

        Returns:
            Portfolio summary dict with equity curve, return metrics, and drawdown stats.
        """
        if not flat_trades:
            return self._empty_result()

        # Sort all trades chronologically by entry date
        trades = sorted(flat_trades, key=lambda t: t.get("entry_date", ""))

        cash = float(self.cfg.starting_capital)
        equity = cash
        peak_equity = equity

        open_positions: List[OpenPosition] = []
        equity_curve: List[Dict[str, Any]] = []
        skipped_trades: int = 0
        total_capital_deployed: float = 0.0
        deployed_days: int = 0
        total_days: int = 0
        commission = float(self.cfg.commission_per_trade)

        # Build a unified timeline of all events (entries and exits)
        events: List[Dict[str, Any]] = []
        for idx, t in enumerate(trades):
            events.append({"date": t["entry_date"], "type": "entry", "trade_idx": idx})
            events.append({"date": t["exit_date"],  "type": "exit",  "trade_idx": idx})

        events.sort(key=lambda e: (e["date"], 0 if e["type"] == "exit" else 1))

        # Track which trades were actually entered
        entered: Dict[int, OpenPosition] = {}

        # Process events in chronological order
        last_date = ""
        for event in events:
            date = event["date"]
            trade_idx = event["trade_idx"]
            trade = trades[trade_idx]

            # Snapshot equity at each new date
            if date != last_date and last_date:
                # Compute current equity = cash + open position mark-to-market (use entry as proxy)
                mark_to_market = sum(pos.allocated_capital for pos in open_positions)
                snap_equity = round(cash + mark_to_market, 2)
                equity_curve.append({"date": last_date, "equity": snap_equity})
                total_days += 1
                if open_positions:
                    deployed_days += 1
                peak_equity = max(peak_equity, snap_equity)
            last_date = date

            if event["type"] == "exit":
                # Close position if it was entered
                pos = entered.get(trade_idx)
                if pos is not None:
                    # Realize PnL: shares × (exit_price - entry_price) - commissions
                    pnl = pos.shares * (trade["exit_price"] - trade["entry_price"])
                    pnl -= commission  # exit commission
                    cash += pos.allocated_capital + pnl
                    open_positions = [p for p in open_positions if p.trade_idx != trade_idx]
                    equity = cash + sum(p.allocated_capital for p in open_positions)

            elif event["type"] == "entry":
                current_equity = cash + sum(p.allocated_capital for p in open_positions)
                max_deployable = current_equity * (1.0 - self.cfg.cash_reserve_pct)
                currently_deployed = sum(p.allocated_capital for p in open_positions)
                available_cash = cash - max(0.0, current_equity * self.cfg.cash_reserve_pct - currently_deployed)

                position_size = current_equity * self.cfg.position_size_pct

                # Capacity checks
                can_enter = (
                    len(open_positions) < self.cfg.max_concurrent_positions
                    and available_cash >= position_size
                    and trade["entry_price"] > 0
                )

                if can_enter:
                    shares = position_size / trade["entry_price"]
                    pos = OpenPosition(
                        trade_idx=trade_idx,
                        ticker=trade.get("ticker", ""),
                        entry_date=trade["entry_date"],
                        exit_date=trade["exit_date"],
                        entry_price=trade["entry_price"],
                        exit_price=trade["exit_price"],
                        pnl_pct=trade.get("pnl_pct", 0.0),
                        allocated_capital=position_size,
                        shares=shares,
                    )
                    cash -= position_size + commission  # entry commission
                    cash = max(cash, 0.0)
                    open_positions.append(pos)
                    entered[trade_idx] = pos
                    total_capital_deployed += position_size
                else:
                    skipped_trades += 1

        # Close any remaining open positions at their exit prices
        for pos in list(open_positions):
            t = trades[pos.trade_idx]
            pnl = pos.shares * (t["exit_price"] - t["entry_price"]) - commission
            cash += pos.allocated_capital + pnl

        # Final equity snapshot
        final_equity = round(cash, 2)
        if last_date:
            equity_curve.append({"date": last_date, "equity": final_equity})

        # Compute drawdown from equity curve
        max_drawdown_pct = 0.0
        running_peak = self.cfg.starting_capital
        for snap in equity_curve:
            eq = snap["equity"]
            running_peak = max(running_peak, eq)
            if running_peak > 0:
                dd = (eq - running_peak) / running_peak * 100.0
                max_drawdown_pct = min(max_drawdown_pct, dd)

        total_return_pct = round(
            (final_equity - self.cfg.starting_capital) / self.cfg.starting_capital * 100.0, 2
        ) if self.cfg.starting_capital > 0 else 0.0

        capital_utilization_pct = round(
            (deployed_days / total_days * 100.0) if total_days > 0 else 0.0, 1
        )

        avg_positions_open = round(
            (total_capital_deployed / (self.cfg.starting_capital * self.cfg.max_concurrent_positions))
            if self.cfg.starting_capital > 0 else 0.0, 2
        )

        actual_trades_taken = len(entered)

        logger.info(
            f"Portfolio simulation: ${self.cfg.starting_capital:,.0f} → ${final_equity:,.2f} "
            f"({total_return_pct:+.2f}%) | Max Drawdown: {max_drawdown_pct:.1f}% | "
            f"Trades Taken: {actual_trades_taken} / Skipped: {skipped_trades}"
        )

        return {
            "starting_capital": round(self.cfg.starting_capital, 2),
            "ending_capital": final_equity,
            "total_return_pct": total_return_pct,
            "max_drawdown_pct": round(max_drawdown_pct, 2),
            "total_capital_deployed": round(total_capital_deployed, 2),
            "capital_utilization_pct": capital_utilization_pct,
            "avg_positions_open": avg_positions_open,
            "trades_taken": actual_trades_taken,
            "trades_skipped": skipped_trades,
            "equity_curve": equity_curve,
            "config": {
                "starting_capital": self.cfg.starting_capital,
                "max_concurrent_positions": self.cfg.max_concurrent_positions,
                "position_size_pct": self.cfg.position_size_pct,
                "cash_reserve_pct": self.cfg.cash_reserve_pct,
                "commission_per_trade": self.cfg.commission_per_trade,
            }
        }

    def _empty_result(self) -> Dict[str, Any]:
        """Returns a zeroed result when there are no trades to simulate."""
        return {
            "starting_capital": round(self.cfg.starting_capital, 2),
            "ending_capital": round(self.cfg.starting_capital, 2),
            "total_return_pct": 0.0,
            "max_drawdown_pct": 0.0,
            "total_capital_deployed": 0.0,
            "capital_utilization_pct": 0.0,
            "avg_positions_open": 0.0,
            "trades_taken": 0,
            "trades_skipped": 0,
            "equity_curve": [],
            "config": {
                "starting_capital": self.cfg.starting_capital,
                "max_concurrent_positions": self.cfg.max_concurrent_positions,
                "position_size_pct": self.cfg.position_size_pct,
                "cash_reserve_pct": self.cfg.cash_reserve_pct,
                "commission_per_trade": self.cfg.commission_per_trade,
            }
        }
