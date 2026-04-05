"""
Pydantic schemas for authentication API requests/responses
"""
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    """Schema for user registration request"""
    email: EmailStr = Field(..., description="User email address")
    password: str = Field(..., min_length=8, description="Password (min 8 characters)")


class LoginRequest(BaseModel):
    """Schema for user login request"""
    email: EmailStr = Field(..., description="User email address")
    password: str = Field(..., description="User password")


class AuthResponse(BaseModel):
    """Schema for authentication response"""
    access_token: str = Field(..., description="JWT access token")
    token_type: str = Field(default="bearer", description="Token type")


class UserResponse(BaseModel):
    """Schema for user data response"""
    id: UUID = Field(..., description="User ID")
    email: str = Field(..., description="User email")
    is_active: bool = Field(..., description="Whether user is active")
    created_at: datetime = Field(..., description="User creation timestamp")

    model_config = {"from_attributes": True}
