"""
FSM CRUD API endpoints
"""
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.fsm import FSMCreate, FSMResponse
from app.services.fsm_service import FSMService
from app.utils.exceptions import FSMNotFoundException, FSMValidationException

router = APIRouter()


@router.post("", response_model=FSMResponse, status_code=201)
async def create_fsm(
    fsm_data: FSMCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new FSM.
    
    Args:
        fsm_data: FSM creation data
        
    Returns:
        Created FSM
        
    Raises:
        HTTPException: If validation fails
    """
    service = FSMService(db)
    
    try:
        fsm = await service.create_fsm(fsm_data)
        return fsm
    except FSMValidationException as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.get("/{fsm_id}", response_model=FSMResponse)
async def get_fsm(
    fsm_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Get FSM by ID.
    
    Args:
        fsm_id: FSM UUID
        
    Returns:
        FSM details
        
    Raises:
        HTTPException: If FSM not found
    """
    service = FSMService(db)
    
    try:
        fsm = await service.get_fsm(fsm_id)
        return fsm
    except FSMNotFoundException as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("", response_model=List[FSMResponse])
async def list_fsms(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    visibility: str = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """
    List FSMs with pagination.
    
    Args:
        skip: Number of records to skip
        limit: Maximum records to return
        visibility: Filter by visibility
        
    Returns:
        List of FSMs
    """
    service = FSMService(db)
    fsms = await service.list_fsms(skip=skip, limit=limit, visibility=visibility)
    return fsms


@router.delete("/{fsm_id}", status_code=204)
async def delete_fsm(
    fsm_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Delete FSM by ID"""
    service = FSMService(db)
    
    try:
        await service.delete_fsm(fsm_id)
    except FSMNotFoundException as e:
        raise HTTPException(status_code=404, detail=str(e))
