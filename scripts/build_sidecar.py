"""
PyInstaller Packaging Script for Stock Analyzer AI Sidecar.
Compiles src/server.py into a single standalone executable binary.
"""
import os
import sys
import subprocess
import shutil
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = PROJECT_ROOT / "src"
DIST_DIR = PROJECT_ROOT / "dist_bin"
DASHBOARD_SIDECAR_DIR = PROJECT_ROOT / "dashboard" / "sidecar_bin"

def build():
    print("[StockWave Build] Starting PyInstaller sidecar compilation...")
    os.makedirs(DIST_DIR, exist_ok=True)
    os.makedirs(DASHBOARD_SIDECAR_DIR, exist_ok=True)

    binary_name = "stockwave-sidecar.exe" if sys.platform == "win32" else "stockwave-sidecar"

    cmd = [
        "pyinstaller",
        "--name", "stockwave-sidecar",
        "--onedir" if "--onedir" in sys.argv else "--onefile",
        "--clean",
        "--noconfirm",
        "--distpath", str(DIST_DIR),
        "--paths", str(SRC_DIR),
        "--hidden-import", "fastapi",
        "--hidden-import", "uvicorn",
        "--hidden-import", "sse_starlette",
        "--hidden-import", "pandas",
        "--hidden-import", "yfinance",
        "--hidden-import", "scipy",
        "--hidden-import", "sqlite3",
        "--hidden-import", "yaml",
        "--hidden-import", "indicators",
        "--hidden-import", "strategy",
        "--hidden-import", "graphs",
        "--hidden-import", "research",
        str(SRC_DIR / "server.py")
    ]

    print(f"Executing: {' '.join(cmd)}")
    subprocess.check_call(cmd, cwd=str(PROJECT_ROOT))

    # Copy binary to dashboard/sidecar_bin for electron-builder inclusion
    built_binary = DIST_DIR / binary_name
    target_binary = DASHBOARD_SIDECAR_DIR / binary_name
    if built_binary.exists():
        shutil.copy2(built_binary, target_binary)
        print(f"✅ Successfully compiled & copied sidecar to: {target_binary}")
    else:
        print(f"❌ Error: Compiled binary not found at {built_binary}")

if __name__ == "__main__":
    build()
