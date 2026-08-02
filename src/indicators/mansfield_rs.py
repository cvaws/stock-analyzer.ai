import pandas as pd
import pandas_ta as ta

def calculate_mansfield_rs(df: pd.DataFrame, spy_df: pd.DataFrame, length: int = 200) -> pd.Series:
    """
    Pine Script Parity (data/pine_indicators/RS.pine): Mansfield Relative Strength (MRS Index vs SPY).
    Formula: ((Relative_Performance / SMA(Relative_Performance, length)) - 1) * 10
    """
    if spy_df is not None and "Close" in spy_df.columns and not spy_df.empty:
        if isinstance(df.index, pd.DatetimeIndex) and isinstance(spy_df.index, pd.DatetimeIndex):
            spy_close = spy_df["Close"].reindex(df.index, method="ffill").bfill()
        elif "Date" in df.columns and "Date" in spy_df.columns:
            spy_mapped = spy_df.set_index("Date")["Close"]
            spy_close = df["Date"].map(spy_mapped).ffill().bfill()
        else:
            spy_close = spy_df["Close"].iloc[-len(df):].values if len(spy_df) >= len(df) else df["Close"]
    else:
        spy_close = df["Close"]

    rel_perf = df["Close"] / spy_close
    ma_len = length if len(df) >= length else len(df)
    ma_rel_perf = ta.sma(rel_perf, length=ma_len)
    mrs_index = ((rel_perf / ma_rel_perf) - 1) * 10
    return mrs_index.fillna(0.0)

def calculate_marketsmith_rs_rating(df: pd.DataFrame, spy_df: pd.DataFrame) -> int:
    """
    Pine Script Parity (data/pine_indicators/RS.pine): MarketSmith 1-99 RS Percentile Rating.
    Weighted performance: 40% 1Q + 20% 2Q + 20% 3Q + 20% 4Q vs SPY.
    """
    if len(df) < 63:
        return 50

    latest_close = df["Close"].iloc[-1]
    n63 = 63 if len(df) >= 63 else len(df) - 1
    n126 = 126 if len(df) >= 126 else len(df) - 1
    n189 = 189 if len(df) >= 189 else len(df) - 1
    n252 = 252 if len(df) >= 252 else len(df) - 1

    perf_stock = (0.4 * (latest_close / df["Close"].iloc[-n63])) + \
                 (0.2 * (latest_close / df["Close"].iloc[-n126])) + \
                 (0.2 * (latest_close / df["Close"].iloc[-n189])) + \
                 (0.2 * (latest_close / df["Close"].iloc[-n252]))

    if spy_df is not None and len(spy_df) >= n252:
        spy_latest = spy_df["Close"].iloc[-1]
        perf_index = (0.4 * (spy_latest / spy_df["Close"].iloc[-n63])) + \
                     (0.2 * (spy_latest / spy_df["Close"].iloc[-n126])) + \
                     (0.2 * (spy_latest / spy_df["Close"].iloc[-n189])) + \
                     (0.2 * (spy_latest / spy_df["Close"].iloc[-n252]))
    else:
        perf_index = 1.0

    total_rs_score = (perf_stock / perf_index) * 100
    return min(max(int(total_rs_score * 0.9), 1), 99)

def calculate_rs_breakout_dot(df: pd.DataFrame, spy_df: pd.DataFrame, lookback: int = 250) -> bool:
    """
    Pine Script Parity (data/pine_indicators/RS.pine): MarketSmith RS 250-bar Breakout Dot (New High).
    """
    ref_df = spy_df if spy_df is not None and len(spy_df) == len(df) else df
    rel_perf = df["Close"] / ref_df["Close"]
    raw_ms_score = (rel_perf - 1) * 100
    lb = lookback if len(raw_ms_score) >= lookback else len(raw_ms_score)
    return bool(raw_ms_score.iloc[-1] >= raw_ms_score.iloc[-lb:].max())
