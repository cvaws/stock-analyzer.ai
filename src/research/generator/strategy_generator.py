"""
Algorithmic Strategy Generator for StockWave Evolutionary Research Engine.
Generates valid, candidate StrategyGenome instances combinatorially without LLM dependency.
"""
import random
import uuid
from typing import List, Optional
from research.models.rules import Rule, RuleCategory, RuleOperator
from research.models.strategy import StrategyGenome, RiskConfig, ProfitTrimStep

# Standard Building Block Rules
TREND_RULES = [
    Rule("tr_ema8_21", RuleCategory.TREND, "ema_8", RuleOperator.GT, "ema_21"),
    Rule("tr_ema13_21", RuleCategory.TREND, "ema_13", RuleOperator.GT, "ema_21"),
    Rule("tr_close_ema21", RuleCategory.TREND, "close", RuleOperator.GT, "ema_21"),
    Rule("tr_close_sma50", RuleCategory.TREND, "close", RuleOperator.GT, "sma_50"),
    Rule("tr_ema21_sma50", RuleCategory.TREND, "ema_21", RuleOperator.GT, "sma_50"),
    Rule("tr_close_ema65", RuleCategory.TREND, "close", RuleOperator.GT, "ema_65"),
]

RS_RULES = [
    Rule("rs_daily_pos", RuleCategory.RELATIVE_STRENGTH, "mrs_daily_index", RuleOperator.GTE, 0.0),
    Rule("rs_daily_strong", RuleCategory.RELATIVE_STRENGTH, "mrs_daily_index", RuleOperator.GTE, 0.15),
    Rule("rs_weekly_pos", RuleCategory.RELATIVE_STRENGTH, "mrs_weekly_index", RuleOperator.GTE, 0.0),
    Rule("rs_weekly_strong", RuleCategory.RELATIVE_STRENGTH, "mrs_weekly_index", RuleOperator.GTE, 0.10),
    Rule("rs_return_20d", RuleCategory.RELATIVE_STRENGTH, "return_20d_pct", RuleOperator.GT, 5.0),
]

MOMENTUM_RULES = [
    Rule("mom_rsi50", RuleCategory.MOMENTUM, "rsi_14", RuleOperator.GT, 50),
    Rule("mom_rsi_range", RuleCategory.MOMENTUM, "rsi_14", RuleOperator.BETWEEN, (40, 65)),
    Rule("mom_vol_ratio", RuleCategory.MOMENTUM, "vol_ratio", RuleOperator.GT, 1.2),
    Rule("mom_vol_ma20", RuleCategory.MOMENTUM, "vol_ma20_ratio", RuleOperator.GT, 1.1),
    Rule("mom_atr_pct", RuleCategory.MOMENTUM, "atr14_pct", RuleOperator.GT, 1.5),
]

MARKET_FILTER_RULES = [
    Rule("mf_regime_gas_half", RuleCategory.MARKET_FILTER, "r.regime_code", RuleOperator.IN, ["PRESS_GAS", "HALF_SIZE"]),
    Rule("mf_regime_half_only", RuleCategory.MARKET_FILTER, "r.regime_code", RuleOperator.EQ, "'HALF_SIZE'"),
]

EXIT_RULES = [
    Rule("ex_close_ema21", RuleCategory.EXIT, "close", RuleOperator.LT, "ema_21"),
    Rule("ex_close_ema13", RuleCategory.EXIT, "close", RuleOperator.LT, "ema_13"),
    Rule("ex_step_aside", RuleCategory.EXIT, "r.regime_code", RuleOperator.EQ, "'STEP_ASIDE'"),
    Rule("ex_mrs_neg", RuleCategory.EXIT, "mrs_daily_index", RuleOperator.LT, 0.0),
]



class StrategyGenerator:
    """
    Programmatically assembles candidate StrategyGenomes by picking building block rules
    across trend, relative strength, momentum, market filters, risk, and profit targets.
    """

    @staticmethod
    def generate_random_genome(universe: str = "All ETFs", generation: int = 0) -> StrategyGenome:
        """Assembles a valid, novel StrategyGenome from standard rule pools."""
        trend = random.sample(TREND_RULES, k=random.randint(1, 2))
        rs = random.sample(RS_RULES, k=random.randint(1, 2))
        mom = random.sample(MOMENTUM_RULES, k=random.randint(0, 1))
        mf = [random.choice(MARKET_FILTER_RULES)]
        ex = random.sample(EXIT_RULES, k=random.randint(1, 2))

        stop_loss = random.choice([0.03, 0.05, 0.07])
        trims = random.choice([
            [ProfitTrimStep(0.15, 0.20), ProfitTrimStep(0.30, 0.20)],
            [ProfitTrimStep(0.20, 0.20), ProfitTrimStep(0.35, 0.20), ProfitTrimStep(0.50, 0.20)],
            [ProfitTrimStep(0.25, 0.25), ProfitTrimStep(0.50, 0.25)],
        ])

        genome_id = str(uuid.uuid4())[:8]
        name = f"Generated {universe} Strategy [{genome_id}]"

        return StrategyGenome(
            id=genome_id,
            name=name,
            universe=universe,
            entry_rules=trend + rs + mom,
            exit_rules=ex,
            market_filter_rules=mf,
            risk_config=RiskConfig(stop_loss_pct=stop_loss),
            profit_trim_steps=trims,
            generation_number=generation,
            origin_type="seed",
        )
