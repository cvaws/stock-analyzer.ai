import pandas as pd
import pandas_ta as ta

def calculate_stage2_trend(df: pd.DataFrame, mrs_daily_index: float, supertrend_direction: int) -> bool:
    """
    Pine Script & Stan Weinstein Stage 2 Uptrend Detection.
    Stage 2 = ALL of the following:
    1. Close > SMA200 (Price is above 200-day moving average)
    2. SMA200 slope is positive (SMA200 today > SMA200 20 bars ago)
    3. Supertrend Direction = +1 (Weekly / Daily Supertrend is Bullish)
    4. MRS Daily Index > 0 (Outperforming SPY benchmark)
    """
    if df is None or len(df) < 50:
        return False

    latest = df.iloc[-1]
    close_price = float(latest["Close"])
    
    # 1. Close > SMA200
    sma200 = float(latest["SMA200"]) if "SMA200" in latest and pd.notna(latest["SMA200"]) else None
    if sma200 is None:
        if len(df) >= 200:
            s200_series = ta.sma(df["Close"], length=200)
            sma200 = float(s200_series.iloc[-1]) if s200_series is not None and pd.notna(s200_series.iloc[-1]) else None
        else:
            sma50 = float(latest["SMA50"]) if "SMA50" in latest and pd.notna(latest["SMA50"]) else None
            sma200 = sma50

    if sma200 is None or close_price <= sma200:
        return False

    # 2. Moving Average Slope / Structural Alignment (Stan Weinstein Stage 2 definition)
    # Price > SMA200 and (SMA200 is flattening/rising OR SMA50 > SMA200 with SMA50 rising)
    sma50 = float(latest["SMA50"]) if "SMA50" in latest and pd.notna(latest["SMA50"]) else None
    sma50_rising = False
    if "SMA50" in df.columns and len(df) >= 25:
        sma50_20d_ago = df["SMA50"].iloc[-21]
        if pd.notna(sma50_20d_ago) and sma50 is not None and sma50 >= float(sma50_20d_ago):
            sma50_rising = True

    sma200_rising = False
    if "SMA200" in df.columns and len(df) >= 25:
        sma200_20d_ago = df["SMA200"].iloc[-21]
        if pd.notna(sma200_20d_ago) and sma200 >= float(sma200_20d_ago):
            sma200_rising = True
    elif len(df) >= 220:
        s200_series = ta.sma(df["Close"], length=200)
        if s200_series is not None and pd.notna(s200_series.iloc[-1]) and pd.notna(s200_series.iloc[-21]):
            if float(s200_series.iloc[-1]) >= float(s200_series.iloc[-21]):
                sma200_rising = True

    # Valid Stage 2 requires either rising 200 SMA or early Stage 2 breakout (SMA50 rising above SMA200)
    if not (sma200_rising or (sma50 is not None and sma50 > sma200 and sma50_rising)):
        return False

    # 3. Supertrend Direction is Bullish (+1)
    if supertrend_direction != 1:
        return False

    # 4. Mansfield RS Daily Index > 0
    if mrs_daily_index <= 0:
        return False

    return True
