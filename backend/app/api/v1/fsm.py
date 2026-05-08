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
from app.utils.exceptions import FSMNotFoundException, FSMPermissionException, FSMValidationException

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
        user_id = UUID(current_user["user_id"]) if current_user else None
        fsm = await service.create_fsm(fsm_data, user_id=user_id)
        return fsm
    except FSMValidationException as e:
        # Validation messages describe the user's own input; safe to return.
        raise HTTPException(status_code=422, detail=str(e)) from None


@router.get("/{fsm_id}", response_model=FSMResponse)
async def get_fsm(
    fsm_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[UserToken] = Depends(get_optional_current_user),
):
    """Get FSM by ID. Public FSMs are visible to anyone; private only to owner."""
    service = FSMService(db)
    try:
        user_id = UUID(current_user["user_id"]) if current_user else None
        fsm = await service.get_fsm(fsm_id, user_id=user_id)
        return fsm
    except FSMNotFoundException:
        raise HTTPException(status_code=404, detail="FSM not found") from None


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
        user_id = UUID(current_user["user_id"]) if current_user else None
        fsm = await service.update_fsm(fsm_id, update_data, user_id=user_id)
        return fsm
    except (FSMNotFoundException, FSMPermissionException):
        # Collapse not-found and forbidden into 404 to prevent enumeration.
        raise HTTPException(status_code=404, detail="FSM not found") from None


@router.post("/{fsm_id}/fork", response_model=FSMResponse, status_code=201)
async def fork_fsm(
    fsm_id: UUID,
    fork_data: FSMFork,
    db: AsyncSession = Depends(get_db),
    current_user: UserToken = Depends(get_required_current_user),
):
    """Fork an existing FSM into a new copy. Public FSMs may be forked by anyone;
    private FSMs only by their owner. The fork is owned by the caller."""
    service = FSMService(db)
    try:
        user_id = UUID(current_user["user_id"])
        forked = await service.fork_fsm(fsm_id, fork_data.name, user_id=user_id)
        return forked
    except FSMNotFoundException:
        raise HTTPException(status_code=404, detail="FSM not found") from None


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
        user_id = UUID(current_user["user_id"]) if current_user else None
        await service.delete_fsm(fsm_id, user_id=user_id)
    except (FSMNotFoundException, FSMPermissionException):
        raise HTTPException(status_code=404, detail="FSM not found") from None
