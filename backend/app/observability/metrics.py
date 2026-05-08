"""
Prometheus metrics for GrayFSM Backend

Exposes custom business metrics (FSM operations, optimization, exports)
and a ``/metrics`` endpoint compatible with the Prometheus scrape protocol.

All OpenTelemetry / prometheus-client imports are wrapped in try/except
so the application can start without those packages installed.
"""

from __future__ import annotations

import logging
import time
from contextlib import asynccontextmanager
from enum import Enum
from typing import Any

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Metric name constants
# ---------------------------------------------------------------------------


class MetricNames(str, Enum):
    """Metric name constants"""

    # FSM Operations
    FSM_CREATED = "grayfsm_fsm_created_total"
    FSM_DELETED = "grayfsm_fsm_deleted_total"
    FSM_UPDATED = "grayfsm_fsm_updated_total"

    # Optimization
    OPTIMIZATION_STARTED = "grayfsm_optimization_started_total"
    OPTIMIZATION_COMPLETED = "grayfsm_optimization_completed_total"
    OPTIMIZATION_FAILED = "grayfsm_optimization_failed_total"
    OPTIMIZATION_DURATION = "grayfsm_optimization_duration_seconds"

    # Export
    EXPORT_COMPLETED = "grayfsm_export_completed_total"
    EXPORT_FAILED = "grayfsm_export_failed_total"

    # API
    API_REQUESTS = "grayfsm_api_requests_total"
    API_REQUEST_DURATION = "grayfsm_api_request_duration_seconds"
    API_ERRORS = "grayfsm_api_errors_total"


# ---------------------------------------------------------------------------
# Metrics wrapper (uses prometheus_client when available, no-ops otherwise)
# ---------------------------------------------------------------------------

_PROMETHEUS_AVAILABLE = False
try:
    from prometheus_client import CONTENT_TYPE_LATEST, Counter, Histogram, generate_latest

    _PROMETHEUS_AVAILABLE = True
except ImportError:
    pass


