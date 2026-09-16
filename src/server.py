"""
FastAPI Local Sidecar Server for Stock Analyzer AI Desktop.
Provides high-performance local endpoints to serve data outputs and execute pipelines.
"""

import os
import sys
import json
import asyncio
import threading
from pathlib import Path
from typing import AsyncGenerator
from fastapi import FastAPI, HTTPException, Response, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse
from sse_starlette.sse import EventSourceResponse


# Add src to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "src"))

app = FastAPI(
    title="Stock Analyzer AI Sidecar",
    version="0.1.0",
    description="Local background API server for Stock Analyzer AI desktop client"
)

# Enable CORS for local desktop webviews and Vite dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from config_loader import get_path_config, get_base_data_dir

def get_outputs_dir() -> Path:
    return Path(get_path_config()["outputs_dir"])

def get_inputs_dir() -> Path:
    return Path(get_path_config()["base_data"]) / "inputs"


@app.get("/api/health")
async def health():
    """Health check endpoint for desktop startup handshake."""
    paths = get_path_config()
    return {
        "status": "ok", 
        "app": "Stock Analyzer AI Sidecar", 
        "version": "0.1.0",
        "data_dir": paths["base_data"]
    }


@app.get("/api/config")
async def get_config():
    """Returns local RS feeds and configuration."""
    config_path = PROJECT_ROOT / "config.yaml"
    rs_stocks_url = "https://raw.githubusercontent.com/Fred6725/rs-log/main/output/rs_stocks.csv"
    rs_industries_url = "https://raw.githubusercontent.com/Fred6725/rs-log/main/output/rs_industries.csv"
    
    if config_path.exists():
        import re
        content = config_path.read_text(encoding="utf-8")
        match_stocks = re.search(r'rs_stocks_url:\s*["\']?([^"\'\n]+)', content)
        match_industries = re.search(r'rs_industries_url:\s*["\']?([^"\'\n]+)', content)
        if match_stocks:
            rs_stocks_url = match_stocks.group(1).strip()
        if match_industries:
            rs_industries_url = match_industries.group(1).strip()

    paths = get_path_config()
    return {
        "rs_stocks_url": rs_stocks_url,
        "rs_industries_url": rs_industries_url,
        "paths": paths
    }


@app.get("/api/data/{file_name}")
async def get_data_file(file_name: str):
    """Serves JSON or CSV output files dynamically from the active data outputs directory."""
    clean_name = Path(file_name).name
    file_path = get_outputs_dir() / clean_name

    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"File {file_name} not found in {get_outputs_dir()}")

    if file_path.suffix == ".json":
        try:
            content = json.loads(file_path.read_text(encoding="utf-8"))
            return JSONResponse(content=content)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error parsing JSON: {str(e)}")
    else:
        return PlainTextResponse(content=file_path.read_text(encoding="utf-8"))


