"""Unit tests for the TokenBlacklist class.

Covers the in-memory fallback path (no Redis) plus the Redis-write/read
paths via a mock client. The class uses both code paths in production —
Redis when available, the local set when not — and we want to exercise
both without spinning up a real Redis.
"""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from app.middleware.token_blacklist import TokenBlacklist


# ---------------------------------------------------------------------------
# In-memory fallback (Redis not provided)
# ---------------------------------------------------------------------------


class TestInMemoryFallback:
    def test_unrevoked_token_is_not_blacklisted(self):
        bl = TokenBlacklist(redis_client=None)
        assert bl.is_revoked("any.jwt.token") is False

    def test_revoked_token_is_blacklisted(self):
        bl = TokenBlacklist(redis_client=None)
        bl.revoke("victim.jwt.token", ttl_seconds=60)
        assert bl.is_revoked("victim.jwt.token") is True

    def test_revoke_does_not_affect_other_tokens(self):
        bl = TokenBlacklist(redis_client=None)
        bl.revoke("victim.jwt.token", ttl_seconds=60)
        assert bl.is_revoked("untouched.jwt.token") is False

    def test_revoke_is_idempotent(self):
        bl = TokenBlacklist(redis_client=None)
        bl.revoke("token.jwt.x", ttl_seconds=60)
        bl.revoke("token.jwt.x", ttl_seconds=60)
        bl.revoke("token.jwt.x", ttl_seconds=60)
        assert bl.is_revoked("token.jwt.x") is True

    def test_default_ttl_when_omitted(self):
        # Should not raise and should still mark the token as revoked.
        bl = TokenBlacklist(redis_client=None)
        bl.revoke("token.jwt.no.ttl")
        assert bl.is_revoked("token.jwt.no.ttl") is True


# ---------------------------------------------------------------------------
# Redis path — happy
# ---------------------------------------------------------------------------


class TestRedisPath:
    def test_revoke_calls_setex_with_hashed_key(self):
        redis = MagicMock()
        bl = TokenBlacklist(redis_client=redis)
        bl.revoke("token.jwt.x", ttl_seconds=120)

        assert redis.setex.called
        key_arg, ttl_arg, value_arg = redis.setex.call_args.args
        assert key_arg.startswith("jwt:bl:")
        # SHA-256 hex is 64 chars; we truncate to the first 32.
        assert len(key_arg) == len("jwt:bl:") + 32
        assert ttl_arg == 120
        assert value_arg == "1"

    def test_is_revoked_consults_redis_exists(self):
        redis = MagicMock()
        redis.exists.return_value = 1
        bl = TokenBlacklist(redis_client=redis)

        assert bl.is_revoked("any.jwt.token") is True
        assert redis.exists.called

    def test_is_revoked_returns_false_when_redis_says_no(self):
        redis = MagicMock()
        redis.exists.return_value = 0
        bl = TokenBlacklist(redis_client=redis)

        assert bl.is_revoked("any.jwt.token") is False

    def test_token_hash_is_stable_across_calls(self):
        # Same token -> same Redis key on every revoke and is_revoked call.
        redis = MagicMock()
        bl = TokenBlacklist(redis_client=redis)
        bl.revoke("stable.jwt.x", ttl_seconds=60)
        bl.is_revoked("stable.jwt.x")

        revoke_key = redis.setex.call_args.args[0]
        check_key = redis.exists.call_args.args[0]
        assert revoke_key == check_key


# ---------------------------------------------------------------------------
# Redis path — degradation
# ---------------------------------------------------------------------------


class TestRedisDegradation:
    def test_revoke_falls_back_to_memory_when_redis_setex_raises(self):
        redis = MagicMock()
        redis.setex.side_effect = RuntimeError("connection lost")
        bl = TokenBlacklist(redis_client=redis)

        # Should not raise.
        bl.revoke("token.jwt.x", ttl_seconds=60)

        # is_revoked falls back to local set (which IS populated by the
        # except branch). Even though Redis exists() will be called and
        # may also fail, the local set check happens first.
        assert bl.is_revoked("token.jwt.x") is True

    def test_is_revoked_returns_false_when_redis_exists_raises(self):
        redis = MagicMock()
        redis.exists.side_effect = RuntimeError("connection lost")
        bl = TokenBlacklist(redis_client=redis)

        # Token never revoked, Redis errors -> fail-open False.
        assert bl.is_revoked("token.jwt.never.revoked") is False

    def test_locally_revoked_token_still_blacklisted_when_redis_fails(self):
        redis = MagicMock()
        redis.setex.side_effect = RuntimeError("connection lost")
        redis.exists.side_effect = RuntimeError("connection lost")
        bl = TokenBlacklist(redis_client=redis)

        bl.revoke("token.jwt.x", ttl_seconds=60)
        assert bl.is_revoked("token.jwt.x") is True


# ---------------------------------------------------------------------------
# Hash key safety
# ---------------------------------------------------------------------------


class TestKeyHashing:
    @pytest.mark.parametrize(
        "token",
        [
            "short",
            "a.b.c",
            "x" * 1000,
            "header.payload.signature",
            "with spaces and ünicödé",
        ],
    )
    def test_key_is_always_short_hex(self, token: str):
        # Whatever the input, the Redis key is bounded to a known length
        # — protects against accidentally storing large tokens as keys.
        bl = TokenBlacklist()
        key = bl._key(token)
        assert key.startswith("jwt:bl:")
        suffix = key[len("jwt:bl:"):]
        assert len(suffix) == 32
        assert all(c in "0123456789abcdef" for c in suffix)

    def test_different_tokens_get_different_keys(self):
        bl = TokenBlacklist()
        assert bl._key("a.jwt.token") != bl._key("b.jwt.token")
