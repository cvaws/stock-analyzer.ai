import pandas as pd
from typing import Tuple

def calculate_performance_returns(df: pd.DataFrame) -> Tuple[float, float, float, float, float]:
    """
    Calculates % Change D, % Change W, % Change M, Return 5D, and Return 10D from daily OHLCV DataFrame.
    Returns (pct_change_d, pct_change_w, pct_change_m, return_5d, return_10d).
    """
    if df.empty or len(df) < 2:
        return 0.0, 0.0, 0.0, 0.0, 0.0
    
    latest_close = float(df.iloc[-1]["Close"])
    prev_1d = float(df.iloc[-2]["Close"]) if len(df) >= 2 else latest_close
    prev_5d = float(df.iloc[-6]["Close"]) if len(df) >= 6 else (float(df.iloc[0]["Close"]) if len(df) > 0 else latest_close)
    prev_10d = float(df.iloc[-11]["Close"]) if len(df) >= 11 else (float(df.iloc[0]["Close"]) if len(df) > 0 else latest_close)
    prev_21d = float(df.iloc[-22]["Close"]) if len(df) >= 22 else (float(df.iloc[0]["Close"]) if len(df) > 0 else latest_close)

    pct_d = round(((latest_close - prev_1d) / prev_1d) * 100, 2) if prev_1d > 0 else 0.0
    pct_w = round(((latest_close - prev_5d) / prev_5d) * 100, 2) if prev_5d > 0 else 0.0
    pct_m = round(((latest_close - prev_21d) / prev_21d) * 100, 2) if prev_21d > 0 else 0.0
    ret_5d = round(((latest_close - prev_5d) / prev_5d) * 100, 2) if prev_5d > 0 else 0.0
    ret_10d = round(((latest_close - prev_10d) / prev_10d) * 100, 2) if prev_10d > 0 else 0.0

    return pct_d, pct_w, pct_m, ret_5d, ret_10d

