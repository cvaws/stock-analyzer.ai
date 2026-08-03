"""
Strategy Genome and Risk Domain Models for StockWave Evolutionary Research Engine.
"""
import uuid
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional
from research.models.rules import Rule


@dataclass
class RiskConfig:
    stop_loss_pct: Optional[float] = 0.05  # e.g. 0.05 = 5%


@dataclass
class ProfitTrimStep:
    profit_target_pct: float             # e.g. 0.25 = 25% gain
    position_trim_pct: float             # e.g. 0.25 = trim 25% of position


@dataclass
class StrategyGenome:
    """
    Represents structured strategy DNA composed of typed rule genes and risk metadata.
    """
    id: str = field(default_factory=lambda: str(uuid.uuid4())[:8])
    name: str = "Custom Strategy"
    universe: str = "All ETFs"
    entry_rules: List[Rule] = field(default_factory=list)
    exit_rules: List[Rule] = field(default_factory=list)
    market_filter_rules: List[Rule] = field(default_factory=list)
    risk_config: RiskConfig = field(default_factory=RiskConfig)
    profit_trim_steps: List[ProfitTrimStep] = field(default_factory=list)
    entry_logic_operator: str = "AND"      # 'AND' or 'OR' grouping for entry rules
    
    # Lineage tracking metadata
    parent_strategy_id: Optional[str] = None
    generation_number: int = 0
    origin_type: str = "seed"              # 'seed', 'mutation', 'crossover', 'manual'
    mutation_details: Optional[Dict[str, Any]] = None


    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "universe": self.universe,
            "entry_rules": [r.to_dict() for r in self.entry_rules],
            "exit_rules": [r.to_dict() for r in self.exit_rules],
            "market_filter_rules": [r.to_dict() for r in self.market_filter_rules],
            "risk_config": {
                "stop_loss_pct": self.risk_config.stop_loss_pct
            },
            "profit_trim_steps": [
                {
                    "profit_target_pct": step.profit_target_pct,
                    "position_trim_pct": step.position_trim_pct
                }
                for step in self.profit_trim_steps
            ],
            "entry_logic_operator": self.entry_logic_operator,
            "parent_strategy_id": self.parent_strategy_id,
            "generation_number": self.generation_number,
            "origin_type": self.origin_type,
            "mutation_details": self.mutation_details,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "StrategyGenome":
        risk_data = data.get("risk_config", {})
        risk_cfg = RiskConfig(stop_loss_pct=risk_data.get("stop_loss_pct"))

        trims_data = data.get("profit_trim_steps", [])
        trim_steps = [
            ProfitTrimStep(
                profit_target_pct=float(t["profit_target_pct"]),
                position_trim_pct=float(t["position_trim_pct"])
            )
            for t in trims_data
        ]

        return cls(
            id=data.get("id", str(uuid.uuid4())[:8]),
            name=data.get("name", "Custom Strategy"),
            universe=data.get("universe", "All ETFs"),
            entry_rules=[Rule.from_dict(r) for r in data.get("entry_rules", [])],
            exit_rules=[Rule.from_dict(r) for r in data.get("exit_rules", [])],
            market_filter_rules=[Rule.from_dict(r) for r in data.get("market_filter_rules", [])],
            risk_config=risk_cfg,
            profit_trim_steps=trim_steps,
            entry_logic_operator=data.get("entry_logic_operator", "AND"),
            parent_strategy_id=data.get("parent_strategy_id"),
            generation_number=data.get("generation_number", 0),
            origin_type=data.get("origin_type", "seed"),
            mutation_details=data.get("mutation_details"),
        )

