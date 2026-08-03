import os
import sqlite3
import logging
from typing import Dict, Any, List, Optional
import pandas as pd
import yfinance as yf
from graphs.state import GraphState
from config_loader import get_path_config

logger = logging.getLogger(__name__)

def get_db_path() -> str:
    """Returns ETF database path from config.yaml."""
    return get_path_config()["etf_db"]

def init_db():
    """Initializes SQLite database tables for historical OHLCV data and ETF metadata."""
    db_path = get_db_path()
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS ohlcv (
            ticker TEXT,
            date TEXT,
            open REAL,
            high REAL,
            low REAL,
            close REAL,
            volume INTEGER,
            PRIMARY KEY (ticker, date)
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS etf_metadata (
            ticker TEXT PRIMARY KEY,
            company_name TEXT,
            etf_group TEXT,
            etf_market TEXT,
            summary TEXT
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS etf_daily_indicators (
            ticker TEXT,
            date TEXT,
            ema_8 REAL,
            ema_13 REAL,
            ema_21 REAL,
            sma_50 REAL,
            ema_65 REAL,
            sma_200 REAL,
            rsi_14 REAL,
            atr_14 REAL,
            atr14_pct REAL,
            vol_ma20 REAL,
            vol_ratio REAL,
            vol_ma20_ratio REAL,
            mrs_daily_index REAL,
            mrs_weekly_index REAL,
            return_20d_pct REAL,
            pct_off_52wk_high REAL,
            pct_off_52wk_low REAL,
            PRIMARY KEY (ticker, date)
        )
    """)

    cursor.execute("""

        CREATE TABLE IF NOT EXISTS daily_market_regime (
            date TEXT PRIMARY KEY,
            regime TEXT,

            regime_code TEXT,
            confidence REAL,
            canaries_health REAL,
            leadership_health REAL,
            breadth_health REAL,
            defense_health REAL
        )
    """)
    conn.commit()
    conn.close()


def get_latest_stored_date(ticker: str) -> Optional[str]:
    """Returns the latest stored YYYY-MM-DD date string for a ticker from SQLite."""
    conn = sqlite3.connect(get_db_path())
    cursor = conn.cursor()
    cursor.execute("SELECT MAX(date) FROM ohlcv WHERE ticker = ?", (ticker,))
    row = cursor.fetchone()
    conn.close()
    return row[0] if row and row[0] else None

def save_ohlcv_to_sqlite(ticker: str, df: pd.DataFrame):
    """Inserts or updates daily OHLCV rows for a ticker into SQLite database without duplicates."""
    if df.empty:
        return
    conn = sqlite3.connect(get_db_path())
    cursor = conn.cursor()

    
    df_db = df.reset_index().copy()
    date_col = next((c for c in df_db.columns if 'date' in str(c).lower()), df_db.columns[0])
    df_db.rename(columns={date_col: 'date'}, inplace=True)
    df_db['date'] = pd.to_datetime(df_db['date']).dt.strftime('%Y-%m-%d')
    
    for _, row in df_db.iterrows():
        cursor.execute("""
            INSERT INTO ohlcv (ticker, date, open, high, low, close, volume)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(ticker, date) DO UPDATE SET
                open=excluded.open,
                high=excluded.high,
                low=excluded.low,
                close=excluded.close,
                volume=excluded.volume
        """, (
            ticker, 
            row['date'], 
            float(row['Open']) if pd.notna(row['Open']) else None,
            float(row['High']) if pd.notna(row['High']) else None,
            float(row['Low']) if pd.notna(row['Low']) else None,
            float(row['Close']) if pd.notna(row['Close']) else None,
            int(row['Volume']) if pd.notna(row['Volume']) else 0
        ))
    conn.commit()
    conn.close()

def get_full_ohlcv_from_sqlite(ticker: str) -> pd.DataFrame:
    """Retrieves full historical OHLCV DataFrame for a ticker from SQLite."""
    conn = sqlite3.connect(get_db_path())
    df = pd.read_sql("SELECT date, open, high, low, close, volume FROM ohlcv WHERE ticker = ? ORDER BY date ASC", conn, params=(ticker,))
    conn.close()
    if not df.empty:
        df['Date'] = pd.to_datetime(df['date'])
        df.set_index('Date', inplace=True)
        df.rename(columns={'open': 'Open', 'high': 'High', 'low': 'Low', 'close': 'Close', 'volume': 'Volume'}, inplace=True)
        df.drop(columns=['date'], inplace=True, errors='ignore')
    return df

def save_metadata_to_sqlite(metadata_list: List[Dict[str, Any]]):
    """Inserts or updates ETF metadata in SQLite database."""
    conn = sqlite3.connect(get_db_path())
    cursor = conn.cursor()
    for meta in metadata_list:
        cursor.execute("""
            INSERT INTO etf_metadata (ticker, company_name, etf_group, etf_market, summary)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(ticker) DO UPDATE SET
                company_name=excluded.company_name,
                etf_group=excluded.etf_group,
                etf_market=excluded.etf_market,
                summary=excluded.summary
        """, (meta['ticker'], meta['company_name'], meta['category'], meta.get('etf_market', 'us_market'), meta.get('summary', '')))
    conn.commit()
    conn.close()

def fetch_etf_descriptions(tickers: List[str], ticker_to_cat: Dict[str, str]) -> Dict[str, str]:
    """Fetches official company/ETF names from yfinance Ticker info or SQLite cache."""
    conn = sqlite3.connect(get_db_path())
    cursor = conn.cursor()

    cursor.execute("SELECT ticker, company_name FROM etf_metadata")
    cached = dict(cursor.fetchall())
    conn.close()

    names_map = {}
    metadata_list = []

    for t in tickers:
        cat = ticker_to_cat.get(t, "General ETF")
        name = cached.get(t) or f"{t} ETF"
        names_map[t] = name
        metadata_list.append({
            "ticker": t,
            "company_name": name,
            "category": cat,
            "etf_market": "us_market",
            "etf_group": cat.lower(),
            "summary": ""
        })

    save_metadata_to_sqlite(metadata_list)
    return names_map


def ingest_etfs(state: GraphState) -> dict:
    """
    Performs INCREMENTAL sync from Yahoo Finance into SQLite:
    - If ticker has existing history in SQLite, downloads ONLY missing recent bars from last_date to today.
    - If ticker is new/missing, performs a 3-year initial backfill (period='3y').
    - Returns full historical OHLCV series per ticker from SQLite.
    """
    import yaml
    print("---RUNNING NODE: ingest_etfs---")
    init_db()
    
    yaml_path = get_path_config()["etf_inputs"]
    etf_universe: Dict[str, List[str]] = {}
    ordered_tickers_list: List[str] = []
    seen_tickers = set()
    ticker_to_cat = {}

    if os.path.exists(yaml_path):
        try:
            with open(yaml_path, 'r', encoding='utf-8') as f:
                content = yaml.safe_load(f)

            
            market_data = content.get("us_market", {})
            CATEGORY_ORDER = ["Breadth", "Canaries", "Defense", "Leadership", "Leveraged_Long", "Leveraged_Short"]
            
            for cat in CATEGORY_ORDER:
                raw_list = market_data.get(cat.lower(), [])
                tickers = []
                for item in raw_list:
                    t = str(item).strip().upper()
                    if t and t not in tickers:
                        tickers.append(t)
                        if t not in seen_tickers:
                            seen_tickers.add(t)
                            ordered_tickers_list.append(t)
                            ticker_to_cat[t] = cat
                if tickers:
                    etf_universe[cat] = tickers
        except Exception as e:
            logger.error(f"Error reading {yaml_path}: {e}")


    if "SPY" not in seen_tickers:
        ordered_tickers_list.append("SPY")
        ticker_to_cat["SPY"] = "Canaries"

    print(f"Checking SQLite database status for {len(ordered_tickers_list)} tickers from {yaml_path}...")

    needs_backfill = []
    incremental_sync = []
    
    for t in ordered_tickers_list:
        last_date = get_latest_stored_date(t)
        if last_date is None:
            needs_backfill.append(t)
        else:
            incremental_sync.append((t, last_date))

    # 1. Backfill new/missing tickers (5 Years)
    if needs_backfill:
        print(f"📥 Backfilling 5 years of OHLCV history for {len(needs_backfill)} new tickers...")
        try:
            df_backfill = yf.download(needs_backfill, period="5y", interval="1d", group_by="ticker", auto_adjust=True, progress=True)
            for t in needs_backfill:
                try:
                    if len(needs_backfill) == 1:
                        sub_df = df_backfill.dropna(subset=['Close']) if 'Close' in df_backfill else pd.DataFrame()
                    else:
                        sub_df = df_backfill[t].dropna(subset=['Close']) if t in df_backfill else pd.DataFrame()
                    if not sub_df.empty:
                        save_ohlcv_to_sqlite(t, sub_df)
                except Exception as ex:
                    logger.warning(f"Error processing backfill for {t}: {ex}")
        except Exception as e:
            logger.error(f"Error executing 5y backfill download: {e}")

    # 2. Incremental sync for existing tickers from last_date
    if incremental_sync:
        min_last_date = min(date for _, date in incremental_sync)
        sync_tickers = [t for t, _ in incremental_sync]
        print(f"🔄 Performing incremental update for {len(sync_tickers)} existing tickers from {min_last_date}...")
        
        try:
            inc_data = yf.download(sync_tickers, start=min_last_date, interval="1d", auto_adjust=True, group_by="ticker", threads=True)
            for t, last_date in incremental_sync:
                if len(sync_tickers) == 1:
                    df_t = inc_data.dropna(how="all").copy()
                else:
                    df_t = inc_data[t].dropna(how="all").copy() if t in inc_data else pd.DataFrame()
                
                if not df_t.empty:
                    if isinstance(df_t.columns, pd.MultiIndex):
                        df_t.columns = [str(c[-1]).capitalize() for c in df_t.columns]
                    else:
                        df_t.columns = [str(c).capitalize() for c in df_t.columns]
                    save_ohlcv_to_sqlite(t, df_t)
        except Exception as e:
            logger.error(f"Error during incremental sync: {e}")


    # 3. Retrieve full historical DataFrame per ticker from SQLite
    ticker_data: Dict[str, pd.DataFrame] = {}
    for t in ordered_tickers_list:
        df_full = get_full_ohlcv_from_sqlite(t)
        if not df_full.empty:
            ticker_data[t] = df_full

    # Fetch and cache ETF metadata (company/long names)
    names_map = fetch_etf_descriptions(ordered_tickers_list, ticker_to_cat)

    print(f"✅ Incremental sync complete! Loaded full OHLCV series for {len(ticker_data)} tickers from SQLite.")

    return {
        "etf_universe": etf_universe,
        "ticker_data": ticker_data,
        "etf_names": names_map,
        "scan_date": pd.Timestamp.now().strftime("%Y-%m-%d")
    }
