"""
Example FSM endpoints
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db

router = APIRouter()


@router.get("")
async def list_examples(db: AsyncSession = Depends(get_db)):
    """List example FSMs"""
    return {"data": []}  # TODO: Implement
