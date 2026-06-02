"""
Task status tracking for async operations.

Tasks are owned by the user who created them. The /tasks/{task_id} endpoint
requires authentication and only returns tasks owned by the calling user;
this prevents an attacker who guesses or scrapes a task UUID from reading
another user's optimization output (which can include the original FSM
definition).

Storage
-------
Task state lives in Redis under ``task:{task_id}`` as a JSON blob so that:

  * tasks survive a backend restart / Railway redeploy
  * a multi-worker uvicorn setup (or future horizontal scale-out) shares
    one view of task progress regardless of which worker handled the
    create vs which worker handles the GET poll

TTL policy:

  * running / pending tasks: 7 days (covers slow optimizes; a stuck task
    will still get evicted eventually so Redis doesn't accumulate them)
  * completed / failed tasks: 24 hours (long enough for the frontend
    polling loop and any short-term debugging; short enough to keep
    Redis lean without a separate cleanup cron)

If Redis is unreachable we fall back to a per-process in-memory dict so
the optimize endpoint still works in dev / local without Redis running.
The fallback is process-local — durability is forfeited, but the API
contract is preserved and the user gets a working flow.
"""

import asyncio
import json
import time
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse

from app.cache import get_redis
from app.middleware.auth import UserToken, get_required_current_user
from app.utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter()

# TTL constants (seconds).
TTL_RUNNING = 7 * 24 * 60 * 60  # 7d — covers long-running optimizes
TTL_TERMINAL = 24 * 60 * 60  # 24h — completed / failed tasks

# Status values considered "terminal" for TTL purposes.
_TERMINAL_STATUSES = frozenset({"completed", "failed"})


def _task_key(task_id: str) -> str:
    return f"task:{task_id}"


# Process-local fallback. Used only when Redis is unreachable so the
# optimize endpoint doesn't 500 in dev / when the Redis sidecar hiccups.
# Not durable, not multi-worker safe — by design, this is degraded mode.
_fallback_store: dict[str, dict] = {}
_fallback_lock = asyncio.Lock()


def _ttl_for_status(status: str) -> int:
    return TTL_TERMINAL if status in _TERMINAL_STATUSES else TTL_RUNNING


async def create_task(task_id: str, fsm_id: str, user_id: str | None = None) -> dict:
    """Register a new task and return its initial state.

    ``user_id`` is the owner; /tasks/{task_id} only returns tasks for their
    owner. Pre-existing callers that don't pass user_id create a task with
    no owner — those are inaccessible via the API and only readable by the
    background worker that holds the task_id.

    Uses Redis SETNX so two workers racing on the same uuid (astronomically
    improbable for v4 uuids, but cheap to guard against) cannot clobber
    each other.
    """
    state = {
        "task_id": task_id,
        "status": "pending",
        "fsm_id": fsm_id,
        "user_id": user_id,
        "progress": None,
        "result": None,
        "error": None,
        "created_at": time.time(),
    }
    client = await get_redis()
    if client is not None:
        try:
            # nx=True -> SETNX semantics. If the key already exists we keep
            # the existing record (treat as idempotent create).
            ok = await client.set(
                _task_key(task_id),
                json.dumps(state, default=str),
                ex=TTL_RUNNING,
                nx=True,
            )
            if not ok:
                # Already exists (collision or duplicate create). Read back
                # whatever's there so the caller sees a consistent view.
                raw = await client.get(_task_key(task_id))
                if raw:
                    return json.loads(raw)
            return state
        except Exception:
            logger.warning(
                "task_store_redis_create_failed_fallback_to_memory",
                extra={"task_id": task_id},
                exc_info=True,
            )

    # Fallback: in-memory.
    async with _fallback_lock:
        _fallback_store[task_id] = state
    return state


