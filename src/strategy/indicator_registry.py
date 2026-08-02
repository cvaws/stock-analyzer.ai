"""
Indicator Registry for StockWave Strategy Lab.

Exposes metadata and evaluation functions for rules across 4 core categories:
1. Trend
2. Trend Alignment
3. Relative Strength
4. Momentum
"""
from typing import Dict, Any, List
import pandas as pd
import numpy as np

# Core categories and available rule definitions
AVAILABLE_RULES: List[Dict[str, Any]] = [
    # --- TREND ---
    {
        "id": "price_above_ema8",
        "name": "Price > EMA8",
        "category": "Trend",
        "value_type": "boolean",
        "default_op": "==",
        "default_val": True
    },
    {
        "id": "price_above_ema21",
        "name": "Price > EMA21",
        "category": "Trend",
        "value_type": "boolean",
        "default_op": "==",
        "default_val": True
    },
    {
        "id": "price_above_sma50",
        "name": "Price > SMA50",
        "category": "Trend",
        "value_type": "boolean",
        "default_op": "==",
        "default_val": True
    },
    {
        "id": "price_above_sma200",
        "name": "Price > SMA200",
        "category": "Trend",
        "value_type": "boolean",
        "default_op": "==",
        "default_val": True
    },

    # --- TREND ALIGNMENT ---
    {
        "id": "ema8_above_ema21",
        "name": "EMA8 > EMA21",
        "category": "Trend Alignment",
        "value_type": "boolean",
        "default_op": "==",
        "default_val": True
    },
    {
        "id": "ema21_above_sma50",
        "name": "EMA21 > SMA50",
        "category": "Trend Alignment",
        "value_type": "boolean",
        "default_op": "==",
        "default_val": True
    },
    {
        "id": "sma50_above_sma200",
        "name": "SMA50 > SMA200 (Stage 2)",
        "category": "Trend Alignment",
        "value_type": "boolean",
        "default_op": "==",
        "default_val": True
    },

    # --- RELATIVE STRENGTH ---
    {
        "id": "daily_mrs_above_zero",
        "name": "Daily MRS Index > 0",
        "category": "Relative Strength",
        "value_type": "boolean",
        "default_op": "==",
        "default_val": True
    },
    {
        "id": "weekly_mansfield_rs",
        "name": "Weekly MRS Index > 0",
        "category": "Relative Strength",
        "value_type": "boolean",
        "default_op": "==",
        "default_val": True
    },

    {
        "id": "rs_rating_min",
        "name": "MarketSmith RS Rating",
        "category": "Relative Strength",
        "value_type": "number",
        "default_op": ">=",
        "default_val": 80
    },
    {
        "id": "rs_new_high_250",
        "name": "RS 250-Day New High",
        "category": "Relative Strength",
        "value_type": "boolean",
        "default_op": "==",
        "default_val": True
    },

    # --- MOMENTUM & VOLUME ---
    {
        "id": "rsi14_min",
        "name": "RSI (14)",
        "category": "Momentum",
        "value_type": "number",
        "default_op": ">=",
        "default_val": 50
    },
    {
        "id": "rel_vol_min",
        "name": "Relative Volume (Vol / 20MA)",
        "category": "Momentum",
        "value_type": "number",
        "default_op": ">=",
        "default_val": 1.0
    },
    {
        "id": "pct_off_52wk_high_min",
        "name": "% off 52-Week High",
        "category": "Momentum",
        "value_type": "number",
        "default_op": ">=",
        "default_val": -10.0
    }
]

CATEGORY_MAP = {
    "Trend": [r for r in AVAILABLE_RULES if r["category"] == "Trend"],
    "Trend Alignment": [r for r in AVAILABLE_RULES if r["category"] == "Trend Alignment"],
    "Relative Strength": [r for r in AVAILABLE_RULES if r["category"] == "Relative Strength"],
    "Momentum": [r for r in AVAILABLE_RULES if r["category"] == "Momentum"]
}

