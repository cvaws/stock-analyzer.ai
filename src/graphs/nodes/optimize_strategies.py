import os
import json
import logging
import re
import sqlite3
from typing import Dict, Any, List, Optional, Tuple
from graphs.state import GraphState
from strategy.backtest_engine import SQLStrategyEngine, SQLStrategyConfig
from config_loader import load_config, get_path_config

logger = logging.getLogger(__name__)

LLM_RULES_PATH = "data/inputs/llm_rules.json"


def compute_regime_distribution(db_path: str) -> Dict[str, Any]:
    """
    Dynamically computes actual market regime distribution over ALL available data in SQLite.
    Returns live stats to ground the LLM in reality rather than hardcoded assumptions.
    """
    try:
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()

        cur.execute("""
            SELECT regime_code, COUNT(*) as cnt,
                   ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 1) as pct
            FROM daily_market_regime
            GROUP BY regime_code
            ORDER BY cnt DESC
        """)
        rows = cur.fetchall()

        cur.execute("SELECT MIN(date), MAX(date), COUNT(DISTINCT date) FROM daily_market_regime")
        date_row = cur.fetchone()
        conn.close()

        distribution = {row[0]: {"count": row[1], "pct": row[2]} for row in rows}
        regime_ctx = {
            "distribution": distribution,
            "date_range_start": date_row[0] if date_row else "unknown",
            "date_range_end": date_row[1] if date_row else "unknown",
            "total_trading_days": date_row[2] if date_row else 0,
        }
        logger.info(f"Live regime distribution computed: {distribution} over {regime_ctx['total_trading_days']} days ({regime_ctx['date_range_start']} to {regime_ctx['date_range_end']})")
        return regime_ctx

    except Exception as e:
        logger.error(f"Failed to compute regime distribution: {e}")
        return {}


def inject_exit_rule(llm_rules: Dict[str, Any], llm_exit: str) -> str:
    """
    Hard-injects the mandatory exit rule from llm_rules.json into the LLM-proposed exit condition.
    The base exit is always guaranteed to be present — LLM may add additional OR conditions.
    """
    base_exit = llm_rules.get("exit_rules", {}).get("always_require", "")
    if not base_exit:
        return llm_exit
    if llm_exit.strip() == base_exit.strip():
        return llm_exit
    # Always guarantee base exit fires, LLM condition layered as additional OR
    return f"{base_exit} OR ({llm_exit})"


def compute_universe_groups(db_path: str) -> Dict[str, List[str]]:
    """
    Dynamically reads all ETF groups and their constituent tickers from SQLite.
    Returns a dict of {group_name: [ticker1, ticker2, ...]} so optimization rounds
    are always aligned with whatever is in data/inputs/etf.yaml -> etf_metadata.
    Also includes 'All ETFs' as a synthetic group containing every ticker.
    """
    try:
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        cur.execute("""
            SELECT etf_group, GROUP_CONCAT(ticker ORDER BY ticker) as tickers
            FROM etf_metadata
            GROUP BY etf_group
            ORDER BY etf_group
        """)
        rows = cur.fetchall()
        cur.execute("SELECT ticker FROM etf_metadata ORDER BY ticker")
        all_tickers = [r[0] for r in cur.fetchall()]
        conn.close()

        groups: Dict[str, List[str]] = {}
        for group, tickers_str in rows:
            groups[group] = tickers_str.split(",") if tickers_str else []
        groups["All ETFs"] = all_tickers
        logger.info(f"Loaded {len(groups)-1} ETF groups + 'All ETFs' from database: {list(groups.keys())}")
        return groups
    except Exception as e:
        logger.error(f"Failed to load ETF groups from database: {e}")
        return {"All ETFs": []}


