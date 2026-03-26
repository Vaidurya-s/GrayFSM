"""
FSM Service - Business logic for FSM operations
"""
from typing import List, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.fsm import FSM
from app.schemas.fsm import FSMCreate
from app.core.fsm_model import FSMValidator, FSMType
from app.utils.exceptions import FSMNotFoundException, FSMValidationException
from app.utils.logger import get_logger
import math

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
        
        return fsm
    
    async def list_fsms(
        self,
        skip: int = 0,
        limit: int = 20,
        visibility: Optional[str] = None
    ) -> List[FSM]:
        """
        List FSMs with filtering and pagination.
        
        Args:
            skip: Number of records to skip
            limit: Maximum number of records to return
            visibility: Filter by visibility
            
        Returns:
            List of FSM instances
        """
        query = select(FSM)
        
        if visibility:
            query = query.where(FSM.visibility == visibility)
        
        query = query.offset(skip).limit(limit).order_by(FSM.created_at.desc())
        
        result = await self.db.execute(query)
        return list(result.scalars().all())
    
    async def delete_fsm(self, fsm_id: UUID) -> None:
        """Delete FSM by ID"""
        fsm = await self.get_fsm(fsm_id)
        await self.db.delete(fsm)
        await self.db.commit()
        logger.info(f"Deleted FSM: {fsm_id}")