@app.get("/api/tickers/technical/{file_name}")
async def get_technical_ticker_file(file_name: str):
    """Serves individual ticker technical JSON files from data/outputs/tickers/technical/."""
    clean_name = Path(file_name).name
    file_path = get_outputs_dir() / "tickers" / "technical" / clean_name

    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"Technical data for {file_name} not found")

    try:
        content = json.loads(file_path.read_text(encoding="utf-8"))
        return JSONResponse(content=content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error parsing JSON: {str(e)}")


@app.get("/api/inputs/{file_name}")
async def get_input_file(file_name: str):
    """Serves files from the active data inputs directory."""
    clean_name = Path(file_name).name
    file_path = get_inputs_dir() / clean_name

    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"Input file {file_name} not found")

    if file_path.suffix == ".json":
        try:
            content = json.loads(file_path.read_text(encoding="utf-8"))
            return JSONResponse(content=content)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error parsing JSON: {str(e)}")
    elif file_path.suffix in (".yaml", ".yml"):
        import yaml
        with open(file_path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
        return JSONResponse(content=data)
    else:
        return PlainTextResponse(content=file_path.read_text(encoding="utf-8"))


async def run_pipeline_generator() -> AsyncGenerator[str, None]:
    """Runs the full ETF daily scan directly in-process and yields real-time progress events per node."""
    from graphs.graph import build_workflow
    
    yield json.dumps({"status": "started", "message": "Market scan initiated in-process..."})
    
    loop = asyncio.get_running_loop()
    queue = asyncio.Queue()

    def worker():
        try:
            fast_app = build_workflow(include_optimization=False)
            config = {"configurable": {"thread_id": "fast-scan"}}
            input_payload = {"messages": [("user", "Run ETF Market Regime Analysis")], "question": "Run ETF Market Regime Analysis"}
            
            for event in fast_app.stream(input_payload, config=config):
                for node_name in event.keys():
                    loop.call_soon_threadsafe(
                        queue.put_nowait,
                        {"status": "progress", "message": f"✓ Completed: {node_name}"}
                    )
            loop.call_soon_threadsafe(
                queue.put_nowait,
                {"status": "completed", "message": "Daily scan completed and market data updated!"}
            )
        except Exception as e:
            loop.call_soon_threadsafe(
                queue.put_nowait,
                {"status": "failed", "message": f"Scan failed: {str(e)}"}
            )

    threading_task = threading.Thread(target=worker, daemon=True)
    threading_task.start()

    while True:
        item = await queue.get()
        yield json.dumps(item)
        if item.get("status") in ("completed", "failed"):
            break


async def run_optimizer_generator() -> AsyncGenerator[str, None]:
    """Runs the full Genetic Strategy Optimizer (71,000 parameter permutations) and streams progress."""
    from graphs.graph import build_workflow
    
    yield json.dumps({"status": "started", "message": "Starting Genetic Strategy Optimizer..."})
    
    loop = asyncio.get_running_loop()
    queue = asyncio.Queue()

    def worker():
        try:
            opt_app = build_workflow(include_optimization=True)
            config = {"configurable": {"thread_id": "optimizer"}}
            input_payload = {"messages": [("user", "Run Full Strategy Optimization")], "question": "Run Full Strategy Optimization"}
            
            for event in opt_app.stream(input_payload, config=config):
                for node_name in event.keys():
                    loop.call_soon_threadsafe(
                        queue.put_nowait,
                        {"status": "progress", "message": f"✓ Finished Node: {node_name}"}
                    )
            loop.call_soon_threadsafe(
                queue.put_nowait,
                {"status": "completed", "message": "Strategy optimization complete! Optimal parameters saved."}
            )
        except Exception as e:
            loop.call_soon_threadsafe(
                queue.put_nowait,
                {"status": "failed", "message": f"Optimization failed: {str(e)}"}
            )

    threading_task = threading.Thread(target=worker, daemon=True)
    threading_task.start()

    while True:
        item = await queue.get()
        yield json.dumps(item)
        if item.get("status") in ("completed", "failed"):
            break


@app.get("/api/pipeline/run-stream")
async def run_pipeline_stream():
    """SSE endpoint to stream LangGraph daily scan execution progress live."""
    return EventSourceResponse(run_pipeline_generator())


@app.get("/api/pipeline/optimize-stream")
async def run_optimizer_stream():
    """SSE endpoint to stream LangGraph genetic optimizer progress live."""
    return EventSourceResponse(run_optimizer_generator())


@app.post("/api/market/ai-briefing/regenerate")
async def regenerate_ai_briefing(request: Request):
    """Triggers the AI Executive Briefing synthesis node on-demand with optional model override."""
    from graphs.nodes.ai_analysis import ai_analysis
    model_name = None
    try:
        body = await request.json()
        if isinstance(body, dict):
            model_name = body.get("model") or body.get("model_name")
    except Exception:
        pass

    try:
        loop = asyncio.get_running_loop()
        state_input = {"model_name": model_name} if model_name else {}
        result = await loop.run_in_executor(None, lambda: ai_analysis(state_input))
        return JSONResponse(content=result.get("ai_market_briefing", {}))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI regeneration failed: {str(e)}")


def start(port: int = 8765, host: str = "127.0.0.1"):
    """Entrypoint to run the server with uvicorn."""
    import uvicorn
    uvicorn.run(app, host=host, port=port, log_level="info")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Stock Analyzer AI Sidecar")
    parser.add_argument("--port", type=int, default=8765, help="Port to listen on")
    parser.add_argument("--host", type=str, default="127.0.0.1", help="Host interface to bind")
    args = parser.parse_args()
    start(port=args.port, host=args.host)
