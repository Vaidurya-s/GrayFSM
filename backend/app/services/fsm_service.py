"""
FSM Service - Business logic for FSM operations
"""
import math
from typing import List, Optional, Tuple
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.models.fsm import FSM
from app.schemas.fsm import FSMCreate, FSMUpdate
from app.core.fsm_model import FSMValidator, FSMType
from app.utils.exceptions import FSMNotFoundException, FSMValidationException
from app.utils.logger import get_logger

logger = get_logger(__name__)


class FSMService:
    """Service for FSM CRUD operations"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def create_fsm(self, fsm_data: FSMCreate) -> FSM:
        """
        Create new FSM with validation.
        
        Args:
            fsm_data: FSM creation data
            
        Returns:
            Created FSM instance
            
        Raises:
            FSMValidationException: If validation fails
        """
        # Validate FSM structure
        FSMValidator.validate_fsm_structure(
            fsm_type=FSMType(fsm_data.fsm_type),
            states=fsm_data.states,
            initial_state=fsm_data.initial_state,
            transitions=fsm_data.transitions,
            outputs=fsm_data.outputs
        )
        
        # Calculate bit width
        bit_width = math.ceil(math.log2(len(fsm_data.states)))
        
        # Create FSM instance
        fsm = FSM(
            name=fsm_data.name,
            description=fsm_data.description,
            fsm_type=fsm_data.fsm_type,
            definition={
                "states": fsm_data.states,
                "initial_state": fsm_data.initial_state,
                "transitions": fsm_data.transitions,
                "outputs": fsm_data.outputs or {}
            },
            state_count=len(fsm_data.states),
            transition_count=len(fsm_data.transitions),
            initial_state=fsm_data.initial_state,
            bit_width=bit_width,
            category_id=fsm_data.category_id,
            tags=fsm_data.tags,
            visibility=fsm_data.visibility
        )
        
        self.db.add(fsm)
        await self.db.commit()
        await self.db.refresh(fsm)
        
        logger.info(f"Created FSM: {fsm.id}", extra={"fsm_id": str(fsm.id)})
        
        return fsm
    
    async def get_fsm(self, fsm_id: UUID) -> FSM:
        """
        Get FSM by ID.
        
        Args:
            fsm_id: FSM UUID
            
        Returns:
            FSM instance
            
        Raises:
            FSMNotFoundException: If FSM not found
        """
        result = await self.db.execute(
            select(FSM).where(FSM.id == fsm_id)
        )
        fsm = result.scalar_one_or_none()
        
        if not fsm:
            raise FSMNotFoundException(str(fsm_id))
        
        # Increment view count
        fsm.view_count += 1
        await self.db.commit()
        await self.db.refresh(fsm)

        return fsm
    
    async def list_fsms(
        self,
        skip: int = 0,
        limit: int = 20,
        visibility: Optional[str] = None,
        fsm_type: Optional[str] = None,
        search: Optional[str] = None,
        sort_by: str = "created_at",
        sort_order: str = "desc",
    ) -> Tuple[List[FSM], int]:
        """
        List FSMs with filtering, pagination, and total count.

        Returns:
            Tuple of (list of FSM instances, total count)
        """
        query = select(FSM)
        count_query = select(func.count()).select_from(FSM)

        if visibility:
            query = query.where(FSM.visibility == visibility)
            count_query = count_query.where(FSM.visibility == visibility)
        if fsm_type:
            query = query.where(FSM.fsm_type == fsm_type)
            count_query = count_query.where(FSM.fsm_type == fsm_type)
        if search:
            like = f"%{search}%"
            query = query.where(FSM.name.ilike(like))
            count_query = count_query.where(FSM.name.ilike(like))

        # Sorting
        sort_col = getattr(FSM, sort_by, FSM.created_at)
        if sort_order == "asc":
            query = query.order_by(sort_col.asc())
        else:
            query = query.order_by(sort_col.desc())

        query = query.offset(skip).limit(limit)

        result = await self.db.execute(query)
        count_result = await self.db.execute(count_query)
        total = count_result.scalar_one()
        return list(result.scalars().all()), total

    async def update_fsm(self, fsm_id: UUID, update_data: FSMUpdate) -> FSM:
        """
        Update an existing FSM's metadata.

        Raises:
            FSMNotFoundException: If the FSM does not exist
        """
        fsm = await self.get_fsm_raw(fsm_id)

        if update_data.name is not None:
            fsm.name = update_data.name
        if update_data.description is not None:
            fsm.description = update_data.description
        if update_data.tags is not None:
            fsm.tags = update_data.tags
        if update_data.visibility is not None:
            fsm.visibility = update_data.visibility

        await self.db.commit()
        await self.db.refresh(fsm)
        return fsm

    async def fork_fsm(self, fsm_id: UUID, new_name: str) -> FSM:
        """
        Fork an existing FSM into a new copy.

        Raises:
            FSMNotFoundException: If the source FSM does not exist
        """
        original = await self.get_fsm_raw(fsm_id)

        forked = FSM(
            name=new_name,
            description=original.description,
            fsm_type=original.fsm_type,
            definition=dict(original.definition) if original.definition else {},
            state_count=original.state_count,
            transition_count=original.transition_count,
            initial_state=original.initial_state,
            bit_width=original.bit_width,
            category_id=original.category_id,
            tags=list(original.tags) if original.tags else [],
            visibility=original.visibility,
        )

        self.db.add(forked)
        await self.db.commit()
        await self.db.refresh(forked)
        return forked

    async def get_fsm_raw(self, fsm_id: UUID) -> FSM:
        """Get FSM by ID without incrementing view count."""
        result = await self.db.execute(select(FSM).where(FSM.id == fsm_id))
        fsm = result.scalar_one_or_none()
        if not fsm:
            raise FSMNotFoundException(str(fsm_id))
        return fsm
    
    async def delete_fsm(self, fsm_id: UUID) -> None:
        """Delete FSM by ID"""
        fsm = await self.get_fsm(fsm_id)
        await self.db.delete(fsm)
        await self.db.commit()
        logger.info(f"Deleted FSM: {fsm_id}")
