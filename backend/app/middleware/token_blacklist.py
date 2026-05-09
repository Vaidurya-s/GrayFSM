"""
JWT token revocation list.

Owns the "is this token revoked?" question. Used by ``app.middleware.auth``
to honour logout requests — a token added here will be rejected by
``_decode_token`` until it expires.

Design:

- Backed by Redis when reachable, with an in-process ``set`` fallback so
  single-worker dev setups and tests still work without Redis running.
- Tokens are stored as truncated SHA-256 hashes of the raw JWT, never the
  raw bytes. Keeps Redis keys short and prevents accidental disclosure if
  someone dumps the keyspace.
- Redis entries use SETEX with TTL = token's remaining lifetime, so
  expired revocations clean themselves up.
- Lazy connect: the Redis client is built on first use rather than at
  module import, so import-time settings can resolve before we try.
- Fail-open semantics: any Redis error (write fails, read fails, can't
  connect) falls back to the in-memory set rather than raising.

The previous implementation lived as module-level globals
(``_token_blacklist``, ``_sync_redis_client``, ``_redis_probe_done``)
inside ``auth.py``, which made it untestable without monkey-patching and
mixed three concerns (JWT, blacklist, FastAPI deps) in one file.
"""

from __future__ import annotations

import hashlib
from datetime import datetime
from typing import TYPE_CHECKING

from app.config import settings
from app.utils.logger import get_logger

if TYPE_CHECKING:  # pragma: no cover — only used by type checkers
    import redis as redis_pkg

logger = get_logger(__name__)


class TokenBlacklist:
    """Stores revoked JWT IDs with TTL.

    Constructor takes an optional pre-built Redis client. Pass ``None``
    (the default) to use only the in-process fallback — useful in tests
    that don't want to touch Redis.
    """

    def __init__(self, redis_client: redis_pkg.Redis | None = None):
        self._redis = redis_client
        self._fallback: set[str] = set()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def revoke(self, token: str, ttl_seconds: int | None = None) -> None:
        """Mark ``token`` as revoked. ``ttl_seconds`` defaults to the configured
        access-token lifetime, but callers should pass the actual remaining-
        until-exp seconds when they have it."""
        if ttl_seconds is None:
            ttl_seconds = settings.access_token_expire_minutes * 60

        if self._redis is not None:
            try:
                self._redis.setex(self._key(token), ttl_seconds, "1")
                return
            except Exception as exc:  # noqa: BLE001 — fall back, log
                logger.warning(
                    "TokenBlacklist: Redis write failed, using in-memory fallback",
                    extra={"error": str(exc)},
                )
        self._fallback.add(token)

    def is_revoked(self, token: str) -> bool:
        """Return True if ``token`` has been revoked."""
        if token in self._fallback:
            return True
        if self._redis is None:
            return False
        try:
            return bool(self._redis.exists(self._key(token)))
        except Exception:  # noqa: BLE001 — fail-open
            return False

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _key(token: str) -> str:
        """Hash + namespace the token so Redis keys stay short and don't leak
        the raw token if someone dumps the keyspace."""
        digest = hashlib.sha256(token.encode("utf-8")).hexdigest()
        return f"jwt:bl:{digest[:32]}"


# ---------------------------------------------------------------------------
# Default singleton instance
# ---------------------------------------------------------------------------
#
# The middleware module reaches in via `default_blacklist()`. Production code
# should prefer dependency-injection (request.app.state.token_blacklist or
# similar), but the singleton stays available for the existing
# `blacklist_token`/`is_token_blacklisted` module-level helpers in auth.py
# until those callers are migrated.

_default: TokenBlacklist | None = None


def _build_default_redis() -> redis_pkg.Redis | None:
    """Construct a sync Redis client for the singleton, or None if unreachable."""
    try:
        import redis  # noqa: WPS433 — lazy

        client: redis_pkg.Redis = redis.from_url(
            settings.redis_url,
            decode_responses=True,
            socket_connect_timeout=0.5,
            socket_timeout=0.5,
        )
        client.ping()
        logger.info("TokenBlacklist: connected to Redis")
        return client
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "TokenBlacklist: Redis unavailable, using in-memory set",
            extra={"error": str(exc)},
        )
        return None


def default_blacklist() -> TokenBlacklist:
    """Return the process-wide singleton, building it lazily on first call."""
    global _default
    if _default is None:
        _default = TokenBlacklist(_build_default_redis())
    return _default


# Convenience helpers preserving the old module-level API in auth.py
# so existing call-sites in api/v1/auth.py don't have to change.
def blacklist_token(token: str) -> None:
    """Revoke ``token`` on the default blacklist.

    Reads the token's `exp` claim (without verifying the signature) to
    set an accurate Redis TTL — that way expired entries clean up on
    their own. If the claim is missing or unparseable, falls back to the
    configured access-token lifetime.
    """
    default_blacklist().revoke(token, ttl_seconds=_remaining_ttl(token))


def is_token_blacklisted(token: str) -> bool:
    """Return True if ``token`` has been revoked on the default blacklist."""
    return default_blacklist().is_revoked(token)


def _remaining_ttl(token: str) -> int:
    """Best-effort: read `exp` and return seconds until it. Never negative."""
    try:
        from jose import jwt  # noqa: WPS433

        payload = jwt.get_unverified_claims(token)
        exp = int(payload.get("exp", 0))
        if exp:
            remaining = exp - int(datetime.utcnow().timestamp())
            if remaining > 0:
                return remaining
    except Exception:  # noqa: BLE001 — fall back below
        pass
    return settings.access_token_expire_minutes * 60
