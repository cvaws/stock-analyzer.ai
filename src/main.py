import os
import sys
import subprocess
import logger
from dotenv import load_dotenv

load_dotenv()


def run_pipeline(include_optimization: bool = True, launch_ui: bool = True, question: str = "Run ETF Market Regime Analysis"):
    """
    Executes the ETF workflow graph stream.
    - include_optimization=True: Runs full grid search optimization (15 min).
    - include_optimization=False: Fast ~5-10s scan (Sync Data -> Calculate Regimes -> Backtest strategies.json -> Export Reports).
    - launch_ui=True: Launches React Vite Dashboard UI at http://localhost:5173.
    """
    from graphs.graph import build_workflow, app

    selected_app = app if include_optimization else build_workflow(include_optimization=False)

    opt_status = "Full Grid Search Optimization" if include_optimization else "Fast Scan (Skipping Optimization)"
    print(f"\n[StockWave CLI] Executing pipeline: {opt_status} | Target: {question!r}\n")

    config = {"configurable": {"thread_id": "thread-1"}}
    input_payload = {"messages": [("user", question)], "question": question}

    # Stream real-time node execution
    for event in selected_app.stream(input_payload, config=config):
        for node_name, state_update in event.items():
            print(f"--- [NODE COMPLETED: {node_name}] ---")
            if isinstance(state_update, dict):
                for k, v in state_update.items():
                    print(f"  {k}: {v}")

    print("\n================ WORKFLOW COMPLETE ================\n")

    if launch_ui:
        print("[Dashboard] Launching React Dashboard at http://localhost:5173 ...")
        dashboard_dir = os.path.join(os.getcwd(), "dashboard")
        if os.path.exists(dashboard_dir):
            try:
                subprocess.run(["npm", "run", "dev"], cwd=dashboard_dir)
            except KeyboardInterrupt:
                print("\n👋 Dashboard stopped.")


def dashboard():
    """
    Entrypoint for `uv run dashboard`.
    - Without flags: Full Pipeline (Optimization + Backtest + Launch Web UI).
    - With `--no-ui`: Fast Daily Scan (~5-10s) (Excludes Optimization & UI).
    """
    no_ui = "--no-ui" in sys.argv
    if no_ui:
        # uv run dashboard --no-ui -> Fast Daily Scan (~5-10s: No Optimization, No UI)
        run_pipeline(include_optimization=False, launch_ui=False)
    else:
        # uv run dashboard -> Full Pipeline (Optimization + Backtest + Launch UI)
        run_pipeline(include_optimization=True, launch_ui=True)


def optimize():
    """
    Entrypoint for `uv run optimize`.
    Runs Data Sync -> Calculate Regimes -> Grid Search Optimization -> Portfolio Backtest -> Export Reports (No UI).
    """
    no_ui = "--no-ui" in sys.argv
    launch_ui = not no_ui
    run_pipeline(include_optimization=True, launch_ui=launch_ui)


if __name__ == "__main__":
    dashboard()

