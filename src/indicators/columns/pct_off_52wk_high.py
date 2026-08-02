import pandas as pd

def calculate_pct_off_52wk_high_series(df: pd.DataFrame, lookback: int = 252) -> pd.Series:
    """
    Calculates rolling percentage off 52-week high Series across all historical bars.
    """
    if df.empty or "High" not in df.columns or "Close" not in df.columns:
        return pd.Series(0.0, index=df.index)
    rolling_high = df["High"].rolling(window=lookback, min_periods=1).max()
    pct_off = ((df["Close"] / rolling_high) - 1.0) * 100.0
    return pct_off.round(1).fillna(0.0)

def calculate_pct_off_52wk_high(df: pd.DataFrame, lookback: int = 252) -> float:
    """
    ThinkOrSwim Parity Logic for %52wk_High (% Off 52-Week High):
    def pctOff = ((Close / Highest(high, 252)) - 1) * 100;
    plot Data = Round(pctOff, 1);
    """
    series = calculate_pct_off_52wk_high_series(df, lookback=lookback)
    return float(series.iloc[-1]) if not series.empty else 0.0
