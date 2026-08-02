import pandas as pd

def calculate_pct_off_52wk_low_series(df: pd.DataFrame, lookback: int = 252) -> pd.Series:
    """
    Calculates rolling percentage off 52-week low Series across all historical bars.
    """
    if df.empty or "Low" not in df.columns or "Close" not in df.columns:
        return pd.Series(0.0, index=df.index)
    rolling_low = df["Low"].rolling(window=lookback, min_periods=1).min()
    pct_off = ((df["Close"] / rolling_low) - 1.0) * 100.0
    return pct_off.round(1).fillna(0.0)

def calculate_pct_off_52wk_low(df: pd.DataFrame, lookback: int = 252) -> float:
    """
    Calculate percentage off 52-week low similar to ThinkOrSwim parity.
    ((Close / Lowest(Low, lookback)) - 1) * 100
    """
    series = calculate_pct_off_52wk_low_series(df, lookback=lookback)
    return float(series.iloc[-1]) if not series.empty else 0.0
