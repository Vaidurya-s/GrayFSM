"""
Category Service - Business logic for FSM category operations
"""

from typing import List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.fsm import Category
from app.utils.logger import get_logger

logger = get_logger(__name__)


class CategoryService:
    """Service for category query operations"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_categories(
        self,
        parent_id: Optional[UUID] = None,
    ) -> List[Category]:
        """
        List all categories, optionally filtered by parent.

        Args:
            parent_id: If provided, only return children of this category

        Returns:
            List of Category instances ordered by display_order
        """
        query = select(Category)

        if parent_id is not None:
            query = query.where(Category.parent_category_id == parent_id)

        query = query.order_by(Category.display_order, Category.name)

        result = await self.db.execute(query)
        categories = list(result.scalars().all())

        logger.info(
            "Listed categories",
            count=len(categories),
            parent_id=str(parent_id) if parent_id else None,
        )

        return categories

    async def get_category(self, category_id: UUID) -> Optional[Category]:
        """
        Get a single category by ID.

        Args:
            category_id: UUID of the category

        Returns:
            Category instance or None if not found
        """
        result = await self.db.execute(select(Category).where(Category.id == category_id))
        return result.scalar_one_or_none()

    async def get_category_by_slug(self, slug: str) -> Optional[Category]:
        """
        Get a single category by its slug.

        Args:
            slug: URL-friendly category identifier

        Returns:
            Category instance or None if not found
        """
        result = await self.db.execute(select(Category).where(Category.slug == slug))
        return result.scalar_one_or_none()
