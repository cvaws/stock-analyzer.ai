import logging
from typing import Dict, Any
import pandas as pd
from graphs.state import GraphState


logger = logging.getLogger(__name__)

def detect_patterns(state: GraphState) -> dict:
    """
    Detects Volatility Contraction Patterns (VCP), Volume Dry-Up (VDU), and Pivot Levels.
    (Deferred node step executed at the end of feature processing).
    """
    print("---RUNNING NODE: detect_patterns---")
    technical_indicators = state.get("technical_indicators", {})
    detected_patterns: Dict[str, Any] = {}

    for ticker, info in technical_indicators.items():
        df = info.get("df")
        if df is None or len(df) < 60:
            continue

        try:
            recent = df.iloc[-60:].copy()
            high_60 = recent["High"].max()
            current_close = recent["Close"].iloc[-1]
            depth_pct = round(((high_60 - current_close) / high_60) * 100, 2)

            range_20 = recent["High"].iloc[-20:].max() - recent["Low"].iloc[-20:].min()
            range_5 = recent["High"].iloc[-5:].max() - recent["Low"].iloc[-5:].min()
            vcp_contracted = bool(range_5 < range_20 * 0.45)

            vol_5_avg = recent["Volume"].iloc[-5:].mean()
            vol_ma20 = recent["Vol_MA20"].iloc[-1]
            vdu_signal = bool(vol_5_avg < vol_ma20 * 0.65) if pd.notna(vol_ma20) else False

            pivot_price = round(float(recent["High"].iloc[-15:].max()), 2)
            is_vcp = bool(vcp_contracted and info.get("stage2_trend") and depth_pct < 25.0)

            # Extension score: % above last consolidation pivot/base
            # If current price is near or below pivot, extension is <= 0% (buyable)
            # If current price has rallied way above pivot, extension is positive (extended)
            if pivot_price > 0:
                pct_above_last_base = round(((current_close - pivot_price) / pivot_price) * 100, 2)
            else:
                pct_above_last_base = 0.0

            detected_patterns[ticker] = {
                "is_vcp": is_vcp,
                "depth_pct": depth_pct,
                "vcp_contracted": vcp_contracted,
                "vdu_signal": vdu_signal,
                "pivot_price": pivot_price,
                "pct_above_last_base": pct_above_last_base
            }
        except Exception as e:
            logger.error(f"Error detecting patterns for {ticker}: {e}")

    print(f"Pattern detection complete for {len(detected_patterns)} ETFs.")
    return {"detected_patterns": detected_patterns}

