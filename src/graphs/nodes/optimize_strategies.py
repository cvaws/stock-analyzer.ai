import os
import json
import logging
import re
import sqlite3
from typing import Dict, Any, List, Optional, Tuple
from langchain_ollama import ChatOllama
from graphs.state import GraphState
from strategy.backtest_engine import SQLStrategyEngine, SQLStrategyConfig
from config_loader import load_config

logger = logging.getLogger(__name__)

LLM_RULES_PATH = "data/inputs/llm_rules.json"


def clean_json_text(text: str) -> str:
    """Extracts JSON array or object string from LLM response text."""
    text = text.strip()
    match = re.search(r"(\[.*\]|\{.*\})", text, re.DOTALL)
    if match:
        return match.group(1)
    return text


def load_llm_rules() -> Dict[str, Any]:
    """Loads static LLM rules and constraints from data/inputs/llm_rules.json."""
    if os.path.exists(LLM_RULES_PATH):
        try:
            with open(LLM_RULES_PATH, "r") as f:
                rules = json.load(f)
            logger.info(f"Loaded LLM rules from {LLM_RULES_PATH} (version {rules.get('version', 'unknown')})")
            return rules
        except Exception as e:
            logger.error(f"Failed to load {LLM_RULES_PATH}: {e}. Using empty rules.")
    else:
        logger.warning(f"{LLM_RULES_PATH} not found. Using empty LLM rules.")
    return {}


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


def build_prompt(
    target_uni: str,
    universe_tickers: List[str],
    llm_rules: Dict[str, Any],
    regime_ctx: Dict[str, Any],
    zero_trade_recovery: bool = False,
) -> str:
    """
    Builds the full LLM prompt from llm_rules.json (static) + live regime distribution (dynamic).
    All context that reaches the LLM comes from llm_rules.json or computed SQLite facts.
    """
    # --- Static rules from llm_rules.json ---
    entry_guidance = llm_rules.get("entry_guidance", {})
    preferred_baseline = entry_guidance.get("preferred_baseline", [])
    avoid_conditions = entry_guidance.get("avoid_conditions", [])
    universe_hints = llm_rules.get("universe_hints", {})
    # Use universe-specific hint if it exists, otherwise fall back to _default
    universe_hint = universe_hints.get(target_uni, universe_hints.get("_default", ""))
    hard_exit = llm_rules.get("exit_rules", {}).get("always_require", "close < ema_21 OR r.regime_code = 'STEP_ASIDE'")
    recovery_msg = llm_rules.get("zero_trade_recovery", {}).get("message", "") if zero_trade_recovery else ""

    # --- Dynamic: live tickers for this universe from SQLite ---
    tickers_str = ", ".join(universe_tickers) if universe_tickers else "(see database)"

    # --- Dynamic facts from SQLite ---
    dist = regime_ctx.get("distribution", {})
    date_start = regime_ctx.get("date_range_start", "unknown")
    date_end = regime_ctx.get("date_range_end", "unknown")
    total_days = regime_ctx.get("total_trading_days", 0)

    regime_lines = []
    for code, stats in dist.items():
        regime_lines.append(f"  - {code}: {stats['pct']}% of days ({stats['count']} of {total_days} trading days)")
    regime_summary = "\n".join(regime_lines) if regime_lines else "  - No regime data available."

    preferred_str = "\n".join(f"  - {c}" for c in preferred_baseline)
    avoid_str = "\n".join(f"  - {c}" for c in avoid_conditions)

    prompt = f"""
You are an expert quantitative ETF trading strategy researcher.
Formulate 3 to 5 distinct, high-probability technical trading strategies for the ETF universe: '{target_uni}'.

{"⚠️  " + recovery_msg if recovery_msg else ""}

UNIVERSE: '{target_uni}'
CURRENT ETFs IN THIS UNIVERSE (loaded live from database — this list may expand over time):
  {tickers_str}

UNIVERSE STRATEGY CONTEXT:
{universe_hint}

LIVE MARKET REGIME DISTRIBUTION (from actual database: {date_start} to {date_end}, {total_days} trading days):
{regime_summary}
IMPORTANT: Design your entry conditions to be compatible with the above regime distribution. Strategies requiring rare regimes will produce 0 trades.

MANDATORY EXIT RULE (always guaranteed — do not omit):
  All strategies will have this exit enforced: {hard_exit}
  Your exit_rules may add additional conditions, but this exit is always present.

PREFERRED ENTRY BASELINE (use these as starting filters, then layer additional conditions):
{preferred_str}

CONDITIONS TO AVOID:
{avoid_str}

AVAILABLE INDICATOR COLUMNS IN SQL BACKTEST ENGINE:
- Joined Market Regime Table (`r`):
  - `r.regime_code` IN ('PRESS_GAS', 'HALF_SIZE', 'STEP_ASIDE')
  - `r.confidence` (0.0 to 100.0)
- Technical Indicators (`i` & `o`):
  - `ema_8`, `ema_21`, `sma_50`, `sma_200`, `close`, `high`, `low`
  - `mrs_daily_index` (Mansfield RS vs SPY daily — >= 0.0 means outperforming SPY)
  - `mrs_weekly_index` (Mansfield RS vs SPY weekly)
  - `rsi_14` (RSI 14-period)
  - `vol_ratio` (Volume / 20-day avg volume)
  - `pct_off_52wk_high` (0.0 = at 52W high, -5.0 = 5% off 52W high)
  - `pct_off_52wk_low` (0.0 = at 52W low, 10.0 = 10% above 52W low)

CRITICAL OUTPUT RULES:
1. `universe` MUST be exactly '{target_uni}'.
2. All entry/exit conditions MUST be valid SQL boolean expressions.
3. Output MUST be a raw JSON array — NO markdown code blocks or extra text around it.

JSON FORMAT:
[
  {{
    "name": "Descriptive Strategy Name",
    "universe": "{target_uni}",
    "risk_management": {{ "stop_loss_pct": 0.05 }},
    "profit_taking": [
      {{ "profit_target_pct": 0.15, "position_trim_pct": 0.20 }},
      {{ "profit_target_pct": 0.30, "position_trim_pct": 0.20 }}
    ],
    "entry_rules": [
      {{ "conditions": "ema_8 > ema_21 AND rsi_14 BETWEEN 30 AND 70 AND mrs_daily_index >= 0.0 AND r.regime_code IN ('PRESS_GAS', 'HALF_SIZE')" }}
    ],
    "exit_rules": [
      {{ "conditions": "close < ema_21 OR r.regime_code = 'STEP_ASIDE'" }}
    ]
  }}
]
"""
    return prompt.strip()