def evaluate_rule_series(df: pd.DataFrame, rule_id: str, operator: str, target_val: Any) -> pd.Series:
    """
    Evaluates a single rule definition on a DataFrame and returns a boolean pd.Series.
    """
    length = len(df)
    false_series = pd.Series([False] * length, index=df.index)

    if df.empty:
        return false_series

    close = df["Close"]
    ema8 = df["EMA8"] if "EMA8" in df.columns else pd.Series([np.nan]*length, index=df.index)
    ema21 = df["EMA21"] if "EMA21" in df.columns else pd.Series([np.nan]*length, index=df.index)
    sma50 = df["SMA50"] if "SMA50" in df.columns else pd.Series([np.nan]*length, index=df.index)
    sma200 = df["SMA200"] if "SMA200" in df.columns else pd.Series([np.nan]*length, index=df.index)

    target_bool = True
    if isinstance(target_val, str):
        if target_val.lower() in ("bullish", "true", "yes", "1"):
            target_bool = True
        elif target_val.lower() in ("bearish", "false", "no", "0"):
            target_bool = False

    if rule_id in ("price_above_ema8", "ema8"):
        s = close > ema8
        res = s if target_bool else ~s
    elif rule_id in ("price_above_ema21", "ema21"):
        s = close > ema21
        res = s if target_bool else ~s
    elif rule_id in ("price_above_sma50", "sma50"):
        s = close > sma50
        res = s if target_bool else ~s
    elif rule_id in ("price_above_sma200", "sma200"):
        s = close > sma200
        res = s if target_bool else ~s
    elif rule_id in ("ema8_above_ema21", "ema_trend"):
        s = ema8 > ema21
        res = s if target_bool else ~s
    elif rule_id == "ema21_above_sma50":
        s = ema21 > sma50
        res = s if target_bool else ~s
    elif rule_id == "sma50_above_sma200":
        s = (sma50 > sma200) & sma200.notna()
        res = s if target_bool else ~s
    elif rule_id in ("daily_mrs_above_zero", "daily_mansfield_rs"):
        mrs = df["mrs_index"] if "mrs_index" in df.columns else pd.Series([0.0]*length, index=df.index)
        val = float(target_val) if isinstance(target_val, (int, float)) else 0.0
        if operator == ">": res = mrs > val
        elif operator == ">=": res = mrs >= val
        elif operator == "<": res = mrs < val
        elif operator == "<=": res = mrs <= val
        elif operator == "!=": res = mrs != val
        else: res = mrs == val
    elif rule_id in ("weekly_mansfield_rs", "weekly_mrs_above_zero"):
        mrs = df["mrs_weekly_index"] if "mrs_weekly_index" in df.columns else pd.Series([0.0]*length, index=df.index)
        val = float(target_val) if isinstance(target_val, (int, float)) else 0.0
        if operator == ">": res = mrs > val
        elif operator == ">=": res = mrs >= val
        elif operator == "<": res = mrs < val
        elif operator == "<=": res = mrs <= val
        elif operator == "!=": res = mrs != val
        else: res = mrs == val

    elif rule_id == "rs_rating_min":
        rs_rat = df["rs_rating"] if "rs_rating" in df.columns else pd.Series([50]*length, index=df.index)
        val = float(target_val) if isinstance(target_val, (int, float)) else 80.0
        if operator == ">": res = rs_rat > val
        elif operator == ">=": res = rs_rat >= val
        elif operator == "<": res = rs_rat < val
        elif operator == "<=": res = rs_rat <= val
        elif operator == "!=": res = rs_rat != val
        else: res = rs_rat == val
    elif rule_id == "rs_new_high_250":
        rs_dot = df["rs_new_high_250"] if "rs_new_high_250" in df.columns else pd.Series([False]*length, index=df.index)
        res = rs_dot == target_bool
    elif rule_id == "rsi14_min":
        rsi = df["rsi14"] if "rsi14" in df.columns else pd.Series([50.0]*length, index=df.index)
        val = float(target_val) if isinstance(target_val, (int, float)) else 50.0
        if operator == ">": res = rsi > val
        elif operator == ">=": res = rsi >= val
        elif operator == "<": res = rsi < val
        elif operator == "<=": res = rsi <= val
        elif operator == "!=": res = rsi != val
        else: res = rsi == val
    elif rule_id == "rel_vol_min":
        v_rat = df["Vol_Ratio"] if "Vol_Ratio" in df.columns else pd.Series([1.0]*length, index=df.index)
        val = float(target_val) if isinstance(target_val, (int, float)) else 1.0
        if operator == ">": res = v_rat > val
        elif operator == ">=": res = v_rat >= val
        elif operator == "<": res = v_rat < val
        elif operator == "<=": res = v_rat <= val
        elif operator == "!=": res = v_rat != val
        else: res = v_rat == val
    elif rule_id in ("pct_off_52wk_high_min", "dist_52w_high"):
        pct_high = df["pct_off_52wk_high"] if "pct_off_52wk_high" in df.columns else pd.Series([0.0]*length, index=df.index)
        val = float(target_val) if isinstance(target_val, (int, float)) else -10.0
        # If user passed 0.10, convert to distance -10.0%
        if 0 < val < 1.0:
            val = -val * 100.0
        elif val > 1.0: # e.g. 10 -> -10%
            val = -abs(val)

        # Distance off high is negative (e.g. -5% is closer to high than -15%).
        # Distance < 10% (0.10) means within 10% of high -> pct_high >= -10.0
        if operator == "<": res = pct_high >= val
        elif operator == "<=": res = pct_high >= val
        elif operator == ">": res = pct_high < val
        elif operator == ">=": res = pct_high < val
        else: res = pct_high >= val


    else:
        res = false_series

    return res.fillna(False)
