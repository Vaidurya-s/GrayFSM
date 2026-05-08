"""
OpenTelemetry instrumentation for GrayFSM Backend

Configures distributed tracing with Jaeger/OTLP exporters and automatic
span creation for FastAPI and SQLAlchemy.

All OpenTelemetry imports are wrapped in try/except so the application
can start without the opentelemetry packages installed.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

logger = logging.getLogger(__name__)

# Sentinel that tracks whether telemetry was successfully initialised
_telemetry_provider: Optional[Any] = None


def setup_telemetry(app: Any) -> None:
    """
    Initialise OpenTelemetry tracing and instrument FastAPI.

    This is safe to call even when opentelemetry packages are not installed —
    it will log a warning and return without side-effects.
    """
    global _telemetry_provider

    try:
        from opentelemetry import trace
        from opentelemetry.propagate import set_global_textmap
        from opentelemetry.sdk.resources import SERVICE_NAME, Resource
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor
        from opentelemetry.sdk.trace.propagation.tracecontext import (
            TraceContextPropagator,
        )
    except ImportError:
        logger.info("opentelemetry SDK not installed — tracing disabled")
        return

    # Read config from the app (settings attached by FastAPI)
    try:
        from app.config import settings

        service_name = getattr(settings, "app_name", "grayfsm-backend")
        service_version = getattr(settings, "app_version", "1.0.0")
        environment = getattr(settings, "environment", "development")
        jaeger_host = getattr(settings, "jaeger_host", "localhost")
        jaeger_port = getattr(settings, "jaeger_port", 6831)
        jaeger_enabled = getattr(settings, "jaeger_enabled", False)
        otlp_enabled = getattr(settings, "otlp_enabled", False)
        otlp_endpoint = getattr(settings, "otlp_endpoint", "http://jaeger:4317")
    except Exception:
        service_name = "grayfsm-backend"
        service_version = "1.0.0"
        environment = "development"
        jaeger_host = "localhost"
        jaeger_port = 6831
        jaeger_enabled = False
        otlp_enabled = False
        otlp_endpoint = "http://jaeger:4317"

    # Build resource describing this service
    resource = Resource.create(
        {
            SERVICE_NAME: service_name,
            "service.version": service_version,
            "deployment.environment": environment,
        }
    )

    # Create tracer provider
    tracer_provider = TracerProvider(resource=resource)

    # --- Jaeger Thrift exporter (optional) ---
    if jaeger_enabled:
        try:
            from opentelemetry.exporter.jaeger.thrift import JaegerExporter

            jaeger_exporter = JaegerExporter(
                agent_host_name=jaeger_host,
                agent_port=jaeger_port,
            )
            tracer_provider.add_span_processor(BatchSpanProcessor(jaeger_exporter))
            logger.info("Jaeger Thrift exporter enabled (%s:%s)", jaeger_host, jaeger_port)
        except ImportError:
            logger.warning("opentelemetry-exporter-jaeger not installed — skipping Jaeger Thrift")

    # --- OTLP gRPC exporter (preferred for Jaeger all-in-one >=1.35) ---
    if otlp_enabled:
        try:
            from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import (
                OTLPSpanExporter,
            )

            otlp_exporter = OTLPSpanExporter(endpoint=otlp_endpoint, insecure=True)
            tracer_provider.add_span_processor(BatchSpanProcessor(otlp_exporter))
            logger.info("OTLP gRPC exporter enabled (%s)", otlp_endpoint)
        except ImportError:
            logger.warning("opentelemetry-exporter-otlp-proto-grpc not installed — skipping OTLP")

    # Register as global tracer provider
    trace.set_tracer_provider(tracer_provider)

    # W3C Trace Context propagator (safe default)
    try:
        set_global_textmap(TraceContextPropagator())
    except Exception:
        pass

    # --- Auto-instrument FastAPI ---
    try:
        from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

        FastAPIInstrumentor.instrument_app(app)
        logger.info("FastAPI auto-instrumented with OpenTelemetry")
    except ImportError:
        logger.info("opentelemetry-instrumentation-fastapi not installed — skipping")

    # --- Auto-instrument SQLAlchemy (best-effort) ---
    try:
        from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor

        SQLAlchemyInstrumentor().instrument(skip_dep_check=True)
        logger.info("SQLAlchemy auto-instrumented with OpenTelemetry")
    except ImportError:
        pass
    except Exception as exc:
        logger.debug("SQLAlchemy instrumentation skipped: %s", exc)

    _telemetry_provider = tracer_provider
    logger.info("OpenTelemetry tracing initialised")


def shutdown_telemetry() -> None:
    """Flush and shut down the tracer provider (call on app shutdown)."""
    global _telemetry_provider
    if _telemetry_provider is not None:
        try:
            _telemetry_provider.force_flush()
            _telemetry_provider.shutdown()
        except Exception as exc:
            logger.warning("Error shutting down telemetry: %s", exc)
        finally:
            _telemetry_provider = None
