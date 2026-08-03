"""
Genetic Mutation & Crossover Engines for StockWave Evolutionary Research Engine.
"""
import copy
import random
import uuid
from typing import Dict, Any, Tuple
from research.models.rules import Rule, RuleCategory, RuleOperator
from research.models.strategy import StrategyGenome, RiskConfig, ProfitTrimStep


class MutationEngine:
    """
    Applies genetic mutations to a StrategyGenome:
    - Threshold shifts (e.g. stop loss 3% -> 5%, RSI 50 -> 55)
    - Operator changes (e.g. > to >=)
    - Rule additions/removals
    """

    @staticmethod
    def mutate(parent: StrategyGenome) -> StrategyGenome:
        child = copy.deepcopy(parent)
        child.id = str(uuid.uuid4())[:8]
        child.parent_strategy_id = parent.id
        child.generation_number = parent.generation_number + 1
        child.origin_type = "mutation"
        child.name = f"{parent.name} [Mut-Gen{child.generation_number}]"

        mutation_type = random.choice(["stop_loss", "numeric_threshold", "profit_target", "rule_swap", "logic_operator"])
        details = {}

        if mutation_type == "stop_loss":
            old_sl = child.risk_config.stop_loss_pct or 0.05
            # Granular mutation: step by +0.5% or -0.5% (bounded between 2% and 10%)
            delta = random.choice([-0.005, 0.005])
            new_sl = round(max(0.02, min(0.10, old_sl + delta)), 3)
            child.risk_config.stop_loss_pct = new_sl
            details = {"type": "stop_loss", "from": old_sl, "to": new_sl, "delta": delta}

        elif mutation_type == "numeric_threshold":
            for r in child.entry_rules:
                if isinstance(r.right_operand, (int, float)):
                    old_val = r.right_operand
                    # Granular mutation: step by +1 or -1
                    delta = random.choice([-1, 1])
                    new_val = old_val + delta
                    if r.left_operand == "rsi_14":
                        new_val = max(30, min(75, new_val))
                    r.right_operand = new_val
                    details = {"type": "numeric_threshold", "rule_id": r.id, "operand": r.left_operand, "from": old_val, "to": new_val, "delta": delta}
                    break

        elif mutation_type == "profit_target":
            if child.profit_trim_steps:
                idx = random.randint(0, len(child.profit_trim_steps) - 1)
                old_target = child.profit_trim_steps[idx].profit_target_pct
                # Granular mutation: step by +5% or -5% (bounded between 5% and 80%)
                delta = random.choice([-0.05, 0.05])
                new_target = round(max(0.05, min(0.80, old_target + delta)), 2)
                child.profit_trim_steps[idx].profit_target_pct = new_target
                details = {"type": "profit_target", "step_index": idx, "from": old_target, "to": new_target, "delta": delta}

        elif mutation_type == "rule_swap":
            # Add or disable a rule
            if child.entry_rules:
                idx = random.randint(0, len(child.entry_rules) - 1)
                child.entry_rules[idx].enabled = not child.entry_rules[idx].enabled
                details = {"type": "rule_toggle", "rule_id": child.entry_rules[idx].id, "enabled": child.entry_rules[idx].enabled}

        elif mutation_type == "logic_operator":
            old_op = child.entry_logic_operator
            new_op = "OR" if old_op == "AND" else "AND"
            child.entry_logic_operator = new_op
            details = {"type": "logic_operator", "from": old_op, "to": new_op}

        child.mutation_details = details
        return child



class CrossoverEngine:
    """
    Recombines genes from two parent StrategyGenomes to produce a child StrategyGenome.
    """

    @staticmethod
    def crossover(parent_a: StrategyGenome, parent_b: StrategyGenome) -> StrategyGenome:
        child_id = str(uuid.uuid4())[:8]
        max_gen = max(parent_a.generation_number, parent_b.generation_number) + 1

        child = StrategyGenome(
            id=child_id,
            name=f"Crossover [{parent_a.id} x {parent_b.id}]",
            universe=parent_a.universe,
            entry_rules=copy.deepcopy(parent_a.entry_rules),
            exit_rules=copy.deepcopy(parent_b.exit_rules),
            market_filter_rules=copy.deepcopy(parent_a.market_filter_rules),
            risk_config=copy.deepcopy(parent_b.risk_config),
            profit_trim_steps=copy.deepcopy(parent_a.profit_trim_steps),
            parent_strategy_id=f"{parent_a.id},{parent_b.id}",
            generation_number=max_gen,
            origin_type="crossover",
            mutation_details={"parents": [parent_a.id, parent_b.id]}
        )
        return child
