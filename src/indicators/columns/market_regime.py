import sqlite3
import pandas as pd
from typing import Dict, Any, List

def calculate_etf_health_score(
    ticker: str, 
    group_name: str, 
    df: pd.DataFrame, 
    rs_daily_pct: float, 
    rs_weekly_pct: float
) -> Dict[str, Any]:
    """
    Computes ETF Health Score (0 to 5) based on group-specific rules.
    
    For Standard Canaries (SPY, QQQ, IWM, SMH, SPMO):
    +1 Close > EMA21
    +1 Close > SMA50
    +1 EMA21 > SMA50
    +1 EMA8 > EMA21
    +1 Supertrend Bullish (Close > ST and dir == 1)
    
    For Inverted Canaries (TLT, VIXY):
    Bonds and Volatility products are counter-indicators for equities.
    +1 Close < EMA21 (Weak bond/fear is bullish for equities)
    +1 Close < SMA50
    +1 EMA21 < SMA50
    +1 EMA8 < EMA21
    +1 Supertrend Bearish (Close < ST and dir == -1)
    
    For All Other Groups (Leadership, Breadth, Defense):
    +1 Close > EMA21
    +1 Close > SMA50
    +1 RS_Daily% >= 0
    +1 RS_Weekly% >= 0
    +1 Supertrend Bullish (Close > ST and dir == 1)
    
    Healthy ETF = Score >= 3
    """
    if df.empty or len(df) < 2:
        return {"score": 0, "status": "Very Weak", "is_healthy": False}
    
    latest = df.iloc[-1]
    close_price = float(latest["Close"])
    ema8 = float(latest["EMA8"]) if "EMA8" in latest and pd.notna(latest["EMA8"]) else 0.0
    ema21 = float(latest["EMA21"]) if "EMA21" in latest and pd.notna(latest["EMA21"]) else 0.0
    sma50 = float(latest["SMA50"]) if "SMA50" in latest and pd.notna(latest["SMA50"]) else 0.0
    st_val = float(latest["supertrend"]) if "supertrend" in latest and pd.notna(latest["supertrend"]) else None
    st_dir = float(latest["supertrend_direction"]) if "supertrend_direction" in latest and pd.notna(latest["supertrend_direction"]) else None
    
    score = 0
    upper_ticker = ticker.upper()

    if upper_ticker in ["TLT", "VIXY", "UVXY", "VXX"]:
        # Inverted Canary Logic (Weakness in Bonds/VIX = Bullish for Equities)
        if close_price < ema21: score += 1
        if close_price < sma50: score += 1
        if ema21 < sma50: score += 1
        if ema8 < ema21: score += 1
        if st_val is not None and st_dir is not None and (close_price < st_val or st_dir == -1): score += 1
    elif group_name == "Canaries":
        if close_price > ema21: score += 1
        if close_price > sma50: score += 1
        if ema21 > sma50: score += 1
        if ema8 > ema21: score += 1
        if st_val is not None and st_dir is not None and close_price > st_val and st_dir == 1: score += 1
    else:
        if close_price > ema21: score += 1
        if close_price > sma50: score += 1
        if rs_daily_pct >= 0.0: score += 1
        if rs_weekly_pct >= 0.0: score += 1
        if st_val is not None and st_dir is not None and close_price > st_val and st_dir == 1: score += 1
        
    is_healthy = score >= 3
    
    status_map = {
        5: "Strong",
        4: "Healthy",
        3: "Healthy",
        2: "Neutral",
        1: "Weak",
        0: "Very Weak"
    }
    
    return {
        "score": score,
        "status": status_map.get(score, "Very Weak"),
        "is_healthy": is_healthy
    }

