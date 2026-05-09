"""
SQLAlchemy ORM Models for FSM entities
"""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    ARRAY,
    DECIMAL,
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db.base import Base


class Category(Base):
    """FSM Category for organization"""

    __tablename__ = "categories"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    parent_category_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("categories.id")
    )
    level: Mapped[int | None] = mapped_column(Integer, default=0)
    display_order: Mapped[int | None] = mapped_column(Integer, default=0)
    fsm_count: Mapped[int | None] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), onupdate=func.now()
    )

    fsms: Mapped[list["FSM"]] = relationship("FSM", back_populates="category")


class FSM(Base):
    """Primary FSM entity"""

    __tablename__ = "fsms"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    fsm_type: Mapped[str] = mapped_column(
        SQLEnum("moore", "mealy", name="fsm_type"), nullable=False
    )

    # FSM Definition stored as JSONB
    definition: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)

    # Metadata
    state_count: Mapped[int] = mapped_column(Integer, nullable=False)
    transition_count: Mapped[int] = mapped_column(Integer, nullable=False)
    initial_state: Mapped[str] = mapped_column(String(100), nullable=False)
    bit_width: Mapped[int] = mapped_column(Integer, nullable=False)
    encoding_type: Mapped[str | None] = mapped_column(String(50), default="binary")

    # Classification
    category_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("categories.id")
    )
    tags: Mapped[list[str] | None] = mapped_column(ARRAY(String))

    # Ownership
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    visibility: Mapped[str | None] = mapped_column(
        SQLEnum("private", "public", "unlisted", "example", name="fsm_visibility"),
        default="private",
    )

    # Optimization
    is_optimized: Mapped[bool | None] = mapped_column(Boolean, default=False)
    optimization_algorithm: Mapped[str | None] = mapped_column(String(100))
    dummy_state_count: Mapped[int | None] = mapped_column(Integer, default=0)
    avg_hamming_distance: Mapped[Decimal | None] = mapped_column(DECIMAL(5, 2))

    # Statistics
    view_count: Mapped[int | None] = mapped_column(Integer, default=0)
    fork_count: Mapped[int | None] = mapped_column(Integer, default=0)
    export_count: Mapped[int | None] = mapped_column(Integer, default=0)

    # Timestamps
    created_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), onupdate=func.now()
    )

    # Relationships
    category: Mapped["Category | None"] = relationship("Category", back_populates="fsms")
    algorithm_results: Mapped[list["AlgorithmResult"]] = relationship(
        "AlgorithmResult",
        back_populates="original_fsm",
        foreign_keys="[AlgorithmResult.original_fsm_id]",
    )

    @property
    def states(self) -> list[Any]:
        """Convenience accessor for state list stored in definition JSONB."""
        if self.definition and isinstance(self.definition, dict):
            states_raw: list[Any] = self.definition.get("states", [])
            return states_raw
        return []

    __table_args__ = (
        Index("idx_fsms_type", "fsm_type"),
        Index("idx_fsms_category", "category_id"),
        Index("idx_fsms_visibility", "visibility"),
        Index("idx_fsms_is_optimized", "is_optimized"),
    )


class AlgorithmResult(Base):
    """Algorithm execution results"""

    __tablename__ = "algorithm_results"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    original_fsm_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("fsms.id"), nullable=False
    )
    optimized_fsm_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("fsms.id")
    )

    algorithm: Mapped[str] = mapped_column(
        SQLEnum("greedy", "bfs_optimal", "global_sa", "global_ga", "hybrid", name="algorithm_name"),
        nullable=False,
    )
    algorithm_version: Mapped[str | None] = mapped_column(String(50))
    algorithm_parameters: Mapped[dict[str, Any] | None] = mapped_column(JSONB)

    # Results
    dummy_states_added: Mapped[int | None] = mapped_column(Integer, default=0)
    total_states_final: Mapped[int] = mapped_column(Integer, nullable=False)
    avg_hamming_before: Mapped[Decimal | None] = mapped_column(DECIMAL(5, 2))
    avg_hamming_after: Mapped[Decimal | None] = mapped_column(DECIMAL(5, 2))
    improvement_percentage: Mapped[Decimal | None] = mapped_column(DECIMAL(5, 2))

    # Performance
    execution_time_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    memory_used_mb: Mapped[Decimal | None] = mapped_column(DECIMAL(10, 2))

    # Status
    success: Mapped[bool | None] = mapped_column(Boolean, default=True)
    error_message: Mapped[str | None] = mapped_column(Text)

    executed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    original_fsm: Mapped["FSM"] = relationship("FSM", foreign_keys=[original_fsm_id])
