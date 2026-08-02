import os
import sys
import subprocess
import logger
from dotenv import load_dotenv

load_dotenv()

def main():
    """
    Executes the ETF multi-agent workflow graph and launches the web dashboard.
    """
    from graphs.graph import app

    question = sys.argv[1] if len(sys.argv) > 1 else "Run ETF Market Regime Analysis"
    print(f"\n[AgentGraph Compiler] Streaming graph execution for: {question!r}\n")

    config = {"configurable": {"thread_id": "thread-1"}}
    input_payload = {"messages": [("user", question)], "question": question}

    # Stream real-time node execution
    for event in app.stream(input_payload, config=config):
        for node_name, state_update in event.items():
            print(f"--- [NODE COMPLETED: {node_name}] ---")
            if isinstance(state_update, dict):
                for k, v in state_update.items():
                    print(f"  {k}: {v}")

    print("\n================ WORKFLOW COMPLETE ================\n")

    # Launch Vite React Dashboard if --no-ui flag is not passed
    if "--no-ui" not in sys.argv:
        print("[Dashboard] Launching React Dashboard at http://localhost:5173 ...")
        dashboard_dir = os.path.join(os.getcwd(), "dashboard")
        if os.path.exists(dashboard_dir):
            try:
                subprocess.run(["npm", "run", "dev"], cwd=dashboard_dir)
            except KeyboardInterrupt:
                print("\n👋 Dashboard stopped.")

if __name__ == "__main__":
    main()
