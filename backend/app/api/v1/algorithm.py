"""
Algorithm optimization endpoints
"""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.algorithms import list_algorithms
from app.db.session import get_db
from app.schemas.fsm import OptimizationRequest, OptimizationResponse
from app.services.optimization_service import OptimizationService
from app.utils.exceptions import (
    AlgorithmException,
    FSMNotFoundException,
    FSMValidationException,
)
from app.utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter()


@router.post("/{fsm_id}/optimize", response_model=OptimizationResponse)
async def optimize_fsm(
    fsm_id: UUID,
    request: OptimizationRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Optimize an FSM using the specified algorithm.

    Runs the selected optimization algorithm on the FSM identified by fsm_id.
    Creates a new optimized FSM record and returns optimization metrics.

    Args:
        fsm_id: UUID of the FSM to optimize
        request: Optimization parameters (algorithm, options, async_mode)

    Returns:
        OptimizationResponse with the optimized FSM ID and metrics

    Raises:
        404: FSM not found
        422: FSM validation error
        400: Algorithm error (unknown algorithm or execution failure)
    """
    # Handle async mode via Celery if requested
    if request.async_mode:
        try:
            from app.tasks.optimization import optimize_fsm_task
            if optimize_fsm_task is not None:
                task = optimize_fsm_task.delay(str(fsm_id), request.algorithm, request.options)
                return JSONResponse(status_code=202, content={
                    "task_id": task.id,
                    "status": "queued",
                    "message": "Optimization queued for async processing",
                })
        except Exception:
            pass  # Fall through to sync if Celery unavailable

    service = OptimizationService(db)

    try:
        result = await service.optimize_fsm(fsm_id, request)
        return result
    except FSMNotFoundException as e:
        raise HTTPException(status_code=404, detail=str(e))
    except FSMValidationException as e:
        raise HTTPException(status_code=422, detail=str(e))
    except AlgorithmException as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/algorithms")
async def get_available_algorithms():
    """
    List all available optimization algorithms.

    Returns:
        List of algorithm metadata including name, version, and description
    """
    return list_algorithms()
