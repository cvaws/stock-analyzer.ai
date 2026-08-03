"""
Script to execute multiple optimization research iterations sequentially.
Usage:
    uv run python scripts/run_research_iterations.py --runs 10
"""
import argparse
import logging
import sys
import time

# Ensure src is on pythonpath
sys.path.insert(0, "src")

from graphs.graph import app as graph_app
from research.evidence.aggregator import EvidenceAggregator
from research.persistence.migrations import apply_migrations

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger(__name__)


def run_iterations(num_runs: int = 10):
    """Executes N full research graph workflow iterations sequentially."""
    print(f"\n🚀 Launching StockWave Evolutionary Research Engine for {num_runs} iterations...\n")
    
    # Ensure research schema is ready
    apply_migrations()
    
    start_time = time.time()

    for i in range(1, num_runs + 1):
        print(f"\n==================================================")
        print(f"🏆 ITERATION {i} / {num_runs}")
        print(f"==================================================\n")

        initial_state = {
            "etf_universe": {},
            "etf_names": {},
            "technical_indicators": {},
            "patterns": {},
            "backtest_results": {},
            "ai_market_summary": "",
            "scan_date": ""
        }

        try:
            # Execute full LangGraph DAG
            result_state = graph_app.invoke(initial_state)
            print(f"✅ Iteration {i} complete!")
        except Exception as e:
            logger.error(f"Iteration {i} failed with error: {e}")
            continue

    total_duration = time.time() - start_time
    
    # Compute aggregate empirical evidence from SQLite
    try:
        agg = EvidenceAggregator()
        stats = agg.compute_indicator_statistics()
        print("\n==================================================")
        print(f"📊 RESEARCH SUMMARY ({num_runs} iterations in {total_duration:.1f}s)")
        print("==================================================")
        print(f"Top 5 Indicator Evidence Rankings from SQLite DB:")
        for s in stats[:5]:
            print(f"  • {s['indicator']:<18}: Freq={s['frequency']:<3} | Avg WinRate={s['win_rate_pct']:.1f}% | Avg PF={s['avg_profit_factor']:.2f}")
        print("==================================================\n")
    except Exception as e:
        logger.warning(f"Could not print evidence summary: {e}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run StockWave Evolutionary Research Iterations")
    parser.add_argument("--runs", type=int, default=10, help="Number of research iterations to execute (default: 10)")
    args = parser.parse_args()

    run_iterations(args.runs)
