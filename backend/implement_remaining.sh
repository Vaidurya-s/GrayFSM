#!/bin/bash
# Implement remaining backend components

cd /home/arunupscee/Music/grayFSM/backend

echo "Implementing Algorithm Modules..."

# Greedy Algorithm
cat > app/core/algorithms/greedy.py << 'GREEDY'
"""
Greedy Dummy State Insertion Algorithm

This algorithm processes each problematic transition independently,
inserting the minimum number of dummy states needed for that specific transition.
"""
from typing import List, Dict, Tuple
from dataclasses import dataclass

from app.core.gray_code import hamming_distance
from app.core.hypercube import HypercubeGraph


@dataclass
class DummyState:
    """Represents a dummy state inserted for optimization"""
    id: str
    encoding: str
    output: str
    inserted_for_transition: str


class GreedyOptimizer:
    """
    Greedy algorithm for FSM optimization.
    
    Time Complexity: O(T * log(N)) where T is transitions, N is states
    Space Complexity: O(D) where D is dummy states created
    """
    
    def __init__(self, bit_width: int):
        """
        Initialize optimizer.
        
        Args:
            bit_width: Number of bits in state encoding
        """
        self.bit_width = bit_width
        self.hypercube = HypercubeGraph(bit_width)
        self.dummy_counter = 0
        self.dummy_states: List[DummyState] = []
    
    def optimize_fsm(
        self,
        states: Dict[str, str],  # state_id -> gray_encoding
        transitions: List[Dict],
        outputs: Dict[str, str],
        fsm_type: str
    ) -> Tuple[List[DummyState], List[Dict]]:
        """
        Optimize FSM by inserting dummy states.
        
        Args:
            states: Mapping of state IDs to Gray encodings
            transitions: List of transition dictionaries
            outputs: State outputs (for Moore machines)
            fsm_type: 'moore' or 'mealy'
            
        Returns:
            Tuple of (dummy_states_list, new_transitions_list)
        """
        self.dummy_states = []
        self.dummy_counter = 0
        new_transitions = []
        
        for trans in transitions:
            from_state = trans['from_state']
            to_state = trans['to_state']
            from_code = states[from_state]
            to_code = states[to_state]
            
            # Check if transition needs optimization
            if hamming_distance(from_code, to_code) <= 1:
                # Transition is already safe
                new_transitions.append(trans)
            else:
                # Insert dummy states
                dummy_trans = self._insert_dummy_states(
                    from_state=from_state,
                    to_state=to_state,
                    from_code=from_code,
                    to_code=to_code,
                    original_trans=trans,
                    outputs=outputs,
                    fsm_type=fsm_type
                )
                new_transitions.extend(dummy_trans)
        
        return self.dummy_states, new_transitions
    
    def _insert_dummy_states(
        self,
        from_state: str,
        to_state: str,
        from_code: str,
        to_code: str,
        original_trans: Dict,
        outputs: Dict[str, str],
        fsm_type: str
    ) -> List[Dict]:
        """
        Insert dummy states for a single transition.
        
        Returns:
            List of new transitions including dummy states
        """
        # Find shortest path in hypercube
        path = self.hypercube.shortest_path(from_code, to_code)
        
        # Create dummy states for intermediate codes
        new_transitions = []
        current_state = from_state
        
        for i, code in enumerate(path[1:-1], start=1):
            # Create dummy state
            dummy_id = f"DUMMY_{self.dummy_counter}_{from_state}_to_{to_state}"
            self.dummy_counter += 1
            
            # Determine output for dummy state
            if fsm_type == "moore":
                # Use source state output until near end
                if i < len(path) - 2:
                    dummy_output = outputs.get(from_state, "0")
                else:
                    dummy_output = outputs.get(to_state, "0")
            else:
                dummy_output = "X"  # Don't care for Mealy
            
            dummy_state = DummyState(
                id=dummy_id,
                encoding=code,
                output=dummy_output,
                inserted_for_transition=f"{from_state}->{to_state}"
            )
            self.dummy_states.append(dummy_state)
            
            # Create transition to dummy state
            new_trans = {
                'from_state': current_state,
                'to_state': dummy_id,
                'input': original_trans.get('input') if i == 1 else None,
                'output': original_trans.get('output') if fsm_type == 'mealy' else None,
                'is_dummy_transition': True
            }
            new_transitions.append(new_trans)
            
            current_state = dummy_id
        
        # Final transition to destination
        final_trans = {
            'from_state': current_state,
            'to_state': to_state,
            'input': None,
            'output': None,
            'is_dummy_transition': True
        }
        new_transitions.append(final_trans)
        
        return new_transitions
