import os
import json
import logging
from typing import Dict, Any
from langchain_ollama import ChatOllama
from graphs.state import GraphState


logger = logging.getLogger(__name__)

def ai_analysis(state: GraphState) -> dict:
    """
    Invokes local Ollama LLM (qwen2.5:14b) to synthesize market regime
    by analyzing Leadership vs Canaries vs Defense performance & backtest rankings.
    """
    print("---RUNNING NODE: ai_analysis---")
    etf_universe = state.get("etf_universe", {})
    technical_indicators = state.get("technical_indicators", {})
    backtest_results = state.get("backtest_results", {})

    # Prepare structured context for LLM prompt
    category_summary = {}
    for cat, tickers in etf_universe.items():
        cat_scores = [technical_indicators[t]["rs_rating"] for t in tickers if t in technical_indicators]
        avg_rs = round(sum(cat_scores) / len(cat_scores), 1) if cat_scores else 50.0
        category_summary[cat] = {
            "tickers": tickers,
            "avg_rs_rating": avg_rs
        }

    # Top backtested tickers
    top_backtest = sorted(
        [{ "ticker": t, "win_rate": v["win_rate"], "profit_factor": v["profit_factor"]} 
         for t, v in backtest_results.items()],
        key=lambda x: (x["win_rate"], x["profit_factor"]),
        reverse=True
    )[:5]

    market_context = json.dumps({
        "category_summary": category_summary,
        "top_backtested_etfs": top_backtest
    }, indent=2)

    summary_text = ""
    try:
        # Load model setting from configs/config.yaml if present
        model_name = "gemma4:26b"
        if os.path.exists("configs/config.yaml"):
            import yaml
            with open("configs/config.yaml", "r") as f:
                cfg = yaml.safe_load(f)
                model_name = cfg.get("models", {}).get("chat", {}).get("name", "gemma4:26b")

        llm = ChatOllama(model=model_name, temperature=0.2)

        prompt = f"""
You are an expert ETF portfolio strategist and market technician.
Analyze the following ETF group performance and backtest results:

{market_context}

Provide a concise 3-paragraph executive summary:
1. **Market Regime**: Analyze Leadership vs Canaries vs Defense performance to determine if the market is Risk-On or Risk-Off.
2. **Top ETF Setups**: Highlight the top 3-5 ETFs showing high RS rating or high backtest win rates.
3. **Actionable Plan**: Provide specific entry, stop-loss, and target recommendations for the top candidates.
"""
        response = llm.invoke(prompt)
        summary_text = response.content
    except Exception as e:
        logger.error(f"Error invoking local Ollama LLM: {e}")
        summary_text = f"Market Analysis (Fallback): Strategy analysis completed across {len(technical_indicators)} ETFs. Category Summary: {category_summary}"

    print("AI Analysis Node complete.")
    return {"ai_market_summary": summary_text}
