import os
import sys
import logging
from config_loader import get_path_config

def setup_logging(log_filename: str = "stock_analyzer.log", level=logging.INFO):
    """
    Sets up global logging configuration to direct output both to stdout
    and to file handlers inside the project 'logs/' directory.
    """
    log_dir = get_path_config().get("log_dir", "logs")
    os.makedirs(log_dir, exist_ok=True)
    
    log_file_path = os.path.join(log_dir, log_filename)

    formatter = logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s")

    root_logger = logging.getLogger()
    root_logger.setLevel(level)

    # Guarantee FileHandler is attached to logs/stock_analyzer.log unconditionally with write mode ('w') to truncate on fresh run
    abs_log_path = os.path.abspath(log_file_path)
    if not any(isinstance(h, logging.FileHandler) and getattr(h, 'baseFilename', '') == abs_log_path for h in root_logger.handlers):
        file_handler = logging.FileHandler(abs_log_path, mode="w", encoding="utf-8")
        file_handler.setFormatter(formatter)
        file_handler.setLevel(level)
        root_logger.addHandler(file_handler)


    if not any(isinstance(h, logging.StreamHandler) and getattr(h, 'stream', None) == sys.stdout for h in root_logger.handlers):
        stream_handler = logging.StreamHandler(sys.stdout)
        stream_handler.setFormatter(formatter)
        stream_handler.setLevel(level)
        root_logger.addHandler(stream_handler)

    return root_logger


# Automatically initialize logging when logger module is imported
setup_logging()
