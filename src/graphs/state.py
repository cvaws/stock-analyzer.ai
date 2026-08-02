# TypedDict state schema for ETF Multi-Agent Workflow
from typing import TypedDict, Dict, Any, List, Optional

class GraphState(TypedDict):
    etf_universe: Dict[str, List[str]]        # Category -> list of ETF tickers
    ticker_data: Dict[str, Any]                # Ticker -> historical OHLCV DataFrames/dicts
    etf_names: Dict[str, str]                  # Ticker -> official long/short company name
    technical_indicators: Dict[str, Any]       # Ticker -> calculated EMA, RS, ATR, volume
    detected_patterns: Dict[str, Any]          # Ticker -> VCP, VDU, pivot prices
    backtest_results: Dict[str, Any]           # Ticker/Strategy -> win rates, profit factor, trades
    saved_strategies: Optional[List[Any]]       # Preset strategies list
    all_strategy_results: Optional[Dict[str, Any]] # Strategy Name -> Backtest results dict
    ai_market_summary: str                      # Executive market regime summary
    scan_date: str                              # Scan timestamp

