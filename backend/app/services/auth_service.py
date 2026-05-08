"""
Authentication Service - Business logic for user authentication
"""
from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID

from passlib.context import CryptContext
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.user import User
from app.middleware.auth import create_access_token
from app.utils.exceptions import (
    UserAlreadyExistsException,
    UserNotFoundException,
    InvalidCredentialsException,
)
from app.utils.logger import get_logger

logger = get_logger(__name__)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Pre-computed bcrypt hash used to equalize timing on login attempts for
# non-existent emails. Without this, attackers can distinguish "user exists,
# wrong password" (slow, ~100ms) from "user does not exist" (fast, ~1ms) by
# response time. The hash is of a value that is never a valid password.
_TIMING_DUMMY_HASH = pwd_context.hash("timing-equalization-not-a-real-password")


def hash_password(password: str) -> str:
    """
    Hash a password using bcrypt.

    Args:
        password: Plain text password to hash

    Returns:
        Hashed password string
    """
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a password against a bcrypt hash.

    Args:
        plain_password: Plain text password to verify
        hashed_password: Stored hashed password

    Returns:
        True if password matches, False otherwise
    """
    return pwd_context.verify(plain_password, hashed_password)


class AuthService:
    """Service for user authentication operations"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def register(self, email: str, password: str) -> User:
        """
        Register a new user.

        Args:
            email: User email address
            password: Plain text password

        Returns:
            Created User instance

        Raises:
            UserAlreadyExistsException: If email already exists
        """
        # Check if user already exists
        existing_user = await self._get_user_by_email(email)
        if existing_user:
            logger.warning(f"Registration attempted with existing email: {email}")
            raise UserAlreadyExistsException(f"User with email {email} already exists")

        # Hash password and create user
        hashed_pw = hash_password(password)
        user = User(email=email, hashed_password=hashed_pw)

        self.db.add(user)
        await self.db.flush()  # Flush to get the user ID
        await self.db.commit()

        logger.info(f"New user registered: {email}")
        return user

    async def login(self, email: str, password: str) -> User:
        """
        Authenticate a user and return their record.

        Args:
            email: User email address
            password: Plain text password

        Returns:
            User instance if credentials are valid

        Raises:
            UserNotFoundException: If user doesn't exist
            InvalidCredentialsException: If password is incorrect
        """
        user = await self._get_user_by_email(email)
        if not user:
            # Run a dummy bcrypt verify before raising so total response time
            # matches the "user exists, wrong password" branch below. This
            # closes a timing oracle that would otherwise leak email validity.
            pwd_context.verify(password, _TIMING_DUMMY_HASH)
            logger.warning(f"Login attempted with non-existent email: {email[:3]}***")
            raise UserNotFoundException(f"User with email {email} not found")

        # Check account lockout
        if user.locked_until and user.locked_until > datetime.utcnow():
            logger.warning(f"Login attempted for locked account: {email[:3]}***")
            raise InvalidCredentialsException("Invalid email or password")

        if not verify_password(password, user.hashed_password):
            user.failed_login_count = (user.failed_login_count or 0) + 1
            if user.failed_login_count >= 5:
                user.locked_until = datetime.utcnow() + timedelta(minutes=15)
                logger.warning(f"Account locked after failed attempts: {email[:3]}***")
            await self.db.commit()
            logger.warning(f"Failed login attempt for: {email[:3]}***")
            raise InvalidCredentialsException("Invalid email or password")

        if not user.is_active:
            logger.warning(f"Login attempted for inactive user: {email[:3]}***")
            raise InvalidCredentialsException("User account is inactive")

        # Reset lockout state on successful login
        user.failed_login_count = 0
        user.locked_until = None
        await self.db.commit()

        logger.info(f"User logged in: {email[:3]}***")
        return user

    async def get_user_by_id(self, user_id: UUID) -> Optional[User]:
        """
        Get a user by ID.

        Args:
            user_id: User UUID

        Returns:
            User instance or None if not found
        """
        stmt = select(User).where(User.id == user_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def _get_user_by_email(self, email: str) -> Optional[User]:
        """
        Get a user by email (internal method).

        Args:
            email: User email address

        Returns:
            User instance or None if not found
        """
        stmt = select(User).where(User.email == email)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()