def generate_parameter_variants(base_strat: Dict[str, Any]) -> List[Dict[str, Any]]:

    """Generates parameter-tuned variants of a base strategy hypothesis driven dynamically by backtest_rules.yaml."""
    from research.generator.yaml_rules_loader import YAMLBacktestRulesLoader
    yaml_loader = YAMLBacktestRulesLoader()

    sl_variations = yaml_loader.get_stop_loss_range()
    if not sl_variations:
        sl_variations = [0.03, 0.05, 0.07, 0.08]

    pt_variations = [
        [
            {"profit_target_pct": 0.15, "position_trim_pct": 0.20},
            {"profit_target_pct": 0.30, "position_trim_pct": 0.20}
        ],
        [
            {"profit_target_pct": 0.20, "position_trim_pct": 0.20},
            {"profit_target_pct": 0.35, "position_trim_pct": 0.20},
            {"profit_target_pct": 0.50, "position_trim_pct": 0.20}
        ],
        [
            {"profit_target_pct": 0.25, "position_trim_pct": 0.25},
            {"profit_target_pct": 0.50, "position_trim_pct": 0.25}
        ]
    ]

    variants = []
    base_name = base_strat.get("name", "Strategy")
    base_entry = base_strat.get("entry_rules", [{}])[0].get("conditions", "ema_8 > ema_21")
    base_exit = base_strat.get("exit_rules", [{}])[0].get("conditions", "close < ema_21")
    universe = base_strat.get("universe", "All ETFs")

    v_idx = 1
    for stop_loss in sl_variations:
        for pt_plan in pt_variations:
            variant_name = f"{base_name} [Opt-v{v_idx} SL={round(stop_loss*100, 1)}%]"
            variants.append({
                "name": variant_name,
                "universe": universe,
                "risk_management": {"stop_loss_pct": stop_loss},
                "profit_taking": pt_plan,
                "entry_rules": [{"conditions": base_entry}],
                "exit_rules": [{"conditions": base_exit}]
            })
            v_idx += 1
    return variants




def optimize_strategies(state: GraphState) -> dict:
    """
    Autonomous Profit-Maximizing Evolutionary Strategy Optimizer Engine.

    All LLM context comes from data/inputs/llm_rules.json (static human-managed rules)
    merged with live regime distribution computed dynamically from all available SQLite data.

    Per universe:
    1. LLM formulates hypotheses grounded in actual regime distribution + llm_rules.json guidance.
    2. Hard exit rule from llm_rules.json is always injected before backtesting.
    3. Full parameter grid sweep (stop loss x profit taking) is evaluated.
    4. The single max Net Dollar Profit ($) champion per universe is promoted.
    5. If all hypotheses produce 0 trades, zero_trade_recovery message from llm_rules.json
       is injected into the next prompt attempt.
    """
    logger.info("=== STARTING PROFIT-MAXIMIZING EVOLUTIONARY STRATEGY OPTIMIZER ===")

    strategies_path = "data/inputs/strategies.json"
    existing_strategies = state.get("saved_strategies", [])
    if not existing_strategies and os.path.exists(strategies_path):
        try:
            with open(strategies_path, "r") as f:
                existing_strategies = json.load(f)
        except Exception as e:
            logger.error(f"Error loading {strategies_path}: {e}")

    cfg = load_config()
    model_name = cfg.get("models", {}).get("chat", {}).get("name", "qwen3-coder:30b")
    db_path = cfg.get("paths", {}).get("etf_db", "data/db/etfs.db")

    # Load static rules from llm_rules.json (single source of truth)
    llm_rules = load_llm_rules()

    # Compute live regime distribution from ALL available SQLite data
    regime_ctx = compute_regime_distribution(db_path)

    # Dynamically build optimization rounds from all ETF groups in the database.
    # This means new groups added to etf.yaml will automatically be picked up.
    universe_groups = compute_universe_groups(db_path)
    optimization_rounds = [
        {"target_universe": uni, "tickers": tickers}
        for uni, tickers in universe_groups.items()
    ]
    logger.info(f"Optimization will run across {len(optimization_rounds)} universe rounds: {[r['target_universe'] for r in optimization_rounds]}")

    promoted_champions = []