# Parameter grid variations for multi-generation optimization
STOP_LOSS_VARIATIONS = [0.03, 0.05, 0.07, 0.08]

PROFIT_TAKING_VARIATIONS = [
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


def generate_parameter_variants(base_strat: Dict[str, Any], llm_rules: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Generates parameter-tuned variants of a base strategy hypothesis with hard exit injection."""
    variants = []
    base_name = base_strat.get("name", "Strategy")
    base_entry = base_strat.get("entry_rules", [{}])[0].get("conditions", "ema_8 > ema_21")
    base_exit_raw = base_strat.get("exit_rules", [{}])[0].get("conditions", "close < ema_21")
    base_exit = inject_exit_rule(llm_rules, base_exit_raw)
    universe = base_strat.get("universe", "All ETFs")

    v_idx = 1
    for stop_loss in STOP_LOSS_VARIATIONS:
        for pt_plan in PROFIT_TAKING_VARIATIONS:
            variant_name = f"{base_name} [Opt-v{v_idx} SL={int(stop_loss*100)}%]"
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

    llm = ChatOllama(model=model_name, temperature=0.3)
    promoted_champions = []

    for round_idx, round_info in enumerate(optimization_rounds, 1):
        target_uni = round_info["target_universe"]
        universe_tickers = round_info["tickers"]

        logger.info(f"\n==================================================")
        logger.info(f"🏆 OPTIMIZATION ROUND {round_idx}/{len(optimization_rounds)}: UNIVERSE '{target_uni}' ({len(universe_tickers)} ETFs)")

        zero_trade_recovery = False
        base_candidates = []

        # Attempt LLM hypothesis generation (with one zero-trade recovery retry)
        for attempt in range(1, 3):
            prompt = build_prompt(target_uni, universe_tickers, llm_rules, regime_ctx, zero_trade_recovery=zero_trade_recovery)
            try:
                logger.info(f"Formulating hypotheses (attempt {attempt}) using '{model_name}'...")
                response = llm.invoke(prompt)
                raw_content = response.content if hasattr(response, "content") else str(response)
                cleaned = clean_json_text(raw_content)
                parsed = json.loads(cleaned)
                if isinstance(parsed, list) and parsed:
                    base_candidates = parsed
                    logger.info(f"Received {len(base_candidates)} base hypotheses for '{target_uni}'.")
                    break
            except Exception as e:
                logger.warning(f"LLM hypothesis generation attempt {attempt} for '{target_uni}' failed ({e}).")

        if not base_candidates:
            logger.warning(f"No LLM hypotheses for '{target_uni}'. Using fallback template.")
            base_candidates = [{
                "name": f"{target_uni} Momentum Trend Fallback",
                "universe": target_uni,
                "risk_management": {"stop_loss_pct": 0.05},
                "profit_taking": [{"profit_target_pct": 0.20, "position_trim_pct": 0.20}],
                "entry_rules": [{"conditions": "ema_8 > ema_21 AND rsi_14 BETWEEN 30 AND 70 AND mrs_daily_index >= 0.0 AND r.regime_code IN ('PRESS_GAS', 'HALF_SIZE')"}],
                "exit_rules": [{"conditions": "close < ema_21 OR r.regime_code = 'STEP_ASIDE'"}]
            }]

        # Hard-inject mandatory exit rule from llm_rules.json into each base candidate
        for cand in base_candidates:
            raw_exit = cand.get("exit_rules", [{}])[0].get("conditions", "")
            cand["exit_rules"] = [{"conditions": inject_exit_rule(llm_rules, raw_exit)}]

        # Build full parameter sweep grid
        full_evaluation_queue: List[Dict[str, Any]] = []
        for b_strat in base_candidates:
            full_evaluation_queue.append(b_strat)
            full_evaluation_queue.extend(generate_parameter_variants(b_strat, llm_rules))

        logger.info(f"Evaluating {len(full_evaluation_queue)} parameter combinations for '{target_uni}'...")

        champion_strat: Optional[Dict[str, Any]] = None
        max_net_pnl = -999999.0
        champion_metrics: Dict[str, Any] = {}
        all_zero_trades = True

        for eval_idx, strat in enumerate(full_evaluation_queue, 1):
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

            config = SQLStrategyConfig(
                name=strat_name,
                universe=target_uni,
                entry_condition=entry_cond,
                exit_condition=exit_cond,
                max_holding_bars=20,
                stop_loss_pct=stop_loss_pct,
                profit_taking=profit_taking,
                tickers=strat.get("tickers")
            )

            engine = SQLStrategyEngine(config)
            backtest_res = engine.run_universe_backtest()

            if backtest_res:
                total_trades = sum(v["total_trades"] for v in backtest_res.values())
                if total_trades > 0:
                    all_zero_trades = False

                total_wins = sum(sum(1 for t in v["trades"] if t["pnl_pct"] > 0) for v in backtest_res.values())
                net_pnl = round(sum(v["net_pnl_dollar"] for v in backtest_res.values()), 2)

                total_gross_gain = sum(sum(t["pnl_dollar"] for t in v["trades"] if t["pnl_dollar"] > 0) for v in backtest_res.values())
                total_gross_loss = abs(sum(sum(t["pnl_dollar"] for t in v["trades"] if t["pnl_dollar"] < 0) for v in backtest_res.values()))

                win_rate = round((total_wins / total_trades) * 100, 1) if total_trades > 0 else 0.0
                profit_factor = round(total_gross_gain / total_gross_loss, 2) if total_gross_loss > 0 else (99.0 if net_pnl > 0 else 0.0)

                # Quality Filters: Trades >= 5, WinRate >= 50%, ProfitFactor >= 1.3, max NetPnL
                if total_trades >= 5 and win_rate >= 50.0 and profit_factor >= 1.3 and net_pnl > max_net_pnl:
                    max_net_pnl = net_pnl
                    champion_strat = strat
                    champion_metrics = {
                        "trades": total_trades,
                        "win_rate": win_rate,
                        "profit_factor": profit_factor,
                        "net_pnl": net_pnl
                    }
                    logger.info(f"  🔥 NEW CHAMPION FOR '{target_uni}': '{strat_name}' → PnL=${net_pnl}, WinRate={win_rate}%, PF={profit_factor}, Trades={total_trades}")

        # If all candidates produced 0 trades, flag for zero-trade recovery on retry
        if all_zero_trades:
            logger.warning(f"  ⚠️  ALL hypotheses for '{target_uni}' produced 0 trades. Zero-trade recovery context from llm_rules.json will be used on retry.")
            zero_trade_recovery = True

        if champion_strat:
            c_name = champion_strat.get("name")
            logger.info(f"🏆 ROUND {round_idx} CHAMPION FOR '{target_uni}': '{c_name}' (PnL=${champion_metrics['net_pnl']}, WinRate={champion_metrics['win_rate']}%, PF={champion_metrics['profit_factor']})")
            promoted_champions.append(champion_strat)
        else:
            logger.info(f"Round {round_idx} for '{target_uni}' complete — no candidate met quality thresholds.")

    if promoted_champions:
        existing_names = {s.get("name") for s in existing_strategies if isinstance(s, dict)}
        final_list = list(existing_strategies)
        for champ in promoted_champions:
            c_name = champ.get("name")
            if c_name not in existing_names:
                final_list.append(champ)
                existing_names.add(c_name)

        os.makedirs(os.path.dirname(strategies_path), exist_ok=True)
        with open(strategies_path, "w") as f:
            json.dump(final_list, f, indent=2)
        logger.info(f"\n==================================================")
        logger.info(f"Auto-saved {len(promoted_champions)} Profit-Maximizing Champion Strategies to {strategies_path}.")
        return {"saved_strategies": final_list}

    logger.info("\n==================================================")
    logger.info("Profit optimization complete. No new champions promoted.")
    return {"saved_strategies": existing_strategies}