def calculate_market_regime(
    technical_indicators: Dict[str, Any], 
    etf_universe: Dict[str, List[str]]
) -> Dict[str, Any]:
    """
    Calculates Market Regime, Confidence Score, Group Health %, Macro Context,
    Distribution Days on SPY/QQQ, 5-Day Group Trends, and Divergence Warnings.
    """
    group_stats = {}
    health_results = {}
    
    target_groups = list(etf_universe.keys()) if etf_universe else ["Canaries", "Leadership", "Breadth", "Defense", "Leveraged_Long", "Leveraged_Short"]
    
    for group in target_groups:
        tickers = etf_universe.get(group, [])
        total = len(tickers)
        healthy_count = 0
        healthy_list = []
        weak_list = []
        
        for t in tickers:
            info = technical_indicators.get(t, {})
            df = info.get("df", pd.DataFrame())
            rs_daily = info.get("rs_daily_pct", 0.0)
            rs_weekly = info.get("rs_weekly_pct", 0.0)
            
            res = calculate_etf_health_score(t, group, df, rs_daily, rs_weekly)
            health_results[t] = res
            
            if res["is_healthy"]:
                healthy_count += 1
                healthy_list.append(t)
            else:
                weak_list.append(t)
                
        pct = round((healthy_count / total * 100), 1) if total > 0 else 0.0
        
        if pct >= 75.0:
            status = "Strong"
        elif pct >= 50.0:
            status = "Healthy"
        elif pct >= 30.0:
            status = "Neutral"
        else:
            status = "Quiet"
            
        group_stats[group] = {
            "healthy": healthy_count,
            "total": total,
            "percent": pct,
            "status": status,
            "healthy_list": healthy_list,
            "weak_list": weak_list
        }
        
    c_pct = group_stats.get("Canaries", {}).get("percent", 0.0)
    l_pct = group_stats.get("Leadership", {}).get("percent", 0.0)
    b_pct = group_stats.get("Breadth", {}).get("percent", 0.0)
    d_pct = group_stats.get("Defense", {}).get("percent", 0.0)
    
    # Market Regime Rules
    if c_pct >= 80.0 and l_pct >= 70.0 and b_pct >= 70.0 and d_pct <= 30.0:
        regime = "🟢 PRESS GAS"
        regime_code = "PRESS_GAS"
    elif c_pct >= 60.0 and l_pct >= 40.0 and b_pct >= 40.0 and d_pct <= 50.0:
        regime = "🟡 HALF SIZE"
        regime_code = "HALF_SIZE"
    else:
        regime = "🔴 STEP ASIDE"
        regime_code = "STEP_ASIDE"
        
    # Confidence Score Calculation
    confidence = round(0.40 * c_pct + 0.30 * l_pct + 0.20 * b_pct + 0.10 * (100.0 - d_pct), 1)
    
    # Distribution Day Counter on SPY and QQQ (25-session window)
    def compute_distribution_days(ticker_symbol: str) -> int:
        info = technical_indicators.get(ticker_symbol, {})
        df_bench = info.get("df", pd.DataFrame())
        if df_bench.empty or len(df_bench) < 25:
            return 0
        window = df_bench.iloc[-25:]
        dist_count = 0
        for i in range(1, len(window)):
            prev_c = window["Close"].iloc[i-1]
            curr_c = window["Close"].iloc[i]
            pct_chg = ((curr_c - prev_c) / prev_c) * 100 if prev_c > 0 else 0.0
            vol_rat = window["Vol_Ratio"].iloc[i] if "Vol_Ratio" in window.columns and pd.notna(window["Vol_Ratio"].iloc[i]) else 1.0
            if pct_chg < -0.2 and vol_rat > 1.0:
                dist_count += 1
        return dist_count

    spy_dist_days = compute_distribution_days("SPY")
    qqq_dist_days = compute_distribution_days("QQQ")

    # Macro Context Status (TLT, VIXY)
    tlt_health = health_results.get("TLT", {}).get("is_healthy", False)
    vixy_health = health_results.get("VIXY", {}).get("is_healthy", False)
    macro_context = {
        "tlt_bullish_for_equities": tlt_health,
        "vixy_bullish_for_equities": vixy_health,
        "summary": "Risk-On (Bonds/VIX Suppressed)" if (tlt_health and vixy_health) else "Macro Caution / Hedging" if (not tlt_health or not vixy_health) else "Neutral"
    }

    # Cross-Category Divergence Warnings
    divergence_warnings = []
    if l_pct >= 70.0 and b_pct < 50.0:
        divergence_warnings.append("⚠️ Narrow Market: Leadership expanding without Breadth confirmation.")
    if d_pct >= 60.0 and regime_code == "PRESS_GAS":
        divergence_warnings.append("⚠️ Defensive Rotation: Defense dominating despite Bull regime.")
    if c_pct >= 80.0 and l_pct < 40.0:
        divergence_warnings.append("⚠️ Canary Divergence: Index Canaries strong but thematic Leadership lagging.")

    # Historical 5-Day Trend Delta
    group_trends = {
        "Canaries": 0.0,
        "Leadership": 0.0,
        "Breadth": 0.0,
        "Defense": 0.0
    }
    try:
        from config_loader import get_path_config
        db_path = get_path_config()["etf_db"]
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        cur.execute("SELECT canaries_health, leadership_health, breadth_health, defense_health FROM daily_market_regime ORDER BY date DESC LIMIT 6")
        rows = cur.fetchall()
        conn.close()
        if len(rows) >= 6:
            past = rows[-1]
            group_trends["Canaries"] = round(c_pct - past[0], 1)
            group_trends["Leadership"] = round(l_pct - past[1], 1)
            group_trends["Breadth"] = round(b_pct - past[2], 1)
            group_trends["Defense"] = round(d_pct - past[3], 1)
    except Exception:
        pass

    # Dynamic Why Bullet Points
    why_bullets = []
    why_bullets.append(f"{'✓' if c_pct >= 60 else 'x'} Canaries {'Healthy' if c_pct >= 60 else 'Lagging'} ({c_pct}%)")
    why_bullets.append(f"{'✓' if b_pct >= 40 else 'x'} Breadth {'Confirming' if b_pct >= 40 else 'Weak'} ({b_pct}%)")
    why_bullets.append(f"{'✓' if l_pct >= 40 else 'x'} Leadership {'Expanding' if l_pct >= 40 else 'Neutral'} ({l_pct}%)")
    why_bullets.append(f"{'✓' if d_pct <= 50 else 'x'} Defense {'Not Leading' if d_pct <= 50 else 'Dominating'} ({d_pct}%)")
    if spy_dist_days >= 4:
        why_bullets.append(f"⚠️ SPY Distribution elevated ({spy_dist_days} days in last 25 sessions)")

    return {
        "regime": regime,
        "regime_code": regime_code,
        "confidence": confidence,
        "groups": group_stats,
        "group_trends": group_trends,
        "why_bullets": why_bullets,
        "weak_canaries": group_stats.get("Canaries", {}).get("weak_list", []),
        "weak_breadth": group_stats.get("Breadth", {}).get("weak_list", []),
        "strong_defense": group_stats.get("Defense", {}).get("healthy_list", []),
        "spy_dist_days": spy_dist_days,
        "qqq_dist_days": qqq_dist_days,
        "macro_context": macro_context,
        "divergence_warnings": divergence_warnings,
        "health_results": health_results
    }


