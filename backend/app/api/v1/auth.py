"""
Authentication API endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.session import get_db
from app.middleware.auth import (
    UserToken,
    blacklist_token,
    create_access_token,
    get_required_current_user,
)
from app.schemas.auth import AuthResponse, LoginRequest, RegisterRequest, UserResponse
from app.services.auth_service import AuthService
from app.utils.exceptions import (
    InvalidCredentialsException,
    UserAlreadyExistsException,
    UserNotFoundException,
)
from app.utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter()


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(
    request: RegisterRequest,
    db: AsyncSession = Depends(get_db),
) -> AuthResponse:
    """
    Register a new user.

    Args:
        request: Registration request with email and password
        db: Database session

    Returns:
        AuthResponse with access token

    Raises:
        HTTP 409: User already exists
        HTTP 422: Invalid email or password
    """
    service = AuthService(db)

    try:
        user = await service.register(email=request.email, password=request.password)
    except UserAlreadyExistsException as exc:
        # Generic 400 (rather than 409 with the original message) so callers
        # cannot probe whether an email is already registered.
        logger.info("register_email_taken", extra={"email_prefix": request.email[:3]})
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Registration failed. Please try a different email address.",
        ) from exc

    # Create access token
    token = create_access_token(
        data={
            "sub": str(user.id),
            "email": user.email,
            "roles": [],
        }
    )

    return AuthResponse(access_token=token, token_type="bearer")


@router.post("/login", response_model=AuthResponse)
async def login(
    request: LoginRequest,
    db: AsyncSession = Depends(get_db),
) -> AuthResponse:
    """
    Login user with email and password.

    Args:
        request: Login request with email and password
        db: Database session

    Returns:
        AuthResponse with access token

    Raises:
        HTTP 401: Invalid credentials
        HTTP 404: User not found
    """
    service = AuthService(db)

    try:
        user = await service.login(email=request.email, password=request.password)
    except (UserNotFoundException, InvalidCredentialsException) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    # Create access token
    token = create_access_token(
        data={
            "sub": str(user.id),
            "email": user.email,
            "roles": [],
        }
    )

    response = JSONResponse(content={"access_token": token, "token_type": "bearer"})
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=settings.environment == "production",
        samesite="lax",
        max_age=settings.access_token_expire_minutes * 60,
    )
    return response


@router.get("/me", response_model=UserResponse)
async def get_current_user(
    current_user: UserToken = Depends(get_required_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    """
    Get current authenticated user information.

    Args:
        current_user: Current user from token
        db: Database session

    Returns:
        UserResponse with user data

    Raises:
        HTTP 401: Authentication required
    """
    service = AuthService(db)
    user = await service.get_user_by_id(user_id=current_user["user_id"])

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return UserResponse(
        id=user.id,
        email=user.email,
        is_active=user.is_active,
        created_at=user.created_at,
    )


@router.post("/logout")
async def logout(
    current_user: UserToken = Depends(get_required_current_user),
    request: Request = None,
) -> dict:
    """
    Logout the current user by blacklisting their token.

    Args:
        current_user: Current user from token (ensures authentication required)
        request: HTTP request to extract token from Authorization header

    Returns:
        Logout confirmation message

    Raises:
        HTTP 401: Authentication required
    """
    # Extract token from Authorization header
    auth_header = request.headers.get("Authorization", "")
    token = auth_header.replace("Bearer ", "")

    if token:
        blacklist_token(token)
        logger.info(f"User {current_user['user_id']} logged out")

    return {"message": "Logged out successfully"}
