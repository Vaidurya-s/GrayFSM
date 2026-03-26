"""
Custom metrics for GrayFSM Backend

Defines business metrics for FSM operations, optimization algorithms,
and system performance monitoring.
"""

from typing import Optional, Dict, Any
from enum import Enum
from contextlib import asynccontextmanager
import time

from opentelemetry import metrics
from opentelemetry.metrics import Counter, Histogram, UpDownCounter, Gauge


class MetricNames(str, Enum):
    """Metric name constants"""

    # FSM Operations
    FSM_CREATED = "grayfsm.fsm.created"
    FSM_DELETED = "grayfsm.fsm.deleted"
    FSM_UPDATED = "grayfsm.fsm.updated"
    FSM_VALIDATED = "grayfsm.fsm.validated"

    # Optimization
    OPTIMIZATION_STARTED = "grayfsm.optimization.started"
    OPTIMIZATION_COMPLETED = "grayfsm.optimization.completed"
    OPTIMIZATION_FAILED = "grayfsm.optimization.failed"
    OPTIMIZATION_DURATION = "grayfsm.optimization.duration"
    STATES_REDUCED = "grayfsm.states.reduced"
    TRANSITIONS_OPTIMIZED = "grayfsm.transitions.optimized"

    # Algorithm Metrics
    ALGORITHM_EXECUTION_TIME = "grayfsm.algorithm.execution_time"
    ALGORITHM_ITERATIONS = "grayfsm.algorithm.iterations"
    ALGORITHM_MEMORY_USAGE = "grayfsm.algorithm.memory_usage"

    # Export Operations
    EXPORT_STARTED = "grayfsm.export.started"
    EXPORT_COMPLETED = "grayfsm.export.completed"
    EXPORT_FAILED = "grayfsm.export.failed"
    EXPORT_DURATION = "grayfsm.export.duration"
    EXPORT_SIZE = "grayfsm.export.size"

    # Database
    DB_QUERY_DURATION = "grayfsm.db.query.duration"
    DB_CONNECTION_POOL_SIZE = "grayfsm.db.connection.pool.size"
    DB_ACTIVE_CONNECTIONS = "grayfsm.db.connections.active"

    # Cache
    CACHE_HIT = "grayfsm.cache.hit"
    CACHE_MISS = "grayfsm.cache.miss"

    # API
    API_REQUEST_DURATION = "grayfsm.api.request.duration"
    API_REQUEST_SIZE = "grayfsm.api.request.size"
    API_RESPONSE_SIZE = "grayfsm.api.response.size"
    API_ERROR = "grayfsm.api.error"


