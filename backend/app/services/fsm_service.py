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
from app.utils.exceptions import FSMNotFoundException, FSMPermissionException, FSMValidationException
from app.utils.logger import get_logger

logger = get_logger(__name__)


class FSMService:
    """Service for FSM CRUD operations"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def create_fsm(self, fsm_data: FSMCreate, user_id: Optional[UUID] = None) -> FSM:
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
            visibility=fsm_data.visibility,
            created_by=user_id,
        )
        
        self.db.add(fsm)
        await self.db.commit()
        await self.db.refresh(fsm)
        
        logger.info(f"Created FSM: {fsm.id}", extra={"fsm_id": str(fsm.id)})
        
        return fsm
    
    async def get_fsm(self, fsm_id: UUID, user_id: Optional[UUID] = None) -> FSM:
        """
        Get FSM by ID with visibility-aware access control.

        Public FSMs are readable by anyone (including anonymous users).
        Private FSMs are readable only by their owner. Legacy FSMs with no
        owner (created_by=None) are always readable.

        Raises:
            FSMNotFoundException: If FSM not found, OR if a private FSM is
                requested by a non-owner. The two cases are deliberately
                indistinguishable to prevent enumeration of private IDs.
        """
        result = await self.db.execute(
            select(FSM).where(FSM.id == fsm_id)
        )
        fsm = result.scalar_one_or_none()

        if not fsm:
            raise FSMNotFoundException(str(fsm_id))

        if fsm.visibility != "public" and fsm.created_by is not None:
            if user_id is None or fsm.created_by != user_id:
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

    def _check_ownership(self, fsm: FSM, user_id: Optional[UUID]) -> None:
        """Raise FSMPermissionException if user_id doesn't own the FSM.

        FSMs with no owner (created_by=None) are legacy records and are
        always allowed through so existing data isn't locked out.
        """
        if fsm.created_by is None:
            return
        if user_id is None or fsm.created_by != user_id:
            raise FSMPermissionException(str(fsm.id))

    async def update_fsm(
        self, fsm_id: UUID, update_data: FSMUpdate, user_id: Optional[UUID] = None
    ) -> FSM:
        """
        Update an existing FSM's metadata.

        Raises:
            FSMNotFoundException: If the FSM does not exist
            FSMPermissionException: If the user does not own the FSM
        """
        fsm = await self.get_fsm_raw(fsm_id)
        self._check_ownership(fsm, user_id)

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

    async def fork_fsm(
        self, fsm_id: UUID, new_name: str, user_id: Optional[UUID] = None
    ) -> FSM:
        """
        Fork an existing FSM into a new copy.

        Forking is allowed for public FSMs (anyone may copy) and for private
        FSMs only by their owner. The fork is owned by the caller.

        Raises:
            FSMNotFoundException: If the source FSM does not exist or the
                caller cannot see it (private + non-owner).
        """
        original = await self.get_fsm_raw(fsm_id)

        if original.visibility != "public" and original.created_by is not None:
            if user_id is None or original.created_by != user_id:
                raise FSMNotFoundException(str(fsm_id))

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
            created_by=user_id,
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
    
    async def delete_fsm(self, fsm_id: UUID, user_id: Optional[UUID] = None) -> None:
        """Delete FSM by ID.

        Raises:
            FSMNotFoundException: If FSM not found
            FSMPermissionException: If the user does not own the FSM
        """
        fsm = await self.get_fsm_raw(fsm_id)
        self._check_ownership(fsm, user_id)
        await self.db.delete(fsm)
        await self.db.commit()
        logger.info(f"Deleted FSM: {fsm_id}")
