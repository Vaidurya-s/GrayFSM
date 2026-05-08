"""
SQLAlchemy ORM Model for User entity
"""

import uuid

from sqlalchemy import Boolean, Column, DateTime, Index, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.db.base import Base


class User(Base):
    """User model for authentication"""

    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    failed_login_count = Column(Integer, default=0, nullable=False)
    locked_until = Column(DateTime(timezone=False), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Indexes
    __table_args__ = (
        Index("idx_users_email", "email"),
        Index("idx_users_is_active", "is_active"),
    )