def calculate_and_save_historical_market_regime(technical_indicators: Dict[str, Any], etf_universe: Dict[str, List[str]]) -> int:
    """
    Computes historical market regime daily series and bulk upserts into daily_market_regime table.
    """
    from graphs.nodes.ingest_etfs import get_db_path
    import sqlite3
    
    conn = sqlite3.connect(get_db_path())
    query = """
        SELECT i.ticker, i.date, i.ema_8, i.ema_13, i.ema_21, i.sma_50, i.supertrend, i.supertrend_direction, 
               i.mrs_daily_index, i.mrs_weekly_index, b.close, u.etf_group
        FROM etf_daily_indicators i
        JOIN ohlcv b ON i.ticker = b.ticker AND i.date = b.date
        LEFT JOIN etf_metadata u ON i.ticker = u.ticker
    """
    df_all = pd.read_sql_query(query, conn)
    if df_all.empty:
        conn.close()
        return 0

    # Build ticker to category mapping from etf_universe fallback
    ticker_cat_map = {}
    for cat_name, tickers in etf_universe.items():
        for t in tickers:
            ticker_cat_map[t] = cat_name

    target_groups = ["Canaries", "Leadership", "Breadth", "Defense"]
    
    # Evaluate health per ticker per row
    def check_healthy(row):
        cat = row["etf_group"]
        if pd.isna(cat) or not cat:
            cat = ticker_cat_map.get(row["ticker"], "General ETF")
        cat = str(cat).capitalize()
        
        close = row["close"]
        ema8 = row["ema_8"]
        ema21 = row["ema_21"]
        sma50 = row["sma_50"]
        mrs_d = row["mrs_daily_index"]
        mrs_w = row["mrs_weekly_index"]
        st_val = row["supertrend"]
        st_dir = row["supertrend_direction"]
        
        score = 0
        if cat == "Canaries":
            if pd.notna(close) and pd.notna(ema21) and close > ema21: score += 1
            if pd.notna(close) and pd.notna(sma50) and close > sma50: score += 1
            if pd.notna(ema21) and pd.notna(sma50) and ema21 > sma50: score += 1
            if pd.notna(ema8) and pd.notna(ema21) and ema8 > ema21: score += 1
            if pd.notna(close) and pd.notna(st_val) and pd.notna(st_dir) and close > st_val and st_dir == 1: score += 1
        else:
            if pd.notna(close) and pd.notna(ema21) and close > ema21: score += 1
            if pd.notna(close) and pd.notna(sma50) and close > sma50: score += 1
            if pd.notna(mrs_d) and mrs_d >= 0.0: score += 1
            if pd.notna(mrs_w) and mrs_w >= 0.0: score += 1
            if pd.notna(close) and pd.notna(st_val) and pd.notna(st_dir) and close > st_val and st_dir == 1: score += 1
        return score >= 3, cat

    df_all["is_healthy"], df_all["norm_cat"] = zip(*df_all.apply(check_healthy, axis=1))

    # Group by date and calculate group health %
    regime_rows = []
    for date_str, group_df in df_all.groupby("date"):
        c_df = group_df[group_df["norm_cat"] == "Canaries"]
        l_df = group_df[group_df["norm_cat"] == "Leadership"]
        b_df = group_df[group_df["norm_cat"] == "Breadth"]
        d_df = group_df[group_df["norm_cat"] == "Defense"]
        
        c_pct = round((c_df["is_healthy"].sum() / len(c_df) * 100), 1) if len(c_df) > 0 else 0.0
        l_pct = round((l_df["is_healthy"].sum() / len(l_df) * 100), 1) if len(l_df) > 0 else 0.0
        b_pct = round((b_df["is_healthy"].sum() / len(b_df) * 100), 1) if len(b_df) > 0 else 0.0
        d_pct = round((d_df["is_healthy"].sum() / len(d_df) * 100), 1) if len(d_df) > 0 else 0.0
        
        if c_pct >= 80.0 and l_pct >= 70.0 and b_pct >= 70.0 and d_pct <= 30.0:
            regime = "🟢 PRESS GAS"
            regime_code = "PRESS_GAS"
        elif c_pct >= 60.0 and l_pct >= 40.0 and b_pct >= 40.0 and d_pct <= 50.0:
            regime = "🟡 HALF SIZE"
            regime_code = "HALF_SIZE"
        else:
            regime = "🔴 STEP ASIDE"
            regime_code = "STEP_ASIDE"
            
        confidence = round(0.40 * c_pct + 0.30 * l_pct + 0.20 * b_pct + 0.10 * (100.0 - d_pct), 1)
        
        regime_rows.append((
            str(date_str), regime, regime_code, confidence, c_pct, l_pct, b_pct, d_pct
        ))

    # Bulk upsert into daily_market_regime table
    cursor = conn.cursor()
    cursor.executemany("""
        INSERT INTO daily_market_regime (date, regime, regime_code, confidence, canaries_health, leadership_health, breadth_health, defense_health)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(date) DO UPDATE SET
            regime=excluded.regime,
            regime_code=excluded.regime_code,
            confidence=excluded.confidence,
            canaries_health=excluded.canaries_health,
            leadership_health=excluded.leadership_health,
            breadth_health=excluded.breadth_health,
            defense_health=excluded.defense_health
    """, regime_rows)
    
    conn.commit()
    conn.close()
    return len(regime_rows)

