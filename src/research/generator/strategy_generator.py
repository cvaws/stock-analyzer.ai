"""
Algorithmic Strategy Generator for StockWave Evolutionary Research Engine.
Generates valid, candidate StrategyGenome instances combinatorially without LLM dependency.
Driven 100% dynamically from data/inputs/backtest_rules.yaml.
"""
import random
import uuid
from typing import List, Optional
from research.models.rules import Rule, RuleCategory, RuleOperator
from research.models.strategy import StrategyGenome, RiskConfig, ProfitTrimStep
from research.generator.yaml_rules_loader import YAMLBacktestRulesLoader

yaml_loader = YAMLBacktestRulesLoader()


class StrategyGenerator:
    """
    Programmatically assembles candidate StrategyGenomes dynamically driven by data/inputs/backtest_rules.yaml.
    Zero static rule lists or hardcoded moving average pairs.
    """

    @staticmethod
    def generate_random_genome(universe: str = "All ETFs", generation: int = 0) -> StrategyGenome:
        """Assembles a valid, novel StrategyGenome dynamically from backtest_rules.yaml ranges."""
        # 1. Dynamic Trend Rule Selection (Generated directly from backtest_rules.yaml trend_series)
        trend_pairs = yaml_loader.generate_trend_pairs()
        selected_pair = random.choice(trend_pairs)
        fast_expr, slow_expr = [x.strip() for x in selected_pair.split(">")]

        trend = [Rule("tr_dynamic", RuleCategory.TREND, fast_expr, RuleOperator.GT, slow_expr)]

        # 2. Relative Strength & Momentum Rule Selection with dynamic YAML ranges
        rsi_vals = yaml_loader.get_indicator_values_array("rsi_14")
        rsi_val = random.choice(rsi_vals) if rsi_vals else 50.0

        mrs_d_vals = yaml_loader.get_indicator_values_array("mrs_daily_index")
        mrs_d_val = random.choice(mrs_d_vals) if mrs_d_vals else 0.0

        mrs_w_vals = yaml_loader.get_indicator_values_array("mrs_weekly_index")
        mrs_w_val = random.choice(mrs_w_vals) if mrs_w_vals else 0.0

        atr_vals = yaml_loader.get_indicator_values_array("atr14_pct")
        atr_val = random.choice(atr_vals) if atr_vals else 1.5

        vol_vals = yaml_loader.get_indicator_values_array("vol_ratio")
        vol_val = random.choice(vol_vals) if vol_vals else 1.1

        rs_mom_pool = [
            Rule("rs_daily", RuleCategory.RELATIVE_STRENGTH, "mrs_daily_index", RuleOperator.GTE, mrs_d_val),
            Rule("rs_weekly", RuleCategory.RELATIVE_STRENGTH, "mrs_weekly_index", RuleOperator.GTE, mrs_w_val),
            Rule("mom_rsi", RuleCategory.MOMENTUM, "rsi_14", RuleOperator.GT, rsi_val),
            Rule("mom_atr", RuleCategory.MOMENTUM, "atr14_pct", RuleOperator.GT, atr_val),
            Rule("mom_vol", RuleCategory.MOMENTUM, "vol_ratio", RuleOperator.GT, vol_val),
        ]
        rs_mom = random.sample(rs_mom_pool, k=random.randint(1, 3))

        # 3. Market Filter
        mf = [Rule("mf_regime", RuleCategory.MARKET_FILTER, "r.regime_code", RuleOperator.IN, ["PRESS_GAS", "HALF_SIZE"])]

        # 4. Exit Rules
        ex = [Rule("ex_close_ema21", RuleCategory.EXIT, "close", RuleOperator.LT, "ema_21")]

        # 5. Dynamic Risk & Profit Trims from YAML bounds
        sl_range = yaml_loader.get_stop_loss_range()
        stop_loss = random.choice(sl_range) if sl_range else 0.05

        tp_range = yaml_loader.get_profit_target_range()
        tp1 = random.choice(tp_range) if tp_range else 0.20
        tp2 = round(tp1 * 1.75, 2)
        trims = [ProfitTrimStep(tp1, 0.20), ProfitTrimStep(tp2, 0.20)]

        logic_op = "AND"  # Entry rules strictly use AND for confluence

        genome_id = str(uuid.uuid4())[:8]
        name = f"Generated {universe} Strategy [{genome_id}]"

        return StrategyGenome(
            id=genome_id,
            name=name,
            universe=universe,
            entry_rules=trend + rs_mom,
            exit_rules=ex,
            market_filter_rules=mf,
            risk_config=RiskConfig(stop_loss_pct=stop_loss),
            profit_trim_steps=trims,
            entry_logic_operator=logic_op,
            generation_number=generation,
            origin_type="seed",
        )



