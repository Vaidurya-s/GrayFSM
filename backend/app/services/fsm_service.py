"""
FSM Service - Business logic for FSM operations
"""

import math
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.fsm_model import FSMType, FSMValidator
from app.models.fsm import FSM
from app.schemas.fsm import FSMCreate, FSMUpdate
from app.utils.exceptions import (
    FSMNotFoundException,
    FSMPermissionException,
)
from app.utils.logger import get_logger

logger = get_logger(__name__)

# Allowlist for caller-supplied sort_by values. Using getattr(FSM, sort_by)
# without a guard lets callers probe any column by name (e.g. hashed_password)
# via ordering side-channels. Only columns that are safe to expose are listed.
_SORTABLE_FIELDS: frozenset[str] = frozenset(
    {"created_at", "updated_at", "name", "view_count", "fork_count"}
)


class FSMService:
    """Service for FSM CRUD operations"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_fsm(self, fsm_data: FSMCreate, user_id: UUID | None = None) -> FSM:
        """
        Create new FSM with validation.

        Args:
            fsm_data: FSM creation data

        Returns:
            Created FSM instance

        Raises:
            FSMValidationException: If validation fails
        """
        # Moore machines require an output per state. A freshly-created FSM
        # often has none yet, so default missing outputs to "0" (a valid HDL
        # value) instead of rejecting the create with a 422.
        outputs = dict(fsm_data.outputs or {})
        if FSMType(fsm_data.fsm_type) == FSMType.MOORE:
            for state in fsm_data.states:
                outputs.setdefault(state, "0")

        # Validate FSM structure
        FSMValidator.validate_fsm_structure(
            fsm_type=FSMType(fsm_data.fsm_type),
            states=fsm_data.states,
            initial_state=fsm_data.initial_state,
            transitions=fsm_data.transitions,
            outputs=outputs,
        )

        # Calculate bit width
        bit_width = math.ceil(math.log2(max(len(fsm_data.states), 2)))

        # Create FSM instance
        fsm = FSM(
            name=fsm_data.name,
            description=fsm_data.description,
            fsm_type=fsm_data.fsm_type,
            definition={
                "states": fsm_data.states,
                "initial_state": fsm_data.initial_state,
                "transitions": fsm_data.transitions,
                "outputs": outputs,
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

    async def get_fsm(self, fsm_id: UUID, user_id: UUID | None = None) -> FSM:
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
        result = await self.db.execute(select(FSM).where(FSM.id == fsm_id))
        fsm = result.scalar_one_or_none()

        if not fsm:
            raise FSMNotFoundException(str(fsm_id))

        # Strict-ownership: legacy NULL-created_by FSMs are no longer
        # readable to all callers. Public AND disk-seeded "example" FSMs
        # remain visible to anyone (examples are intentionally ownerless);
        # everything else needs the matching owner.
        if fsm.visibility not in ("public", "example"):
            if fsm.created_by is None or user_id is None or fsm.created_by != user_id:
                raise FSMNotFoundException(str(fsm_id))

        # Increment view count
        fsm.view_count = (fsm.view_count or 0) + 1
        await self.db.commit()
        await self.db.refresh(fsm)

        return fsm

    async def list_fsms(
        self,
        skip: int = 0,
        limit: int = 20,
        visibility: str | None = None,
        fsm_type: str | None = None,
        search: str | None = None,
        sort_by: str = "created_at",
        sort_order: str = "desc",
    ) -> tuple[list[FSM], int]:
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

        # Sorting — only allow columns in the explicit allowlist to prevent
        # callers from probing arbitrary column existence via ordering.
        if sort_by not in _SORTABLE_FIELDS:
            sort_by = "created_at"
        sort_col = getattr(FSM, sort_by)
        if sort_order == "asc":
            query = query.order_by(sort_col.asc())
        else:
            query = query.order_by(sort_col.desc())

        query = query.offset(skip).limit(limit)

        result = await self.db.execute(query)
        count_result = await self.db.execute(count_query)
        total = count_result.scalar_one()
        return list(result.scalars().all()), total

    def _check_ownership(self, fsm: FSM, user_id: UUID | None) -> None:
        """Raise FSMPermissionException unless user_id is the FSM's owner.

        Strict-ownership policy. The previous behaviour treated FSMs with
        ``created_by=None`` as "ownerless" and let any authenticated user
        access them — that was the legacy bypass flagged by the audit.
        It is gone now: a NULL ``created_by`` row is unreachable until an
        admin backfills the column.

        New deployments don't have NULL rows because ``create_fsm`` has
        required a ``user_id`` since the ownership commit (78fb9bb). If
        you have legacy data with ``created_by IS NULL``, run a backfill
        migration (see ``backend/alembic/DRIFT.md`` for the recommended
        approach) before deploying this change.
        """
        if fsm.created_by is None or user_id is None or fsm.created_by != user_id:
            raise FSMPermissionException(str(fsm.id))

    async def update_fsm(
        self, fsm_id: UUID, update_data: FSMUpdate, user_id: UUID | None = None
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

        # Persist definition edits (states/transitions/initial_state/outputs).
        # Reassign a new dict so SQLAlchemy detects the JSON change.
        if any(
            v is not None
            for v in (
                update_data.states,
                update_data.transitions,
                update_data.initial_state,
                update_data.outputs,
            )
        ):
            definition = dict(fsm.definition) if fsm.definition else {}
            if update_data.states is not None:
                definition["states"] = update_data.states
                fsm.state_count = len(update_data.states)
                fsm.bit_width = math.ceil(math.log2(max(len(update_data.states), 2)))
            if update_data.transitions is not None:
                definition["transitions"] = update_data.transitions
                fsm.transition_count = len(update_data.transitions)
            if update_data.initial_state is not None:
                definition["initial_state"] = update_data.initial_state
                fsm.initial_state = update_data.initial_state
            if update_data.outputs is not None:
                definition["outputs"] = update_data.outputs
            fsm.definition = definition

        await self.db.commit()
        await self.db.refresh(fsm)
        return fsm

    async def fork_fsm(self, fsm_id: UUID, new_name: str, user_id: UUID | None = None) -> FSM:
        """
        Fork an existing FSM into a new copy.

        Forking is allowed for public FSMs (anyone may copy) and for private
        FSMs only by their owner. The fork is owned by the caller.

        Raises:
            FSMNotFoundException: If the source FSM does not exist or the
                caller cannot see it (private + non-owner).
        """
        original = await self.get_fsm_raw(fsm_id)

        # Strict-ownership (matches get_fsm above): public AND disk-seeded
        # "example" FSMs may be forked by anyone, otherwise only the owner can.
        if original.visibility not in ("public", "example"):
            if original.created_by is None or user_id is None or original.created_by != user_id:
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

    async def delete_fsm(self, fsm_id: UUID, user_id: UUID | None = None) -> None:
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
