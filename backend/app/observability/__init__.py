"""
GrayFSM Observability Package

Provides OpenTelemetry tracing, Prometheus metrics, and structured logging.
All dependencies are optional — the application starts normally if they are missing.
"""

from app.observability.telemetry import setup_telemetry, shutdown_telemetry
from app.observability.metrics import setup_metrics, get_metrics

__all__ = [
    "setup_telemetry",
    "shutdown_telemetry",
    "setup_metrics",
    "get_metrics",
]
