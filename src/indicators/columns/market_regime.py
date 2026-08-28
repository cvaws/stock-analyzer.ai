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
    Computes ETF Health Score (0 to 4) based on group-specific rules.
    
    For Canaries:
    +1 Close > EMA21
    +1 Close > SMA50
    +1 EMA21 > SMA50
    +1 EMA8 > EMA21
    
    For All Other Groups (Leadership, Breadth, Defense):
    +1 Close > EMA21
    +1 Close > SMA50
    +1 RS_Daily% >= 0
    +1 RS_Weekly% >= 0
    
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
    if group_name == "Canaries":
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
    Calculates Market Regime, Confidence Score, Group Health %, and Outlier Lists.
    """
    group_stats = {}
    health_results = {}
    
    # Calculate health for all categories in etf_universe
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
        
        # Group Status Label
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
    
    # Dynamic Why Bullet Points
    why_bullets = []
    why_bullets.append(f"{'✓' if c_pct >= 60 else 'x'} Canaries {'Healthy' if c_pct >= 60 else 'Lagging'} ({c_pct}%)")
    why_bullets.append(f"{'✓' if b_pct >= 40 else 'x'} Breadth {'Confirming' if b_pct >= 40 else 'Weak'} ({b_pct}%)")
    why_bullets.append(f"{'✓' if l_pct >= 40 else 'x'} Leadership {'Expanding' if l_pct >= 40 else 'Neutral'} ({l_pct}%)")
    why_bullets.append(f"{'✓' if d_pct <= 50 else 'x'} Defense {'Not Leading' if d_pct <= 50 else 'Dominating'} ({d_pct}%)")
    
    return {
        "regime": regime,
        "regime_code": regime_code,
        "confidence": confidence,
        "groups": group_stats,
        "why_bullets": why_bullets,
        "weak_canaries": group_stats.get("Canaries", {}).get("weak_list", []),
        "weak_breadth": group_stats.get("Breadth", {}).get("weak_list", []),
        "strong_defense": group_stats.get("Defense", {}).get("healthy_list", []),
        "health_results": health_results
    }


def calculate_and_save_historical_market_regime(
    technical_indicators: Dict[str, Any], 
    etf_universe: Dict[str, List[str]]
) -> int:
    """
    Computes and persists daily historical Market Regime metrics into SQLite (daily_market_regime table).
    Returns the total number of historical daily regime records saved.
    """
    import sqlite3
    from config_loader import get_path_config

    db_path = get_path_config()["etf_db"]
    conn = sqlite3.connect(db_path)
    
    # Query daily indicators joined with OHLCV and etf_metadata
    query = """
        SELECT 
            i.ticker,
            i.date,
            LOWER(m.etf_group) as etf_group,
            o.close,
            i.ema_8,
            i.ema_21,
            i.sma_50,
            i.mrs_daily_index,
            i.mrs_weekly_index,
            i.supertrend,
            i.supertrend_direction
        FROM etf_daily_indicators i
        JOIN ohlcv o ON i.ticker = o.ticker AND i.date = o.date
        LEFT JOIN etf_metadata m ON i.ticker = m.ticker
        ORDER BY i.date ASC
    """
    try:
        df_all = pd.read_sql_query(query, conn)
    except Exception as e:
        conn.close()
        return 0

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

