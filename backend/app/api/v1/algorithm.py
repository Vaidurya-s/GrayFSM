"""
Algorithm optimization endpoints
"""
import uuid
from typing import Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.algorithms import list_algorithms
from app.db.session import get_db
from app.middleware.auth import UserToken, get_optional_current_user, get_required_current_user
from app.models.fsm import AlgorithmResult
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


async def _run_optimization_task(
    task_id: str, fsm_id: UUID, algorithm: str, options: dict
) -> None:
    """Background task: runs optimization and updates task store."""
    from app.api.v1.tasks import update_task
    from app.db.session import AsyncSessionLocal

    update_task(task_id, status="running")
    try:
        async with AsyncSessionLocal() as db:
            service = OptimizationService(db)
            req = OptimizationRequest.model_validate(
                {"algorithm": algorithm, "async": False, "options": options or {}}
            )
            result = await service.optimize_fsm(fsm_id, req)
            update_task(task_id, status="completed", result=result.model_dump(mode="json"))
    except Exception as exc:
        update_task(task_id, status="failed", error=str(exc))


@router.post("/{fsm_id}/optimize", response_model=OptimizationResponse)
async def optimize_fsm(
    fsm_id: UUID,
    request: OptimizationRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: UserToken = Depends(get_required_current_user),
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
    if request.async_mode:
        from app.api.v1.tasks import create_task
        task_id = str(uuid.uuid4())
        create_task(task_id, str(fsm_id))
        background_tasks.add_task(
            _run_optimization_task,
            task_id,
            fsm_id,
            request.algorithm,
            request.options or {},
        )
        return JSONResponse(status_code=202, content={
            "task_id": task_id,
            "status": "pending",
            "websocket_url": f"/api/v1/tasks/{task_id}/ws",
        })

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


@router.get("/{fsm_id}/results")
async def get_optimization_results(
    fsm_id: UUID,
    algorithm: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[UserToken] = Depends(get_optional_current_user),
):
    """
    List optimization results for a given FSM.

    Returns all AlgorithmResult records associated with this FSM, optionally
    filtered by algorithm name.

    Args:
        fsm_id: UUID of the FSM
        algorithm: Optional filter — only return results for this algorithm

    Returns:
        Wrapped list of optimization result records
    """
    query = select(AlgorithmResult).where(AlgorithmResult.original_fsm_id == fsm_id)
    if algorithm:
        query = query.where(AlgorithmResult.algorithm == algorithm)
    query = query.order_by(AlgorithmResult.executed_at.desc())

    result = await db.execute(query)
    rows = list(result.scalars().all())

    data = []
    for row in rows:
        data.append({
            "id": str(row.id),
            "algorithm": row.algorithm,
            "execution_time_ms": row.execution_time_ms,
            "dummy_states_added": row.dummy_states_added,
            "total_states_final": row.total_states_final,
            "avg_hamming_before": float(row.avg_hamming_before) if row.avg_hamming_before is not None else None,
            "avg_hamming_after": float(row.avg_hamming_after) if row.avg_hamming_after is not None else None,
            "improvement_percentage": float(row.improvement_percentage) if row.improvement_percentage is not None else None,
            "success": row.success,
            "error_message": row.error_message,
            "executed_at": row.executed_at.isoformat() if row.executed_at else None,
        })

    return JSONResponse(content=jsonable_encoder({"success": True, "data": data}))


@router.post("/{fsm_id}/compare")
async def compare_algorithms(
    fsm_id: UUID,
    compare_request: Dict,
    db: AsyncSession = Depends(get_db),
    current_user: UserToken = Depends(get_required_current_user),
):
    """
    Compare multiple optimization algorithms on a single FSM.

    Runs each specified algorithm against the FSM and returns their results
    side-by-side for comparison.

    Args:
        fsm_id: UUID of the FSM to optimize
        compare_request: Dict with "algorithms" list and optional "options"

    Returns:
        Wrapped list of OptimizationResponse objects — one per algorithm
    """
    algorithms: List[str] = compare_request.get("algorithms", [])
    options: dict = compare_request.get("options", {})

    if not algorithms:
        raise HTTPException(status_code=422, detail="At least one algorithm must be specified")

    valid = {"greedy", "bfs_optimal", "global_sa", "global_ga"}
    invalid = [a for a in algorithms if a not in valid]
    if invalid:
        raise HTTPException(status_code=422, detail=f"Unknown algorithms: {invalid}")

    service = OptimizationService(db)
    results = []

    for algo in algorithms:
        try:
            req = OptimizationRequest.model_validate(
                {"algorithm": algo, "async": False, "options": options}
            )
            result = await service.optimize_fsm(fsm_id, req)
            results.append(result.model_dump(mode="json"))
        except FSMNotFoundException as e:
            raise HTTPException(status_code=404, detail=str(e))
        except (AlgorithmException, FSMValidationException) as e:
            results.append({
                "algorithm": algo,
                "error": str(e),
                "success": False,
            })

    return JSONResponse(content=jsonable_encoder({"success": True, "data": results}))


@router.get("/algorithms")
async def get_available_algorithms(
    current_user: Optional[UserToken] = Depends(get_optional_current_user),
):
    """
    List all available optimization algorithms.

    Returns:
        List of algorithm metadata including name, version, and description
    """
    return list_algorithms()
