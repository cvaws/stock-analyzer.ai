import logging
from typing import Dict, Any
import pandas as pd

from graphs.state import GraphState

from indicators import (
    calculate_moving_averages,
    calculate_volatility_and_volume,
    calculate_mansfield_rs,
    calculate_marketsmith_rs_rating,
    calculate_rs_breakout_dot,
    calculate_rsi,
    calculate_supertrend_series
)
from indicators.columns import (
    calculate_ma_status,
    calculate_performance_returns,
    calculate_pct_off_52wk_high,
    calculate_pct_off_52wk_low,
    calculate_rs_phase_performance
)

logger = logging.getLogger(__name__)

def calculate_indicators(state: GraphState) -> dict:
    """
    Calculates technical indicators for each ETF by delegating to modular functions in src/indicators and src/indicators/columns.
    """
    print("---RUNNING NODE: calculate_indicators---")
    ticker_data = state.get("ticker_data", {})
    etf_universe = state.get("etf_universe", {})
    technical_indicators: Dict[str, Any] = {}

    spy_df = ticker_data.get("SPY", None)
    if spy_df is None or len(spy_df) < 50:
        logger.warning("SPY benchmark data missing or insufficient.")

    for ticker, df in ticker_data.items():
        if df is None or len(df) < 5:
            continue


        try:
            # 1. Apply core moving averages & volatility
            df = calculate_moving_averages(df)
            df = calculate_volatility_and_volume(df)

            # Supertrend on weekly (W-FRI) bars — ohlc4 midpoint
            # Resample daily OHLCV to weekly, compute supertrend, then ffill back to daily index
            date_col_present = "Date" in df.columns and pd.api.types.is_datetime64_any_dtype(df["Date"])
            if date_col_present:
                df_w_st = (
                    df.resample("W-FRI", on="Date")
                    .agg({"Open": "first", "High": "max", "Low": "min", "Close": "last", "Volume": "sum"})
                    .dropna(subset=["Close"])
                )
            elif isinstance(df.index, pd.DatetimeIndex):
                df_w_st = (
                    df.resample("W-FRI")
                    .agg({"Open": "first", "High": "max", "Low": "min", "Close": "last", "Volume": "sum"})
                    .dropna(subset=["Close"])
                )
            else:
                df_w_st = df

            df_w_st = calculate_supertrend_series(df_w_st, atr_period=10, factor=2.61)
            # Forward-fill weekly supertrend values back onto the daily index
            if date_col_present and isinstance(df_w_st.index, pd.DatetimeIndex):
                st_map = df_w_st["supertrend"].asof(df["Date"])
                df["supertrend"] = pd.Series(st_map.values, index=df.index).ffill()
                st_dir_map = df_w_st["supertrend_direction"].asof(df["Date"])
                df["supertrend_direction"] = pd.Series(st_dir_map.values, index=df.index).ffill()
            else:
                df["supertrend"] = df_w_st["supertrend"].reindex(df.index, method="ffill")
                df["supertrend_direction"] = df_w_st["supertrend_direction"].reindex(df.index, method="ffill")

            latest = df.iloc[-1]
            latest_close = float(latest["Close"])

            # 2. Delegate column indicator calculations to src/indicators/columns
            pct_d, pct_w, pct_m, ret_5d, ret_10d = calculate_performance_returns(df)
            pct_52wk_high = calculate_pct_off_52wk_high(df, lookback=252)
            pct_52wk_low = calculate_pct_off_52wk_low(df, lookback=252)

            # ThinkOrSwim RS Phase Performance Parity (Daily & Weekly)
            rs_daily_res = calculate_rs_phase_performance(df, spy_df, length=52, timeframe='daily')
            rs_weekly_res = calculate_rs_phase_performance(df, spy_df, length=52, timeframe='weekly')

            # Calculate RS Velocity (Momentum Acceleration)
            rs_daily_1d_ago = 0.0
            if len(df) > 1:
                df_1d = df.iloc[:-1]
                spy_1d = spy_df.iloc[:-1] if spy_df is not None else None
                rs_daily_1d_res = calculate_rs_phase_performance(df_1d, spy_1d, length=52, timeframe='daily')
                rs_daily_1d_ago = rs_daily_1d_res["result"]
            rs_daily_velocity = rs_daily_res["result"] - rs_daily_1d_ago

            rs_weekly_5d_ago = 0.0
            if len(df) > 5:
                df_5d = df.iloc[:-5]
                spy_5d = spy_df.iloc[:-5] if spy_df is not None else None
                rs_weekly_5d_res = calculate_rs_phase_performance(df_5d, spy_5d, length=52, timeframe='weekly')
                rs_weekly_5d_ago = rs_weekly_5d_res["result"]
            rs_weekly_velocity = rs_weekly_res["result"] - rs_weekly_5d_ago

            # 3. Apply Pine Script Parity functions (length=52 for 52-period / 52-week relative strength)
            mrs_series = calculate_mansfield_rs(df, spy_df, length=52)
            df["mrs_daily_index"] = mrs_series
            # Weekly Mansfield RS calculation (resampled weekly bars)
            if "Date" in df.columns and pd.api.types.is_datetime64_any_dtype(df["Date"]):
                df_w = df.resample("W-FRI", on="Date").last().dropna(subset=["Close"])
            elif isinstance(df.index, pd.DatetimeIndex):
                df_w = df.resample("W-FRI").last().dropna(subset=["Close"])
            else:
                df_w = df

            if spy_df is not None and "Date" in spy_df.columns and pd.api.types.is_datetime64_any_dtype(spy_df["Date"]):
                spy_w = spy_df.resample("W-FRI", on="Date").last().dropna(subset=["Close"])
            elif spy_df is not None and isinstance(spy_df.index, pd.DatetimeIndex):
                spy_w = spy_df.resample("W-FRI").last().dropna(subset=["Close"])
            else:
                spy_w = spy_df

            mrs_w_series = calculate_mansfield_rs(df_w, spy_w, length=52)
            if "Date" in df.columns and isinstance(df_w.index, pd.DatetimeIndex):
                mrs_map = mrs_w_series.asof(df["Date"])
                df["mrs_weekly_index"] = pd.Series(mrs_map.values, index=df.index).ffill().fillna(0.0)
            else:
                df["mrs_weekly_index"] = mrs_w_series.reindex(df.index, method="ffill").fillna(0.0)

            rs_rating = calculate_marketsmith_rs_rating(df, spy_df)

            from indicators import (
                calculate_rsi_series,
                calculate_pct_off_52wk_high_series,
                calculate_pct_off_52wk_low_series
            )
            df["RSI14"] = calculate_rsi_series(df, length=14)
            df["pct_off_52wk_high"] = calculate_pct_off_52wk_high_series(df, lookback=252)
            df["pct_off_52wk_low"] = calculate_pct_off_52wk_low_series(df, lookback=252)

            rs_breakout = calculate_rs_breakout_dot(df, spy_df, lookback=250)
            rsi_val = float(df["RSI14"].iloc[-1]) if not df["RSI14"].empty else 50.0

            # ThinkOrSwim parity MA flags using src/indicators/columns/ma_status.py
            ema8_val = latest["EMA8"] if pd.notna(latest["EMA8"]) else 0.0
            ema21_val = latest["EMA21"] if pd.notna(latest["EMA21"]) else 0.0
            sma50_val = latest["SMA50"] if pd.notna(latest["SMA50"]) else 0.0
            above_ema8 = calculate_ma_status(latest_close, ema8_val)
            above_ema21 = calculate_ma_status(latest_close, ema21_val)
            above_sma50 = calculate_ma_status(latest_close, sma50_val)
            has_s50 = pd.notna(latest["SMA50"])
            has_s200 = pd.notna(latest["SMA200"])

            # Compute Stage 2 Trend and RRG Quadrant
            from indicators.columns import calculate_stage2_trend, calculate_rrg_quadrant
            st_dir = int(latest["supertrend_direction"]) if pd.notna(latest.get("supertrend_direction")) else 0
            mrs_daily_val = float(df["mrs_daily_index"].iloc[-1]) if "mrs_daily_index" in df.columns and pd.notna(df["mrs_daily_index"].iloc[-1]) else 0.0
            stage2_trend_bool = calculate_stage2_trend(df, mrs_daily_val, st_dir)
            rrg_quad = calculate_rrg_quadrant(rs_weekly_res["result"], rs_weekly_velocity)

            # Compute 5-day historical RRG coordinates (trajectory tail)
            rrg_history = []
            if len(df) >= 6:
                for offset in range(4, -1, -1):
                    # sub-dataframe ending at (len(df) - offset)
                    end_idx = len(df) - offset
                    df_slice = df.iloc[:end_idx]
                    spy_slice = spy_df.iloc[:end_idx] if spy_df is not None and len(spy_df) >= end_idx else spy_df
                    slice_date = str(df_slice["Date"].iloc[-1]).split("T")[0].split(" ")[0] if "Date" in df_slice.columns else str(df_slice.index[-1]).split("T")[0].split(" ")[0]
                    
                    rs_w_pt = calculate_rs_phase_performance(df_slice, spy_slice, length=52, timeframe='weekly')
                    # velocity at this slice
                    vel_pt = 0.0
                    if len(df_slice) > 5:
                        df_slice_5d = df_slice.iloc[:-5]
                        spy_slice_5d = spy_slice.iloc[:-5] if spy_slice is not None and len(spy_slice) > 5 else spy_slice
                        rs_w_5d_pt = calculate_rs_phase_performance(df_slice_5d, spy_slice_5d, length=52, timeframe='weekly')
                        vel_pt = rs_w_pt["result"] - rs_w_5d_pt["result"]
                    
                    quad_pt = calculate_rrg_quadrant(rs_w_pt["result"], vel_pt)
                    rrg_history.append({
                        "date": slice_date,
                        "rsWeeklyPct": round(rs_w_pt["result"], 2),
                        "rsWeeklyVelocity": round(vel_pt, 2),
                        "quadrant": quad_pt
                    })
            elif len(df) > 0:
                cur_date = str(df["Date"].iloc[-1]).split("T")[0].split(" ")[0] if "Date" in df.columns else str(df.index[-1]).split("T")[0].split(" ")[0]
                rrg_history.append({
                    "date": cur_date,
                    "rsWeeklyPct": round(rs_weekly_res["result"], 2),
                    "rsWeeklyVelocity": round(rs_weekly_velocity, 2),
                    "quadrant": rrg_quad
                })

            # Save daily calculated indicators into SQLite etf_daily_indicators table
            from graphs.nodes.ingest_etfs import get_db_path
            import sqlite3
            conn = sqlite3.connect(get_db_path())
            cursor = conn.cursor()
            
            rows_to_insert = []
            for idx, row in df.iterrows():
                date_val = str(row["Date"]).split("T")[0].split(" ")[0] if "Date" in row else str(idx).split("T")[0].split(" ")[0]
                ema_8_val = float(row["EMA8"]) if "EMA8" in row and pd.notna(row["EMA8"]) else 0.0
                ema_13_val = float(row["EMA13"]) if "EMA13" in row and pd.notna(row["EMA13"]) else 0.0
                ema_21_val = float(row["EMA21"]) if "EMA21" in row and pd.notna(row["EMA21"]) else 0.0
                sma_50_val = float(row["SMA50"]) if "SMA50" in row and pd.notna(row["SMA50"]) else 0.0
                ema_65_val = float(row["EMA65"]) if "EMA65" in row and pd.notna(row["EMA65"]) else 0.0
                sma_200_val = float(row["SMA200"]) if "SMA200" in row and pd.notna(row["SMA200"]) else 0.0
                rsi_14_val = float(row["RSI14"]) if "RSI14" in row and pd.notna(row["RSI14"]) else 50.0
                atr_14_val = float(row["ATR14"]) if "ATR14" in row and pd.notna(row["ATR14"]) else 0.0
                atr14_pct_val = float(row["ATR14_Pct"]) if "ATR14_Pct" in row and pd.notna(row["ATR14_Pct"]) else 0.0
                vol_ma20_val = float(row["Vol_MA20"]) if "Vol_MA20" in row and pd.notna(row["Vol_MA20"]) else 0.0
                vol_ratio_val = float(row["Vol_Ratio"]) if "Vol_Ratio" in row and pd.notna(row["Vol_Ratio"]) else 0.0
                vol_ma20_ratio_val = float(row["Vol_MA20_Ratio"]) if "Vol_MA20_Ratio" in row and pd.notna(row["Vol_MA20_Ratio"]) else 0.0
                mrs_d_val = float(row["mrs_daily_index"]) if "mrs_daily_index" in row and pd.notna(row["mrs_daily_index"]) else 0.0
                mrs_w_val = float(row["mrs_weekly_index"]) if "mrs_weekly_index" in row and pd.notna(row["mrs_weekly_index"]) else 0.0
                return_20d_pct_val = float(row["Return_20D_Pct"]) if "Return_20D_Pct" in row and pd.notna(row["Return_20D_Pct"]) else 0.0
                pct_h_val = float(row["pct_off_52wk_high"]) if "pct_off_52wk_high" in row and pd.notna(row["pct_off_52wk_high"]) else 0.0
                pct_l_val = float(row["pct_off_52wk_low"]) if "pct_off_52wk_low" in row and pd.notna(row["pct_off_52wk_low"]) else 0.0
                st_val = float(row["supertrend"]) if "supertrend" in row and pd.notna(row["supertrend"]) else None
                st_dir_val = int(row["supertrend_direction"]) if "supertrend_direction" in row and pd.notna(row["supertrend_direction"]) else None
                rows_to_insert.append((ticker, date_val, ema_8_val, ema_13_val, ema_21_val, sma_50_val, ema_65_val, sma_200_val, rsi_14_val, atr_14_val, atr14_pct_val, vol_ma20_val, vol_ratio_val, vol_ma20_ratio_val, mrs_d_val, mrs_w_val, return_20d_pct_val, pct_h_val, pct_l_val, st_val, st_dir_val))

            cursor.executemany("""
                INSERT INTO etf_daily_indicators (
                    ticker, date, ema_8, ema_13, ema_21, sma_50, ema_65, sma_200, rsi_14, atr_14, atr14_pct,
                    vol_ma20, vol_ratio, vol_ma20_ratio, mrs_daily_index, mrs_weekly_index, return_20d_pct,
                    pct_off_52wk_high, pct_off_52wk_low, supertrend, supertrend_direction
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(ticker, date) DO UPDATE SET
                    ema_8=excluded.ema_8,
                    ema_13=excluded.ema_13,
                    ema_21=excluded.ema_21,
                    sma_50=excluded.sma_50,
                    ema_65=excluded.ema_65,
                    sma_200=excluded.sma_200,
                    rsi_14=excluded.rsi_14,
                    atr_14=excluded.atr_14,
                    atr14_pct=excluded.atr14_pct,
                    vol_ma20=excluded.vol_ma20,
                    vol_ratio=excluded.vol_ratio,
                    vol_ma20_ratio=excluded.vol_ma20_ratio,
                    mrs_daily_index=excluded.mrs_daily_index,
                    mrs_weekly_index=excluded.mrs_weekly_index,
                    return_20d_pct=excluded.return_20d_pct,
                    pct_off_52wk_high=excluded.pct_off_52wk_high,
                    pct_off_52wk_low=excluded.pct_off_52wk_low,
                    supertrend=excluded.supertrend,
                    supertrend_direction=excluded.supertrend_direction
            """, rows_to_insert)
            conn.commit()
            conn.close()

            technical_indicators[ticker] = {
                "latest_close": round(latest_close, 2),
                "pct_change_d": pct_d,
                "pct_change_w": pct_w,
                "pct_change_m": pct_m,
                "return_5d": ret_5d,
                "return_10d": ret_10d,
                "pct_off_52wk_high": pct_52wk_high,
                "rs_daily_pct": rs_daily_res["result"],
                "rs_daily_color": rs_daily_res["color_flag"],
                "rs_daily_velocity": rs_daily_velocity,
                "rs_weekly_pct": rs_weekly_res["result"],
                "rs_weekly_color": rs_weekly_res["color_flag"],
                "rs_weekly_velocity": rs_weekly_velocity,
                "rrg_quadrant": rrg_quad,
                "ema8": round(float(latest["EMA8"]), 2) if pd.notna(latest["EMA8"]) else None,
                "ema21": round(float(latest["EMA21"]), 2) if pd.notna(latest["EMA21"]) else None,
                "sma50": round(float(latest["SMA50"]), 2) if pd.notna(latest["SMA50"]) else None,
                "sma200": round(float(latest["SMA200"]), 2) if pd.notna(latest["SMA200"]) else None,
                "above_ema8": above_ema8,
                "above_ema21": above_ema21,
                "above_sma50": above_sma50,
                "atr14": round(float(latest["ATR14"]), 2) if pd.notna(latest["ATR14"]) else None,
                "vol_ratio": round(float(latest["Vol_Ratio"]), 2) if pd.notna(latest["Vol_Ratio"]) else None,
                "stage2_trend": stage2_trend_bool,
                "rs_rating": rs_rating,
                "rs_new_high_250": rs_breakout,
                "rsi14": rsi_val,
                "supertrend": round(float(latest["supertrend"]), 4) if pd.notna(latest.get("supertrend")) else None,
                "supertrend_direction": int(latest["supertrend_direction"]) if pd.notna(latest.get("supertrend_direction")) else None,
                "rrg_history": rrg_history,
                "df": df
            }

            ticker_data[ticker] = df
        except Exception as e:
            logger.error(f"Error calculating indicators for {ticker}: {e}")

    print(f"Calculated modular column indicators for {len(technical_indicators)} ETFs.")
    
    # Compute and persist historical daily market regime into SQLite
    from indicators.columns.market_regime import calculate_and_save_historical_market_regime
    regime_count = calculate_and_save_historical_market_regime(technical_indicators, etf_universe)
    print(f"Persisted historical daily market regime across {regime_count} dates into SQLite.")

    return {"technical_indicators": technical_indicators, "ticker_data": ticker_data}

