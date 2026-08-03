"""
Structured Rule Domain Models for StockWave Evolutionary Research Engine.
"""
from dataclasses import dataclass, field
from enum import Enum, auto
from typing import Any, Dict, Optional, Union


class RuleCategory(Enum):
    TREND = "trend"
    RELATIVE_STRENGTH = "relative_strength"
    MOMENTUM = "momentum"
    MARKET_FILTER = "market_filter"
    EXIT = "exit"
    RISK = "risk"
    PROFIT_TAKING = "profit_taking"


class RuleOperator(Enum):
    GT = ">"
    GTE = ">="
    LT = "<"
    LTE = "<="
    EQ = "="
    NEQ = "!="
    IN = "IN"
    BETWEEN = "BETWEEN"


@dataclass
class Rule:
    """
    Represents an atomic, structured trading condition rule.
    Example: ema_8 > ema_21 or rsi_14 BETWEEN 40 AND 65 or r.regime_code IN ('PRESS_GAS', 'HALF_SIZE')
    """
    id: str
    category: RuleCategory
    left_operand: str
    operator: RuleOperator
    right_operand: Union[str, float, int, list, tuple]
    enabled: bool = True
    weight: float = 1.0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "category": self.category.value,
            "left_operand": self.left_operand,
            "operator": self.operator.value,
            "right_operand": self.right_operand,
            "enabled": self.enabled,
            "weight": self.weight,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Rule":
        return cls(
            id=data["id"],
            category=RuleCategory(data["category"]),
            left_operand=data["left_operand"],
            operator=RuleOperator(data["operator"]),
            right_operand=data["right_operand"],
            enabled=data.get("enabled", True),
            weight=data.get("weight", 1.0),
        )
