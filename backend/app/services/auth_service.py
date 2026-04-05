"""
Authentication Service - Business logic for user authentication
"""
import hashlib
from typing import Optional
from uuid import UUID

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


def hash_password(password: str) -> str:
    """
    Hash a password using SHA-256.

    Falls back to SHA-256 if passlib is not available.
    For production, install passlib with bcrypt:
        pip install passlib[bcrypt]

    Args:
        password: Plain text password to hash

    Returns:
        Hashed password string
    """
    try:
        from passlib.context import CryptContext
        # This would be the production approach with bcrypt
        pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        return pwd_context.hash(password)
    except ImportError:
        # Fallback to SHA-256 for development/testing
        logger.warning(
            "passlib not installed; using SHA-256 for password hashing. "
            "For production, install: pip install passlib[bcrypt]"
        )
        salt = hashlib.sha256(b"grayfsm_salt").hexdigest()[:16]
        return hashlib.sha256((password + salt).encode()).hexdigest()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a password against a hash.

    Args:
        plain_password: Plain text password to verify
        hashed_password: Stored hashed password

    Returns:
        True if password matches, False otherwise
    """
    try:
        from passlib.context import CryptContext
        pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        return pwd_context.verify(plain_password, hashed_password)
    except ImportError:
        # Fallback to SHA-256 comparison
        salt = hashlib.sha256(b"grayfsm_salt").hexdigest()[:16]
        return hashlib.sha256((plain_password + salt).encode()).hexdigest() == hashed_password


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
            logger.warning(f"Login attempted with non-existent email: {email}")
            raise UserNotFoundException(f"User with email {email} not found")

        if not verify_password(password, user.hashed_password):
            logger.warning(f"Failed login attempt for user: {email}")
            raise InvalidCredentialsException("Invalid credentials")

        if not user.is_active:
            logger.warning(f"Login attempted for inactive user: {email}")
            raise InvalidCredentialsException("User account is inactive")

        logger.info(f"User logged in: {email}")
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
