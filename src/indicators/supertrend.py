"""
Supertrend Indicator — Pine Script Parity
==========================================
Reference: data/pine_indicators/supertrend.pine (PineScript v6)

Customisation applied:
    Midpoint  : ohlc4 = (Open + High + Low + Close) / 4.0  (instead of hl2)
    Timeframe : Weekly bars (W-FRI resampled before calling this function)
    Direction : +1 = Uptrend, -1 = Downtrend  (flipped from Pine Script's quirky -1/+1 convention
                for readability — positive always means bullish)

Pine Script logic:
    atrPeriod = 10
    factor    = 3.0
    [supertrend, direction] = ta.supertrend(factor, atrPeriod)

    Pine Script direction: -1 = Uptrend, +1 = Downtrend  (counterintuitive, NOT used here)
    Our direction:         +1 = Uptrend, -1 = Downtrend  (positive = bullish)

Column outputs:
    supertrend          REAL  – Supertrend band value (support or resistance level)
    supertrend_direction INT  – +1 = Uptrend, -1 = Downtrend
"""

import pandas as pd
import numpy as np


def _calculate_atr(high: pd.Series, low: pd.Series, close: pd.Series, period: int) -> pd.Series:
    """
    Calculates Wilder's smoothed ATR (matches pandas_ta / TradingView default).

    Parameters
    ----------
    high, low, close : pd.Series
        OHLCV price series (index-aligned).
    period : int
        ATR smoothing period.

    Returns
    -------
    pd.Series
        ATR series (same index as input).
    """
    prev_close = close.shift(1)
    tr = pd.concat(
        [
            high - low,
            (high - prev_close).abs(),
            (low - prev_close).abs(),
        ],
        axis=1,
    ).max(axis=1)

    # Wilder's smoothing (RMA): matches TradingView ta.atr()
    atr = tr.ewm(alpha=1.0 / period, min_periods=period, adjust=False).mean()
    return atr


def calculate_supertrend_series(
    df: pd.DataFrame,
    atr_period: int = 10,
    factor: float = 3.0,
) -> pd.DataFrame:
    """
    Pine Script Parity (data/pine_indicators/supertrend.pine):
    Calculates the Supertrend indicator over the full historical DataFrame.

    Midpoint customisation: uses ohlc4 = (Open + High + Low + Close) / 4.0
    instead of the Pine Script default hl2 = (High + Low) / 2.0.
    Call this function on *weekly-resampled* OHLCV before forward-filling
    back to a daily index (see calculate_indicators.py).

    Direction convention (intentionally flipped from Pine Script for readability):
        +1 = Uptrend   — price is above the Supertrend band (band acts as support)
        -1 = Downtrend — price is below the Supertrend band (band acts as resistance)
    Pine Script uses the opposite sign (-1 / +1); we normalise to positive = bullish.

    Supertrend algorithm (matches TradingView ta.supertrend):
        upper_band = ohlc4 + factor × ATR(atr_period)
        lower_band = ohlc4 − factor × ATR(atr_period)

        Direction flips from Uptrend (+1) to Downtrend (-1) when close crosses
        below the lower_band, and vice-versa.

    Parameters
    ----------
    df : pd.DataFrame
        DataFrame with columns: Open, High, Low, Close.
    atr_period : int
        ATR smoothing period. Default: 10 (Pine Script default).
    factor : float
        ATR multiplier. Default: 3.0 (Pine Script default).

    Returns
    -------
    pd.DataFrame
        Input DataFrame with two new columns appended:
            ``supertrend``           – Supertrend band level (float).
            ``supertrend_direction`` – +1 = Uptrend, -1 = Downtrend (int).
    """
    df = df.copy()

    open_ = df["Open"].astype(float)
    high = df["High"].astype(float)
    low = df["Low"].astype(float)
    close = df["Close"].astype(float)

    # ohlc4 midpoint (customisation over Pine Script's default hl2)
    ohlc4 = (open_ + high + low + close) / 4.0
    atr = _calculate_atr(high, low, close, period=atr_period)

    # Raw upper/lower bands
    raw_upper = ohlc4 + factor * atr
    raw_lower = ohlc4 - factor * atr

    n = len(df)
    supertrend = np.full(n, np.nan)
    direction = np.full(n, np.nan)

    # Initialise first valid bar
    first_valid = atr.first_valid_index()
    if first_valid is None:
        df["supertrend"] = np.nan
        df["supertrend_direction"] = np.nan
        return df

    start_idx = df.index.get_loc(first_valid)

    # Finalised band arrays (carry-forward logic, same as PineScript)
    final_upper = raw_upper.to_numpy(dtype=float, na_value=np.nan).copy()
    final_lower = raw_lower.to_numpy(dtype=float, na_value=np.nan).copy()
    close_arr = close.to_numpy(dtype=float, na_value=np.nan)

    for i in range(start_idx, n):
        if i == start_idx:
            final_upper[i] = raw_upper.iloc[i]
            final_lower[i] = raw_lower.iloc[i]
            # Assume uptrend at initialisation (direction = +1)
            direction[i] = 1
            supertrend[i] = final_lower[i]
            continue

        # Upper band: only tighten (lower) if price was already in downtrend
        if raw_upper.iloc[i] < final_upper[i - 1] or close_arr[i - 1] > final_upper[i - 1]:
            final_upper[i] = raw_upper.iloc[i]
        else:
            final_upper[i] = final_upper[i - 1]

        # Lower band: only tighten (raise) if price was already in uptrend
        if raw_lower.iloc[i] > final_lower[i - 1] or close_arr[i - 1] < final_lower[i - 1]:
            final_lower[i] = raw_lower.iloc[i]
        else:
            final_lower[i] = final_lower[i - 1]

        # Direction: +1 = Uptrend, -1 = Downtrend
        prev_dir = direction[i - 1]
        if prev_dir == -1:
            # Was downtrend; flip to uptrend if close breaks above upper band
            direction[i] = 1 if close_arr[i] > final_upper[i] else -1
        else:
            # Was uptrend; flip to downtrend if close breaks below lower band
            direction[i] = -1 if close_arr[i] < final_lower[i] else 1

        # Supertrend value = lower band in uptrend (+1), upper band in downtrend (-1)
        supertrend[i] = final_lower[i] if direction[i] == 1 else final_upper[i]

    df["supertrend"] = supertrend
    df["supertrend_direction"] = direction.astype(float)
    # Suppress value on the very first bar (Pine: barstate.isfirst → na)
    df.loc[df.index[start_idx], "supertrend"] = np.nan

    return df


def calculate_supertrend(
    df: pd.DataFrame,
    atr_period: int = 10,
    factor: float = 3.0,
) -> dict:
    """
    Returns the latest-bar Supertrend values as a scalar dict.

    Parameters
    ----------
    df : pd.DataFrame
        DataFrame with columns: High, Low, Close.
    atr_period : int
        ATR smoothing period. Default: 10.
    factor : float
        ATR multiplier. Default: 3.0.

    Returns
    -------
    dict
        {
            "supertrend":           float  – Latest supertrend band level.
            "supertrend_direction": int    – -1 (Uptrend) or +1 (Downtrend).
        }
    """
    df_calc = calculate_supertrend_series(df, atr_period=atr_period, factor=factor)
    last = df_calc.iloc[-1]
    st_val = round(float(last["supertrend"]), 4) if pd.notna(last["supertrend"]) else None
    dir_val = int(last["supertrend_direction"]) if pd.notna(last["supertrend_direction"]) else None
    return {"supertrend": st_val, "supertrend_direction": dir_val}
