"""
FSM CRUD API endpoints
"""
import math
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.middleware.auth import UserToken, get_optional_current_user, get_required_current_user
from app.schemas.fsm import FSMCreate, FSMFork, FSMResponse, FSMUpdate
from app.services.fsm_service import FSMService
from app.utils.exceptions import FSMNotFoundException, FSMValidationException

router = APIRouter()


@router.post("", response_model=FSMResponse, status_code=201)
async def create_fsm(
    fsm_data: FSMCreate,
    db: AsyncSession = Depends(get_db),
    current_user: UserToken = Depends(get_required_current_user),
):
    """Create a new FSM."""
    service = FSMService(db)
    try:
        fsm = await service.create_fsm(fsm_data)
        return fsm
    except FSMValidationException as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.get("/{fsm_id}", response_model=FSMResponse)
async def get_fsm(
    fsm_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[UserToken] = Depends(get_optional_current_user),
):
    """Get FSM by ID."""
    service = FSMService(db)
    try:
        fsm = await service.get_fsm(fsm_id)
        return fsm
    except FSMNotFoundException as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.put("/{fsm_id}", response_model=FSMResponse)
async def update_fsm(
    fsm_id: UUID,
    update_data: FSMUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: UserToken = Depends(get_required_current_user),
):
    """Update an existing FSM."""
    service = FSMService(db)
    try:
        fsm = await service.update_fsm(fsm_id, update_data)
        return fsm
    except FSMNotFoundException as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{fsm_id}/fork", response_model=FSMResponse, status_code=201)
async def fork_fsm(
    fsm_id: UUID,
    fork_data: FSMFork,
    db: AsyncSession = Depends(get_db),
    current_user: UserToken = Depends(get_required_current_user),
):
    """Fork an existing FSM into a new copy with a different name."""
    service = FSMService(db)
    try:
        forked = await service.fork_fsm(fsm_id, fork_data.name)
        return forked
    except FSMNotFoundException as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("")
async def list_fsms(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    fsm_type: Optional[str] = Query(None),
    visibility: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    sort_by: Optional[str] = Query("created_at"),
    sort_order: Optional[str] = Query("desc"),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[UserToken] = Depends(get_optional_current_user),
):
    """
    List FSMs with pagination.

    Returns a pre-wrapped response to avoid GZip/response_wrapper ordering issues
    for large result sets.
    """
    service = FSMService(db)
    skip = (page - 1) * page_size
    fsms, total = await service.list_fsms(
        skip=skip,
        limit=page_size,
        visibility=visibility,
        fsm_type=fsm_type,
        search=search,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    return JSONResponse(content=jsonable_encoder({
        "success": True,
        "data": [FSMResponse.model_validate(f) for f in fsms],
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total": total,
            "pages": max(1, math.ceil(total / page_size)),
        },
    }))


@router.delete("/{fsm_id}", status_code=204)
async def delete_fsm(
    fsm_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: UserToken = Depends(get_required_current_user),
):
    """Delete FSM by ID."""
    service = FSMService(db)
    try:
        await service.delete_fsm(fsm_id)
    except FSMNotFoundException as e:
        raise HTTPException(status_code=404, detail=str(e))
