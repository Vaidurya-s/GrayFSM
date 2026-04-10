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
    created_by = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=True)
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

    @property
    def states(self):
        """Convenience accessor for state list stored in definition JSONB."""
        if self.definition and isinstance(self.definition, dict):
            return self.definition.get("states", [])
        return []
    algorithm_results = relationship(
        "AlgorithmResult",
        back_populates="original_fsm",
        foreign_keys="[AlgorithmResult.original_fsm_id]"
    )
    
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
