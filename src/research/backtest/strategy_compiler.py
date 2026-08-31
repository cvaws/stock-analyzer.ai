"""
Strategy Compiler for StockWave Evolutionary Research Engine.

Compiles a structured StrategyGenome into SQL entry and exit condition strings
compatible with SQLStrategyEngine.
"""
from typing import Dict, Any, List
from research.models.rules import Rule, RuleOperator
from research.models.strategy import StrategyGenome


class StrategyCompiler:
    """
    Translates structured Rule objects inside a StrategyGenome into valid SQL expressions
    that can be executed against the SQLite indicators database.
    """

    @staticmethod
    def compile_rule(rule: Rule) -> str:
        """Compiles a single Rule object into a SQL condition string."""
        if not rule.enabled:
            return ""

        op = rule.operator.value
        right = rule.right_operand

        if rule.operator == RuleOperator.IN:
            if isinstance(right, (list, tuple, set)):
                formatted = ", ".join(f"'{v}'" if isinstance(v, str) else str(v) for v in right)
                return f"{rule.left_operand} IN ({formatted})"
            return f"{rule.left_operand} IN ({right})"

        elif rule.operator == RuleOperator.BETWEEN:
            if isinstance(right, (list, tuple)) and len(right) == 2:
                return f"{rule.left_operand} BETWEEN {right[0]} AND {right[1]}"
            return f"{rule.left_operand} BETWEEN {right}"

        elif isinstance(right, str):
            # String comparison or identifier comparison
            if right.startswith("'") and right.endswith("'"):
                return f"{rule.left_operand} {op} {right}"
            elif right.isalpha() or "_" in right or "." in right:
                return f"{rule.left_operand} {op} {right}"
            else:
                return f"{rule.left_operand} {op} '{right}'"
        else:
            return f"{rule.left_operand} {op} {right}"

    @classmethod
    def compile_entry_condition(cls, genome: StrategyGenome) -> str:
        """
        Combines enabled entry_rules using genome.entry_logic_operator ('AND' or 'OR'),
        and joins market_filter_rules using mandatory 'AND'.
        """
        entry_conds = [cls.compile_rule(r) for r in genome.entry_rules if r.enabled and cls.compile_rule(r)]
        mf_conds = [cls.compile_rule(r) for r in genome.market_filter_rules if r.enabled and cls.compile_rule(r)]

        # Entry rules strictly use AND for confluence
        op = " AND "

        if entry_conds:
            entry_str = f"({op.join(entry_conds)})"
        else:
            entry_str = "1=1"


        if mf_conds:
            mf_str = " AND ".join(mf_conds)
            return f"{entry_str} AND {mf_str}"

        return entry_str


    @classmethod
    def compile_exit_condition(cls, genome: StrategyGenome) -> str:
        """
        Combines all enabled exit_rules into a single SQL OR-expression.
        """
        enabled_rules = [r for r in genome.exit_rules if r.enabled]
        conditions = [cls.compile_rule(r) for r in enabled_rules if cls.compile_rule(r)]
        if not conditions:
            return "close < ema_21"
        return " OR ".join(conditions)

    @classmethod
    def compile_to_sql_config_dict(cls, genome: StrategyGenome) -> Dict[str, Any]:
        """
        Produces a dictionary compatible with SQLStrategyConfig constructor kwargs.
        """
        profit_taking = [
            {
                "profit_target_pct": step.profit_target_pct,
                "position_trim_pct": step.position_trim_pct
            }
            for step in genome.profit_trim_steps
        ]

        return {
            "name": genome.name,
            "universe": genome.universe,
            "entry_condition": cls.compile_entry_condition(genome),
            "exit_condition": cls.compile_exit_condition(genome),
            "stop_loss_pct": genome.risk_config.stop_loss_pct,
            "profit_taking": profit_taking,
        }