async def update_task(task_id: str, **kwargs: Any) -> None:
    """Update task state fields.

    No-op if the task no longer exists (e.g. evicted by TTL between create
    and update). We don't recreate the record because the original owner
    metadata is unrecoverable, and a half-populated record could leak data
    to the wrong user. We log + drop.
    """
    client = await get_redis()
    if client is not None:
        try:
            raw = await client.get(_task_key(task_id))
            if raw is None:
                logger.info(
                    "task_update_missing_key",
                    extra={"task_id": task_id, "fields": list(kwargs.keys())},
                )
                return
            state = json.loads(raw)
            state.update(kwargs)
            new_status = state.get("status", "pending")
            await client.set(
                _task_key(task_id),
                json.dumps(state, default=str),
                ex=_ttl_for_status(new_status),
            )
            return
        except Exception:
            logger.warning(
                "task_store_redis_update_failed_fallback_to_memory",
                extra={"task_id": task_id},
                exc_info=True,
            )

    # Fallback path. If we wrote the create to Redis but Redis went down
    # before the update, the task won't be in the fallback store either —
    # in that case we no-op, matching the "evicted between create and
    # update" semantics. The user will see a stale "pending" status until
    # the frontend gives up; better than crashing the worker.
    async with _fallback_lock:
        if task_id in _fallback_store:
            _fallback_store[task_id].update(kwargs)


async def get_task(task_id: str) -> dict | None:
    """Return task state or None if not found.

    Reads from Redis first; falls back to in-memory if Redis is down. A
    miss (key gone / never existed) returns None so the GET endpoint can
    surface a 404 and the frontend polling loop terminates.
    """
    client = await get_redis()
    if client is not None:
        try:
            raw = await client.get(_task_key(task_id))
            if raw is not None:
                return json.loads(raw)
            # Even on a Redis miss, fall through to the in-memory store —
            # the task may have been created during a Redis outage and
            # only exist in this process's fallback.
        except Exception:
            logger.warning(
                "task_store_redis_get_failed_fallback_to_memory",
                extra={"task_id": task_id},
                exc_info=True,
            )

    async with _fallback_lock:
        return _fallback_store.get(task_id)


async def cleanup_old_tasks(max_age_seconds: int = TTL_TERMINAL) -> int:
    """Scan and delete completed/failed task keys older than ``max_age_seconds``.

    Not wired as a periodic job in this PR — Redis TTL handles eviction
    transparently. Provided as a helper for ops debugging / one-off
    cleanup runs.

    Returns the number of keys deleted (0 if Redis is unreachable).
    """
    client = await get_redis()
    if client is None:
        return 0
    deleted = 0
    cutoff = time.time() - max_age_seconds
    try:
        # SCAN to avoid blocking Redis on a large keyspace.
        async for key in client.scan_iter(match="task:*", count=100):
            try:
                raw = await client.get(key)
                if not raw:
                    continue
                state = json.loads(raw)
                if (
                    state.get("status") in _TERMINAL_STATUSES
                    and float(state.get("created_at", 0)) < cutoff
                ):
                    await client.delete(key)
                    deleted += 1
            except Exception:
                # Skip individual broken entries rather than aborting the scan.
                continue
    except Exception:
        logger.warning("task_store_cleanup_failed", exc_info=True)
    return deleted


@router.get("/{task_id}")
async def get_task_status(
    task_id: str,
    current_user: UserToken = Depends(get_required_current_user),
) -> Any:
    """Get the status of an async optimization task. Owner-only."""
    task = await get_task(task_id)
    # Treat "task does not exist" and "not yours" identically so a caller
    # cannot enumerate task IDs.
    if task is None or task.get("user_id") != current_user["user_id"]:
        if task is not None:
            logger.warning(
                "task_access_denied",
                extra={"task_id": task_id, "caller": current_user["user_id"]},
            )
        raise HTTPException(status_code=404, detail="Task not found")
    # Don't echo internal user_id / created_at back to the client. Drop
    # None-valued progress/result/error fields so the response shape
    # matches the pre-Redis contract (only populated fields present).
    payload = {
        k: v
        for k, v in task.items()
        if k not in {"user_id", "created_at"} and v is not None
    }
    return JSONResponse(content={"success": True, **payload})
