"""
Secure Cookie Configuration
Fixes: V-12 (Tokens in localStorage)

IMPLEMENTATION GUIDE:
1. Use httpOnly cookies instead of localStorage for tokens
2. Update authentication flow to use cookies
3. Update frontend to remove localStorage usage
"""

from datetime import datetime, timedelta
from typing import Optional

from fastapi import Response, Request
from app.config import settings


class SecureCookieManager:
    """
    Secure cookie management for authentication tokens

    Security features:
    - HttpOnly: Prevent JavaScript access (XSS protection)
    - Secure: HTTPS only in production
    - SameSite: CSRF protection
    - Domain: Scope limitation
    - Path: Scope limitation
    """

    @staticmethod
    def set_auth_cookies(
        response: Response,
        access_token: str,
        refresh_token: str,
        remember_me: bool = False
    ) -> None:
        """
        Set authentication cookies

        Args:
            response: FastAPI response object
            access_token: JWT access token
            refresh_token: JWT refresh token
            remember_me: Extend cookie expiration
        """
        # Access token cookie (short-lived)
        access_token_max_age = settings.access_token_expire_minutes * 60

        response.set_cookie(
            key="access_token",
            value=access_token,
            httponly=True,  # Prevent XSS
            secure=settings.is_production,  # HTTPS only in production
            samesite="strict",  # CSRF protection
            max_age=access_token_max_age,
            path="/",  # Available to entire application
            domain=None,  # Current domain only
        )

        # Refresh token cookie (long-lived)
        if remember_me:
            refresh_token_max_age = settings.refresh_token_expire_days * 24 * 60 * 60
        else:
            refresh_token_max_age = 7 * 24 * 60 * 60  # 7 days default

        response.set_cookie(
            key="refresh_token",
            value=refresh_token,
            httponly=True,
            secure=settings.is_production,
            samesite="strict",
            max_age=refresh_token_max_age,
            path="/api/v1/auth/refresh",  # Only accessible to refresh endpoint
            domain=None,
        )

        # Optional: Set a non-httpOnly cookie for client-side auth state
        # This allows frontend to know if user is authenticated without accessing token
        response.set_cookie(
            key="is_authenticated",
            value="true",
            httponly=False,  # Accessible to JavaScript
            secure=settings.is_production,
            samesite="strict",
            max_age=access_token_max_age,
            path="/",
        )

    @staticmethod
    def clear_auth_cookies(response: Response) -> None:
        """Clear all authentication cookies (logout)"""
        cookies_to_clear = ["access_token", "refresh_token", "is_authenticated"]

        for cookie in cookies_to_clear:
            response.delete_cookie(
                key=cookie,
                path="/",
                secure=settings.is_production,
                samesite="strict",
            )

    @staticmethod
    def get_token_from_cookie(request: Request, token_type: str = "access") -> Optional[str]:
        """
        Extract token from cookie

        Args:
            request: FastAPI request object
            token_type: "access" or "refresh"

        Returns:
            Token string or None
        """
        cookie_name = f"{token_type}_token"
        return request.cookies.get(cookie_name)


# Updated authentication endpoints
"""
# /backend/app/api/v1/auth.py

from fastapi import APIRouter, Depends, HTTPException, Response, Request
from app.middleware.auth import create_access_token, create_refresh_token
from app.security.secure_cookies import SecureCookieManager

router = APIRouter()


@router.post("/login")
async def login(
    credentials: LoginCredentials,
    response: Response,
    db: AsyncSession = Depends(get_db)
):
    '''
    Login endpoint - Sets secure cookies instead of returning tokens
    '''
    # Validate credentials
    user = await authenticate_user(db, credentials.email, credentials.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Create tokens
    access_token = create_access_token(
        data={"sub": str(user.id), "email": user.email, "roles": user.roles}
    )
    refresh_token = create_refresh_token(user.id)

    # Set secure cookies
    SecureCookieManager.set_auth_cookies(
        response=response,
        access_token=access_token,
        refresh_token=refresh_token,
        remember_me=credentials.remember_me
    )

    # Return user info (not tokens!)
    return {
        "success": True,
        "data": {
            "user": {
                "id": user.id,
                "email": user.email,
                "name": user.name,
            }
        }
    }


@router.post("/logout")
async def logout(response: Response):
    '''Logout - Clear cookies'''
    SecureCookieManager.clear_auth_cookies(response)

    return {
        "success": True,
        "message": "Logged out successfully"
    }


@router.post("/refresh")
async def refresh_token(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db)
):
    '''
    Refresh access token using refresh token from cookie
    '''
    # Get refresh token from cookie
    refresh_token = SecureCookieManager.get_token_from_cookie(request, "refresh")

    if not refresh_token:
        raise HTTPException(status_code=401, detail="Refresh token missing")

    # Verify refresh token
    try:
        from jose import jwt
        payload = jwt.decode(
            refresh_token,
            settings.secret_key,
            algorithms=[settings.algorithm]
        )

        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")

        user_id = payload.get("sub")

    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    # Get user from database
    user = await db.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found")

    # Create new access token
    new_access_token = create_access_token(
        data={"sub": str(user.id), "email": user.email, "roles": user.roles}
    )

    # Update access token cookie
    response.set_cookie(
        key="access_token",
        value=new_access_token,
        httponly=True,
        secure=settings.is_production,
        samesite="strict",
        max_age=settings.access_token_expire_minutes * 60,
        path="/",
    )

    return {"success": True, "message": "Token refreshed"}
"""

# Updated authentication middleware
"""
# /backend/app/middleware/auth.py

from app.security.secure_cookies import SecureCookieManager

async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db)
) -> User:
    '''
    Get current user from cookie instead of Authorization header

    Priority:
    1. Cookie-based auth (preferred)
    2. Header-based auth (for API clients)
    '''
    token = None

    # Try cookie first
    token = SecureCookieManager.get_token_from_cookie(request, "access")

    # Fall back to Authorization header (for API clients)
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.replace("Bearer ", "")

    if not token:
        raise HTTPException(
            status_code=401,
            detail="Authentication required"
        )

    # Verify token
    token_data = await verify_token(token)

    # Get user from database
    user = await db.get(User, token_data.user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found")

    return user
"""

# Frontend changes (React/TypeScript)
"""
// REMOVE: localStorage token storage
// DELETE: localStorage.setItem('auth_token', token)
// DELETE: localStorage.getItem('auth_token')
// DELETE: localStorage.removeItem('auth_token')

// UPDATE: API client to use credentials
// frontend/src/api/client.ts

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,  // ADD THIS - Send cookies with requests
});

// REMOVE: Request interceptor that adds Authorization header from localStorage
// Cookies are sent automatically by browser

// UPDATE: Login function
export async function login(email: string, password: string, rememberMe: boolean = false) {
  // Cookies are set by server in response
  const response = await apiClient.post('/api/v1/auth/login', {
    email,
    password,
    remember_me: rememberMe,
  });

  return response.data;
}

// UPDATE: Logout function
export async function logout() {
  // Cookies are cleared by server
  await apiClient.post('/api/v1/auth/logout');
}

// UPDATE: Check authentication
export function isAuthenticated(): boolean {
  // Check non-httpOnly cookie
  return document.cookie.includes('is_authenticated=true');
}

// ADD: Automatic token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If 401 and not already retrying
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Attempt token refresh
        await apiClient.post('/api/v1/auth/refresh');

        // Retry original request
        return apiClient(originalRequest);
      } catch (refreshError) {
        // Refresh failed, redirect to login
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);
"""
