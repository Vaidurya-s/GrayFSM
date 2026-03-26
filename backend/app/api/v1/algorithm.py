"""
Algorithm optimization endpoints
"""
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.fsm import OptimizationRequest, OptimizationResponse

router = APIRouter()


@router.post("/{fsm_id}/optimize", response_model=OptimizationResponse)
async def optimize_fsm(
    fsm_id: UUID,
    request: OptimizationRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Optimize FSM using specified algorithm.
    
    TODO: Implement optimization service
    """
    raise HTTPException(status_code=501, detail="Optimization not yet implemented")
