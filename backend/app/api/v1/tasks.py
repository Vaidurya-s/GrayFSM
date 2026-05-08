"""
Task status tracking for async operations.

Tasks are owned by the user who created them. The /tasks/{task_id} endpoint
requires authentication and only returns tasks owned by the calling user;
this prevents an attacker who guesses or scrapes a task UUID from reading
another user's optimization output (which can include the original FSM
definition).
"""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse

from app.middleware.auth import UserToken, get_required_current_user
from app.utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter()

# In-memory store: task_id -> task state dict
# Format: {"task_id": str, "status": str, "fsm_id": str, "user_id": str, ...}
_task_store: dict[str, Any] = {}


def create_task(task_id: str, fsm_id: str, user_id: str = None) -> dict:
    """Register a new task and return its initial state.

    user_id is the owner; /tasks/{task_id} only returns tasks for their
    owner. Pre-existing callers that don't pass user_id create a task with
    no owner — those are inaccessible via the API and only readable by the
    background worker that holds the task_id.
    """
    state = {
        "task_id": task_id,
        "status": "pending",
        "fsm_id": fsm_id,
        "user_id": user_id,
    }
    _task_store[task_id] = state
    return state


def update_task(task_id: str, **kwargs) -> None:
    """Update task state fields."""
    if task_id in _task_store:
        _task_store[task_id].update(kwargs)


def get_task(task_id: str) -> dict:
    """Return task state or None if not found."""
    return _task_store.get(task_id)


@router.get("/{task_id}")
async def get_task_status(
    task_id: str,
    current_user: UserToken = Depends(get_required_current_user),
):
    """Get the status of an async optimization task. Owner-only."""
    task = get_task(task_id)
    # Treat "task does not exist" and "not yours" identically so a caller
    # cannot enumerate task IDs.
    if task is None or task.get("user_id") != current_user["user_id"]:
        if task is not None:
            logger.warning(
                "task_access_denied",
                extra={"task_id": task_id, "caller": current_user["user_id"]},
            )
        raise HTTPException(status_code=404, detail="Task not found")
    # Don't echo internal user_id back to the client.
    payload = {k: v for k, v in task.items() if k != "user_id"}
    return JSONResponse(content={"success": True, **payload})
