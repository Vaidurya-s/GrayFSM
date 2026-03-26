"""
Structured logging configuration for GrayFSM Backend

Configures JSON structured logging with trace context propagation
for correlation with distributed traces.
"""

import json
import logging
import sys
from typing import Dict, Any, Optional
from datetime import datetime
import traceback

import structlog
from structlog.processors import (
    JSONRenderer,
    TimeStamper,
    add_log_level,
    ProcessorFormatter,
)
from opentelemetry import trace


class TraceContextFilter(logging.Filter):
    """
    Logging filter that adds OpenTelemetry trace context to log records
    """

    def filter(self, record: logging.LogRecord) -> bool:
        """Add trace context to log record"""
        span = trace.get_current_span()

        if span and span.is_recording():
            span_context = span.get_span_context()
            record.trace_id = format(span_context.trace_id, "032x")
            record.span_id = format(span_context.span_id, "016x")
        else:
            record.trace_id = "0" * 32
            record.span_id = "0" * 16

        return True


class StructuredJSONFormatter(logging.Formatter):
    """
    Custom JSON formatter for structured logging with trace context
    """

    def format(self, record: logging.LogRecord) -> str:
        """Format log record as JSON with all context"""

        log_obj = {
            "timestamp": self.formatTime(record, "%Y-%m-%dT%H:%M:%S.%fZ"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "trace_id": getattr(record, "trace_id", "0" * 32),
            "span_id": getattr(record, "span_id", "0" * 16),
        }

        # Add extra fields
        if hasattr(record, "request_id"):
            log_obj["request_id"] = record.request_id

        if hasattr(record, "user_id"):
            log_obj["user_id"] = record.user_id

        if hasattr(record, "endpoint"):
            log_obj["endpoint"] = record.endpoint

        if hasattr(record, "method"):
            log_obj["method"] = record.method

        if hasattr(record, "status_code"):
            log_obj["status_code"] = record.status_code

        if hasattr(record, "duration_ms"):
            log_obj["duration_ms"] = record.duration_ms

        # Add exception info if present
        if record.exc_info:
            log_obj["exception"] = {
                "type": record.exc_info[0].__name__,
                "message": str(record.exc_info[1]),
                "traceback": traceback.format_exception(*record.exc_info),
            }

        # Add extra fields that were passed in
        if hasattr(record, "extra"):
            log_obj.update(record.extra)

        return json.dumps(log_obj, default=str)


def setup_structured_logging(environment: str = "development") -> None:
    """
    Setup structured logging with JSON output

    Args:
        environment: Deployment environment (development, staging, production)
    """

    # Configure structlog
    structlog.configure(
        processors=[
            structlog.stdlib.filter_by_level,
            add_log_level,
            TimeStamper(fmt="iso"),
            ProcessorFormatter.wrap_for_formatter,
        ],
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )

    # Configure standard logging
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.DEBUG if environment == "development" else logging.INFO)

    # Remove existing handlers
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)

    # Create handlers
    if environment == "development":
        # Development: simple console output
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(logging.DEBUG)
        formatter = logging.Formatter(
            "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
        )
        console_handler.setFormatter(formatter)
        root_logger.addHandler(console_handler)
    else:
        # Production: structured JSON output
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(logging.INFO)
        console_handler.addFilter(TraceContextFilter())
        console_handler.setFormatter(StructuredJSONFormatter())
        root_logger.addHandler(console_handler)

    # Suppress verbose logs
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)


class StructuredLogger:
    """
    Wrapper for structured logging with trace context
    """

    def __init__(self, name: str):
        """
        Initialize logger

        Args:
            name: Logger name
        """
        self.logger = logging.getLogger(name)
        self.trace_filter = TraceContextFilter()

    def _add_trace_context(self, extra: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Add trace context to log extra data"""
        span = trace.get_current_span()
        context = extra or {}

        if span and span.is_recording():
            span_context = span.get_span_context()
            context["trace_id"] = format(span_context.trace_id, "032x")
            context["span_id"] = format(span_context.span_id, "016x")

        return context

    def info(self, message: str, **kwargs) -> None:
        """Log info message with context"""
        extra = self._add_trace_context(kwargs)
        self.logger.info(message, extra=extra)

    def debug(self, message: str, **kwargs) -> None:
        """Log debug message with context"""
        extra = self._add_trace_context(kwargs)
        self.logger.debug(message, extra=extra)

    def warning(self, message: str, **kwargs) -> None:
        """Log warning message with context"""
        extra = self._add_trace_context(kwargs)
        self.logger.warning(message, extra=extra)

    def error(self, message: str, **kwargs) -> None:
        """Log error message with context"""
        extra = self._add_trace_context(kwargs)
        self.logger.error(message, extra=extra, exc_info=True)

    def critical(self, message: str, **kwargs) -> None:
        """Log critical message with context"""
        extra = self._add_trace_context(kwargs)
        self.logger.critical(message, extra=extra, exc_info=True)

    def exception(self, message: str, **kwargs) -> None:
        """Log exception with context"""
        extra = self._add_trace_context(kwargs)
        self.logger.exception(message, extra=extra)


def get_logger(name: str) -> StructuredLogger:
    """
    Get structured logger instance

    Args:
        name: Logger name (usually __name__)

    Returns:
        StructuredLogger instance
    """
    return StructuredLogger(name)


# Logging configuration dict for compatibility with existing config
def get_logging_config(environment: str = "development") -> Dict[str, Any]:
    """
    Get logging configuration dictionary

    Args:
        environment: Deployment environment

    Returns:
        Logging configuration dict
    """

    return {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "default": {
                "format": "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
                "datefmt": "%Y-%m-%d %H:%M:%S",
            },
            "json": {
                "()": StructuredJSONFormatter,
            },
        },
        "filters": {
            "trace_context": {
                "()": TraceContextFilter,
            },
        },
        "handlers": {
            "console": {
                "class": "logging.StreamHandler",
                "formatter": "default" if environment == "development" else "json",
                "stream": "ext://sys.stdout",
                "filters": ["trace_context"],
            },
            "file": {
                "class": "logging.handlers.RotatingFileHandler",
                "formatter": "json",
                "filename": "logs/app.log",
                "maxBytes": 10485760,  # 10MB
                "backupCount": 5,
                "filters": ["trace_context"],
            },
        },
        "loggers": {
            "": {  # root logger
                "handlers": ["console", "file"],
                "level": "DEBUG" if environment == "development" else "INFO",
                "propagate": True,
            },
            "uvicorn": {
                "handlers": ["console"],
                "level": "INFO",
                "propagate": False,
            },
            "sqlalchemy.engine": {
                "handlers": ["console"],
                "level": "WARNING",
                "propagate": False,
            },
            "opentelemetry": {
                "handlers": ["console"],
                "level": "WARNING",
                "propagate": False,
            },
        },
    }