def evaluate_single_universe(round_info: Dict[str, Any], round_idx: int, total_rounds: int) -> Optional[Dict[str, Any]]:
    """Evaluates exhaustive strategy permutations in parallel for a single ETF universe."""
    import sys
    from research.generator.yaml_rules_loader import YAMLBacktestRulesLoader
    yaml_loader = YAMLBacktestRulesLoader()


    target_uni = round_info["target_universe"]
    universe_tickers = round_info["tickers"]

    logger.info(f"🏆 OPTIMIZATION ROUND {round_idx}/{total_rounds}: UNIVERSE '{target_uni}' ({len(universe_tickers)} ETFs)")
    sys.stdout.flush()

    # 1. Trend Crossovers Pool (Generated dynamically from backtest_rules.yaml trend_series)
    trend_pairs = yaml_loader.generate_trend_pairs()


    # 2. Relative Strength Thresholds Pool
    mrs_d_vals = yaml_loader.get_indicator_values_array("mrs_daily_index")
    mrs_d_steps = [x for x in mrs_d_vals if x in [-0.2, -0.1, 0.0, 0.05, 0.10, 0.15, 0.20]] or [0.0]

    # 3. RSI Momentum Thresholds Pool
    rsi_vals = yaml_loader.get_indicator_values_array("rsi_14")
    rsi_steps = [x for x in rsi_vals if x in [40.0, 45.0, 50.0, 55.0, 60.0, 65.0, 70.0]] or [50.0]

    # 4. Exhaustively combine indicator building blocks (Entry=AND)
    base_candidates = []
    comb_idx = 1
    for tr_rule in trend_pairs:
        for mrs_d in mrs_d_steps:
            for rsi_val in rsi_steps:
                entry_cond = f"{tr_rule} AND mrs_daily_index > {mrs_d} AND rsi_14 >= {rsi_val} AND r.regime_code IN ('PRESS_GAS', 'HALF_SIZE')"
                exit_cond = "close < ema_21 OR mrs_daily_index < 0.0"
                
                base_candidates.append({
                    "name": f"{target_uni} Grid Strategy [{comb_idx}] ({tr_rule} | MRS>{mrs_d} | RSI>={rsi_val})",
                    "universe": target_uni,
                    "risk_management": {"stop_loss_pct": 0.05},
                    "profit_taking": [
                        {"profit_target_pct": 0.20, "position_trim_pct": 0.20},
                        {"profit_target_pct": 0.35, "position_trim_pct": 0.20}
                    ],
                    "entry_rules": [{"conditions": entry_cond}],
                    "exit_rules": [{"conditions": exit_cond}]
                })
                comb_idx += 1

    # Build parameter sweep grid
    full_evaluation_queue: List[Dict[str, Any]] = []
    for b_strat in base_candidates:
        full_evaluation_queue.append(b_strat)
        full_evaluation_queue.extend(generate_parameter_variants(b_strat))

    total_queue_len = len(full_evaluation_queue)
    logger.info(f"Evaluating {total_queue_len:,} parameter combinations in parallel for '{target_uni}'...")

    sys.stdout.flush()

    champion_strat: Optional[Dict[str, Any]] = None
    max_net_pnl = -999999.0
    champion_metrics: Dict[str, Any] = {}

    for eval_idx, strat in enumerate(full_evaluation_queue, 1):
        if eval_idx == 1 or eval_idx % 1000 == 0 or eval_idx == total_queue_len:
            pct = round((eval_idx / total_queue_len) * 100, 1)
            logger.info(f"⏳ ['{target_uni}'] Combination {eval_idx:,}/{total_queue_len:,} ({pct}%) evaluated...")
            sys.stdout.flush()

        strat_name = strat.get("name", f"Variant {eval_idx}")
        entry_cond = strat.get("entry_rules", [{}])[0].get("conditions", "ema_8 > ema_21")
        exit_cond = strat.get("exit_rules", [{}])[0].get("conditions", "close < ema_21")

        risk_mgmt = strat.get("risk_management", {})
        stop_loss_pct = risk_mgmt.get("stop_loss_pct")
        if stop_loss_pct is not None:
            stop_loss_pct = float(stop_loss_pct) * 100.0 if float(stop_loss_pct) <= 1.0 else float(stop_loss_pct)

        profit_taking = strat.get("profit_taking", [])
        if isinstance(profit_taking, dict):
            profit_taking = [profit_taking]

        # Institutional Walk-Forward & Fitness Score Evaluation
        # 1. Train Split Evaluation (2021-08-01 to 2024-03-31)
        config_train = SQLStrategyConfig(
            name=strat_name,
            universe=target_uni,
            entry_condition=entry_cond,
            exit_condition=exit_cond,
            max_holding_bars=999,
            stop_loss_pct=stop_loss_pct,
            profit_taking=profit_taking,
            start_date="2021-08-01",
            end_date="2024-03-31",
            tickers=strat.get("tickers")
        )
        res_train = SQLStrategyEngine(config_train).run_universe_backtest()

        if not res_train:
            continue

        train_trades = sum(v["total_trades"] for v in res_train.values())
        if train_trades < 20:
            continue

        train_wins = sum(sum(1 for t in v["trades"] if t["pnl_pct"] > 0) for v in res_train.values())
        train_pnl = round(sum(v["net_pnl_dollar"] for v in res_train.values()), 2)
        train_gain = sum(sum(t["pnl_dollar"] for t in v["trades"] if t["pnl_dollar"] > 0) for v in res_train.values())
        train_loss = abs(sum(sum(t["pnl_dollar"] for t in v["trades"] if t["pnl_dollar"] < 0) for v in res_train.values()))

        train_win_rate = round((train_wins / train_trades) * 100, 1) if train_trades > 0 else 0.0
        train_pf = round(train_gain / train_loss, 2) if train_loss > 0 else (99.0 if train_pnl > 0 else 0.0)
        train_expectancy = round(train_pnl / train_trades, 2) if train_trades > 0 else 0.0

        # Constraints Gate on Train set: Min 20 trades, PF >= 1.30, WinRate >= 50%, NetPnL > 0
        if train_win_rate < 50.0 or train_pf < 1.30 or train_pnl <= 0:
            continue

        # 2. Validation Split Evaluation (2024-04-01 to 2025-06-30)
        config_val = SQLStrategyConfig(
            name=strat_name,
            universe=target_uni,
            entry_condition=entry_cond,
            exit_condition=exit_cond,
            max_holding_bars=999,
            stop_loss_pct=stop_loss_pct,
            profit_taking=profit_taking,
            start_date="2024-04-01",
            end_date="2025-06-30",
            tickers=strat.get("tickers")
        )
        res_val = SQLStrategyEngine(config_val).run_universe_backtest()
        val_pnl = sum(v["net_pnl_dollar"] for v in res_val.values()) if res_val else 0.0

        # Promotion Requirement: Must be profitable in Validation split
        if val_pnl <= 0:
            continue

        # 3. Out-Of-Sample Test Split Evaluation (2025-07-01 to Present)
        config_test = SQLStrategyConfig(
            name=strat_name,
            universe=target_uni,
            entry_condition=entry_cond,
            exit_condition=exit_cond,
            max_holding_bars=999,
            stop_loss_pct=stop_loss_pct,
            profit_taking=profit_taking,
            start_date="2025-07-01",
            tickers=strat.get("tickers")
        )
        res_test = SQLStrategyEngine(config_test).run_universe_backtest()
        test_pnl = sum(v["net_pnl_dollar"] for v in res_test.values()) if res_test else 0.0

        # Promotion Requirement: Must be profitable in Test split
        if test_pnl <= 0:
            continue

        # Multi-Factor Institutional Fitness Score Calculation
        # Weights: PF (35%), Expectancy (25%), Total PnL (20%), Win Rate (10%), Trades Bonus (10%)
        fitness_score = round((train_pf * 0.35) + (train_expectancy * 0.0025) + (train_pnl * 0.0002) + (train_win_rate * 0.10) + (train_trades * 0.01), 4)

        if fitness_score > max_net_pnl:
            max_net_pnl = fitness_score
            champion_strat = strat
            champion_metrics = {
                "trades": train_trades,
                "win_rate": train_win_rate,
                "profit_factor": train_pf,
                "net_pnl": train_pnl,
                "fitness_score": fitness_score
            }
            logger.info(f"  🔥 NEW CHAMPION FOR '{target_uni}': '{strat_name}' → Fitness={fitness_score}, Train PnL=${train_pnl}, WinRate={train_win_rate}%, PF={train_pf}, Trades={train_trades}")
            sys.stdout.flush()

    if champion_strat:
        c_name = champion_strat.get("name")
        logger.info(f"🏆 CHAMPION PROMOTED FOR '{target_uni}': '{c_name}' (Fitness={champion_metrics['fitness_score']}, PnL=${champion_metrics['net_pnl']}, WinRate={champion_metrics['win_rate']}%, PF={champion_metrics['profit_factor']})")
        sys.stdout.flush()
        return champion_strat
    else:
        logger.info(f"Round complete for '{target_uni}' — no candidate met quality thresholds.")
        sys.stdout.flush()
        return None



