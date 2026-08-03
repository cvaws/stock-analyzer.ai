"""
LLM Research Observer and Search Controller for StockWave Evolutionary Research Engine.
Sends aggregated empirical evidence to qwen3-coder:30b and receives advisory research observations.
"""
import json
import logging
import httpx
from typing import Dict, Any, List
from config_loader import load_config

logger = logging.getLogger(__name__)



class ResearchObserver:
    """
    Acts as an AI Quantitative Research Assistant.
    Receives empirical statistical evidence from past experiments and generates structured research suggestions.
    DOES NOT write executable SQL or rules.
    """

    def __init__(self, ollama_url: str = "http://127.0.0.1:11434/api/chat"):
        self.ollama_url = ollama_url
        self.model = load_config().get("models", {}).get("chat", {}).get("name", "qwen3-coder:30b")


    def observe(self, evidence_summary: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Queries local LLM with evidence summary table to get advisory suggestions.
        """
        if not evidence_summary:
            return {
                "observations": ["Insufficient historical experiment data."],
                "promising_indicators": ["mrs_daily_index", "ema_8"],
                "avoid_indicators": []
            }

        prompt = (
            "You are a Quantitative Research Assistant reviewing empirical backtest evidence.\n"
            "Below is a table of indicator performance statistics from historical strategy experiments:\n\n"
            f"{json.dumps(evidence_summary, indent=2)}\n\n"
            "Analyze this evidence and return a JSON object with keys:\n"
            "- 'observations': list of strings summarizing what worked/failed\n"
            "- 'promising_indicators': list of top indicator names to prioritize\n"
            "- 'avoid_indicators': list of weak indicator names to deemphasize\n"
            "Return JSON only."
        )

        try:
            resp = httpx.post(
                self.ollama_url,
                json={
                    "model": self.model,
                    "messages": [{"role": "user", "content": prompt}],
                    "stream": False,
                    "format": "json"
                },
                timeout=30.0
            )
            if resp.status_code == 200:
                content = resp.json().get("message", {}).get("content", "{}")
                return json.loads(content)
        except Exception as e:
            logger.warning(f"ResearchObserver call failed fallback to rule-based: {e}")

        # Fallback to pure rule-based evidence ranking if LLM unavailable
        promising = [s["indicator"] for s in evidence_summary if s.get("avg_profit_factor", 0) >= 1.5]
        avoid = [s["indicator"] for s in evidence_summary if s.get("avg_profit_factor", 0) < 1.0]

        return {
            "observations": [f"Ranked {len(evidence_summary)} indicators from empirical DB."],
            "promising_indicators": promising or ["mrs_daily_index", "ema_8"],
            "avoid_indicators": avoid
        }


class SearchController:
    """
    Biases next generation probabilities (mutation rates, indicator priorities) based on evidence + LLM observations.
    """
    def __init__(self, observer: ResearchObserver = None):
        self.observer = observer or ResearchObserver()

    def get_search_bias(self, evidence_summary: List[Dict[str, Any]]) -> Dict[str, Any]:
        obs = self.observer.observe(evidence_summary)
        return {
            "promising_indicators": obs.get("promising_indicators", []),
            "avoid_indicators": obs.get("avoid_indicators", []),
            "mutation_rate": 0.3 if len(evidence_summary) > 10 else 0.5,
            "observations": obs.get("observations", [])
        }
