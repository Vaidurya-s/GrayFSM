"""
Category endpoints
"""
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.services.category_service import CategoryService
from app.utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter()


@router.get("")
async def list_categories(
    parent_id: Optional[UUID] = Query(None, description="Filter by parent category ID"),
    db: AsyncSession = Depends(get_db),
):
    """
    List all categories.

    Optionally filter by parent category to get subcategories.

    Args:
        parent_id: Optional parent category UUID to filter children
        db: Database session

    Returns:
        List of category objects
    """
    service = CategoryService(db)
    categories = await service.list_categories(parent_id=parent_id)

    return [
        {
            "id": str(cat.id),
            "name": cat.name,
            "slug": cat.slug,
            "description": cat.description,
            "parent_category_id": str(cat.parent_category_id) if cat.parent_category_id else None,
            "level": cat.level,
            "display_order": cat.display_order,
            "fsm_count": cat.fsm_count,
        }
        for cat in categories
    ]


@router.get("/{category_id}")
async def get_category(
    category_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """
    Get a single category by ID.

    Args:
        category_id: UUID of the category

    Returns:
        Category object

    Raises:
        404: Category not found
    """
    service = CategoryService(db)
    category = await service.get_category(category_id)

    if not category:
        raise HTTPException(status_code=404, detail=f"Category '{category_id}' not found")

    return {
        "id": str(category.id),
        "name": category.name,
        "slug": category.slug,
        "description": category.description,
        "parent_category_id": str(category.parent_category_id) if category.parent_category_id else None,
        "level": category.level,
        "display_order": category.display_order,
        "fsm_count": category.fsm_count,
    }