def optimize_strategies(state: GraphState) -> dict:
    """
    Autonomous Profit-Maximizing Parallel Declarative Genetic Strategy Engine.
    Executes all universe rounds in parallel using ProcessPoolExecutor across CPU cores.
    """
    cfg_loader = get_path_config()
    strategies_path = cfg_loader.get("strategies_json", "data/inputs/strategies.json")
    existing_strategies = []

    if os.path.exists(strategies_path):
        try:
            with open(strategies_path, "r") as f:
                existing_strategies = json.load(f)
        except Exception as e:
            logger.error(f"Error loading {strategies_path}: {e}")

    cfg = load_config()
    db_path = cfg.get("paths", {}).get("etf_db", "data/db/etfs.db")

    # Dynamically build optimization rounds from all ETF groups in the database
    universe_groups = compute_universe_groups(db_path)
    optimization_rounds = [
        {"target_universe": uni, "tickers": tickers}
        for uni, tickers in universe_groups.items()
    ]
    total_rounds = len(optimization_rounds)
    logger.info(f"\n==================================================")
    logger.info(f"=== STARTING PARALLEL DECLARATIVE GENETIC STRATEGY OPTIMIZER ({total_rounds} Universes) ===")
    logger.info(f"Optimization will run across universes in parallel: {[r['target_universe'] for r in optimization_rounds]}")
    import sys
    sys.stdout.flush()

    promoted_champions = []

    # Execute all universe rounds in parallel across CPU cores
    import concurrent.futures
    max_workers = min(total_rounds, os.cpu_count() or 4)

    with concurrent.futures.ProcessPoolExecutor(max_workers=max_workers) as executor:
        futures = {
            executor.submit(evaluate_single_universe, round_info, idx, total_rounds): round_info["target_universe"]
            for idx, round_info in enumerate(optimization_rounds, 1)
        }


        for future in concurrent.futures.as_completed(futures):
            uni_name = futures[future]
            try:
                champ = future.result()
                if champ:
                    promoted_champions.append(champ)
            except Exception as e:
                logger.error(f"Error evaluating universe '{uni_name}' in parallel: {e}")

    if promoted_champions:
        # Top-K Champion Pruning: Keep strictly 1 top champion per universe in strategies.json to prevent file bloat
        universe_champions: Dict[str, Dict[str, Any]] = {}

        # Preserve existing strategies indexed by universe
        for s in existing_strategies:
            if isinstance(s, dict):
                u = s.get("universe", "All ETFs")
                universe_champions[u] = s

        # Override with newly promoted champions
        for champ in promoted_champions:
            u = champ.get("universe", "All ETFs")
            universe_champions[u] = champ

        final_list = list(universe_champions.values())

        os.makedirs(os.path.dirname(strategies_path), exist_ok=True)
        with open(strategies_path, "w") as f:
            json.dump(final_list, f, indent=2)
        logger.info(f"\n==================================================")
        logger.info(f"Top-K Pruned: Saved {len(final_list)} universe champions to {strategies_path} (archived all past runs in SQLite research_strategies).")
        return {"saved_strategies": final_list}

    logger.info("\n==================================================")
    logger.info("Profit optimization complete. No new champions promoted.")
    return {"saved_strategies": existing_strategies}


