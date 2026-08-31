import os
import sys
import logging
import yaml
from typing import Dict, Any


logger = logging.getLogger(__name__)

CONFIG_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "configs", "config.yaml")

def load_config(config_path: str = CONFIG_PATH) -> Dict[str, Any]:
    """Loads settings from config.yaml."""
    if not os.path.exists(config_path):
        # Fallback if executing from root directory
        config_path = "configs/config.yaml"
    
    if os.path.exists(config_path):
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                return yaml.safe_load(f) or {}
        except Exception as e:
            logger.error(f"Error loading configuration file from {config_path}: {e}")
    return {}

def get_base_data_dir() -> str:
    """
    Resolves the base data directory:
    1. Custom path from STOCKWAVE_DATA_DIR environment variable
    2. Fallback to project root / data in dev mode
    3. Fallback to OS user data directory in packaged mode
    """
    if "STOCKWAVE_DATA_DIR" in os.environ and os.environ["STOCKWAVE_DATA_DIR"].strip():
        return os.environ["STOCKWAVE_DATA_DIR"].strip()
    
    # Check if running in frozen/packaged mode (PyInstaller or Electron resource)
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    dev_data_dir = os.path.join(project_root, "data")
    if os.path.exists(dev_data_dir):
        return dev_data_dir

    # Fallback to standard OS User Data Directory
    if sys.platform == "darwin":
        base = os.path.expanduser("~/Library/Application Support/StockWave/data")
    elif sys.platform == "win32":
        base = os.path.join(os.environ.get("APPDATA", os.path.expanduser("~")), "StockWave", "data")
    else:
        base = os.path.expanduser("~/.config/stockwave/data")
        
    os.makedirs(base, exist_ok=True)
    return base


def get_path_config() -> Dict[str, str]:
    """Returns absolute/resolved directory paths from config.yaml or active data dir."""
    cfg = load_config()
    paths = cfg.get("paths", {})
    base_data = get_base_data_dir()
    
    # Default relative paths anchored to resolved base_data
    return {
        "base_data": base_data,
        "etf_inputs": paths.get("etf_inputs") if os.path.isabs(paths.get("etf_inputs", "")) else os.path.join(base_data, "inputs", "etf.yaml"),
        "etf_db": paths.get("etf_db") if os.path.isabs(paths.get("etf_db", "")) else os.path.join(base_data, "db", "etfs.db"),
        "outputs_dir": paths.get("outputs_dir") if os.path.isabs(paths.get("outputs_dir", "")) else os.path.join(base_data, "outputs"),
        "prompts_dir": paths.get("prompts_dir", "prompts"),
        "log_dir": paths.get("log_dir", "logs")
    }


def get_model_config() -> Dict[str, Any]:
    """Returns model settings from config.yaml."""
    cfg = load_config()
    return cfg.get("models", {})

