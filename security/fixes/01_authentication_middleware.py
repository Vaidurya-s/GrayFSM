"""
Authentication and Authorization Middleware for GrayFSM
Fixes: V-01, V-07 (No Authentication/Authorization)

IMPLEMENTATION GUIDE:
1. Install: pip install python-jose[cryptography] passlib[bcrypt]
2. Copy to: /backend/app/middleware/auth.py
3. Update main.py to use this middleware
4. Create /api/v1/auth.py router for login/register
"""

from datetime import datetime, timedelta
from typing import Optional, List
from uuid import UUID

from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.session import get_db


# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()


class TokenData(BaseModel):
    """JWT token payload"""
    user_id: UUID
    email: str
    roles: List[str] = []


class User(BaseModel):
    """User model for authentication"""
    id: UUID
    email: str
    is_active: bool = True
    is_superuser: bool = False
    roles: List[str] = []


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash a password for storage"""
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create JWT access token

    Security considerations:
    - Use strong secret key (min 256 bits)
    - Set reasonable expiration (30 minutes)
    - Include minimal claims to reduce token size
    """
    to_encode = data.copy()

    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)

    to_encode.update({
        "exp": expire,
        "iat": datetime.utcnow(),
        "type": "access"
    })

    encoded_jwt = jwt.encode(
        to_encode,
        settings.secret_key,
        algorithm=settings.algorithm
    )
    return encoded_jwt


def create_refresh_token(user_id: UUID) -> str:
    """Create JWT refresh token with longer expiration"""
    expire = datetime.utcnow() + timedelta(days=settings.refresh_token_expire_days)

    to_encode = {
        "sub": str(user_id),
        "exp": expire,
        "iat": datetime.utcnow(),
        "type": "refresh"
    }

    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


async def verify_token(token: str) -> TokenData:
    """
    Verify and decode JWT token

    Security validations:
    - Check signature
    - Validate expiration
    - Verify token type
    - Check required claims
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(
            token,
            settings.secret_key,
            algorithms=[settings.algorithm]
        )

        # Validate token type
        if payload.get("type") != "access":
            raise credentials_exception

        # Extract user data
        user_id: str = payload.get("sub")
        email: str = payload.get("email")
        roles: List[str] = payload.get("roles", [])

        if user_id is None or email is None:
            raise credentials_exception

        return TokenData(
            user_id=UUID(user_id),
            email=email,
            roles=roles
        )

    except JWTError:
        raise credentials_exception


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> User:
    """
    Dependency to get current authenticated user

    Usage:
        @router.get("/protected")
        async def protected_route(user: User = Depends(get_current_user)):
            return {"user_id": user.id}
    """
    token = credentials.credentials
    token_data = await verify_token(token)

    # TODO: Query user from database
    # user = await db.get(UserModel, token_data.user_id)
    # if user is None or not user.is_active:
    #     raise HTTPException(status_code=401, detail="User not found or inactive")

    # For now, return token data as user
    return User(
        id=token_data.user_id,
        email=token_data.email,
        roles=token_data.roles
    )


async def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """Ensure user is active"""
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user


def require_roles(required_roles: List[str]):
    """
    Dependency factory for role-based access control

    Usage:
        @router.delete("/fsms/{fsm_id}")
        async def delete_fsm(
            fsm_id: UUID,
            user: User = Depends(require_roles(["admin", "moderator"]))
        ):
            ...
    """
    async def role_checker(user: User = Depends(get_current_active_user)) -> User:
        if not any(role in user.roles for role in required_roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions"
            )
        return user

    return role_checker


class RateLimitExceeded(HTTPException):
    """Custom exception for rate limit"""
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded. Please try again later.",
            headers={"Retry-After": "3600"}
        )


async def verify_api_key(
    request: Request,
    db: AsyncSession = Depends(get_db)
) -> Optional[User]:
    """
    Alternative authentication via API key

    Usage for service-to-service authentication:
        X-API-Key: your-api-key-here
    """
    api_key = request.headers.get("X-API-Key")

    if not api_key:
        return None

    # TODO: Validate API key against database
    # api_key_obj = await db.query(APIKey).filter(APIKey.key == api_key).first()
    # if api_key_obj and api_key_obj.is_active:
    #     return api_key_obj.user

    return None


# Example usage in routes:
"""
# /backend/app/api/v1/fsm.py - UPDATED WITH AUTH

from app.middleware.auth import get_current_active_user, require_roles, User

@router.post("", response_model=FSMResponse, status_code=201)
async def create_fsm(
    fsm_data: FSMCreate,
    current_user: User = Depends(get_current_active_user),  # ADD THIS
    db: AsyncSession = Depends(get_db)
):
    service = FSMService(db)
    fsm = await service.create_fsm(fsm_data, user_id=current_user.id)  # Pass user_id
    return fsm


@router.delete("/{fsm_id}", status_code=204)
async def delete_fsm(
    fsm_id: UUID,
    current_user: User = Depends(require_roles(["admin", "owner"])),  # RBAC
    db: AsyncSession = Depends(get_db)
):
    service = FSMService(db)

    # Verify ownership
    fsm = await service.get_fsm(fsm_id)
    if fsm.created_by != current_user.id and "admin" not in current_user.roles:
        raise HTTPException(status_code=403, detail="Not authorized to delete this FSM")

    await service.delete_fsm(fsm_id)
"""