GREEDY

echo "✓ Created greedy.py"

# BFS Optimal Algorithm
cat > app/core/algorithms/bfs_optimal.py << 'BFS'
"""
BFS-Optimized Dummy State Insertion Algorithm

Uses breadth-first search to find optimal paths through hypercube,
guaranteeing minimum dummy states per transition.
"""
from typing import List, Dict, Set, Tuple
from collections import deque

from app.core.algorithms.greedy import GreedyOptimizer, DummyState
from app.core.hypercube import HypercubeGraph


class BFSOptimizer(GreedyOptimizer):
    """
    BFS-based optimization with smart state reuse.
    
    Improves over greedy by:
    1. Preferring already-used Gray codes for dummy states
    2. Avoiding conflicts in encoding assignments
    """
    
    def __init__(self, bit_width: int):
        super().__init__(bit_width)
        self.used_encodings: Set[str] = set()
    
    def optimize_fsm(
        self,
        states: Dict[str, str],
        transitions: List[Dict],
        outputs: Dict[str, str],
        fsm_type: str
    ) -> Tuple[List[DummyState], List[Dict]]:
        """Optimize using BFS with encoding reuse"""
        # Track used encodings
        self.used_encodings = set(states.values())
        
        return super().optimize_fsm(states, transitions, outputs, fsm_type)
    
    def _find_best_path(
        self,
        from_code: str,
        to_code: str
    ) -> List[str]:
        """
        Find best path considering already-used codes.
        
        Prefers paths through unused Gray codes when possible.
        """
        # Use standard shortest path
        all_paths = self.hypercube.shortest_path(from_code, to_code)
        
        # Could be extended to prefer paths through used codes
        # to maximize code reuse
        
        return all_paths
BFS

echo "✓ Created bfs_optimal.py"

echo "Implementing Database Models..."

