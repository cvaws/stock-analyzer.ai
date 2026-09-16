import os
import json
import sqlite3
import logging
from typing import Dict, Any, List, Optional
import pandas as pd
from langchain_ollama import ChatOllama
from graphs.state import GraphState
from config_loader import get_path_config

logger = logging.getLogger(__name__)


def extract_one_year_historical_context() -> Dict[str, Any]:
    """
    Extracts 1-year regime phase history, distribution stats, streak,
    and 52-week rolling sampled trajectory from SQLite database.
    """
    db_path = get_path_config()["etf_db"]
    if not os.path.exists(db_path):
        return {}

    conn = sqlite3.connect(db_path)
    try:
        # 1. Trailing 252 trading sessions of market regime
        query = """
            SELECT date, regime, regime_code, confidence, canaries_health, leadership_health, breadth_health, defense_health
            FROM daily_market_regime
            ORDER BY date DESC
            LIMIT 252
        """
        df_regimes = pd.read_sql_query(query, conn)
    except Exception as e:
        logger.warning(f"Error querying daily_market_regime: {e}")
        df_regimes = pd.DataFrame()
    finally:
        conn.close()

    if df_regimes.empty:
        return {}

    # Reverse to chronological order (oldest to newest)
    df_regimes = df_regimes.iloc[::-1].reset_index(drop=True)
    total_days = len(df_regimes)

    # 1-Year Regime Distribution
    code_counts = df_regimes["regime_code"].value_counts().to_dict()
    regime_distribution_1y = {
        "PRESS_GAS": f"{round((code_counts.get('PRESS_GAS', 0) / total_days) * 100, 1)}% ({code_counts.get('PRESS_GAS', 0)} days)",
        "HALF_SIZE": f"{round((code_counts.get('HALF_SIZE', 0) / total_days) * 100, 1)}% ({code_counts.get('HALF_SIZE', 0)} days)",
        "STEP_ASIDE": f"{round((code_counts.get('STEP_ASIDE', 0) / total_days) * 100, 1)}% ({code_counts.get('STEP_ASIDE', 0)} days)",
        "total_sessions_analyzed": total_days
    }

    # Identify Regime Phase Transitions & Current Streak
    shifts = []
    current_regime = df_regimes["regime_code"].iloc[0]
    phase_start_date = df_regimes["date"].iloc[0]
    phase_duration = 0

    for i in range(len(df_regimes)):
        row = df_regimes.iloc[i]
        code = row["regime_code"]
        if code == current_regime:
            phase_duration += 1
        else:
            shifts.append({
                "from": current_regime,
                "to": code,
                "start_date": phase_start_date,
                "end_date": df_regimes["date"].iloc[i-1],
                "duration_days": phase_duration
            })
            current_regime = code
            phase_start_date = row["date"]
            phase_duration = 1

    current_streak = f"Day {phase_duration} of {current_regime}"
    recent_regime_shifts = shifts[-5:] if shifts else []

    # 52-Week Rolling Weekly Trajectory (Sample every 5 trading days)
    weekly_trajectory = []
    step = max(1, len(df_regimes) // 52)
    for i in range(0, len(df_regimes), step):
        row = df_regimes.iloc[i]
        weekly_trajectory.append({
            "date": str(row["date"]),
            "regime": str(row["regime_code"]),
            "confidence": round(float(row["confidence"]), 1),
            "canaries_pct": round(float(row["canaries_health"]), 1),
            "leadership_pct": round(float(row["leadership_health"]), 1),
            "breadth_pct": round(float(row["breadth_health"]), 1),
            "defense_pct": round(float(row["defense_health"]), 1)
        })

    return {
        "regime_distribution_1y": regime_distribution_1y,
        "current_streak": current_streak,
        "recent_regime_shifts": recent_regime_shifts,
        "weekly_trajectory_52w": weekly_trajectory[-26:]  # Trailing 26 weeks for high-density token efficiency
    }


def generate_fallback_briefing(
    regime_data: Dict[str, Any], 
    historical_context: Dict[str, Any],
    focus_leaders: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """Generates an institutional deterministic briefing when Ollama is unavailable."""
    regime_name = regime_data.get("regime", "STEP ASIDE")
    regime_code = regime_data.get("regime_code", "STEP_ASIDE")
    confidence = regime_data.get("confidence", 50.0)
    groups = regime_data.get("groups", {})
    macro = regime_data.get("macro_context", {})
    streak = historical_context.get("current_streak", "Current Regime Session")
    dist = historical_context.get("regime_distribution_1y", {})

    c_pct = groups.get("Canaries", {}).get("percent", 0.0)
    l_pct = groups.get("Leadership", {}).get("percent", 0.0)
    b_pct = groups.get("Breadth", {}).get("percent", 0.0)
    d_pct = groups.get("Defense", {}).get("percent", 0.0)

    the_bottom_line = f"The market is in {regime_name} ({confidence}% Confidence, {streak}). Core equity participation remains narrow ({b_pct}% Breadth) while 10Y Yields at {macro.get('tnx_yield', 'N/A')}% keep multiple expansion capped. Maintain a defensive posture with capital protected in cash or tight trailing stops."
    
    cycle_context = f"Over the past 252 sessions, the market spent {dist.get('PRESS_GAS', 'N/A')} in Press Gas and {dist.get('STEP_ASIDE', 'N/A')} in Step Aside. Today is {streak}."
    macro_synthesis = f"The 10-Year Treasury Yield sits at {macro.get('tnx_yield', 'N/A')}% ({'Easing' if macro.get('tnx_bullish_for_equities') else 'Surging'}), while the US Dollar is {'Soft/Favorable' if macro.get('uup_bullish_for_equities') else 'Firm'}. High Yield Credit Spreads remain {'Tight & Healthy' if macro.get('credit_spread_bullish') else 'Tightening'}."
    sector_rotation = f"Leadership is holding at {l_pct}% with relative strength concentrated in high-conviction themes, but broader market Breadth ({b_pct}%) lacks expansion confirmation."

    leader_theses = []
    for leader in focus_leaders[:5]:
        sym = leader.get("symbol", "")
        theme = leader.get("themeName") or leader.get("subIndustry", "")
        rs = leader.get("rsWeeklyPct", 0.0)
        leader_theses.append({
            "symbol": sym,
            "theme": theme,
            "thesis": f"{sym} ({theme}) maintains bullish Supertrend alignment with +{rs:.1f}% weekly RS outperformance vs SPY."
        })

    return {
        "headline": f"{regime_name} — {confidence}% Confidence ({streak})",
        "the_bottom_line": the_bottom_line,
        "cycle_context": cycle_context,
        "macro_synthesis": macro_synthesis,
        "sector_rotation_summary": sector_rotation,
        "tactical_action_plan": [
            "Cash Buffer: Maintain 20-30% capital in dry powder" if regime_code != "PRESS_GAS" else "Deploy capital fully across top 5 focus leaders",
            "Stop-Loss Discipline: Follow category-optimized stops (Leadership: 6%, Breadth: 2%)",
            "Position Sizing: Limit initial allocations to 10-20% per vehicle",
            "Breakout Rule: Avoid adding new risk when Breadth is below 40%"
        ],
        "leader_spotlights": leader_theses,
        "key_risk_alerts": regime_data.get("divergence_warnings", []) or ["Monitor 10-Year yield surges above EMA21", "Watch for SPY/QQQ distribution day expansion"]
    }


def ai_analysis(state: GraphState) -> dict:
    """
    Synthesizes the complete 6-layer market data architecture and 1-year historical cycle
    using a local Ollama LLM to generate an Executive CIO Market Briefing.
    """
    print("---RUNNING NODE: ai_analysis (AI Executive Market Briefing)---")
    
    outputs_dir = get_path_config()["outputs_dir"]
    market_regime_path = os.path.join(outputs_dir, "market_regime.json")
    etfs_tracker_path = os.path.join(outputs_dir, "etfs_tracker.json")

    regime_data: Dict[str, Any] = {}
    if os.path.exists(market_regime_path):
        try:
            with open(market_regime_path, "r", encoding="utf-8") as f:
                regime_data = json.load(f)
        except Exception as e:
            logger.warning(f"Error reading {market_regime_path}: {e}")

    etf_tracker_data: List[Dict[str, Any]] = []
    if os.path.exists(etfs_tracker_path):
        try:
            with open(etfs_tracker_path, "r", encoding="utf-8") as f:
                etf_tracker_data = json.load(f)
        except Exception as e:
            logger.warning(f"Error reading {etfs_tracker_path}: {e}")

    # 1. Extract 1-Year Historical Context
    historical_context = extract_one_year_historical_context()

    # 2. Extract Top 10 Thematic Focus Leaders
    def is_thematic(item):
        sym = item.get("symbol", "").upper()
        sec = (item.get("sector") or "").lower()
        is_macro = sec == "macro" or sym in ["UUP", "TLT", "HYG", "IEF", "RSP", "VIXY", "UVXY", "VXX", "^TNX", "TNX"]
        is_lev = "leveraged" in sec or sym in ["SPXL", "TQQQ", "TNA", "KORU", "SOXL", "SPXS", "SQQQ", "TZA"]
        return not is_macro and not is_lev

    focus_leaders = [
        x for x in etf_tracker_data 
        if is_thematic(x) and x.get("supertrendDirection") == 1 and (x.get("rsWeeklyVelocity") or 0) > 0
    ]
    focus_leaders = sorted(focus_leaders, key=lambda x: (x.get("rsWeeklyPct") or -999), reverse=True)[:10]

    # 3. Extract Accelerating Inflows & Decelerating Outflows
    thematic_etfs = [x for x in etf_tracker_data if is_thematic(x) and x.get("rsWeeklyVelocity") is not None]
    top_inflows = sorted(thematic_etfs, key=lambda x: x.get("rsWeeklyVelocity", 0), reverse=True)[:5]
    top_outflows = sorted(thematic_etfs, key=lambda x: x.get("rsWeeklyVelocity", 0))[:5]

    # 4. Construct High-Density Structured Prompt Payload
    prompt_payload = {
        "scan_date": regime_data.get("scan_date", pd.Timestamp.now().strftime("%Y-%m-%d")),
        "current_regime": {
            "regime": regime_data.get("regime", "STEP_ASIDE"),
            "regime_code": regime_data.get("regime_code", "STEP_ASIDE"),
            "confidence_score": regime_data.get("confidence", 50.0),
            "distribution_days": {
                "spy_25d": regime_data.get("spy_dist_days", 0),
                "qqq_25d": regime_data.get("qqq_dist_days", 0)
            },
            "divergence_warnings": regime_data.get("divergence_warnings", [])
        },
        "group_health_4_buckets": {
            "canaries": regime_data.get("groups", {}).get("Canaries", {}),
            "leadership": regime_data.get("groups", {}).get("Leadership", {}),
            "breadth": regime_data.get("groups", {}).get("Breadth", {}),
            "defense": regime_data.get("groups", {}).get("Defense", {})
        },
        "macro_intermarket_matrix": regime_data.get("macro_context", {}),
        "one_year_historical_cycle": historical_context,
        "sector_rotation_flows": {
            "top_accelerating_inflows": [{"symbol": x["symbol"], "theme": x.get("themeName") or x.get("subIndustry"), "rs_vel": x.get("rsWeeklyVelocity")} for x in top_inflows],
            "top_decelerating_outflows": [{"symbol": x["symbol"], "theme": x.get("themeName") or x.get("subIndustry"), "rs_vel": x.get("rsWeeklyVelocity")} for x in top_outflows]
        },
        "top_focus_leaders": [
            {
                "symbol": x["symbol"],
                "theme": x.get("themeName") or x.get("subIndustry"),
                "price": x.get("price"),
                "rs_weekly_pct": x.get("rsWeeklyPct"),
                "pct_off_52w_high": x.get("pctOff52WkHigh")
            } for x in focus_leaders[:5]
        ]
    }

    # 5. Invoke Ollama or generate fallback
    briefing_result = None
    model_name = state.get("model_name") or state.get("model")

    # If not explicitly provided in state, read configured model from config.yaml
    if not model_name:
        try:
            if os.path.exists("configs/config.yaml"):
                import yaml
                with open("configs/config.yaml", "r") as f:
                    cfg = yaml.safe_load(f)
                    model_name = cfg.get("models", {}).get("chat", {}).get("name")
        except Exception:
            pass

    if not model_name:
        model_name = "qwen3-coder:30b"

    try:
        print(f"🤖 Invoking local Ollama ({model_name}) for market debrief synthesis...")
        llm = ChatOllama(model=model_name, temperature=0.2, format="json", timeout=30.0)

        prompt = f"""
You are an institutional Chief Investment Officer (CIO) and senior market technician.
Analyze the following comprehensive market dataset containing:
1) Current Top-Down Market Regime & 4 Category Healths
2) 1-Year Historical Regime Cycle, Distribution, and Phase Transition History
3) Macro Matrix (US Dollar, 10Y Treasury Yields, HYG/IEF Credit Spread, VIX, Equal Weight RSP)
4) Sector Rotation RS Velocity Flows & Top Focus Leaders

INPUT MARKET DATASET:
{json.dumps(prompt_payload, indent=2)}

Produce a structured JSON executive briefing with the exact keys:
{{
  "headline": "<Punchy institutional headline summarizing regime & key driver>",
  "the_bottom_line": "<1-2 punchy sentences summarizing the exact stance, portfolio cash allocation, and why>",
  "cycle_context": "<1-2 sentences comparing today's regime to the 1-year historical baseline>",
  "macro_synthesis": "<2-3 clear sentences synthesizing 10Y Yields, Dollar, and Credit Spread impacts>",
  "sector_rotation_summary": "<2-3 clear sentences on leading vs lagging sectors and money flows>",
  "tactical_action_plan": [
    "<Actionable bullet on cash allocation / capital deployment>",
    "<Actionable bullet on stop-loss discipline / trade management>",
    "<Actionable bullet on sector exposure / breakout rules>"
  ],
  "leader_spotlights": [
    {{
      "symbol": "<Symbol>",
      "theme": "<Theme>",
      "thesis": "<1-sentence technical setup rationale>"
    }}
  ],
  "key_risk_alerts": [
    "<Key macro or breadth divergence risk to monitor>"
  ]
}}

Return ONLY valid JSON.
"""
        response = llm.invoke(prompt)
        raw_content = response.content.strip()
        briefing_result = json.loads(raw_content)
        print("✅ Ollama executive debrief successfully generated!")
    except Exception as e:
        logger.warning(f"Ollama generation fallback triggered ({e}). Generating rule-based institutional debrief...")
        briefing_result = generate_fallback_briefing(regime_data, historical_context, focus_leaders)

    # 6. Save output to data/outputs/ai_market_briefing.json
    output_file = os.path.join(outputs_dir, "ai_market_briefing.json")
    os.makedirs(outputs_dir, exist_ok=True)
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(briefing_result, f, indent=2)

    print(f"📄 Saved AI Executive Briefing to {output_file}")

    return {
        "ai_market_summary": briefing_result.get("the_bottom_line", "") or briefing_result.get("executive_summary", ""),
        "ai_market_briefing": briefing_result
    }
