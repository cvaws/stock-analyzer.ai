import os
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

def get_path_config() -> Dict[str, str]:
    """Returns absolute/resolved directory paths from config.yaml."""
    cfg = load_config()
    paths = cfg.get("paths", {})
    
    return {
        "etf_inputs": paths.get("etf_inputs", "data/inputs/etf.yaml"),
        "etf_db": paths.get("etf_db", "data/db/etfs.db"),
        "outputs_dir": paths.get("outputs_dir", "data/outputs"),
        "prompts_dir": paths.get("prompts_dir", "prompts"),
        "log_dir": paths.get("log_dir", "logs")
    }

def get_model_config() -> Dict[str, Any]:
    """Returns model settings from config.yaml."""
    cfg = load_config()
    return cfg.get("models", {})
