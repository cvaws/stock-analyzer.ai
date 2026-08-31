import pandas as pd
import numpy as np
from typing import Tuple, Dict, Any

def calculate_rs_phase_performance(
    df: pd.DataFrame, 
    benchmark_df: pd.DataFrame, 
    length: int = 52,
    timeframe: str = 'daily'
) -> Dict[str, Any]:
    """
    ThinkOrSwim RS Phase Performance Parity Logic:
    
    # --- MANSFIELD RS CALCULATION ---
    ratio = c / cInd
    ma = Average(ratio, length)
    mrs = ((ratio / ma) - 1) * 10
    
    # --- TREND ANCHORS ---
    crossedAbove = mrs >= 0 and mrs[1] < 0
    crossedBelow = mrs < 0 and mrs[1] >= 0
    priceAtPositive = price when crossedAbove occurred, held while mrs >= 0
    priceAtNegative = price when crossedBelow occurred, held while mrs < 0
    
    # --- PERFORMANCE CALCULATION ---
    positiveGain = (c - priceAtPositive) * 100 / priceAtPositive
    negativeDrawdown = (c - priceAtNegative) * 100 / priceAtNegative
    Result = if mrs >= 0 then positiveGain else negativeDrawdown
    
    Color Priority:
    - positiveGain >= 100 -> Magenta (#d946ef)
    - crossedAbove        -> Cyan (#06b6d4)
    - mrs >= 0 & Result >= 0 -> Green (#10b981)
    - else                -> Red (#ef4444)
    """
    if df.empty or benchmark_df is None or benchmark_df.empty:
        return {"result": 0.0, "crossed_above": False, "color_flag": "RED"}

    # Resample to weekly timeframe if requested
    if timeframe == 'weekly':
        if "Date" in df.columns and pd.api.types.is_datetime64_any_dtype(df["Date"]):
            df_work = df.resample('W-FRI', on='Date').agg({
                'Open': 'first', 'High': 'max', 'Low': 'min', 'Close': 'last', 'Volume': 'sum'
            }).dropna()
        elif isinstance(df.index, pd.DatetimeIndex):
            df_work = df.resample('W-FRI').agg({
                'Open': 'first', 'High': 'max', 'Low': 'min', 'Close': 'last', 'Volume': 'sum'
            }).dropna()
        else:
            df_work = df.copy()

        if "Date" in benchmark_df.columns and pd.api.types.is_datetime64_any_dtype(benchmark_df["Date"]):
            bm_work = benchmark_df.resample('W-FRI', on='Date').agg({
                'Open': 'first', 'High': 'max', 'Low': 'min', 'Close': 'last', 'Volume': 'sum'
            }).dropna()
        elif isinstance(benchmark_df.index, pd.DatetimeIndex):
            bm_work = benchmark_df.resample('W-FRI').agg({
                'Open': 'first', 'High': 'max', 'Low': 'min', 'Close': 'last', 'Volume': 'sum'
            }).dropna()
        else:
            bm_work = benchmark_df.copy()
    else:
        df_work = df.copy()
        bm_work = benchmark_df.copy()

    # Align dates
    combined = pd.DataFrame({'c': df_work['Close'], 'cInd': bm_work['Close']}).dropna()
    actual_len = min(length, len(combined) - 1) if len(combined) >= 3 else 1
    if len(combined) < 3:
        return {"result": 0.0, "crossed_above": False, "color_flag": "RED"}

    c = combined['c']
    cInd = combined['cInd']

    ratio = c / cInd
    ma = ratio.rolling(window=actual_len, min_periods=1).mean()

    mrs = ((ratio / ma) - 1.0) * 10.0

    mrs_curr = mrs.values
    c_curr = c.values

    n = len(mrs_curr)
    price_at_pos = np.full(n, np.nan)
    price_at_neg = np.full(n, np.nan)
    crossed_above_flags = np.full(n, False)

    for i in range(1, n):
        curr_mrs = mrs_curr[i]
        prev_mrs = mrs_curr[i-1]
        curr_c = c_curr[i]

        is_crossed_above = bool(curr_mrs >= 0 and prev_mrs < 0)
        is_crossed_below = bool(curr_mrs < 0 and prev_mrs >= 0)

        crossed_above_flags[i] = is_crossed_above

        if is_crossed_above:
            price_at_pos[i] = curr_c
        elif curr_mrs >= 0:
            price_at_pos[i] = price_at_pos[i-1]
        else:
            price_at_pos[i] = np.nan

        if is_crossed_below:
            price_at_neg[i] = curr_c
        elif curr_mrs < 0:
            price_at_neg[i] = price_at_neg[i-1]
        else:
            price_at_neg[i] = np.nan

    latest_mrs = mrs_curr[-1]
    latest_c = c_curr[-1]
    latest_crossed_above = crossed_above_flags[-1]
    latest_price_pos = price_at_pos[-1]
    latest_price_neg = price_at_neg[-1]

    if np.isnan(latest_mrs):
        return {"result": 0.0, "crossed_above": False, "color_flag": "RED"}

    pos_gain = ((latest_c - latest_price_pos) * 100.0 / latest_price_pos) if not np.isnan(latest_price_pos) and latest_price_pos != 0 else 0.0
    neg_dd = ((latest_c - latest_price_neg) * 100.0 / latest_price_neg) if not np.isnan(latest_price_neg) and latest_price_neg != 0 else 0.0

    result_val = round(pos_gain if latest_mrs >= 0 else neg_dd, 2)

    # Determine TOS color priority
    if pos_gain >= 100.0:
        color_flag = "MAGENTA"
    elif latest_crossed_above:
        color_flag = "CYAN"
    elif latest_mrs >= 0 and result_val >= 0:
        color_flag = "GREEN"
    else:
        color_flag = "RED"

    return {
        "result": result_val,
        "crossed_above": latest_crossed_above,
        "color_flag": color_flag
    }
