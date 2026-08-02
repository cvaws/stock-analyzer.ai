import pandas as pd

def calculate_ma_status(close_price: float, ma_value: float) -> bool:
    """
    ThinkOrSwim MA Status Parity Logic:
    def above = close > ExpAverage(close, 8);
    Returns True (✓ / Dark Green) if close > ma_value else False (x / Dark Red).
    """
    if pd.isna(close_price) or pd.isna(ma_value):
        return False
    return float(close_price) > float(ma_value)

def calculate_ma_column_flags(df: pd.DataFrame) -> pd.DataFrame:
    """
    Computes above_ema8, above_ema21, and above_sma50 boolean columns for a DataFrame.
    """
    df = df.copy()
    if "Close" in df.columns:
        if "EMA8" in df.columns:
            df["above_ema8"] = df["Close"] > df["EMA8"]
        if "EMA21" in df.columns:
            df["above_ema21"] = df["Close"] > df["EMA21"]
        if "SMA50" in df.columns:
            df["above_sma50"] = df["Close"] > df["SMA50"]
    return df
