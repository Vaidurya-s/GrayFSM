"""
Configuration management for GrayFSM Backend

This module handles all application configuration using Pydantic Settings.
Configuration is loaded from environment variables with validation.
"""

from typing import List, Optional
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""
    
    # Application
    app_name: str = "GrayFSM API"
    app_version: str = "1.0.0"
    environment: str = "development"
    debug: bool = True
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
    secret_key: str = "your-secret-key-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    
    # CORS
    cors_origins: List[str] = ["*"]
    cors_allow_credentials: bool = False
    cors_allow_methods: List[str] = ["*"]
    cors_allow_headers: List[str] = ["*"]
    
    # Rate Limiting
    rate_limit_enabled: bool = True
    rate_limit_anonymous: int = 100  # requests per window
    rate_limit_authenticated: int = 1000
    rate_limit_window: int = 3600  # seconds (1 hour)
    
    # Celery
    celery_broker_url: str = "redis://localhost:6379/1"
    celery_result_backend: str = "redis://localhost:6379/2"
    
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
        "file": {
            "class": "logging.handlers.RotatingFileHandler",
            "formatter": "json",
            "filename": "logs/app.log",
            "maxBytes": 10485760,  # 10MB
            "backupCount": 5,
        },
    },
    "loggers": {
        "": {  # root logger
            "handlers": ["console", "file"],
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
