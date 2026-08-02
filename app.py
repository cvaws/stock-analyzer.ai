import os
import json
import sqlite3
import pandas as pd
import streamlit as st
import plotly.graph_objects as go

# Page Config - Modern Dark Theme Layout
st.set_page_config(
    page_title="Stock Analyzer AI - ETF Dashboard",
    page_icon="📈",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS for Glassmorphism styling matching original dashboard aesthetics
st.markdown("""
<style>
    .main { background-color: #0d1117; color: #c9d1d9; }
    .stMetric { background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 12px; }
    .card { background: rgba(22, 27, 34, 0.8); border: 1px solid #30363d; border-radius: 12px; padding: 20px; margin-bottom: 20px; }
    .badge-vcp { background: #ab47bc; color: white; padding: 4px 8px; border-radius: 6px; font-weight: bold; font-size: 0.8rem; }
    .badge-rs { background: #26a69a; color: white; padding: 4px 8px; border-radius: 6px; font-weight: bold; font-size: 0.8rem; }
</style>
""", unsafe_allow_html=True)


import sys
sys.path.append(os.path.join(os.path.dirname(__file__), "src"))
from config_loader import get_path_config

DB_PATH = get_path_config()["etf_db"]
CSV_PATH = "data/outputs/latest_scan.csv"
JSON_PATH = "data/outputs/theme_tracker.json"

@st.cache_data
def load_scan_data():
    if os.path.exists(CSV_PATH):
        return pd.read_csv(CSV_PATH)
    return pd.DataFrame()

@st.cache_data
def load_theme_data():
    if os.path.exists(JSON_PATH):
        with open(JSON_PATH, "r") as f:
            return json.load(f)
    return {}

def load_ohlcv_from_db(ticker: str) -> pd.DataFrame:
    if not os.path.exists(DB_PATH):
        return pd.DataFrame()
    conn = sqlite3.connect(DB_PATH)
    query = "SELECT date, open, high, low, close, volume FROM ohlcv WHERE ticker = ? ORDER BY date ASC"
    df = pd.read_sql_query(query, conn, params=(ticker,))
    conn.close()
    if not df.empty:
        df['date'] = pd.to_datetime(df['date'])
        df.set_index('date', inplace=True)
    return df

# Sidebar Navigation
st.sidebar.title("📊 Stock Analyzer AI")
page = st.sidebar.radio("Navigation", ["Market Overview", "Theme & ETF Scanner", "Technical Charting", "Strategy Backtests"])

scan_df = load_scan_data()
theme_data = load_theme_data()

# ----------------------------------------------------
# PAGE 1: MARKET OVERVIEW
# ----------------------------------------------------
if page == "Market Overview":
    st.header("📈 Market Regime & Overview")
    
    # AI Strategy Summary Card
    ai_summary = theme_data.get("ai_market_summary", "No AI summary available.")
    st.markdown(f"""
    <div class="card">
        <h3>🧠 AI Market Analyst Summary (gemma4:26b)</h3>
        <p style="white-space: pre-line; line-height: 1.6;">{ai_summary}</p>
    </div>
    """, unsafe_allow_html=True)


    # Top Key Metrics Row
    col1, col2, col3, col4 = st.columns(4)
    with col1:
        st.metric("Total ETFs Scanned", len(scan_df))
    with col2:
        stage2_count = len(scan_df[scan_df["Stage2_Trend"] == True]) if "Stage2_Trend" in scan_df else 0
        st.metric("Stage 2 Uptrend ETFs", stage2_count)
    with col3:
        top_rs_count = len(scan_df[scan_df["RS_Rating"] >= 90]) if "RS_Rating" in scan_df else 0
        st.metric("Top RS Rating (>=90)", top_rs_count)
    with col4:
        breakout_count = len(scan_df[scan_df["RS_Breakout_250"] == True]) if "RS_Breakout_250" in scan_df else 0
        st.metric("MarketSmith RS New Highs", breakout_count)

    st.subheader("Top Leaderboard")
    if not scan_df.empty:
        top_df = scan_df.sort_values(by="RS_Rating", ascending=False).head(15)
        st.dataframe(top_df[["Ticker", "Close", "RS_Rating", "MRS_Index", "RSI14", "Stage2_Trend", "Backtest_WinRate", "Backtest_ProfitFactor"]], use_container_width=True)

# ----------------------------------------------------
# PAGE 2: THEME & ETF SCANNER
# ----------------------------------------------------
elif page == "Theme & ETF Scanner":
    st.header("🔥 Theme Tracker & Sector Performance")
    
    if not scan_df.empty:
        col_search, col_filter = st.columns([2, 1])
        with col_search:
            search_ticker = st.text_input("Search Ticker", "").upper()
        with col_filter:
            filter_stage2 = st.checkbox("Show Only Stage 2 Uptrends", value=False)
        
        filtered_df = scan_df.copy()
        if search_ticker:
            filtered_df = filtered_df[filtered_df["Ticker"].str.contains(search_ticker)]
        if filter_stage2:
            filtered_df = filtered_df[filtered_df["Stage2_Trend"] == True]

        st.dataframe(filtered_df, use_container_width=True, height=600)

# ----------------------------------------------------
# PAGE 3: TECHNICAL CHARTING (TradingView Style)
# ----------------------------------------------------
elif page == "Technical Charting":
    st.header("🔍 Technical Charting Engine")
    
    if not scan_df.empty:
        ticker_list = sorted(scan_df["Ticker"].unique().tolist())
        selected_ticker = st.selectbox("Select ETF Ticker", ticker_list, index=0)
        
        df_chart = load_ohlcv_from_db(selected_ticker)
        
        if not df_chart.empty:
            # Render Candlestick Chart with EMAs
            fig = go.Figure()
            fig.add_trace(go.Candlestick(
                x=df_chart.index,
                open=df_chart['open'],
                high=df_chart['high'],
                low=df_chart['low'],
                close=df_chart['close'],
                name="OHLC"
            ))
            
            fig.update_layout(
                title=f"{selected_ticker} Daily Price Chart (Source: SQLite DB)",
                template="plotly_dark",
                height=600,
                xaxis_rangeslider_visible=False
            )
            st.plotly_chart(fig, use_container_width=True)
            
            # Show Indicator Info
            info_row = scan_df[scan_df["Ticker"] == selected_ticker]
            if not info_row.empty:
                st.write(info_row.to_dict(orient="records")[0])
        else:
            st.info(f"No OHLCV history found in SQLite database for {selected_ticker}.")

# ----------------------------------------------------
# PAGE 4: STRATEGY BACKTESTS
# ----------------------------------------------------
elif page == "Strategy Backtests":
    st.header("⚡ Strategy Backtest Analytics")
    
    if not scan_df.empty and "Backtest_WinRate" in scan_df:
        bt_df = scan_df.sort_values(by="Backtest_ProfitFactor", ascending=False)
        
        col1, col2 = st.columns(2)
        with col1:
            st.subheader("Top Profit Factor Strategies")
            st.dataframe(bt_df[["Ticker", "Backtest_WinRate", "Backtest_ProfitFactor", "Backtest_Trades"]].head(15), use_container_width=True)
        with col2:
            st.subheader("Win Rate Distribution")
            fig_hist = go.Figure(data=[go.Histogram(x=scan_df["Backtest_WinRate"], nbinsx=10)])
            fig_hist.update_layout(template="plotly_dark", title="Win Rate % Distribution")
            st.plotly_chart(fig_hist, use_container_width=True)
