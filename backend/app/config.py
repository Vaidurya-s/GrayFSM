"""
Configuration management for GrayFSM Backend

This module handles all application configuration using Pydantic Settings.
Configuration is loaded from environment variables with validation.
"""

import logging

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

    # Database. The defaults are obvious placeholders, NOT real connection
    # strings — they exist only so module imports don't fail when the env
    # isn't set yet (e.g. test collection time, `python -c "import app"`).
    # `validate_runtime_settings` rejects any URL containing the
    # `_placeholder_` sentinel for every environment except `test` and
    # `ci`, so a developer or deployer who forgets to set DATABASE_URL
    # fails fast at startup instead of dying inside SQLAlchemy at the
    # first query.
    database_url: str = Field(
        default="postgresql+asyncpg://_placeholder_:_placeholder_@127.0.0.1:5432/_placeholder_db_",
        description="PostgreSQL database URL (required outside ENVIRONMENT=test|ci)",
    )
    database_pool_size: int = 20
    database_max_overflow: int = 10
    database_echo: bool = False

    # Redis — same placeholder-default policy as database_url.
    redis_url: str = Field(
        default="redis://_placeholder_:0/0",
        description="Redis URL (required outside ENVIRONMENT=test|ci)",
    )
    redis_cache_ttl: int = 3600  # seconds
    redis_max_connections: int = 50

    # Authentication (Phase 4)
    secret_key: str = ""
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    # JWT audience claim — both encode and decode must agree.
    # Bumping this value invalidates every issued token.
    jwt_audience: str = "grayfsm-api"
    # Account-lockout policy. After N consecutive bad-password attempts
    # the account is locked for `account_lockout_minutes`. 5/15 was the
    # previous hardcoded pair in auth_service.
    max_failed_logins: int = 5
    account_lockout_minutes: int = 15

    # CORS
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:5173"]
    cors_allow_credentials: bool = False
    cors_allow_methods: list[str] = ["*"]
    cors_allow_headers: list[str] = ["*"]

    # Trusted Proxies — comma-separated list of IP addresses that are allowed
    # to set X-Forwarded-For. When empty (default), XFF is ignored and the
    # direct connection IP is used for rate limiting and logging.
    # Example: TRUSTED_PROXIES=10.0.0.1,10.0.0.2
    trusted_proxies: list[str] = Field(
        default=[],
        description="IPs of trusted reverse proxies that may set X-Forwarded-For",
    )

    # Rate Limiting
    rate_limit_enabled: bool = True
    rate_limit_anonymous: int = 100  # requests per window
    rate_limit_authenticated: int = 1000
    rate_limit_window: int = 3600  # seconds (1 hour)
    # Auth-endpoint rate limits (per-IP, narrower window than the
    # anonymous-tier limit above). Tightening these is a brute-force
    # mitigation; loosening them in dev is fine.
    rate_limit_login: int = 5  # requests per `rate_limit_login_window`
    rate_limit_login_window: int = 60
    rate_limit_register: int = 3  # requests per `rate_limit_register_window`
    rate_limit_register_window: int = 60

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
    sentry_dsn: str | None = None
    metrics_enabled: bool = True

    # File Upload
    max_upload_size_mb: int = 5
    allowed_upload_formats: list[str] = ["json", "csv"]

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", case_sensitive=False, extra="ignore"
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
    def parse_cors_origins(cls, v: str | list[str]) -> list[str]:
        """Parse CORS origins from string or list"""
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",")]
        return v

    @field_validator("trusted_proxies", mode="before")
    @classmethod
    def parse_trusted_proxies(cls, v: str | list[str]) -> list[str]:
        """Parse trusted proxy IPs from comma-separated string or list"""
        if isinstance(v, str):
            return [ip.strip() for ip in v.split(",") if ip.strip()]
        return v

    @model_validator(mode="after")
    def validate_runtime_settings(self) -> "Settings":
        """Enforce config sanity by environment.

        - `test` / `ci`: skip all checks. Tests run with placeholder URLs
          and never connect to real backends.
        - Every other environment (development, staging, production): reject
          placeholder DATABASE_URL / REDIS_URL so a missing env var fails
          fast at `Settings()` instantiation with a clear message instead
          of dying inside SQLAlchemy on the first query.
        - `production`: additional hardening (real SECRET_KEY, DEBUG=False,
          no dev-default DB credentials).
        """
        env = self.environment.lower()
        if env in ("test", "ci"):
            return self

        if not self.database_url or "_placeholder_" in self.database_url:
            raise ValueError(
                "DATABASE_URL must be set to a real connection string. "
                "Copy backend/.env.example to backend/.env and edit, or "
                "export DATABASE_URL=... in your shell. (Set ENVIRONMENT=test "
                "to skip this check when running unit tests.)"
            )
        if not self.redis_url or "_placeholder_" in self.redis_url:
            raise ValueError(
                "REDIS_URL must be set to a real connection string. See backend/.env.example."
            )

        if env != "production":
            return self

        # Production-only hardening below.
        if not self.secret_key or "change-in-production" in self.secret_key:
            raise ValueError(
                "SECRET_KEY must be set to a strong, unique value in production. "
                "It must not be empty or contain the placeholder 'change-in-production'."
            )

        if len(self.secret_key) < 32:
            raise ValueError("SECRET_KEY must be at least 32 bytes in production.")

        if self.debug:
            raise ValueError(
                "DEBUG must be False in production. Set the DEBUG environment variable to 'false'."
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
