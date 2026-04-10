"""
Task status tracking for async operations
"""
from typing import Dict, Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

router = APIRouter()

# In-memory store: task_id -> task state dict
# Format: {"task_id": str, "status": str, "fsm_id": str, ...}
_task_store: Dict[str, Any] = {}


def create_task(task_id: str, fsm_id: str) -> dict:
    """Register a new task and return its initial state."""
    state = {"task_id": task_id, "status": "pending", "fsm_id": fsm_id}
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
async def get_task_status(task_id: str):
    """Get the status of an async optimization task."""
    task = get_task(task_id)
    if task is None:
        raise HTTPException(status_code=404, detail=f"Task '{task_id}' not found")
    return JSONResponse(content=task)
