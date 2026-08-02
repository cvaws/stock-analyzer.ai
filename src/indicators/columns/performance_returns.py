import pandas as pd
from typing import Tuple

def calculate_performance_returns(df: pd.DataFrame) -> Tuple[float, float, float]:
    """
    Calculates % Change D, % Change W, and % Change M from daily OHLCV DataFrame.
    Returns (pct_change_d, pct_change_w, pct_change_m).
    """
    if df.empty or len(df) < 2:
        return 0.0, 0.0, 0.0
    
    latest_close = float(df.iloc[-1]["Close"])
    prev_1d = float(df.iloc[-2]["Close"]) if len(df) >= 2 else latest_close
    prev_5d = float(df.iloc[-6]["Close"]) if len(df) >= 6 else latest_close
    prev_21d = float(df.iloc[-22]["Close"]) if len(df) >= 22 else latest_close

    pct_d = round(((latest_close - prev_1d) / prev_1d) * 100, 2)
    pct_w = round(((latest_close - prev_5d) / prev_5d) * 100, 2)
    pct_m = round(((latest_close - prev_21d) / prev_21d) * 100, 2)

    return pct_d, pct_w, pct_m
