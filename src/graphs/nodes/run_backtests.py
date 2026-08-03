import logging
import os
import json
from typing import Dict, Any, List
from graphs.state import GraphState
from strategy.backtest_engine import SQLStrategyEngine, SQLStrategyConfig
from strategy.portfolio_simulator import PortfolioSimulator, PortfolioConfig
from config_loader import load_config

logger = logging.getLogger(__name__)


def _load_portfolio_config() -> PortfolioConfig:
    """Loads portfolio simulation parameters from config.yaml."""
    cfg = load_config()
    ps = cfg.get("portfolio_simulation", {})
    return PortfolioConfig(
        starting_capital=float(ps.get("starting_capital", 100_000)),
        max_concurrent_positions=int(ps.get("max_concurrent_positions", 5)),
        position_size_pct=float(ps.get("position_size_pct", 0.20)),
        cash_reserve_pct=float(ps.get("cash_reserve_pct", 0.10)),
        commission_per_trade=float(ps.get("commission_per_trade", 0.0)),
    )


def run_backtests(state: GraphState) -> dict:
    """
    Executes SQL condition backtesting across all strategies in data/inputs/strategies.json,
    then runs portfolio-level simulation (finite capital, concurrent position limits, equity curve)
    using parameters from config.yaml portfolio_simulation block.
    """
    print("---RUNNING NODE: run_backtests---")
    strategies_path = "data/inputs/strategies.json"
    custom_path = "data/inputs/custom_strategies.json"
    strategies_list = []

    if os.path.exists(strategies_path):
        try:
            with open(strategies_path, "r") as f:
                strategies_list = json.load(f)
        except Exception as e:
            logger.error(f"Error loading {strategies_path}: {e}")

    # Seamlessly merge custom user strategies (100% immune to optimizer overwrites)
    if os.path.exists(custom_path):
        try:
            with open(custom_path, "r") as f:
                custom_strats = json.load(f)
                if isinstance(custom_strats, list):
                    strategies_list.extend(custom_strats)
                    logger.info(f"Loaded {len(custom_strats)} custom strategy entries from {custom_path}")
        except Exception as e:
            logger.error(f"Error loading {custom_path}: {e}")


    if not strategies_list:
        strategies_list = [{
            "name": "RS Strategy",
            "universe": "Canaries",
            "entry_rules": [{"conditions": "ema_8 > ema_21 AND rsi_14 >= 50 AND mrs_daily_index >= 0.0"}],
            "exit_rules": [{"conditions": "close < ema_21 OR mrs_daily_index < 0.0"}]
        }]

    portfolio_cfg = _load_portfolio_config()
    simulator = PortfolioSimulator(portfolio_cfg)
    logger.info(
        f"Portfolio simulation config: starting_capital=${portfolio_cfg.starting_capital:,.0f}, "
        f"max_positions={portfolio_cfg.max_concurrent_positions}, "
        f"position_size={portfolio_cfg.position_size_pct*100:.0f}% of equity, "
        f"cash_reserve={portfolio_cfg.cash_reserve_pct*100:.0f}%"
    )

    all_strategy_results: Dict[str, Any] = {}

    for strat in strategies_list:
        strat_name = strat.get("name", "Custom Strategy")
        entry_cond = strat.get("entry_rules", [{}])[0].get("conditions", "ema_8 > ema_21")
        exit_cond = strat.get("exit_rules", [{}])[0].get("conditions", "close < ema_21")

        risk_mgmt = strat.get("risk_management", {})
        stop_loss_pct = risk_mgmt.get("stop_loss_pct")
        if stop_loss_pct is not None:
            stop_loss_pct = float(stop_loss_pct) * 100.0 if float(stop_loss_pct) <= 1.0 else float(stop_loss_pct)

        profit_taking = strat.get("profit_taking", [])
        if isinstance(profit_taking, dict):
            profit_taking = [profit_taking]

        strat_tickers = strat.get("tickers")
        if isinstance(strat_tickers, list):
            strat_tickers = [str(t).strip().upper() for t in strat_tickers if str(t).strip()]
        else:
            strat_tickers = None

        config = SQLStrategyConfig(
            name=strat_name,
            universe=strat.get("universe", "All ETFs"),
            entry_condition=entry_cond,
            exit_condition=exit_cond,
            max_holding_bars=20,
            stop_loss_pct=stop_loss_pct,
            profit_taking=profit_taking,
            tickers=strat_tickers
        )
        engine = SQLStrategyEngine(config)
        per_ticker_results = engine.run_universe_backtest()

        # --- Portfolio simulation ---
        flat_trades = SQLStrategyEngine.get_all_trades_flat(per_ticker_results)
        portfolio_result = simulator.simulate(flat_trades)

        all_strategy_results[strat_name] = {
            **per_ticker_results,
            "portfolio_simulation": portfolio_result,
        }

        logger.info(
            f"  [{strat_name}] Portfolio: "
            f"${portfolio_cfg.starting_capital:,.0f} → ${portfolio_result['ending_capital']:,.2f} "
            f"({portfolio_result['total_return_pct']:+.2f}%) | "
            f"MaxDD: {portfolio_result['max_drawdown_pct']:.1f}% | "
            f"Taken: {portfolio_result['trades_taken']} / Skipped: {portfolio_result['trades_skipped']}"
        )

    first_name = strategies_list[0].get("name") if strategies_list else ""
    default_backtests = all_strategy_results.get(first_name, {})

    print(f"Backtest engine completed simulations for {len(all_strategy_results)} strategies (with portfolio simulation).")
    return {
        "backtest_results": default_backtests,
        "all_strategy_results": all_strategy_results,
        "saved_strategies": strategies_list
    }
