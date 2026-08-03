"""
YAML Rules Loader for StockWave Genetic Strategy Engine.
Loads, parses, and provides type-safe access to data/inputs/backtest_rules.yaml.
"""
import os
import yaml
import numpy as np
from typing import Dict, Any, List, Optional
from config_loader import get_path_config


class YAMLBacktestRulesLoader:
    _instance = None
    _config: Dict[str, Any] = {}

    def __init__(self, yaml_path: Optional[str] = None):
        if not yaml_path:
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
            yaml_path = os.path.join(base_dir, "data", "inputs", "backtest_rules.yaml")

        self.yaml_path = yaml_path
        self.load_config()


    def load_config(self) -> Dict[str, Any]:
        """Loads and parses the YAML configuration file."""
        if not os.path.exists(self.yaml_path):
            raise FileNotFoundError(f"Backtest rules YAML file not found: {self.yaml_path}")

        with open(self.yaml_path, "r") as f:
            self._config = yaml.safe_load(f) or {}

        return self._config

    @property
    def config(self) -> Dict[str, Any]:
        if not self._config:
            self.load_config()
        return self._config

    def get_trend_series(self) -> List[str]:
        """Returns allowed moving average trend series indicators."""
        return self.config.get("indicators", {}).get("trend_series", ["ema_8", "ema_21", "sma_50", "sma_200", "close"])

    def get_numeric_metrics(self) -> Dict[str, Dict[str, Any]]:
        """Returns allowed numeric indicators with their min, max, step, and allowed operators."""
        return self.config.get("indicators", {}).get("numeric_metrics", {})

    def get_indicator_values_array(self, metric_name: str) -> List[float]:
        """Generates dynamic numpy array of values for a metric based on min, max, step."""
        metric_cfg = self.get_numeric_metrics().get(metric_name, {})
        if not metric_cfg:
            return [0.0]

        mn = float(metric_cfg.get("min", 0.0))
        mx = float(metric_cfg.get("max", 100.0))
        st = float(metric_cfg.get("step", 1.0))

        arr = list(np.round(np.arange(mn, mx + st / 2.0, st), 3))
        return [float(x) for x in arr]

    def get_stop_loss_range(self) -> List[float]:
        """Generates dynamic stop loss percentage array."""
        cfg = self.config.get("risk_management", {}).get("stop_loss_pct", {})
        mn = float(cfg.get("min", 0.02))
        mx = float(cfg.get("max", 0.10))
        st = float(cfg.get("step", 0.005))
        return [float(x) for x in np.round(np.arange(mn, mx + st / 2.0, st), 4)]

    def get_profit_target_range(self) -> List[float]:
        """Generates dynamic profit target percentage array."""
        cfg = self.config.get("risk_management", {}).get("profit_targets", {}).get("target_pct", {})
        mn = float(cfg.get("min", 0.05))
        mx = float(cfg.get("max", 0.80))
        st = float(cfg.get("step", 0.05))
        return [float(x) for x in np.round(np.arange(mn, mx + st / 2.0, st), 3)]

    def get_mandatory_exit_rules(self) -> List[Dict[str, Any]]:
        """Returns mandatory exit rules from YAML."""
        return self.config.get("mandatory_rules", {}).get("exit_rules", [])

    def get_mandatory_market_filters(self) -> List[Dict[str, Any]]:
        """Returns mandatory market filter rules from YAML."""
        return self.config.get("mandatory_rules", {}).get("market_filters", [])

    def generate_trend_pairs(self) -> List[str]:
        """
        Dynamically inspects indicators.trend_series in backtest_rules.yaml and programmatically
        generates all valid fast > slow moving average crossover pairs without hardcoding.
        """
        series = self.get_trend_series()
        # Separate moving averages by period order
        ma_order = {"ema_8": 8, "ema_13": 13, "ema_21": 21, "sma_50": 50, "ema_65": 65, "sma_200": 200}
        
        pairs = []
        # 1. Price vs Moving Average
        if "close" in series:
            for ma in series:
                if ma != "close" and ma in ma_order:
                    pairs.append(f"close > {ma}")

        # 2. Fast MA vs Slow MA
        available_mas = [m for m in series if m in ma_order]
        available_mas.sort(key=lambda m: ma_order[m])

        for i in range(len(available_mas)):
            for j in range(i + 1, len(available_mas)):
                fast = available_mas[i]
                slow = available_mas[j]
                pairs.append(f"{fast} > {slow}")

        return pairs if pairs else ["ema_8 > ema_21", "close > sma_50"]

    def get_universe_profile(self, universe_name: str) -> Dict[str, Any]:
        """Returns universe-specific profile overrides."""
        profiles = self.config.get("universe_profiles", {})
        return profiles.get(universe_name, profiles.get("All ETFs", {}))