class GrayFSMMetrics:
    """Custom metrics for GrayFSM application"""

    def __init__(self):
        """Initialize metrics"""
        self.meter = metrics.get_meter(__name__)
        self._initialize_metrics()

    def _initialize_metrics(self) -> None:
        """Initialize all metric instruments"""

        # FSM operation counters
        self.fsm_created_counter = self.meter.create_counter(
            name=MetricNames.FSM_CREATED.value,
            description="Total number of FSMs created",
            unit="1",
        )

        self.fsm_deleted_counter = self.meter.create_counter(
            name=MetricNames.FSM_DELETED.value,
            description="Total number of FSMs deleted",
            unit="1",
        )

        self.fsm_updated_counter = self.meter.create_counter(
            name=MetricNames.FSM_UPDATED.value,
            description="Total number of FSMs updated",
            unit="1",
        )

        self.fsm_validated_counter = self.meter.create_counter(
            name=MetricNames.FSM_VALIDATED.value,
            description="Total number of FSMs validated",
            unit="1",
        )

        # Optimization counters
        self.optimization_started_counter = self.meter.create_counter(
            name=MetricNames.OPTIMIZATION_STARTED.value,
            description="Total optimizations started",
            unit="1",
        )

        self.optimization_completed_counter = self.meter.create_counter(
            name=MetricNames.OPTIMIZATION_COMPLETED.value,
            description="Total optimizations completed successfully",
            unit="1",
        )

        self.optimization_failed_counter = self.meter.create_counter(
            name=MetricNames.OPTIMIZATION_FAILED.value,
            description="Total optimizations failed",
            unit="1",
        )

        self.optimization_duration_histogram = self.meter.create_histogram(
            name=MetricNames.OPTIMIZATION_DURATION.value,
            description="Optimization duration in milliseconds",
            unit="ms",
        )

        self.states_reduced_counter = self.meter.create_counter(
            name=MetricNames.STATES_REDUCED.value,
            description="Total states reduced across optimizations",
            unit="1",
        )

        self.transitions_optimized_counter = self.meter.create_counter(
            name=MetricNames.TRANSITIONS_OPTIMIZED.value,
            description="Total transitions optimized",
            unit="1",
        )

        # Algorithm metrics
        self.algorithm_execution_time_histogram = self.meter.create_histogram(
            name=MetricNames.ALGORITHM_EXECUTION_TIME.value,
            description="Algorithm execution time in milliseconds",
            unit="ms",
        )

        self.algorithm_iterations_histogram = self.meter.create_histogram(
            name=MetricNames.ALGORITHM_ITERATIONS.value,
            description="Number of iterations per algorithm run",
            unit="1",
        )

        # Export metrics
        self.export_started_counter = self.meter.create_counter(
            name=MetricNames.EXPORT_STARTED.value,
            description="Total exports started",
            unit="1",
        )

        self.export_completed_counter = self.meter.create_counter(
            name=MetricNames.EXPORT_COMPLETED.value,
            description="Total exports completed successfully",
            unit="1",
        )

        self.export_failed_counter = self.meter.create_counter(
            name=MetricNames.EXPORT_FAILED.value,
            description="Total exports failed",
            unit="1",
        )

        self.export_duration_histogram = self.meter.create_histogram(
            name=MetricNames.EXPORT_DURATION.value,
            description="Export duration in milliseconds",
            unit="ms",
        )

        self.export_size_histogram = self.meter.create_histogram(
            name=MetricNames.EXPORT_SIZE.value,
            description="Export file size in bytes",
            unit="B",
        )

        # Database metrics
        self.db_query_duration_histogram = self.meter.create_histogram(
            name=MetricNames.DB_QUERY_DURATION.value,
            description="Database query duration in milliseconds",
            unit="ms",
        )

        self.db_active_connections_gauge = self.meter.create_up_down_counter(
            name=MetricNames.DB_ACTIVE_CONNECTIONS.value,
            description="Number of active database connections",
            unit="1",
        )

        # Cache metrics
        self.cache_hit_counter = self.meter.create_counter(
            name=MetricNames.CACHE_HIT.value,
            description="Total cache hits",
            unit="1",
        )

        self.cache_miss_counter = self.meter.create_counter(
            name=MetricNames.CACHE_MISS.value,
            description="Total cache misses",
            unit="1",
        )

        # API error counter
        self.api_error_counter = self.meter.create_counter(
            name=MetricNames.API_ERROR.value,
            description="Total API errors by type",
            unit="1",
        )

    # FSM operation methods
    def record_fsm_created(self, attributes: Optional[Dict[str, Any]] = None) -> None:
        """Record FSM creation"""
        self.fsm_created_counter.add(1, attributes or {})

    def record_fsm_deleted(self, attributes: Optional[Dict[str, Any]] = None) -> None:
        """Record FSM deletion"""
        self.fsm_deleted_counter.add(1, attributes or {})

    def record_fsm_updated(self, attributes: Optional[Dict[str, Any]] = None) -> None:
        """Record FSM update"""
        self.fsm_updated_counter.add(1, attributes or {})

    def record_fsm_validated(
        self, attributes: Optional[Dict[str, Any]] = None
    ) -> None:
        """Record FSM validation"""
        self.fsm_validated_counter.add(1, attributes or {})

    # Optimization methods
    def record_optimization_started(
        self, attributes: Optional[Dict[str, Any]] = None
    ) -> None:
        """Record optimization start"""
        self.optimization_started_counter.add(1, attributes or {})

    def record_optimization_completed(
        self, attributes: Optional[Dict[str, Any]] = None
    ) -> None:
        """Record successful optimization"""
        self.optimization_completed_counter.add(1, attributes or {})

    def record_optimization_failed(
        self, attributes: Optional[Dict[str, Any]] = None
    ) -> None:
        """Record failed optimization"""
        self.optimization_failed_counter.add(1, attributes or {})

    def record_optimization_duration(
        self, duration_ms: float, attributes: Optional[Dict[str, Any]] = None
    ) -> None:
        """Record optimization duration"""
        self.optimization_duration_histogram.record(duration_ms, attributes or {})

    def record_states_reduced(
        self, count: int, attributes: Optional[Dict[str, Any]] = None
    ) -> None:
        """Record states reduction"""
        self.states_reduced_counter.add(count, attributes or {})

    def record_transitions_optimized(
        self, count: int, attributes: Optional[Dict[str, Any]] = None
    ) -> None:
        """Record transitions optimization"""
        self.transitions_optimized_counter.add(count, attributes or {})

    # Algorithm methods
    def record_algorithm_execution_time(
        self, duration_ms: float, attributes: Optional[Dict[str, Any]] = None
    ) -> None:
        """Record algorithm execution time"""
        self.algorithm_execution_time_histogram.record(duration_ms, attributes or {})

    def record_algorithm_iterations(
        self, iterations: int, attributes: Optional[Dict[str, Any]] = None
    ) -> None:
        """Record algorithm iterations"""
        self.algorithm_iterations_histogram.record(iterations, attributes or {})

    # Export methods
    def record_export_started(
        self, attributes: Optional[Dict[str, Any]] = None
    ) -> None:
        """Record export start"""
        self.export_started_counter.add(1, attributes or {})

    def record_export_completed(
        self, attributes: Optional[Dict[str, Any]] = None
    ) -> None:
        """Record successful export"""
        self.export_completed_counter.add(1, attributes or {})

    def record_export_failed(
        self, attributes: Optional[Dict[str, Any]] = None
    ) -> None:
        """Record failed export"""
        self.export_failed_counter.add(1, attributes or {})

    def record_export_duration(
        self, duration_ms: float, attributes: Optional[Dict[str, Any]] = None
    ) -> None:
        """Record export duration"""
        self.export_duration_histogram.record(duration_ms, attributes or {})

    def record_export_size(
        self, size_bytes: float, attributes: Optional[Dict[str, Any]] = None
    ) -> None:
        """Record export file size"""
        self.export_size_histogram.record(size_bytes, attributes or {})

    # Database methods
    def record_db_query_duration(
        self, duration_ms: float, attributes: Optional[Dict[str, Any]] = None
    ) -> None:
        """Record database query duration"""
        self.db_query_duration_histogram.record(duration_ms, attributes or {})

    def increment_active_connections(
        self, count: int = 1, attributes: Optional[Dict[str, Any]] = None
    ) -> None:
        """Increment active database connections"""
        self.db_active_connections_gauge.add(count, attributes or {})

    def decrement_active_connections(
        self, count: int = 1, attributes: Optional[Dict[str, Any]] = None
    ) -> None:
        """Decrement active database connections"""
        self.db_active_connections_gauge.add(-count, attributes or {})

    # Cache methods
    def record_cache_hit(self, attributes: Optional[Dict[str, Any]] = None) -> None:
        """Record cache hit"""
        self.cache_hit_counter.add(1, attributes or {})

    def record_cache_miss(self, attributes: Optional[Dict[str, Any]] = None) -> None:
        """Record cache miss"""
        self.cache_miss_counter.add(1, attributes or {})

    # API error method
    def record_api_error(self, attributes: Optional[Dict[str, Any]] = None) -> None:
        """Record API error"""
        self.api_error_counter.add(1, attributes or {})

    @asynccontextmanager
    async def track_optimization(self, algorithm: str):
        """Context manager to track optimization metrics"""
        self.record_optimization_started({"algorithm": algorithm})
        start_time = time.time()

        try:
            yield
            duration_ms = (time.time() - start_time) * 1000
            self.record_optimization_completed({"algorithm": algorithm})
            self.record_optimization_duration(duration_ms, {"algorithm": algorithm})
        except Exception:
            self.record_optimization_failed({"algorithm": algorithm})
            raise

    @asynccontextmanager
    async def track_export(self, format_type: str):
        """Context manager to track export metrics"""
        self.record_export_started({"format": format_type})
        start_time = time.time()

        try:
            yield
            duration_ms = (time.time() - start_time) * 1000
            self.record_export_completed({"format": format_type})
            self.record_export_duration(duration_ms, {"format": format_type})
        except Exception:
            self.record_export_failed({"format": format_type})
            raise


# Global metrics instance
_metrics_instance: Optional[GrayFSMMetrics] = None


def get_metrics() -> GrayFSMMetrics:
    """Get or create global metrics instance"""
    global _metrics_instance
    if _metrics_instance is None:
        _metrics_instance = GrayFSMMetrics()
    return _metrics_instance


def initialize_metrics() -> GrayFSMMetrics:
    """Initialize metrics"""
    return get_metrics()
