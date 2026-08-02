import pandas as pd
import pandas_ta as ta

def calculate_rsi_series(df: pd.DataFrame, length: int = 14) -> pd.Series:
    """
    Returns full 14-period RSI pandas Series for all historical bars.
    """
    rsi_series = ta.rsi(df["Close"], length=length)
    return rsi_series.fillna(50.0)

def calculate_rsi(df: pd.DataFrame, length: int = 14) -> float:
    """
    Pine Script Parity (data/pine_indicators/RS.pine): 14-period Relative Strength Index (RSI).
    """
    rsi_series = calculate_rsi_series(df, length=length)
    return round(float(rsi_series.iloc[-1]), 2) if not rsi_series.empty and pd.notna(rsi_series.iloc[-1]) else 50.0
