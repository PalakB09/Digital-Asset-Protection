"""
Structured logging configuration for MediaShield.
"""

import logging
import sys


def setup_logging(level: int = logging.INFO):
    """Configure structured logging for the entire application."""
    fmt = "[%(asctime)s] [%(levelname)s] [%(name)s] %(message)s"
    datefmt = "%Y-%m-%d %H:%M:%S"

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter(fmt, datefmt=datefmt))

    root = logging.getLogger()
    root.setLevel(level)
    # Avoid duplicate handlers on reload
    root.handlers = [handler]

    # Quiet noisy libraries
    logging.getLogger("chromadb").setLevel(logging.WARNING)
    logging.getLogger("transformers").setLevel(logging.WARNING)
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
