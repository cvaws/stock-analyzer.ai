import os
import json
import logging
from typing import Dict, Any
import pandas as pd
from graphs.state import GraphState
from indicators.columns import calculate_market_regime
from config_loader import get_path_config

logger = logging.getLogger(__name__)

def export_reports(state: GraphState) -> dict:
    """
    Exports final scan summary CSV and Theme Tracker / ETF Tracker JSON arrays 
    strictly preserving the exact category ticker order from input CSV files.
    """
    print("---RUNNING NODE: export_reports---")
    output_dir = get_path_config()["outputs_dir"]
    os.makedirs(output_dir, exist_ok=True)

    
    technical_indicators = state.get("technical_indicators", {})
    backtest_results = state.get("backtest_results", {})
    detected_patterns = state.get("detected_patterns", {})
    etf_universe = state.get("etf_universe", {})
    etf_names = state.get("etf_names", {})
    ai_summary = state.get("ai_market_summary", "")

    # Build ordered ticker list based strictly on etf_universe dict insertion order
    ordered_tickers = []
    ticker_to_category = {}
    for cat_name, tickers in etf_universe.items():
        for t in tickers:
            if t not in ticker_to_category:
                ticker_to_category[t] = cat_name
                ordered_tickers.append(t)

    # Add any remaining tickers
    for t in technical_indicators.keys():
        if t not in ticker_to_category:
            ordered_tickers.append(t)

    scan_rows = []
    theme_tracker_items = []

    for ticker in ordered_tickers:
        info = technical_indicators.get(ticker, {})
        if not info:
            continue

        bt = backtest_results.get(ticker, {})
        patterns = detected_patterns.get(ticker, {})
        category = ticker_to_category.get(ticker, "General ETF")
        company_name = etf_names.get(ticker, f"{ticker} ETF")
        
        latest_close = info.get("latest_close", 0.0)
        rs_rating = info.get("rs_rating", 0)
        mrs_index = info.get("mrs_index", 0.0)
        pct_d = info.get("pct_change_d", 0.0)
        pct_w = info.get("pct_change_w", 0.0)
        pct_m = info.get("pct_change_m", 0.0)
        ret_5d = info.get("return_5d", pct_w)
        ret_10d = info.get("return_10d", pct_w)
        above_e8 = info.get("above_ema8", False)
        above_e21 = info.get("above_ema21", False)
        above_s50 = info.get("above_sma50", False)
        pct_52wk = info.get("pct_off_52wk_high", 0.0)
        st_direction = info.get("supertrend_direction", None)  # +1 = Uptrend, -1 = Downtrend
        st_value = info.get("supertrend", None)
        vol_ratio = info.get("vol_ratio", 1.0)
        has_vdu = patterns.get("vdu_signal", False)
        pct_above_base = patterns.get("pct_above_last_base", 0.0)
        rrg_quad = info.get("rrg_quadrant", "Lagging")
        
        scan_rows.append({
            "Ticker": ticker,
            "Description": company_name,
            "Close": latest_close,
            "Change_D": pct_d,
            "Change_W": pct_w,
            "Change_M": pct_m,
            "Return_5D": ret_5d,
            "Return_10D": ret_10d,
            "PctOff52WkHigh": pct_52wk,
            "EMA8": info.get("ema8"),
            "EMA21": info.get("ema21"),
            "SMA50": info.get("sma50"),
            "SMA200": info.get("sma200"),
            "Above_EMA8": above_e8,
            "Above_EMA21": above_e21,
            "Above_SMA50": above_s50,
            "Stage2_Trend": info.get("stage2_trend"),
            "MRS_Index": mrs_index,
            "RS_Rating": rs_rating,
            "RS_Breakout_250": info.get("rs_new_high_250"),
            "RSI14": info.get("rsi14"),
            "Vol_Ratio": vol_ratio,
            "Has_VDU": has_vdu,
            "RRG_Quadrant": rrg_quad,
            "Pct_Above_Base": pct_above_base,
            "Backtest_WinRate": bt.get("win_rate", 0.0),
            "Backtest_ProfitFactor": bt.get("profit_factor", 0.0),
            "Backtest_Trades": bt.get("total_trades", 0)
        })

        rs_daily_pct = info.get("rs_daily_pct", 0.0)
        rs_daily_color = info.get("rs_daily_color", "RED")
        rs_weekly_pct = info.get("rs_weekly_pct", 0.0)
        rs_weekly_color = info.get("rs_weekly_color", "RED")

        theme_tracker_items.append({
            "symbol": ticker,
            "companyName": company_name,
            "price": latest_close,
            "dailyChangePct": pct_d,
            "changeW": pct_w,
            "changeM": pct_m,
            "return5D": ret_5d,
            "return10D": ret_10d,
            "return1M": pct_m,
            "return3M": pct_m,
            "pctOff52WkHigh": pct_52wk,
            "subIndustry": category,
            "sector": category,

            "rsPercentile": rs_rating,
            "rsScore": mrs_index,
            "rsDailyPct": rs_daily_pct,
            "rsDailyColor": rs_daily_color,
            "rsDailyVelocity": info.get("rs_daily_velocity", 0.0),
            "rsWeeklyPct": rs_weekly_pct,
            "rsWeeklyColor": rs_weekly_color,
            "rsWeeklyVelocity": info.get("rs_weekly_velocity", 0.0),
            "rrgQuadrant": rrg_quad,
            "rsRating": rs_rating,
            "mrsIndex": mrs_index,
            "aboveEma8": above_e8,
            "aboveEma21": above_e21,
            "aboveSma50": above_s50,
            "supertrendDirection": st_direction,
            "supertrend": st_value,
            "stage2Trend": info.get("stage2_trend"),
            "rsNewHigh250": info.get("rs_new_high_250"),
            "rsi14": info.get("rsi14"),
            "volRatio": vol_ratio,
            "hasVDU": has_vdu,
            "pctAboveLastBase": pct_above_base,
            "rrgHistory": info.get("rrg_history", [])
        })

    # Identify Current Focus Leaders (Price > Supertrend & ST Bullish & RS Velocity > 0)
    current_focus_leaders = [
        item["symbol"] for item in sorted(
            [item for item in theme_tracker_items if (
                item.get("price", 0) > (item.get("supertrend") or 0) and 
                item.get("supertrendDirection") == 1 and 
                (item.get("rsWeeklyVelocity") or 0) > 0
            )],
            key=lambda x: x.get("rsWeeklyPct") if isinstance(x.get("rsWeeklyPct"), (int, float)) else -999,
            reverse=True
        )[:10]
    ]

    # Calculate Focus Leaders Diffs from previous scan
    last_leaders_file = os.path.join(output_dir, "last_focus_leaders.json")
    last_focus_leaders = []
    if os.path.exists(last_leaders_file):
        try:
            with open(last_leaders_file, "r") as f:
                last_focus_leaders = json.load(f)
        except Exception:
            last_focus_leaders = []

    newly_entered = [sym for sym in current_focus_leaders if sym not in last_focus_leaders]
    newly_exited_symbols = [sym for sym in last_focus_leaders if sym not in current_focus_leaders]
    
    newly_exited = []
    for sym in newly_exited_symbols:
        t_info = technical_indicators.get(sym, {})
        st_dir = t_info.get("supertrend_direction", 0)
        vel = t_info.get("rs_weekly_velocity", 0.0)
        reason = "ST Flipped" if st_dir != 1 else "RS Decel" if vel <= 0 else "Dropped Rank"
        newly_exited.append({"symbol": sym, "reason": reason})

    # Save current focus leaders for next diff
    with open(last_leaders_file, "w") as f:
        json.dump(current_focus_leaders, f, indent=2)

    # Calculate Market Regime Dashboard Metrics
    market_regime_data = calculate_market_regime(technical_indicators, etf_universe)
    market_regime_data["leader_changes"] = {
        "newly_entered": newly_entered,
        "newly_exited": newly_exited,
        "previous_leaders": last_focus_leaders,
        "current_leaders": current_focus_leaders
    }
    market_regime_data["scan_date"] = state.get("scan_date")


    # Save latest_scan.csv
    df_out = pd.DataFrame(scan_rows)
    csv_path = os.path.join(output_dir, "latest_scan.csv")
    df_out.to_csv(csv_path, index=False)

    # Save etfs_tracker.json
    etf_json_path = os.path.join(output_dir, "etfs_tracker.json")
    with open(etf_json_path, "w") as f:
        json.dump(theme_tracker_items, f, indent=2)

    # Save market_regime.json
    regime_json_path = os.path.join(output_dir, "market_regime.json")
    with open(regime_json_path, "w") as f:
        json.dump(market_regime_data, f, indent=2)

    # Save strategy_lab.json (Strategy Lab Registry & Metadata)
    from strategy.indicator_registry import AVAILABLE_RULES, CATEGORY_MAP
    strategy_lab_path = os.path.join(output_dir, "strategy_lab.json")
    saved_strategies = state.get("saved_strategies", [])
    all_strategy_results = state.get("all_strategy_results", {})

    # Build clean portfolio_summary dict — one entry per strategy for dashboard consumption
    portfolio_summary: Dict[str, Any] = {}
    for strat_name, strat_result in all_strategy_results.items():
        ps = strat_result.get("portfolio_simulation")
        if ps:
            portfolio_summary[strat_name] = {
                "starting_capital": ps.get("starting_capital"),
                "ending_capital": ps.get("ending_capital"),
                "total_return_pct": ps.get("total_return_pct"),
                "max_drawdown_pct": ps.get("max_drawdown_pct"),
                "total_capital_deployed": ps.get("total_capital_deployed"),
                "capital_utilization_pct": ps.get("capital_utilization_pct"),
                "trades_taken": ps.get("trades_taken"),
                "trades_skipped": ps.get("trades_skipped"),
                "equity_curve": ps.get("equity_curve", []),
                "config": ps.get("config", {}),
            }

    # Aggregate empirical indicator evidence stats from research DB
    from research.evidence.aggregator import EvidenceAggregator
    indicator_evidence = []
    try:
        indicator_evidence = EvidenceAggregator().compute_indicator_statistics()
    except Exception as e:
        logger.warning(f"Could not compute indicator evidence: {e}")

    with open(strategy_lab_path, "w") as f:
        json.dump({
            "available_rules": AVAILABLE_RULES,
            "categories": list(CATEGORY_MAP.keys()),
            "saved_strategies": saved_strategies,
            "all_strategy_results": all_strategy_results,
            "backtest_results": backtest_results,
            "portfolio_summary": portfolio_summary,
            "indicator_evidence": indicator_evidence,
        }, f, indent=2)



    # Save technical data JSON per ticker for React Dashboard
    tech_dir = os.path.join(output_dir, "tickers", "technical")
    os.makedirs(tech_dir, exist_ok=True)
    ticker_data = state.get("ticker_data", {})
    for ticker, df in ticker_data.items():
        if df is not None and not df.empty:
            df_tech = df.reset_index().copy()
            date_col = next((c for c in df_tech.columns if 'date' in str(c).lower()), df_tech.columns[0])
            df_tech['date_str'] = pd.to_datetime(df_tech[date_col]).dt.strftime('%Y-%m-%d')
            records = []
            for _, r in df_tech.iterrows():
                records.append({
                    "date": str(r["date_str"]),
                    "open": float(r["Open"]) if "Open" in r and pd.notna(r["Open"]) else 0.0,
                    "high": float(r["High"]) if "High" in r and pd.notna(r["High"]) else 0.0,
                    "low": float(r["Low"]) if "Low" in r and pd.notna(r["Low"]) else 0.0,
                    "close": float(r["Close"]) if "Close" in r and pd.notna(r["Close"]) else 0.0,
                    "volume": int(r["Volume"]) if "Volume" in r and pd.notna(r["Volume"]) else 0,
                    "ema8": float(r["EMA8"]) if "EMA8" in r and pd.notna(r["EMA8"]) else None,
                    "ema21": float(r["EMA21"]) if "EMA21" in r and pd.notna(r["EMA21"]) else None,
                    "sma50": float(r["SMA50"]) if "SMA50" in r and pd.notna(r["SMA50"]) else None,
                    "sma200": float(r["SMA200"]) if "SMA200" in r and pd.notna(r["SMA200"]) else None,
                    "mrs_daily_index": float(r["mrs_daily_index"]) if "mrs_daily_index" in r and pd.notna(r["mrs_daily_index"]) else 0.0,
                })
            tech_file = os.path.join(tech_dir, f"{ticker.upper()}.json")
            with open(tech_file, "w") as f:
                json.dump(records, f)

    print(f"Exported outputs strictly ordered to {csv_path}, {etf_json_path}, {regime_json_path}, and {strategy_lab_path}.")

    return {"scan_date": state.get("scan_date"), "market_regime": market_regime_data}