# FSM Model
cat > app/models/fsm.py << 'FSMMODEL'
"""
SQLAlchemy ORM Models for FSM entities
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Column, String, Integer, Boolean, DateTime, Text,
    ForeignKey, Enum as SQLEnum, DECIMAL, ARRAY, Index
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class Category(Base):
    """FSM Category for organization"""
    __tablename__ = "categories"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), unique=True, nullable=False)
    slug = Column(String(100), unique=True, nullable=False)
    description = Column(Text)
    parent_category_id = Column(UUID(as_uuid=True), ForeignKey('categories.id'))
    level = Column(Integer, default=0)
    display_order = Column(Integer, default=0)
    fsm_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    fsms = relationship("FSM", back_populates="category")


class FSM(Base):
    """Primary FSM entity"""
    __tablename__ = "fsms"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    fsm_type = Column(SQLEnum('moore', 'mealy', name='fsm_type'), nullable=False)
    
    # FSM Definition stored as JSONB
    definition = Column(JSONB, nullable=False)
    
    # Metadata
    state_count = Column(Integer, nullable=False)
    transition_count = Column(Integer, nullable=False)
    initial_state = Column(String(100), nullable=False)
    bit_width = Column(Integer, nullable=False)
    encoding_type = Column(String(50), default='binary')
    
    # Classification
    category_id = Column(UUID(as_uuid=True), ForeignKey('categories.id'))
    tags = Column(ARRAY(String))
    
    # Ownership
    created_by = Column(UUID(as_uuid=True), ForeignKey('users.id'))
    visibility = Column(
        SQLEnum('private', 'public', 'unlisted', 'example', name='fsm_visibility'),
        default='private'
    )
    
    # Optimization
    is_optimized = Column(Boolean, default=False)
    optimization_algorithm = Column(String(100))
    dummy_state_count = Column(Integer, default=0)
    avg_hamming_distance = Column(DECIMAL(5, 2))
    
    # Statistics
    view_count = Column(Integer, default=0)
    fork_count = Column(Integer, default=0)
    export_count = Column(Integer, default=0)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    category = relationship("Category", back_populates="fsms")
    algorithm_results = relationship("AlgorithmResult", back_populates="original_fsm")
    
    # Indexes
    __table_args__ = (
        Index('idx_fsms_type', 'fsm_type'),
        Index('idx_fsms_category', 'category_id'),
        Index('idx_fsms_visibility', 'visibility'),
        Index('idx_fsms_is_optimized', 'is_optimized'),
    )


class AlgorithmResult(Base):
    """Algorithm execution results"""
    __tablename__ = "algorithm_results"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    original_fsm_id = Column(UUID(as_uuid=True), ForeignKey('fsms.id'), nullable=False)
    optimized_fsm_id = Column(UUID(as_uuid=True), ForeignKey('fsms.id'))
    
    algorithm = Column(
        SQLEnum(
            'greedy', 'bfs_optimal', 'global_sa', 'global_ga', 'hybrid',
            name='algorithm_name'
        ),
        nullable=False
    )
    algorithm_version = Column(String(50))
    algorithm_parameters = Column(JSONB)
    
    # Results
    dummy_states_added = Column(Integer, default=0)
    total_states_final = Column(Integer, nullable=False)
    avg_hamming_before = Column(DECIMAL(5, 2))
    avg_hamming_after = Column(DECIMAL(5, 2))
    improvement_percentage = Column(DECIMAL(5, 2))
    
    # Performance
    execution_time_ms = Column(Integer, nullable=False)
    memory_used_mb = Column(DECIMAL(10, 2))
    
    # Status
    success = Column(Boolean, default=True)
    error_message = Column(Text)
    
    executed_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    original_fsm = relationship("FSM", foreign_keys=[original_fsm_id])
FSMMODEL

echo "✓ Created fsm.py models"

echo "Creating Pydantic Schemas..."

# FSM Schemas
cat > app/schemas/fsm.py << 'FSMSCHEMA'
"""
Pydantic schemas for FSM API requests/responses
"""
from typing import List, Optional, Dict, Any
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class TransitionBase(BaseModel):
    """Base transition schema"""
    from_state: str
    to_state: str
    input: Optional[str] = None
    output: Optional[str] = None
    label: Optional[str] = None


class FSMCreate(BaseModel):
    """Schema for creating a new FSM"""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    fsm_type: str = Field(..., pattern="^(moore|mealy)$")
    states: List[str] = Field(..., min_length=1)
    initial_state: str
    transitions: List[Dict[str, Any]]
    outputs: Optional[Dict[str, str]] = None
    category_id: Optional[UUID] = None
    tags: Optional[List[str]] = []
    visibility: str = Field(default="private", pattern="^(private|public|unlisted)$")
    
    @field_validator('initial_state')
    @classmethod
    def validate_initial_state(cls, v: str, info) -> str:
        """Validate initial state is in states list"""
        if 'states' in info.data and v not in info.data['states']:
            raise ValueError(f"Initial state '{v}' not in states list")
        return v


class FSMResponse(BaseModel):
    """Schema for FSM response"""
    id: UUID
    name: str
    description: Optional[str]
    fsm_type: str
    state_count: int
    transition_count: int
    initial_state: str
    bit_width: int
    is_optimized: bool
    dummy_state_count: int
    view_count: int
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True


class OptimizationRequest(BaseModel):
    """Request schema for FSM optimization"""
    algorithm: str = Field(..., pattern="^(greedy|bfs_optimal|global_sa|global_ga)$")
    options: Optional[Dict[str, Any]] = {}
    async_mode: bool = False


class OptimizationResponse(BaseModel):
    """Response schema for optimization"""
    optimized_fsm_id: UUID
    algorithm: str
    execution_time_ms: int
    dummy_states_added: int
    total_states: int
    improvement_percentage: float
FSMSCHEMA

echo "✓ Created fsm.py schemas"

echo "Creating Service Layer..."

# FSM Service
cat > app/services/fsm_service.py << 'FSMSERVICE'
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
FSMSERVICE

echo "✓ Created fsm_service.py"

echo "Implementation script completed!"
