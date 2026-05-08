"""
Configuration management for GrayFSM Backend

This module handles all application configuration using Pydantic Settings.
Configuration is loaded from environment variables with validation.
"""

import logging
from typing import List, Optional
from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_config_logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""
    
    # Application
    app_name: str = "GrayFSM API"
    app_version: str = "1.0.0"
    environment: str = "development"
    debug: bool = False
    log_level: str = "INFO"
    
    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    workers: int = 4
    reload: bool = True
    
    # Database
    database_url: str = Field(
        default="postgresql+asyncpg://grayfsm:password@localhost:5432/grayfsm",
        description="PostgreSQL database URL"
    )
    database_pool_size: int = 20
    database_max_overflow: int = 10
    database_echo: bool = False
    
    # Redis
    redis_url: str = "redis://localhost:6379/0"
    redis_cache_ttl: int = 3600  # seconds
    redis_max_connections: int = 50
    
    # Authentication (Phase 4)
    secret_key: str = ""
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    
    # CORS
    cors_origins: List[str] = ["http://localhost:3000", "http://localhost:5173"]
    cors_allow_credentials: bool = False
    cors_allow_methods: List[str] = ["*"]
    cors_allow_headers: List[str] = ["*"]
    
    # Rate Limiting
    rate_limit_enabled: bool = True
    rate_limit_anonymous: int = 100  # requests per window
    rate_limit_authenticated: int = 1000
    rate_limit_window: int = 3600  # seconds (1 hour)

    # Algorithm Defaults
    default_algorithm: str = "greedy"
    algorithm_timeout_ms: int = 30000
    max_fsm_states: int = 256
    max_optimization_time_ms: int = 300000
    
    # Export
    export_cache_enabled: bool = True
    export_cache_ttl_days: int = 7
    export_max_file_size_mb: int = 10
    
    # Monitoring
    sentry_dsn: Optional[str] = None
    metrics_enabled: bool = True
    
    # File Upload
    max_upload_size_mb: int = 5
    allowed_upload_formats: List[str] = ["json", "csv"]
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )
    
    @field_validator("log_level")
    @classmethod
    def validate_log_level(cls, v: str) -> str:
        """Validate log level"""
        allowed = ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]
        if v.upper() not in allowed:
            raise ValueError(f"Log level must be one of {allowed}")
        return v.upper()
    
    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: str | List[str]) -> List[str]:
        """Parse CORS origins from string or list"""
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",")]
        return v

    @model_validator(mode="after")
    def validate_production_settings(self) -> "Settings":
        """Enforce secure defaults when running in production."""
        if self.environment.lower() != "production":
            return self

        if not self.secret_key or "change-in-production" in self.secret_key:
            raise ValueError(
                "SECRET_KEY must be set to a strong, unique value in production. "
                "It must not be empty or contain the placeholder 'change-in-production'."
            )

        if len(self.secret_key) < 32:
            raise ValueError(
                "SECRET_KEY must be at least 32 bytes in production."
            )

        if self.debug:
            raise ValueError(
                "DEBUG must be False in production. "
                "Set the DEBUG environment variable to 'false'."
            )

        # Reject the dev-default DB credentials — easy to ship by accident.
        if "grayfsm:password@" in self.database_url:
            raise ValueError(
                "DATABASE_URL contains the development placeholder password. "
                "Set DATABASE_URL to the production connection string."
            )

        if self.cors_origins == ["*"]:
            _config_logger.warning(
                "SECURITY WARNING: cors_origins is set to ['*'] in production. "
                "Consider restricting CORS_ORIGINS to specific trusted origins."
            )

        return self

    @property
    def is_production(self) -> bool:
        """Check if running in production environment"""
        return self.environment.lower() == "production"
    
    @property
    def export_cache_ttl_seconds(self) -> int:
        """Get export cache TTL in seconds"""
        return self.export_cache_ttl_days * 24 * 3600


# Global settings instance
settings = Settings()


# Logging configuration
LOGGING_CONFIG = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "default": {
            "format": "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
            "datefmt": "%Y-%m-%d %H:%M:%S",
        },
        "json": {
            "()": "pythonjsonlogger.jsonlogger.JsonFormatter",
            "format": "%(asctime)s %(name)s %(levelname)s %(message)s",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "default" if not settings.is_production else "json",
            "stream": "ext://sys.stdout",
        },
    },
    "loggers": {
        "": {  # root logger
            "handlers": ["console"],
            "level": settings.log_level,
            "propagate": True,
        },
        "uvicorn": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
        "sqlalchemy.engine": {
            "handlers": ["console"],
            "level": "WARNING" if not settings.debug else "INFO",
            "propagate": False,
        },
    },
}