class GrayFSMMetrics:
    """Custom Prometheus metrics for GrayFSM.

    If ``prometheus_client`` is not installed every recording method is a
    silent no-op so callers never need to check availability.
    """

    def __init__(self) -> None:
        if not _PROMETHEUS_AVAILABLE:
            return

        # FSM counters
        self.fsm_created = Counter(
            MetricNames.FSM_CREATED.value,
            "Total FSMs created",
        )
        self.fsm_deleted = Counter(
            MetricNames.FSM_DELETED.value,
            "Total FSMs deleted",
        )
        self.fsm_updated = Counter(
            MetricNames.FSM_UPDATED.value,
            "Total FSMs updated",
        )

        # Optimization counters / histograms
        self.optimization_started = Counter(
            MetricNames.OPTIMIZATION_STARTED.value,
            "Total optimizations started",
            ["algorithm"],
        )
        self.optimization_completed = Counter(
            MetricNames.OPTIMIZATION_COMPLETED.value,
            "Total optimizations completed",
            ["algorithm"],
        )
        self.optimization_failed = Counter(
            MetricNames.OPTIMIZATION_FAILED.value,
            "Total optimizations failed",
            ["algorithm"],
        )
        self.optimization_duration = Histogram(
            MetricNames.OPTIMIZATION_DURATION.value,
            "Optimization duration in seconds",
            ["algorithm"],
            buckets=(0.1, 0.5, 1, 2, 5, 10, 30, 60, 120, 300),
        )

        # Export counters
        self.export_completed = Counter(
            MetricNames.EXPORT_COMPLETED.value,
            "Total exports completed",
            ["format"],
        )
        self.export_failed = Counter(
            MetricNames.EXPORT_FAILED.value,
            "Total exports failed",
            ["format"],
        )

        # API counters / histograms
        self.api_requests = Counter(
            MetricNames.API_REQUESTS.value,
            "Total API requests",
            ["method", "endpoint", "status"],
        )
        self.api_request_duration = Histogram(
            MetricNames.API_REQUEST_DURATION.value,
            "API request duration in seconds",
            ["method", "endpoint"],
            buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10),
        )
        self.api_errors = Counter(
            MetricNames.API_ERRORS.value,
            "Total API errors",
            ["method", "endpoint", "error_type"],
        )

    # -- FSM helpers --------------------------------------------------------

    def record_fsm_created(self) -> None:
        if _PROMETHEUS_AVAILABLE:
            self.fsm_created.inc()

    def record_fsm_deleted(self) -> None:
        if _PROMETHEUS_AVAILABLE:
            self.fsm_deleted.inc()

    def record_fsm_updated(self) -> None:
        if _PROMETHEUS_AVAILABLE:
            self.fsm_updated.inc()

    # -- Optimization helpers -----------------------------------------------

    def record_optimization_started(self, algorithm: str) -> None:
        if _PROMETHEUS_AVAILABLE:
            self.optimization_started.labels(algorithm=algorithm).inc()

    def record_optimization_completed(self, algorithm: str) -> None:
        if _PROMETHEUS_AVAILABLE:
            self.optimization_completed.labels(algorithm=algorithm).inc()

    def record_optimization_failed(self, algorithm: str) -> None:
        if _PROMETHEUS_AVAILABLE:
            self.optimization_failed.labels(algorithm=algorithm).inc()

    def record_optimization_duration(self, algorithm: str, duration_s: float) -> None:
        if _PROMETHEUS_AVAILABLE:
            self.optimization_duration.labels(algorithm=algorithm).observe(duration_s)

    @asynccontextmanager
    async def track_optimization(self, algorithm: str):
        """Context manager to track optimization metrics."""
        self.record_optimization_started(algorithm)
        start = time.monotonic()
        try:
            yield
            elapsed = time.monotonic() - start
            self.record_optimization_completed(algorithm)
            self.record_optimization_duration(algorithm, elapsed)
        except Exception:
            self.record_optimization_failed(algorithm)
            raise

    # -- Export helpers ------------------------------------------------------

    def record_export_completed(self, fmt: str) -> None:
        if _PROMETHEUS_AVAILABLE:
            self.export_completed.labels(format=fmt).inc()

    def record_export_failed(self, fmt: str) -> None:
        if _PROMETHEUS_AVAILABLE:
            self.export_failed.labels(format=fmt).inc()

    # -- API helpers --------------------------------------------------------

    def record_api_request(self, method: str, endpoint: str, status: int) -> None:
        if _PROMETHEUS_AVAILABLE:
            self.api_requests.labels(method=method, endpoint=endpoint, status=str(status)).inc()

    def record_api_duration(self, method: str, endpoint: str, duration_s: float) -> None:
        if _PROMETHEUS_AVAILABLE:
            self.api_request_duration.labels(method=method, endpoint=endpoint).observe(duration_s)

    def record_api_error(self, method: str, endpoint: str, error_type: str) -> None:
        if _PROMETHEUS_AVAILABLE:
            self.api_errors.labels(method=method, endpoint=endpoint, error_type=error_type).inc()


# ---------------------------------------------------------------------------
# Singleton accessor
# ---------------------------------------------------------------------------

_metrics_instance: GrayFSMMetrics | None = None


def get_metrics() -> GrayFSMMetrics:
    """Return the global metrics singleton (creates on first call)."""
    global _metrics_instance
    if _metrics_instance is None:
        _metrics_instance = GrayFSMMetrics()
    return _metrics_instance


# ---------------------------------------------------------------------------
# Setup helper called from main.py lifespan
# ---------------------------------------------------------------------------


def setup_metrics(app: Any) -> None:
    """
    Initialise Prometheus metrics and add a ``/metrics`` endpoint to *app*.

    If ``prometheus_client`` is not installed the endpoint returns a plain
    text message indicating that metrics are unavailable.
    """
    from fastapi import Response

    # Ensure the singleton is created
    get_metrics()

    if _PROMETHEUS_AVAILABLE:

        @app.get("/metrics", include_in_schema=False)
        async def prometheus_metrics() -> Response:
            """Prometheus scrape endpoint."""
            return Response(
                content=generate_latest(),
                media_type=CONTENT_TYPE_LATEST,
            )

        logger.info("Prometheus /metrics endpoint registered")
    else:

        @app.get("/metrics", include_in_schema=False)
        async def prometheus_metrics_unavailable() -> Response:
            return Response(
                content="# prometheus_client not installed\n",
                media_type="text/plain",
            )

        logger.info("prometheus_client not installed — /metrics returns placeholder")
