import pandas as pd
import numpy as np
import pandas_ta as ta

def calculate_volatility_and_volume(df: pd.DataFrame) -> pd.DataFrame:
    """
    Calculates ATR14, 20-day Volume MA, and Volume Surge ratio.
    """
    df = df.copy()
    df["ATR14"] = ta.atr(df["High"], df["Low"], df["Close"], length=14)
    df["Vol_MA20"] = ta.sma(df["Volume"], length=20)
    df["Vol_Ratio"] = df["Volume"] / np.maximum(df["Vol_MA20"], 1)
    return df
