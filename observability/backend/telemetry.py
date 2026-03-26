"""
OpenTelemetry instrumentation for GrayFSM Backend

Configures distributed tracing, metrics, and logging with automatic
span creation for FastAPI, SQLAlchemy, Redis, and other components.
"""

from typing import Optional
from contextlib import asynccontextmanager

from opentelemetry import trace, metrics
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.exporter.jaeger.thrift import JaegerExporter
from opentelemetry.exporter.prometheus import PrometheusMetricReader

from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
from opentelemetry.instrumentation.redis import RedisInstrumentor
from opentelemetry.instrumentation.requests import RequestsInstrumentor
from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
from opentelemetry.instrumentation.celery import CeleryInstrumentor

from opentelemetry.sdk.resources import SERVICE_NAME, Resource
from opentelemetry.api.baggage.propagation import BaggagePropagator
from opentelemetry.sdk.trace.export.in_memory_trace_exporter import (
    InMemoryTraceExporter,
)
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.propagate import set_global_textmap
from opentelemetry.propagators.jaeger import JaegerPropagator
from opentelemetry.propagators.b3 import B3SingleFormat
from opentelemetry.sdk.trace.propagation.tracecontext import (
    TraceContextPropagator,
)


class TelemetryConfig:
    """Configuration for OpenTelemetry instrumentation"""

    def __init__(
        self,
        service_name: str = "grayfsm-backend",
        service_version: str = "1.0.0",
        jaeger_host: str = "localhost",
        jaeger_port: int = 6831,
        jaeger_enabled: bool = True,
        otlp_enabled: bool = False,
        otlp_endpoint: str = "http://otel-collector:4317",
        prometheus_port: int = 8001,
        environment: str = "development",
    ):
        """
        Initialize telemetry configuration

        Args:
            service_name: Name of the service
            service_version: Version of the service
            jaeger_host: Jaeger agent host
            jaeger_port: Jaeger agent port (Thrift)
            jaeger_enabled: Enable Jaeger exporter
            otlp_enabled: Enable OTLP exporter
            otlp_endpoint: OTLP collector endpoint
            prometheus_port: Prometheus metrics port
            environment: Deployment environment
        """
        self.service_name = service_name
        self.service_version = service_version
        self.jaeger_host = jaeger_host
        self.jaeger_port = jaeger_port
        self.jaeger_enabled = jaeger_enabled
        self.otlp_enabled = otlp_enabled
        self.otlp_endpoint = otlp_endpoint
        self.prometheus_port = prometheus_port
        self.environment = environment

        # Resource with service metadata
        self.resource = Resource.create(
            {
                SERVICE_NAME: service_name,
                "service.version": service_version,
                "deployment.environment": environment,
            }
        )


class TelemetryProvider:
    """Manages OpenTelemetry initialization and cleanup"""

    def __init__(self, config: TelemetryConfig):
        self.config = config
        self.tracer_provider: Optional[TracerProvider] = None
        self.meter_provider: Optional[MeterProvider] = None

    def initialize(self) -> None:
        """Initialize tracing, metrics, and instrumentation"""

        # Configure trace exporter
        self._setup_tracing()

        # Configure metrics
        self._setup_metrics()

        # Instrument libraries
        self._instrument_libraries()

        # Configure propagators for context propagation
        self._setup_propagators()

    def _setup_tracing(self) -> None:
        """Setup distributed tracing with Jaeger"""

        # Create tracer provider
        self.tracer_provider = TracerProvider(resource=self.config.resource)

        # Add Jaeger exporter if enabled
        if self.config.jaeger_enabled:
            jaeger_exporter = JaegerExporter(
                agent_host_name=self.config.jaeger_host,
                agent_port=self.config.jaeger_port,
            )
            self.tracer_provider.add_span_processor(
                BatchSpanProcessor(jaeger_exporter)
            )

        # Add OTLP exporter if enabled
        if self.config.otlp_enabled:
            otlp_exporter = OTLPSpanExporter(endpoint=self.config.otlp_endpoint)
            self.tracer_provider.add_span_processor(
                BatchSpanProcessor(otlp_exporter)
            )

        # Set as global provider
        trace.set_tracer_provider(self.tracer_provider)

    def _setup_metrics(self) -> None:
        """Setup metrics collection with Prometheus"""

        # Prometheus reader for metrics export
        prometheus_reader = PrometheusMetricReader()

        # Create meter provider
        self.meter_provider = MeterProvider(
            resource=self.config.resource,
            metric_readers=[prometheus_reader],
        )

        # Set as global provider
        metrics.set_meter_provider(self.meter_provider)

    def _instrument_libraries(self) -> None:
        """Instrument FastAPI, SQLAlchemy, Redis, and other libraries"""

        # FastAPI instrumentation
        FastAPIInstrumentor.instrument()

        # SQLAlchemy instrumentation
        SQLAlchemyInstrumentor.instrument(
            engine_hook_attrs={"sqlalchemy": "engine"},
            skip_dep_check=True,
        )

        # Redis instrumentation
        RedisInstrumentor.instrument(
            skip_dep_check=True,
        )

        # HTTP requests instrumentation
        RequestsInstrumentor.instrument()
        HTTPXClientInstrumentor.instrument()

        # Celery instrumentation
        try:
            CeleryInstrumentor.instrument()
        except Exception:
            # Celery might not be initialized yet
            pass

    def _setup_propagators(self) -> None:
        """Setup trace context propagators for distributed tracing"""

        # Use multiple propagators for compatibility
        propagators = [
            TraceContextPropagator(),  # W3C Trace Context
            BaggagePropagator(),       # W3C Baggage
            JagerPropagator(),         # Jaeger propagator
            B3SingleFormat(),          # B3 Single Header format
        ]

        set_global_textmap(propagators)

    def shutdown(self) -> None:
        """Shutdown telemetry providers"""
        if self.tracer_provider:
            self.tracer_provider.force_flush()
            self.tracer_provider.shutdown()

        if self.meter_provider:
            self.meter_provider.force_flush()
            self.meter_provider.shutdown()


def get_telemetry_config(app_config) -> TelemetryConfig:
    """Create telemetry config from app settings"""

    return TelemetryConfig(
        service_name="grayfsm-backend",
        service_version=app_config.app_version,
        jaeger_host=getattr(app_config, "jaeger_host", "localhost"),
        jaeger_port=getattr(app_config, "jaeger_port", 6831),
        jaeger_enabled=getattr(app_config, "jaeger_enabled", True),
        otlp_enabled=getattr(app_config, "otlp_enabled", False),
        otlp_endpoint=getattr(app_config, "otlp_endpoint", "http://otel-collector:4317"),
        environment=app_config.environment,
    )


def initialize_telemetry(app_config) -> TelemetryProvider:
    """Initialize and return telemetry provider"""

    config = get_telemetry_config(app_config)
    provider = TelemetryProvider(config)
    provider.initialize()
    return provider


# Context manager for telemetry lifecycle
@asynccontextmanager
async def telemetry_context(app_config):
    """Context manager for telemetry initialization and cleanup"""

    provider = initialize_telemetry(app_config)
    try:
        yield provider
    finally:
        provider.shutdown()
