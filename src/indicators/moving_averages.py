import pandas as pd
import pandas_ta as ta

def calculate_moving_averages(df: pd.DataFrame) -> pd.DataFrame:
    """
    Calculates standard moving averages (EMA8, EMA21, SMA50, SMA200).
    Boolean MA status flags are computed downstream by calculate_ma_status().
    """
    df = df.copy()
    df["EMA8"] = ta.ema(df["Close"], length=8)
    df["EMA21"] = ta.ema(df["Close"], length=21)
    df["SMA50"] = ta.sma(df["Close"], length=50)
    df["SMA200"] = ta.sma(df["Close"], length=200)
    
    return df

def is_above_ma(close_price: float, ma_value: float) -> bool:
    """
    Helper function evaluating whether close price is above a given MA value.
    Returns True if close > ma_value, else False.
    """
    if pd.isna(close_price) or pd.isna(ma_value):
        return False
    return float(close_price) > float(ma_value)
