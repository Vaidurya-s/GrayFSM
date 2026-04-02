"""
Example FSM endpoints
"""
from fastapi import APIRouter, HTTPException

from app.services.example_service import ExampleService
from app.utils.exceptions import FSMNotFoundException
from app.utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter()

# Shared instance -- examples are loaded from static files, no DB needed
_example_service = ExampleService()


@router.get("")
async def list_examples():
    """
    List all example FSMs.

    Returns example FSMs loaded from the backend/examples/ directory.
    These are pre-built FSM definitions for demonstration and learning.

    Returns:
        List of example FSM objects with metadata and full definitions
    """
    examples = await _example_service.list_examples()
    return examples


@router.get("/{example_name}")
async def get_example(example_name: str):
    """
    Get a single example FSM by name.

    Args:
        example_name: Example identifier (file stem, e.g., 'elevator', 'traffic_light')

    Returns:
        Example FSM object with full definition

    Raises:
        404: Example not found
    """
    try:
        example = await _example_service.get_example(example_name)
        return example
    except FSMNotFoundException as e:
        raise HTTPException(status_code=404, detail=str(e))
