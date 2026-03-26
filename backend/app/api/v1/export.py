"""
Export endpoints for HDL generation
"""
from uuid import UUID
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db

router = APIRouter()


@router.post("/{fsm_id}/export")
async def export_fsm(
    fsm_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Export FSM to HDL.
    
    TODO: Implement export service
    """
    return {"message": "Export not yet implemented"}
