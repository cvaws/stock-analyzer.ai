import pandas as pd
import numpy as np
import pandas_ta as ta

def calculate_volatility_and_volume(df: pd.DataFrame) -> pd.DataFrame:
    """
    Calculates ATR14, ATR14 %, 20-day Volume MA, Volume Ratio, and 20-day Momentum Return %.
    """
    df = df.copy()
    df["ATR14"] = ta.atr(df["High"], df["Low"], df["Close"], length=14)
    df["ATR14_Pct"] = (df["ATR14"] / df["Close"]) * 100.0
    df["Vol_MA20"] = ta.sma(df["Volume"], length=20)
    df["Vol_Ratio"] = df["Volume"] / np.maximum(df["Vol_MA20"], 1)
    df["Vol_MA20_Ratio"] = df["Vol_Ratio"]
    df["Return_20D_Pct"] = df["Close"].pct_change(periods=20) * 100.0
    return df

